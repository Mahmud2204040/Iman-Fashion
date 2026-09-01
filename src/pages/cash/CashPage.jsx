import { useEffect, useMemo, useState } from 'react';
import PageHeader from '../../components/common/PageHeader/PageHeader.jsx';
import Card from '../../components/common/Card/Card.jsx';
import FormField from '../../components/common/FormField/FormField.jsx';
import Input from '../../components/common/Input/Input.jsx';
import Textarea from '../../components/common/Textarea/Textarea.jsx';
import Button from '../../components/common/Button/Button.jsx';
import SearchInput from '../../components/common/SearchInput/SearchInput.jsx';
import Spinner from '../../components/common/Spinner/Spinner.jsx';
import EmptyState from '../../components/common/EmptyState/EmptyState.jsx';
import ConfirmDialog from '../../components/common/ConfirmDialog/ConfirmDialog.jsx';
import { useAuth } from '../../hooks/useAuth.js';
import {
  getCashEntries,
  getCurrentCash,
  addCashIn,
  addCashOut,
  CASH_REFERENCE_LABELS,
} from '../../services/cash/cashService.js';
import { formatCurrency, formatLongDate } from '../../utils/format.js';
const formatBDT = (v) => formatCurrency(v, { currency: 'BDT', maximumFractionDigits: 0 });
const formatDateTime = (d) => formatLongDate(d);
import styles from './CashPage.module.css';

const today = () => new Date().toISOString().slice(0, 10);

const inForm  = { amount: '', date: today(), reason: '', referenceType: 'MANUAL' };
const outForm = { amount: '', date: today(), reason: '', referenceType: 'MANUAL' };

