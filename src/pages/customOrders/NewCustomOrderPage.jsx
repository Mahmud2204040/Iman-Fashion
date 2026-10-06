import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import T from '../../components/common/LocalizedText.jsx';
import { Button, FormField, Input, Modal, Select, Spinner, Textarea } from '../../components/common/index.js';
import CustomerCreateFields from '../../components/customers/CustomerCreateFields.jsx';
import { useCustomerDraft } from '../../components/customers/useCustomerDraft.js';
import { useAuth } from '../../hooks/useAuth.js';
import { useLocale } from '../../contexts/LocaleContext.jsx';
import { createCustomOrder } from '../../services/customOrders/customOrderService.js';
import { getCustomers } from '../../services/customers/customerService.js';
import { createCustomer } from '../../services/customers/customerService.js';
import { formatCurrency } from '../../utils/format.js';
import backIcon from '../../assets/figma/new-customer/arrow-left.svg';
import chevronIcon from '../../assets/figma/new-custom-order/chevron-down.svg';
import plusIcon from '../../assets/figma/new-custom-order/plus.svg';
import calendarIcon from '../../assets/figma/new-custom-order/calendar-days.svg';
import lockIcon from '../../assets/figma/new-custom-order/lock-keyhole.svg';
import plusCreateIcon from '../../assets/figma/new-custom-order/plus-create.svg';
import phoneIcon from '../../assets/figma/new-custom-order/phone.svg';
import mapPinIcon from '../../assets/figma/new-custom-order/map-pin.svg';
import statusIcon from '../../assets/figma/new-custom-order/status-indicator.svg';
import styles from './NewCustomOrderPage.module.css';

