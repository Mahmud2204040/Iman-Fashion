/**
 * NewCustomOrderPage — Phase 7.
 *
 * Owner-only creation flow. Customer is selected from the existing customer
 * catalogue (no inline customer creation here — that's a Customers route).
 *
 * Fields: customer, product name, quantity, due date, total amount,
 * description, internal notes.
 *
 * On success, navigates to the detail page for the new order.
 */
import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';

import {
  Button,
  Card,
  FormField,
  Input,
  PageHeader,
  Select,
  Spinner,
  Textarea,
} from '../../components/common/index.js';
import { useAuth } from '../../hooks/useAuth.js';
import {
  createCustomOrder,
  listCustomersForCustomOrders,
} from '../../services/customOrders/customOrderService.js';
import { formatCurrency } from '../../utils/format.js';
import styles from './NewCustomOrderPage.module.css';

export default function NewCustomOrderPage() {
  const { role } = useAuth();
  const isOwner = role === 'OWNER';
  const navigate = useNavigate();

  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);

  const [customerId, setCustomerId] = useState('');
  const [productName, setProductName] = useState('');
  const [qty, setQty] = useState('1');
  const [total, setTotal] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [description, setDescription] = useState('');
  const [notes, setNotes] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listCustomersForCustomOrders()
      .then((data) => {
        if (cancelled) return;
        setCustomers(data);
        if (data.length > 0) setCustomerId(data[0].id);
      })
      .catch((err_) => {
        if (!cancelled) setSubmitError(err_?.message || 'Could not load customers.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const customer = useMemo(
    () => customers.find((c) => c.id === customerId) || null,
    [customers, customerId],
  );

  const numericTotal = Number(total) || 0;
  const numericQty = Number(qty) || 0;
  const unitPricePreview = numericQty > 0 ? numericTotal / numericQty : 0;

  if (!isOwner) {
    return <Navigate to="/custom-orders" replace />;
  }

  if (loading) {
    return (
      <main className={styles.page} aria-busy="true">
        <div className={styles.loading}>
          <Spinner /> <span>Loading customer list…</span>
        </div>
      </main>
    );
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitError('');
    setSubmitting(true);
    try {
      const created = await createCustomOrder(
        {
          customerId,
          productName,
          qty,
          total,
          dueDate: dueDate || null,
          description,
          notes,
        },
        { actor: { role } },
      );
      navigate(`/custom-orders/${created.id}`);
    } catch (err_) {
      setSubmitError(err_?.message || 'Could not create order.');
      setSubmitting(false);
    }
  }

  return (
    <main className={styles.page}>
      <Link to="/custom-orders" className={styles.backLink}>
        ← All custom orders
      </Link>

      <PageHeader
        eyebrow="Custom order"
        title="New custom order"
        description="Create a tracked bespoke order. Use it to plan work-in-progress, advance status, and record customer payments."
      />

      {customers.length === 0 ? (
        <Card>
          <p className={styles.empty}>
            No customers yet. Create one from the Customers page first.
          </p>
          <div className={styles.emptyActions}>
            <Link to="/customers/new" className={styles.btnPrimary}>
              Go to Customers
            </Link>
          </div>
        </Card>
      ) : (
        <form className={styles.form} onSubmit={handleSubmit}>
          <Card>
            <h2 className={styles.sectionTitle}>Customer & product</h2>

            <FormField label="Customer" htmlFor="co-customer" required>
              <Select
                id="co-customer"
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
                required
              >
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} · {c.phone || c.code || c.id}
                  </option>
                ))}
              </Select>
            </FormField>

            <FormField label="Product name" htmlFor="co-product" required>
              <Input
                id="co-product"
                placeholder="e.g. School uniform (Class 3)"
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                required
              />
            </FormField>

            <div className={styles.row}>
              <FormField label="Quantity" htmlFor="co-qty" required>
                <Input
                  id="co-qty"
                  type="number"
                  inputMode="numeric"
                  min="1"
                  step="1"
                  value={qty}
                  onChange={(e) => setQty(e.target.value)}
                  required
                />
              </FormField>
              <FormField label="Total amount" htmlFor="co-total" required>
                <Input
                  id="co-total"
                  type="number"
                  inputMode="decimal"
                  min="1"
                  step="1"
                  placeholder="e.g. 1800"
                  value={total}
                  onChange={(e) => setTotal(e.target.value)}
                  required
                />
              </FormField>
              <FormField label="Due date" htmlFor="co-due">
                <Input
                  id="co-due"
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </FormField>
            </div>

            {numericQty > 0 && numericTotal > 0 ? (
              <div className={styles.preview}>
                Implied unit price: <strong>{formatCurrency(unitPricePreview)}</strong>{' '}
                ({formatCurrency(numericTotal)} ÷ {numericQty})
              </div>
            ) : null}

            {customer ? (
              <div className={styles.customerCard}>
                <span className={styles.customerLabel}>Customer preview</span>
                <strong>{customer.name}</strong>
                <span className={styles.customerMeta}>
                  {[customer.phone, customer.email, customer.address].filter(Boolean).join(' · ') || 'No contact info yet'}
                </span>
              </div>
            ) : null}
          </Card>

          <Card>
            <h2 className={styles.sectionTitle}>Description & notes</h2>

            <FormField label="Description" htmlFor="co-desc" hint="Visible to the customer when they view their custom order.">
              <Textarea
                id="co-desc"
                rows={3}
                placeholder="Materials, measurements, special instructions…"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </FormField>

            <FormField label="Internal notes" htmlFor="co-notes" hint="Visible only to staff.">
              <Textarea
                id="co-notes"
                rows={2}
                placeholder="Production deadlines, fabric notes…"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </FormField>
          </Card>

          {submitError ? (
            <p className={styles.errorBanner} role="alert">
              {submitError}
            </p>
          ) : null}

          <div className={styles.actions}>
            <Link to="/custom-orders" className={styles.btnGhost}>
              Cancel
            </Link>
            <Button type="submit" variant="primary" disabled={submitting}>
              {submitting ? 'Creating…' : 'Create custom order'}
            </Button>
          </div>
        </form>
      )}
    </main>
  );
}