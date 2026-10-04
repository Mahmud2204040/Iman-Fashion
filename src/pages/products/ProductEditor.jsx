import { useState } from 'react';

import T from '../../components/common/LocalizedText.jsx';
import { FormField, Input, Select, Textarea } from '../../components/common/index.js';
import { useAuth } from '../../hooks/useAuth.js';
import { useLocale } from '../../contexts/LocaleContext.jsx';
import { createProduct } from '../../services/products/productService.js';
import titlePlus from '../../assets/figma/inventory/0be0c.svg';
import actionPlus from '../../assets/figma/inventory/3ba17.svg';
import chevron from '../../assets/figma/inventory/f1f70.svg';
import resizeHandle from '../../assets/figma/inventory/0fe74.svg';
import styles from './InventoryEditor.module.css';

export default function ProductEditor({ onCreated, onCancel }) {
  const { user, role } = useAuth();
  const { t } = useLocale();
  const [draft, setDraft] = useState({ name: '', purchasePrice: '', status: 'ACTIVE', openingStock: '0', notes: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const update = (field) => (event) => setDraft((current) => ({ ...current, [field]: event.target.value }));

  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    setError(''); setBusy(true);
    try {
      const created = await createProduct({
        name: draft.name.trim(),
        purchasePrice: draft.purchasePrice === '' ? null : Number(draft.purchasePrice),
        description: draft.notes.trim(),
        isActive: draft.status === 'ACTIVE',
        stock: Number(draft.openingStock || 0),
      }, { actor: { username: user?.username || 'unknown', role } });
      onCreated(created);
    } catch (caught) { setError(caught?.message || 'Could not create product.'); }
    finally { setBusy(false); }
  }

  return <form className={styles.editor} onSubmit={submit}>
    <header className={styles.head}>
      <div className={styles.titleRow}>
        <span className={styles.titleIcon}><img src={titlePlus} alt="" /></span>
        <h2 id="inventory-modal-title"><T>Add new product</T></h2>
        <button type="button" className={styles.close} aria-label={t('Close')} onClick={onCancel}>×</button>
      </div>
      <p><T>Create a finished product and, if needed, record opening stock in the same step.</T></p>
    </header>
    <div className={styles.body}>
      <div className={styles.sectionHead}><h3><T>Product details</T></h3><span><T>* Required</T></span></div>
      <FormField className={styles.field} label="Product name" htmlFor="inventory-product-name" required>
        {(control) => <Input {...control} value={draft.name} onChange={update('name')} placeholder="e.g. Navy Blue Pant - XXL" required />}
      </FormField>
      <FormField className={styles.field} label={<>{t('Purchase price (৳)')} <span className={styles.optional}>{t('(optional)')}</span></>} htmlFor="inventory-product-cost" helper="Leave blank if the cost is unknown. Owner-only information.">
        {(control) => <Input {...control} type="number" inputMode="decimal" min="0" step="0.01" value={draft.purchasePrice} onChange={update('purchasePrice')} placeholder="Optional" />}
      </FormField>
      <div className={styles.twoColumns}>
        <FormField className={styles.field} label="Status" htmlFor="inventory-product-status" required>
          {(control) => <span className={styles.selectWrap}><Select {...control} value={draft.status} onChange={update('status')} options={[{ value: 'ACTIVE', label: t('Active') }, { value: 'INACTIVE', label: t('Inactive') }]} required /><img src={chevron} alt="" /></span>}
        </FormField>
        <FormField className={styles.field} label="Opening stock (optional)" htmlFor="inventory-product-stock">
          {(control) => <Input {...control} type="number" inputMode="numeric" min="0" step="1" value={draft.openingStock} onChange={update('openingStock')} />}
        </FormField>
      </div>
      <FormField className={styles.field} label="Notes" htmlFor="inventory-product-notes">
        {(control) => <span className={styles.textAreaWrap}><Textarea {...control} rows={3} value={draft.notes} onChange={update('notes')} placeholder="Optional product details. Include size and colour in the product name." /><img src={resizeHandle} alt="" /></span>}
      </FormField>
      {error ? <p className={styles.error} role="alert"><T>{error}</T></p> : null}
    </div>
    <footer className={styles.foot}>
      <button type="button" className={styles.cancel} onClick={onCancel}><T>Cancel</T></button>
      <button type="submit" className={styles.save} disabled={busy}><img src={actionPlus} alt="" />{busy ? t('Creating…') : t('Create product')}</button>
    </footer>
  </form>;
}
