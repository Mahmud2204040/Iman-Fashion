import T from '../../components/common/LocalizedText.jsx';
/**
 * CustomerDetailPage — Phase 6.
 *
 * Tabbed detail view for a single customer. Tabs are:
 *   1. Profile   — base fields + children list (each with derived class) + audit
 *   2. Sales     — completed sales linked to this customer
 *   3. Orders    — custom orders linked to this customer
 *   4. Due       — open sales + open custom orders aggregated
 *
 * Behaviour notes:
 *   - Employees see the full customer history (PROJECT_RULES.md §8).
 *     The hidden-flag hooks (cost / profit / supplier / expense) gate
 *     sub-detail UI on line items — that lives inside sale/order tabs.
 *   - Status toggle is OWNER-only; we never delete customers (per
 *     phase contract — records are preserved for history).
 *   - The bundle loader is the single source of truth for this page;
 *     if any sub-call fails we surface it in an inline warning but keep
 *     the tabs that did load. This matches the "graceful degradation"
 *     pattern Phase 4 established for the dashboard.
 */
import { Fragment, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { Button, EmptyState, Spinner } from '../../components/common/index.js';
import { SaleIcon, CustomOrderIcon } from '../../components/icons/DashboardIcon.jsx';
import { useAuth } from '../../hooks/useAuth.js';
import { useLocale } from '../../contexts/LocaleContext.jsx';
import { shopDate } from '../../utils/customer.js';
import {
  addCustomerChild,
  getCustomerBundle,
  updateCustomer,
  updateCustomerChild,
  setCustomerStatus,
} from '../../services/customers/customerService.js';
import { ROLES } from '../../constants/roles.js';
import { formatCurrency, formatExactDate, formatExactDateTime } from '../../utils/format.js';
import styles from './CustomerDetailPage.module.css';

const TABS = [
  { id: 'profile', label: 'Overview' },
  { id: 'sales', label: 'Sales history' },
  { id: 'orders', label: 'Custom orders' },
  { id: 'due', label: 'Due summary' },
];

function customerActivity(sales, customOrders) {
  return [
    ...(Array.isArray(sales) ? sales.map((sale) => ({
      id: sale.id,
      type: 'Sale',
      code: sale.salesCode,
      total: sale.total,
      createdAt: sale.createdAt,
      to: `/sales/${sale.id}`,
    })) : []),
    ...(Array.isArray(customOrders) ? customOrders.map((order) => ({
      id: order.id,
      type: 'Custom order',
      code: order.code,
      total: order.total,
      createdAt: order.createdAt,
      to: `/custom-orders/${order.id}`,
    })) : []),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export default function CustomerDetailPage() {
  const { id } = useParams();
  const { user, role } = useAuth();
  const { t } = useLocale();

  const [bundle, setBundle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [tab, setTab] = useState('profile');
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileDraft, setProfileDraft] = useState({});
  const [profileBusy, setProfileBusy] = useState(false);
  const editFormRef = useRef(null);

  useEffect(() => {
    if (editingProfile) editFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [editingProfile]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    setBundle(null);

    getCustomerBundle(id)
      .then((data) => {
        if (cancelled) return;
        if (!data) {
          setBundle(null);
          return;
        }
        setBundle(data);
      })
      .catch((err_) => {
        if (cancelled) return;
        setError(err_?.message || 'Could not load customer.');
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) {
    return (
      <main className={styles.page} aria-busy="true">
        <div className={styles.loading}>
          <Spinner /> <span><T>Loading customer…</T></span>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className={styles.page}>
        <p className={styles.error} role="alert">
          <T>{error}</T>
        </p>
        <Link to="/customers" className={styles.backLink}><T>
          ← Back to customers
        </T></Link>
      </main>
    );
  }

  if (!bundle || !bundle.customer) {
    return <main className={styles.page}><p role="alert"><T>Customer not found.</T></p><Link to="/customers"><T>← Back to customers</T></Link></main>;
  }

  const { customer, children, sales, customOrders, dueSummary, errors } =
    bundle;
  const saleRows = Array.isArray(sales) ? sales : [];
  const orderRows = Array.isArray(customOrders) ? customOrders : [];
  const activity = customerActivity(saleRows, orderRows);
  const salesTotal = saleRows.reduce((sum, sale) => sum + Number(sale.total || 0), 0);
  const dueTotal = Number(dueSummary?.totalDue || 0);

  function openProfileEdit() {
    setProfileDraft({ name: customer.name, phone: customer.phone, address: customer.address || '', notes: customer.notes || '' });
    setEditingProfile(true);
  }

  function updateChildren(updater) {
    setBundle((current) => current ? ({ ...current, children: updater(current.children || []) }) : current);
  }

  async function saveProfile(event) {
    event.preventDefault(); setProfileBusy(true); setActionError('');
    try {
      const updated = await updateCustomer(id, profileDraft, { actor: user });
      setBundle((current) => ({ ...current, customer: updated })); setEditingProfile(false);
    } catch (err) { setActionError(err?.message || 'Could not save customer.'); }
    finally { setProfileBusy(false); }
  }

  async function changeStatus() {
    setProfileBusy(true); setActionError('');
    try {
      const updated = await setCustomerStatus(id, !customer.isActive, { actor: user });
      setBundle((current) => ({ ...current, customer: updated }));
    } catch (err) { setActionError(err?.message || 'Could not change status.'); }
    finally { setProfileBusy(false); }
  }

  return (
    <main className={styles.page}>
      <div className={styles.topbar}>
        <Link to="/customers" className={styles.backLink}><T>← All customers</T></Link>
        <div className={styles.topActions}>
          <button type="button" className={styles.actionButton} onClick={editingProfile ? () => setEditingProfile(false) : openProfileEdit}>
            <span aria-hidden="true">✎</span> <T>{editingProfile ? 'Close edit' : 'Edit customer'}</T>
          </button>
          {role === ROLES.OWNER ? (
            <button type="button" className={styles.statusAction} disabled={profileBusy} onClick={changeStatus}>
              <T>{customer.isActive ? 'Deactivate customer' : 'Activate customer'}</T>
            </button>
          ) : null}
        </div>
      </div>
      {actionError ? <p className={styles.error} role="alert"><T>{actionError}</T></p> : null}

      <header className={styles.header}>
        <div className={styles.headerIdentity}>
          <div className={styles.avatar}>
            {String(customer.name || '?').trim().charAt(0).toUpperCase()}
          </div>
          <div className={styles.identityText}>
            <span className={styles.eyebrow}><T>Customer</T></span>
            <h1 className={styles.title}>{customer.name}</h1>
            <p className={styles.meta}>
              {customer.phone || 'No phone on file'}
              {customer.address ? ` · ${customer.address}` : ''}
            </p>
            <div className={styles.identityBadges}>
              {customer.customerCode ? <span className={styles.codeLine}>{customer.customerCode}</span> : null}
              <span className={`${styles.statusBadge} ${customer.isActive ? styles.statusActive : styles.statusInactive}`}>
                <span aria-hidden="true">●</span> <T>{customer.isActive ? 'Active' : 'Inactive'}</T>
              </span>
            </div>
          </div>
        </div>

        <dl className={styles.headerFacts}>
          <div className={styles.fact}>
            <dt><T>Created at</T></dt>
            <dd>{formatExactDate(customer.createdAt)}</dd>
          </div>
          <div className={styles.fact}>
            <dt><T>Updated at</T></dt>
            <dd>{formatExactDate(customer.updatedAt)}</dd>
          </div>
          <div className={styles.fact}>
            <dt><T>Sales</T></dt>
            <dd>{saleRows.length}</dd>
          </div>
          <div className={styles.fact}>
            <dt><T>Sales total</T></dt>
            <dd>{formatCurrency(salesTotal)}</dd>
          </div>
        </dl>
      </header>

      {editingProfile ? (
        <form ref={editFormRef} onSubmit={saveProfile} className={styles.editForm}>
          <div className={styles.editFormHeading}><h2><T>Edit customer</T></h2><button type="button" onClick={() => setEditingProfile(false)} aria-label={t('Close edit')}>×</button></div>
          <div className={styles.editFields}>
            <label><T>Name</T><input required value={profileDraft.name || ''} onChange={(event) => setProfileDraft((current) => ({ ...current, name: event.target.value }))} /></label>
            <label><T>Phone</T><input required value={profileDraft.phone || ''} onChange={(event) => setProfileDraft((current) => ({ ...current, phone: event.target.value }))} /></label>
            <label><T>Address</T><input value={profileDraft.address || ''} onChange={(event) => setProfileDraft((current) => ({ ...current, address: event.target.value }))} /></label>
            <label><T>Notes</T><textarea value={profileDraft.notes || ''} onChange={(event) => setProfileDraft((current) => ({ ...current, notes: event.target.value }))} /></label>
          </div>
          <div className={styles.editActions}><Button type="button" variant="secondary" onClick={() => setEditingProfile(false)}><T>Cancel</T></Button><Button type="submit" disabled={profileBusy}><T>{profileBusy ? 'Saving…' : 'Save changes'}</T></Button></div>
        </form>
      ) : null}

      {Object.keys(errors || {}).length > 0 ? (
        <p className={styles.partialWarn} role="status"><T>
          Some sections could not be loaded. The rest of the page is still
          available.
        </T></p>
      ) : null}

      <nav className={styles.tabbar} aria-label={t('Customer sections')}>
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={[
              styles.tab,
              tab === t.id ? styles.tabActive : '',
            ]
              .filter(Boolean)
              .join(' ')}
            onClick={() => setTab(t.id)}
            aria-current={tab === t.id ? 'page' : undefined}
          >
            <T>{t.label}</T>
            {t.id === 'sales' ? <span className={styles.tabCount}>{saleRows.length}</span> : null}
            {t.id === 'orders' ? <span className={styles.tabCount}>{orderRows.length}</span> : null}
            {t.id === 'due' && dueTotal > 0 ? <span className={styles.tabCount}>{Array.isArray(dueSummary?.openCustomOrders) ? dueSummary.openCustomOrders.length : 0}</span> : null}
          </button>
        ))}
      </nav>

      <section className={styles.panel}>
        {tab === 'profile' ? (
          <>
            <div className={styles.overviewGrid}>
              <div className={styles.overviewMain}>
                <section className={styles.infoCard}>
                  <div className={styles.cardHead}><h2><T>Contact information</T></h2><button type="button" className={styles.smallButton} onClick={openProfileEdit}>✎ <T>Edit</T></button></div>
                  <dl className={styles.contactGrid}>
                    <div><dt><T>Phone</T></dt><dd>{customer.phone || <T>No phone on file</T>}</dd></div>
                    <div><dt><T>Address</T></dt><dd>{customer.address || <T>Not recorded</T>}</dd></div>
                    <div className={styles.contactNotes}><dt><T>Notes</T></dt><dd>{String(customer.notes || '').trim() || <T>No notes recorded.</T>}</dd></div>
                  </dl>
                </section>
                <ProfilePanel children_={children} customerId={customer.id} onChildrenChange={updateChildren} />
              </div>
              <div className={styles.overviewSide}>
                <section className={styles.infoCard}>
                  <div className={styles.cardHead}><h2><T>Order & payment summary</T></h2></div>
                  <div className={styles.summaryGrid}>
                    <div><span><T>Sales</T></span><strong>{saleRows.length}</strong></div>
                    <div><span><T>Sales total</T></span><strong>{formatCurrency(salesTotal)}</strong></div>
                    <div><span><T>Custom orders</T></span><strong>{orderRows.length}</strong></div>
                    <div><span><T>Pending due</T></span><strong>{formatCurrency(dueTotal)}</strong></div>
                  </div>
                </section>
                <AuditCard customer={customer} />
              </div>
            </div>
            <RecentActivity rows={activity.slice(0, 5)} />
          </>
        ) : null}

        {tab === 'sales' ? (
          <SalesPanel sales={sales} role={role} />
        ) : null}

        {tab === 'orders' ? (
          <OrdersPanel orders={customOrders} role={role} />
        ) : null}

        {tab === 'due' ? <DuePanel due={dueSummary} /> : null}
      </section>
    </main>
  );
}

/* ---------- tab panels ---------- */

function AuditCard({ customer }) {
  return (
    <section className={styles.infoCard}>
      <div className={styles.cardHead}><h2><T>Record details</T></h2></div>
      <dl className={styles.auditGrid}>
        <div><dt><T>Created by</T></dt><dd>{customer.createdBy || '—'}</dd></div>
        <div><dt><T>Updated by</T></dt><dd>{customer.updatedBy || '—'}</dd></div>
      </dl>
    </section>
  );
}

function RecentActivity({ rows }) {
  return (
    <section className={styles.infoCard}>
      <div className={styles.cardHead}><h2><T>Recent activity</T></h2></div>
      {rows.length === 0 ? <p className={styles.muted}><T>No recent activity.</T></p> : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead><tr><th><T>Date & time</T></th><th><T>Type</T></th><th><T>Reference</T></th><th><T>Total</T></th><th><T>Action</T></th></tr></thead>
            <tbody>{rows.map((row) => (
              <tr key={`${row.type}-${row.id}`}>
                <td>{formatExactDateTime(row.createdAt)}</td>
                <td><span className={`${styles.activityType} ${row.type === 'Sale' ? styles.saleType : styles.orderType}`}>{row.type === 'Sale' ? <SaleIcon size={14} /> : <CustomOrderIcon size={14} />} <T>{row.type}</T></span></td>
                <td className={styles.mono}>{row.code}</td>
                <td className={styles.strongAmount}>{formatCurrency(row.total)}</td>
                <td><Link to={row.to} className={styles.viewLink}><T>View</T> ↗</Link></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function ProfilePanel({ children_, customerId, onChildrenChange }) {
  // Local kids list so an optimistic add reflects immediately. The next
  // bundle reload (or manual re-fetch) is still source of truth.
  const { user, role } = useAuth();
  const [kids, setKids] = useState(() =>
    Array.isArray(children_) ? children_ : [],
  );
  const [childName, setChildName] = useState('');
  const [childClass, setChildClass] = useState('');
  const [childSchool, setChildSchool] = useState('');
  const [childRegDate, setChildRegDate] = useState(() =>
    shopDate(),
  );
  const [addOpen, setAddOpen] = useState(false);
  const [addBusy, setAddBusy] = useState(false);
  const [addError, setAddError] = useState('');
  const [editChildId, setEditChildId] = useState(null);
  const [editChildDraft, setEditChildDraft] = useState({});
  const [childEditBusy, setChildEditBusy] = useState(false);

  // Re-sync when the parent bundle refreshes (id change or manual reload).
  useEffect(() => {
    setKids(Array.isArray(children_) ? children_ : []);
  }, [children_]);

  function resetAddForm() {
    setChildName('');
    setChildClass('');
    setChildSchool('');
    setChildRegDate(shopDate());
    setAddError('');
  }

  function toggleAdd() {
    setAddOpen((v) => {
      const next = !v;
      if (!next) resetAddForm();
      return next;
    });
  }

  async function handleAddChild(e) {
    e.preventDefault();
    setAddError('');

    const name = String(childName || '').trim();
    if (!name) {
      setAddError('Child name is required.');
      return;
    }
    if (!customerId) {
      setAddError('Missing customer id.');
      return;
    }

    setAddBusy(true);
    try {
      const created = await addCustomerChild(customerId, {
        name, initialClass: childClass, schoolName: childSchool,
        registeredDate: childRegDate,
      }, { actor: { username: user?.username, role } });
      setKids((prev) => [...prev, created]);
      onChildrenChange((current) => [...current, created]);
      resetAddForm();
      setAddOpen(false);
    } catch (err_) {
      setAddError(
        (err_ && err_.message) || 'Could not add child. Please retry.',
      );
    } finally {
      setAddBusy(false);
    }
  }

  async function saveChild(event) {
    event.preventDefault(); setAddError(''); setChildEditBusy(true);
    try {
      const updated = await updateCustomerChild(customerId, editChildId, editChildDraft, { actor: { username: user?.username, role } });
      setKids((current) => current.map((child) => child.id === editChildId ? updated : child));
      onChildrenChange((current) => current.map((child) => child.id === editChildId ? updated : child));
      setEditChildId(null);
    } catch (err) { setAddError(err?.message || 'Could not update child.'); }
    finally { setChildEditBusy(false); }
  }

  return (
    <div className={styles.profileShell}>
      <article className={styles.kidsCard}>
        <header className={styles.kidsCardHead}>
          <div>
            <h2 className={styles.cardTitle}><T>Children</T> <span className={styles.kidsCount}>({kids.length})</span></h2>
          </div>
          <div className={styles.kidsHeadActions}>
            <button type="button" className={styles.smallButton} onClick={toggleAdd} aria-expanded={addOpen} aria-controls="add-child-form">{addOpen ? <T>Cancel</T> : <><span aria-hidden="true">＋</span> <T>Add child</T></>}</button>
          </div>
        </header>

        {addOpen ? (
          <form
            id="add-child-form"
            className={styles.addChildForm}
            onSubmit={handleAddChild}
            noValidate
          >
            <p className={styles.addChildHint}><T>
              Register a new child under this customer. The initial class
              anchors yearly class progression.
            </T></p>

            {addError ? (
              <p className={styles.addChildError} role="alert">
                {addError}
              </p>
            ) : null}

            <div className={styles.addChildGrid}>
              <label className={styles.addChildField}>
                <span className={styles.addChildLabel}><T>Name</T></span>
                <input
                  className={styles.addChildInput}
                  type="text"
                  value={childName}
                  onChange={(e) => setChildName(e.target.value)}
                  placeholder="e.g. Ayesha Tabassum"
                  required
                  minLength={2}
                />
              </label>

              <label className={styles.addChildField}>
                <span className={styles.addChildLabel}><T>Initial class</T></span>
                <input
                  className={styles.addChildInput}
                  type="text"
                  value={childClass}
                  onChange={(e) => setChildClass(e.target.value)}
                  placeholder="e.g. 1 or Nursery"
                  required
                />
              </label>

              <label className={styles.addChildField}>
                <span className={styles.addChildLabel}><T>School</T></span>
                <input
                  className={styles.addChildInput}
                  type="text"
                  value={childSchool}
                  onChange={(e) => setChildSchool(e.target.value)}
                  placeholder="e.g. Banani Bidyaniketan"
                  required
                />
              </label>

              <label className={styles.addChildField}>
                <span className={styles.addChildLabel}><T>Registered date</T></span>
                <input
                  className={styles.addChildInput}
                  type="date"
                  value={childRegDate}
                  onInput={(e) => setChildRegDate(e.currentTarget.value)}
                  onChange={(e) => setChildRegDate(e.target.value)}
                  required
                />
              </label>
            </div>

            <div className={styles.addChildActions}>
              <Button
                type="submit"
                variant="primary"
                disabled={addBusy}
              >
                {addBusy ? 'Adding…' : 'Add child'}
              </Button>
              {kids.length > 0 ? (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={toggleAdd}
                  disabled={addBusy}
                ><T>
                  Cancel
                </T></Button>
              ) : null}
            </div>
          </form>
        ) : null}

        {kids.length > 0 ? (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead><tr><th><T>Name</T></th><th><T>School</T></th><th><T>Class</T></th><th><T>Registered</T></th><th><T>Actions</T></th></tr></thead>
              <tbody>{kids.map((k) => (
                <Fragment key={k.id}>
                  <tr>
                    <td><span className={styles.kidIdentity}><span className={styles.kidAvatar}>{String(k.name || '?').trim().charAt(0).toUpperCase()}</span><strong>{k.name}</strong></span></td>
                    <td>{k.schoolName || '—'}</td>
                    <td><span className={styles.classBadge}><T>Class</T> {k.currentClass || '—'}</span></td>
                    <td>{k.registeredDate ? formatExactDate(k.registeredDate) : '—'}</td>
                    <td><button type="button" className={styles.rowEdit} onClick={() => { setEditChildId(editChildId === k.id ? null : k.id); setEditChildDraft({ name: k.name, initialClass: k.initialClass, schoolName: k.schoolName, registeredDate: k.registeredDate }); }}><T>Edit</T></button></td>
                  </tr>
                  {editChildId === k.id ? <tr><td colSpan={5}><form onSubmit={saveChild} className={styles.childEditForm}>
                    {['name', 'initialClass', 'schoolName', 'registeredDate'].map((field) => <label key={field}>{field.replace(/([A-Z])/g, ' $1')}<input required type={field === 'registeredDate' ? 'date' : 'text'} value={editChildDraft[field] || ''} onChange={(event) => setEditChildDraft((current) => ({ ...current, [field]: event.target.value }))} /></label>)}
                    <div className={styles.editActions}><Button type="submit" size="sm" disabled={childEditBusy}><T>Save</T></Button><Button type="button" variant="secondary" size="sm" onClick={() => setEditChildId(null)}><T>Cancel</T></Button></div>
                  </form></td></tr> : null}
                </Fragment>
              ))}</tbody>
            </table>
          </div>
        ) : <p className={styles.muted}><T>Children added here are linked to this customer and used for school-uniform orders.</T></p>}
      </article>
    </div>
  );
}

function SalesPanel({ sales, role }) {
  if (!Array.isArray(sales) || sales.length === 0) {
    return (
      <EmptyState
        title="No sales yet"
        description="Sales linked to this customer will appear here."
      />
    );
  }
  return (
    <section className={styles.infoCard}>
      <div className={styles.cardHead}><h2><T>Sales history</T></h2></div>
      <div className={styles.tableWrap}><table className={styles.table}>
        <thead>
          <tr>
            <th><T>Code</T></th>
            <th><T>Items</T></th>
            <th><T>Total</T></th>
            <th><T>When</T></th>
            <th><T>Action</T></th>
          </tr>
        </thead>
        <tbody>
          {sales.map((s) => (
            <tr key={s.id}>
              <td className={styles.mono}>{s.salesCode}</td>
              <td>{s.itemCount ?? '—'}</td>
              <td>{formatCurrency(s.total)}</td>
              <td>{formatExactDateTime(s.createdAt)}</td>
              <td><Link to={`/sales/${s.id}`} className={styles.viewLink}><T>View</T> ↗</Link></td>
            </tr>
          ))}
        </tbody>
      </table></div>
      {role === 'EMPLOYEE' ? (
        <p className={styles.muted}><T>
          Employees see totals without cost or profit breakdown.
        </T></p>
      ) : null}
    </section>
  );
}

function OrdersPanel({ orders, role }) {
  if (!Array.isArray(orders) || orders.length === 0) {
    return (
      <EmptyState
        title="No custom orders"
        description="Custom orders placed for this customer will appear here."
      />
    );
  }
  return (
    <section className={styles.infoCard}>
      <div className={styles.cardHead}><h2><T>Custom orders</T></h2></div>
      <div className={styles.tableWrap}><table className={styles.table}>
        <thead>
          <tr>
            <th><T>Code</T></th>
            <th><T>Title</T></th>
            <th><T>Status</T></th>
            <th><T>Total</T></th>
            <th><T>Due</T></th>
            <th><T>Action</T></th>
          </tr>
        </thead>
        <tbody>
          {orders.map((o) => (
            <tr key={o.id}>
              <td className={styles.mono}>{o.code}</td>
              <td>{o.title}</td>
              <td>
                <span className={styles.statusPill}>{o.status}</span>
              </td>
              <td><Link to={`/custom-orders/${o.id}`} className={styles.viewLink}><T>View</T> ↗</Link></td>
              <td>{formatCurrency(o.total)}</td>
              <td>
                {o.due > 0 ? (
                  <span className={styles.dueAmount}>
                    {formatCurrency(o.due)}
                  </span>
                ) : (
                  <span className={styles.muted}><T>Settled</T></span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table></div>
      {role === 'EMPLOYEE' ? (
        <p className={styles.muted}><T>
          Supplier and expense details for custom orders are hidden for
          employees.
        </T></p>
      ) : null}
    </section>
  );
}

function DuePanel({ due }) {
  if (!due) {
    return (
      <p className={styles.muted}><T>No outstanding dues for this customer.</T></p>
    );
  }
  const total = due.totalDue ?? 0;
  return (
    <section className={styles.infoCard}>
      <div className={styles.cardHead}><h2><T>Due summary</T></h2></div>
      <div className={styles.dueGrid}>
      <div className={styles.dueCard}>
        <span className={styles.dueLabel}><T>Open sales</T></span>
        <span className={styles.dueValue}>{due.openSales ?? 0}</span>
      </div>
      <div className={styles.dueCard}>
        <span className={styles.dueLabel}><T>Open custom orders</T></span>
        <span className={styles.dueValue}>{Array.isArray(due.openCustomOrders) ? due.openCustomOrders.length : (due.openCustomOrders ?? 0)}</span>
      </div>
      <div className={`${styles.dueCard} ${styles.dueCardTotal}`}>
        <span className={styles.dueLabel}><T>Total due</T></span>
        <span className={styles.dueValue}>{formatCurrency(total)}</span>
      </div>
      </div>
    </section>
  );
}
