// frontend/src/api/apiService.js
import axios from 'axios';
import { API_ENDPOINTS } from '../constants';

const getAuthToken = () => localStorage.getItem('auth_token');
const getRefreshToken = () => localStorage.getItem('refresh_token');

let currentCsrfToken = null;
let isRefreshingAccessToken = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

export const setApiServiceCsrfToken = (token) => {
  currentCsrfToken = token;
};

export const getApiServiceCsrfToken = () => currentCsrfToken;

const apiClient = axios.create({
  baseURL: '/',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
});

export const fetchAndSetCsrfToken = async () => {
  try {
    const response = await apiClient.get(API_ENDPOINTS.AUTH_CSRF);
    const headerToken = response.headers['x-csrf-token'];
    const bodyToken = response.data?.csrfToken;
    const newCsrfToken = headerToken || bodyToken;
    if (newCsrfToken) {
      setApiServiceCsrfToken(newCsrfToken);
      return newCsrfToken;
    }
    console.warn('CSRF token not found in response from ' + API_ENDPOINTS.AUTH_CSRF);
    return null;
  } catch (error) {
    console.error('Error fetching CSRF token via apiService:', error.response?.data || error.message);
    // If CSRF fetch fails, it could be due to an invalid auth session if it becomes protected.
    // Or simply network / server error for the CSRF endpoint itself.
    if (error.response && error.response.status === 401) {
         window.dispatchEvent(new CustomEvent('auth-error-logout', { detail: 'CSRF fetch unauthorized' }));
    }
    return null;
  }
};

