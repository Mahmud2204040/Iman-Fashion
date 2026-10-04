import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';

import T from '../../components/common/LocalizedText.jsx';
import { ConfirmDialog, FormField, Input, Modal, SearchInput, Select, Spinner, Textarea } from '../../components/common/index.js';
import { useAuth } from '../../hooks/useAuth.js';
import { useLocale } from '../../contexts/LocaleContext.jsx';
import { adjustStock, getProducts, getStockHistory, updateProduct } from '../../services/products/productService.js';
import { formatCurrency, formatExactDate, formatExactTime } from '../../utils/format.js';
import ProductEditor from './ProductEditor.jsx';
import styles from './ProductWorkbenchPage.module.css';

function stockEntryType(entry) {
  if (entry.reason === 'OPENING_STOCK') return 'Opening stock';
  if (/^sale\b|^sold\b/i.test(entry.reason || '')) return 'Sale';
  return 'Adjustment';
}

export default function ProductWorkbenchPage() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { user, role } = useAuth();
  const { t } = useLocale();
  const [products, setProducts] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [busy, setBusy] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [editOpen, setEditOpen] = useState(false);
  const [editDraft, setEditDraft] = useState({ name: '', purchasePrice: '', description: '' });
  const [statusConfirm, setStatusConfirm] = useState(false);
  const [direction, setDirection] = useState('add');
  const [quantity, setQuantity] = useState('1');
  const [reason, setReason] = useState('');

  const creating = location.pathname === '/products/new';
  const query = params.get('q') || '';
  const stockFilter = ['all', 'available', 'out'].includes(params.get('stock')) ? params.get('stock') : 'all';
  const selected = id ? products.find((product) => product.id === id) : products[0];
  const selectedId = selected?.id;
  const actor = { username: user?.username || 'owner', role };

  const reload = useCallback(async () => {
    setLoading(true);
    setError('');
    try { setProducts(await getProducts()); }
    catch (caught) { setError(caught?.message || 'Could not load products.'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { reload(); }, [reload, reloadKey]);
  useEffect(() => {
    if (!selectedId) { setHistory([]); return undefined; }
    let cancelled = false;
    setHistoryLoading(true);
    getStockHistory(selectedId)
      .then((rows) => { if (!cancelled) setHistory(rows); })
      .catch((caught) => { if (!cancelled) setActionError(caught?.message || 'Could not load stock history.'); })
      .finally(() => { if (!cancelled) setHistoryLoading(false); });
    return () => { cancelled = true; };
  }, [selectedId]);
  useEffect(() => {
    setActionError('');
    setEditOpen(false);
    setStatusConfirm(false);
    setDirection('add');
    setQuantity('1');
    setReason('');
  }, [selectedId]);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return products.filter((product) => {
      if (stockFilter === 'available' && Number(product.stock) <= 0) return false;
      if (stockFilter === 'out' && Number(product.stock) > 0) return false;
      return !term || [product.name, product.id].some((value) => String(value || '').toLowerCase().includes(term));
    });
  }, [products, query, stockFilter]);

  function updateFilter(key, value) {
    const next = new URLSearchParams(params);
    if (!value || value === 'all') next.delete(key); else next.set(key, value);
    setParams(next, { replace: true });
  }
  function openProduct(productId) {
    navigate(`/products/${productId}${location.search}`);
  }
  function closeCreate() { navigate(`/products${location.search}`); }
  function handleCreated(product) {
    setProducts((current) => [...current, product].sort((a, b) => a.name.localeCompare(b.name)));
    navigate(`/products/${product.id}${location.search}`);
  }
  function beginEdit() {
    if (!selected) return;
    setActionError('');
    setEditDraft({ name: selected.name, purchasePrice: selected.purchasePrice == null ? '' : String(selected.purchasePrice), description: selected.description || '' });
    setEditOpen(true);
  }
  async function saveEdit(event) {
    event.preventDefault();
    if (!selected || busy) return;
    setBusy(true); setActionError('');
    try {
      const updated = await updateProduct(selected.id, editDraft, { actor });
      setProducts((current) => current.map((product) => product.id === updated.id ? updated : product).sort((a, b) => a.name.localeCompare(b.name)));
      setEditOpen(false);
    } catch (caught) { setActionError(caught?.message || 'Could not save product.'); }
    finally { setBusy(false); }
  }
  async function changeStatus() {
    if (!selected || busy) return;
    setBusy(true); setActionError('');
    try {
      const updated = await updateProduct(selected.id, { isActive: !selected.isActive }, { actor });
      setProducts((current) => current.map((product) => product.id === updated.id ? updated : product));
      setStatusConfirm(false);
    } catch (caught) { setActionError(caught?.message || 'Could not change product status.'); setStatusConfirm(false); }
    finally { setBusy(false); }
  }
  const signedDelta = (direction === 'remove' ? -1 : 1) * Number(quantity || 0);
  const projectedStock = selected ? Number(selected.stock) + signedDelta : 0;
  const validQuantity = Number.isInteger(Number(quantity)) && Number(quantity) > 0 && Number(quantity) <= 1000;
  const canAdjust = Boolean(selected && validQuantity && reason.trim() && projectedStock >= 0 && !busy);

  async function submitAdjustment(event) {
    event.preventDefault();
    if (!selected || busy) return;
    if (!validQuantity) { setActionError('Quantity must be a whole number between 1 and 1000.'); return; }
    if (!reason.trim()) { setActionError('Reason is required.'); return; }
    if (projectedStock < 0) { setActionError('Adjustment would drive stock negative.'); return; }
    setBusy(true); setActionError('');
    try {
      const result = await adjustStock(selected.id, { delta: signedDelta, reason: reason.trim() }, { actor });
      setProducts((current) => current.map((product) => product.id === result.product.id ? result.product : product));
      setHistory((current) => [result.entry, ...current]);
      setQuantity('1'); setReason('');
    } catch (caught) { setActionError(caught?.message || 'Could not adjust stock.'); }
    finally { setBusy(false); }
  }

  return <main className={styles.page}>
    <header className={styles.pageHeading}>
      <div><h1><T>Products & stock</T></h1><p><T>Finished-product catalogue and stock counts. Selling price is entered for each sale.</T></p></div>
      <Link className={styles.addButton} to={`/products/new${location.search}`}><span aria-hidden="true">＋</span><T>Add new product</T></Link>
    </header>

    <div className={styles.workbench}>
      <section className={styles.listPanel} aria-label={t('Products')}>
        <div className={styles.listHead}><h2><T>Products</T></h2><span>{products.length} <T>items</T></span></div>
        <div className={styles.listControls}>
          <SearchInput value={query} onChange={(event) => updateFilter('q', event.target.value)} placeholder="Search by name or product ID…" aria-label="Search products" />
          <Select aria-label="Stock filter" value={stockFilter} onChange={(event) => updateFilter('stock', event.target.value)} options={[{ value: 'all', label: 'All stock' }, { value: 'available', label: 'Available' }, { value: 'out', label: 'Out of stock' }]} />
        </div>
        {loading ? <div className={styles.listState}><Spinner size="sm" /><T>Loading products…</T></div>
          : error ? <div className={styles.listState} role="alert"><T>{error}</T><button type="button" onClick={() => setReloadKey((key) => key + 1)}><T>Retry</T></button></div>
            : filtered.length ? <div className={styles.productList}>{filtered.map((product) => <button key={product.id} type="button" className={`${styles.productRow} ${selected?.id === product.id ? styles.selectedRow : ''}`} aria-current={selected?.id === product.id ? 'true' : undefined} onClick={() => openProduct(product.id)}>
              <span className={styles.productText}><strong>{product.name}</strong><small>{product.id}</small></span>
              <span className={`${styles.rowStatus} ${product.isActive ? styles.rowActive : styles.rowInactive}`}><i aria-hidden="true" />{t(product.isActive ? 'Active' : 'Inactive')}</span>
              <span className={styles.rowArrow} aria-hidden="true">›</span>
            </button>)}</div>
              : <div className={styles.listState}><T>{products.length ? 'No products match' : 'Add the first product to start tracking inventory.'}</T></div>}
      </section>

      <section className={styles.detailPanel} aria-label={t('Product details')}>
        {loading ? <div className={styles.detailState}><Spinner size="sm" /><T>Loading product…</T></div>
          : !selected ? <div className={styles.detailState}><T>{id ? 'Product not found.' : 'Select a product'}</T></div>
            : <>
              <div className={styles.detailHead}>
                <div className={styles.detailIdentity}><h2>{selected.name}</h2><p>{selected.id} <span>·</span> <T>Updated</T> {formatExactDate(selected.updatedAt)}</p></div>
                <div className={styles.detailActions}>
                  <button type="button" onClick={beginEdit}><span aria-hidden="true">✎</span><T>Edit product</T></button>
                  <button type="button" className={selected.isActive ? styles.deactivate : styles.activate} onClick={() => setStatusConfirm(true)}><T>{selected.isActive ? 'Deactivate' : 'Activate'}</T></button>
                </div>
              </div>
              <div className={styles.notesPanel}><strong><T>Notes</T></strong><p>{selected.description || t('No notes added.')}</p></div>
              {actionError ? <p className={styles.error} role="alert"><T>{actionError}</T></p> : null}
              <div className={styles.summary}>
                <div className={styles.summaryCard}><span className={styles.summaryIcon} aria-hidden="true">⬡</span><span><small><T>Current stock</T></small><strong>{selected.stock}</strong><em>{historyLoading ? '…' : history.length} <T>ledger entries</T></em></span></div>
                <div className={styles.summaryCard}><span className={styles.summaryIcon} aria-hidden="true">◇</span><span><small><T>Purchase cost</T></small><strong>{selected.purchasePrice == null ? t('Not recorded') : formatCurrency(selected.purchasePrice)}</strong></span></div>
                <div className={styles.summaryCard}><span className={styles.summaryIcon} aria-hidden="true">▣</span><span><small><T>Created at</T></small><strong>{formatExactDate(selected.createdAt)}</strong><em><T>by</T> {selected.createdBy || 'unknown'}</em></span></div>
              </div>
              <div className={styles.lowerGrid}>
                <section className={styles.adjustCard} aria-labelledby="product-adjust-heading">
                  <div className={styles.cardHead}><div><h3 id="product-adjust-heading"><T>Adjust stock</T></h3><p><T>Add or remove stock. A reason is required.</T></p></div><button type="button" className={styles.preset} onClick={() => setReason('OPENING_STOCK')}>OPENING_STOCK</button></div>
                  <div className={styles.direction} role="group" aria-label={t('Adjustment direction')}><button type="button" className={direction === 'add' ? styles.directionActive : ''} aria-pressed={direction === 'add'} onClick={() => setDirection('add')}><T>+ Add stock</T></button><button type="button" className={direction === 'remove' ? styles.directionActive : ''} aria-pressed={direction === 'remove'} onClick={() => setDirection('remove')}><T>− Remove stock</T></button></div>
                  <form onSubmit={submitAdjustment}>
                    <div className={styles.adjustFields}>
                      <FormField label="Quantity" htmlFor="stock-quantity" required>{(control) => <Input {...control} type="number" min="1" max="1000" step="1" value={quantity} onChange={(event) => setQuantity(event.target.value)} required />}</FormField>
                      <div className={styles.projectedField}><span><T>Projected stock:</T></span><output className={styles.projectedValue}>{projectedStock}</output></div>
                    </div>
                    <FormField className={styles.reasonField} label="Reason" htmlFor="stock-reason" required>{(control) => <Input {...control} value={reason} onChange={(event) => setReason(event.target.value)} maxLength={120} placeholder="e.g. Purchase from supplier" required />}</FormField>
                    <div className={styles.adjustFooter}><button className={styles.applyButton} type="submit" disabled={!canAdjust}>{busy ? t('Saving…') : `${t('Apply')} ${signedDelta > 0 ? '+' : ''}${signedDelta || 0} ${t('to stock')}`}</button></div>
                  </form>
                </section>
                <section className={styles.historyCard} aria-labelledby="product-history-heading">
                  <div className={styles.cardHead}><h3 id="product-history-heading"><T>Stock history</T></h3><span className={styles.historyCount}>{history.length} <T>entries</T></span></div>
                  {historyLoading ? <div className={styles.historyState}><Spinner size="sm" /></div> : history.length ? <div className={styles.historyScroll}><table><thead><tr><th><T>Date & time</T></th><th><T>Type</T></th><th><T>Quantity</T></th><th><T>By</T></th></tr></thead><tbody>{history.map((entry) => <tr key={entry.id}><td><time dateTime={entry.createdAt}>{formatExactDate(entry.createdAt)}<small>{formatExactTime(entry.createdAt)}</small></time></td><td><span className={`${styles.historyType} ${entry.delta >= 0 ? styles.historyIn : styles.historyOut}`} title={entry.reason}>{t(stockEntryType(entry))}</span>{stockEntryType(entry) === 'Adjustment' ? <small className={styles.historyReason}>{entry.reason}</small> : null}</td><td className={entry.delta >= 0 ? styles.positive : styles.negative}>{entry.delta > 0 ? '+' : ''}{entry.delta}</td><td>{entry.createdBy || 'unknown'}</td></tr>)}</tbody></table></div> : <p className={styles.historyEmpty}><T>No stock changes yet.</T></p>}
                </section>
              </div>
            </>}
      </section>
    </div>

    <Modal open={creating} onClose={closeCreate} className={styles.createDialog} labelledBy="inventory-modal-title"><ProductEditor onCreated={handleCreated} onCancel={closeCreate} /></Modal>
    <Modal open={editOpen} onClose={busy ? undefined : () => setEditOpen(false)} title="Edit product" size="md" className={styles.editDialog}><form className={styles.editForm} onSubmit={saveEdit}>
      <FormField label="Product name" htmlFor="workbench-edit-name" required>{(control) => <Input {...control} value={editDraft.name} onChange={(event) => setEditDraft((current) => ({ ...current, name: event.target.value }))} required />}</FormField>
      <FormField label="Purchase cost (৳)" htmlFor="workbench-edit-cost">{(control) => <Input {...control} type="number" min="0" step="0.01" value={editDraft.purchasePrice} onChange={(event) => setEditDraft((current) => ({ ...current, purchasePrice: event.target.value }))} />}</FormField>
      <FormField label="Notes" htmlFor="workbench-edit-notes">{(control) => <Textarea {...control} rows={3} value={editDraft.description} onChange={(event) => setEditDraft((current) => ({ ...current, description: event.target.value }))} />}</FormField>
      {actionError ? <p className={styles.error} role="alert"><T>{actionError}</T></p> : null}
      <div className={styles.editActions}><button type="button" onClick={() => setEditOpen(false)} disabled={busy}><T>Cancel</T></button><button type="submit" disabled={busy}>{busy ? t('Saving…') : t('Save changes')}</button></div>
    </form></Modal>
    <ConfirmDialog open={statusConfirm} onClose={() => setStatusConfirm(false)} onConfirm={changeStatus} loading={busy} title={selected?.isActive ? 'Deactivate product?' : 'Activate product?'} message={selected?.isActive ? 'This product will be hidden from new sales. Its history will remain available.' : 'This product will be available for new sales again.'} confirmText={selected?.isActive ? 'Deactivate' : 'Activate'} tone={selected?.isActive ? 'danger' : 'normal'} />
  </main>;
}
