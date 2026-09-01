import { useEffect, useMemo, useState } from 'react';
import PageHeader from '../../components/common/PageHeader/PageHeader.jsx';
import Card from '../../components/common/Card/Card.jsx';
import FormField from '../../components/common/FormField/FormField.jsx';
import Input from '../../components/common/Input/Input.jsx';
import Textarea from '../../components/common/Textarea/Textarea.jsx';
import Select from '../../components/common/Select/Select.jsx';
import Button from '../../components/common/Button/Button.jsx';
import SearchInput from '../../components/common/SearchInput/SearchInput.jsx';
import Spinner from '../../components/common/Spinner/Spinner.jsx';
import EmptyState from '../../components/common/EmptyState/EmptyState.jsx';
import { useAuth } from '../../hooks/useAuth.js';
import {
  getExpenseCategories,
  createExpenseCategory,
  getExpenses,
  createExpense,
  aggregateExpensesByCategory,
} from '../../services/expenses/expenseService.js';
import { formatCurrency, formatLongDate } from '../../utils/format.js';
const formatBDT = (v) => formatCurrency(v, { currency: 'BDT', maximumFractionDigits: 0 });
const formatDate = (d) => formatLongDate(d);
import styles from './ExpensesPage.module.css';

const today = () => new Date().toISOString().slice(0, 10);

const emptyForm = {
  categoryId: '',
  amount: '',
  date: today(),
  description: '',
  notes: '',
  newCategory: '',
};

