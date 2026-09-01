/**
 * Mock user fixtures — Phase 3, frontend-only.
 *
 * Per FRONTEND_PLAN.md Phase 3 and the explicit client instruction, the
 * development credentials are exactly:
 *
 *   owner    / 1234  → OWNER
 *   employee / 1234  → EMPLOYEE
 *
 * This is a mock. There is NO password storage, NO hashing, NO real auth.
 * A real backend will replace this entirely.
 *
 * The password is stored in this single fixture file only and never leaves
 * the authService. The UI never receives the password after login.
 */
import { ROLES } from '../constants/roles.js';

export const MOCK_USERS = Object.freeze([
  Object.freeze({
    username: 'owner',
    role: ROLES.OWNER,
  }),
  Object.freeze({
    username: 'employee',
    role: ROLES.EMPLOYEE,
  }),
]);

/**
 * The single password every mock account shares in development.
 *
 * Kept as a constant so it is impossible to forget that the mock auth
 * has no per-user secret.
 */
export const MOCK_PASSWORD = '1234';