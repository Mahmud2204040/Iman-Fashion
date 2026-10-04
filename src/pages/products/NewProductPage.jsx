import T from '../../components/common/LocalizedText.jsx';
/**
 * NewProductPage — Phase 4 sidebar entry point.
 *
 * Owner-only creation form for `/products/new`.
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

export default function NewProductPage() {
  const { user, role } = useAuth();
  const navigate = useNavigate();
  const isOwner = role === 'OWNER';

  const [draft, setDraft] = useState({
    name: '',
    purchasePrice: '',
    notes: '',
    openingStock: '',
    status: 'ACTIVE',
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
        name: draft.name.trim(),
        purchasePrice:
          draft.purchasePrice === '' ? null : Number(draft.purchasePrice),
        description: draft.notes.trim(),
        isActive: draft.status === 'ACTIVE',
        stock: draft.openingStock === '' ? 0 : Number(draft.openingStock),
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
        description="Create a finished product and, if needed, record opening stock in the same step."
        actions={
          <Link to="/products" className={styles.backLink}><T>
            ← Back to products
          </T></Link>
        }
      />

      {!isOwner ? (
        <Card className={styles.lockedCard}>
          <h2 className={styles.lockedTitle}><T>Owner-only</T></h2>
          <p className={styles.lockedBody}><T>
            Adding products is restricted to the owner role. Sign in with an
            owner account to continue.
          </T></p>
        </Card>
      ) : (
        <Card className={styles.formCard}>
          <div className={styles.formHead}>
            <span className={styles.formHeadIcon} aria-hidden="true">
              <PackagePlusIcon size={20} strokeWidth={1.75} />
            </span>
            <h2 className={styles.formTitle}><T>Product details</T></h2>
          </div>
          <form className={styles.form} onSubmit={handleSubmit}>
            <div className={styles.row}>
              <FormField label="Product name" htmlFor="np-name" required>
                {(controlProps) => (
                  <Input
                    {...controlProps}
                    placeholder="e.g. Navy Blue Pant - XXL"
                    value={draft.name}
                    onChange={update('name')}
                    required
                  />
                )}
              </FormField>
              <FormField
                label="Purchase price (৳, optional)"
                htmlFor="np-pp"
                helper="Leave blank if the cost is unknown. Owner-only information."
              >
                {(controlProps) => (
                  <Input
                    {...controlProps}
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.01"
                    placeholder="Optional"
                    value={draft.purchasePrice}
                    onChange={update('purchasePrice')}
                  />
                )}
              </FormField>
              <FormField label="Status" htmlFor="np-status" required>
                {(controlProps) => (
                  <Select
                    {...controlProps}
                    value={draft.status}
                    onChange={update('status')}
                    options={[
                      { value: 'ACTIVE', label: 'Active' },
                      { value: 'INACTIVE', label: 'Inactive' },
                    ]}
                    required
                  />
                )}
              </FormField>
              <FormField label="Opening stock (optional)" htmlFor="np-opening-stock" helper="A positive amount creates an OPENING_STOCK history entry.">
                {(controlProps) => <Input {...controlProps} type="number" min="0" step="1" value={draft.openingStock} onChange={update('openingStock')} placeholder="0" />}
              </FormField>
            </div>

            <FormField label="Notes" htmlFor="np-notes">
              {(controlProps) => (
                <Textarea
                  {...controlProps}
                  rows={3}
                  placeholder="Optional product details. Include size and colour in the product name."
                  value={draft.notes}
                  onChange={update('notes')}
                />
              )}
            </FormField>

            <p className={styles.notice}><T>
              Selling price is entered for each sale. Purchase cost is private to Owner.
            </T></p>

            {submitError ? (
              <p className={styles.formError} role="alert">
                <T>{submitError}</T>
              </p>
            ) : null}

            <div className={styles.formActions}>
              <Button
                type="button"
                variant="ghost"
                onClick={() => navigate('/products')}
              ><T>
                Cancel
              </T></Button>
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
