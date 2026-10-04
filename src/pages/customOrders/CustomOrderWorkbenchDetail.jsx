import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

import T from '../../components/common/LocalizedText.jsx';
import { Button, ConfirmDialog, Input, Spinner, Textarea } from '../../components/common/index.js';
import { useAuth } from '../../hooks/useAuth.js';
import { useLocale } from '../../contexts/LocaleContext.jsx';
import { getCustomerById } from '../../services/customers/customerService.js';
import { getCustomOrderById, recordCustomOrderPayment, setCustomOrderStatus, updateCustomOrder } from '../../services/customOrders/customOrderService.js';
import { cashBusinessDate } from '../../utils/cashDate.js';
import { formatCurrency, formatExactDate, formatExactDateTime } from '../../utils/format.js';
import styles from './CustomOrderWorkbenchDetail.module.css';

const NEXT_STATUS = {
  PENDING: ['READY', 'CANCELLED'],
  READY: ['DELIVERED', 'CANCELLED'],
  DELIVERED: [],
  CANCELLED: [],
};

function statusLabel(status) {
  return status?.toLowerCase().replace(/^./, (letter) => letter.toUpperCase()) || '';
}

export default function CustomOrderWorkbenchDetail({ orderId, onUpdated, customerOrderCount = 0 }) {
  const { user, role } = useAuth();
  const { t } = useLocale();
  const location = useLocation();
  const isOwner = role === 'OWNER';
  const [order, setOrder] = useState(null);
  const [customer, setCustomer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [payNote, setPayNote] = useState('');
  const [payBusy, setPayBusy] = useState(false);
  const [payError, setPayError] = useState('');
  const [termsOpen, setTermsOpen] = useState(false);
  const [termsDraft, setTermsDraft] = useState({});
  const [termsBusy, setTermsBusy] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteDraft, setNoteDraft] = useState('');
  const [noteBusy, setNoteBusy] = useState(false);
  const [pendingStatus, setPendingStatus] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    setOrder(null);
    setCustomer(null);
    setPaymentOpen(false);
    setTermsOpen(false);
    setNoteOpen(false);
    getCustomOrderById(orderId)
      .then(async (data) => {
        if (cancelled) return;
        setOrder(data);
        if (data?.customerId) {
          try {
            const customerData = await getCustomerById(data.customerId);
            if (!cancelled) setCustomer(customerData);
          } catch { /* The order remains usable if the customer profile cannot load. */ }
        }
      })
      .catch((caught) => { if (!cancelled) setError(caught?.message || 'Could not load order.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [orderId, reloadKey]);

  function commit(updated) {
    setOrder(updated);
    onUpdated?.(updated);
  }

  async function recordPayment(event) {
    event.preventDefault();
    if (!order || payBusy) return;
    setPayError('');
    setPayBusy(true);
    try {
      const result = await recordCustomOrderPayment(order.id,
        { amount: payAmount, method: 'CASH', note: payNote },
        { actor: { username: user?.username || 'unknown', role } });
      commit(result.order);
      setPayAmount('');
      setPayNote('');
      setPaymentOpen(false);
    } catch (caught) { setPayError(caught?.message || 'Could not record payment.'); }
    finally { setPayBusy(false); }
  }

  async function changeStatus(target) {
    try {
      setError('');
      const updated = await setCustomOrderStatus(order.id, target, { actor: { username: user?.username, role } });
      if (updated) commit(updated);
    } catch (caught) { setError(caught?.message || 'Could not update status.'); }
    finally { setPendingStatus(null); }
  }

  function openTerms() {
    setTermsDraft({ qty: String(order.qty), unitPrice: String(order.unitPrice), dueDate: order.dueDate ? cashBusinessDate(order.dueDate) : '', description: order.description || '' });
    setTermsOpen(true);
  }

  async function saveTerms(event) {
    event.preventDefault();
    setTermsBusy(true); setError('');
    try {
      const updated = await updateCustomOrder(order.id, termsDraft, { actor: { username: user?.username, role } });
      commit(updated); setTermsOpen(false);
    } catch (caught) { setError(caught?.message || 'Could not save order terms.'); }
    finally { setTermsBusy(false); }
  }

  async function saveNote(event) {
    event.preventDefault();
    setNoteBusy(true); setError('');
    try {
      const updated = await updateCustomOrder(order.id, { notes: noteDraft }, { actor: { username: user?.username, role } });
      commit(updated); setNoteOpen(false);
    } catch (caught) { setError(caught?.message || 'Could not save notes.'); }
    finally { setNoteBusy(false); }
  }

  if (loading) return <div className={styles.state} aria-busy="true"><Spinner size="sm" /><T>Loading custom order…</T></div>;
  if (!order) return <div className={styles.state} role="alert"><T>{error || 'Custom order not found.'}</T><Button variant="secondary" size="sm" onClick={() => setReloadKey((key) => key + 1)}><T>Retry</T></Button><Link to={`/custom-orders${location.search}`}><T>All custom orders</T></Link></div>;

  const paid = (order.payments || []).reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  const balance = Math.max(Number(order.total || 0) - paid, 0);
  const canPay = order.status !== 'CANCELLED' && order.status !== 'DELIVERED' && balance > 0;
  const canEdit = isOwner && order.status !== 'CANCELLED' && order.status !== 'DELIVERED';
  const nextStatuses = NEXT_STATUS[order.status] || [];
  const customerInitials = (customer?.name || order.customerName || '?').trim().split(/\s+/).slice(0, 2).map((part) => part[0] || '').join('').toUpperCase();
  const productSuffix = /\s*\(([^)]+)\)\s*$/.exec(order.productName || '');
  const productTitle = productSuffix ? order.productName.slice(0, productSuffix.index) : order.productName;
  const productSubtitle = productSuffix?.[1]
    ? productSuffix[1].charAt(0).toUpperCase() + productSuffix[1].slice(1)
    : order.description || t('Custom order');

  return <div className={styles.detail}>
    <Link to={`/custom-orders${location.search}`} className={styles.mobileBack}>← <T>All custom orders</T></Link>
    <header className={styles.hero}>
      <div className={styles.heroMeta}><span className={`${styles.status} ${styles[`status${order.status}`]}`}>{t(statusLabel(order.status))}</span><span className={styles.orderCode}>{order.code}</span></div>
      <h2>{productTitle}</h2>
      <p>{productSubtitle} · {order.customerName}</p>
    </header>
    {error ? <p className={styles.actionError} role="alert"><T>{error}</T></p> : null}

    <div className={styles.topCards}>
      <section className={styles.customerCard} aria-labelledby="workbench-customer">
        <h3 id="workbench-customer"><T>Customer</T></h3>
        <div className={styles.customerIdentity}><span className={styles.avatar} aria-hidden="true">{customerInitials}</span><div><strong>{customer?.name || order.customerName}</strong><span>{customer?.phone || t('No contact info yet')}</span></div></div>
        <p className={styles.customerAddress}><T>Address</T>: {customer?.address || '—'}</p>
        <div className={styles.customerBottom}><span>{customerOrderCount} {t(customerOrderCount === 1 ? 'previous order' : 'previous orders')}</span><Link to={`/customers/${order.customerId}`}><T>Open profile</T></Link></div>
      </section>

      <section className={styles.paymentCard} aria-labelledby="workbench-payment">
        <h3 id="workbench-payment"><T>Payment</T></h3>
        <dl className={styles.paymentFigures}>
          <div><dt><T>Total</T></dt><dd>{formatCurrency(order.total)}</dd></div>
          <div><dt><T>Paid</T></dt><dd className={styles.paid}>{formatCurrency(paid)}</dd></div>
          <div><dt><T>Due</T></dt><dd className={balance > 0 && order.status !== 'CANCELLED' ? styles.due : ''}>{order.status === 'CANCELLED' ? t('No active due') : formatCurrency(balance)}</dd></div>
        </dl>
        {canPay ? <button type="button" className={styles.smallAction} onClick={() => setPaymentOpen((open) => !open)}>＋ <T>Add payment</T></button> : null}
        {paymentOpen && canPay ? <form className={styles.inlineForm} onSubmit={recordPayment}>
          <label><T>Payment amount</T><Input type="number" inputMode="decimal" min="1" step="1" max={balance} placeholder={`Max ${formatCurrency(balance)}`} value={payAmount} onChange={(event) => setPayAmount(event.target.value)} required /></label>
          <label><T>Optional note</T><Textarea rows={2} value={payNote} onChange={(event) => setPayNote(event.target.value)} /></label>
          {payError ? <p role="alert" className={styles.formError}><T>{payError}</T></p> : null}
          <div className={styles.formButtons}><Button type="button" variant="ghost" onClick={() => setPaymentOpen(false)}><T>Cancel</T></Button><Button type="submit" disabled={payBusy}>{payBusy ? t('Recording…') : t('Record cash payment')}</Button></div>
          <p className={styles.formHint}><T>Cash only. Creates a paired CASH_IN row automatically.</T></p>
        </form> : null}
      </section>
    </div>

    <div className={styles.bottomCards}>
      <section className={styles.detailsCard} aria-labelledby="workbench-details">
        <div className={styles.cardHead}><h3 id="workbench-details"><T>Order details</T></h3>{canEdit ? <button type="button" className={styles.smallAction} onClick={() => termsOpen ? setTermsOpen(false) : openTerms()}><T>{termsOpen ? 'Close terms' : 'Edit details'}</T></button> : null}</div>
        <dl className={styles.orderFacts}>
          <div><dt><T>Product</T></dt><dd>{order.productName}</dd></div>
          <div><dt><T>Quantity</T></dt><dd>{order.qty}</dd></div>
          <div><dt><T>Unit price</T></dt><dd>{formatCurrency(order.unitPrice)}</dd></div>
          <div><dt><T>Order date</T></dt><dd>{formatExactDate(order.createdAt)}</dd></div>
          <div><dt><T>Target delivery</T></dt><dd>{order.dueDate ? formatExactDate(order.dueDate) : '—'}</dd></div>
          {order.description ? <div><dt><T>Description</T></dt><dd>{order.description}</dd></div> : null}
        </dl>
        {termsOpen && canEdit ? <form className={styles.termsForm} onSubmit={saveTerms}>
          <label><T>Quantity</T><Input type="number" min="1" step="1" value={termsDraft.qty} onChange={(event) => setTermsDraft((current) => ({ ...current, qty: event.target.value }))} required /></label>
          <label><T>Unit price (৳)</T><Input type="number" min="0.01" step="0.01" value={termsDraft.unitPrice} onChange={(event) => setTermsDraft((current) => ({ ...current, unitPrice: event.target.value }))} required /></label>
          <label><T>Due date</T><Input type="date" value={termsDraft.dueDate} onChange={(event) => setTermsDraft((current) => ({ ...current, dueDate: event.target.value }))} required /></label>
          <label><T>Description</T><Input value={termsDraft.description} onChange={(event) => setTermsDraft((current) => ({ ...current, description: event.target.value }))} /></label>
          <Button type="submit" disabled={termsBusy}><T>Save terms</T></Button>
        </form> : null}
      </section>

      <section className={styles.noteCard} aria-labelledby="workbench-note">
        <div className={styles.cardHead}><h3 id="workbench-note"><T>Tailoring note</T></h3>{canEdit ? <button type="button" className={styles.smallAction} onClick={() => { setNoteDraft(order.notes || ''); setNoteOpen((open) => !open); }}><T>{noteOpen ? 'Close note' : 'Edit note'}</T></button> : null}</div>
        {noteOpen && canEdit ? <form className={styles.noteForm} onSubmit={saveNote}><Textarea rows={4} value={noteDraft} onChange={(event) => setNoteDraft(event.target.value)} /><div className={styles.formButtons}><Button type="submit" disabled={noteBusy}><T>Save notes</T></Button></div></form> : <p>{order.notes || t('No notes recorded.')}</p>}
        <span className={styles.noteMeta}>{t('Order created by')} {order.createdBy || '—'} · {formatExactDate(order.createdAt)}</span>
      </section>
    </div>

    {nextStatuses.length ? <div className={styles.statusActions}>
      {nextStatuses.includes('CANCELLED') ? <button type="button" className={styles.cancelOrder} onClick={() => setPendingStatus('CANCELLED')}><T>Cancel order</T></button> : <span />}
      <div className={styles.forwardActions}>
        {nextStatuses.filter((status) => status !== 'CANCELLED').map((status) => <button key={status} type="button" className={styles.advanceButton}
          disabled={status === 'DELIVERED' && balance > 0} onClick={() => setPendingStatus(status)}>
          {t('Mark as')} {t(statusLabel(status))}
        </button>)}
      </div>
    </div> : null}
    {order.status === 'CANCELLED' ? <p className={styles.cancelGuidance}><T>Cancellation keeps all payments and does not refund automatically. Any exceptional refund is a separate Owner Cash Out with the order code in the reason.</T></p> : null}

    <section className={styles.history} aria-labelledby="order-history-heading">
      <h3 id="order-history-heading"><T>Payment & status history</T></h3>
      <div className={styles.historyGrid}>
        <div><h4><T>Payments</T></h4>{order.payments?.length ? <ul>{order.payments.map((payment) => <li key={payment.id}><strong>{formatCurrency(payment.amount)}</strong><span>{formatExactDateTime(payment.createdAt)} · {payment.createdBy || '—'}</span>{payment.note ? <small>{payment.note}</small> : null}</li>)}</ul> : <p><T>No payments recorded yet.</T></p>}</div>
        <div><h4><T>Status timeline</T></h4>{order.statusHistory?.length ? <ul>{order.statusHistory.map((event, index) => <li key={`${event.status}-${event.at}-${index}`}><strong>{t(statusLabel(event.status))}</strong><span>{formatExactDateTime(event.at)} · {event.by || '—'}</span></li>)}</ul> : <p><T>No status history yet.</T></p>}</div>
      </div>
    </section>

    <ConfirmDialog open={pendingStatus !== null} title={`${t('Mark as')} ${t(statusLabel(pendingStatus))}?`}
      message={pendingStatus === 'CANCELLED'
        ? 'The order will be cancelled. Recorded payments remain and no refund or cash reversal is created. If needed, make a separate Owner Cash Out with this order code in the reason.'
        : `${t('Order')} ${order.code} ${t('will be moved to')} ${t(statusLabel(pendingStatus))}.`}
      confirmLabel="Confirm" cancelLabel="Keep current status"
      onConfirm={() => changeStatus(pendingStatus)} onCancel={() => setPendingStatus(null)} />
  </div>;
}
