import T from '../../components/common/LocalizedText.jsx';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
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
import { getRawMaterials, updateRawMaterial } from '../../services/rawMaterials/rawMaterialService.js';
import { formatCurrency, formatLongDate } from '../../utils/format.js';
import { cashBusinessDate } from '../../utils/cashDate.js';
const formatBDT = (v) => formatCurrency(v, { currency: 'BDT', maximumFractionDigits: 0 });
const formatDate = (d) => formatLongDate(d);
import { RawMaterialIcon } from '../../components/icons/DashboardIcon.jsx';
import styles from './RawMaterialsPage.module.css';

const today = () => cashBusinessDate();

const emptyForm = { name: '', quantity: '', description: '', date: today(), purchaseCost: '' };

export default function RawMaterialsPage() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const refresh = async () => {
    setLoading(true);
    try {
      const data = await getRawMaterials();
      setItems(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err?.message || 'Could not load raw materials.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refresh(); }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((m) =>
      [m.itemName, m.description].filter(Boolean).some((v) => v.toLowerCase().includes(q))
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
      await updateRawMaterial(editingId,
        {
          itemName: form.name.trim(),
          quantity: qty,
          description: form.description.trim() || null,
          date: form.date || today(),
          purchaseCost: form.purchaseCost === '' ? null : Number(form.purchaseCost),
        },
        { actor: user }
      );
      setEditingId(null);
      setForm(emptyForm);
      await refresh();
    } catch (err) {
      setError(err?.message || 'Could not save raw material.');
    } finally {
      setSaving(false);
    }
  };

  function startEdit(item) {
    setEditingId(item.id);
    setForm({ name: item.itemName, quantity: String(item.quantity), description: item.description || '', date: item.date, purchaseCost: item.purchaseCost == null ? '' : String(item.purchaseCost) });
    setError('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  return (
    <div className={styles.page}>
      <PageHeader title="Raw Materials" subtitle="Owner-only record keeping for materials, fabrics and supplies. Separate from finished product stock." />

      <div className={styles.banner} role="note">
        <RawMaterialIcon size={16} />
        <span>
          <strong><T>Owner only.</T></strong><T> Adding raw materials here does not adjust finished product stock or shop cash. Use Product stock and Cash pages for those.
        </T></span>
      </div>

      <Card>
        <div className={styles.totalsRow}>
          <div>
            <span className={styles.qtyLabel}><T>Records</T></span>
            <span className={styles.costValue}>{totals.records}</span>
          </div>
          <div>
            <span className={styles.qtyLabel}><T>Total Quantity</T></span>
            <span className={styles.costValue}>{totals.quantity}</span>
          </div>
          <div>
            <span className={styles.qtyLabel}><T>Recorded Spend</T></span>
            <span className={styles.costValue}>{formatBDT(totals.spend)}</span>
          </div>
        </div>
      </Card>

      <Card>
        <h2 className={styles.formTitle}><T>{editingId ? 'Edit raw material' : 'Add raw material'}</T></h2>
        {editingId ? <form className={styles.form} onSubmit={handleSubmit}>
          {error ? <p className={styles.formError}><T>{error}</T></p> : null}
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
          <FormField label="Purchase cost (৳, optional)" htmlFor="rm-cost">
            {(controlProps) => (
              <Input id="rm-cost" name="purchaseCost" type="number" min="0" step="0.01" value={form.purchaseCost} onChange={update('purchaseCost')} placeholder="0.00" {...controlProps} />
            )}
          </FormField>
          <div className={styles.formActions}>
            <Button type="button" variant="ghost" onClick={() => { setEditingId(null); setForm(emptyForm); }} disabled={saving}><T>Cancel edit</T></Button>
            <Button type="submit" variant="primary" disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</Button>
          </div>
        </form> : <p><T>Use the dedicated form for a new record. </T><Link to="/raw-materials/new"><T>+ New raw material</T></Link></p>}
      </Card>

      <Card>
        <div className={styles.controlsCard}>
          <SearchInput value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name or description…" />
        </div>
      </Card>

      {loading ? (
        <div className={styles.loading}><Spinner size={20} /><T> Loading materials…</T></div>
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
                  <span className={styles.qtyLabel}><T>qty</T></span>
                </div>
              </div>
              {m.description ? <p className={styles.description}>{m.description}</p> : null}
              <div className={styles.costRow}>
                <span className={styles.costLabel}><T>Purchase cost</T></span>
                <span className={styles.costValue}>{m.purchaseCost != null ? formatBDT(m.purchaseCost) : '—'}</span>
              </div>
              <div className={styles.cardFooter}><T>
                Added by </T>{m.createdBy || 'unknown'} · {formatDate(m.createdAt)}
                {' · '}<button type="button" onClick={() => startEdit(m)}><T>Edit</T></button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
