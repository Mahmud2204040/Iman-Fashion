import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

import App from './App.jsx';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './contexts/AuthContext.jsx';
import { LocaleProvider } from './contexts/LocaleContext.jsx';
import './styles/global.css';
// tokens.css is imported via global.css (see @import at top of that file)

/**
 * Provider hierarchy (Phase 3):
 *   BrowserRouter
 *     └── AuthProvider
 *           └── App  (renders <AppRoutes />)
 *
 * AuthProvider must live INSIDE BrowserRouter so route guards can read
 * `useNavigate()` (via react-router) and the auth state at the same time.
 */


// Initialize QueryClient with default cache rules
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2, // Data is fresh for 2 minutes
      cacheTime: 1000 * 60 * 10, // Unused data stays in cache for 10 minutes
      retry: 1, // Only retry once on failure
      refetchOnWindowFocus: false, // Don't spam API when switching tabs
    },
  },
});
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
    <BrowserRouter>
      <LocaleProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </LocaleProvider>
    </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
);
