// frontend/src/layouts/Layout.js

import React, { useState } from 'react';
import { Box, AppBar, Toolbar, Typography, IconButton, Tooltip, Avatar, Menu, MenuItem, Divider, Button, Container } from '@mui/material';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  Person as PersonIcon,
  Settings as SettingsIcon,
  Logout as LogoutIcon,
  AutoGraph as AutoGraphIcon
} from '@mui/icons-material';

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [anchorEl, setAnchorEl] = useState(null);
  const openMenu = Boolean(anchorEl);

  const handleMenuClick = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = async () => {
    handleMenuClose();
    await logout();
    navigate('/signin');
  };

  const handleSettings = () => {
    handleMenuClose();
    navigate('/settings');
  };

  const navItems = [
    { title: 'Carregar Transações', to: '/upload' },
    { title: 'Visão Geral', to: '/realizedgains' },
    { title: 'IRS', to: '/tax' },
    { title: 'Dados', to: '/transactions' },
  ];

  return (
    // The outer Box now just serves as a flex container without a background color
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <AppBar
        position="fixed"
        sx={{
          backgroundColor: 'background.paper', // Uses the theme's default paper/white color
          color: 'text.primary',
          boxShadow: 'none',
          borderBottom: (theme) => `1px solid ${theme.palette.divider}`,
        }}
      >
        <Container maxWidth="lg">
          <Toolbar disableGutters>
            <Box component={RouterLink} to={user ? "/dashboard" : "/"} sx={{ display: 'flex', alignItems: 'center', textDecoration: 'none', flexGrow: 1 }}>
              <AutoGraphIcon sx={{ mr: 1, color: '#178bba' }} />
              <Typography 
                variant="h6" 
                sx={{
                  fontFamily: "'Poppins', sans-serif",
                  fontWeight: 600,
                  color: '#6a6a62',
                }}
              >
                Rumo Claro
              </Typography>
            </Box>

            {user ? (
              <>
                <Box sx={{ display: { xs: 'none', sm: 'block' } }}>
                  {navItems.map((item) => (
                    <Button key={item.title} component={RouterLink} to={item.to} sx={{
                      fontFamily: "'Inter', sans-serif",
                      color: '#4b5563',
                      textTransform: 'none',
                      fontWeight: 500,
                      '&:hover': {
                        color: '#111827',
                      }
                    }}>
                      {item.title}
                    </Button>
                  ))}
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', ml: 2 }}>
                  <Tooltip title={user.username || "User Account"} placement="bottom">
                    <IconButton
                      onClick={handleMenuClick}
                      size="small"
                      sx={{ p: 0 }}
                      aria-controls={openMenu ? 'account-menu' : undefined}
                      aria-haspopup="true"
                      aria-expanded={openMenu ? 'true' : undefined}
                    >
                      <Avatar sx={{ width: 32, height: 32, bgcolor: 'secondary.main' }}>
                        {user.username ? user.username.charAt(0).toUpperCase() : <PersonIcon fontSize="small" />}
                      </Avatar>
                    </IconButton>
                  </Tooltip>
                  <Menu
                    anchorEl={anchorEl}
                    id="account-menu"
                    open={openMenu}
                    onClose={handleMenuClose}
                    PaperProps={{
                      elevation: 0,
                      sx: {
                        overflow: 'visible', filter: 'drop-shadow(0px 2px 8px rgba(0,0,0,0.32))', mt: 1.5,
                        '& .MuiAvatar-root': { width: 32, height: 32, ml: -0.5, mr: 1 },
                        '&::before': {
                          content: '""', display: 'block', position: 'absolute', top: 0, right: 14, width: 10, height: 10,
                          bgcolor: 'background.paper', transform: 'translateY(-50%) rotate(45deg)', zIndex: 0,
                        },
                      },
                    }}
                    transformOrigin={{ horizontal: 'right', vertical: 'top' }}
                    anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
                  >
                    <MenuItem disabled sx={{ fontWeight: 'medium', opacity: 0.8 }}>
                      {user.username}
                    </MenuItem>
                    <Divider sx={{ my: 0.5 }} />
                    <Box sx={{ display: { xs: 'block', sm: 'none' } }}>
                      {navItems.map((item) => (
                        <MenuItem key={item.title} component={RouterLink} to={item.to} onClick={handleMenuClose}>
                          {item.title}
                        </MenuItem>
                      ))}
                      <Divider sx={{ my: 0.5 }} />
                    </Box>
                    <MenuItem onClick={handleSettings}>
                      <SettingsIcon sx={{ mr: 1, color: 'text.secondary' }} fontSize="small" />
                      Configurações
                    </MenuItem>
                    <MenuItem onClick={handleLogout}>
                      <LogoutIcon sx={{ mr: 1, color: 'text.secondary' }} fontSize="small" />
                      Sair
                    </MenuItem>
                  </Menu>
                </Box>
              </>
            ) : (
              <Box>
                                    <Button
                    component={RouterLink}
                    to="/signin"
                    variant="text"
                    sx={{
                      fontFamily: "'Inter', sans-serif",
                      color: '#4b5563',
                      fontWeight: 500,
                      textTransform: 'none',
                      '&:hover': {
                        color: '#111827',
                        backgroundColor: 'transparent',
                      },
                    }}
                  >
                    Sign in
                  </Button>
              </Box>
            )}
          </Toolbar>
        </Container>
      </AppBar>

      <Container 
        component="main" 
        maxWidth="lg"
        sx={{
          flexGrow: 1,
          pt: { xs: 9, sm: 10 },
          pb: 4,
        }}
      >
        {children}
      </Container>
    </Box>
  );
}