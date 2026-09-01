/**
 * authContext — Phase 3.
 *
 * Plain JS module that owns the React context object for auth state.
 * Kept in its own file (no JSX, no components) so that the
 * `react-refresh/only-export-components` rule is happy and Fast Refresh
 * keeps working for `AuthContext.jsx`, which only exports the Provider.
 *
 * The shape of the value is documented on `<AuthProvider>` in
 * `AuthContext.jsx`.
 */
import { createContext } from 'react';

export const AuthContext = createContext(null);