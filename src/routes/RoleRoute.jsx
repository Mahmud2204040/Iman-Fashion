/**
 * RoleRoute — Phase 3.
 *
 * Combined guard: requires authentication AND one of the allowed roles.
 *
 * Usage:
 *   <RoleRoute roles={[ROLES.OWNER]}>...</RoleRoute>
 *
 * Behavior:
 *   - Loading     → render nothing.
 *   - No session  → redirect to /login (same as ProtectedRoute).
 *   - Wrong role  → render <UnauthorizedPage /> in place of the subtree.
 *                   Employees do NOT silently get bounced to /dashboard;
 *                   we surface a real "you can't see this" page.
 *   - Right role  → render children.
 *
 * IMPORTANT: Per PROJECT_RULES.md §9, this is a UX gate only. The real
 * authorization lives on the backend. Do not rely on this for security.
 */
import { Navigate, useLocation } from 'react-router-dom';

import UnauthorizedPage from '../pages/UnauthorizedPage.jsx';
import AppShell from '../layouts/AppShell/index.js';
import { useAuth } from '../hooks/useAuth.js';

export default function RoleRoute({ roles, children }) {
  const { isAuthenticated, isLoading, role } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return null;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  const allowed = Array.isArray(roles) ? roles : [];
  if (!allowed.includes(role)) {
    return <UnauthorizedPage />;
  }

  return <AppShell>{children}</AppShell>;
}