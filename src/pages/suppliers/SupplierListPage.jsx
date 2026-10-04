import T from '../../components/common/LocalizedText.jsx';
/**
 * SupplierListPage — Phase 9.
 *
 * Owner-only. Premium card grid for the supplier directory with:
 *   - search across supplier code / name / contact / phone
 *   - status filter pills (all / active / inactive) with counts
 *   - per-card purchase totals (purchases / paid / due)
 *   - "Add supplier" CTA opens inline creation form
 *   - supplier-payment ledger summary on each card
 *
 * Clicking a card opens the supplier detail page.
 */
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import {
  Button,
  Card,
  EmptyState,
  FormField,
  Input,
  PageHeader,
  SearchInput,
  Spinner,
  Textarea,
} from '../../components/common/index.js';
import { SupplierIcon } from '../../components/icons/DashboardIcon.jsx';
import { useAuth } from '../../hooks/useAuth.js';
import { useLocale } from '../../contexts/LocaleContext.jsx';
import {
  createSupplier,
  getSuppliers,
} from '../../services/suppliers/supplierService.js';
import { getPurchases } from '../../services/purchases/purchaseService.js';
import { computeSupplierTotals } from '../../services/suppliers/supplierService.js';
import { formatCompact, formatCount, formatCurrency, timeAgo } from '../../utils/format.js';
import styles from './SupplierListPage.module.css';

