import { NavLink } from 'react-router-dom';
import {
  BoxIcon,
  CustomerIcon,
  CustomOrderIcon,
  SaleIcon,
} from '../../../icons/DashboardIcon.jsx';
import styles from './QuickActions.module.css';

/**
 * QuickActions — the "what to do next" panel on the dashboard.
 *
 * Designed as a 1xN stack on mobile, 1xN stack on tablet, 2x2 grid on
 * desktop. Each action is a single-tap target with a coloured icon
 * badge so the user can find the common operation by colour, not by
 * reading the label.
 *
 * Visual design: subtle tinted backgrounds (no heavy borders) so the
 * actions feel like "chips" rather than buttons.
 */
function QuickActions({ items = [] }) {
  const headingId = 'dashboard-quick-actions-heading';

  if (items.length === 0) {
    return null;
  }

  return (
    <section className={styles.actions} aria-labelledby={headingId}>
      <header className={styles.header}>
        <h2 id={headingId} className={styles.title}>
          Quick actions
        </h2>
        <span className={styles.subtitle}>Common tasks</span>
      </header>

      <div className={styles.grid}>
        {items.map((item) => (
          <ActionTile key={item.id} item={item} />
        ))}
      </div>
    </section>
  );
}

const ICONS = {
  sale: SaleIcon,
  customer: CustomerIcon,
  'custom-order': CustomOrderIcon,
  'add-stock': BoxIcon,
};

function ActionTile({ item }) {
  const Icon = ICONS[item.iconKey] || SaleIcon;

  const cardClassName = [
    styles.tile,
    item.tone ? styles[`tone-${item.tone}`] : styles.toneBrand,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <NavLink
      to={item.path || '#'}
      className={cardClassName}
      aria-label={item.label}
    >
      <span className={styles.icon} aria-hidden="true">
        <Icon size={18} strokeWidth={1.75} />
      </span>
      <span className={styles.label}>{item.label}</span>
      {item.hint ? (
        <span className={styles.hint}>{item.hint}</span>
      ) : null}
    </NavLink>
  );
}

export default QuickActions;