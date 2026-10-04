import styles from './Badge.module.css';
import { useLocale } from '../../../contexts/LocaleContext.jsx';

/**
 * Badge — presentation only.
 *
 * `variant` controls color tone: success | warning | danger | info | neutral
 * `children` is the displayed text. No business logic — callers pass
 * whatever human-friendly string they want.
 */
function Badge({
  variant,
  tone,
  children,
  className = '',
  size = 'md',
  ...rest
}) {
  const { t } = useLocale();
  const color = ['success', 'warning', 'danger', 'info', 'neutral'].includes(variant) ? variant : tone || 'neutral';
  const classes = [
    styles.badge,
    styles[`variant-${color}`],
    styles[`size-${size}`],
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <span className={classes} {...rest}>
      {typeof children === 'string' ? t(children) : children}
    </span>
  );
}

export default Badge;
