import { forwardRef, useId } from 'react';
import { useLocale } from '../../../contexts/LocaleContext.jsx';

import styles from './SearchInput.module.css';

/**
 * SearchInput — icon-prefixed input field for search bars.
 *
 * Visual contract:
 *   - 44px height (medium), 40px (sm), 48px (lg) — comfort on mobile.
 *   - Magnifier icon sits in a fixed slot on the leading edge; the input
 *     text never collides with the icon.
 *   - Clear button appears when there's a value; clears + refocuses.
 *   - Soft focus ring matches the rest of the form system.
 *
 * No external icon library — the magnifier is an inline SVG so it
 * inherits color and stays sharp at every size.
 */
function SearchIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="11" cy="11" r="7" />
      <line x1="20" y1="20" x2="16.65" y2="16.65" />
    </svg>
  );
}

function ClearIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

const SearchInput = forwardRef(function SearchInput(
  {
    value,
    onChange,
    placeholder = 'Search…',
    size = 'md',
    disabled = false,
    fullWidth = true,
    className = '',
    onClear,
    inputClassName = '',
    icon,
    showClearWhenEmpty = false,
    type = 'search',
    'aria-label': ariaLabel,
    ...rest
  },
  ref,
) {
  const { t } = useLocale();
  const id = useId();
  const hasValue = value !== undefined && value !== null && String(value).length > 0;
  const showClear = hasValue || showClearWhenEmpty;

  function handleClear() {
    if (typeof onChange === 'function') {
      // Synthesise a change event so React's controlled-input contract
      // holds. Matches what the user expects when they hit Escape.
      onChange({ target: { value: '' } });
    }
    if (typeof onClear === 'function') onClear();
  }

  const wrapClasses = [
    styles.field,
    styles[`size-${size}`],
    fullWidth ? styles.fullWidth : '',
    disabled ? styles.disabled : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const inputClasses = [styles.input, inputClassName].filter(Boolean).join(' ');

  return (
    <div className={wrapClasses}>
      <span className={styles.icon} aria-hidden="true">
        {icon || <SearchIcon />}
      </span>
      <input
        ref={ref}
        id={id}
        type={type}
        value={value}
        onChange={onChange}
        placeholder={t(placeholder)}
        aria-label={typeof ariaLabel === 'string' ? t(ariaLabel) : ariaLabel}
        disabled={disabled}
        className={inputClasses}
        autoComplete="off"
        spellCheck="false"
        {...rest}
      />
      {showClear ? (
        <button
          type="button"
          className={styles.clear}
          onClick={handleClear}
          aria-label={t('Clear search')}
          tabIndex={-1}
        >
          <ClearIcon />
        </button>
      ) : null}
    </div>
  );
});

export default SearchInput;
