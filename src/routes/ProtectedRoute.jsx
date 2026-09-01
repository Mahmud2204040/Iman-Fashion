/**
 * ProtectedRoute — Phase 3.
 *
 * Gates any subtree behind authentication.
 *
 *   - While the initial session restore is in flight → render nothing
 *     (avoids a flash of /login during hard refresh).
 *   - Unauthenticated → redirect to /login, preserving the originally
 *     requested path so the user lands where they meant to go.
 *   - Authenticated → render children.
 *
 * Pages MUST NOT do their own auth checks. Wrap them here.
 */
import { Navigate, useLocation } from 'react-router-dom';

import { useAuth } from '../hooks/useAuth.js';
import AppShell from '../layouts/AppShell/index.js';

export default function ProtectedRoute({ children }) {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    // No spinner here on purpose — keeps first-paint minimal and avoids
    // pulling layout tokens before the design system is fully wired.
    return null;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <AppShell>{children}</AppShell>;
}