export default function SupplierListPage() {
  const { t } = useLocale();
  const { user, role } = useAuth();
  const isOwner = role === 'OWNER';
  const navigate = useNavigate();

  const [suppliers, setSuppliers] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const [formOpen, setFormOpen] = useState(false);
  const [submitBusy, setSubmitBusy] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [draft, setDraft] = useState({
    name: '',
    contactPerson: '',
    phone: '',
    email: '',
    address: '',
    notes: '',
  });

  function reload() {
    setLoading(true);
    Promise.all([getSuppliers(), getPurchases()])
      .then(([s, p]) => {
        setSuppliers(s);
        setPurchases(p);
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    reload();
  }, []);

  const totalsBySupplier = useMemo(() => {
    const map = new Map();
    for (const s of suppliers) {
      map.set(
        s.id,
        computeSupplierTotals(s, purchases),
      );
    }
    return map;
  }, [suppliers, purchases]);

  const counts = useMemo(() => {
    const c = { all: suppliers.length, active: 0, inactive: 0 };
    for (const s of suppliers) {
      if (s.isActive) c.active += 1;
      else c.inactive += 1;
    }
    return c;
  }, [suppliers]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return suppliers.filter((s) => {
      if (statusFilter === 'active' && !s.isActive) return false;
      if (statusFilter === 'inactive' && s.isActive) return false;
      if (!q) return true;
      return (
        s.name.toLowerCase().includes(q) ||
        (s.contactPerson || '').toLowerCase().includes(q) ||
        (s.phone || '').toLowerCase().includes(q) ||
        (s.supplierCode || '').toLowerCase().includes(q)
      );
    });
  }, [suppliers, query, statusFilter]);

  function updateDraft(field, value) {
    setDraft((d) => ({ ...d, [field]: value }));
  }

  function resetDraft() {
    setDraft({
      name: '',
      contactPerson: '',
      phone: '',
      email: '',
      address: '',
      notes: '',
    });
    setSubmitError('');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitBusy(true);
    setSubmitError('');
    try {
      await createSupplier(
        {
          name: draft.name,
          contactPerson: draft.contactPerson,
          phone: draft.phone,
          email: draft.email,
          address: draft.address,
          notes: draft.notes,
        },
        { actor: { username: user?.username || 'unknown', role } },
      );
      resetDraft();
      setFormOpen(false);
      reload();
    } catch (err_) {
      setSubmitError(err_?.message || 'Could not create supplier.');
    } finally {
      setSubmitBusy(false);
    }
  }

  if (loading) {
    return (
      <main className={styles.page} aria-busy="true">
        <div className={styles.loading}>
          <Spinner /> <span><T>Loading suppliers…</T></span>
        </div>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <PageHeader
        eyebrow="Procurement"
        title="Suppliers"
        description="Vendor directory with purchase totals and payment history."
        actions={
          isOwner && !formOpen ? (
            <Button variant="primary" onClick={() => setFormOpen(true)}><T>
              + Add supplier
            </T></Button>
          ) : null
        }
      />

      {isOwner && formOpen && (
        <Card className={styles.formCard}>
          <h2 className={styles.formTitle}><T>New supplier</T></h2>
          <form className={styles.form} onSubmit={handleSubmit}>
            {submitError && (
              <p className={styles.formError} role="alert">
                <T>{submitError}</T>
              </p>
            )}
            <div className={styles.row}>
              <FormField label="Name" htmlFor="supplier-name" required>
                {(controlProps) => (
                  <Input
                    {...controlProps}
                    value={draft.name}
                    onChange={(e) => updateDraft('name', e.target.value)}
                    placeholder="e.g. Aarong Fabrics"
                    required
                  />
                )}
              </FormField>
              <FormField label="Contact person" htmlFor="supplier-contact">
                {(controlProps) => (
                  <Input
                    {...controlProps}
                    value={draft.contactPerson}
                    onChange={(e) => updateDraft('contactPerson', e.target.value)}
                    placeholder="Owner / manager name"
                  />
                )}
              </FormField>
              <FormField label="Phone" htmlFor="supplier-phone" required>
                {(controlProps) => (
                  <Input
                    {...controlProps}
                    value={draft.phone}
                    onChange={(e) => updateDraft('phone', e.target.value)}
                    placeholder="+8801XXXXXXXXX"
                    required
                  />
                )}
              </FormField>
            </div>
            <div className={styles.row}>
              <FormField label="Email" htmlFor="supplier-email">
                {(controlProps) => (
                  <Input
                    {...controlProps}
                    type="email"
                    value={draft.email}
                    onChange={(e) => updateDraft('email', e.target.value)}
                    placeholder="optional"
                  />
                )}
              </FormField>
              <FormField label="Notes" htmlFor="supplier-notes">
                {(controlProps) => (
                  <Input
                    {...controlProps}
                    value={draft.notes}
                    onChange={(e) => updateDraft('notes', e.target.value)}
                    placeholder="optional"
                  />
                )}
              </FormField>
            </div>
            <FormField label="Address" htmlFor="supplier-address">
              {(controlProps) => (
                <Textarea
                  {...controlProps}
                  rows={2}
                  value={draft.address}
                  onChange={(e) => updateDraft('address', e.target.value)}
                  placeholder="optional"
                />
              )}
            </FormField>
            <div className={styles.formActions}>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setFormOpen(false);
                  resetDraft();
                }}
                disabled={submitBusy}
              ><T>
                Cancel
              </T></Button>
              <Button type="submit" variant="primary" disabled={submitBusy}>
                {submitBusy ? 'Saving…' : 'Save supplier'}
              </Button>
            </div>
          </form>
        </Card>
      )}

      <Card className={styles.controlsCard}>
        <div className={styles.searchRow}>
          <SearchInput
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by code, name or phone…"
            className={styles.searchInput}
          />
          <div className={styles.filterRow}>
            {[
              { id: 'all', label: 'All', count: counts.all },
              { id: 'active', label: 'Active', count: counts.active },
              { id: 'inactive', label: 'Inactive', count: counts.inactive },
            ].map((opt) => (
              <button
                key={opt.id}
                type="button"
                className={
                  statusFilter === opt.id
                    ? `${styles.filterPill} ${styles.filterPillActive}`
                    : styles.filterPill
                }
                onClick={() => setStatusFilter(opt.id)}
              >
                {t(opt.label)}
                <span className={styles.filterCount}>{opt.count}</span>
              </button>
            ))}
          </div>
        </div>
      </Card>

      {filtered.length === 0 ? (
        <EmptyState
          title={
            suppliers.length === 0
              ? 'No suppliers yet'
              : 'No suppliers match your filters'
          }
          description={
            suppliers.length === 0
              ? 'Add your first supplier to start tracking purchases and dues.'
              : 'Try a different search or status filter.'
          }
          action={
            isOwner && suppliers.length === 0 ? (
              <Button variant="primary" onClick={() => setFormOpen(true)}><T>
                + Add supplier
              </T></Button>
            ) : null
          }
        />
      ) : (
        <ul className={styles.grid}>
          {filtered.map((s) => {
            const totals = totalsBySupplier.get(s.id) || {
              purchasesTotal: 0,
              paidTotal: 0,
              dueTotal: 0,
              purchaseCount: 0,
            };
            return (
              <li key={s.id}>
                <Link
                  to={`/suppliers/${s.id}`}
                  className={styles.card}
                  onClick={(e) => {
                    // Allow normal navigation but pre-cache detail when clicked
                    e.stopPropagation();
                  }}
                >
                  <div className={styles.cardHead}>
                    <div className={styles.iconWrap}>
                      <SupplierIcon size={20} strokeWidth={1.7} />
                    </div>
                    <div className={styles.cardHeadText}>
                      <span className={styles.cardName}>{s.name}</span>
                      <span className={styles.metaLine}>
                        {s.contactPerson || t('No contact person')}
                      </span>
                    </div>
                    <div
                      className={
                        s.isActive
                          ? `${styles.statusDot} ${styles.dotActive}`
                          : `${styles.statusDot} ${styles.dotInactive}`
                      }
                      title={t(s.isActive ? 'Active' : 'Inactive')}
                      aria-label={t(s.isActive ? 'Active' : 'Inactive')}
                    />
                  </div>

                  <div className={styles.metaRow}>
                    <span className={styles.metaText}>{s.phone}</span>
                  </div>

                  <div className={styles.totalsRow}>
                    <div className={styles.totalCell}>
                      <span className={styles.totalLabel}><T>Purchases</T></span>
                      <span className={styles.totalValue}>
                        {formatCurrency(totals.purchasesTotal)}
                      </span>
                      <span className={styles.totalSub}>
                        {formatCount(totals.purchaseCount, 'order', 'orders', 'অর্ডার')}
                      </span>
                    </div>
                    <div className={styles.totalCell}>
                      <span className={styles.totalLabel}><T>Paid</T></span>
                      <span className={styles.totalValue}>
                        {formatCurrency(totals.paidTotal)}
                      </span>
                    </div>
                    <div
                      className={
                        totals.dueTotal > 0
                          ? `${styles.totalCell} ${styles.totalCellDue}`
                          : styles.totalCell
                      }
                    >
                      <span className={styles.totalLabel}><T>Due</T></span>
                      <span className={styles.totalValue}>
                        {formatCurrency(totals.dueTotal)}
                      </span>
                      {totals.dueTotal > 0 && (
                        <span className={styles.dueBadge}>
                          {formatCompact(totals.dueTotal)}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className={styles.cardFooter}>
                    <span className={styles.footerMeta}><T>
                      Updated </T>{timeAgo(s.updatedAt)}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={(e) => {
                        e.preventDefault();
                        navigate(`/suppliers/${s.id}`);
                      }}
                    ><T>
                      Open →
                    </T></Button>
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
