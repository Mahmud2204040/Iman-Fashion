/**
 * SupplierDetailPage — Phase 9.
 *
 * Owner-only. Shows supplier profile + recent purchase history + payment
 * ledger. Status pill in header. Per Phase 9 spec:
 *   - Receipt image upload (mock — stores data URL only)
 *   - Payments are separate from shop cash; never auto-create a CASH_OUT
 *   - Owner can deactivate (toggle isActive)
 *   - Owner can edit notes
 *
 * The "All supplier payments" section is sourced from
 * getAllSupplierPayments(), each row paired with the supplier-side CASH_OUT.
 */
import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';

import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  FormField,
  PageHeader,
  SearchInput,
  Spinner,
  Textarea,
} from '../../components/common/index.js';
import { SupplierIcon } from '../../components/icons/DashboardIcon.jsx';
import { useAuth } from '../../hooks/useAuth.js';
import {
  computeSupplierTotals,
  getAllSupplierPayments,
  getSupplierById,
  updateSupplier,
} from '../../services/suppliers/supplierService.js';
import { getPurchasesBySupplier } from '../../services/purchases/purchaseService.js';
import { formatCurrency, timeAgo } from '../../utils/format.js';
import styles from './SupplierDetailPage.module.css';

export default function SupplierDetailPage() {
  const { id } = useParams();
  const { user, role } = useAuth();
  const isOwner = role === 'OWNER';

  const [supplier, setSupplier] = useState(null);
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [notesDraft, setNotesDraft] = useState('');
  const [notesBusy, setNotesBusy] = useState(false);
  const [notesMsg, setNotesMsg] = useState('');

  const [confirmDeactivate, setConfirmDeactivate] = useState(false);
  const [confirmReactivate, setConfirmReactivate] = useState(false);

  const [paymentFilter, setPaymentFilter] = useState('');

  function reload() {
    setLoading(true);
    setError('');
    Promise.all([getSupplierById(id), getPurchasesBySupplier(id)])
      .then(([s, p]) => {
        if (!s) {
          setError('not-found');
          setSupplier(null);
          return;
        }
        setSupplier(s);
        setPurchases(p);
        setNotesDraft(s.notes || '');
      })
      .catch((err_) => setError(err_?.message || 'Could not load supplier.'))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const totals = useMemo(() => {
    if (!supplier) return null;
    return computeSupplierTotals(supplier, purchases);
  }, [supplier, purchases]);

  const allPayments = useMemo(() => {
    return getAllSupplierPayments(purchases);
  }, [purchases]);

  const filteredPayments = useMemo(() => {
    const q = paymentFilter.trim().toLowerCase();
    if (!q) return allPayments;
    return allPayments.filter(
      (row) =>
        (row.purchaseCode || '').toLowerCase().includes(q) ||
        (row.note || '').toLowerCase().includes(q) ||
        (row.method || '').toLowerCase().includes(q),
    );
  }, [allPayments, paymentFilter]);

  if (loading) {
    return (
      <main className={styles.page} aria-busy="true">
        <div className={styles.loading}>
          <Spinner /> <span>Loading supplier…</span>
        </div>
      </main>
    );
  }

  if (error === 'not-found' || !supplier) {
    return <Navigate to="/suppliers" replace />;
  }

  async function saveNotes() {
    setNotesBusy(true);
    setNotesMsg('');
    try {
      const updated = await updateSupplier(
        supplier.id,
        { notes: notesDraft },
        { actor: { username: user?.username || 'unknown', role } },
      );
      setSupplier(updated);
      setNotesMsg('Notes saved.');
    } catch (err_) {
      setNotesMsg(err_?.message || 'Could not save notes.');
    } finally {
      setNotesBusy(false);
    }
  }

  async function toggleStatus(nextActive) {
    const updated = await updateSupplier(
      supplier.id,
      { isActive: nextActive },
      { actor: { username: user?.username || 'unknown', role } },
    );
    setSupplier(updated);
    setConfirmDeactivate(false);
    setConfirmReactivate(false);
  }

  return (
    <main className={styles.page}>
      <Link to="/suppliers" className={styles.backLink}>
        ← All suppliers
      </Link>

      <PageHeader
        eyebrow={supplier.category || 'Supplier'}
        title={supplier.name}
        description={`${supplier.contactPerson || 'No contact'} · ${supplier.phone}`}
        actions={
          <div className={styles.headerActions}>
            <Badge tone={supplier.isActive ? 'success' : 'neutral'}>
              {supplier.isActive ? 'Active' : 'Inactive'}
            </Badge>
            {isOwner &&
              (supplier.isActive ? (
                <Button
                  variant="ghost"
                  onClick={() => setConfirmDeactivate(true)}
                >
                  Deactivate
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  onClick={() => setConfirmReactivate(true)}
                >
                  Reactivate
                </Button>
              ))}
          </div>
        }
      />

      <div className={styles.summary}>
        <Card className={styles.profileCard}>
          <div className={styles.profileHead}>
            <div className={styles.iconWrap}>
              <SupplierIcon size={22} strokeWidth={1.7} />
            </div>
            <div className={styles.profileText}>
              <h2 className={styles.profileTitle}>Profile</h2>
              <span className={styles.profileMeta}>
                Added {timeAgo(supplier.createdAt)} ·{' '}
                {purchases.length} purchase
                {purchases.length === 1 ? '' : 's'} on record
              </span>
            </div>
          </div>
          <dl className={styles.fieldsList}>
            <div className={styles.fieldRow}>
              <dt>Contact</dt>
              <dd>{supplier.contactPerson || '—'}</dd>
            </div>
            <div className={styles.fieldRow}>
              <dt>Phone</dt>
              <dd className={styles.mono}>{supplier.phone}</dd>
            </div>
            <div className={styles.fieldRow}>
              <dt>Email</dt>
              <dd>{supplier.email || '—'}</dd>
            </div>
            <div className={styles.fieldRow}>
              <dt>Address</dt>
              <dd>{supplier.address || '—'}</dd>
            </div>
          </dl>
        </Card>

        <Card className={styles.totalsCard}>
          <div className={styles.totalBlock}>
            <span className={styles.totalLabel}>Purchases</span>
            <span className={styles.totalValue}>
              {formatCurrency(totals?.purchasesTotal || 0)}
            </span>
            <span className={styles.totalSub}>
              across {totals?.purchaseCount || 0} purchase
              {(totals?.purchaseCount || 0) === 1 ? '' : 's'}
            </span>
          </div>
          <div className={styles.divider} />
          <div className={styles.totalBlock}>
            <span className={styles.totalLabel}>Paid</span>
            <span className={styles.totalValuePaid}>
              {formatCurrency(totals?.paidTotal || 0)}
            </span>
          </div>
          <div className={styles.divider} />
          <div
            className={
              (totals?.dueTotal || 0) > 0
                ? `${styles.totalBlock} ${styles.totalBlockDue}`
                : styles.totalBlock
            }
          >
            <span className={styles.totalLabel}>Due</span>
            <span
              className={
                (totals?.dueTotal || 0) > 0
                  ? `${styles.totalValue} ${styles.totalValueDue}`
                  : styles.totalValue
              }
            >
              {formatCurrency(totals?.dueTotal || 0)}
            </span>
            {(totals?.dueTotal || 0) > 0 && (
              <span className={styles.dueChip}>Outstanding</span>
            )}
          </div>
        </Card>
      </div>

      {isOwner && (
        <Card className={styles.notesCard}>
          <div className={styles.sectionHead}>
            <h2 className={styles.sectionTitle}>Internal notes</h2>
            <span className={styles.sectionMeta}>
              Visible to all owners.
            </span>
          </div>
          <Textarea
            rows={3}
            value={notesDraft}
            onChange={(e) => setNotesDraft(e.target.value)}
            placeholder="Add notes about this supplier — payment terms, lead times, etc."
          />
          <div className={styles.notesFooter}>
            {notesMsg && (
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
            )}
            <Button
              variant="primary"
              disabled={notesBusy}
              onClick={saveNotes}
            >
              {notesBusy ? 'Saving…' : 'Save notes'}
            </Button>
          </div>
        </Card>
      )}

      <Card className={styles.sectionCard}>
        <div className={styles.sectionHead}>
          <h2 className={styles.sectionTitle}>Purchases</h2>
          <span className={styles.sectionMeta}>
            {purchases.length} purchase{purchases.length === 1 ? '' : 's'}
          </span>
        </div>
        {purchases.length === 0 ? (
          <p className={styles.emptyText}>
            No purchases yet for this supplier.
          </p>
        ) : (
          <ul className={styles.purchaseList}>
            {purchases.map((p) => (
              <li key={p.id} className={styles.purchaseRow}>
                <Link
                  to={`/purchases/${p.id}`}
                  className={styles.purchaseLink}
                >
                  <div className={styles.purchaseLeft}>
                    <span className={styles.purchaseCode}>{p.code}</span>
                    <span className={styles.purchaseMeta}>
                      {p.items.length} item
                      {p.items.length === 1 ? '' : 's'} · ordered{' '}
                      {timeAgo(p.orderedAt)}
                    </span>
                  </div>
                  <Badge
                    tone={
                      p.status === 'RECEIVED'
                        ? 'success'
                        : p.status === 'CANCELLED'
                        ? 'danger'
                        : p.status === 'ORDERED'
                        ? 'info'
                        : 'neutral'
                    }
                  >
                    {p.status}
                  </Badge>
                  <div className={styles.purchaseRight}>
                    <span className={styles.purchaseTotal}>
                      {formatCurrency(p.total)}
                    </span>
                    <span className={styles.purchaseDue}>
                      Due {formatCurrency(Math.max(p.total - p.paidTotal, 0))}
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className={styles.sectionCard}>
        <div className={styles.sectionHead}>
          <h2 className={styles.sectionTitle}>Payments to this supplier</h2>
          <span className={styles.sectionMeta}>
            {allPayments.length} record
            {allPayments.length === 1 ? '' : 's'} · paired CASH_OUT track only
          </span>
        </div>
        <FormField label="Search payments" hideLabel>
          <SearchInput
            value={paymentFilter}
            onChange={setPaymentFilter}
            placeholder="Search by purchase code, method, or note…"
          />
        </FormField>
        {filteredPayments.length === 0 ? (
          <p className={styles.emptyText}>
            {allPayments.length === 0
              ? 'No payments recorded yet.'
              : 'No payments match the filter.'}
          </p>
        ) : (
          <ol className={styles.paymentList}>
            {filteredPayments.map((row) => (
              <li key={row.id} className={styles.paymentRow}>
                <div className={styles.paymentLeft}>
                  <span className={styles.paymentCode}>
                    {row.purchaseCode}
                  </span>
                  <span className={styles.paymentMeta}>
                    {row.method || 'CASH'} · {timeAgo(row.createdAt)}{' '}
                    {row.cashOutId ? (
                      <>
                        · paired{' '}
                        <code className={styles.cashOutId}>
                          {row.cashOutId}
                        </code>
                      </>
                    ) : null}
                  </span>
                  {row.note && (
                    <span className={styles.paymentNote}>{row.note}</span>
                  )}
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

      <ConfirmDialog
        open={confirmDeactivate}
        title="Deactivate supplier?"
        message={`Deactivating "${supplier.name}" hides them from new purchases. Existing purchase history is preserved.`}
        confirmText="Deactivate"
        tone="danger"
        onClose={() => setConfirmDeactivate(false)}
        onConfirm={() => toggleStatus(false)}
      />
      <ConfirmDialog
        open={confirmReactivate}
        title="Reactivate supplier?"
        message={`Reactivating "${supplier.name}" makes them available again in the purchase flow.`}
        confirmText="Reactivate"
        onClose={() => setConfirmReactivate(false)}
        onConfirm={() => toggleStatus(true)}
      />
    </main>
  );
}