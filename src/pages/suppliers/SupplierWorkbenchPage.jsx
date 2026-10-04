import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import Modal from '../../components/common/Modal/Modal.jsx';
import ConfirmDialog from '../../components/common/ConfirmDialog/ConfirmDialog.jsx';
import PurchaseDialog from '../purchases/PurchaseDialog.jsx';
import { useAuth } from '../../hooks/useAuth.js';
import { useLocale } from '../../contexts/LocaleContext.jsx';
import { SupplierIcon } from '../../components/icons/DashboardIcon.jsx';
import { computeSupplierTotals, createSupplier, getSuppliers, updateSupplier } from '../../services/suppliers/supplierService.js';
import { getPurchases, recordPurchasePayment } from '../../services/purchases/purchaseService.js';
import { formatCurrency, formatExactDate } from '../../utils/format.js';
import activeIcon from '../../assets/figma/procurement/supplier-active.svg';
import inactiveIcon from '../../assets/figma/procurement/supplier-inactive.svg';
import activeDot from '../../assets/figma/procurement/status-active.svg';
import inactiveDot from '../../assets/figma/procurement/status-inactive.svg';
import styles from '../procurement/Workbench.module.css';

const blank = { name: '', contactPerson: '', phone: '', email: '', address: '', notes: '' };

