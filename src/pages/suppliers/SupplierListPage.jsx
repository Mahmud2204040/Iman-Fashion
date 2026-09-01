/**
 * SupplierListPage — Phase 9.
 *
 * Owner-only. Premium card grid for the supplier directory with:
 *   - search across name / contact / phone / category
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
import {
  createSupplier,
  getSuppliers,
} from '../../services/suppliers/supplierService.js';
import { getPurchases } from '../../services/purchases/purchaseService.js';
import { computeSupplierTotals } from '../../services/suppliers/supplierService.js';
import { formatCompact, formatCurrency, timeAgo } from '../../utils/format.js';
import styles from './SupplierListPage.module.css';

export default function SupplierListPage() {
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
    category: '',
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
        (s.category || '').toLowerCase().includes(q)
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
      category: '',
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
          category: draft.category,
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
          <Spinner /> <span>Loading suppliers…</span>
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
            <Button variant="primary" onClick={() => setFormOpen(true)}>
              + Add supplier
            </Button>
          ) : null
        }
      />

      {isOwner && formOpen && (
        <Card className={styles.formCard}>
          <h2 className={styles.formTitle}>New supplier</h2>
          <form className={styles.form} onSubmit={handleSubmit}>
            {submitError && (
              <p className={styles.formError} role="alert">
                {submitError}
              </p>
            )}
            <div className={styles.row}>
              <FormField label="Name" required>
                <Input
                  value={draft.name}
                  onChange={(e) => updateDraft('name', e.target.value)}
                  placeholder="e.g. Aarong Fabrics"
                  required
                />
              </FormField>
              <FormField label="Contact person">
                <Input
                  value={draft.contactPerson}
                  onChange={(e) =>
                    updateDraft('contactPerson', e.target.value)
                  }
                  placeholder="Owner / manager name"
                />
              </FormField>
              <FormField label="Phone" required>
                <Input
                  value={draft.phone}
                  onChange={(e) => updateDraft('phone', e.target.value)}
                  placeholder="+8801XXXXXXXXX"
                  required
                />
              </FormField>
            </div>
            <div className={styles.row}>
              <FormField label="Email">
                <Input
                  type="email"
                  value={draft.email}
                  onChange={(e) => updateDraft('email', e.target.value)}
                  placeholder="optional"
                />
              </FormField>
              <FormField label="Category">
                <Input
                  value={draft.category}
                  onChange={(e) => updateDraft('category', e.target.value)}
                  placeholder="e.g. Fabrics"
                />
              </FormField>
              <FormField label="Updated note">
                <Input
                  value={draft.notes}
                  onChange={(e) => updateDraft('notes', e.target.value)}
                  placeholder="optional"
                />
              </FormField>
            </div>
            <FormField label="Address">
              <Textarea
                rows={2}
                value={draft.address}
                onChange={(e) => updateDraft('address', e.target.value)}
                placeholder="optional"
              />
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
              >
                Cancel
              </Button>
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
            onChange={setQuery}
            placeholder="Search by name, contact, phone, category…"
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
                {opt.label}
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
              <Button variant="primary" onClick={() => setFormOpen(true)}>
                + Add supplier
              </Button>
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
                        {s.contactPerson || 'No contact person'}
                      </span>
                    </div>
                    <div
                      className={
                        s.isActive
                          ? `${styles.statusDot} ${styles.dotActive}`
                          : `${styles.statusDot} ${styles.dotInactive}`
                      }
                      title={s.isActive ? 'Active' : 'Inactive'}
                      aria-label={s.isActive ? 'Active' : 'Inactive'}
                    />
                  </div>

                  <div className={styles.metaRow}>
                    <span className={styles.metaPill}>{s.category}</span>
                    <span className={styles.metaText}>{s.phone}</span>
                  </div>

                  <div className={styles.totalsRow}>
                    <div className={styles.totalCell}>
                      <span className={styles.totalLabel}>Purchases</span>
                      <span className={styles.totalValue}>
                        {formatCurrency(totals.purchasesTotal)}
                      </span>
                      <span className={styles.totalSub}>
                        {totals.purchaseCount} order
                        {totals.purchaseCount === 1 ? '' : 's'}
                      </span>
                    </div>
                    <div className={styles.totalCell}>
                      <span className={styles.totalLabel}>Paid</span>
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
                      <span className={styles.totalLabel}>Due</span>
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
                    <span className={styles.footerMeta}>
                      Updated {timeAgo(s.updatedAt)}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={(e) => {
                        e.preventDefault();
                        navigate(`/suppliers/${s.id}`);
                      }}
                    >
                      Open →
                    </Button>
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