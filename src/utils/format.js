/**
 * Formatting utilities — Phase 4.
 *
 * Centralised so the entire app uses the same money/date conventions.
 * The currency code and locale are defined in constants/app.js.
 */
import { CURRENCY, DATE_FORMAT } from '../constants/app.js';

function pickLocale() {
  // Some Intl builds throw on en-BD — fall back to a locale that always works.
  try {
    new Intl.NumberFormat(CURRENCY.locale, { style: 'currency', currency: CURRENCY.code });
    return CURRENCY.locale;
  } catch {
    return CURRENCY.fallbackLocale;
  }
}

const LOCALE = pickLocale();

/**
 * Format a number as currency.
 *
 * @example formatCurrency(1234.5) // "৳1,234.50"
 */
export function formatCurrency(value, { maximumFractionDigits = 2 } = {}) {
  const num = Number.isFinite(value) ? value : 0;
  try {
    return new Intl.NumberFormat(LOCALE, {
      style: 'currency',
      currency: CURRENCY.code,
      maximumFractionDigits,
      minimumFractionDigits: 0,
    }).format(num);
  } catch {
    return `${CURRENCY.symbol}${num.toFixed(maximumFractionDigits)}`;
  }
}

/**
 * Compact currency formatter — used in stat cards and sparklines.
 *
 * @example formatCompact(12345) // "৳12.3K"
 */
export function formatCompact(value) {
  const num = Number.isFinite(value) ? value : 0;
  try {
    return new Intl.NumberFormat(LOCALE, {
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(num);
  } catch {
    if (Math.abs(num) >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
    if (Math.abs(num) >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
    return String(num);
  }
}

/**
 * Format a plain integer with thousand separators. Used for stock counts.
 *
 * @example formatNumber(1234) // "1,234"
 */
export function formatNumber(value) {
  const num = Number.isFinite(value) ? value : 0;
  try {
    return new Intl.NumberFormat(LOCALE).format(num);
  } catch {
    return String(num);
  }
}

/**
 * Today as a long human-readable date, e.g. "Friday, 12 September 2025".
 *
 * Accepts: Date, ISO string ('YYYY-MM-DD' or full ISO), epoch number,
 * or null/undefined (defaults to today). Falls back to ISO date portion
 * if Intl formatting fails on the input.
 */
export function formatLongDate(input = new Date()) {
  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) return '';
  try {
    return new Intl.DateTimeFormat(DATE_FORMAT.locale, DATE_FORMAT.options).format(d);
  } catch {
    try { return d.toDateString(); } catch { return ''; }
  }
}

/**
 * Greeting based on the hour of day. 12am–4am late-night, 5am–11am morning,
 * 12pm–4pm afternoon, 5pm–8pm evening, 9pm+ night.
 */
export function greetingFor(date = new Date()) {
  const h = date.getHours();
  if (h < 5) return 'Good night';
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  if (h < 21) return 'Good evening';
  return 'Good night';
}

/**
 * Pretty-format a delta value (e.g. "+12.4%"). The sign is part of the
 * output. Caller controls whether the value is interpreted as a fraction
 * or as already-multiplied.
 *
 * @example formatDelta(0.124) // "+12.4%"
 */
export function formatDelta(fraction, { isPercent = true } = {}) {
  const num = Number.isFinite(fraction) ? fraction : 0;
  const pct = num * 100;
  const sign = pct > 0 ? '+' : pct < 0 ? '' : '';
  const value = Math.abs(pct).toFixed(1);
  return isPercent ? `${sign}${value}%` : `${sign}${pct.toFixed(2)}`;
}

/**
 * Friendly time delta ("2 min ago", "yesterday", "3 days ago").
 */
export function timeAgo(iso, now = new Date()) {
  if (!iso) return '';
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return '';
  const diffMs = now.getTime() - then.getTime();
  const diffSec = Math.round(diffMs / 1000);
  if (diffSec < 60) return 'just now';
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHour = Math.round(diffMin / 60);
  if (diffHour < 24) return `${diffHour}h ago`;
  const diffDay = Math.round(diffHour / 24);
  if (diffDay === 1) return 'yesterday';
  if (diffDay < 7) return `${diffDay}d ago`;
  return then.toLocaleDateString(DATE_FORMAT.locale, { day: 'numeric', month: 'short' });
}

/**
 * Exact, locale-agnostic date + time stamp.
 *
 * Output: "02 Sep 2026, 10:30 AM" — used in tables/lists where a
 * relative phrase ("8h ago") is too vague and a precise timestamp
 * is required for traceability.
 */
export function formatExactDateTime(input) {
  if (!input) return '—';
  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) return '—';
  try {
    const dateText = new Intl.DateTimeFormat('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(d);
    const timeText = new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(d);
    return `${dateText}, ${timeText}`;
  } catch {
    return d.toISOString();
  }
}

/**
 * Exact date only — "02 Sep 2026". Use when the time is shown in
 * a sibling column.
 */
export function formatExactDate(input) {
  if (!input) return '—';
  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) return '—';
  try {
    return new Intl.DateTimeFormat('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(d);
  } catch {
    return d.toISOString().slice(0, 10);
  }
}

/**
 * Exact time only — "10:30 AM". Use when the date is shown in a
 * sibling column.
 */
export function formatExactTime(input) {
  if (!input) return '—';
  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) return '—';
  try {
    return new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(d);
  } catch {
    return d.toISOString().slice(11, 16);
  }
}