/**
 * NewRawMaterialPage — Phase 4 sidebar entry point.
 *
 * Owner-only dedicated creation form for `/raw-materials/new`. Mirrors
 * the inline form that used to live inside RawMaterialsPage, but lives
 * on its own route so the sidebar "Add New Raw Material" leaf has a
 * real target.
 *
 * On success it navigates back to the raw-material list.
 */
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import {
  Button,
  Card,
  FormField,
  Input,
  PageHeader,
  Textarea,
} from '../../components/common/index.js';
import { SpoolPlusIcon } from '../../components/icons/DashboardIcon.jsx';
import { useAuth } from '../../hooks/useAuth.js';
import { createRawMaterial } from '../../services/rawMaterials/rawMaterialService.js';
import styles from './NewRawMaterialPage.module.css';

function todayIso() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export default function NewRawMaterialPage() {
  const { user, role } = useAuth();
  const navigate = useNavigate();
  const isOwner = role === 'OWNER';

  const [draft, setDraft] = useState({
    itemName: '',
    quantity: '',
    date: todayIso(),
    purchaseCost: '',
    description: '',
    notes: '',
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
        quantity: draft.quantity === '' ? 0 : Number(draft.quantity),
        purchaseCost:
          draft.purchaseCost === '' ? null : Number(draft.purchaseCost),
      };
      await createRawMaterial(payload, {
        actor: { username: user?.username || 'unknown', role },
      });
      navigate('/raw-materials');
    } catch (err_) {
      setSubmitError(err_?.message || 'Could not create raw material.');
    } finally {
      setSubmitBusy(false);
    }
  }

  return (
    <main className={styles.page}>
      <PageHeader
        eyebrow="Inventory"
        title="Add new raw material"
        description="Log a fabric, accessory, or other material that enters the shop."
        actions={
          <Link to="/raw-materials" className={styles.backLink}>
            ← Back to raw materials
          </Link>
        }
      />

      {!isOwner ? (
        <Card className={styles.lockedCard}>
          <h2 className={styles.lockedTitle}>Owner-only</h2>
          <p className={styles.lockedBody}>
            Adding raw materials is restricted to the owner role. Sign in with
            an owner account to continue.
          </p>
        </Card>
      ) : (
        <Card className={styles.formCard}>
          <div className={styles.formHead}>
            <span className={styles.formHeadIcon} aria-hidden="true">
              <SpoolPlusIcon size={20} strokeWidth={1.75} />
            </span>
            <h2 className={styles.formTitle}>Raw material details</h2>
          </div>
          <form className={styles.form} onSubmit={handleSubmit}>
            <div className={styles.row}>
              <FormField label="Item name" htmlFor="rm-name" required>
                <Input
                  id="rm-name"
                  placeholder="e.g. Cotton fabric — 1.2m roll"
                  value={draft.itemName}
                  onChange={update('itemName')}
                  required
                />
              </FormField>
              <FormField label="Quantity" htmlFor="rm-qty" required>
                <Input
                  id="rm-qty"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="1"
                  placeholder="0"
                  value={draft.quantity}
                  onChange={update('quantity')}
                  required
                />
              </FormField>
              <FormField label="Date" htmlFor="rm-date" required>
                <Input
                  id="rm-date"
                  type="date"
                  value={draft.date}
                  onChange={update('date')}
                  required
                />
              </FormField>
            </div>

            <div className={styles.row}>
              <FormField
                label="Purchase cost (৳, optional)"
                htmlFor="rm-cost"
                hint="Used for cost reports"
              >
                <Input
                  id="rm-cost"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="1"
                  placeholder="0"
                  value={draft.purchaseCost}
                  onChange={update('purchaseCost')}
                />
              </FormField>
            </div>

            <FormField label="Description" htmlFor="rm-desc">
              <Textarea
                id="rm-desc"
                rows={2}
                placeholder="Optional notes about colour, supplier, or batch."
                value={draft.description}
                onChange={update('description')}
              />
            </FormField>

            <FormField label="Internal notes" htmlFor="rm-notes">
              <Textarea
                id="rm-notes"
                rows={2}
                placeholder="Optional notes visible only to staff."
                value={draft.notes}
                onChange={update('notes')}
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
                onClick={() => navigate('/raw-materials')}
              >
                Cancel
              </Button>
              <Button type="submit" variant="primary" disabled={submitBusy}>
                {submitBusy ? 'Saving…' : 'Save raw material'}
              </Button>
            </div>
          </form>
        </Card>
      )}
    </main>
  );
}