import styles from './EmptyState.module.css';

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
  const classes = [styles.empty, className].filter(Boolean).join(' ');

  return (
    <div className={classes} {...rest}>
      {icon ? <div className={styles.icon}>{icon}</div> : null}
      {title ? <h3 className={styles.title}>{title}</h3> : null}
      {description ? <p className={styles.description}>{description}</p> : null}
      {action ? <div className={styles.action}>{action}</div> : null}
    </div>
  );
}

export default EmptyState;