import styles from './Badge.module.css';

/**
 * Badge — presentation only.
 *
 * `variant` controls color tone: success | warning | danger | info | neutral
 * `children` is the displayed text. No business logic — callers pass
 * whatever human-friendly string they want.
 */
function Badge({
  variant = 'neutral',
  children,
  className = '',
  size = 'md',
  ...rest
}) {
  const classes = [
    styles.badge,
    styles[`variant-${variant}`],
    styles[`size-${size}`],
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <span className={classes} {...rest}>
      {children}
    </span>
  );
}

export default Badge;