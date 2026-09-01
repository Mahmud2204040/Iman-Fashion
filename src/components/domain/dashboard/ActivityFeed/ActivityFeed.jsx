import { CustomOrderIcon, SaleIcon } from '../../../icons/DashboardIcon.jsx';
import {
  formatCurrency,
  formatNumber,
  timeAgo,
} from '../../../../utils/format.js';
import styles from './ActivityFeed.module.css';

/**
 * ActivityFeed — the "what just happened" strip on the dashboard.
 *
 * Each row is one event (a sale or a custom-order payment). The icon
 * distinguishes the kind; the amount uses the same colour convention as
 * the dashboard cards so the eye learns the mapping instantly.
 */
function ActivityFeed({ items = [], loading = false }) {
  const headingId = 'dashboard-activity-heading';

  return (
    <section className={styles.feed} aria-labelledby={headingId}>
      <header className={styles.header}>
        <h2 id={headingId} className={styles.title}>
          Recent activity
        </h2>
        <span className={styles.subtitle}>Last few hours</span>
      </header>

      {loading ? (
        <div className={styles.skeleton} aria-busy="true" aria-live="polite">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className={styles.skeletonRow} />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className={styles.empty}>
          <p className={styles.emptyTitle}>No activity yet today</p>
          <p className={styles.emptyBody}>
            Sales and custom orders you record will show up here in real
            time.
          </p>
        </div>
      ) : (
        <ul className={styles.list}>
          {items.map((item) => (
            <ActivityRow key={item.id} item={item} />
          ))}
        </ul>
      )}
    </section>
  );
}

function ActivityRow({ item }) {
  const isSale = item.kind === 'sale';
  const Icon = isSale ? SaleIcon : CustomOrderIcon;
  const kindLabel = isSale ? 'Sale' : 'Custom order';
  const amountClass = isSale ? styles.amountSale : styles.amountOrder;
  const amountText =
    item.kind === 'sale' || item.kind === 'custom-order-payment'
      ? formatCurrency(item.amount)
      : formatNumber(item.amount);

  return (
    <li className={styles.row}>
      <span
        className={`${styles.icon} ${
          isSale ? styles.iconSale : styles.iconOrder
        }`}
        aria-hidden="true"
      >
        <Icon size={16} strokeWidth={1.75} />
      </span>
      <div className={styles.body}>
        <div className={styles.titleRow}>
          <span className={styles.itemTitle}>{item.title}</span>
          <span className={amountClass}>{amountText}</span>
        </div>
        <div className={styles.metaRow}>
          <span className={styles.kind}>{kindLabel}</span>
          <span className={styles.dot} aria-hidden="true">
            &middot;
          </span>
          <span className={styles.detail}>{item.detail}</span>
          <span className={styles.dot} aria-hidden="true">
            &middot;
          </span>
          <span className={styles.time}>{timeAgo(item.at)}</span>
        </div>
      </div>
    </li>
  );
}

export default ActivityFeed;