/**
 * CustomerDetailPage — Phase 6.
 *
 * Tabbed detail view for a single customer. Tabs are:
 *   1. Profile   — base fields + children list (each with derived class) + audit
 *   2. Sales     — completed sales linked to this customer
 *   3. Orders    — custom orders linked to this customer
 *   4. Due       — open sales + open custom orders aggregated
 *
 * Behaviour notes:
 *   - Employees see the full customer history (PROJECT_RULES.md §8).
 *     The hidden-flag hooks (cost / profit / supplier / expense) gate
 *     sub-detail UI on line items — that lives inside sale/order tabs.
 *   - Status toggle is OWNER-only; we never delete customers (per
 *     phase contract — records are preserved for history).
 *   - The bundle loader is the single source of truth for this page;
 *     if any sub-call fails we surface it in an inline warning but keep
 *     the tabs that did load. This matches the "graceful degradation"
 *     pattern Phase 4 established for the dashboard.
 */
import { useEffect, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';

import { EmptyState, Spinner } from '../../components/common/index.js';
import { CustomerIcon } from '../../components/icons/DashboardIcon.jsx';
import { useRole } from '../../hooks/useRole.js';
import { getCustomerBundle } from '../../services/customers/customerService.js';
import { formatCurrency, timeAgo } from '../../utils/format.js';
import styles from './CustomerDetailPage.module.css';

const TABS = [
  { id: 'profile', label: 'Profile' },
  { id: 'sales', label: 'Sales history' },
  { id: 'orders', label: 'Custom orders' },
  { id: 'due', label: 'Due summary' },
];

export default function CustomerDetailPage() {
  const { id } = useParams();
  const { role } = useRole();

  const [bundle, setBundle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('profile');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    setBundle(null);

    getCustomerBundle(id)
      .then((data) => {
        if (cancelled) return;
        if (!data) {
          setBundle(null);
          return;
        }
        setBundle(data);
      })
      .catch((err_) => {
        if (cancelled) return;
        setError(err_?.message || 'Could not load customer.');
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) {
    return (
      <main className={styles.page} aria-busy="true">
        <div className={styles.loading}>
          <Spinner /> <span>Loading customer…</span>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className={styles.page}>
        <p className={styles.error} role="alert">
          {error}
        </p>
        <Link to="/customers" className={styles.backLink}>
          ← Back to customers
        </Link>
      </main>
    );
  }

  if (!bundle || !bundle.customer) {
    return <Navigate to="/customers" replace />;
  }

  const { customer, children, sales, customOrders, dueSummary, errors } =
    bundle;

  return (
    <main className={styles.page}>
      <Link to="/customers" className={styles.backLink}>
        ← All customers
      </Link>

      <header className={styles.header}>
        <div className={styles.headerMain}>
          <div className={styles.avatar}>
            <CustomerIcon size={28} />
          </div>
          <div>
            <span className={styles.eyebrow}>Customer</span>
            <h1 className={styles.title}>{customer.name}</h1>
            <p className={styles.meta}>
              {customer.phone || 'No phone on file'}
              {customer.address ? ` · ${customer.address}` : ''}
            </p>
          </div>
        </div>
        <div className={styles.headerSide}>
          <span
            className={[
              styles.statusBadge,
              customer.isActive
                ? styles.statusActive
                : styles.statusInactive,
            ]
              .filter(Boolean)
              .join(' ')}
          >
            {customer.isActive ? 'Active' : 'Inactive'}
          </span>
          <span className={styles.classBadge}>
            Class {customer.currentClass || '—'}
          </span>
        </div>
      </header>

      {Object.keys(errors || {}).length > 0 ? (
        <p className={styles.partialWarn} role="status">
          Some sections could not be loaded. The rest of the page is still
          available.
        </p>
      ) : null}

      <nav className={styles.tabbar} aria-label="Customer sections">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={[
              styles.tab,
              tab === t.id ? styles.tabActive : '',
            ]
              .filter(Boolean)
              .join(' ')}
            onClick={() => setTab(t.id)}
            aria-current={tab === t.id ? 'page' : undefined}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <section className={styles.panel}>
        {tab === 'profile' ? (
          <ProfilePanel
            customer={customer}
            children_={children}
            role={role}
          />
        ) : null}

        {tab === 'sales' ? (
          <SalesPanel sales={sales} role={role} />
        ) : null}

        {tab === 'orders' ? (
          <OrdersPanel orders={customOrders} role={role} />
        ) : null}

        {tab === 'due' ? <DuePanel due={dueSummary} /> : null}
      </section>
    </main>
  );
}

/* ---------- tab panels ---------- */

function ProfilePanel({ customer, children_, role }) {
  return (
    <div className={styles.profileGrid}>
      <div className={styles.card}>
        <h2 className={styles.cardTitle}>Basics</h2>
        <dl className={styles.dl}>
          <dt>Name</dt>
          <dd>{customer.name}</dd>
          <dt>Phone</dt>
          <dd>{customer.phone || '—'}</dd>
          <dt>Address</dt>
          <dd>{customer.address || '—'}</dd>
          <dt>Initial class</dt>
          <dd>{customer.initialClass || '—'}</dd>
          <dt>Current class</dt>
          <dd>
            <strong>{customer.currentClass || '—'}</strong>
            <span className={styles.hint}>
              {' '}
              (derived from initial class + years since registration)
            </span>
          </dd>
        </dl>
      </div>

      <div className={styles.card}>
        <h2 className={styles.cardTitle}>Children</h2>
        {Array.isArray(children_) && children_.length > 0 ? (
          <ul className={styles.kidList}>
            {children_.map((k) => (
              <li key={k.id} className={styles.kidRow}>
                <div>
                  <span className={styles.kidName}>{k.name}</span>
                  <span className={styles.kidMeta}>
                    Registered {timeAgo(k.createdAt)}
                  </span>
                </div>
                <span className={styles.classBadge}>
                  Class {k.currentClass || '—'}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className={styles.muted}>No children registered yet.</p>
        )}
      </div>

      <div className={styles.card}>
        <h2 className={styles.cardTitle}>Audit</h2>
        <dl className={styles.dl}>
          <dt>Created by</dt>
          <dd>
            {customer.createdBy || 'system'}{' '}
            <span className={styles.hint}>
              ({customer.createdByRole || '—'})
            </span>
          </dd>
          <dt>Created at</dt>
          <dd>{new Date(customer.createdAt).toLocaleString()}</dd>
          <dt>Updated by</dt>
          <dd>
            {customer.updatedBy || '—'}{' '}
            <span className={styles.hint}>
              ({customer.updatedByRole || '—'})
            </span>
          </dd>
          <dt>Updated at</dt>
          <dd>{new Date(customer.updatedAt).toLocaleString()}</dd>
        </dl>
      </div>

      {role === 'OWNER' ? (
        <div className={styles.card}>
          <h2 className={styles.cardTitle}>Owner actions</h2>
          <p className={styles.muted}>
            Customers are never deleted — only marked active or inactive.
            Use the status toggle on the list page to deactivate this
            record; the full history stays visible.
          </p>
        </div>
      ) : null}
    </div>
  );
}

function SalesPanel({ sales, role }) {
  if (!Array.isArray(sales) || sales.length === 0) {
    return (
      <EmptyState
        title="No sales yet"
        description="Sales linked to this customer will appear here."
      />
    );
  }
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Code</th>
            <th>Items</th>
            <th>Total</th>
            <th>When</th>
          </tr>
        </thead>
        <tbody>
          {sales.map((s) => (
            <tr key={s.id}>
              <td className={styles.mono}>{s.salesCode}</td>
              <td>{s.itemCount ?? '—'}</td>
              <td>{formatCurrency(s.total)}</td>
              <td>{timeAgo(s.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {role === 'EMPLOYEE' ? (
        <p className={styles.muted}>
          Employees see totals without cost or profit breakdown.
        </p>
      ) : null}
    </div>
  );
}

function OrdersPanel({ orders, role }) {
  if (!Array.isArray(orders) || orders.length === 0) {
    return (
      <EmptyState
        title="No custom orders"
        description="Custom orders placed for this customer will appear here."
      />
    );
  }
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Code</th>
            <th>Title</th>
            <th>Status</th>
            <th>Total</th>
            <th>Due</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((o) => (
            <tr key={o.id}>
              <td className={styles.mono}>{o.code}</td>
              <td>{o.title}</td>
              <td>
                <span className={styles.statusPill}>{o.status}</span>
              </td>
              <td>{formatCurrency(o.total)}</td>
              <td>
                {o.due > 0 ? (
                  <span className={styles.dueAmount}>
                    {formatCurrency(o.due)}
                  </span>
                ) : (
                  <span className={styles.muted}>Settled</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {role === 'EMPLOYEE' ? (
        <p className={styles.muted}>
          Supplier and expense details for custom orders are hidden for
          employees.
        </p>
      ) : null}
    </div>
  );
}

function DuePanel({ due }) {
  if (!due) {
    return (
      <p className={styles.muted}>No outstanding dues for this customer.</p>
    );
  }
  const total = due.totalDue ?? 0;
  return (
    <div className={styles.dueGrid}>
      <div className={styles.dueCard}>
        <span className={styles.dueLabel}>Open sales</span>
        <span className={styles.dueValue}>{due.openSales ?? 0}</span>
      </div>
      <div className={styles.dueCard}>
        <span className={styles.dueLabel}>Open custom orders</span>
        <span className={styles.dueValue}>{due.openCustomOrders ?? 0}</span>
      </div>
      <div className={`${styles.dueCard} ${styles.dueCardTotal}`}>
        <span className={styles.dueLabel}>Total due</span>
        <span className={styles.dueValue}>{formatCurrency(total)}</span>
      </div>
    </div>
  );
}
