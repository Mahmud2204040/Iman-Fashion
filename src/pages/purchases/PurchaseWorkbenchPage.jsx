import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import Modal from '../../components/common/Modal/Modal.jsx';
import ConfirmDialog from '../../components/common/ConfirmDialog/ConfirmDialog.jsx';
import PurchaseDialog from './PurchaseDialog.jsx';
import { useAuth } from '../../hooks/useAuth.js';
import { useLocale } from '../../contexts/LocaleContext.jsx';
import { attachPurchaseReceipt, computePurchaseTotals, getPurchases, recordPurchasePayment, setPurchaseStatus, updatePurchase } from '../../services/purchases/purchaseService.js';
import { formatCurrency, formatExactDate, formatExactDateTime } from '../../utils/format.js';
import styles from '../procurement/Workbench.module.css';

const FILTERS = ['ALL', 'DRAFT', 'ORDERED', 'RECEIVED', 'CANCELLED'];
const emptyTotals = { total: 0, paidTotal: 0, dueTotal: 0 };

export default function PurchaseWorkbenchPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { user, role } = useAuth();
  const { t } = useLocale();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [newPurchaseOpen, setNewPurchaseOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [paymentNote, setPaymentNote] = useState('');
  const [notesOpen, setNotesOpen] = useState(false);
  const [notesDraft, setNotesDraft] = useState('');
  const [pendingStatus, setPendingStatus] = useState('');
  const [proofPayment, setProofPayment] = useState('');
  const fileRef = useRef(null);
  const search = params.get('q') || '';
  const filter = FILTERS.includes(params.get('status')) ? params.get('status') : 'ALL';
  const actor = { username: user?.username || 'owner', role };

  const reload = useCallback(async () => {
    setLoading(true); setError('');
    try { setRows(await getPurchases()); }
    catch (err) { setError(err?.message || 'Could not load purchases.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { reload(); }, [reload]);

  const selected = rows.find((row) => row.id === id) || (!id ? rows[0] : null);
  const selectedTotals = selected ? computePurchaseTotals(selected) : emptyTotals;
  const filtered = useMemo(() => rows.filter((row) => {
    if (filter !== 'ALL' && row.status !== filter) return false;
    const q = search.trim().toLowerCase();
    return !q || [row.code, row.supplierName, row.notes].some((value) => String(value || '').toLowerCase().includes(q));
  }), [rows, search, filter]);
  const totals = useMemo(() => rows.reduce((out, row) => {
    const part = computePurchaseTotals(row);
    out.total += part.total; out.paidTotal += part.paidTotal; out.dueTotal += part.dueTotal;
    return out;
  }, { total: 0, paidTotal: 0, dueTotal: 0 }), [rows]);
  const canPay = selected && ['ORDERED', 'RECEIVED'].includes(selected.status) && selectedTotals.dueTotal > 0;
  const canEdit = selected && ['DRAFT', 'ORDERED'].includes(selected.status);
  const canCancel = canEdit && !selected.payments.length;

  function updateParam(key, value) {
    const next = new URLSearchParams(params);
    if (!value || value === 'ALL') next.delete(key); else next.set(key, value);
    setParams(next, { replace: true });
  }
  function toList() { navigate(`/purchases${params.size ? `?${params}` : ''}`); }
  function openRow(rowId) { navigate(`/purchases/${rowId}${params.size ? `?${params}` : ''}`); }
  async function mutate(task, success) {
    setBusy(true); setError(''); setMessage('');
    try { await task(); await reload(); setMessage(success); return true; }
    catch (err) { setError(err?.message || 'Could not save the change.'); return false; }
    finally { setBusy(false); }
  }
  async function changeStatus() {
    const next = pendingStatus; setPendingStatus('');
    if (!selected || !next) return;
    await mutate(() => setPurchaseStatus(selected.id, next, { actor }), `Purchase marked ${next.toLowerCase()}.`);
  }
  async function saveNotes(event) {
    event.preventDefault();
    if (!selected) return;
    if (await mutate(() => updatePurchase(selected.id, { notes: notesDraft }, { actor }), 'Notes saved.')) setNotesOpen(false);
  }
  async function savePayment(event) {
    event.preventDefault();
    if (!selected) return;
    if (await mutate(() => recordPurchasePayment(selected.id, { amount: Number(amount), method: 'CASH', note: paymentNote }, { actor }), 'Payment recorded against this purchase. Shop cash was not changed.')) {
      setPaymentOpen(false); setAmount(''); setPaymentNote('');
    }
  }
  async function addProofs(event) {
    const files = Array.from(event.target.files || []);
    if (!selected || !files.length) return;
    await mutate(async () => {
      for (const file of files) {
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) throw new Error('Use JPG, PNG or WebP images of 5 MB or less.');
        const dataUrl = await new Promise((resolve, reject) => {
          const reader = new FileReader(); reader.onerror = () => reject(reader.error); reader.onload = () => resolve(String(reader.result)); reader.readAsDataURL(file);
        });
        await attachPurchaseReceipt(selected.id, { dataUrl, name: file.name, type: file.type, size: file.size, paymentId: proofPayment || null }, { actor });
      }
    }, `${files.length} receipt image${files.length === 1 ? '' : 's'} attached.`);
    event.target.value = '';
  }

  return <main className={styles.page}>
    <header className={styles.heading}><div><h1>{t('Purchase history')}</h1><p>{t('Browse every supplier purchase and inspect payment, delivery and receipt details without leaving the page.')}</p></div><div className={styles.actions}><button className={styles.primary} type="button" onClick={() => setNewPurchaseOpen(true)}><span aria-hidden="true">＋</span>{t('New purchase')}</button></div></header>
    <div className={`${styles.metrics} ${styles.metricsThree} ${id ? styles.compactOnDetail : ''}`}>
      <div className={styles.metric}><strong>{formatCurrency(totals.total)}</strong><span>{t('Total purchases')}</span></div>
      <div className={styles.metric}><strong className={styles.good}>{formatCurrency(totals.paidTotal)}</strong><span>{t('Paid')}</span></div>
      <div className={styles.metric}><strong className={styles.bad}>{formatCurrency(totals.dueTotal)}</strong><span>{t('Outstanding')}</span></div>
    </div>
    {error && <p className={styles.feedback} role="alert">{t(error)} <button className={styles.quiet} type="button" onClick={reload}>{t('Retry')}</button></p>}
    {message && <p className={`${styles.feedback} ${styles.success}`} role="status">{t(message)}</p>}
    <div className={styles.workbench}>
      <section className={`${styles.pane} ${styles.listPane} ${styles.purchaseListPane} ${id ? styles.hideMobile : ''}`} aria-label={t('Purchases')}>
        <div className={styles.paneHeading}><h2>{t('Purchases')}</h2><span className={styles.count}>{rows.length} {t('orders')}</span></div>
        <input className={styles.search} type="search" aria-label={t('Search purchases')} placeholder={t('Search code, supplier or notes')} value={search} onChange={(e) => updateParam('q', e.target.value)} />
        <div className={styles.filters} aria-label={t('Filter by status')}>
          {FILTERS.map((status) => <button key={status} type="button" className={`${styles.filter} ${filter === status ? styles.filterActive : ''}`} aria-pressed={filter === status} onClick={() => updateParam('status', status)}>{t(status === 'ALL' ? 'All' : status[0] + status.slice(1).toLowerCase())}</button>)}
        </div>
        <div className={`${styles.rows} ${styles.purchaseRows}`}>{loading ? <p>{t('Loading purchases…')}</p> : filtered.length ? filtered.map((row) => {
          const due = computePurchaseTotals(row).dueTotal;
          return <button key={row.id} type="button" onClick={() => openRow(row.id)} className={`${styles.row} ${selected?.id === row.id ? styles.selected : ''}`} aria-current={selected?.id === row.id ? 'true' : undefined}>
            <div className={styles.rowTop}><span className={styles.rowCode}>{row.code}</span><span className={`${styles.status} ${styles[`status${row.status}`]}`}>{t(row.status)}</span></div>
            <div className={styles.rowBottom}><div><div className={styles.rowName}>{row.supplierName}</div><div className={styles.rowMeta}>{row.items.length} {t('items')} · {formatExactDate(row.orderedAt)}</div></div><div><strong>{formatCurrency(row.total)}</strong><small className={due ? styles.bad : styles.good}>{due ? `${t('Due')} ${formatCurrency(due)}` : row.status === 'CANCELLED' ? t('No active due') : t('Fully paid')}</small></div></div>
          </button>;
        }) : <div className={styles.empty}>{t('No purchases match this search or filter.')}</div>}</div>
      </section>
      <section className={`${styles.pane} ${styles.detail} ${!id ? styles.hideMobile : ''}`} aria-label={t('Purchase details')}>
        {id && <button className={`${styles.mobileBack} ${styles.button}`} type="button" onClick={toList}>← {t('Purchase history')}</button>}
        {id && !selected && !loading ? <div className={styles.empty}>{t('Purchase not found.')} <button className={styles.button} type="button" onClick={toList}>{t('All purchases')}</button></div> : !selected ? <div className={styles.empty}>{loading ? t('Loading purchases…') : t('Select a purchase')}</div> : <>
          <div className={styles.detailHead}><div><div className={styles.identity}><span className={`${styles.status} ${styles[`status${selected.status}`]}`}>{t(selected.status)}</span><span className={styles.code}>{selected.code}</span></div><h2><Link className={styles.supplierNameLink} to={`/suppliers/${selected.supplierId}`}>{selected.supplierName}</Link></h2><span className={styles.detailMeta}>{t('Purchase date')} {formatExactDate(selected.orderedAt)} · {t('Created by')} {selected.createdBy || '—'}</span></div><Link className={styles.button} to={`/suppliers/${selected.supplierId}`}>{t('Supplier')} ↗</Link></div>
          <div className={styles.summary}><div><span>{t('Total')}</span><strong>{formatCurrency(selectedTotals.total)}</strong><small>{selected.items.length} {t('items')}</small></div><div><span>{t('Paid')}</span><strong className={styles.good}>{formatCurrency(selectedTotals.paidTotal)}</strong><small>{selected.payments.length} {t('payments')}</small></div><div><span>{t('Outstanding')}</span><strong className={selectedTotals.dueTotal ? styles.bad : ''}>{formatCurrency(selectedTotals.dueTotal)}</strong><small>{selectedTotals.dueTotal ? t('Payment due') : t('Cleared')}</small></div></div>
          <div className={styles.dateGrid}><div><small>{t('Purchase date')}</small><strong>{formatExactDate(selected.orderedAt)}</strong></div><div><small>{t('Expected')}</small><strong>{formatExactDate(selected.expectedAt)}</strong></div><div><small>{t('Received')}</small><strong>{formatExactDate(selected.receivedAt)}</strong><span>{t('Finished stock unchanged')}</span></div></div>
          <div className={styles.sections}><article className={styles.section}><div className={styles.sectionHead}><h3>{t('Line items')}</h3><small>{selected.items.length} {t('lines')}</small></div>{selected.items.map((item) => <div className={styles.dataRow} key={item.id}><span>{item.name}<small>{item.qty} × {formatCurrency(item.unitPrice)}</small></span><strong>{formatCurrency(item.lineTotal)}</strong></div>)}</article><article className={`${styles.section} ${styles.sectionSoft}`}><div className={styles.sectionHead}><h3>{t('Payments')}</h3><small>{selected.payments.length} {t('records')}</small></div>{selected.payments.length ? selected.payments.map((pay) => <div className={styles.dataRow} key={pay.id}><span>{t('CASH')} · {formatExactDate(pay.createdAt)}<small>{pay.note || pay.id}</small></span><strong className={styles.good}>{formatCurrency(pay.amount)}</strong></div>) : <p className={styles.noteText}>{t('No payments recorded yet.')}</p>}</article></div>
          <div className={styles.sections}><article className={`${styles.section} ${styles.sectionWarm}`}><div className={styles.sectionHead}><h3>{t('Internal notes')}</h3>{canEdit && <button className={styles.button} type="button" onClick={() => { setNotesDraft(selected.notes || ''); setNotesOpen(true); }}>{t('Edit note')}</button>}</div><p className={styles.noteText}>{selected.notes || t('No notes added.')}</p></article><article className={styles.section}><div className={styles.sectionHead}><h3>{t('Receipt proofs')}</h3><small>{selected.receipts?.length || 0} {t('images')}</small></div>{selected.receipts?.length ? <div className={styles.receiptGrid}>{selected.receipts.map((proof) => <a key={proof.id} className={styles.receipt} href={proof.dataUrl} target="_blank" rel="noreferrer"><img src={proof.dataUrl} alt={proof.name} /><span title={`${proof.name} · ${proof.uploadedBy} · ${formatExactDateTime(proof.uploadedAt)}`}>{proof.name}</span><small>{proof.paymentId ? t('Payment proof') : t('Purchase proof')}</small></a>)}</div> : <p className={styles.noteText}>{t('No receipt images yet.')}</p>}<div className={styles.inlineActions}><select className={styles.select} aria-label={t('Link proof to a payment')} value={proofPayment} onChange={(e) => setProofPayment(e.target.value)}><option value="">{t('Purchase proof')}</option>{selected.payments.map((pay) => <option key={pay.id} value={pay.id}>{pay.id}</option>)}</select><input ref={fileRef} className={styles.hiddenInput} type="file" multiple accept="image/jpeg,image/png,image/webp" onChange={addProofs} /><button className={styles.button} type="button" disabled={busy} onClick={() => fileRef.current?.click()}>{t('Add receipt images')}</button></div></article></div>
          <footer className={styles.footer}><small>{t('Created')} {formatExactDateTime(selected.createdAt)} · {t('Updated')} {formatExactDateTime(selected.updatedAt)}</small><div className={styles.inlineActions}>{canCancel && <button type="button" className={styles.danger} disabled={busy} onClick={() => setPendingStatus('CANCELLED')}>{t('Cancel purchase')}</button>}{selected.status === 'DRAFT' && <button type="button" className={styles.lime} disabled={busy} onClick={() => setPendingStatus('ORDERED')}>{t('Mark ordered')}</button>}{selected.status === 'ORDERED' && <button type="button" className={styles.lime} disabled={busy} onClick={() => setPendingStatus('RECEIVED')}>{t('Mark received')}</button>}{canPay && <button type="button" className={styles.primary} disabled={busy} onClick={() => setPaymentOpen(true)}>{t('Record payment')}</button>}</div></footer>
        </>}
      </section>
    </div>
    <Modal open={paymentOpen} onClose={() => setPaymentOpen(false)} title="Record supplier payment"><form className={styles.form} onSubmit={savePayment}><p className={styles.noteText}>{selected?.code} · {t('Cash only. This payment does not automatically create shop Cash Out.')}</p><label>{t('Amount')}<input className={styles.field} type="number" min="0.01" max={selectedTotals.dueTotal} step="0.01" required value={amount} onChange={(e) => setAmount(e.target.value)} /></label><label>{t('Note (optional)')}<textarea className={styles.textarea} value={paymentNote} onChange={(e) => setPaymentNote(e.target.value)} /></label><div className={styles.inlineActions}><button className={styles.button} type="button" onClick={() => setPaymentOpen(false)}>{t('Cancel')}</button><button className={styles.primary} type="submit" disabled={busy}>{t('Record payment')}</button></div></form></Modal>
    <Modal open={notesOpen} onClose={() => setNotesOpen(false)} title="Edit purchase notes"><form className={styles.form} onSubmit={saveNotes}><textarea className={styles.textarea} aria-label={t('Internal notes')} value={notesDraft} onChange={(e) => setNotesDraft(e.target.value)} /><div className={styles.inlineActions}><button type="button" className={styles.button} onClick={() => setNotesOpen(false)}>{t('Cancel')}</button><button type="submit" className={styles.primary} disabled={busy}>{t('Save notes')}</button></div></form></Modal>
    <ConfirmDialog open={Boolean(pendingStatus)} title={pendingStatus === 'CANCELLED' ? 'Cancel purchase?' : `Mark purchase ${pendingStatus.toLowerCase()}?`} message={pendingStatus === 'CANCELLED' ? 'The purchase remains in history but its remaining amount will not count as supplier due.' : pendingStatus === 'RECEIVED' ? 'Receiving locks the purchase. Finished product stock will not change automatically.' : 'This purchase will become eligible for cash payments.'} confirmText={pendingStatus === 'CANCELLED' ? 'Cancel purchase' : `Mark ${pendingStatus.toLowerCase()}`} tone={pendingStatus === 'CANCELLED' ? 'danger' : 'primary'} onClose={() => setPendingStatus('')} onConfirm={changeStatus} />
    {newPurchaseOpen ? <PurchaseDialog onClose={() => setNewPurchaseOpen(false)} onCreated={(purchase) => { setNewPurchaseOpen(false); reload(); navigate(`/purchases/${purchase.id}`); }} /> : null}
  </main>;
}
