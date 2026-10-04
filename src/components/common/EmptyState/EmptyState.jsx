import styles from './EmptyState.module.css';
import { useLocale } from '../../../contexts/LocaleContext.jsx';

/**
 * EmptyState — generic empty state with optional action slot.
 */
function EmptyState({
  title,
  description,
  icon = null,
  action = null,
  className = '',
  ...rest
}) {
  const { t } = useLocale();
  const classes = [styles.empty, className].filter(Boolean).join(' ');

  return (
    <div className={classes} {...rest}>
      {icon ? <div className={styles.icon}>{icon}</div> : null}
      {title ? <h3 className={styles.title}>{typeof title === 'string' ? t(title) : title}</h3> : null}
      {description ? <p className={styles.description}>{typeof description === 'string' ? t(description) : description}</p> : null}
      {action ? <div className={styles.action}>{action}</div> : null}
    </div>
  );
}

export default EmptyState;
