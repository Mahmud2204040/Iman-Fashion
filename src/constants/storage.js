/**
 * Storage keys used by the mock authentication layer.
 *
 * Per FRONTEND_PLAN.md Phase 3:
 *   - "Remember me" ON  → localStorage (key below)
 *   - "Remember me" OFF → sessionStorage (key below)
 *
 * Centralizing keys here keeps the contract explicit and makes it trivial
 * to grep for every read/write of the session blob.
 */
export const STORAGE_KEYS = Object.freeze({
  SESSION: 'ni-fashion.session',
});

/**
 * Storage kind — paired with the "Remember me" toggle.
 */
export const STORAGE_KIND = Object.freeze({
  LOCAL: 'local',
  SESSION: 'session',
});