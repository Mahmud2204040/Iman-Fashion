/**
 * customer.js — Phase 6 derived helpers.
 *
 * Phase 6 contract (FRONTEND_PLAN.md):
 *   "Children with derived current class from initial_class + years_since(registered_date)"
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

/** Current calendar date in the shop's Asia/Dhaka timezone. */
export function shopDate(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Dhaka', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(now);
}

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
  const date = String(from || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return 0;
  const [year, month, day] = date.split('-').map(Number);
  const [todayYear, todayMonth, todayDay] = shopDate(now).split('-').map(Number);
  let years = todayYear - year;
  const beforeBirthday =
    todayMonth < month ||
    (todayMonth === month && todayDay < day);
  if (beforeBirthday) years -= 1;
  return Math.max(0, years);
}

/**
 * Derive the "current class" from an initial_class string and the
 * date the child joined. See module docstring for the rules.
 */
export function deriveCurrentClass(initialClass, registeredDate, now = new Date()) {
  const label = String(initialClass || '').trim();
  if (!label) return label;
  const n = extractClassNumber(label);
  if (n === null) return label; // alphabetic / no digits — unchanged
  const delta = yearsSince(registeredDate, now);
  return String(n + delta);
}
