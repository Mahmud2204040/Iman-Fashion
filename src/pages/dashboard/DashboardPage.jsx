/**
 * DashboardPage — the home of the authenticated app.
 *
 * Per FRONTEND_PLAN.md sec4, Phase 4 ships exactly four cards and they
 * are identical for OWNER and EMPLOYEE. Below the cards we render a
 * recent-activity feed and a quick-actions panel.
 *
 * The header is a calm greeting + long date — short, warm, and a
 * familiar SaaS pattern. No decorative gradients: the cards below
 * already provide the visual weight.
 */
import { useEffect, useState } from 'react';

import { useAuth } from '../../hooks/useAuth.js';
import { useTicker } from '../../hooks/useTicker.js';
import { ROLES } from '../../constants/roles.js';
import { formatLongDate, greetingFor } from '../../utils/format.js';
import { PageHeader } from '../../components/common/index.js';

import StatCard from '../../components/domain/dashboard/StatCard/index.js';
import ActivityFeed from '../../components/domain/dashboard/ActivityFeed/index.js';
import QuickActions from '../../components/domain/dashboard/QuickActions/index.js';
import {
  CashHandIcon,
  CustomOrderIcon,
  ProductIcon,
  SaleIcon,
} from '../../components/icons/DashboardIcon.jsx';

import { getDashboardSnapshot } from '../../services/dashboard/dashboardService.js';
import styles from './DashboardPage.module.css';

export default function DashboardPage() {
  const { user, role } = useAuth();
  // useTicker keeps the displayed date in sync if the user keeps the
  // dashboard open across midnight.
  const now = useTicker(60_000);

  const [snapshot, setSnapshot] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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
  }, [role]);

  const displayName =
    user?.username || user?.name || (role === ROLES.OWNER ? 'Owner' : 'Friend');
  const greeting = greetingFor(now);
  const dateText = formatLongDate(now);

  if (loading) {
    return (
      <main className={styles.page} aria-busy="true">
        <div className={styles.loadingState}>
          <p className={styles.loadingText}>Loading dashboard…</p>
        </div>
      </main>
    );
  }

  if (error || !snapshot) {
    return (
      <main className={styles.page}>
        <div className={styles.errorState} role="alert">
          <p className={styles.errorText}>
            {error || 'Dashboard unavailable.'}
          </p>
        </div>
      </main>
    );
  }

  const { stats, activity, quickActions } = snapshot;
  const todaySales = stats.find((s) => s.id === 'today-sales');
  const todayOrders = stats.find((s) => s.id === 'today-custom-orders');
  const currentCash = stats.find((s) => s.id === 'current-cash');
  const totalStock = stats.find((s) => s.id === 'total-stock-items');

  return (
    <main className={styles.page}>
      <PageHeader
        eyebrow={greeting}
        title={
          <>
            Welcome back,{' '}
            <span className={styles.heroHighlight}>{displayName}</span>
          </>
        }
        description={dateText}
      />

      <section
        className={styles.statsGrid}
        aria-label="Key metrics for today"
      >
        {todaySales ? (
          <StatCard
            icon={SaleIcon}
            label="Today\u2019s sales"
            value={todaySales.value}
            kind="currency"
            delta={todaySales.delta}
            trend={todaySales.trend}
            accent="info"
          />
        ) : null}
        {todayOrders ? (
          <StatCard
            icon={CustomOrderIcon}
            label="Today\u2019s custom orders"
            value={todayOrders.value}
            kind="number"
            delta={todayOrders.delta}
            trend={todayOrders.trend}
            accent="warning"
          />
        ) : null}
        {currentCash ? (
          <StatCard
            icon={CashHandIcon}
            label="Current cash"
            value={currentCash.value}
            kind="currency"
            delta={currentCash.delta}
            trend={currentCash.trend}
            accent="success"
            emphasis="highlight"
          />
        ) : null}
        {totalStock ? (
          <StatCard
            icon={ProductIcon}
            label="Total stock items"
            value={totalStock.value}
            kind="number"
            delta={totalStock.delta}
            trend={totalStock.trend}
            accent="brand"
          />
        ) : null}
      </section>

      <section className={styles.split}>
        <div className={styles.splitMain}>
          <ActivityFeed items={activity} loading={false} />
        </div>
        <div className={styles.splitAside}>
          <QuickActions items={quickActions} />
        </div>
      </section>
    </main>
  );
}