import { useState } from 'react';

import T from '../../components/common/LocalizedText.jsx';
import { FormField, Input, Textarea } from '../../components/common/index.js';
import { useAuth } from '../../hooks/useAuth.js';
import { useLocale } from '../../contexts/LocaleContext.jsx';
import { createRawMaterial, updateRawMaterial } from '../../services/rawMaterials/rawMaterialService.js';
import { cashBusinessDate } from '../../utils/cashDate.js';
import titlePlus from '../../assets/figma/inventory/0be0c.svg';
import actionPlus from '../../assets/figma/inventory/3ba17.svg';
import calendarIcon from '../../assets/figma/inventory/96d7e.svg';
import styles from '../products/InventoryEditor.module.css';

export default function RawMaterialEditor({ item = null, onSaved, onCancel }) {
  const { user, role } = useAuth();
  const { t } = useLocale();
  const [draft, setDraft] = useState({
    itemName: item?.itemName || '',
    quantity: item ? String(item.quantity) : '',
    date: item?.date || cashBusinessDate(),
    purchaseCost: item?.purchaseCost == null ? '' : String(item.purchaseCost),
    description: item?.description || '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const update = (field) => (event) => setDraft((current) => ({ ...current, [field]: event.target.value }));

  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    setError(''); setBusy(true);
    try {
      const payload = {
        itemName: draft.itemName.trim(),
        quantity: Number(draft.quantity),
        date: draft.date,
        purchaseCost: draft.purchaseCost === '' ? null : Number(draft.purchaseCost),
        description: draft.description.trim(),
      };
      const actor = { actor: { username: user?.username || 'unknown', role } };
      const saved = item ? await updateRawMaterial(item.id, payload, actor) : await createRawMaterial(payload, actor);
      onSaved(saved);
    } catch (caught) { setError(caught?.message || 'Could not save raw material.'); }
    finally { setBusy(false); }
  }

  return <form className={`${styles.editor} ${styles.rawEditor}`} onSubmit={submit}>
    <header className={styles.head}>
      <div className={styles.titleRow}>
        <span className={styles.titleIcon}><img src={titlePlus} alt="" /></span>
        <h2 id="inventory-modal-title"><T>{item ? 'Edit raw material' : 'Add new raw material'}</T></h2>
        <button type="button" className={styles.close} aria-label={t('Close')} onClick={onCancel}>×</button>
      </div>
      <p><T>Record a material, fabric or supply. Finished product stock and shop cash stay unchanged.</T></p>
    </header>
    <div className={styles.body}>
      <div className={styles.sectionHead}><h3><T>Raw material details</T></h3><span><T>* Required</T></span></div>
      <FormField className={styles.field} label="Item name" htmlFor="inventory-material-name" required>
        {(control) => <Input {...control} value={draft.itemName} onChange={update('itemName')} placeholder="e.g. Cotton fabric" required />}
      </FormField>
      <div className={styles.twoColumns}>
        <FormField className={styles.field} label="Quantity" htmlFor="inventory-material-qty" required>
          {(control) => <Input {...control} type="number" inputMode="decimal" min="0.01" step="any" value={draft.quantity} onChange={update('quantity')} placeholder="Quantity" required />}
        </FormField>
        <FormField className={styles.field} label="Date" htmlFor="inventory-material-date" required>
          {(control) => <span className={styles.dateWrap}><Input {...control} type="date" value={draft.date} onClick={(event) => event.currentTarget.showPicker?.()} onChange={update('date')} required /><img src={calendarIcon} alt="" /></span>}
        </FormField>
      </div>
      <FormField className={styles.field} label="Purchase cost (৳, optional)" htmlFor="inventory-material-cost" helper="Leave blank if the cost is unknown.">
        {(control) => <Input {...control} type="number" inputMode="decimal" min="0" step="0.01" value={draft.purchaseCost} onChange={update('purchaseCost')} placeholder="Optional" />}
      </FormField>
      <FormField className={styles.field} label="Description (optional)" htmlFor="inventory-material-description">
        {(control) => <Textarea {...control} rows={2} value={draft.description} onChange={update('description')} placeholder="Optional details about colour or batch." />}
      </FormField>
      {error ? <p className={styles.error} role="alert"><T>{error}</T></p> : null}
    </div>
    <footer className={styles.foot}>
      <button type="button" className={styles.cancel} onClick={onCancel}><T>Cancel</T></button>
      <button type="submit" className={styles.save} disabled={busy}><img src={actionPlus} alt="" />{busy ? t('Saving…') : t(item ? 'Save changes' : 'Save raw material')}</button>
    </footer>
  </form>;
}
