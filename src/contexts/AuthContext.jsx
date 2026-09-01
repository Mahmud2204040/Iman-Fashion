/**
 * AuthContext — Phase 3.
 *
 * The single source of truth for "who is logged in". Lives above the
 * router so guards can read the latest session state during render.
 *
 * Exposes:
 *   {
 *     user,            // mock user object or null
 *     role,            // 'OWNER' | 'EMPLOYEE' | null
 *     isAuthenticated, // boolean
 *     isLoading,       // true while the initial session restore is in flight
 *     login,           // (credentials) => Promise<void>
 *     logout           // () => Promise<void>
 *   }
 *
 * Components MUST go through this context — never read storage directly.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';

import * as authService from '../services/auth/authService.js';
import { AuthContext } from './authContext.js';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Initial session restore — runs once on mount.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const restored = await authService.getCurrentUser();
        if (!cancelled) setUser(restored);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (credentials) => {
    const next = await authService.login(credentials);
    setUser(next);
    return next;
  }, []);

  const logout = useCallback(async () => {
    await authService.logout();
    setUser(null);
  }, []);

  const value = useMemo(() => {
    const role = user ? user.role : null;
    return {
      user,
      role,
      isAuthenticated: user !== null,
      isLoading,
      login,
      logout,
    };
  }, [user, isLoading, login, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}