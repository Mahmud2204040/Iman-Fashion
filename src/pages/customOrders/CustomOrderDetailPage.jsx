/**
 * CustomOrderDetailPage — Phase 7.
 *
 * Single-order view: header, summary card with payment progress, payment list,
 * record-payment form (owner only), notes editor (owner only), and status
 * controls (owner only). Employees see read-only.
 */
import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';

import {
  Badge,
  Button,
  ConfirmDialog,
  Input,
  PageHeader,
  Select,
  Spinner,
  Textarea,
} from '../../components/common/index.js';
import { CustomOrderIcon } from '../../components/icons/DashboardIcon.jsx';
import { useAuth } from '../../hooks/useAuth.js';
import {
  getCustomOrderById,
  recordCustomOrderPayment,
  setCustomOrderStatus,
  updateCustomOrder,
} from '../../services/customOrders/customOrderService.js';
import { formatCurrency, timeAgo } from '../../utils/format.js';
import styles from './CustomOrderDetailPage.module.css';

const STATUSES_NEXT = {
  PENDING: ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['READY', 'CANCELLED'],
  READY: ['DELIVERED'],
  DELIVERED: [],
  CANCELLED: [],
};

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

export default function CustomOrderDetailPage() {
  const { id } = useParams();
  const { user, role } = useAuth();
  const isOwner = role === 'OWNER';
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('CASH');
  const [payNote, setPayNote] = useState('');
  const [payBusy, setPayBusy] = useState(false);
  const [payError, setPayError] = useState('');
  const [pendingStatus, setPendingStatus] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    getCustomOrderById(id)
      .then((data) => {
        if (cancelled) return;
        setOrder(data);
      })
      .catch((err_) => {
        if (cancelled) return;
        setError(err_?.message || 'Could not load order.');
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const paid = useMemo(
    () => (order?.payments || []).reduce((s, p) => s + Number(p.amount || 0), 0),
    [order],
  );
  const balance = order ? Math.max(order.total - paid, 0) : 0;
  const paidPct = order && order.total > 0 ? Math.min(100, Math.round((paid / order.total) * 100)) : 0;

  async function handleRecordPayment(e) {
    e.preventDefault();
    if (!order) return;
    setPayError('');
    setPayBusy(true);
    try {
      const result = await recordCustomOrderPayment(
        order.id,
        { amount: payAmount, method: payMethod, note: payNote },
        { actor: { username: user?.username || 'unknown', role } },
      );
      setOrder(result.order);
      setPayAmount('');
      setPayNote('');
    } catch (err_) {
      setPayError(err_?.message || 'Could not record payment.');
    } finally {
      setPayBusy(false);
    }
  }

  async function performStatusChange(target) {
    try {
      const updated = await setCustomOrderStatus(id, target);
      if (updated) setOrder(updated);
    } catch (err_) {
      setError(err_?.message || 'Could not update status.');
    } finally {
      setPendingStatus(null);
    }
  }

  async function handleSaveNotes() {
    if (!order) return;
    try {
      const updated = await updateCustomOrder(id, { notes: order.notes });
      if (updated) setOrder(updated);
    } catch (err_) {
      setError(err_?.message || 'Could not save notes.');
    }
  }

  if (loading) {
    return (
      <main className={styles.page} aria-busy="true">
        <div className={styles.loading}>
          <Spinner /> <span>Loading custom order…</span>
        </div>
      </main>
    );
  }

  if (error || !order) {
    return <Navigate to="/custom-orders" replace />;
  }

  const allowedNext = STATUSES_NEXT[order.status] || [];

  return (
    <main className={styles.page}>
      <Link to="/custom-orders" className={styles.backLink}>
        ← All custom orders
      </Link>

      <PageHeader
        eyebrow="Custom order"
        title={order.code}
        description={`${order.customerName} · ${order.productName} · ${timeAgo(order.createdAt)}`}
        actions={
          <span className={[styles.statusPill, statusTone(order.status)].join(' ')}>
            {order.status.replace('_', ' ').toLowerCase()}
          </span>
        }
      />

      <section className={styles.summary} aria-labelledby="co-summary">
        <header className={styles.summaryHead}>
          <h2 id="co-summary" className={styles.summaryTitle}>
            <CustomOrderIcon size={18} strokeWidth={1.75} /> Order summary
          </h2>
        </header>

        <dl className={styles.summaryGrid}>
          <div className={styles.summaryItem}>
            <dt>Customer</dt>
            <dd>
              <Link to={`/customers/${order.customerId}`} className={styles.link}>
                {order.customerName}
              </Link>
            </dd>
          </div>
          <div className={styles.summaryItem}>
            <dt>Product</dt>
            <dd>{order.productName}</dd>
          </div>
          <div className={styles.summaryItem}>
            <dt>Quantity</dt>
            <dd>{order.qty}</dd>
          </div>
          <div className={styles.summaryItem}>
            <dt>Unit price</dt>
            <dd>{formatCurrency(order.unitPrice)}</dd>
          </div>
          <div className={styles.summaryItem}>
            <dt>Total</dt>
            <dd className={styles.summaryTotal}>{formatCurrency(order.total)}</dd>
          </div>
          <div className={styles.summaryItem}>
            <dt>Due date</dt>
            <dd>{order.dueDate ? new Date(order.dueDate).toLocaleDateString() : '—'}</dd>
          </div>
        </dl>

        {order.description ? (
          <div className={styles.descBlock}>
            <span className={styles.descLabel}>Description</span>
            <p className={styles.desc}>{order.description}</p>
          </div>
        ) : null}

        <div className={styles.progressBlock}>
          <div className={styles.progressMeta}>
            <span>
              Paid {formatCurrency(paid)} of {formatCurrency(order.total)}
            </span>
            <span className={balance > 0 ? styles.progressDue : styles.progressPaid}>
              {balance > 0 ? `Due ${formatCurrency(balance)}` : 'Fully paid'}
            </span>
          </div>
          <div className={styles.progressTrack} aria-hidden="true">
            <div className={styles.progressFill} style={{ width: `${paidPct}%` }} />
          </div>
        </div>
      </section>

      <div className={styles.twoCol}>
        <section className={styles.card} aria-labelledby="co-payments">
          <header className={styles.cardHead}>
            <h2 id="co-payments" className={styles.cardTitle}>
              Payments
            </h2>
            <Badge tone="neutral">
              {(order.payments || []).length} payment{(order.payments || []).length === 1 ? '' : 's'}
            </Badge>
          </header>

          {(order.payments || []).length === 0 ? (
            <p className={styles.empty}>No payments recorded yet.</p>
          ) : (
            <ul className={styles.payList}>
              {order.payments.map((p) => (
                <li key={p.id} className={styles.payRow}>
                  <div className={styles.payMain}>
                    <span className={styles.payAmount}>{formatCurrency(p.amount)}</span>
                    <span className={styles.payMeta}>
                      {p.method} · {timeAgo(p.createdAt)}
                      {p.createdBy ? ` · by ${p.createdBy}` : ''}
                    </span>
                    {p.note ? <span className={styles.payNote}>{p.note}</span> : null}
                  </div>
                  <span className={styles.payCashIn}>cash_in: {p.cashInId}</span>
                </li>
              ))}
            </ul>
          )}

          {isOwner && order.status !== 'CANCELLED' && balance > 0 ? (
            <form className={styles.payForm} onSubmit={handleRecordPayment}>
              <h3 className={styles.payFormTitle}>Record payment</h3>
              <div className={styles.payFormRow}>
                <Input
                  type="number"
                  inputMode="decimal"
                  min="1"
                  step="1"
                  max={balance}
                  placeholder={`Max ${formatCurrency(balance)}`}
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  required
                  aria-label="Payment amount"
                />
                <Select
                  value={payMethod}
                  onChange={(e) => setPayMethod(e.target.value)}
                  aria-label="Payment method"
                >
                  <option value="CASH">Cash</option>
                  <option value="BKASH">bKash</option>
                  <option value="NAGAD">Nagad</option>
                  <option value="BANK">Bank</option>
                </Select>
              </div>
              <Textarea
                placeholder="Optional note"
                rows={2}
                value={payNote}
                onChange={(e) => setPayNote(e.target.value)}
              />
              {payError ? <p className={styles.payError}>{payError}</p> : null}
              <div className={styles.payActions}>
                <Button type="submit" variant="primary" disabled={payBusy}>
                  {payBusy ? 'Recording…' : 'Record payment'}
                </Button>
                <span className={styles.payHint}>
                  Creates a paired CASH_IN row automatically.
                </span>
              </div>
            </form>
          ) : null}
        </section>

        <section className={styles.card} aria-labelledby="co-side">
          <header className={styles.cardHead}>
            <h2 id="co-side" className={styles.cardTitle}>
              Notes & timeline
            </h2>
          </header>

          {isOwner && order.status !== 'DELIVERED' && order.status !== 'CANCELLED' ? (
            <>
              <Textarea
                value={order.notes || ''}
                onChange={(e) => setOrder({ ...order, notes: e.target.value })}
                rows={4}
                placeholder="Internal notes about this order…"
              />
              <div className={styles.notesActions}>
                <Button type="button" variant="ghost" onClick={handleSaveNotes}>
                  Save notes
                </Button>
              </div>
            </>
          ) : (
            <p className={styles.notes}>{order.notes || 'No notes recorded.'}</p>
          )}

          <ul className={styles.timeline}>
            <li>
              <span className={styles.tlDot} />
              <div>
                <strong>Created</strong>
                <span>{timeAgo(order.createdAt)}</span>
              </div>
            </li>
            <li>
              <span className={styles.tlDot} />
              <div>
                <strong>Last updated</strong>
                <span>{timeAgo(order.updatedAt)}</span>
              </div>
            </li>
            <li>
              <span className={styles.tlDot} />
              <div>
                <strong>Created by</strong>
                <span>{order.createdBy || 'unknown'}</span>
              </div>
            </li>
          </ul>

          {isOwner && allowedNext.length > 0 ? (
            <div className={styles.statusActions}>
              <h3 className={styles.statusTitle}>Advance status</h3>
              <div className={styles.statusBtns}>
                {allowedNext.map((next) => {
                  const danger = next === 'CANCELLED';
                  return (
                    <Button
                      key={next}
                      type="button"
                      variant={danger ? 'danger' : 'primary'}
                      onClick={() => setPendingStatus(next)}
                    >
                      Mark as {next.replace('_', ' ').toLowerCase()}
                    </Button>
                  );
                })}
              </div>
              <p className={styles.statusHint}>
                Cancellation is a status change only; recorded payments are not auto-reversed.
              </p>
            </div>
          ) : null}
        </section>
      </div>

      <ConfirmDialog
        open={pendingStatus !== null}
        title={`Mark as ${(pendingStatus || '').replace('_', ' ').toLowerCase()}?`}
        message={
          pendingStatus === 'CANCELLED'
            ? 'The order will be marked cancelled. No automatic cash reversal — any recorded payments stay on the books.'
            : `Order ${order.code} will be moved to ${pendingStatus}.`
        }
        confirmLabel="Confirm"
        cancelLabel="Keep current status"
        onConfirm={() => performStatusChange(pendingStatus)}
        onCancel={() => setPendingStatus(null)}
      />
    </main>
  );
}
