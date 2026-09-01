import { useEffect, useMemo, useState } from 'react';
import PageHeader from '../../components/common/PageHeader/PageHeader.jsx';
import Card from '../../components/common/Card/Card.jsx';
import FormField from '../../components/common/FormField/FormField.jsx';
import Input from '../../components/common/Input/Input.jsx';
import Textarea from '../../components/common/Textarea/Textarea.jsx';
import Button from '../../components/common/Button/Button.jsx';
import SearchInput from '../../components/common/SearchInput/SearchInput.jsx';
import Spinner from '../../components/common/Spinner/Spinner.jsx';
import EmptyState from '../../components/common/EmptyState/EmptyState.jsx';
import { useAuth } from '../../hooks/useAuth.js';
import { getRawMaterials, createRawMaterial } from '../../services/rawMaterials/rawMaterialService.js';
import { formatCurrency, formatLongDate } from '../../utils/format.js';
const formatBDT = (v) => formatCurrency(v, { currency: 'BDT', maximumFractionDigits: 0 });
const formatDate = (d) => formatLongDate(d);
import { RawMaterialIcon } from '../../components/icons/DashboardIcon.jsx';
import styles from './RawMaterialsPage.module.css';

const today = () => new Date().toISOString().slice(0, 10);

const emptyForm = { name: '', quantity: '', description: '', date: today(), notes: '', purchaseCost: '' };

export default function RawMaterialsPage() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const refresh = async () => {
    setLoading(true);
    try {
      const data = await getRawMaterials();
      setItems(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refresh(); /* eslint-disable-line */ }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((m) =>
      [m.itemName, m.description, m.notes].filter(Boolean).some((v) => v.toLowerCase().includes(q))
    );
  }, [items, search]);

  const totals = useMemo(() => {
    const records = items.length;
    const quantity = items.reduce((sum, m) => sum + (Number(m.quantity) || 0), 0);
    const spend = items.reduce((sum, m) => sum + (Number(m.purchaseCost) || 0), 0);
    return { records, quantity, spend };
  }, [items]);

  const update = (field) => (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.name.trim()) { setError('Name is required.'); return; }
    const qty = Number(form.quantity);
    if (!Number.isFinite(qty) || qty <= 0) { setError('Quantity must be a positive number.'); return; }
    setSaving(true);
    try {
      await createRawMaterial(
        {
          itemName: form.name.trim(),
          quantity: qty,
          description: form.description.trim() || null,
          date: form.date || today(),
          notes: form.notes.trim() || null,
          purchaseCost: form.purchaseCost === '' ? null : Number(form.purchaseCost),
        },
        { actor: user }
      );
      setForm(emptyForm);
      await refresh();
    } catch (err) {
      setError(err?.message || 'Could not save raw material.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.page}>
      <PageHeader title="Raw Materials" subtitle="Owner-only record keeping for materials, fabrics and supplies. Separate from finished product stock." />

      <div className={styles.banner} role="note">
        <RawMaterialIcon size={16} />
        <span>
          <strong>Owner only.</strong> Adding raw materials here does not adjust finished product stock or shop cash. Use Product stock and Cash pages for those.
        </span>
      </div>

      <Card>
        <div className={styles.totalsRow}>
          <div>
            <span className={styles.qtyLabel}>Records</span>
            <span className={styles.costValue}>{totals.records}</span>
          </div>
          <div>
            <span className={styles.qtyLabel}>Total Quantity</span>
            <span className={styles.costValue}>{totals.quantity}</span>
          </div>
          <div>
            <span className={styles.qtyLabel}>Recorded Spend</span>
            <span className={styles.costValue}>{formatBDT(totals.spend)}</span>
          </div>
        </div>
      </Card>

      <Card>
        <h2 className={styles.formTitle}>Add raw material</h2>
        <form className={styles.form} onSubmit={handleSubmit}>
          {error ? <p className={styles.formError}>{error}</p> : null}
          <div className={styles.row}>
            <FormField label="Name" required htmlFor="rm-name">
              {(controlProps) => (
                <Input id="rm-name" name="name" value={form.name} onChange={update('name')} placeholder="Cotton fabric" {...controlProps} />
              )}
            </FormField>
            <FormField label="Quantity" required htmlFor="rm-qty">
              {(controlProps) => (
                <Input id="rm-qty" name="quantity" type="number" min="0" step="1" value={form.quantity} onChange={update('quantity')} placeholder="0" {...controlProps} />
              )}
            </FormField>
            <FormField label="Date" htmlFor="rm-date">
              {(controlProps) => (
                <Input id="rm-date" name="date" type="date" value={form.date} onChange={update('date')} {...controlProps} />
              )}
            </FormField>
          </div>
          <FormField label="Description" htmlFor="rm-desc">
            {(controlProps) => (
              <Textarea id="rm-desc" name="description" rows={2} value={form.description} onChange={update('description')} placeholder="Optional context about this material." {...controlProps} />
            )}
          </FormField>
          <FormField label="Notes" htmlFor="rm-notes">
            {(controlProps) => (
              <Textarea id="rm-notes" name="notes" rows={2} value={form.notes} onChange={update('notes')} placeholder="Optional notes." {...controlProps} />
            )}
          </FormField>
          <FormField label="Purchase cost (BDT, optional)" htmlFor="rm-cost">
            {(controlProps) => (
              <Input id="rm-cost" name="purchaseCost" type="number" min="0" step="0.01" value={form.purchaseCost} onChange={update('purchaseCost')} placeholder="0.00" {...controlProps} />
            )}
          </FormField>
          <div className={styles.formActions}>
            <Button type="button" variant="ghost" onClick={() => setForm(emptyForm)} disabled={saving}>Reset</Button>
            <Button type="submit" variant="primary" disabled={saving}>{saving ? 'Saving…' : 'Add material'}</Button>
          </div>
        </form>
      </Card>

      <Card>
        <div className={styles.controlsCard}>
          <SearchInput value={search} onChange={setSearch} placeholder="Search by name, description or notes…" />
        </div>
      </Card>

      {loading ? (
        <div className={styles.loading}><Spinner size={20} /> Loading materials…</div>
      ) : filtered.length === 0 ? (
        <EmptyState
          title={search ? 'No materials match your search.' : 'No raw materials recorded yet.'}
          description={search ? 'Try a different search term.' : 'Use the form above to add your first material.'}
        />
      ) : (
        <ul className={styles.grid}>
          {filtered.map((m) => (
            <li key={m.id} className={styles.card}>
              <div className={styles.cardHead}>
                <span className={styles.iconWrap}><RawMaterialIcon size={18} /></span>
                <div className={styles.cardHeadText}>
                  <span className={styles.cardName}>{m.itemName}</span>
                  <span className={styles.metaLine}>{formatDate(m.date || m.createdAt)}</span>
                </div>
                <div className={styles.qtyBadge}>
                  <span className={styles.qtyValue}>{Number(m.quantity) || 0}</span>
                  <span className={styles.qtyLabel}>qty</span>
                </div>
              </div>
              {m.description ? <p className={styles.description}>{m.description}</p> : null}
              <div className={styles.metaRow}>
                <span className={styles.metaPill}>Owner only</span>
                {m.notes ? <span className={styles.metaText} title={m.notes}>Notes</span> : null}
              </div>
              <div className={styles.costRow}>
                <span className={styles.costLabel}>Purchase cost</span>
                <span className={styles.costValue}>{m.purchaseCost != null ? formatBDT(m.purchaseCost) : '—'}</span>
              </div>
              <div className={styles.cardFooter}>
                Added by {m.createdByName || 'system'} · {formatDate(m.createdAt)}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
