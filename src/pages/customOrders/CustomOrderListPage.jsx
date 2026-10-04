import { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';

import T from '../../components/common/LocalizedText.jsx';
import { SearchInput, Spinner } from '../../components/common/index.js';
import { useAuth } from '../../hooks/useAuth.js';
import { useLocale } from '../../contexts/LocaleContext.jsx';
import { ROLES } from '../../constants/roles.js';
import { getCustomOrders } from '../../services/customOrders/customOrderService.js';
import { formatCurrency, formatExactDate } from '../../utils/format.js';
import CustomOrderWorkbenchDetail from './CustomOrderWorkbenchDetail.jsx';
import plusIcon from '../../assets/figma/new-custom-order/plus-create.svg';
import styles from './CustomOrderListPage.module.css';

const FILTERS = [
  { id: 'ALL', label: 'All' },
  { id: 'PENDING', label: 'Pending' },
  { id: 'READY', label: 'Ready' },
  { id: 'DELIVERED', label: 'Delivered' },
  { id: 'CANCELLED', label: 'Cancelled' },
];

function statusLabel(status) {
  return FILTERS.find((item) => item.id === status)?.label || status;
}

export default function CustomOrderListPage() {
  const { id: routeOrderId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { role } = useAuth();
  const { t } = useLocale();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const query = searchParams.get('q') || '';
  const rawStatus = searchParams.get('status') || 'ALL';
  const statusFilter = FILTERS.some((item) => item.id === rawStatus) ? rawStatus : 'ALL';

  function updateView(patch) {
    const next = new URLSearchParams(searchParams);
    Object.entries(patch).forEach(([key, value]) => {
      if (!value || value === 'ALL') next.delete(key);
      else next.set(key, value);
    });
    setSearchParams(next, { replace: true });
  }

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    getCustomOrders()
      .then((data) => {
        if (cancelled) return;
        if (!Array.isArray(data)) throw new Error('Custom-order service did not return an array. Got ' + typeof data);
        setRows(data);
      })
      .catch((caught) => { if (!cancelled) setError(caught?.message || 'Could not load custom orders.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [reloadKey]);

  const counts = useMemo(() => {
    const next = { ALL: rows.length, PENDING: 0, READY: 0, DELIVERED: 0, CANCELLED: 0 };
    rows.forEach((order) => { if (next[order.status] !== undefined) next[order.status] += 1; });
    return next;
  }, [rows]);
  const outstanding = useMemo(() => rows.reduce((sum, order) => {
    if (order.status === 'CANCELLED') return sum;
    const paid = (order.payments || []).reduce((paidTotal, payment) => paidTotal + Number(payment.amount || 0), 0);
    return sum + Math.max(Number(order.total || 0) - paid, 0);
  }, 0), [rows]);
  const filtered = useMemo(() => {
    const value = query.trim().toLowerCase();
    return rows.filter((order) => (statusFilter === 'ALL' || order.status === statusFilter) &&
      (!value || (order.code || '').toLowerCase().includes(value) ||
        (order.customerName || '').toLowerCase().includes(value) ||
        (order.productName || '').toLowerCase().includes(value)));
  }, [rows, query, statusFilter]);
  const selectedId = routeOrderId || filtered[0]?.id || null;
  const selectedOrder = rows.find((order) => order.id === selectedId);
  const previousOrders = selectedOrder ? Math.max(rows.filter((order) => order.customerId === selectedOrder.customerId).length - 1, 0) : 0;
  const search = searchParams.toString();
  const canCreate = role === ROLES.OWNER || role === ROLES.EMPLOYEE;

  return <main className={`${styles.page} ${routeOrderId ? styles.detailActive : ''}`}>
    <header className={styles.pageHeading}>
      <div><h1><T>Order workbench</T></h1><p><T>Track every custom order from intake to pickup, without losing payment context.</T></p></div>
      {canCreate ? <Link to="/custom-orders/new" className={styles.newCta}><img src={plusIcon} alt="" width="16" height="16" /><T>New custom order</T></Link> : null}
    </header>

    <div className={styles.metrics} aria-label={t('Custom order summary')}>
      <div className={styles.metric}><strong>{counts.PENDING + counts.READY}</strong><span><T>Open orders</T></span></div>
      <div className={styles.metric}><strong>{counts.PENDING}</strong><span><T>Pending</T></span></div>
      <div className={styles.metric}><strong>{counts.READY}</strong><span><T>Ready</T></span></div>
      <div className={styles.metric}><strong>{formatCurrency(outstanding)}</strong><span><T>Outstanding</T></span></div>
    </div>

    <div className={styles.workbench}>
      <section className={styles.inbox} aria-label={t('Orders')}>
        <h2><T>Orders</T></h2>
        <SearchInput className={styles.search} value={query} onChange={(event) => updateView({ q: event.target.value })}
          placeholder="Search name or order code" aria-label="Search custom orders" />
        <div className={styles.filters} aria-label={t('Filter by status')}>
          {FILTERS.map((filter) => <button key={filter.id} type="button"
            className={`${styles.filter} ${statusFilter === filter.id ? styles.filterActive : ''}`}
            aria-pressed={statusFilter === filter.id} onClick={() => updateView({ status: filter.id })}>{t(filter.label)}</button>)}
        </div>
        {loading ? <div className={styles.state} aria-busy="true"><Spinner size="sm" /><T>Loading custom orders…</T></div>
          : error ? <div className={styles.error} role="alert"><T>{error}</T><button type="button" onClick={() => setReloadKey((key) => key + 1)}><T>Retry</T></button></div>
            : filtered.length === 0 ? <div className={styles.state}><strong><T>No custom orders match</T></strong><p><T>{rows.length ? 'Try clearing the filters or use a different search term.' : 'Create your first custom order to start tracking it here.'}</T></p></div>
              : <ul className={styles.orderList}>{filtered.map((order) => {
                const paid = (order.payments || []).reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
                const due = Math.max(Number(order.total || 0) - paid, 0);
                return <li key={order.id}><Link to={`/custom-orders/${order.id}${search ? `?${search}` : ''}`}
                  className={`${styles.orderRow} ${order.id === selectedId ? styles.selectedRow : ''}`}>
                  <span className={styles.rowTop}><strong>{order.customerName}</strong><span className={`${styles.rowStatus} ${styles[`status${order.status}`]}`}>{t(statusLabel(order.status))}</span></span>
                  <span className={styles.rowCode}>{order.code}</span>
                  <span className={styles.rowProduct}>{order.productName}</span>
                  <span className={styles.rowBottom}><span>{order.status === 'READY' ? t('Ready for pickup') : `${t('Due on')} ${formatExactDate(order.dueDate)}`}</span><strong>{order.status === 'CANCELLED' ? t('No active due') : due > 0 ? `${formatCurrency(due)} ${t('due')}` : t('Fully paid')}</strong></span>
                </Link></li>;
              })}</ul>}
      </section>

      <section className={styles.detailPane} aria-label={t('Order details')}>
        {selectedId ? <CustomOrderWorkbenchDetail orderId={selectedId} customerOrderCount={previousOrders}
          onUpdated={(updated) => setRows((current) => current.map((item) => item.id === updated.id ? updated : item))} />
          : <div className={styles.emptyDetail}><T>Select a custom order to see its details.</T></div>}
      </section>
    </div>
  </main>;
}