export default function NewCustomOrderPage() {
  const { user } = useAuth();
  const { t } = useLocale();
  const navigate = useNavigate();

  const [customers, setCustomers] = useState([]);
  const [customerSearch, setCustomerSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [productName, setProductName] = useState('');
  const [qty, setQty] = useState('1');
  const [total, setTotal] = useState('');
  const [advance, setAdvance] = useState('0');
  const [dueDate, setDueDate] = useState('');
  const [description, setDescription] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [showCreateCustomer, setShowCreateCustomer] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError('');
    // Server-side search with max 50 items (avoids getting 5000)
    getCustomers({ page: 1, pageSize: 50, search: customerSearch })
      .then((result) => {
        if (cancelled) return;
        const active = (result.data || []).filter(c => c.isActive);
        setCustomers(active);
        setCustomerId((current) => {
          if (current && active.some(c => c.id === current)) return current;
          return active[0]?.id || '';
        });
      })
      .catch((error) => { if (!cancelled) setLoadError(error?.message || 'Could not load customers.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [reloadKey, customerSearch]);

  const customer = useMemo(() => customers.find((item) => item.id === customerId) || null, [customers, customerId]);
  const numericTotal = Number(total) || 0;
  const numericAdvance = Number(advance) || 0;
  const remaining = Math.max(numericTotal - numericAdvance, 0);

  async function handleSubmit(event) {
    event.preventDefault();
    if (submitting) return;
    setSubmitError('');
    const parsedQty = Number(qty);
    const parsedTotal = Number(total);
    const parsedAdvance = Number(advance || 0);
    if (!Number.isInteger(parsedQty) || parsedQty < 1) {
      setSubmitError('Quantity must be a whole number greater than zero.');
      return;
    }
    if (!Number.isFinite(parsedTotal) || parsedTotal <= 0) {
      setSubmitError('Total amount must be greater than zero.');
      return;
    }
    if (!Number.isFinite(parsedAdvance) || parsedAdvance < 0 || parsedAdvance > parsedTotal) {
      setSubmitError('Advance must be between zero and the total amount.');
      return;
    }
    if (!dueDate) {
      setSubmitError('Expected delivery date is required.');
      return;
    }
    setSubmitting(true);
    try {
      const created = await createCustomOrder({
        customerId, productName, qty: parsedQty, totalPrice: parsedTotal,
        advanceAmount: parsedAdvance, dueDate, description, notes,
      }, { actor: user });
      navigate(`/custom-orders/${created.id}`);
    } catch (error) {
      setSubmitError(error?.message || 'Could not create order.');
      setSubmitting(false);
    }
  }

  return (
    <main className={styles.page}>
      <Link to="/custom-orders" className={styles.backLink}><img src={backIcon} alt="" /><T>All custom orders</T></Link>
      <header className={styles.heading}>
        <h1><T>New custom order</T></h1>
        <p><T>Create a tracked bespoke order with customer, payment and production details.</T></p>
      </header>

      {loading ? <div className={styles.loading} aria-busy="true"><Spinner size="sm" /><T>Loading customer list…</T></div> : null}
      {loadError ? <div className={styles.errorBanner} role="alert"><T>{loadError}</T><Button type="button" variant="secondary" size="sm" onClick={() => setReloadKey((key) => key + 1)}><T>Retry</T></Button></div> : null}

      {!loading && !loadError ? <div className={styles.workspace}>
        <form className={styles.form} onSubmit={handleSubmit} noValidate>
          <section className={styles.formSection} aria-labelledby="order-customer-heading">
            <div className={styles.sectionHead}><h2 id="order-customer-heading"><T>Customer</T></h2><span><T>* Required fields</T></span></div>
            <div className={styles.customerFields}>
              
              <FormField label="Search customer" htmlFor="co-customer-search">
                {(controlProps) => <Input {...controlProps} value={customerSearch} onChange={(event) => setCustomerSearch(event.target.value)} placeholder="Type name or phone..." />}
              </FormField>
              <FormField label="Select customer" htmlFor="co-customer" required>
                {(controlProps) => <span className={styles.selectWrap}>
                  <Select {...controlProps} value={customerId} onChange={(event) => setCustomerId(event.target.value)}
                    options={customers.map((item) => ({ value: item.id, label: `${item.name} · ${item.phone || item.customerCode || item.id}` }))}
                    placeholder={customers.length ? undefined : 'Select a customer'} required />
                  <img src={chevronIcon} alt="" width="12" height="12" />
                </span>}
              </FormField>
              <button type="button" className={styles.addCustomer} onClick={() => setShowCreateCustomer(true)}>
                <img src={plusIcon} alt="" width="16" height="16" /><T>New customer</T>
              </button>
            </div>
          </section>

          <section className={styles.formSection} aria-labelledby="order-details-heading">
            <div className={styles.sectionHead}><h2 id="order-details-heading"><T>Order details</T></h2><span><T>Amounts in ৳</T></span></div>
            <div className={styles.productGrid}>
              <FormField label="Product name" htmlFor="co-product" required>
                {(controlProps) => <Input {...controlProps} placeholder="e.g. School uniform (Class 3)" value={productName} onChange={(event) => setProductName(event.target.value)} required />}
              </FormField>
              <FormField label="Quantity" htmlFor="co-qty" required>
                {(controlProps) => <Input {...controlProps} type="number" inputMode="numeric" min="1" step="1" value={qty} onChange={(event) => setQty(event.target.value)} required />}
              </FormField>
            </div>
            <div className={styles.amountGrid}>
              <FormField label="Total amount" htmlFor="co-total" required>
                {(controlProps) => <span className={styles.moneyField}><span aria-hidden="true">৳</span><Input {...controlProps} type="number" inputMode="decimal" min="0.01" step="0.01" placeholder="e.g. 1800" value={total} onChange={(event) => setTotal(event.target.value)} required /></span>}
              </FormField>
              <FormField label={<>{t('Cash advance')} <span className={styles.optional}>{t('(optional)')}</span></>} htmlFor="co-advance" helper="Cash only. Use 0 when no advance was paid.">
                {(controlProps) => <span className={styles.moneyField}><span aria-hidden="true">৳</span><Input {...controlProps} type="number" inputMode="decimal" min="0" max={numericTotal > 0 ? numericTotal : undefined} step="0.01" value={advance} onChange={(event) => setAdvance(event.target.value)} /></span>}
              </FormField>
              <FormField label="Expected delivery date" htmlFor="co-due" required>
                {(controlProps) => <span className={styles.dateField}><Input {...controlProps} type="date" value={dueDate} onClick={(event) => event.currentTarget.showPicker?.()} onChange={(event) => setDueDate(event.target.value)} required /><img src={calendarIcon} alt="" width="16" height="16" /></span>}
              </FormField>
            </div>
          </section>

          <section className={styles.formSection} aria-labelledby="order-notes-heading">
            <div className={styles.sectionHead}><h2 id="order-notes-heading"><T>Description & notes</T></h2></div>
            <div className={styles.notesGrid}>
              <FormField label="Description" htmlFor="co-desc" helper="Materials, measurements, or special instructions.">
                {(controlProps) => <Textarea {...controlProps} rows={3} placeholder="Materials, measurements, special instructions…" value={description} onChange={(event) => setDescription(event.target.value)} />}
              </FormField>
              <FormField label={<span className={styles.lockLabel}>{t('Internal notes')}<span className={styles.staffBadge}><img src={lockIcon} alt="" width="12" height="12" />{t('Staff only')}</span></span>} htmlFor="co-notes" helper="Visible only to staff.">
                {(controlProps) => <Textarea {...controlProps} rows={3} placeholder="Production deadlines, fabric notes…" value={notes} onChange={(event) => setNotes(event.target.value)} />}
              </FormField>
            </div>
          </section>

          {submitError ? <p className={styles.errorBanner} role="alert"><T>{submitError}</T></p> : null}
          <footer className={styles.formFooter}>
            <span><T>Creates a Pending order</T></span>
            <div className={styles.actions}>
              <Link to="/custom-orders" className={styles.cancelButton}><T>Cancel</T></Link>
              <Button type="submit" variant="primary" className={styles.createButton} disabled={submitting || !customerId}>
                <img src={plusCreateIcon} alt="" width="16" height="16" />{submitting ? t('Creating…') : t('Create custom order')}
              </Button>
            </div>
          </footer>
        </form>

        <aside className={styles.sideStack} aria-label={t('Order summary')}>
          <section className={styles.previewCard} aria-labelledby="order-preview-heading">
            <h2 id="order-preview-heading"><T>Customer preview</T></h2>
            <div className={styles.customerIdentity}>
              <span className={styles.avatar} aria-hidden="true">{customer?.name?.trim().slice(0, 2).toUpperCase() || '—'}</span>
              <strong>{customer?.name || t('Select a customer')}</strong>
            </div>
            <div className={styles.customerMeta}><img src={phoneIcon} alt="" width="14" height="14" /><span>{customer?.phone || t('No contact info yet')}</span></div>
            <div className={styles.customerMeta}><img src={mapPinIcon} alt="" width="14" height="14" /><span>{customer?.address || t('Not entered')}</span></div>
            <div className={styles.previewNotes}><strong><T>Notes</T></strong><span>{customer?.notes || t('No notes added')}</span></div>
          </section>

          <section className={styles.amountCard} aria-labelledby="order-amount-heading">
            <div className={styles.amountHead}><h2 id="order-amount-heading"><T>Order amount</T></h2><span>৳</span></div>
            <dl>
              <div><dt><T>Total amount</T></dt><dd>{numericTotal > 0 ? formatCurrency(numericTotal) : t('Not entered')}</dd></div>
              <div><dt><T>Cash advance</T></dt><dd>{formatCurrency(numericAdvance)}</dd></div>
              <div className={styles.remaining}><dt><T>Remaining</T></dt><dd>{numericTotal > 0 ? formatCurrency(remaining) : '—'}</dd></div>
            </dl>
            <p><T>Enter the total amount to calculate the remaining balance.</T></p>
          </section>
          <div className={styles.lifecycle}>
            <div><strong><T>Starts on creation</T></strong><span className={styles.pendingBadge}><img src={statusIcon} alt="" width="5" height="5" /><T>Pending</T></span></div>
            <p><T>Owner or Employee can mark it Ready when the work is done.</T></p>
          </div>
        </aside>
      </div> : null}

      <Modal open={showCreateCustomer} onClose={() => setShowCreateCustomer(false)} title="New customer" size="lg">
        <QuickCustomerForm onCreated={(created) => {
          setCustomers((current) => [...current, created]);
          setCustomerId(created.id);
          setShowCreateCustomer(false);
          setSubmitError('');
        }} onCancel={() => setShowCreateCustomer(false)} />
      </Modal>
    </main>
  );
}

function QuickCustomerForm({ onCreated, onCancel }) {
  const { user } = useAuth();
  const form = useCustomerDraft();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(event) {
    event.preventDefault(); setBusy(true); setError('');
    try { onCreated(await createCustomer(form.draft, { actor: user })); }
    catch (err) { setError(err?.message || 'Could not create customer.'); }
    finally { setBusy(false); }
  }
  return <form className={styles.quickCustomer} onSubmit={submit} noValidate>
    <p><T>Save this customer and continue the order without losing the current form.</T></p>
    <CustomerCreateFields form={form} idPrefix="order-customer" />
    {error ? <p role="alert" className={styles.errorBanner}><T>{error}</T></p> : null}
    <div className={styles.actions}><Button type="button" variant="ghost" onClick={onCancel}><T>Cancel</T></Button><Button type="submit" disabled={busy}>{busy ? 'Creating…' : 'Create customer'}</Button></div>
  </form>;
}
