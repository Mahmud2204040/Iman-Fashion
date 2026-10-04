import styles from './Button.module.css';
import { useLocale } from '../../../contexts/LocaleContext.jsx';

/**
 * Reusable button.
 *
 * Variants: primary | secondary | danger | ghost
 *
 * The loading state is rendered with an inline Spinner-style indicator and
 * a reserved-width content area so the button does not jump in width.
 */
function SpinnerMark({ size = 16 }) {
  return (
    <span
      className={styles.spinner}
      style={{ width: size, height: size }}
      aria-hidden="true"
    />
  );
}

function Button({
  variant = 'primary',
  size = 'md',
  type = 'button',
  disabled = false,
  loading = false,
  loadingText,
  fullWidth = false,
  leftIcon = null,
  rightIcon = null,
  children,
  className = '',
  onClick,
  'aria-label': ariaLabel,
  ...rest
}) {
  const { t } = useLocale();
  const isDisabled = disabled || loading;

  const classes = [
    styles.button,
    styles[`variant-${variant}`],
    styles[`size-${size}`],
    fullWidth ? styles.fullWidth : '',
    loading ? styles.loading : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const handleClick = (event) => {
    if (isDisabled) {
      event.preventDefault();
      return;
    }
    if (typeof onClick === 'function') onClick(event);
  };

  return (
    <button
      type={type}
      className={classes}
      disabled={disabled}
      aria-busy={loading || undefined}
      aria-label={typeof ariaLabel === 'string' ? t(ariaLabel) : ariaLabel}
      onClick={handleClick}
      {...rest}
    >
      {loading ? <SpinnerMark /> : leftIcon ? <span className={styles.icon}>{leftIcon}</span> : null}
      <span className={styles.label}>
        {loading && loadingText ? (typeof loadingText === 'string' ? t(loadingText) : loadingText) : (typeof children === 'string' ? t(children) : children)}
      </span>
      {!loading && rightIcon ? <span className={styles.icon}>{rightIcon}</span> : null}
    </button>
  );
}

export default Button;