apiClient.interceptors.request.use(
  async (config) => {
    const authToken = getAuthToken();
    if (authToken) {
      config.headers['Authorization'] = `Bearer ${authToken}`;
    }

    if (config.url !== API_ENDPOINTS.AUTH_CSRF && config.url !== API_ENDPOINTS.AUTH_REFRESH && 
        (!config.method || config.method.toLowerCase() !== 'options')) {
      let csrfTokenToUse = getApiServiceCsrfToken();
      if (!csrfTokenToUse && !config._csrfAttempted) { // Add _csrfAttempted to prevent loop if CSRF fetch itself fails
        config._csrfAttempted = true; 
        // console.log(`apiService Interceptor: CSRF token missing for ${config.url}, attempting to fetch...`);
        csrfTokenToUse = await fetchAndSetCsrfToken();
      }

      if (csrfTokenToUse) {
        config.headers['X-CSRF-Token'] = csrfTokenToUse;
      } else {
        // Only warn if it's not the CSRF fetch that failed and we still don't have one
        if (config.url !== API_ENDPOINTS.AUTH_CSRF) { 
            console.warn(`apiService Interceptor: CSRF token is still missing for ${config.method || 'GET'} request to ${config.url}.`);
        }
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Handle 403 Forbidden - Potential CSRF issue
    if (error.response && error.response.status === 403 && !originalRequest._retryCSRF) {
        console.warn(`apiService: Received 403 for ${originalRequest.method?.toUpperCase()} ${originalRequest.url}. Sent CSRF: ${originalRequest.headers['X-CSRF-Token'] ? 'Yes' : 'No'}. Attempting to refresh CSRF token and retry.`);
        originalRequest._retryCSRF = true;
        try {
            await fetchAndSetCsrfToken(); // This updates currentCsrfToken internally
            // The request interceptor will pick up the new CSRF token on retry via getApiServiceCsrfToken()
            return apiClient(originalRequest);
        } catch (csrfError) {
            console.error('apiService: Failed to refresh CSRF token after 403, or retry failed:', csrfError);
            // If CSRF refresh fails critically, dispatch logout
            window.dispatchEvent(new CustomEvent('auth-error-logout', { detail: 'CSRF refresh failed after 403' }));
            return Promise.reject(csrfError); // Or original error
        }
    }

    // Handle 401 Unauthorized - Access Token expired
    if (error.response && error.response.status === 401 && !originalRequest._retryAuth) {
      if (isRefreshingAccessToken) {
        return new Promise(function(resolve, reject) {
          failedQueue.push({ resolve, reject });
        }).then(newAccessToken => {
          originalRequest.headers['Authorization'] = 'Bearer ' + newAccessToken;
          return apiClient(originalRequest); // Retry with new token
        }).catch(err => {
          return Promise.reject(err); // Propagate error if queue processing fails
        });
      }

      originalRequest._retryAuth = true;
      isRefreshingAccessToken = true;
      const localRefreshToken = getRefreshToken();

      if (!localRefreshToken) {
        console.error('apiService: No refresh token found for 401 renewal. Logging out.');
        isRefreshingAccessToken = false;
        window.dispatchEvent(new CustomEvent('auth-error-logout', { detail: 'No refresh token' }));
        return Promise.reject(error);
      }
      
      return apiClient.post(API_ENDPOINTS.AUTH_REFRESH, { refresh_token: localRefreshToken })
        .then(res => {
          const { access_token, refresh_token: new_refresh_token } = res.data;
          localStorage.setItem('auth_token', access_token);
          if (new_refresh_token) {
            localStorage.setItem('refresh_token', new_refresh_token);
          } else { // If backend doesn't rotate refresh tokens, ensure the old one isn't accidentally cleared
             console.warn("apiService: Backend did not return a new refresh_token during token refresh.");
          }
          
          // Update default header for subsequent direct apiClient calls if any (though interceptor is better)
          // apiClient.defaults.headers.common['Authorization'] = 'Bearer ' + access_token;
          
          // Update header for the original request and retry it
          originalRequest.headers['Authorization'] = 'Bearer ' + access_token;
          processQueue(null, access_token);
          return apiClient(originalRequest);
        })
        .catch(refreshErr => {
          console.error('apiService: Refresh token failed or session expired.', refreshErr.response?.data || refreshErr.message);
          processQueue(refreshErr, null);
          window.dispatchEvent(new CustomEvent('auth-error-logout', { detail: 'Refresh token failed' }));
          return Promise.reject(refreshErr);
        })
        .finally(() => {
          isRefreshingAccessToken = false;
        });
    }
    // For other errors or if retries failed
    if (error.response) {
         console.error(`API Service: ${error.response.status} error for ${error.config.method?.toUpperCase()} ${error.config.url}. CSRF: ${error.config.headers['X-CSRF-Token'] ? 'Yes' : 'No'}`);
    }
    return Promise.reject(error);
  }
);

export const apiLogin = (username, password) => {
  return apiClient.post(API_ENDPOINTS.AUTH_LOGIN, { username, password });
};
export const apiRegister = (username, password) => {
  return apiClient.post(API_ENDPOINTS.AUTH_REGISTER, { username, password });
};
export const apiLogout = () => {
  return apiClient.post(API_ENDPOINTS.AUTH_LOGOUT, {});
};

export const apiUploadFile = (formData, onUploadProgress) => {
  return apiClient.post(API_ENDPOINTS.UPLOAD, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
    onUploadProgress,
  });
};

// ... other api functions remain the same
export const apiFetchDashboardData = () => apiClient.get(API_ENDPOINTS.DASHBOARD_DATA);
export const apiFetchProcessedTransactions = () => apiClient.get(API_ENDPOINTS.PROCESSED_TRANSACTIONS);
export const apiFetchStockHoldings = () => apiClient.get(API_ENDPOINTS.STOCK_HOLDINGS);
export const apiFetchOptionHoldings = () => apiClient.get(API_ENDPOINTS.OPTION_HOLDINGS);
export const apiFetchStockSales = () => apiClient.get(API_ENDPOINTS.STOCK_SALES);
export const apiFetchOptionSales = () => apiClient.get(API_ENDPOINTS.OPTION_SALES);
export const apiFetchDividendTaxSummary = () => apiClient.get(API_ENDPOINTS.DIVIDEND_TAX_SUMMARY);
export const apiFetchDividendTransactions = () => apiClient.get(API_ENDPOINTS.DIVIDEND_TRANSACTIONS);
export const apiCheckUserHasData = () => apiClient.get(API_ENDPOINTS.USER_HAS_DATA);


export default apiClient;