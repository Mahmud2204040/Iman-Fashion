/**
 * PurchaseListPage — Phase 9.
 *
 * Owner-only entry to the purchase ledger.
 * Pattern: row list with code + supplier + status pill + totals + due.
 * Mirrors CustomOrderListPage layout for visual consistency.
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
import { PurchaseIcon } from '../../components/icons/DashboardIcon.jsx';
import { useAuth } from '../../hooks/useAuth.js';
import { useRole } from '../../hooks/useRole.js';
import { getPurchases } from '../../services/purchases/purchaseService.js';
import { formatCurrency, timeAgo } from '../../utils/format.js';
import styles from './PurchaseListPage.module.css';

const STATUS_FILTERS = [
  { id: 'ALL', label: 'All' },
  { id: 'DRAFT', label: 'Draft' },
  { id: 'ORDERED', label: 'Ordered' },
  { id: 'RECEIVED', label: 'Received' },
  { id: 'CANCELLED', label: 'Cancelled' },
];

function statusTone(status) {
  switch (status) {
    case 'DRAFT':
      return styles.toneNeutral;
    case 'ORDERED':
      return styles.toneInfo;
    case 'RECEIVED':
      return styles.toneSuccess;
    case 'CANCELLED':
      return styles.toneDanger;
    default:
      return styles.toneNeutral;
  }
}

export default function PurchaseListPage() {
  const { user } = useAuth();
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
    getPurchases()
      .then((data) => {
        if (cancelled) return;
        if (!Array.isArray(data)) {
          throw new Error(
            'Purchase service did not return an array. Got ' + typeof data,
          );
        }
        setRows(data);
      })
      .catch((err_) => {
        if (cancelled) return;
        setError(err_?.message || 'Could not load purchases.');
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
          (o.supplierName || '').toLowerCase().includes(q) ||
          (o.notes || '').toLowerCase().includes(q),
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

  const totals = useMemo(() => {
    let total = 0;
    let paid = 0;
    let due = 0;
    for (const o of rows) {
      total += Number(o.total || 0);
      paid += Number(o.paidTotal || 0);
      due += Math.max(Number(o.total || 0) - Number(o.paidTotal || 0), 0);
    }
    return { total, paid, due };
  }, [rows]);

  return (
    <main className={styles.page}>
      <PageHeader
        eyebrow="Procurement"
        title="Purchases"
        description="Orders placed with suppliers, payments recorded against them, and receipt attachments."
        actions={
          isOwner ? (
            <span className={styles.ownerHint} aria-hidden="true">
              <span className={styles.ownerDot} />
              <span>Owner view</span>
            </span>
          ) : null
        }
      />

      <Card className={styles.totalsCard}>
        <div className={styles.totalBlock}>
          <span className={styles.totalLabel}>Total purchases</span>
          <span className={styles.totalValue}>
            {formatCurrency(totals.total)}
          </span>
          <span className={styles.totalSub}>{rows.length} order{rows.length === 1 ? '' : 's'}</span>
        </div>
        <span className={styles.totalDivider} aria-hidden="true" />
        <div className={styles.totalBlock}>
          <span className={styles.totalLabel}>Paid</span>
          <span className={`${styles.totalValue} ${styles.totalPaid}`}>
            {formatCurrency(totals.paid)}
          </span>
        </div>
        <span className={styles.totalDivider} aria-hidden="true" />
        <div
          className={
            totals.due > 0
              ? `${styles.totalBlock} ${styles.totalBlockDue}`
              : styles.totalBlock
          }
        >
          <span className={styles.totalLabel}>Outstanding</span>
          <span
            className={
              totals.due > 0
                ? `${styles.totalValue} ${styles.totalDue}`
                : styles.totalValue
            }
          >
            {formatCurrency(totals.due)}
          </span>
          {totals.due > 0 ? (
            <span className={styles.dueChip}>Action needed</span>
          ) : null}
        </div>
      </Card>

      <Card className={styles.controlsCard}>
        <div className={styles.controls}>
          <SearchInput
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by code, supplier, or notes"
            aria-label="Search purchases"
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
          <Spinner /> <span>Loading purchases…</span>
        </Card>
      ) : error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<PurchaseIcon size={28} />}
          title="No purchases match"
          description={
            query.trim() || statusFilter !== 'ALL'
              ? 'Try clearing the filters or use a different search term.'
              : 'Purchases will appear here once created.'
          }
        />
      ) : (
        <ul className={styles.list} aria-label="Purchases">
          {filtered.map((o) => {
            const paid = Number(o.paidTotal || 0);
            const balance = Math.max(Number(o.total || 0) - paid, 0);
            const itemsCount = (o.items || []).length;
            return (
              <li key={o.id}>
                <Link to={`/purchases/${o.id}`} className={styles.row}>
                  <div className={styles.rowMain}>
                    <span className={styles.code}>{o.code}</span>
                    <span className={styles.supplier}>{o.supplierName}</span>
                    <span className={styles.meta}>
                      <span>
                        {itemsCount} item{itemsCount === 1 ? '' : 's'}
                      </span>
                      <span className={styles.dot} aria-hidden="true">·</span>
                      <span>ordered {timeAgo(o.orderedAt)}</span>
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
                      {o.status.toLowerCase()}
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
