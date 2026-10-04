import T from '../../components/common/LocalizedText.jsx';
/**
 * CustomOrderDetailPage — Phase 7.
 *
 * Single-order view: header, summary card with payment progress, payment list,
 * cash-payment form and status controls (Owner/Employee), with notes editing
 * reserved for the Owner.
 */
import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import {
  Badge,
  Button,
  ConfirmDialog,
  Input,
  PageHeader,
  Spinner,
  Textarea,
} from '../../components/common/index.js';
import { CustomOrderIcon } from '../../components/icons/DashboardIcon.jsx';
import { useAuth } from '../../hooks/useAuth.js';
import { useLocale } from '../../contexts/LocaleContext.jsx';
import {
  getCustomOrderById,
  recordCustomOrderPayment,
  setCustomOrderStatus,
  updateCustomOrder,
} from '../../services/customOrders/customOrderService.js';
import { formatCount, formatCurrency, formatExactDate, formatExactDateTime, timeAgo } from '../../utils/format.js';
import { cashBusinessDate } from '../../utils/cashDate.js';
import styles from './CustomOrderDetailPage.module.css';

const STATUSES_NEXT = {
  PENDING: ['READY', 'CANCELLED'],
  READY: ['DELIVERED', 'CANCELLED'],
  DELIVERED: [],
  CANCELLED: [],
};

