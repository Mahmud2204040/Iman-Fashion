/**
 * NewCustomerPage — Phase 6.
 *
 * Owner-only creation flow. Customers are the single source of truth
 * for both sales and custom orders, so creation happens here rather
 * than inside the sales / custom-orders flow (per FRONTEND_PLAN.md §6).
 *
 * Fields: name, phone, address, initial class.
 *
 * On success, navigates to the detail page for the new customer so the
 * owner can review the auto-derived current class, children list, and
 * audit columns. The audit `created_by` / `created_by_role` are pulled
 * from the active actor.
 */
import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';

import {
  Button,
  Card,
  FormField,
  Input,
  PageHeader,
} from '../../components/common/index.js';
import { useAuth } from '../../hooks/useAuth.js';
import { createCustomer } from '../../services/customers/customerService.js';
import styles from './NewCustomerPage.module.css';

export default function NewCustomerPage() {
  const { role, user } = useAuth();
  const isOwner = role === 'OWNER';
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [initialClass, setInitialClass] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  if (!isOwner) {
    return <Navigate to="/customers" replace />;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitError('');
    setSubmitting(true);
    try {
      const created = await createCustomer(
        { name, phone, address, initialClass },
        { actor: { username: user?.username, role } },
      );
      navigate(`/customers/${created.id}`);
    } catch (err_) {
      setSubmitError(err_?.message || 'Could not create customer.');
      setSubmitting(false);
    }
  }

  return (
    <main className={styles.page}>
      <Link to="/customers" className={styles.backLink}>
        ← All customers
      </Link>

      <PageHeader
        eyebrow="Customer"
        title="New customer"
        description="Create a customer record. The current class is derived automatically from the initial class and registration date."
      />

      <form className={styles.form} onSubmit={handleSubmit}>
        <Card>
          <h2 className={styles.sectionTitle}>Customer details</h2>

          <FormField label="Name" htmlFor="cust-name" required>
            <Input
              id="cust-name"
              placeholder="e.g. Anika Tabassum"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              minLength={2}
            />
          </FormField>

          <div className={styles.row}>
            <FormField label="Phone" htmlFor="cust-phone">
              <Input
                id="cust-phone"
                type="tel"
                inputMode="tel"
                placeholder="e.g. 01711-200104"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </FormField>

            <FormField
              label="Initial class"
              htmlFor="cust-class"
              hint="The current class is derived from this + years since registration."
            >
              <Input
                id="cust-class"
                placeholder="e.g. 3, A, KG-2"
                value={initialClass}
                onChange={(e) => setInitialClass(e.target.value)}
              />
            </FormField>
          </div>

          <FormField label="Address" htmlFor="cust-address">
            <Input
              id="cust-address"
              placeholder="e.g. House 12, Road 7, Banani, Dhaka"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
          </FormField>
        </Card>

        {submitError ? (
          <p className={styles.errorBanner} role="alert">
            {submitError}
          </p>
        ) : null}

        <div className={styles.actions}>
          <Link to="/customers" className={styles.btnGhost}>
            Cancel
          </Link>
          <Button type="submit" variant="primary" disabled={submitting}>
            {submitting ? 'Creating…' : 'Create customer'}
          </Button>
        </div>
      </form>
    </main>
  );
}
