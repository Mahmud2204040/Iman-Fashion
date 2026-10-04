import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';

import T from '../../components/common/LocalizedText.jsx';
import { Modal, SearchInput, Select, Spinner } from '../../components/common/index.js';
import { useLocale } from '../../contexts/LocaleContext.jsx';
import { getProducts } from '../../services/products/productService.js';
import { formatCurrency, formatExactDate } from '../../utils/format.js';
import ProductEditor from './ProductEditor.jsx';
import plusIcon from '../../assets/figma/inventory/3ba17.svg';
import searchIcon from '../../assets/figma/inventory/efb81.svg';
import chevronDown from '../../assets/figma/inventory/f1f70.svg';
import lockIcon from '../../assets/figma/inventory/ceb97.svg';
import packageIcon from '../../assets/figma/inventory/93483.svg';
import activeDot from '../../assets/figma/inventory/0b381.svg';
import chevronRight from '../../assets/figma/inventory/5332e.svg';
import styles from './InventoryWorkspace.module.css';

export default function ProductInventoryPage() {
  const { t } = useLocale();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const creating = location.pathname === '/products/new';
  const query = searchParams.get('q') || '';
  const status = searchParams.get('status') || 'all';
  const stock = searchParams.get('stock') || 'all';
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError('');
    getProducts()
      .then((rows) => { if (!cancelled) setProducts(rows); })
      .catch((caught) => { if (!cancelled) setError(caught?.message || 'Could not load products.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [reloadKey]);

  const counts = useMemo(() => ({
    total: products.length,
    active: products.filter((item) => item.isActive).length,
    inactive: products.filter((item) => !item.isActive).length,
    stock: products.reduce((sum, item) => sum + Number(item.stock || 0), 0),
  }), [products]);
  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return products.filter((item) => {
      if (status === 'active' && !item.isActive) return false;
      if (status === 'inactive' && item.isActive) return false;
      if (stock === 'available' && Number(item.stock || 0) <= 0) return false;
      if (stock === 'out' && Number(item.stock || 0) > 0) return false;
      return !term || [item.name, item.id, item.sku, item.category].some((value) => String(value || '').toLowerCase().includes(term));
    });
  }, [products, query, status, stock]);

  function updateFilter(key, value) {
    const next = new URLSearchParams(searchParams);
    if (!value || value === 'all') next.delete(key); else next.set(key, value);
    setSearchParams(next, { replace: true });
  }
  const closeCreate = useCallback(() => navigate(`/products${location.search}`), [navigate, location.search]);
  const handleCreated = useCallback((created) => {
    setProducts((current) => [...current, created].sort((a, b) => a.name.localeCompare(b.name)));
    navigate(`/products${location.search}`);
  }, [navigate, location.search]);

  return <main className={styles.page}>
    <header className={styles.pageHeading}>
      <div><h1><T>Products & stock</T></h1><p><T>Finished-product catalogue and stock counts. Selling price is entered for each sale.</T></p></div>
      <div className={styles.headingStat}><strong>{counts.stock} <T>items in stock</T></strong><small>{counts.total} <T>products</T> · {counts.inactive ? `${counts.active} ${t('active')}` : t('All active')}</small></div>
    </header>
    <section className={styles.registry} aria-labelledby="products-registry-heading">
      <div className={styles.registryHead}>
        <div><h2 id="products-registry-heading"><T>Product catalogue</T></h2><p><T>Browse finished products and current stock.</T></p></div>
        <div className={styles.registryActions}><span className={styles.countPill}>{counts.total} <T>products</T></span><Link className={styles.addButton} to={`/products/new${location.search}`}><img src={plusIcon} alt="" /><T>Add new</T></Link></div>
      </div>
      <div className={styles.controls}>
        <SearchInput className={styles.search} icon={<img src={searchIcon} alt="" />} placeholder="Search by name, product ID, or category" aria-label="Search products" value={query} onChange={(event) => updateFilter('q', event.target.value)} />
        <span className={styles.filterWrap}><Select aria-label="Status filter" value={status} onChange={(event) => updateFilter('status', event.target.value)} options={[{ value:'all', label:`${t('All')} (${counts.total})` }, { value:'active', label:`${t('Active')} (${counts.active})` }, { value:'inactive', label:`${t('Inactive')} (${counts.inactive})` }]} /><img src={chevronDown} alt="" /></span>
        <span className={styles.filterWrap}><Select aria-label="Stock filter" value={stock} onChange={(event) => updateFilter('stock', event.target.value)} options={[{ value:'all', label:t('All stock') }, { value:'available', label:t('Available') }, { value:'out', label:t('Out of stock') }]} /><img src={chevronDown} alt="" /></span>
      </div>
      <div className={`${styles.tableHead} ${styles.productColumns}`} aria-hidden="true"><span><T>Product</T></span><span><T>Category</T></span><span><T>Updated</T></span><span><T>Stock</T></span><span className={styles.costNotice}><img src={lockIcon} alt="" /><T>Purchase cost</T></span><span /></div>
      {loading ? <div className={styles.state} aria-busy="true"><Spinner size="sm" /><T>Loading products…</T></div>
        : error ? <div className={styles.state} role="alert"><T>{error}</T><button type="button" onClick={() => setReloadKey((key) => key + 1)}><T>Retry</T></button></div>
          : filtered.length ? <div>{filtered.map((item) => <Link key={item.id} to={`/products/${item.id}`} className={`${styles.productRow} ${styles.productColumns}`}>
            <span className={styles.productMain}><span className={styles.productIcon}><img src={packageIcon} alt="" /></span><span className={styles.mainText}><strong title={item.name}>{item.name}</strong><small>{item.id} · {item.isActive ? <><img src={activeDot} alt="" /><span className={styles.active}>{t('Active')}</span></> : <span className={styles.inactive}>{t('Inactive')}</span>}</small></span></span>
            <span className={styles.mutedCell}><span className={styles.mobileLabel}><T>Category</T></span>{item.category || t('Uncategorized')}</span>
            <span className={styles.mutedCell}><span className={styles.mobileLabel}><T>Updated</T></span>{formatExactDate(item.updatedAt)}</span>
            <span className={styles.stockCell}><span className={styles.mobileLabel}><T>Stock</T></span>{item.stock}</span>
            <span className={styles.costCell}><span className={styles.mobileLabel}><T>Purchase cost</T></span>{item.purchasePrice == null ? '—' : formatCurrency(item.purchasePrice)}</span>
            <span className={styles.openCell}><img src={chevronRight} alt="" /></span>
          </Link>)}</div>
            : <div className={styles.state}><strong><T>No products match</T></strong><span><T>{query || status !== 'all' || stock !== 'all' ? 'Try a different search term or filter.' : 'Add the first product to start tracking inventory.'}</T></span></div>}
      <footer className={styles.tableFoot}><span className={styles.costNotice}><img src={lockIcon} alt="" /><T>Purchase cost is owner-only. A dash means the cost is unknown.</T></span><span>{t('Showing')} {filtered.length} {t('of')} {counts.total}</span></footer>
    </section>
    <Modal open={creating} onClose={closeCreate} className={`${styles.dialog} ${styles.productDialog}`} labelledBy="inventory-modal-title"><ProductEditor onCreated={handleCreated} onCancel={closeCreate} /></Modal>
  </main>;
}
