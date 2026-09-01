/**
 * CustomOrderListPage — Phase 7.
 *
 * Owner + employee can browse custom orders. Employees see a read-only
 * view (no create CTA, no status-edit affordances).
 *
 * Filtering:
 *   - text query against code, customer, or product name
 *   - status filter pill row (All / Pending / In Progress / Ready / Delivered / Cancelled)
 *
 * Premium feel:
 *   - PageHeader + SearchInput primitives
 *   - Status badges tinted by status family (warning / info / success / neutral / danger)
 *   - Hover lifts each row with a brand-tinted border
 */
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import {
  Card,
  EmptyState,
  PageHeader,
  SearchInput,
  Spinner,
} from '../../components/common/index.js';
import { CustomOrderIcon } from '../../components/icons/DashboardIcon.jsx';
import { useAuth } from '../../hooks/useAuth.js';
import { useRole } from '../../hooks/useRole.js';
import { getCustomOrders } from '../../services/customOrders/customOrderService.js';
import { formatCurrency, timeAgo } from '../../utils/format.js';
import { ROLES } from '../../constants/roles.js';
import styles from './CustomOrderListPage.module.css';

const STATUS_FILTERS = [
  { id: 'ALL', label: 'All' },
  { id: 'PENDING', label: 'Pending' },
  { id: 'IN_PROGRESS', label: 'In progress' },
  { id: 'READY', label: 'Ready' },
  { id: 'DELIVERED', label: 'Delivered' },
  { id: 'CANCELLED', label: 'Cancelled' },
];

function statusTone(status) {
  switch (status) {
    case 'PENDING':
      return styles.toneWarning;
    case 'IN_PROGRESS':
      return styles.toneInfo;
    case 'READY':
      return styles.toneSuccess;
    case 'DELIVERED':
      return styles.toneNeutral;
    case 'CANCELLED':
      return styles.toneDanger;
    default:
      return styles.toneNeutral;
  }
}

export default function CustomOrderListPage() {
  const { user } = useAuth();
  const { role } = useAuth();
  const { isOwner } = useRole();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    getCustomOrders()
      .then((data) => {
        if (cancelled) return;
        if (!Array.isArray(data)) {
          throw new Error(
            'Custom-order service did not return an array. Got ' + typeof data,
          );
        }
        setRows(data);
      })
      .catch((err_) => {
        if (cancelled) return;
        setError(err_?.message || 'Could not load custom orders.');
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    let next = rows;
    if (statusFilter !== 'ALL') {
      next = next.filter((o) => o.status === statusFilter);
    }
    const q = query.trim().toLowerCase();
    if (q) {
      next = next.filter(
        (o) =>
          (o.code || '').toLowerCase().includes(q) ||
          (o.customerName || '').toLowerCase().includes(q) ||
          (o.productName || '').toLowerCase().includes(q),
      );
    }
    return next;
  }, [rows, query, statusFilter]);

  const counts = useMemo(() => {
    const out = { ALL: rows.length };
    for (const f of STATUS_FILTERS) {
      if (f.id === 'ALL') continue;
      out[f.id] = rows.filter((o) => o.status === f.id).length;
    }
    return out;
  }, [rows]);

  const canCreate = isOwner;

  return (
    <main className={styles.page}>
      <PageHeader
        eyebrow="Custom orders"
        title="Custom order tracker"
        description={
          role === ROLES.OWNER
            ? 'Tailored orders, payments, and progress. Create and advance any order from here.'
            : 'Tailored orders in progress. You can browse but not create or change status.'
        }
        actions={
          canCreate ? (
            <Link to="/custom-orders/new" className={styles.newCta}>
              <CustomOrderIcon size={16} strokeWidth={1.75} />
              <span>New custom order</span>
            </Link>
          ) : null
        }
      />

      <Card className={styles.controlsCard}>
        <div className={styles.controls}>
          <SearchInput
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by code, customer, or product"
            aria-label="Search custom orders"
          />
        </div>

        <div className={styles.filterRow} role="tablist" aria-label="Filter by status">
          {STATUS_FILTERS.map((f) => {
            const active = statusFilter === f.id;
            return (
              <button
                key={f.id}
                type="button"
                role="tab"
                aria-selected={active}
                className={[styles.filterPill, active ? styles.filterPillActive : '']
                  .filter(Boolean)
                  .join(' ')}
                onClick={() => setStatusFilter(f.id)}
              >
                <span>{f.label}</span>
                <span className={styles.filterCount}>{counts[f.id] || 0}</span>
              </button>
            );
          })}
        </div>
      </Card>

      {loading ? (
        <Card className={styles.statusCard}>
          <Spinner /> <span>Loading custom orders…</span>
        </Card>
      ) : error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<CustomOrderIcon size={28} />}
          title="No custom orders match"
          description={
            query.trim() || statusFilter !== 'ALL'
              ? 'Try clearing the filters or use a different search term.'
              : isOwner
                ? 'Create your first custom order to start tracking it here.'
                : 'Custom orders will appear here once the owner creates one.'
          }
        />
      ) : (
        <ul className={styles.list} aria-label="Custom orders">
          {filtered.map((o) => {
            const paid = (o.payments || []).reduce(
              (s, p) => s + Number(p.amount || 0),
              0,
            );
            const balance = Math.max(o.total - paid, 0);
            return (
              <li key={o.id}>
                <Link to={`/custom-orders/${o.id}`} className={styles.row}>
                  <div className={styles.rowMain}>
                    <span className={styles.code}>{o.code}</span>
                    <span className={styles.product}>{o.productName}</span>
                    <span className={styles.customer}>
                      {o.customerName}
                      <span className={styles.dot} aria-hidden="true">·</span>
                      <span>{timeAgo(o.createdAt)}</span>
                      {user && o.createdBy ? (
                        <>
                          <span className={styles.dot} aria-hidden="true">·</span>
                          <span>by {o.createdBy}</span>
                        </>
                      ) : null}
                    </span>
                  </div>
                  <div className={styles.rowSide}>
                    <span className={[styles.statusPill, statusTone(o.status)].join(' ')}>
                      {o.status.replace('_', ' ').toLowerCase()}
                    </span>
                    <div className={styles.amounts}>
                      <span className={styles.total}>{formatCurrency(o.total)}</span>
                      {balance > 0 ? (
                        <span className={styles.balance}>
                          Due {formatCurrency(balance)}
                        </span>
                      ) : (
                        <span className={styles.paid}>Fully paid</span>
                      )}
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
