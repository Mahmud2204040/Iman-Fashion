/**
 * RootRedirect — Phase 3.
 *
 * Tiny inline component used for the `/` route. Reads the auth state and
 * sends the user to /dashboard (when authenticated) or /login (otherwise).
 *
 * Render-nothing while AuthProvider is restoring the session to avoid a
 * brief /dashboard → /login flicker on hard refresh.
 */
import { Navigate } from 'react-router-dom';

import { useAuth } from '../hooks/useAuth.js';

export default function RootRedirect() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) return null;
  return <Navigate to={isAuthenticated ? '/dashboard' : '/login'} replace />;
}