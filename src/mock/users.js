/**
 * Mock user fixtures — Phase 3, frontend-only.
 *
 * Per FRONTEND_PLAN.md Phase 3 and the explicit client instruction, the
 * development credentials are exactly:
 *
 *   owner    / 1234  → OWNER
 *   employee / 1234  → EMPLOYEE
 *
 * This is a mock. These are the initial credentials until a local demo
 * password is set for an account. A real backend must replace this.
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
 * Initial password for the built-in demo accounts only.
 */
export const MOCK_PASSWORD = '1234';
