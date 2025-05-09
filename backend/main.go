package main

import (
	"TAXFOLIO/src/handlers"
	"TAXFOLIO/src/parsers"    // Import parsers
	"TAXFOLIO/src/processors" // Import processors
	"TAXFOLIO/src/services"   // Import services
	"log"
	"net/http"
)

func enableCORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Set CORS headers
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "POST, GET, OPTIONS, PUT, DELETE")
		w.Header().Set("Access-Control-Allow-Headers", "Accept, Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization")

		// Handle preflight requests
		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}

		next.ServeHTTP(w, r)
	})
}

func main() {
	// Instantiate concrete implementations
	csvParser := parsers.NewCSVParser()
	transactionProcessor := parsers.NewTransactionProcessor()
	dividendProcessor := processors.NewDividendProcessor()
	stockProcessor := processors.NewStockProcessor()
	optionProcessor := processors.NewOptionProcessor()
	cashMovementProcessor := processors.NewCashMovementProcessor() // Added

	// Instantiate the service with dependencies
	uploadService := services.NewUploadService(
		csvParser,
		transactionProcessor,
		dividendProcessor,
		stockProcessor,
		optionProcessor,
		cashMovementProcessor, // Added
	)

	// Initialize the upload handler with the service
	uploadHandler := handlers.NewUploadHandler(uploadService)

	// Set up routes with CORS enabled
	router := http.NewServeMux()
	router.HandleFunc("POST /upload", uploadHandler.HandleUpload)
	router.HandleFunc("GET /api/stock-sales", uploadHandler.HandleGetStockSales)                       // Added route for stock sales
	router.HandleFunc("GET /api/option-sales", uploadHandler.HandleGetOptionSales)                     // Added route for option sales
	router.HandleFunc("GET /api/dividend-tax-summary", uploadHandler.HandleGetDividendTaxSummary)      // Added route for dividend tax summary
	router.HandleFunc("GET /api/dividend-transactions", uploadHandler.HandleGetDividendTransactions)   // Added route for individual dividend transactions
	router.HandleFunc("GET /api/raw-transactions", uploadHandler.HandleGetRawTransactions)             // Added route for raw transactions
	router.HandleFunc("GET /api/processed-transactions", uploadHandler.HandleGetProcessedTransactions) // Added route for processed transactions
	router.HandleFunc("GET /api/holdings/stocks", uploadHandler.HandleGetStockHoldings)                // Added route for stock holdings
	router.HandleFunc("GET /api/holdings/options", uploadHandler.HandleGetOptionHoldings)              // Added route for option holdings
	router.HandleFunc("GET /", func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte("TAXFOLIO Backend is running"))
	})

	// Wrap the router with CORS middleware
	corsRouter := enableCORS(router)

	// Start the server
	log.Println("Server running at http://localhost:8080")
	if err := http.ListenAndServe(":8080", corsRouter); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
