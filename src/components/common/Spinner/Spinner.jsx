import styles from './Spinner.module.css';

/**
 * Spinner — accessible loading indicator. Uses CSS animation, no library.
 *
 * size: 'sm' | 'md' | 'lg'   — also accepts a number for an exact pixel size
 * label: accessible label announced by screen readers.
 */
function Spinner({ size = 'md', label = 'Loading', className = '', ...rest }) {
  const numericSize = typeof size === 'number' ? `${size}px` : undefined;
  const tokenKey = typeof size === 'string' ? `size-${size}` : undefined;

  const classes = [
    styles.spinner,
    tokenKey ? styles[tokenKey] : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const style = numericSize ? { width: numericSize, height: numericSize } : undefined;

  return (
    <span
      role="status"
      aria-live="polite"
      aria-label={label}
      className={classes}
      style={style}
      {...rest}
    >
      <span className={styles.srOnly}>{label}</span>
    </span>
  );
}

export default Spinner;