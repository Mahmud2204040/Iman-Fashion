import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';

import T from '../../components/common/LocalizedText.jsx';
import { Modal, SearchInput, Spinner } from '../../components/common/index.js';
import { useLocale } from '../../contexts/LocaleContext.jsx';
import { getRawMaterials } from '../../services/rawMaterials/rawMaterialService.js';
import { formatCurrency, formatExactDate } from '../../utils/format.js';
import RawMaterialEditor from './RawMaterialEditor.jsx';
import infoIcon from '../../assets/figma/inventory/c27d1.svg';
import plusIcon from '../../assets/figma/inventory/3ba17.svg';
import searchIcon from '../../assets/figma/inventory/efb81.svg';
import pencilIcon from '../../assets/figma/inventory/7e04a.svg';
import styles from '../products/InventoryWorkspace.module.css';

export default function RawMaterialInventoryPage() {
  const { t } = useLocale();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const creating = location.pathname === '/raw-materials/new';
  const search = searchParams.get('q') || '';
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [editingId, setEditingId] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError('');
    getRawMaterials()
      .then((rows) => { if (!cancelled) setItems(Array.isArray(rows) ? rows : []); })
      .catch((caught) => { if (!cancelled) setError(caught?.message || 'Could not load raw materials.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [reloadKey]);

  const totals = useMemo(() => ({
    records: items.length,
    quantity: items.reduce((sum, item) => sum + Number(item.quantity || 0), 0),
    spend: items.reduce((sum, item) => sum + Number(item.purchaseCost || 0), 0),
  }), [items]);
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return term ? items.filter((item) => [item.itemName, item.description].some((value) => String(value || '').toLowerCase().includes(term))) : items;
  }, [items, search]);
  const editing = items.find((item) => item.id === editingId) || null;
  const closeEditor = useCallback(() => {
    setEditingId(null);
    if (creating) navigate(`/raw-materials${location.search}`);
  }, [creating, location.search, navigate]);
  const handleSaved = useCallback(() => {
    setEditingId(null);
    setReloadKey((key) => key + 1);
    if (creating) navigate(`/raw-materials${location.search}`);
  }, [creating, location.search, navigate]);
  function updateSearch(value) {
    const next = new URLSearchParams(searchParams);
    if (value) next.set('q', value); else next.delete('q');
    setSearchParams(next, { replace:true });
  }

  return <main className={styles.page}>
    <header className={styles.pageHeading}>
      <div><h1><T>Raw material stock</T></h1><p><T>Owner-only recordkeeping for materials, fabrics and supplies. Separate from finished product stock.</T></p></div>
    </header>
    <div className={styles.notice} role="note"><img src={infoIcon} alt="" /><span><T>Owner only. Adding raw materials here does not adjust finished product stock or shop cash. Use Product stock and Cash pages for those.</T></span></div>
    <section className={styles.registry} aria-labelledby="material-registry-heading">
      <div className={styles.registryHead}>
        <div><h2 id="material-registry-heading"><T>Raw material records</T></h2><p><T>Materials, quantities and recorded purchase costs.</T></p></div>
        <div className={styles.registryActions}><span className={styles.countPill}>{totals.records} <T>records</T></span><Link className={styles.addButton} to={`/raw-materials/new${location.search}`}><img src={plusIcon} alt="" /><T>Add new raw material</T></Link></div>
      </div>
      <div className={styles.summary}>
        <div className={styles.summaryGroup}><span><T>Total quantity</T></span><strong>{totals.quantity}</strong></div>
        <div className={styles.summaryGroup}><span><T>Recorded spend</T></span><strong>{formatCurrency(totals.spend)}</strong></div>
      </div>
      <div className={styles.controls}><SearchInput className={styles.search} icon={<img src={searchIcon} alt="" />} value={search} onChange={(event) => updateSearch(event.target.value)} placeholder="Search by name or description" aria-label="Search raw materials" /></div>
      <div className={`${styles.tableHead} ${styles.rawColumns}`} aria-hidden="true"><span><T>Material / description</T></span><span><T>Date / added by</T></span><span><T>Quantity</T></span><span><T>Purchase cost</T></span><span><T>Action</T></span></div>
      {loading ? <div className={styles.state} aria-busy="true"><Spinner size="sm" /><T>Loading materials…</T></div>
        : error ? <div className={styles.state} role="alert"><T>{error}</T><button type="button" onClick={() => setReloadKey((key) => key + 1)}><T>Retry</T></button></div>
          : filtered.length ? <div>{filtered.map((item) => <div key={item.id} className={`${styles.rawRow} ${styles.rawColumns}`}>
            <div className={styles.rawMain}><strong>{item.itemName}</strong><span>{item.description || '—'}</span></div>
            <div className={styles.dateCell}><span className={styles.mobileLabel}><T>Date / added by</T></span><span>{formatExactDate(item.date || item.createdAt)}</span><small>{t('Added by')} {item.createdBy || '—'} · {formatExactDate(item.createdAt)}</small></div>
            <div className={styles.rawQuantity}><span className={styles.mobileLabel}><T>Quantity</T></span>{item.quantity}</div>
            <div className={styles.costCell}><span className={styles.mobileLabel}><T>Purchase cost</T></span>{item.purchaseCost == null ? '—' : formatCurrency(item.purchaseCost)}</div>
            <button type="button" className={styles.editButton} onClick={() => setEditingId(item.id)}><img src={pencilIcon} alt="" /><T>Edit</T></button>
          </div>)}</div>
            : <div className={styles.state}><strong><T>{search ? 'No materials match your search.' : 'No raw materials recorded yet.'}</T></strong><span><T>{search ? 'Try a different search term.' : 'Add your first material to begin recording it here.'}</T></span></div>}
      <footer className={styles.tableFoot}><span><T>Purchase costs are recorded amounts, not unit prices or cash transactions.</T></span><span>{t('Showing')} {filtered.length} {t('of')} {totals.records}</span></footer>
    </section>
    <Modal open={creating || Boolean(editing)} onClose={closeEditor} className={styles.dialog} labelledBy="inventory-modal-title">
      <RawMaterialEditor key={editing?.id || 'new'} item={editing} onSaved={handleSaved} onCancel={closeEditor} />
    </Modal>
  </main>;
}
