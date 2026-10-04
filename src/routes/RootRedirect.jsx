/**
 * RootRedirect — Phase 3.
 *
 * Tiny inline component used for the `/` route. Reads the auth state and
 * sends the Owner to /dashboard, Employee to /sales/new, or a signed-out
 * visitor to /login.
 *
 * Render-nothing while AuthProvider is restoring the session to avoid a
 * brief /dashboard → /login flicker on hard refresh.
 */
import { Navigate } from 'react-router-dom';

import { useAuth } from '../hooks/useAuth.js';
import { ROLES } from '../constants/roles.js';

export default function RootRedirect() {
  const { isAuthenticated, isLoading, role } = useAuth();

  if (isLoading) return null;
  const target = !isAuthenticated
    ? '/login'
    : role === ROLES.EMPLOYEE ? '/sales/new' : '/dashboard';
  return <Navigate to={target} replace />;
}