export default function CashPage() {
  const { user } = useAuth();
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [formIn, setFormIn] = useState(inForm);
  const [formOut, setFormOut] = useState(outForm);
  const [error, setError] = useState('');
  const [confirm, setConfirm] = useState(null);
  const [saving, setSaving] = useState(false);

  const refresh = async () => {
    setLoading(true);
    try {
      const data = await getCashEntries();
      setEntries(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refresh(); /* eslint-disable-line */ }, []);

  const currentNow = useMemo(() => getCurrentCash(entries), [entries]);

  const totals = useMemo(() => {
    const cashIn = entries
      .filter((e) => e.type === 'CASH_IN')
      .reduce((s, e) => s + (Number(e.amount) || 0), 0);
    const cashOut = entries
      .filter((e) => e.type === 'CASH_OUT')
      .reduce((s, e) => s + (Number(e.amount) || 0), 0);
    return { cashIn, cashOut };
  }, [entries]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter((e) => {
      const ref = e.referenceType || e.reference_type;
      const label = CASH_REFERENCE_LABELS[ref] || ref || '';
      return [e.reason, label, e.createdByName, e.createdBy].filter(Boolean).some((v) => v.toLowerCase().includes(q));
    });
  }, [entries, search]);

  const updateIn  = (f) => (e) => setFormIn((p)  => ({ ...p, [f]: e.target.value }));
  const updateOut = (f) => (e) => setFormOut((p) => ({ ...p, [f]: e.target.value }));

  const handleAddIn = async (e) => {
    e.preventDefault();
    setError('');
    const amount = Number(formIn.amount);
    if (!Number.isFinite(amount) || amount <= 0) { setError('Cash In amount must be greater than zero.'); return; }
    if (!formIn.reason.trim() || formIn.reason.trim().length < 3) {
      setError('Reason is required (at least 3 chars).'); return;
    }
    setSaving(true);
    try {
      await addCashIn(
        {
          amount,
          reason: formIn.reason.trim(),
        },
        { actor: user }
      );
      setFormIn(inForm);
      await refresh();
    } catch (err) {
      setError(err?.message || 'Could not record Cash In.');
    } finally {
      setSaving(false);
    }
  };

  const requestAddOut = (e) => {
    e.preventDefault();
    setError('');
    const amount = Number(formOut.amount);
    if (!Number.isFinite(amount) || amount <= 0) { setError('Cash Out amount must be greater than zero.'); return; }
    if (!formOut.reason.trim() || formOut.reason.trim().length < 3) {
      setError('Reason is required (at least 3 chars).'); return;
    }
    setConfirm({
      title: 'Confirm Cash Out',
      message: 'Record ' + formatBDT(amount) + ' as Cash Out? This will reduce current shop cash.',
      onConfirm: async () => {
        setSaving(true);
        try {
          await addCashOut(
            {
              amount,
              reason: formOut.reason.trim(),
            },
            { actor: user }
          );
          setFormOut(outForm);
          await refresh();
        } catch (err) {
          setError(err?.message || 'Could not record Cash Out.');
        } finally {
          setSaving(false);
          setConfirm(null);
        }
      },
    });
  };

  const labelFor = (refType) => CASH_REFERENCE_LABELS[refType] || refType || '-';

  return (
    <div className={styles.page}>
      <PageHeader title="Cash Management" subtitle="Owner-only shop cash ledger. Supplier payments and expenses stay separate." />
      <div className={styles.banner} role="note">
        <strong>Owner only.</strong> Cash In from sales and custom-order payments is recorded automatically. Supplier payments and operating expenses are <strong>not</strong> part of this ledger.
      </div>
      <div className={styles.kpiGrid}>
        <Card><div className={styles.kpiCard}><span className={styles.kpiLabel}>Cash In</span><span className={styles.kpiValue + ' ' + styles.positive}>+{formatBDT(totals.cashIn)}</span><span className={styles.kpiHint}>{entries.filter((e) => e.type === 'CASH_IN').length} entries</span></div></Card>
        <Card><div className={styles.kpiCard}><span className={styles.kpiLabel}>Cash Out</span><span className={styles.kpiValue + ' ' + styles.negative}>-{formatBDT(totals.cashOut)}</span><span className={styles.kpiHint}>{entries.filter((e) => e.type === 'CASH_OUT').length} entries</span></div></Card>
        <Card><div className={styles.kpiCard}><span className={styles.kpiLabel}>Current cash</span><span className={styles.kpiValue}>{formatBDT(currentNow)}</span><span className={styles.kpiHint}>Cash In − Cash Out across all entries</span></div></Card>
      </div>
      <div className={styles.panelGrid}>
        <Card>
          <h2 className={styles.panelTitle}>Cash In</h2>
          <p className={styles.panelHint}>Record a manual cash addition. Reason is required.</p>
          <form className={styles.form} onSubmit={handleAddIn}>
            {error ? <p className={styles.formError}>{error}</p> : null}
            <div className={styles.row2}>
              <FormField label="Amount (BDT)" required htmlFor="cash-in-amount">
                {(controlProps) => (
                  <Input id="cash-in-amount" name="amount" type="number" min="0" step="0.01" value={formIn.amount} onChange={updateIn('amount')} placeholder="0.00" {...controlProps} />
                )}
              </FormField>
              <FormField label="Date" htmlFor="cash-in-date">
                {(controlProps) => (
                  <Input id="cash-in-date" name="date" type="date" value={formIn.date} onChange={updateIn('date')} {...controlProps} />
                )}
              </FormField>
            </div>
            <FormField label="Reason" required htmlFor="cash-in-reason">
              {(controlProps) => (
                <Textarea id="cash-in-reason" name="reason" rows={2} value={formIn.reason} onChange={updateIn('reason')} placeholder="e.g. Bank deposit reversal, cash top-up." {...controlProps} />
              )}
            </FormField>
            <div className={styles.formActions}>
              <Button type="submit" variant="primary" disabled={saving}>{saving ? 'Saving...' : 'Add Cash In'}</Button>
            </div>
          </form>
        </Card>

        <Card>
          <h2 className={styles.panelTitle}>Cash Out</h2>
          <p className={styles.panelHint}>Record money leaving shop cash. Confirmation required.</p>
          <form className={styles.form} onSubmit={requestAddOut}>
            <div className={styles.row2}>
              <FormField label="Amount (BDT)" required htmlFor="cash-out-amount">
                {(controlProps) => (
                  <Input id="cash-out-amount" name="amount" type="number" min="0" step="0.01" value={formOut.amount} onChange={updateOut('amount')} placeholder="0.00" {...controlProps} />
                )}
              </FormField>
              <FormField label="Date" htmlFor="cash-out-date">
                {(controlProps) => (
                  <Input id="cash-out-date" name="date" type="date" value={formOut.date} onChange={updateOut('date')} {...controlProps} />
                )}
              </FormField>
            </div>
            <FormField label="Reason" required htmlFor="cash-out-reason">
              {(controlProps) => (
                <Textarea id="cash-out-reason" name="reason" rows={2} value={formOut.reason} onChange={updateOut('reason')} placeholder="e.g. Petty cash, owner withdrawal." {...controlProps} />
              )}
            </FormField>
            <div className={styles.formActions}>
              <Button type="submit" variant="danger" disabled={saving}>Record Cash Out</Button>
            </div>
          </form>
        </Card>
      </div>

      <Card>
        <div className={styles.controlsCard}>
          <SearchInput value={search} onChange={setSearch} placeholder="Search by reason, reference or creator..." />
        </div>
      </Card>

      {loading ? (
        <div className={styles.loading}><Spinner size={20} /> Loading cash entries...</div>
      ) : filtered.length === 0 ? (
        <EmptyState
          title={search ? 'No cash entries match your search.' : 'No cash entries yet.'}
          description={search ? 'Try a different search term.' : 'Cash will appear here as sales and custom-order payments are recorded.'}
        />
      ) : (
        <Card>
          <div className={styles.tableWrap}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Type</th>
                  <th>Reference</th>
                  <th>Reason</th>
                  <th style={{ textAlign: 'right' }}>Amount</th>
                  <th>By</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((e) => (
                  <tr key={e.id}>
                    <td>{formatDateTime(e.date || e.createdAt)}</td>
                    <td>
                      {e.type === 'CASH_IN' ? <span className={styles.amountIn}>Cash In</span>
                        : <span className={styles.amountOut}>Cash Out</span>}
                    </td>
                    <td><span className={styles.referencePill}>{labelFor(e.referenceType)}</span></td>
                    <td className={e.reason ? styles.reasonCell : styles.reasonCellEmpty}>
                      {e.reason || '-'}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <span className={e.type === 'CASH_IN' ? styles.amountIn : styles.amountOut}>
                        {e.type === 'CASH_IN' ? '+' : '-'}{formatBDT(Math.abs(Number(e.amount) || 0))}
                      </span>
                    </td>
                    <td>{e.createdByName || 'system'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <ConfirmDialog
        open={!!confirm}
        title={confirm?.title || ''}
        message={confirm?.message || ''}
        confirmLabel="Record Cash Out"
        cancelLabel="Cancel"
        destructive
        onConfirm={confirm?.onConfirm}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
}