export default function ExpensesPage() {
  const { user } = useAuth();
  const [expenses, setExpenses] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const refresh = async () => {
    setLoading(true);
    try {
      const [list, cats] = await Promise.all([
        getExpenses(),
        getExpenseCategories(),
      ]);
      setExpenses(Array.isArray(list) ? list : []);
      setCategories(Array.isArray(cats) ? cats : []);
      setForm((prev) => (prev.categoryId ? prev : { ...prev, categoryId: cats[0]?.id || '' }));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refresh(); /* eslint-disable-line */ }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return expenses;
    return expenses.filter((e) => {
      const cat = categories.find((c) => c.id === e.categoryId);
      const catName = cat?.name || e.categoryName || '';
      return [e.description, e.notes, catName]
        .filter(Boolean)
        .some((v) => v.toLowerCase().includes(q));
    });
  }, [expenses, categories, search]);

  const summary = useMemo(() => {
    const totalAmount = expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
    const now = new Date();
    const monthAmount = expenses
      .filter((e) => {
        const d = e.expenseDate || e.createdAt;
        if (!d) return false;
        const dt = new Date(d);
        return dt.getFullYear() === now.getFullYear() && dt.getMonth() === now.getMonth();
      })
      .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
    const byCategory = aggregateExpensesByCategory(expenses, categories);
    const topCategory = byCategory[0];
    return { totalAmount, monthAmount, count: expenses.length, topCategory };
  }, [expenses, categories]);

  const update = (field) => (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    let categoryId = form.categoryId;
    if (!categoryId && form.newCategory.trim()) {
      try {
        const created = await createExpenseCategory({ name: form.newCategory.trim() }, { actor: user });
        categoryId = created?.id || categoryId;
      } catch (err) {
        setError(err?.message || 'Could not create category.');
        return;
      }
    }

    if (!categoryId) { setError('Category is required.'); return; }
    const amount = Number(form.amount);
    if (!Number.isFinite(amount) || amount <= 0) { setError('Amount must be greater than zero.'); return; }
    if (!form.date) { setError('Date is required.'); return; }

    setSaving(true);
    try {
      await createExpense(
        {
          categoryId,
          amount,
          expenseDate: form.date,
          description: form.description.trim() || null,
          notes: form.notes.trim() || null,
        },
        { actor: user }
      );
      setForm({ ...emptyForm, categoryId });
      await refresh();
    } catch (err) {
      setError(err?.message || 'Could not save expense.');
    } finally {
      setSaving(false);
    }
  };

  const categoryName = (id) => categories.find((c) => c.id === id)?.name || '—';

  const categoryOptions = useMemo(
    () => categories.map((c) => ({ value: c.id, label: c.name })),
    [categories]
  );

  return (
    <div className={styles.page}>
      <PageHeader title="Expenses" subtitle="Owner-only operating expense log. Not tied to shop cash — expenses are tracked separately." />

      <div className={styles.banner} role="note">
        <strong>Owner only.</strong> Recording an expense does <strong>not</strong> create a cash transaction. Use Cash → Cash Out to actually move shop money.
      </div>

      <Card>
        <div className={styles.summaryRow}>
          <div>
            <span className={styles.summaryLabel}>Total expenses</span>
            <span className={styles.summaryValue}>{formatBDT(summary.totalAmount)}</span>
          </div>
          <div>
            <span className={styles.summaryLabel}>This month</span>
            <span className={styles.summaryValue}>{formatBDT(summary.monthAmount)}</span>
          </div>
          <div>
            <span className={styles.summaryLabel}>{summary.topCategory ? 'Top category' : 'Records'}</span>
            <span className={styles.summaryValue}>{summary.topCategory ? summary.topCategory.categoryName : summary.count}</span>
            {summary.topCategory ? (
              <span className={styles.summaryLabel}>{formatBDT(summary.topCategory.total)}</span>
            ) : null}
          </div>
        </div>
      </Card>

      <Card>
        <h2 className={styles.formTitle}>Record expense</h2>
        <form className={styles.form} onSubmit={handleSubmit}>
          {error ? <p className={styles.formError}>{error}</p> : null}
          <div className={styles.row}>
            <FormField label="Category" required htmlFor="exp-cat">
              {(controlProps) => (
                <Select
                  id="exp-cat"
                  name="categoryId"
                  value={form.categoryId}
                  onChange={update('categoryId')}
                  options={[{ value: '', label: '— Select category —' }, ...categoryOptions]}
                  disabled={saving}
                  {...controlProps}
                />
              )}
            </FormField>
            <FormField label="Amount (BDT)" required htmlFor="exp-amount">
              {(controlProps) => (
                <Input id="exp-amount" name="amount" type="number" min="0" step="0.01" value={form.amount} onChange={update('amount')} placeholder="0.00" {...controlProps} />
              )}
            </FormField>
            <FormField label="Date" required htmlFor="exp-date">
              {(controlProps) => (
                <Input id="exp-date" name="date" type="date" value={form.date} onChange={update('date')} {...controlProps} />
              )}
            </FormField>
          </div>
          <FormField label="New category (optional)" htmlFor="exp-newcat">
            {(controlProps) => (
              <Input id="exp-newcat" name="newCategory" value={form.newCategory} onChange={update('newCategory')} placeholder="Type to create a new category" {...controlProps} />
            )}
          </FormField>
          <FormField label="Description" htmlFor="exp-desc">
            {(controlProps) => (
              <Textarea id="exp-desc" name="description" rows={2} value={form.description} onChange={update('description')} placeholder="Optional short description." {...controlProps} />
            )}
          </FormField>
          <FormField label="Notes" htmlFor="exp-notes">
            {(controlProps) => (
              <Textarea id="exp-notes" name="notes" rows={2} value={form.notes} onChange={update('notes')} placeholder="Optional notes." {...controlProps} />
            )}
          </FormField>
          <div className={styles.formActions}>
            <Button type="button" variant="ghost" onClick={() => setForm({ ...emptyForm, categoryId: form.categoryId })} disabled={saving}>Reset</Button>
            <Button type="submit" variant="primary" disabled={saving}>{saving ? 'Saving…' : 'Add expense'}</Button>
          </div>
        </form>
      </Card>

      <Card>
        <div className={styles.controlsCard}>
          <SearchInput value={search} onChange={setSearch} placeholder="Search by category, description or notes…" />
        </div>
      </Card>

      {loading ? (
        <div className={styles.loading}><Spinner size={20} /> Loading expenses…</div>
      ) : filtered.length === 0 ? (
        <EmptyState
          title={search ? 'No expenses match your search.' : 'No expenses recorded yet.'}
          description={search ? 'Try a different search term.' : 'Use the form above to record your first expense.'}
        />
      ) : (
        <Card>
          <div className={styles.tableWrap}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Category</th>
                  <th>Description</th>
                  <th style={{ textAlign: 'right' }}>Amount</th>
                  <th>By</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((e) => (
                  <tr key={e.id}>
                    <td>{formatDate(e.expenseDate)}</td>
                    <td><span className={styles.expenseCategory}>{categoryName(e.categoryId)}</span></td>
                    <td className={e.description ? styles.expenseDescription : styles.expenseDescriptionEmpty}>
                      {e.description || '—'}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <span className={styles.expenseAmount}>{formatBDT(e.amount)}</span>
                    </td>
                    <td>{e.createdByName || 'system'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
