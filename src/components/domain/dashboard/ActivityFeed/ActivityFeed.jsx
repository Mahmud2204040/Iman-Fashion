import T from '../../../common/LocalizedText.jsx';
import { useLocale } from '../../../../contexts/LocaleContext.jsx';
import { CustomOrderIcon, SaleIcon } from '../../../icons/DashboardIcon.jsx';
import {
  formatCurrency,
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
        <h2 id={headingId} className={styles.title}><T>
          Recent activity
        </T></h2>
        <span className={styles.subtitle}><T>Sales & custom orders</T></span>
      </header>

      {loading ? (
        <div className={styles.skeleton} aria-busy="true" aria-live="polite">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className={styles.skeletonRow} />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className={styles.empty}>
          <p className={styles.emptyTitle}><T>No activity yet today</T></p>
          <p className={styles.emptyBody}><T>
            Sales and custom orders you record will show up here in real
            time.
          </T></p>
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
  const { t } = useLocale();
  const isSale = item.kind === 'sale';
  const Icon = isSale ? SaleIcon : CustomOrderIcon;
  const kindLabel = isSale ? 'Sale' : 'Custom order';
  const amountClass = isSale ? styles.amountSale : styles.amountOrder;
  const amountText = formatCurrency(item.amount);
  const title = isSale
    ? item.title.replace(/^Sale /, `${t('Sale')} `)
    : item.title.replace(/^Custom order /, `${t('Custom order')} `);
  const detail = item.detail.replace(/(\d+) items$/, (_, count) => `${count} ${t('items')}`);

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
          <span className={styles.itemTitle}>{title}</span>
          <span className={amountClass}>{amountText}</span>
        </div>
        <div className={styles.metaRow}>
          <span className={styles.kind}>{t(kindLabel)}</span>
          <span className={styles.dot} aria-hidden="true"><T>
            &middot;
          </T></span>
          <span className={styles.detail}>{detail}</span>
          <span className={styles.dot} aria-hidden="true"><T>
            &middot;
          </T></span>
          <span className={styles.time}>{timeAgo(item.at)}</span>
        </div>
      </div>
    </li>
  );
}

export default ActivityFeed;