function statusTone(status) {
  switch (status) {
    case 'PENDING':
      return styles.toneWarning;
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
  const { t } = useLocale();
  const { id } = useParams();
  const { user, role } = useAuth();
  const isOwner = role === 'OWNER';
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [payAmount, setPayAmount] = useState('');
  const [payNote, setPayNote] = useState('');
  const [payBusy, setPayBusy] = useState(false);
  const [payError, setPayError] = useState('');
  const [pendingStatus, setPendingStatus] = useState(null);
  const [termsOpen, setTermsOpen] = useState(false);
  const [termsDraft, setTermsDraft] = useState({});
  const [termsBusy, setTermsBusy] = useState(false);

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
        { amount: payAmount, method: 'CASH', note: payNote },
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
      setError('');
      const updated = await setCustomOrderStatus(id, target, {
        actor: { username: user?.username, role },
      });
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
      const updated = await updateCustomOrder(id, { notes: order.notes }, {
        actor: { username: user?.username, role },
      });
      if (updated) setOrder(updated);
    } catch (err_) {
      setError(err_?.message || 'Could not save notes.');
    }
  }

  async function saveTerms(event) {
    event.preventDefault(); setTermsBusy(true); setError('');
    try {
      const updated = await updateCustomOrder(id, termsDraft, { actor: { username: user?.username, role } });
      setOrder(updated); setTermsOpen(false);
    } catch (err) { setError(err?.message || 'Could not save order terms.'); }
    finally { setTermsBusy(false); }
  }

  if (loading) {
    return (
      <main className={styles.page} aria-busy="true">
        <div className={styles.loading}>
          <Spinner /> <span><T>Loading custom order…</T></span>
        </div>
      </main>
    );
  }

  if (!order) {
    return <main className={styles.page}><p role="alert">{t(error || 'Custom order not found.')}</p><Link to="/custom-orders"><T>← All custom orders</T></Link></main>;
  }

  const allowedNext = STATUSES_NEXT[order.status] || [];

  return (
    <main className={styles.page}>
      <Link to="/custom-orders" className={styles.backLink}><T>
        ← All custom orders
      </T></Link>

      <PageHeader
        eyebrow="Custom order"
        title={order.code}
        description={`${order.customerName} · ${order.productName} · ${timeAgo(order.createdAt)}`}
        actions={
          <span className={[styles.statusPill, statusTone(order.status)].join(' ')}>
            {t(order.status.replace('_', ' ').toLowerCase().replace(/^./, (letter) => letter.toUpperCase()))}
          </span>
        }
      />
      {error ? <p className={styles.actionError} role="alert">{t(error)}</p> : null}

      <section className={styles.summary} aria-labelledby="co-summary">
        <header className={styles.summaryHead}>
          <h2 id="co-summary" className={styles.summaryTitle}>
            <CustomOrderIcon size={18} strokeWidth={1.75} /><T> Order summary
          </T></h2>
        </header>

        <dl className={styles.summaryGrid}>
          <div className={styles.summaryItem}>
            <dt><T>Customer</T></dt>
            <dd>
              <Link to={`/customers/${order.customerId}`} className={styles.link}>
                {order.customerName}
              </Link>
            </dd>
          </div>
          <div className={styles.summaryItem}>
            <dt><T>Product</T></dt>
            <dd>{order.productName}</dd>
          </div>
          <div className={styles.summaryItem}>
            <dt><T>Quantity</T></dt>
            <dd>{order.qty}</dd>
          </div>
          <div className={styles.summaryItem}>
            <dt><T>Unit price</T></dt>
            <dd>{formatCurrency(order.unitPrice)}</dd>
          </div>
          <div className={styles.summaryItem}>
            <dt><T>Total</T></dt>
            <dd className={styles.summaryTotal}>{formatCurrency(order.total)}</dd>
          </div>
          <div className={styles.summaryItem}>
            <dt><T>Due date</T></dt>
            <dd>{order.dueDate ? formatExactDate(order.dueDate) : '—'}</dd>
          </div>
          {order.deliveredAt ? (
            <div className={styles.summaryItem}>
              <dt><T>Delivered at</T></dt><dd>{formatExactDateTime(order.deliveredAt)}</dd>
            </div>
          ) : null}
        </dl>

        {order.description ? (
          <div className={styles.descBlock}>
            <span className={styles.descLabel}><T>Description</T></span>
            <p className={styles.desc}>{order.description}</p>
          </div>
        ) : null}

        <div className={styles.progressBlock}>
          <div className={styles.progressMeta}>
            <span><T>
              Paid </T>{formatCurrency(paid)}<T> of </T>{formatCurrency(order.total)}
            </span>
            <span className={balance > 0 ? styles.progressDue : styles.progressPaid}>
              {order.status === 'CANCELLED' ? t('No active due') : balance > 0 ? `${t('Due')} ${formatCurrency(balance)}` : t('Fully paid')}
            </span>
          </div>
          <div className={styles.progressTrack} aria-hidden="true">
            <div className={styles.progressFill} style={{ width: `${paidPct}%` }} />
          </div>
        </div>
      </section>

      {isOwner && order.status !== 'CANCELLED' && order.status !== 'DELIVERED' ? <section className={styles.card}>
        <Button variant="secondary" onClick={() => { setTermsDraft({ qty: String(order.qty), unitPrice: String(order.unitPrice), dueDate: order.dueDate ? cashBusinessDate(order.dueDate) : '', description: order.description || '' }); setTermsOpen((open) => !open); }}>{termsOpen ? 'Close terms' : 'Edit order terms'}</Button>
        {termsOpen ? <form onSubmit={saveTerms} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10, marginTop: 16 }}>
          <label><T>Quantity</T><input required type="number" min="1" step="1" value={termsDraft.qty} onChange={(event) => setTermsDraft((current) => ({ ...current, qty: event.target.value }))} /></label>
          <label><T>Unit price (৳)</T><input required type="number" min="0.01" step="0.01" value={termsDraft.unitPrice} onChange={(event) => setTermsDraft((current) => ({ ...current, unitPrice: event.target.value }))} /></label>
          <label><T>Due date</T><input required type="date" value={termsDraft.dueDate} onInput={(event) => { const value = event.currentTarget.value; setTermsDraft((current) => ({ ...current, dueDate: value })); }} onChange={(event) => { const value = event.target.value; setTermsDraft((current) => ({ ...current, dueDate: value })); }} /></label>
          <label><T>Description</T><input value={termsDraft.description} onChange={(event) => setTermsDraft((current) => ({ ...current, description: event.target.value }))} /></label>
          <div style={{ alignSelf: 'end' }}><Button type="submit" disabled={termsBusy}><T>Save terms</T></Button></div>
        </form> : null}
      </section> : null}

      <div className={styles.twoCol}>
        <section className={styles.card} aria-labelledby="co-payments">
          <header className={styles.cardHead}>
            <h2 id="co-payments" className={styles.cardTitle}><T>
              Payments
            </T></h2>
            <Badge tone="neutral">
              {formatCount((order.payments || []).length, 'payment', 'payments', 'পেমেন্ট')}
            </Badge>
          </header>

          {(order.payments || []).length === 0 ? (
            <p className={styles.empty}><T>No payments recorded yet.</T></p>
          ) : (
            <ul className={styles.payList}>
              {order.payments.map((p) => (
                <li key={p.id} className={styles.payRow}>
                  <div className={styles.payMain}>
                    <span className={styles.payAmount}>{formatCurrency(p.amount)}</span>
                    <span className={styles.payMeta}>
                      {t(p.method)} · {timeAgo(p.createdAt)}
                      {p.createdBy ? ` · ${t('by')} ${p.createdBy}` : ''}
                    </span>
                    {p.note ? <span className={styles.payNote}>{p.note}</span> : null}
                  </div>
                  {isOwner ? <span className={styles.payCashIn}><T>cash_in: </T>{p.cashInId}</span> : null}
                </li>
              ))}
            </ul>
          )}

          {order.status !== 'CANCELLED' && order.status !== 'DELIVERED' && balance > 0 ? (
            <form className={styles.payForm} onSubmit={handleRecordPayment}>
              <h3 className={styles.payFormTitle}><T>Record cash payment</T></h3>
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
                  aria-label={t('Payment amount')}
                />
              </div>
              <Textarea
                placeholder="Optional note"
                rows={2}
                value={payNote}
                onChange={(e) => setPayNote(e.target.value)}
              />
              {payError ? <p className={styles.payError}>{t(payError)}</p> : null}
              <div className={styles.payActions}>
                <Button type="submit" variant="primary" disabled={payBusy}>
                  {payBusy ? 'Recording…' : 'Record cash payment'}
                </Button>
                <span className={styles.payHint}><T>
                  Cash only. Creates a paired CASH_IN row automatically.
                </T></span>
              </div>
            </form>
          ) : null}
        </section>

        <section className={styles.card} aria-labelledby="co-side">
          <header className={styles.cardHead}>
            <h2 id="co-side" className={styles.cardTitle}><T>
              Notes & timeline
            </T></h2>
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
                <Button type="button" variant="ghost" onClick={handleSaveNotes}><T>
                  Save notes
                </T></Button>
              </div>
            </>
          ) : (
            <p className={styles.notes}>{order.notes || t('No notes recorded.')}</p>
          )}

          <ul className={styles.timeline}>
            <li>
              <span className={styles.tlDot} />
              <div>
                <strong><T>Created</T></strong>
                <span>{timeAgo(order.createdAt)}</span>
              </div>
            </li>
            <li>
              <span className={styles.tlDot} />
              <div>
                <strong><T>Last updated</T></strong>
                <span>{timeAgo(order.updatedAt)}</span>
              </div>
            </li>
            <li>
              <span className={styles.tlDot} />
              <div>
                <strong><T>Created by</T></strong>
                <span>{order.createdBy || 'unknown'}</span>
              </div>
            </li>
          </ul>

          {allowedNext.length > 0 ? (
            <div className={styles.statusActions}>
              <h3 className={styles.statusTitle}><T>Advance status</T></h3>
              <div className={styles.statusBtns}>
                {allowedNext.map((next) => {
                  const danger = next === 'CANCELLED';
                  return (
                    <Button
                      key={next}
                      type="button"
                      variant={danger ? 'danger' : 'primary'}
                      disabled={next === 'DELIVERED' && balance > 0}
                      onClick={() => setPendingStatus(next)}
                    >{t('Mark as')} {t(next.replace('_', ' ').toLowerCase().replace(/^./, (letter) => letter.toUpperCase()))}
                    </Button>
                  );
                })}
              </div>
              <p className={styles.statusHint}><T>
                Delivery requires full payment. Cancellation keeps all payments and does not refund automatically.
                Any exceptional refund is a separate Owner </T><Link to="/cash"><T>Cash Out</T></Link><T> with the order code in the reason.
              </T></p>
            </div>
          ) : null}
        </section>
      </div>

      <ConfirmDialog
        open={pendingStatus !== null}
        title={`${t('Mark as')} ${t((pendingStatus || '').replace('_', ' ').toLowerCase().replace(/^./, (letter) => letter.toUpperCase()))}?`}
        message={
          pendingStatus === 'CANCELLED'
            ? 'The order will be cancelled. Recorded payments remain and no refund or cash reversal is created. If needed, make a separate Owner Cash Out with this order code in the reason.'
            : `${t('Order')} ${order.code} ${t('will be moved to')} ${t((pendingStatus || '').replace('_', ' ').toLowerCase().replace(/^./, (letter) => letter.toUpperCase()))}.`
        }
        confirmLabel="Confirm"
        cancelLabel="Keep current status"
        onConfirm={() => performStatusChange(pendingStatus)}
        onCancel={() => setPendingStatus(null)}
      />
    </main>
  );
}
