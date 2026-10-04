import styles from './PageHeader.module.css';
import { useLocale } from '../../../contexts/LocaleContext.jsx';

/**
 * PageHeader — the title block at the top of every page.
 *
 * Visual contract:
 *   - Eyebrow: 12px uppercase tracked label (e.g. "Sales", "Customers").
 *   - Title: 30–36px bold, tight letter-spacing.
 *   - Description: 15px muted, single line on desktop, wraps on mobile.
 *   - Actions: right-aligned on desktop; full-width row below on mobile.
 *
 * Composition:
 *   <PageHeader
 *     eyebrow="Sales"
 *     title="Recent sales"
 *     description="…"
 *     actions={<Button>New sale</Button>}
 *   />
 *
 * Also exposes named slots (Title/Description/Actions) so callers
 * can pass JSX with extra structure if they need it.
 */
function PageHeader({
  eyebrow,
  title,
  description,
  subtitle,
  actions,
  className = '',
  ...rest
}) {
  const { t } = useLocale();
  const copy = (value) => typeof value === 'string' ? t(value) : value;
  const classes = [styles.root, className].filter(Boolean).join(' ');

  return (
    <header className={classes} {...rest}>
      <div className={styles.text}>
        {eyebrow ? <span className={styles.eyebrow}>{copy(eyebrow)}</span> : null}
        {title ? <h1 className={styles.title}>{copy(title)}</h1> : null}
        {description || subtitle ? (
          <p className={styles.description}>{copy(description || subtitle)}</p>
        ) : null}
      </div>
      {actions ? <div className={styles.actions}>{actions}</div> : null}
    </header>
  );
}

export default PageHeader;
