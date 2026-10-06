/**
 * AuthContext — Phase 3.
 *
 * The single source of truth for "who is logged in". Lives above the
 * router so guards can read the latest session state during render.
 *
 * Exposes:
 *   {
 *     user,            // server-validated user object or null
 *     role,            // 'OWNER' | 'EMPLOYEE' | null
 *     isAuthenticated, // boolean
 *     isLoading,       // true while the initial session restore is in flight
 *     login,           // (credentials) => Promise<void>
 *     logout           // () => Promise<void>
 *   }
 *
 * Components MUST go through this context — never read storage directly.
 */

import { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { createIsolatedQueryClient } from '../cache/queryClient.js';
import { setupCrossTabInvalidation } from '../cache/mutations.js';
import { clearL2Cache } from '../cache/l2Cache.js';

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
      } catch {
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const expired = () => {
      clearL2Cache();
      setUser(null);
    };
    window.addEventListener('ni-fashion:session-expired', expired);
    return () => window.removeEventListener('ni-fashion:session-expired', expired);
  }, []);

  const login = useCallback(async (credentials) => {
    const next = await authService.login(credentials);
    setUser(next);
    return next;
  }, []);

  const logout = useCallback(async () => {
    await authService.logout();
    clearL2Cache();
    setUser(null);
  }, []);

  // Create an account-scoped QueryClient that resets on logout/account switch
  const lastUserId = useRef(user?.id);
  const clientRef = useRef(null);
  if (!clientRef.current) {
    clientRef.current = createIsolatedQueryClient();
    setupCrossTabInvalidation(clientRef.current);
  }

  if (user?.id !== lastUserId.current) {
    if (clientRef.current) clientRef.current.clear();
    clientRef.current = createIsolatedQueryClient();
    setupCrossTabInvalidation(clientRef.current);
    lastUserId.current = user?.id;
  }

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

  return (
    <AuthContext.Provider value={value}>
      <QueryClientProvider client={clientRef.current}>
        {children}
      </QueryClientProvider>
    </AuthContext.Provider>
  );
}
