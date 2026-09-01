/**
 * App-wide constants — Phase 4.
 *
 * Anything that is referenced from more than one place and never changes
 * at runtime lives here. Tokens are in CSS; this is for JS values.
 */

/**
 * Currency code. NI Fashion is a Bangladesh shop; the local currency is
 * BDT (৳). Locale is en-BD so formatting matches local conventions.
 */
export const CURRENCY = {
  code: 'BDT',
  symbol: '\u09F3', // ৳
  locale: 'en-BD',
  // en-BD / BDT is not natively supported by all Intl builds — fall back
  // to a locale that always renders consistently.
  fallbackLocale: 'en-IN',
};

/**
 * Date formatting. Single source for the locale used in the UI. The
 * Topbar uses this directly; the time formatter is defined inline at the
 * call site because it is the only consumer.
 */
export const DATE_FORMAT = {
  locale: 'en-GB',
  options: {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  },
};