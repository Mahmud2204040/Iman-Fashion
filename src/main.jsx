import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

import App from './App.jsx';
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

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <LocaleProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </LocaleProvider>
    </BrowserRouter>
  </React.StrictMode>
);
