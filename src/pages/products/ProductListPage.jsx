import T from '../../components/common/LocalizedText.jsx';
/**
 * ProductListPage — Phase 8.
 *
 * Owner-only. Shows the catalogue as a card grid with:
 *   - search across name / product ID / category
 *   - status filter (all / active / inactive)
 *   - per-card stock count (plain number, no colour bands per spec)
 *   - "Add product" CTA opens the dedicated creation page
 *
 * Clicking a card opens the detail page.
 */
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import {
  Button,
  Card,
  EmptyState,
  PageHeader,
  SearchInput,
  Select,
  Spinner,
} from '../../components/common/index.js';
import { ProductIcon } from '../../components/icons/DashboardIcon.jsx';
import { useAuth } from '../../hooks/useAuth.js';
import { getProducts } from '../../services/products/productService.js';
import { formatCurrency, timeAgo } from '../../utils/format.js';
import styles from './ProductListPage.module.css';

export default function ProductListPage() {
  const { role } = useAuth();
  const isOwner = role === 'OWNER';
  const navigate = useNavigate();

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [stockFilter, setStockFilter] = useState('all');
  const [error, setError] = useState('');

  function reload() {
    setLoading(true);
    getProducts()
      .then((rows) => setProducts(rows))
      .catch((err) => setError(err?.message || 'Could not load products.'))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    reload();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((p) => {
      if (statusFilter === 'active' && !p.isActive) return false;
      if (statusFilter === 'inactive' && p.isActive) return false;
      if (stockFilter === 'available' && Number(p.stock || 0) <= 0) return false;
      if (stockFilter === 'out' && Number(p.stock || 0) > 0) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.id.toLowerCase().includes(q) ||
        (p.sku || '').toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q)
      );
    });
  }, [products, query, statusFilter, stockFilter]);

  const counts = useMemo(() => {
    const total = products.length;
    const active = products.filter((p) => p.isActive).length;
    const inactive = total - active;
    return { total, active, inactive };
  }, [products]);

  return (
    <main className={styles.page}>
      <PageHeader
        eyebrow="Inventory"
        title="Products & stock"
        description={
          isOwner
            ? 'Finished-product catalogue and stock counts. Selling price is entered for each sale.'
            : 'Owner-only module. Browse is restricted to owner role.'
        }
        actions={
          isOwner ? (
            <Button
              type="button"
              variant="primary"
              onClick={() => navigate('/products/new')}
            ><T>
              + Add product
            </T></Button>
          ) : null
        }
      />

      <Card className={styles.controlsCard}>
        <div className={styles.searchRow}>
          <SearchInput
            placeholder="Search by name, product ID, or category"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            inputClassName={styles.searchInput}
          />
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className={styles.statusSelect}
            aria-label="Status filter"
            options={[
              { value: 'all', label: `All (${counts.total})` },
              { value: 'active', label: `Active (${counts.active})` },
              { value: 'inactive', label: `Inactive (${counts.inactive})` },
            ]}
          />
          <Select value={stockFilter} onChange={(event) => setStockFilter(event.target.value)} className={styles.statusSelect} aria-label="Stock filter" options={[{ value: 'all', label: 'All stock' }, { value: 'available', label: 'Available' }, { value: 'out', label: 'Out of stock' }]} />
        </div>
      </Card>

      {error ? <p role="alert"><T>{error}</T> <button type="button" onClick={reload}><T>Retry</T></button></p> : loading ? (
        <div className={styles.loading}>
          <Spinner /> <span><T>Loading products…</T></span>
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<ProductIcon size={28} strokeWidth={1.6} />}
          title="No products match"
          description={
            query
              ? 'Try a different search term.'
              : 'Add the first product to start tracking inventory.'
          }
          action={
            isOwner && !query ? (
              <Button type="button" variant="primary" onClick={() => navigate('/products/new')}><T>
                Add product
              </T></Button>
            ) : null
          }
        />
      ) : (
        <ul className={styles.grid}>
          {filtered.map((p) => (
            <li key={p.id}>
              <Link to={`/products/${p.id}`} className={styles.card}>
                <div className={styles.cardHead}>
                  <div className={styles.iconWrap}>
                    <ProductIcon size={20} strokeWidth={1.6} />
                  </div>
                  <div className={styles.cardHeadText}>
                    <strong className={styles.cardName}>{p.name}</strong>
                    <span className={styles.sku}>{p.id}</span>
                  </div>
                  <span
                    className={[
                      styles.statusDot,
                      p.isActive ? styles.dotActive : styles.dotInactive,
                    ].join(' ')}
                    aria-hidden="true"
                  />
                </div>
                <div className={styles.cardMeta}>
                  <span className={styles.category}>{p.category || 'Uncategorized'}</span>
                  <span className={styles.dotSep}>·</span>
                  <span><T>Updated </T>{timeAgo(p.updatedAt)}</span>
                </div>
                <div className={styles.cardFooter}>
                  <div className={styles.priceCell}>
                    <span className={styles.cellLabel}><T>Purchase cost</T></span>
                    <strong>{p.purchasePrice == null ? '—' : formatCurrency(p.purchasePrice)}</strong>
                  </div>
                  <div className={styles.stockCell}>
                    <span className={styles.cellLabel}><T>Stock</T></span>
                    <strong className={styles.stockNumber}>{p.stock}</strong>
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
