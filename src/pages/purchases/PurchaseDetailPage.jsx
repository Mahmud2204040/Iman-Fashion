/**
 * PurchaseDetailPage — Phase 9.
 *
 * Owner-only. Single-purchase view:
 *   - Header: code + supplier + status badge
 *   - Summary: total / paid / due, dates (ordered, expected, received)
 *   - Line items table
 *   - Payments ledger (paired CASH_OUT id shown)
 *   - Notes section (editable for DRAFT/ORDERED; locked for terminal)
 *   - Status transition actions (DRAFT → ORDERED → RECEIVED, any → CANCELLED)
 *   - Receipt upload (mock: stores a data URL on the record)
 *   - Back-link to /purchases list
 *
 * Per PROJECT_RULES:
 *   - Supplier payments NEVER auto-create shop-cash CASH_OUT.
 *     We surface the paired row id only for the record.
 *   - Only OWNER can perform mutations; mutations reject during
 *     smoke/internal guards even if a non-owner reaches the UI.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';

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

const PAYMENT_METHODS = ['CASH', 'BKASH', 'BANK', 'CHEQUE'];

function paymentsTotal(payments) {
  return (payments || []).reduce((s, p) => s + Number(p.amount || 0), 0);
}

export default function PurchaseDetailPage() {
  const { id } = useParams();
  const { user, role } = useAuth();
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
  const [payMethod, setPayMethod] = useState('CASH');
  const [payNote, setPayNote] = useState('');
  const [payBusy, setPayBusy] = useState(false);
  const [payMsg, setPayMsg] = useState('');
  const [payErr, setPayErr] = useState('');

  // Receipt upload (mock)
  const fileInputRef = useRef(null);
  const [receiptBusy, setReceiptBusy] = useState(false);
  const [receiptMsg, setReceiptMsg] = useState('');

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
        (row.cashOutId || '').toLowerCase().includes(q),
    );
  }, [purchase, paymentQuery]);

  const remaining = useMemo(() => {
    if (!purchase) return 0;
    const paid = paymentsTotal(purchase.payments);
    return Math.max(Number(purchase.total || 0) - paid, 0);
  }, [purchase]);

  if (loading) {
    return (
      <main className={styles.page} aria-busy="true">
        <div className={styles.loading}>
          <Spinner /> <span>Loading purchase…</span>
        </div>
      </main>
    );
  }

  if (error === 'not-found' || !purchase) {
    return <Navigate to="/purchases" replace />;
  }

  const isTerminal = purchase.status === 'RECEIVED' || purchase.status === 'CANCELLED';
  const canRecordPayment = isOwner && !isTerminal && remaining > 0;
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
          method: payMethod,
          note: payNote,
        },
        { actor: { username: user?.username || 'unknown', role } },
      );
      setPurchase(result.purchase);
      setPayAmount('');
      setPayNote('');
      setPayMsg(
        result.pairedCashOut
          ? `Recorded · paired CASH_OUT ${result.pairedCashOut.id}`
          : 'Recorded.',
      );
    } catch (err_) {
      setPayErr(err_?.message || 'Could not record payment.');
    } finally {
      setPayBusy(false);
    }
  }

  async function handleReceiptFile(file) {
    if (!file) return;
    setReceiptBusy(true);
    setReceiptMsg('');
    try {
      // Mock upload — read as data URL so preview-only state is persisted.
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(reader.error || new Error('Read failed'));
        reader.onload = () => resolve(String(reader.result || ''));
        reader.readAsDataURL(file);
      });
      const updated = await attachPurchaseReceipt(
        purchase.id,
        dataUrl,
        { actor: { username: user?.username || 'unknown', role } },
      );
      if (updated) {
        setPurchase(updated);
        setReceiptMsg(`Attached ${file.name}`);
      }
    } catch (err_) {
      setReceiptMsg(err_?.message || 'Could not attach receipt.');
    } finally {
      setReceiptBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  function onReceiptChange(e) {
    const file = e.target.files?.[0];
    handleReceiptFile(file);
  }

  /* ------------------------------ UI ----------------------------------- */

  return (
    <main className={styles.page}>
      <Link to="/purchases" className={styles.backLink}>
        ← All purchases
      </Link>

      <PageHeader
        eyebrow="Procurement"
        title={purchase.code}
        description={`${purchase.supplierName} · ordered ${timeAgo(purchase.orderedAt)}`}
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
          <span className={styles.totalLabel}>Total</span>
          <span className={styles.totalValue}>
            {formatCurrency(totals?.total || 0)}
          </span>
          <span className={styles.totalSub}>
            {purchase.items.length} item
            {purchase.items.length === 1 ? '' : 's'}
          </span>
        </div>
        <span className={styles.divider} aria-hidden="true" />
        <div className={styles.totalBlock}>
          <span className={styles.totalLabel}>Paid</span>
          <span className={`${styles.totalValue} ${styles.totalPaid}`}>
            {formatCurrency(totals?.paidTotal || 0)}
          </span>
          <span className={styles.totalSub}>
            {purchase.payments.length} payment
            {purchase.payments.length === 1 ? '' : 's'}
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
          <span className={styles.totalLabel}>Outstanding</span>
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
            <span className={styles.dueChip}>Action needed</span>
          ) : (
            <span className={styles.totalSub}>Cleared</span>
          )}
        </div>
      </Card>

      {/* --- Dates ----------------------------------------------- */}
      <Card className={styles.datesCard}>
        <div className={styles.dateBlock}>
          <span className={styles.dateLabel}>Ordered</span>
          <span className={styles.dateValue}>
            {timeAgo(purchase.orderedAt)}
          </span>
          <span className={styles.dateSub}>
            {new Date(purchase.orderedAt).toLocaleString()}
          </span>
        </div>
        <span className={styles.divider} aria-hidden="true" />
        <div className={styles.dateBlock}>
          <span className={styles.dateLabel}>Expected</span>
          <span className={styles.dateValue}>
            {purchase.expectedAt
              ? new Date(purchase.expectedAt).toLocaleDateString()
              : '—'}
          </span>
          <span className={styles.dateSub}>
            {purchase.expectedAt ? 'target arrival' : 'no ETA set'}
          </span>
        </div>
        <span className={styles.divider} aria-hidden="true" />
        <div className={styles.dateBlock}>
          <span className={styles.dateLabel}>Received</span>
          <span className={styles.dateValue}>
            {purchase.receivedAt
              ? new Date(purchase.receivedAt).toLocaleDateString()
              : '—'}
          </span>
          <span className={styles.dateSub}>
            {purchase.receivedAt ? 'stocked' : 'pending'}
          </span>
        </div>
      </Card>

      {/* --- Line items ------------------------------------------ */}
      <Card className={styles.sectionCard}>
        <div className={styles.sectionHead}>
          <h2 className={styles.sectionTitle}>Line items</h2>
          <span className={styles.sectionMeta}>
            {purchase.items.length} line
            {purchase.items.length === 1 ? '' : 's'}
          </span>
        </div>
        {purchase.items.length === 0 ? (
          <p className={styles.emptyText}>No line items on this purchase.</p>
        ) : (
          <ul className={styles.itemsList}>
            {purchase.items.map((it) => (
              <li key={it.id} className={styles.itemRow}>
                <div className={styles.itemMain}>
                  <span className={styles.itemName}>{it.name}</span>
                  <span className={styles.itemMeta}>
                    qty {it.qty} × {formatCurrency(it.unitPrice)}
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
          <h2 className={styles.sectionTitle}>Payments</h2>
          <span className={styles.sectionMeta}>
            paired CASH_OUT track only · never moves shop cash
          </span>
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
            <FormField label="Method" htmlFor="pay-method">
              <Select
                id="pay-method"
                value={payMethod}
                onChange={(e) => setPayMethod(e.target.value)}
              >
                {PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </Select>
            </FormField>
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
              >
                Record payment
              </Button>
            </div>
            {payErr ? (
              <p className={styles.payErr} role="alert">
                {payErr}
              </p>
            ) : null}
            {payMsg ? (
              <p className={styles.payMsg} role="status">
                {payMsg}
              </p>
            ) : null}
          </form>
        ) : null}

        <FormField label="Search payments" hideLabel>
          <SearchInput
            value={paymentQuery}
            onChange={setPaymentQuery}
            placeholder="Search by method, note, or cash-out id…"
          />
        </FormField>

        {visiblePayments.length === 0 ? (
          <p className={styles.emptyText}>
            {(purchase.payments || []).length === 0
              ? 'No payments recorded yet.'
              : 'No payments match the filter.'}
          </p>
        ) : (
          <ol className={styles.paymentList}>
            {visiblePayments.map((row) => (
              <li key={row.id} className={styles.paymentRow}>
                <div className={styles.paymentLeft}>
                  <span className={styles.paymentMethod}>
                    {row.method || 'CASH'}
                  </span>
                  <span className={styles.paymentMeta}>
                    {timeAgo(row.createdAt)} · by {row.createdBy || 'unknown'}
                    {row.cashOutId ? (
                      <>
                        {' · paired '}
                        <code className={styles.codeChip}>{row.cashOutId}</code>
                      </>
                    ) : null}
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
            <h2 className={styles.sectionTitle}>Internal notes</h2>
            <span className={styles.sectionMeta}>
              {canEditNotes
                ? 'Visible to all owners.'
                : 'Locked — purchase is received or cancelled.'}
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
                {notesMsg}
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
            <h2 className={styles.sectionTitle}>Change status</h2>
            <span className={styles.sectionMeta}>
              DRAFT → ORDERED → RECEIVED; or cancel.
            </span>
          </div>
          <div className={styles.actionRow}>
            {purchase.status === 'DRAFT' ? (
              <Button
                variant="primary"
                onClick={() => setPendingStatus('ORDERED')}
              >
                Mark ordered
              </Button>
            ) : null}
            {purchase.status === 'ORDERED' ? (
              <Button
                variant="primary"
                onClick={() => setPendingStatus('RECEIVED')}
              >
                Mark received
              </Button>
            ) : null}
            <Button
              variant="ghost"
              onClick={() => setPendingStatus('CANCELLED')}
            >
              Cancel purchase
            </Button>
          </div>
        </Card>
      ) : null}

      {canAttachReceipt ? (
        <Card className={styles.sectionCard}>
          <div className={styles.sectionHead}>
            <h2 className={styles.sectionTitle}>Receipt</h2>
            <span className={styles.sectionMeta}>
              {purchase.receiptUrl
                ? 'Attached · click replace to update.'
                : 'No receipt attached yet.'}
            </span>
          </div>
          {purchase.receiptUrl ? (
            <div className={styles.receiptPreview}>
              <img
                src={purchase.receiptUrl}
                alt={`Receipt for ${purchase.code}`}
                className={styles.receiptImage}
              />
            </div>
          ) : null}
          <div className={styles.receiptActions}>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={onReceiptChange}
              className={styles.fileInput}
              aria-label="Attach receipt"
            />
            <Button
              variant="secondary"
              onClick={() => fileInputRef.current?.click()}
              disabled={receiptBusy}
            >
              {purchase.receiptUrl
                ? receiptBusy
                  ? 'Replacing…'
                  : 'Replace receipt'
                : receiptBusy
                ? 'Attaching…'
                : 'Attach receipt'}
            </Button>
            {receiptMsg ? (
              <span className={styles.receiptMsg} role="status">
                {receiptMsg}
              </span>
            ) : null}
          </div>
        </Card>
      ) : null}

      <ConfirmDialog
        open={pendingStatus === 'RECEIVED'}
        title="Mark purchase received?"
        message={`Marking ${purchase.code} received locks the purchase. Notes and items cannot be edited after this.`}
        confirmText="Mark received"
        tone="primary"
        onClose={() => setPendingStatus(null)}
        onConfirm={() => changeStatus('RECEIVED')}
      />
      <ConfirmDialog
        open={pendingStatus === 'ORDERED'}
        title="Mark purchase ordered?"
        message={`Marking ${purchase.code} ordered records the order with the supplier.`}
        confirmText="Mark ordered"
        tone="primary"
        onClose={() => setPendingStatus(null)}
        onConfirm={() => changeStatus('ORDERED')}
      />
      <ConfirmDialog
        open={pendingStatus === 'CANCELLED'}
        title="Cancel purchase?"
        message={`Cancelling ${purchase.code} does NOT auto-reverse payments. Manage any outstanding balance manually.`}
        confirmText="Cancel purchase"
        tone="danger"
        onClose={() => setPendingStatus(null)}
        onConfirm={() => changeStatus('CANCELLED')}
      />

      {!isOwner ? (
        <p className={styles.viewerNote} role="note">
          You are viewing this purchase as{' '}
          <strong>{role || 'guest'}</strong>. Mutations are owner-only.
        </p>
      ) : null}

      <p className={styles.audit}>
        Created {timeAgo(purchase.createdAt)} by {purchase.createdBy || 'unknown'}{' '}
        · Updated {timeAgo(purchase.updatedAt)} by{' '}
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