export default function SupplierWorkbenchPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { user, role } = useAuth();
  const { t } = useLocale();
  const [suppliers, setSuppliers] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [editor, setEditor] = useState('');
  const [draft, setDraft] = useState(blank);
  const [statusConfirm, setStatusConfirm] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [newPurchaseOpen, setNewPurchaseOpen] = useState(false);
  const [payPurchase, setPayPurchase] = useState('');
  const [payAmount, setPayAmount] = useState('');
  const [payNote, setPayNote] = useState('');
  const search = params.get('q') || '';
  const status = ['all', 'active', 'inactive'].includes(params.get('status')) ? params.get('status') : 'all';
  const actor = { username: user?.username || 'owner', role };

  const reload = useCallback(async () => {
    setLoading(true); setError('');
    try { const [s, p] = await Promise.all([getSuppliers(), getPurchases()]); setSuppliers(s); setPurchases(p); }
    catch (err) { setError(err?.message || 'Could not load suppliers.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { reload(); }, [reload]);
  const selected = suppliers.find((s) => s.id === id) || (!id ? suppliers[0] : null);
  const mine = selected ? purchases.filter((p) => p.supplierId === selected.id) : [];
  const totals = selected ? computeSupplierTotals(selected, purchases) : { purchasesTotal: 0, paidTotal: 0, dueTotal: 0, purchaseCount: 0 };
  const payments = mine.flatMap((p) => (p.payments || []).map((pay) => ({ ...pay, purchaseCode: p.code }))).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  const eligible = mine.filter((p) => ['ORDERED', 'RECEIVED'].includes(p.status) && Number(p.total) - Number(p.paidTotal) > 0);
  const chosen = eligible.find((p) => p.id === payPurchase);
  const filtered = useMemo(() => suppliers.filter((s) => {
    if (status === 'active' && !s.isActive || status === 'inactive' && s.isActive) return false;
    const q = search.trim().toLowerCase();
    return !q || [s.supplierCode, s.name, s.contactPerson, s.phone].some((value) => String(value || '').toLowerCase().includes(q));
  }), [suppliers, search, status]);
  const allTotals = useMemo(() => suppliers.reduce((out, s) => {
    const st = computeSupplierTotals(s, purchases);
    out.purchases += st.purchasesTotal; out.due += st.dueTotal;
    return out;
  }, { purchases: 0, due: 0 }), [suppliers, purchases]);

  function updateParam(key, value) {
    const next = new URLSearchParams(params);
    if (!value || value === 'all') next.delete(key); else next.set(key, value);
    setParams(next, { replace: true });
  }
  function toList() { navigate(`/suppliers${params.size ? `?${params}` : ''}`); }
  function openRow(rowId) { navigate(`/suppliers/${rowId}${params.size ? `?${params}` : ''}`); }
  async function mutate(task, success) {
    setBusy(true); setError(''); setMessage('');
    try { const result = await task(); await reload(); setMessage(success); return result; }
    catch (err) { setError(err?.message || 'Could not save the change.'); return null; }
    finally { setBusy(false); }
  }
  function openEditor(mode) {
    setDraft(mode === 'create' ? blank : { name: selected.name, contactPerson: selected.contactPerson || '', phone: selected.phone || '', email: selected.email || '', address: selected.address || '', notes: selected.notes || '' });
    setEditor(mode);
  }
  async function saveSupplier(event) {
    event.preventDefault();
    const result = await mutate(() => editor === 'create' ? createSupplier(draft, { actor }) : updateSupplier(selected.id, editor === 'note' ? { notes: draft.notes } : draft, { actor }), editor === 'create' ? 'Supplier created.' : 'Supplier updated.');
    if (result) { setEditor(''); if (editor === 'create') navigate(`/suppliers/${result.id}`); }
  }
  async function toggleStatus() {
    setStatusConfirm(false);
    await mutate(() => updateSupplier(selected.id, { isActive: !selected.isActive }, { actor }), selected.isActive ? 'Supplier deactivated.' : 'Supplier reactivated.');
  }
  async function savePayment(event) {
    event.preventDefault();
    const result = await mutate(() => recordPurchasePayment(payPurchase, { amount: Number(payAmount), method: 'CASH', note: payNote }, { actor }), 'Payment allocated to the selected purchase. Shop cash was not changed.');
    if (result) { setPayOpen(false); setPayPurchase(''); setPayAmount(''); setPayNote(''); }
  }

  return <main className={styles.page}>
    <header className={styles.heading}><div><h1>{t('Supplier workspace')}</h1><p>{t('Manage vendor relationships, purchases and payments without leaving the page.')}</p></div><div className={styles.actions}><Link className={styles.primary} to="/purchases">↗ {t('Purchase history')}</Link><button className={styles.primary} type="button" onClick={() => openEditor('create')}>＋ {t('Add supplier')}</button></div></header>
    <div className={`${styles.metrics} ${id ? styles.compactOnDetail : ''}`}><div className={styles.metric}><strong>{suppliers.length}</strong><span>{t('Suppliers')}</span></div><div className={styles.metric}><strong>{suppliers.filter((s) => s.isActive).length}</strong><span>{t('Active')}</span></div><div className={styles.metric}><strong>{formatCurrency(allTotals.purchases)}</strong><span>{t('Purchases')}</span></div><div className={styles.metric}><strong>{formatCurrency(allTotals.due)}</strong><span>{t('Outstanding')}</span></div></div>
    {error && <p className={styles.feedback} role="alert">{t(error)} <button className={styles.quiet} type="button" onClick={reload}>{t('Retry')}</button></p>}
    {message && <p className={`${styles.feedback} ${styles.success}`} role="status">{t(message)}</p>}
    <div className={styles.workbench}>
      <section className={`${styles.pane} ${styles.listPane} ${styles.supplierListPane} ${id ? styles.hideMobile : ''}`} aria-label={t('Suppliers')}><div className={styles.paneHeading}><h2>{t('Suppliers')}</h2><span className={styles.count}>{suppliers.length} {t('vendors')}</span></div><input className={styles.search} type="search" aria-label={t('Search suppliers')} placeholder={t('Search code, name or phone')} value={search} onChange={(e) => updateParam('q', e.target.value)} /><div className={styles.filters} aria-label={t('Filter suppliers')}>{['all', 'active', 'inactive'].map((opt) => <button key={opt} type="button" className={`${styles.filter} ${status === opt ? styles.filterActive : ''}`} aria-pressed={status === opt} onClick={() => updateParam('status', opt)}>{t(opt[0].toUpperCase() + opt.slice(1))}</button>)}</div><div className={`${styles.rows} ${styles.supplierRows}`}>{loading ? <p>{t('Loading suppliers…')}</p> : filtered.length ? filtered.map((s) => {
        const st = computeSupplierTotals(s, purchases);
        return <button key={s.id} type="button" onClick={() => openRow(s.id)} className={`${styles.row} ${selected?.id === s.id ? styles.selected : ''}`} aria-current={selected?.id === s.id ? 'true' : undefined}><div className={styles.rowTop}><div className={styles.supplierRow}><span className={styles.supplierGlyph}><img src={s.isActive ? activeIcon : inactiveIcon} width="34" height="34" alt="" /><SupplierIcon size={14} strokeWidth={1.8} aria-hidden="true" /></span><span className={styles.nameBlock}><strong>{s.name}</strong><small>{s.supplierCode} · {s.contactPerson || t('No contact')}</small></span></div><img src={s.isActive ? activeDot : inactiveDot} width="8" height="8" alt="" /></div><div className={styles.supplierMeta}><span>{formatCurrency(st.purchasesTotal)} {t('purchased')}</span><span className={st.dueTotal ? styles.bad : styles.good}>{formatCurrency(st.dueTotal)} {t('due')}</span></div></button>;
      }) : <div className={styles.empty}>{t('No suppliers match this search or filter.')}</div>}</div></section>
      <section className={`${styles.pane} ${styles.detail} ${!id ? styles.hideMobile : ''}`} aria-label={t('Supplier details')}>{id && <button className={`${styles.mobileBack} ${styles.button}`} type="button" onClick={toList}>← {t('Suppliers')}</button>}{id && !selected && !loading ? <div className={styles.empty}>{t('Supplier not found.')} <button className={styles.button} type="button" onClick={toList}>{t('All suppliers')}</button></div> : !selected ? <div className={styles.empty}>{loading ? t('Loading suppliers…') : t('Select a supplier')}</div> : <>
        <div className={styles.detailHead}><div><div className={styles.identity}><span className={`${styles.status} ${selected.isActive ? styles.statusActive : styles.statusInactive}`}>{t(selected.isActive ? 'Active' : 'Inactive')}</span><span className={styles.code}>{selected.supplierCode}</span></div><h2>{selected.name}</h2><span className={styles.detailMeta}>{selected.contactPerson || t('No contact')} · {selected.phone}</span></div><button type="button" className={styles.button} onClick={() => openEditor('edit')}>{t('Edit supplier')}</button></div>
        <div className={styles.sections}><article className={styles.section}><h3>{t('Profile')}</h3><dl className={styles.profileList}><div><dt>{t('Code')}</dt><dd>{selected.supplierCode}</dd></div><div><dt>{t('Contact')}</dt><dd>{selected.contactPerson || '—'}</dd></div><div><dt>{t('Phone')}</dt><dd>{selected.phone}</dd></div><div><dt>{t('Email')}</dt><dd>{selected.email || '—'}</dd></div><div><dt>{t('Address')}</dt><dd>{selected.address || '—'}</dd></div></dl></article><article className={`${styles.section} ${styles.sectionSoft}`}><h3>{t('Relationship value')}</h3><div className={styles.summary}><div><span>{t('Purchases')}</span><strong>{formatCurrency(totals.purchasesTotal)}</strong></div><div><span>{t('Paid')}</span><strong className={styles.good}>{formatCurrency(totals.paidTotal)}</strong></div><div><span>{t('Due')}</span><strong className={totals.dueTotal ? styles.bad : ''}>{formatCurrency(totals.dueTotal)}</strong></div></div><small className={styles.detailMeta}>{totals.purchaseCount} {t('purchases on record')} · {t('Updated')} {formatExactDate(selected.updatedAt)}</small></article></div>
        <article className={`${styles.section} ${styles.sectionWarm}`} style={{ marginTop: 12 }}><div className={styles.sectionHead}><h3>{t('Internal notes')}</h3><button className={styles.button} type="button" onClick={() => openEditor('note')}>{t('Edit note')}</button></div><p className={styles.noteText}>{selected.notes || t('No notes added.')}</p></article>
        <div className={styles.sections}><article className={styles.section}><div className={styles.sectionHead}><h3>{t('Purchases')}</h3><small>{mine.length} {t('purchases')}</small></div>{mine.length ? mine.slice(0, 5).map((p) => <div key={p.id} className={styles.dataRow}><span><Link to={`/purchases/${p.id}`}>{p.code}</Link><small>{p.items.length} {t('items')} · {formatExactDate(p.orderedAt)}</small></span><span><span className={`${styles.status} ${styles[`status${p.status}`]}`}>{t(p.status)}</span><small>{t('Due')} {formatCurrency(p.status === 'CANCELLED' ? 0 : Math.max(p.total - p.paidTotal, 0))}</small></span><strong>{formatCurrency(p.total)}</strong></div>) : <p className={styles.noteText}>{t('No purchases yet for this supplier.')}</p>}</article><article className={`${styles.section} ${styles.sectionSoft}`}><div className={styles.sectionHead}><h3>{t('Payments')}</h3><small>{payments.length} {t('records')}</small></div>{payments.length ? payments.slice(0, 5).map((pay) => <div key={pay.id} className={styles.dataRow}><span>{t('CASH')} · {formatExactDate(pay.createdAt)}<small>{pay.purchaseCode} · {pay.note || pay.id}</small></span><strong className={styles.good}>{formatCurrency(pay.amount)}</strong></div>) : <p className={styles.noteText}>{t('No payments recorded yet.')}</p>}</article></div>
        <footer className={styles.footer}><button type="button" className={selected.isActive ? styles.danger : styles.button} onClick={() => setStatusConfirm(true)}>{t(selected.isActive ? 'Deactivate' : 'Reactivate')}</button><div className={styles.inlineActions}><button type="button" className={styles.button} disabled={!eligible.length} onClick={() => { setPayPurchase(eligible[0]?.id || ''); setPayOpen(true); }}>{t('Record payment')}</button><button type="button" className={styles.lime} onClick={() => setNewPurchaseOpen(true)}>{t('New purchase')}</button></div></footer>
      </>}</section>
    </div>
    <Modal open={Boolean(editor)} onClose={() => setEditor('')} title={editor === 'create' ? 'Add supplier' : editor === 'note' ? 'Edit note' : 'Edit supplier'} className={styles.supplierModal} overlayClassName={styles.supplierOverlay}><form className={styles.form} onSubmit={saveSupplier}>{editor === 'note' ? <label>{t('Internal notes')}<textarea className={styles.textarea} value={draft.notes} onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))} /></label> : <div className={styles.formGrid}>{[['name', 'Name'], ['contactPerson', 'Contact person'], ['phone', 'Phone'], ['email', 'Email'], ['address', 'Address']].map(([field, label]) => <label key={field} className={field === 'address' ? styles.fullSpan : undefined}>{t(label)}<input className={styles.field} type={field === 'email' ? 'email' : 'text'} required={field === 'name' || field === 'phone'} value={draft[field]} onChange={(e) => setDraft((d) => ({ ...d, [field]: e.target.value }))} /></label>)}<label className={styles.fullSpan}>{t('Internal notes')}<textarea className={styles.textarea} value={draft.notes} onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))} /></label></div>}<div className={`${styles.inlineActions} ${styles.modalActions}`}><button className={styles.button} type="button" onClick={() => setEditor('')}>{t('Cancel')}</button><button className={styles.primary} type="submit" disabled={busy}>{t('Save supplier')}</button></div></form></Modal>
    <Modal open={payOpen} onClose={() => setPayOpen(false)} title="Record supplier payment"><form className={styles.form} onSubmit={savePayment}><p className={styles.noteText}>{t('Choose the exact purchase. Cash only; this does not automatically create shop Cash Out.')}</p><label>{t('Purchase')}<select className={styles.select} required value={payPurchase} onChange={(e) => setPayPurchase(e.target.value)}>{eligible.map((p) => <option key={p.id} value={p.id}>{p.code} · {t('Due')} {formatCurrency(Math.max(p.total - p.paidTotal, 0))}</option>)}</select></label><label>{t('Amount')}<input className={styles.field} type="number" min="0.01" max={chosen ? Math.max(chosen.total - chosen.paidTotal, 0) : undefined} step="0.01" required value={payAmount} onChange={(e) => setPayAmount(e.target.value)} /></label><label>{t('Note (optional)')}<textarea className={styles.textarea} value={payNote} onChange={(e) => setPayNote(e.target.value)} /></label><div className={styles.inlineActions}><button type="button" className={styles.button} onClick={() => setPayOpen(false)}>{t('Cancel')}</button><button type="submit" className={styles.primary} disabled={busy || !chosen}>{t('Record payment')}</button></div></form></Modal>
    <ConfirmDialog open={statusConfirm} title={selected?.isActive ? 'Deactivate supplier?' : 'Reactivate supplier?'} message={selected?.isActive ? 'Existing purchase and payment history will remain available.' : 'This supplier will be available for new purchases again.'} confirmText={selected?.isActive ? 'Deactivate' : 'Reactivate'} tone={selected?.isActive ? 'danger' : 'primary'} onClose={() => setStatusConfirm(false)} onConfirm={toggleStatus} />
    {newPurchaseOpen ? <PurchaseDialog initialSupplierId={selected?.id || ''} onClose={() => setNewPurchaseOpen(false)} onCreated={(purchase) => navigate(`/purchases/${purchase.id}`)} /> : null}
  </main>;
}
