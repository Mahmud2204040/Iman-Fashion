/**
 * DashboardPage — the home of the authenticated app.
 *
 * Owner dashboard with four live KPI cards. Below the cards we render a
 * recent-activity feed and a quick-actions panel.
 *
 * The header is a calm greeting + long date — short, warm, and a
 * familiar SaaS pattern. No decorative gradients: the cards below
 * already provide the visual weight.
 */
import { useEffect, useState } from 'react';

import { useAuth } from '../../hooks/useAuth.js';
import { useLocale } from '../../contexts/LocaleContext.jsx';
import { useTicker } from '../../hooks/useTicker.js';
import { ROLES } from '../../constants/roles.js';
import { formatLongDate, greetingFor } from '../../utils/format.js';

import StatCard from '../../components/domain/dashboard/StatCard/index.js';
import ActivityFeed from '../../components/domain/dashboard/ActivityFeed/index.js';
import NotesWidget from '../../components/domain/dashboard/NotesWidget/index.js';

import { getDashboardSnapshot } from '../../services/dashboard/dashboardService.js';
import styles from './DashboardPage.module.css';

export default function DashboardPage() {
  const { user, role } = useAuth();
  const { language, t } = useLocale();
  // useTicker keeps the displayed date in sync if the user keeps the
  // dashboard open across midnight.
  const now = useTicker(60_000);

  const [snapshot, setSnapshot] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');

    getDashboardSnapshot(role)
      .then((data) => {
        if (cancelled) return;
        setSnapshot(data);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err?.message || 'Could not load dashboard.');
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [role, reloadKey]);

  const displayName =
    user?.username || user?.name || (role === ROLES.OWNER ? 'Owner' : 'Friend');
  const greeting = greetingFor(now);
  const dateText = formatLongDate(now, language);

  if (loading) {
    return (
      <main className={styles.page} aria-busy="true">
        <div className={styles.loadingState}>
          <p className={styles.loadingText}>{t('Loading dashboard…')}</p>
        </div>
      </main>
    );
  }

  if (error || !snapshot) {
    return (
      <main className={styles.page}>
        <div className={styles.errorState} role="alert">
          <p className={styles.errorText}>
            {t(error || 'Dashboard unavailable.')}
          </p>
          <button type="button" onClick={() => setReloadKey((value) => value + 1)}>{t('Try again')}</button>
        </div>
      </main>
    );
  }

  const { stats, activity } = snapshot;
  const todaySales = stats.find((s) => s.id === 'today-sales');
  const todayOrders = stats.find((s) => s.id === 'today-custom-orders');
  const currentCash = stats.find((s) => s.id === 'current-cash');
  const totalStock = stats.find((s) => s.id === 'total-stock-items');

  return (
    <main className={styles.page}>
      <section className={styles.heading} aria-label="Greeting">
        <div>
          <h1 className={styles.title}>{t(greeting)}</h1>
          <p className={styles.subtitle}>{t('Welcome back,')} {displayName}</p>
        </div>
        <div className={styles.dateContext}>
          <strong>{dateText}</strong>
          <span>{t('Your shop at a glance')}</span>
        </div>
      </section>

      <section
        className={styles.statsGrid}
        aria-label="Key metrics for today"
      >
        {todaySales ? (
          <StatCard
            label="Today’s sales"
            value={todaySales.value}
            kind="currency"
            context={dateText}
            to="/sales"
          />
        ) : null}
        {todayOrders ? (
          <StatCard
            label="Today’s custom orders"
            value={todayOrders.value}
            kind="number"
            context={dateText}
            to="/custom-orders"
          />
        ) : null}
        {currentCash ? (
          <StatCard
            label="Current cash"
            value={currentCash.value}
            kind="currency"
            context="Current balance"
            to="/cash"
          />
        ) : null}
        {totalStock ? (
          <StatCard
            label="Total stock items"
            value={totalStock.value}
            kind="number"
            context="Items in stock"
            to="/products"
          />
        ) : null}
      </section>

      <section className={styles.split}>
        <div className={styles.splitMain}>
          <ActivityFeed items={activity} loading={false} />
        </div>
        <div className={styles.splitAside}>
          <NotesWidget />
        </div>
      </section>
    </main>
  );
}
