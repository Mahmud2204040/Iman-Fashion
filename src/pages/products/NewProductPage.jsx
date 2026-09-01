/**
 * NewProductPage — Phase 4 sidebar entry point.
 *
 * Owner-only dedicated creation form for `/products/new`. Mirrors the
 * inline form that used to live inside ProductListPage, but lives on its
 * own route so the sidebar "Add New Product" leaf has a real target.
 *
 * On success it navigates to the new product's detail page.
 */
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import {
  Button,
  Card,
  FormField,
  Input,
  PageHeader,
  Select,
  Textarea,
} from '../../components/common/index.js';
import { PackagePlusIcon } from '../../components/icons/DashboardIcon.jsx';
import { useAuth } from '../../hooks/useAuth.js';
import { createProduct } from '../../services/products/productService.js';
import styles from './NewProductPage.module.css';

const CATEGORY_OPTIONS = [
  { value: '', label: 'Select category…' },
  { value: 'Uniforms', label: 'Uniforms' },
  { value: 'Hijabs', label: 'Hijabs' },
  { value: 'Frocks', label: 'Frocks' },
  { value: 'Shoes', label: 'Shoes' },
  { value: 'Bags', label: 'Bags' },
  { value: 'Accessories', label: 'Accessories' },
  { value: 'Custom', label: 'Custom' },
];

export default function NewProductPage() {
  const { user, role } = useAuth();
  const navigate = useNavigate();
  const isOwner = role === 'OWNER';

  const [draft, setDraft] = useState({
    name: '',
    sku: '',
    category: '',
    price: '',
    purchasePrice: '',
    stock: '0',
    description: '',
  });
  const [submitBusy, setSubmitBusy] = useState(false);
  const [submitError, setSubmitError] = useState('');

  function update(field) {
    return (e) => setDraft((d) => ({ ...d, [field]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitError('');
    setSubmitBusy(true);
    try {
      const payload = {
        ...draft,
        price: draft.price === '' ? 0 : Number(draft.price),
        purchasePrice:
          draft.purchasePrice === '' ? null : Number(draft.purchasePrice),
        stock: draft.stock === '' ? 0 : Number(draft.stock),
      };
      const created = await createProduct(payload, {
        actor: { username: user?.username || 'unknown', role },
      });
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
        title="Add new product"
        description="Create a catalogue entry. You can edit prices, stock, and details afterwards."
        actions={
          <Link to="/products" className={styles.backLink}>
            ← Back to products
          </Link>
        }
      />

      {!isOwner ? (
        <Card className={styles.lockedCard}>
          <h2 className={styles.lockedTitle}>Owner-only</h2>
          <p className={styles.lockedBody}>
            Adding products is restricted to the owner role. Sign in with an
            owner account to continue.
          </p>
        </Card>
      ) : (
        <Card className={styles.formCard}>
          <div className={styles.formHead}>
            <span className={styles.formHeadIcon} aria-hidden="true">
              <PackagePlusIcon size={20} strokeWidth={1.75} />
            </span>
            <h2 className={styles.formTitle}>Product details</h2>
          </div>
          <form className={styles.form} onSubmit={handleSubmit}>
            <div className={styles.row}>
              <FormField label="Product name" htmlFor="np-name" required>
                <Input
                  id="np-name"
                  placeholder="e.g. School uniform — Navy (Class 4)"
                  value={draft.name}
                  onChange={update('name')}
                  required
                />
              </FormField>
              <FormField label="SKU" htmlFor="np-sku" required>
                <Input
                  id="np-sku"
                  placeholder="e.g. UNI-S4-NAVY"
                  value={draft.sku}
                  onChange={update('sku')}
                  required
                />
              </FormField>
              <FormField label="Category" htmlFor="np-cat">
                <Select
                  id="np-cat"
                  value={draft.category}
                  onChange={update('category')}
                >
                  {CATEGORY_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </Select>
              </FormField>
            </div>

            <div className={styles.row}>
              <FormField label="Selling price (৳)" htmlFor="np-price" required>
                <Input
                  id="np-price"
                  type="number"
                  inputMode="decimal"
                  min="1"
                  step="1"
                  placeholder="0"
                  value={draft.price}
                  onChange={update('price')}
                  required
                />
              </FormField>
              <FormField
                label="Purchase price (৳, optional)"
                htmlFor="np-pp"
                hint="Used for profit reports"
              >
                <Input
                  id="np-pp"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="1"
                  placeholder="0"
                  value={draft.purchasePrice}
                  onChange={update('purchasePrice')}
                />
              </FormField>
              <FormField label="Opening stock" htmlFor="np-stock">
                <Input
                  id="np-stock"
                  type="number"
                  inputMode="numeric"
                  min="0"
                  step="1"
                  value={draft.stock}
                  onChange={update('stock')}
                />
              </FormField>
            </div>

            <FormField label="Description" htmlFor="np-desc">
              <Textarea
                id="np-desc"
                rows={3}
                placeholder="Optional notes about fabric, sizing, or variants."
                value={draft.description}
                onChange={update('description')}
              />
            </FormField>

            {submitError ? (
              <p className={styles.formError} role="alert">
                {submitError}
              </p>
            ) : null}

            <div className={styles.formActions}>
              <Button
                type="button"
                variant="ghost"
                onClick={() => navigate('/products')}
              >
                Cancel
              </Button>
              <Button type="submit" variant="primary" disabled={submitBusy}>
                {submitBusy ? 'Creating…' : 'Create product'}
              </Button>
            </div>
          </form>
        </Card>
      )}
    </main>
  );
}
