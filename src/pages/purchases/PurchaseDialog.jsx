import { useEffect, useMemo, useState } from 'react';
import Modal from '../../components/common/Modal/Modal.jsx';
import { useAuth } from '../../hooks/useAuth.js';
import { useLocale } from '../../contexts/LocaleContext.jsx';
import { cashBusinessDate } from '../../utils/cashDate.js';
import { formatCurrency } from '../../utils/format.js';
import { createPurchase, listSuppliersForPurchase } from '../../services/purchases/purchaseService.js';
import styles from './NewPurchasePage.module.css';

const newItem = () => ({ name: '', qty: '1', unitPrice: '', description: '' });

export default function PurchaseDialog({ onClose, onCreated, initialSupplierId = '' }) {
  const { user } = useAuth();
  const { t } = useLocale();
  const [suppliers, setSuppliers] = useState([]);
  const [supplierId, setSupplierId] = useState(initialSupplierId);
  const [purchaseDate, setPurchaseDate] = useState(cashBusinessDate());
  const [expectedAt, setExpectedAt] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState([newItem()]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    listSuppliersForPurchase()
      .then((rows) => {
        if (!active) return;
        setSuppliers(rows);
        if (initialSupplierId && rows.some((row) => row.id === initialSupplierId)) setSupplierId(initialSupplierId);
      })
      .catch((err) => { if (active) setError(err?.message || 'Could not load suppliers.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [initialSupplierId, reloadKey]);

  const total = useMemo(() => items.reduce((sum, item) => sum + (Number(item.qty) || 0) * (Number(item.unitPrice) || 0), 0), [items]);

  function editItem(index, field, value) {
    setItems((current) => current.map((item, position) => position === index ? { ...item, [field]: value } : item));
  }

  async function submit(event) {
    event.preventDefault();
    setError('');
    setSaving(true);
    try {
      const purchase = await createPurchase({ supplierId, purchaseDate, expectedAt: expectedAt || null, notes, items }, { actor: user });
      onCreated(purchase);
    } catch (err) {
      setError(err?.message || 'Could not create purchase.');
    } finally {
      setSaving(false);
    }
  }

  const title = <span className={styles.modalTitle}>
    <span className={styles.eyebrow}>{t('Procurement')}</span>
    <span className={styles.titleText}>{t('New purchase')}</span>
    <span className={styles.subtitle}>{t('Record a supplier order with one or more items. Receiving it will not change finished-product stock.')}</span>
  </span>;

  return <Modal open onClose={onClose} title={title} size="xl" className={styles.dialog} overlayClassName={styles.overlay}>
    <form className={styles.form} onSubmit={submit}>
      {error ? <p className={styles.error} role="alert">{t(error)} {suppliers.length === 0 && !loading ? <button type="button" onClick={() => { setLoading(true); setError(''); setReloadKey((value) => value + 1); }}>{t('Retry')}</button> : null}</p> : null}
      <section className={styles.card} aria-labelledby="purchase-details-title">
        <h3 id="purchase-details-title">{t('Purchase details')}</h3>
        <div className={styles.fields}>
          <label>{t('Supplier')}<select required value={supplierId} onChange={(event) => setSupplierId(event.target.value)} disabled={loading || saving}><option value="">{t('Select supplier')}</option>{suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}</select></label>
          <label>{t('Purchase date')}<input required type="date" value={purchaseDate} onChange={(event) => setPurchaseDate(event.target.value)} disabled={saving} /></label>
          <label>{t('Expected date (optional)')}<input type="date" value={expectedAt} onChange={(event) => setExpectedAt(event.target.value)} disabled={saving} /></label>
        </div>
        <label className={styles.full}>{t('Notes (optional)')}<textarea rows="2" value={notes} onChange={(event) => setNotes(event.target.value)} disabled={saving} placeholder={t('Add any notes about this purchase…')} /></label>
      </section>
      <section className={styles.card} aria-labelledby="purchase-items-title">
        <div className={styles.heading}><h3 id="purchase-items-title">{t('Line items')}</h3><button className={styles.addItem} type="button" onClick={() => setItems((current) => [...current, newItem()])}>{t('+ Add item')}</button></div>
        <div className={styles.itemHead} aria-hidden="true"><span>{t('Item name')}</span><span>{t('Quantity')}</span><span>{t('Unit cost (৳)')}</span><span>{t('Line total (৳)')}</span><span /></div>
        <div className={styles.itemList}>{items.map((item, index) => <div className={styles.item} key={index}>
          <label><span>{t('Item name')}</span><input aria-label={`${t('Item name')} ${index + 1}`} required value={item.name} onChange={(event) => editItem(index, 'name', event.target.value)} placeholder={t('Fabric, trim or supply')} disabled={saving} /></label>
          <label><span>{t('Quantity')}</span><input aria-label={`${t('Quantity')} ${index + 1}`} required type="number" min="0.01" step="any" value={item.qty} onChange={(event) => editItem(index, 'qty', event.target.value)} disabled={saving} /></label>
          <label><span>{t('Unit cost (৳)')}</span><input aria-label={`${t('Unit cost (৳)')} ${index + 1}`} required type="number" min="0" step="0.01" value={item.unitPrice} onChange={(event) => editItem(index, 'unitPrice', event.target.value)} disabled={saving} /></label>
          <strong>{formatCurrency((Number(item.qty) || 0) * (Number(item.unitPrice) || 0))}</strong>
          <button className={styles.removeItem} type="button" onClick={() => setItems((current) => current.filter((_, position) => position !== index))} disabled={items.length === 1 || saving} aria-label={`${t('Remove item')} ${index + 1}`}>×</button>
        </div>)}</div>
        <div className={styles.total}><span>{t('Purchase total')}</span><strong>{formatCurrency(total)}</strong></div>
      </section>
      <footer className={styles.actions}><p>ⓘ {t('Receiving this purchase later will not change finished-product stock immediately.')}</p><div><button type="button" onClick={onClose}>{t('Cancel')}</button><button type="submit" className={styles.submit} disabled={saving || loading}>{saving ? t('Saving…') : t('Create draft purchase')}</button></div></footer>
    </form>
  </Modal>;
}
