/**
 * Role constants for Iman Fashion.
 *
 * Per PROJECT_RULES.md §6 and REQUIREMENTS.md §4, the only roles in this
 * application are OWNER and EMPLOYEE. Do NOT introduce an ADMIN role.
 *
 * These are the string values that travel through the auth/service layer
 * and the same strings that the database will store in the `role` column
 * of the users table (see DATABASE_PLAN.md).
 */
export const ROLES = Object.freeze({
  OWNER: 'OWNER',
  EMPLOYEE: 'EMPLOYEE',
});

/**
 * Ordered list — useful for iteration (e.g. selects, dropdowns).
 * Keep this list frozen and small. Only the two documented roles.
 */
export const ROLE_VALUES = Object.freeze([ROLES.OWNER, ROLES.EMPLOYEE]);
