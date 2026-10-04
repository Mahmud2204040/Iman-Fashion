import T from '../../components/common/LocalizedText.jsx';
/**
 * PurchaseDetailPage — Phase 9.
 *
 * Owner-only. Single-purchase view:
 *   - Header: code + supplier + status badge
 *   - Summary: total / paid / due, dates (ordered, expected, received)
 *   - Line items table
 *   - Purchase-specific CASH payments; never an automatic shop CASH_OUT
 *   - Notes section (editable for DRAFT/ORDERED; locked for terminal)
 *   - Status transitions: DRAFT → ORDERED → RECEIVED; unpaid DRAFT/ORDERED may cancel
 *   - Receipt gallery (mock data URLs with purchase/payment metadata)
 *   - Back-link to /purchases list
 *
 * Per PROJECT_RULES, supplier payments never auto-create shop-cash CASH_OUT.
 *   - Only OWNER can perform mutations; mutations reject during
 *     smoke/internal guards even if a non-owner reaches the UI.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  FormField,
  Input,
  PageHeader,
  SearchInput,
  Select,
  Spinner,
  Textarea,
} from '../../components/common/index.js';
import { PurchaseIcon } from '../../components/icons/DashboardIcon.jsx';
import { useAuth } from '../../hooks/useAuth.js';
import { useLocale } from '../../contexts/LocaleContext.jsx';
import { cashBusinessDate } from '../../utils/cashDate.js';
import {
  attachPurchaseReceipt,
  computePurchaseTotals,
  getPurchaseById,
  recordPurchasePayment,
  setPurchaseStatus,
  updatePurchase,
} from '../../services/purchases/purchaseService.js';
import { formatCurrency, timeAgo } from '../../utils/format.js';
import styles from './PurchaseDetailPage.module.css';

const STATUS_TONE = {
  DRAFT: 'neutral',
  ORDERED: 'info',
  RECEIVED: 'success',
  CANCELLED: 'danger',
};

function paymentsTotal(payments) {
  return (payments || []).reduce((s, p) => s + Number(p.amount || 0), 0);
}

export default function PurchaseDetailPage() {
  const { id } = useParams();
  const { user, role } = useAuth();
  const { language, t } = useLocale();
  const isOwner = role === 'OWNER';

  const [purchase, setPurchase] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Notes
  const [notesDraft, setNotesDraft] = useState('');
  const [notesBusy, setNotesBusy] = useState(false);
  const [notesMsg, setNotesMsg] = useState('');

  // Status transition confirm
  const [pendingStatus, setPendingStatus] = useState(null);

  // Payment form
  const [payAmount, setPayAmount] = useState('');
  const [payNote, setPayNote] = useState('');
  const [payBusy, setPayBusy] = useState(false);
  const [payMsg, setPayMsg] = useState('');
  const [payErr, setPayErr] = useState('');

  // Receipt upload (mock)
  const fileInputRef = useRef(null);
  const [receiptBusy, setReceiptBusy] = useState(false);
  const [receiptMsg, setReceiptMsg] = useState('');
  const [receiptPaymentId, setReceiptPaymentId] = useState('');

  // Payment search
  const [paymentQuery, setPaymentQuery] = useState('');

  function reload() {
    setLoading(true);
    setError('');
    getPurchaseById(id)
      .then((p) => {
        if (!p) {
          setError('not-found');
          setPurchase(null);
          return;
        }
        setPurchase(p);
        setNotesDraft(p.notes || '');
      })
      .catch((err_) => setError(err_?.message || 'Could not load purchase.'))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const totals = useMemo(() => {
    if (!purchase) return null;
    return computePurchaseTotals(purchase);
  }, [purchase]);

  const visiblePayments = useMemo(() => {
    const list = purchase?.payments || [];
    const q = paymentQuery.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (row) =>
        (row.method || '').toLowerCase().includes(q) ||
        (row.note || '').toLowerCase().includes(q) ||
        (row.id || '').toLowerCase().includes(q),
    );
  }, [purchase, paymentQuery]);

  const remaining = useMemo(() => {
    if (!purchase) return 0;
    const paid = paymentsTotal(purchase.payments);
    return Math.max(Number(purchase.total || 0) - paid, 0);
  }, [purchase]);

  const dateLocale = language === 'bn' ? 'bn-BD-u-nu-latn' : 'en-GB';
  const dateOnly = (value) => value ? new Intl.DateTimeFormat(dateLocale, {
    day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Dhaka',
  }).format(new Date(value)) : '—';
  const purchaseDay = purchase?.orderedAt ? cashBusinessDate(purchase.orderedAt) : '';

  if (loading) {
    return (
      <main className={styles.page} aria-busy="true">
        <div className={styles.loading}>
          <Spinner /> <span><T>Loading purchase…</T></span>
        </div>
      </main>
    );
  }

  if (error === 'not-found' || !purchase) {
    return <main className={styles.page}><p role="alert">{error === 'not-found' ? 'Purchase not found.' : error || 'Purchase unavailable.'}</p><Link to="/purchases"><T>← All purchases</T></Link><Button onClick={reload}><T>Retry</T></Button></main>;
  }

  const isTerminal = purchase.status === 'RECEIVED' || purchase.status === 'CANCELLED';
  const canRecordPayment = isOwner && (purchase.status === 'ORDERED' || purchase.status === 'RECEIVED') && remaining > 0;
  const canEditNotes = isOwner && !isTerminal;
  const canChangeStatus = isOwner && !isTerminal;
  const canAttachReceipt = isOwner;

  /* -------------------------- mutations -------------------------------- */

  async function saveNotes() {
    setNotesBusy(true);
    setNotesMsg('');
    try {
      const updated = await updatePurchase(
        purchase.id,
        { notes: notesDraft },
        { actor: { username: user?.username || 'unknown', role } },
      );
      if (updated) {
        setPurchase(updated);
        setNotesMsg('Notes saved.');
      }
    } catch (err_) {
      setNotesMsg(err_?.message || 'Could not save notes.');
    } finally {
      setNotesBusy(false);
    }
  }

  async function changeStatus(nextStatus) {
    setPendingStatus(null);
    try {
      const updated = await setPurchaseStatus(purchase.id, nextStatus, {
        actor: { username: user?.username || 'unknown', role },
      });
      setPurchase(updated);
    } catch (err_) {
      setNotesMsg(err_?.message || 'Could not change status.');
    }
  }

  async function recordPayment(e) {
    e.preventDefault();
    setPayMsg('');
    setPayErr('');
    setPayBusy(true);
    try {
      const result = await recordPurchasePayment(
        purchase.id,
        {
          amount: Number(payAmount),
          method: 'CASH',
          note: payNote,
        },
        { actor: { username: user?.username || 'unknown', role } },
      );
      setPurchase(result.purchase);
      setPayAmount('');
      setPayNote('');
      setPayMsg('Payment recorded. Shop cash was not changed; record a separate manual Cash Out if cash left the shop.');
    } catch (err_) {
      setPayErr(err_?.message || 'Could not record payment.');
    } finally {
      setPayBusy(false);
    }
  }

  async function handleReceiptFiles(files) {
    if (!files.length) return;
    setReceiptBusy(true);
    setReceiptMsg('');
    try {
      let updated = purchase;
      for (const file of files) {
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) {
          throw new Error('Use JPG, PNG or WebP images of 5 MB or less.');
        }
        const dataUrl = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onerror = () => reject(reader.error || new Error('Read failed'));
          reader.onload = () => resolve(String(reader.result || ''));
          reader.readAsDataURL(file);
        });
        updated = await attachPurchaseReceipt(purchase.id, {
          dataUrl, name: file.name, type: file.type, size: file.size,
          paymentId: receiptPaymentId || null,
        }, { actor: { username: user?.username || 'unknown', role } });
      }
      setPurchase(updated);
      setReceiptMsg(language === 'bn'
        ? `${files.length}টি রসিদের ছবি যুক্ত হয়েছে।`
        : `${files.length} receipt image${files.length === 1 ? '' : 's'} attached.`);
    } catch (err_) {
      setReceiptMsg(err_?.message || 'Could not attach receipt.');
    } finally {
      setReceiptBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  function onReceiptChange(e) {
    handleReceiptFiles(Array.from(e.target.files || []));
  }

  /* ------------------------------ UI ----------------------------------- */

  return (
    <main className={styles.page}>
      <Link to="/purchases" className={styles.backLink}><T>
        ← All purchases
      </T></Link>

      <PageHeader
        eyebrow="Procurement"
        title={purchase.code}
        description={`${purchase.supplierName} · ${t('Purchase date')} ${dateOnly(purchase.orderedAt)}`}
        actions={
          <div className={styles.headerActions}>
            <Badge tone={STATUS_TONE[purchase.status] || 'neutral'}>
              {purchase.status}
            </Badge>
          </div>
        }
      />

      {/* --- Summary --------------------------------------------- */}
      <Card className={styles.totalsCard}>
        <div className={styles.totalBlock}>
          <span className={styles.totalLabel}><T>Total</T></span>
          <span className={styles.totalValue}>
            {formatCurrency(totals?.total || 0)}
          </span>
          <span className={styles.totalSub}>
            {purchase.items.length} {language === 'bn' ? 'আইটেম' : purchase.items.length === 1 ? 'item' : 'items'}
          </span>
        </div>
        <span className={styles.divider} aria-hidden="true" />
        <div className={styles.totalBlock}>
          <span className={styles.totalLabel}><T>Paid</T></span>
          <span className={`${styles.totalValue} ${styles.totalPaid}`}>
            {formatCurrency(totals?.paidTotal || 0)}
          </span>
          <span className={styles.totalSub}>
            {purchase.payments.length} {language === 'bn' ? 'পেমেন্ট' : purchase.payments.length === 1 ? 'payment' : 'payments'}
          </span>
        </div>
        <span className={styles.divider} aria-hidden="true" />
        <div
          className={
            (totals?.dueTotal || 0) > 0
              ? `${styles.totalBlock} ${styles.totalBlockDue}`
              : styles.totalBlock
          }
        >
          <span className={styles.totalLabel}><T>Outstanding</T></span>
          <span
            className={
              (totals?.dueTotal || 0) > 0
                ? `${styles.totalValue} ${styles.totalDue}`
                : styles.totalValue
            }
          >
            {formatCurrency(totals?.dueTotal || 0)}
          </span>
          {(totals?.dueTotal || 0) > 0 ? (
            <span className={styles.dueChip}><T>Action needed</T></span>
          ) : (
            <span className={styles.totalSub}><T>Cleared</T></span>
          )}
        </div>
      </Card>

      {/* --- Dates ----------------------------------------------- */}
      <Card className={styles.datesCard}>
        <div className={styles.dateBlock}>
          <span className={styles.dateLabel}>{t('Purchase date')}</span>
          <span className={styles.dateValue}>
            {dateOnly(purchase.orderedAt)}
          </span>
          <span className={styles.dateSub}>
            {purchaseDay}
          </span>
        </div>
        <span className={styles.divider} aria-hidden="true" />
        <div className={styles.dateBlock}>
          <span className={styles.dateLabel}><T>Expected</T></span>
          <span className={styles.dateValue}>
            {purchase.expectedAt
              ? dateOnly(purchase.expectedAt)
              : '—'}
          </span>
          <span className={styles.dateSub}>
            {t(purchase.expectedAt ? 'target arrival' : 'no ETA set')}
          </span>
        </div>
        <span className={styles.divider} aria-hidden="true" />
        <div className={styles.dateBlock}>
          <span className={styles.dateLabel}><T>Received</T></span>
          <span className={styles.dateValue}>
            {purchase.receivedAt
              ? dateOnly(purchase.receivedAt)
              : '—'}
          </span>
          <span className={styles.dateSub}>
            {t(purchase.receivedAt ? 'finished stock unchanged' : 'pending')}
          </span>
        </div>
      </Card>

      {/* --- Line items ------------------------------------------ */}
      <Card className={styles.sectionCard}>
        <div className={styles.sectionHead}>
          <h2 className={styles.sectionTitle}><T>Line items</T></h2>
          <span className={styles.sectionMeta}>
            {purchase.items.length} {language === 'bn' ? 'লাইন' : purchase.items.length === 1 ? 'line' : 'lines'}
          </span>
        </div>
        {purchase.items.length === 0 ? (
          <p className={styles.emptyText}><T>No line items on this purchase.</T></p>
        ) : (
          <ul className={styles.itemsList}>
            {purchase.items.map((it) => (
              <li key={it.id} className={styles.itemRow}>
                <div className={styles.itemMain}>
                  <span className={styles.itemName}>{it.name}</span>
                  <span className={styles.itemMeta}><T>
                    qty </T>{it.qty} × {formatCurrency(it.unitPrice)}
                  </span>
                </div>
                <div className={styles.itemRight}>
                  <span className={styles.itemLineTotal}>
                    {formatCurrency(it.lineTotal)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* --- Payments -------------------------------------------- */}
      <Card className={styles.sectionCard}>
        <div className={styles.sectionHead}>
          <h2 className={styles.sectionTitle}><T>Payments</T></h2>
          <span className={styles.sectionMeta}><T>Purchase-specific cash payments. Shop cash changes only via a separate manual Cash Out.</T></span>
        </div>

        {canRecordPayment ? (
          <form className={styles.payForm} onSubmit={recordPayment}>
            <FormField label="Amount (৳)" htmlFor="pay-amount" required>
              {(controlProps) => (
                <Input
                  {...controlProps}
                  id="pay-amount"
                  type="number"
                  inputMode="decimal"
                  min="1"
                  step="0.01"
                  max={remaining}
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  placeholder={String(remaining)}
                  required
                />
              )}
            </FormField>
            <p className={styles.sectionMeta}><T>Method: Cash only</T></p>
            <FormField label="Note" htmlFor="pay-note">
              {(controlProps) => (
                <Input
                  {...controlProps}
                  id="pay-note"
                  value={payNote}
                  onChange={(e) => setPayNote(e.target.value)}
                  placeholder="optional"
                />
              )}
            </FormField>
            <div className={styles.payFormActions}>
              <Button
                type="submit"
                variant="primary"
                disabled={payBusy || !payAmount}
                loading={payBusy}
                loadingText="Recording…"
              ><T>
                Record payment
              </T></Button>
            </div>
            {payErr ? (
              <p className={styles.payErr} role="alert">
                {t(payErr)}
              </p>
            ) : null}
            {payMsg ? (
              <p className={styles.payMsg} role="status">
                {t(payMsg)}
              </p>
            ) : null}
          </form>
        ) : null}

        <FormField label="Search payments" hideLabel>
          <SearchInput
            value={paymentQuery}
            onChange={(event) => setPaymentQuery(event.target.value)}
            placeholder="Search by payment ID or note…"
          />
        </FormField>

        {visiblePayments.length === 0 ? (
          <p className={styles.emptyText}>
            {(purchase.payments || []).length === 0
              ? <T>No payments recorded yet.</T>
              : <T>No payments match the filter.</T>}
          </p>
        ) : (
          <ol className={styles.paymentList}>
            {visiblePayments.map((row) => (
              <li key={row.id} className={styles.paymentRow}>
                <div className={styles.paymentLeft}>
                  <span className={styles.paymentMethod}>
                    {t(row.method || 'CASH')}
                  </span>
                  <span className={styles.paymentMeta}>
                    {timeAgo(row.createdAt)}<T> · by </T>{row.createdBy || 'unknown'}
                    {' · '}{row.id}
                  </span>
                  {row.note ? (
                    <span className={styles.paymentNote}>{row.note}</span>
                  ) : null}
                </div>
                <div className={styles.paymentRight}>
                  <span className={styles.paymentAmount}>
                    {formatCurrency(row.amount)}
                  </span>
                </div>
              </li>
            ))}
          </ol>
        )}
      </Card>

      {/* --- Notes ----------------------------------------------- */}
      {isOwner ? (
        <Card className={styles.sectionCard}>
          <div className={styles.sectionHead}>
            <h2 className={styles.sectionTitle}><T>Internal notes</T></h2>
            <span className={styles.sectionMeta}>
              {canEditNotes
                ? t('Visible to all owners.')
                : <T>Locked — purchase is received or cancelled.</T>}
            </span>
          </div>
          <Textarea
            rows={3}
            value={notesDraft}
            onChange={(e) => setNotesDraft(e.target.value)}
            disabled={!canEditNotes}
            placeholder="Add notes about this purchase — supplier terms, delivery remarks, etc."
          />
          <div className={styles.notesFooter}>
            {notesMsg ? (
              <span
                className={
                  notesMsg === 'Notes saved.'
                    ? styles.notesMsgOk
                    : styles.notesMsgErr
                }
                role="status"
              >
                {t(notesMsg)}
              </span>
            ) : null}
            <Button
              variant="primary"
              disabled={notesBusy || !canEditNotes}
              onClick={saveNotes}
            >
              {notesBusy ? 'Saving…' : 'Save notes'}
            </Button>
          </div>
        </Card>
      ) : null}

      {/* --- Status + receipt actions --------------------------- */}
      {canChangeStatus ? (
        <Card className={styles.actionsCard}>
          <div className={styles.actionsHeader}>
            <h2 className={styles.sectionTitle}><T>Change status</T></h2>
            <span className={styles.sectionMeta}><T>
              DRAFT → ORDERED → RECEIVED; or cancel.
            </T></span>
          </div>
          <div className={styles.actionRow}>
            {purchase.status === 'DRAFT' ? (
              <Button
                variant="primary"
                onClick={() => setPendingStatus('ORDERED')}
              ><T>
                Mark ordered
              </T></Button>
            ) : null}
            {purchase.status === 'ORDERED' ? (
              <Button
                variant="primary"
                onClick={() => setPendingStatus('RECEIVED')}
              ><T>
                Mark received
              </T></Button>
            ) : null}
            {purchase.payments.length === 0 ? <Button variant="ghost" onClick={() => setPendingStatus('CANCELLED')}><T>Cancel purchase</T></Button> : null}
          </div>
        </Card>
      ) : null}

      {canAttachReceipt ? (
        <Card className={styles.sectionCard}>
          <div className={styles.sectionHead}>
            <h2 className={styles.sectionTitle}><T>Receipt proofs</T></h2>
            <span className={styles.sectionMeta}>
              {(purchase.receipts || []).length}<T> images · JPG, PNG or WebP · 5 MB each
            </T></span>
          </div>
          {(purchase.receipts || []).length ? <div className={styles.receiptPreview}>
            {purchase.receipts.map((receipt) => <figure key={receipt.id}>
              <a href={receipt.dataUrl} target="_blank" rel="noreferrer"><img src={receipt.dataUrl} alt={`${receipt.name} for ${purchase.code}`} className={styles.receiptImage} /></a>
              <figcaption>{receipt.name} · {receipt.paymentId || t('Purchase proof')} · {receipt.uploadedBy} · {new Intl.DateTimeFormat(dateLocale, { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Dhaka' }).format(new Date(receipt.uploadedAt))}</figcaption>
            </figure>)}
          </div> : null}
          <div className={styles.receiptActions}>
            <Select aria-label={t('Link proof to a payment')} fullWidth={false} value={receiptPaymentId} onChange={(event) => setReceiptPaymentId(event.target.value)} options={[{ value: '', label: 'Purchase proof' }, ...purchase.payments.map((payment) => ({ value: payment.id, label: `${t('Payment')} ${payment.id}` }))]} />
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              onChange={onReceiptChange}
              className={styles.fileInput}
              aria-label={t('Attach receipt')}
            />
            <Button
              variant="secondary"
              onClick={() => fileInputRef.current?.click()}
              disabled={receiptBusy}
            >
              {receiptBusy ? 'Attaching…' : 'Add receipt images'}
            </Button>
            {receiptMsg ? (
              <span className={styles.receiptMsg} role="status">
                {t(receiptMsg)}
              </span>
            ) : null}
          </div>
        </Card>
      ) : null}

      <ConfirmDialog
        open={pendingStatus === 'RECEIVED'}
        title="Mark purchase received?"
        message={`${t('Marking purchase')} ${purchase.code} ${t('received locks the purchase. Notes and items cannot be edited after this.')}`}
        confirmText="Mark received"
        tone="primary"
        onClose={() => setPendingStatus(null)}
        onConfirm={() => changeStatus('RECEIVED')}
      />
      <ConfirmDialog
        open={pendingStatus === 'ORDERED'}
        title="Mark purchase ordered?"
        message={`${t('Marking purchase')} ${purchase.code} ${t('ordered records the order with the supplier.')}`}
        confirmText="Mark ordered"
        tone="primary"
        onClose={() => setPendingStatus(null)}
        onConfirm={() => changeStatus('ORDERED')}
      />
      <ConfirmDialog
        open={pendingStatus === 'CANCELLED'}
        title="Cancel purchase?"
        message={`${t('Cancel')} ${purchase.code}? ${t('The original amount remains in history but will not count as supplier outstanding.')}`}
        confirmText="Cancel purchase"
        tone="danger"
        onClose={() => setPendingStatus(null)}
        onConfirm={() => changeStatus('CANCELLED')}
      />

      {!isOwner ? (
        <p className={styles.viewerNote} role="note"><T>
          You are viewing this purchase as</T>{' '}
          <strong>{role || 'guest'}</strong><T>. Mutations are owner-only.
        </T></p>
      ) : null}

      <p className={styles.audit}><T>
        Created </T>{timeAgo(purchase.createdAt)}<T> by </T>{purchase.createdBy || 'unknown'}{' '}<T>
        · Updated </T>{timeAgo(purchase.updatedAt)}<T> by</T>{' '}
        {purchase.updatedBy || 'unknown'}
        <PurchaseIcon
          size={14}
          strokeWidth={1.5}
          className={styles.auditIcon}
          aria-hidden="true"
        />
      </p>
    </main>
  );
}
