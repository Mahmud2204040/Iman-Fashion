/**
 * customer.js — Phase 6 derived helpers.
 *
 * Phase 6 contract (FRONTEND_PLAN.md):
 *   "Children with derived current class from initial_class + years_since(created_at)"
 *
 * The "class" here is a school uniform concept (e.g. "Class 3" or just
 * "3") that advances by one each year since the child was added. The
 * source-of-truth is the initial_class string captured at creation;
 * the current class is computed on-the-fly so it always reflects the
 * passage of time without manual updates.
 *
 * Rules
 *   - If initialClass is missing/blank, return it as-is (caller can
 *     decide how to render the empty case).
 *   - If initialClass is numeric ("3", "Class 3", "STD-3"):
 *       - Strip non-digits.
 *       - If no digits remain, return the original.
 *       - Otherwise compute yearDelta and return "{digits}".
 *   - If initialClass is alphabetic ("A", "B", "Nursery"):
 *       - Return unchanged — letter classes don't auto-advance.
 *
 * The function is pure and side-effect free.
 */

const NUMERIC_RE = /\d+/;

/**
 * Extract the numeric prefix of a class label.
 * "Class 3"  -> 3
 * "STD-3"    -> 3
 * "3"        -> 3
 * "Nursery"  -> null
 */
function extractClassNumber(label) {
  const m = String(label || '').match(NUMERIC_RE);
  return m ? Number(m[0]) : null;
}

/**
 * Compute full years elapsed between two dates.
 * Months/days are ignored; we round DOWN so a child who joined 11 months
 * ago is still "in the same class".
 */
function yearsSince(from, now) {
  const start = new Date(from);
  const today = new Date(now);
  if (Number.isNaN(start.getTime()) || Number.isNaN(today.getTime())) {
    return 0;
  }
  let years = today.getFullYear() - start.getFullYear();
  const beforeBirthday =
    today.getMonth() < start.getMonth() ||
    (today.getMonth() === start.getMonth() && today.getDate() < start.getDate());
  if (beforeBirthday) years -= 1;
  return Math.max(0, years);
}

/**
 * Derive the "current class" from an initial_class string and the
 * date the child joined. See module docstring for the rules.
 */
export function deriveCurrentClass(initialClass, createdAt, now = new Date()) {
  const label = String(initialClass || '').trim();
  if (!label) return label;
  const n = extractClassNumber(label);
  if (n === null) return label; // alphabetic / no digits — unchanged
  const delta = yearsSince(createdAt, now);
  return String(n + delta);
}