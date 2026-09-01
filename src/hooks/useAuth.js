/**
 * useAuth — convenience consumer for AuthContext.
 *
 * Throws if used outside an <AuthProvider>. That makes accidental misuse
 * loud rather than silently returning `null`.
 */
import { useContext } from 'react';

import { AuthContext } from '../contexts/authContext.js';

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (ctx === null) {
    throw new Error('useAuth must be used inside <AuthProvider>.');
  }
  return ctx;
}