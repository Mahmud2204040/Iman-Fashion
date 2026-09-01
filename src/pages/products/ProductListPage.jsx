/**
 * ProductListPage — Phase 8.
 *
 * Owner-only. Shows the catalogue as a card grid with:
 *   - search across name / sku / category
 *   - status filter (all / active / inactive)
 *   - per-card stock count (plain number, no colour bands per spec)
 *   - "Add product" CTA opens an inline creation form
 *
 * Clicking a card opens the detail page.
 */
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import {
  Button,
  Card,
  EmptyState,
  FormField,
  Input,
  PageHeader,
  SearchInput,
  Select,
  Spinner,
} from '../../components/common/index.js';
import { ProductIcon } from '../../components/icons/DashboardIcon.jsx';
import { useAuth } from '../../hooks/useAuth.js';
import {
  createProduct,
  getProducts,
} from '../../services/products/productService.js';
import { formatCurrency, timeAgo } from '../../utils/format.js';
import styles from './ProductListPage.module.css';

export default function ProductListPage() {
  const { user, role } = useAuth();
  const isOwner = role === 'OWNER';
  const navigate = useNavigate();

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const [formOpen, setFormOpen] = useState(false);
  const [submitBusy, setSubmitBusy] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [draft, setDraft] = useState({
    name: '',
    sku: '',
    category: '',
    price: '',
    stock: '0',
    description: '',
  });

  function reload() {
    setLoading(true);
    getProducts()
      .then((rows) => setProducts(rows))
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
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q)
      );
    });
  }, [products, query, statusFilter]);

  const counts = useMemo(() => {
    const total = products.length;
    const active = products.filter((p) => p.isActive).length;
    const inactive = total - active;
    return { total, active, inactive };
  }, [products]);

  async function handleCreate(e) {
    e.preventDefault();
    setSubmitError('');
    setSubmitBusy(true);
    try {
      const created = await createProduct(
        {
          ...draft,
          price: draft.price === '' ? 0 : Number(draft.price),
          stock: draft.stock === '' ? 0 : Number(draft.stock),
        },
        { actor: { username: user?.username || 'unknown', role } },
      );
      setFormOpen(false);
      setDraft({ name: '', sku: '', category: '', price: '', stock: '0', description: '' });
      reload();
      navigate(`/products/${created.id}`);
    } catch (err_) {
      setSubmitError(err_?.message || 'Could not create product.');
    } finally {
      setSubmitBusy(false);
    }
  }

  return (
    <main className={styles.page}>
      <PageHeader
        eyebrow="Inventory"
        title="Products & stock"
        description={
          isOwner
            ? 'Catalogue, prices, and stock counts. Adjust stock with a free-text reason.'
            : 'Owner-only module. Browse is restricted to owner role.'
        }
        actions={
          isOwner ? (
            <Button
              type="button"
              variant={formOpen ? 'ghost' : 'primary'}
              onClick={() => setFormOpen((v) => !v)}
            >
              {formOpen ? 'Close form' : '+ Add product'}
            </Button>
          ) : null
        }
      />

      {formOpen && isOwner ? (
        <Card className={styles.formCard}>
          <h2 className={styles.formTitle}>New product</h2>
          <form className={styles.form} onSubmit={handleCreate}>
            <div className={styles.row}>
              <FormField label="Product name" htmlFor="prd-name" required>
                <Input
                  id="prd-name"
                  placeholder="e.g. School uniform — Navy (Class 4)"
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  required
                />
              </FormField>
              <FormField label="SKU" htmlFor="prd-sku" required>
                <Input
                  id="prd-sku"
                  placeholder="e.g. UNI-S4-NAVY"
                  value={draft.sku}
                  onChange={(e) => setDraft({ ...draft, sku: e.target.value })}
                  required
                />
              </FormField>
              <FormField label="Category" htmlFor="prd-cat">
                <Input
                  id="prd-cat"
                  placeholder="Uniforms, Hijabs, …"
                  value={draft.category}
                  onChange={(e) => setDraft({ ...draft, category: e.target.value })}
                />
              </FormField>
            </div>
            <div className={styles.row}>
              <FormField label="Price (৳)" htmlFor="prd-price" required>
                <Input
                  id="prd-price"
                  type="number"
                  inputMode="decimal"
                  min="1"
                  step="1"
                  placeholder="0"
                  value={draft.price}
                  onChange={(e) => setDraft({ ...draft, price: e.target.value })}
                  required
                />
              </FormField>
              <FormField label="Opening stock" htmlFor="prd-stock">
                <Input
                  id="prd-stock"
                  type="number"
                  inputMode="numeric"
                  min="0"
                  step="1"
                  value={draft.stock}
                  onChange={(e) => setDraft({ ...draft, stock: e.target.value })}
                />
              </FormField>
            </div>
            <FormField label="Description" htmlFor="prd-desc">
              <Input
                id="prd-desc"
                placeholder="Optional"
                value={draft.description}
                onChange={(e) => setDraft({ ...draft, description: e.target.value })}
              />
            </FormField>
            {submitError ? (
              <p className={styles.formError} role="alert">
                {submitError}
              </p>
            ) : null}
            <div className={styles.formActions}>
              <Button type="submit" variant="primary" disabled={submitBusy}>
                {submitBusy ? 'Creating…' : 'Create product'}
              </Button>
            </div>
          </form>
        </Card>
      ) : null}

      <Card className={styles.controlsCard}>
        <div className={styles.searchRow}>
          <SearchInput
            placeholder="Search by name, SKU, or category"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            inputClassName={styles.searchInput}
          />
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className={styles.statusSelect}
            aria-label="Status filter"
          >
            <option value="all">All ({counts.total})</option>
            <option value="active">Active ({counts.active})</option>
            <option value="inactive">Inactive ({counts.inactive})</option>
          </Select>
        </div>
      </Card>

      {loading ? (
        <div className={styles.loading}>
          <Spinner /> <span>Loading products…</span>
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<ProductIcon size={28} strokeWidth={1.6} />}
          title="No products match"
          body={
            query
              ? 'Try a different search term.'
              : 'Add the first product to start tracking inventory.'
          }
          action={
            isOwner && !query ? (
              <Button type="button" variant="primary" onClick={() => setFormOpen(true)}>
                Add product
              </Button>
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
                    <span className={styles.sku}>{p.sku}</span>
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
                  <span>Updated {timeAgo(p.updatedAt)}</span>
                </div>
                <div className={styles.cardFooter}>
                  <div className={styles.priceCell}>
                    <span className={styles.cellLabel}>Price</span>
                    <strong>{formatCurrency(p.price)}</strong>
                  </div>
                  <div className={styles.stockCell}>
                    <span className={styles.cellLabel}>Stock</span>
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
