import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import T from '../../components/common/LocalizedText.jsx';
import FormField from '../../components/common/FormField/FormField.jsx';
import Input from '../../components/common/Input/Input.jsx';
import Textarea from '../../components/common/Textarea/Textarea.jsx';
import Select from '../../components/common/Select/Select.jsx';
import SearchInput from '../../components/common/SearchInput/SearchInput.jsx';
import Spinner from '../../components/common/Spinner/Spinner.jsx';
import { useAuth } from '../../hooks/useAuth.js';
import { useLocale } from '../../contexts/LocaleContext.jsx';
import { getExpenseCategories, createExpenseCategory, getExpenses, createExpense, updateExpense, aggregateExpensesByCategory } from '../../services/expenses/expenseService.js';
import { formatCurrency, formatLongDate } from '../../utils/format.js';
import { cashBusinessDate } from '../../utils/cashDate.js';
import styles from './ExpensesPage.module.css';

const emptyForm = () => ({ categoryId: '', amount: '', date: cashBusinessDate(), description: '', newCategory: '' });
const money = (value) => formatCurrency(value, { maximumFractionDigits: 0 });

export default function ExpensesPage() {
  const { user } = useAuth();
  const { t } = useLocale();
  const formRef = useRef(null);
  const [expenses, setExpenses] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dateFilter, setDateFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [form, setForm] = useState(emptyForm);
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [list, cats] = await Promise.all([getExpenses(), getExpenseCategories()]);
      setExpenses(Array.isArray(list) ? list : []);
      setCategories(Array.isArray(cats) ? cats : []);
      setForm((prev) => (prev.categoryId ? prev : { ...prev, categoryId: cats[0]?.id || '' }));
    } catch (err) {
      setError(err?.message || 'Could not load expenses.');
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { refresh(); }, [refresh]);

  const currentMonth = cashBusinessDate().slice(0, 7);
  const [year, month] = currentMonth.split('-').map(Number);
  const previousMonth = `${month === 1 ? year - 1 : year}-${String(month === 1 ? 12 : month - 1).padStart(2, '0')}`;
  const categoryName = useCallback((id) => categories.find((category) => category.id === id)?.name || '—', [categories]);

  const summary = useMemo(() => {
    const byCategory = aggregateExpensesByCategory(expenses, categories);
    return {
      total: expenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0),
      month: expenses.filter((expense) => String(expense.expenseDate || '').slice(0, 7) === currentMonth)
        .reduce((sum, expense) => sum + Number(expense.amount || 0), 0),
      topCategory: byCategory[0]?.categoryName || '—',
      count: expenses.length,
    };
  }, [expenses, categories, currentMonth]);

  const usedCategories = useMemo(() => categories.filter((category) => expenses.some((expense) => expense.categoryId === category.id))
    .sort((a, b) => expenses.filter((expense) => expense.categoryId === b.id).reduce((sum, expense) => sum + Number(expense.amount || 0), 0)
      - expenses.filter((expense) => expense.categoryId === a.id).reduce((sum, expense) => sum + Number(expense.amount || 0), 0)), [categories, expenses]);
  const filtered = useMemo(() => expenses.filter((expense) => {
    if (categoryFilter !== 'all' && expense.categoryId !== categoryFilter) return false;
    const monthOfExpense = String(expense.expenseDate || '').slice(0, 7);
    if (dateFilter === 'this' && monthOfExpense !== currentMonth) return false;
    if (dateFilter === 'previous' && monthOfExpense !== previousMonth) return false;
    const query = search.trim().toLowerCase();
    return !query || [expense.description, categoryName(expense.categoryId)]
      .some((value) => String(value || '').toLowerCase().includes(query));
  }), [expenses, search, categoryFilter, dateFilter, currentMonth, previousMonth, categoryName]);

  function update(field) { return (event) => setForm((current) => ({ ...current, [field]: event.target.value })); }
  function resetForm() {
    setEditingId(null);
    setCreatingCategory(false);
    setError('');
    setForm((current) => ({ ...emptyForm(), categoryId: current.categoryId }));
  }
  function startEdit(expense) {
    setEditingId(expense.id);
    setCreatingCategory(false);
    setForm({ categoryId: expense.categoryId, amount: String(expense.amount), date: expense.expenseDate,
      description: expense.description || '', newCategory: '' });
    setError('');
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    const amount = Number(form.amount);
    if (!Number.isFinite(amount) || amount <= 0) { setError('Amount must be greater than zero.'); return; }
    if (!form.date) { setError('Date is required.'); return; }
    if (!creatingCategory && !form.categoryId) { setError('Category is required.'); return; }
    if (creatingCategory && !form.newCategory.trim()) { setError('Category name is required.'); return; }

    setSaving(true);
    try {
      let categoryId = form.categoryId;
      if (creatingCategory) {
        const category = await createExpenseCategory({ name: form.newCategory.trim() }, { actor: user });
        categoryId = category.id;
      }
      const payload = { categoryId, amount, expenseDate: form.date,
        description: form.description.trim() || null };
      if (editingId) await updateExpense(editingId, payload, { actor: user });
      else await createExpense(payload, { actor: user });
      setEditingId(null);
      setCreatingCategory(false);
      setForm({ ...emptyForm(), categoryId });
      await refresh();
    } catch (err) {
      setError(err?.message || 'Could not save expense.');
    } finally {
      setSaving(false);
    }
  }

  const categoryOptions = [{ value: 'all', label: t('All categories') }, ...categories.map((category) => ({ value: category.id, label: category.name }))];

  return <main className={styles.page}>
    <header className={styles.pageHeading}><h1><T>Expenses</T></h1><p><T>Track operating expenses separately from shop cash, with clear category and history controls.</T></p></header>
    <div className={styles.notice}><span><T>Owner only</T></span><p><T>Recording an expense does not move shop cash. Use Cash → Cash Out for actual money movement.</T></p></div>
    <section className={styles.metrics} aria-label={t('Expense summary')}>
      <div><strong>{money(summary.total)}</strong><span><T>Total expenses</T></span></div>
      <div><strong>{money(summary.month)}</strong><span><T>This month</T></span></div>
      <div><strong>{summary.topCategory}</strong><span><T>Top category</T></span></div>
      <div><strong>{summary.count}</strong><span><T>Expense records</T></span></div>
    </section>

    <div className={styles.workspace}>
      <section className={styles.historyPanel} aria-labelledby="expense-history-title">
        <div className={styles.panelHeading}><h2 id="expense-history-title"><T>Expense history</T></h2><p><T>Search, filter and edit recorded operating expenses.</T></p></div>
        <div className={styles.controls}>
          <SearchInput className={styles.search} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search category or description" aria-label="Search expenses" />
          <Select className={styles.filterSelect} aria-label="Filter expenses by date" value={dateFilter} onChange={(event) => setDateFilter(event.target.value)} options={[{ value: 'all', label: 'All dates' }, { value: 'this', label: 'This month' }, { value: 'previous', label: 'Last month' }]} />
          <Select className={styles.filterSelect} aria-label="Filter expenses by category" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} options={categoryOptions} />
        </div>
        <div className={styles.chips} aria-label={t('Expense category quick filters')}>
          <button type="button" className={categoryFilter === 'all' ? styles.chipActive : ''} aria-pressed={categoryFilter === 'all'} onClick={() => setCategoryFilter('all')}><T>All</T></button>
          {usedCategories.map((category) => <button key={category.id} type="button" className={categoryFilter === category.id ? styles.chipActive : ''} aria-pressed={categoryFilter === category.id} onClick={() => setCategoryFilter(category.id)}>{category.name}</button>)}
        </div>
        {loading ? <div className={styles.state}><Spinner size={20} /><T>Loading expenses…</T></div>
          : filtered.length === 0 ? <div className={styles.state}><strong><T>{search || categoryFilter !== 'all' || dateFilter !== 'all' ? 'No expenses match your filters.' : 'No expenses recorded yet.'}</T></strong></div>
            : <div className={styles.tableWrap}><table className={styles.table}><thead><tr><th><T>Date</T></th><th><T>Category</T></th><th><T>Description</T></th><th><T>Amount</T></th><th><T>By</T></th><th><T>Action</T></th></tr></thead><tbody>{filtered.map((expense) => <tr key={expense.id}>
              <td data-label={t('Date')}>{formatLongDate(expense.expenseDate)}</td>
              <td data-label={t('Category')}><span className={styles.categoryBadge}>{categoryName(expense.categoryId)}</span></td>
              <td data-label={t('Description')}>{expense.description || '—'}</td>
              <td data-label={t('Amount')} className={styles.amount}>{money(expense.amount)}</td>
              <td data-label={t('By')} className={styles.by}>{expense.createdByName || expense.createdBy || 'system'}</td>
              <td data-label={t('Action')}><button type="button" className={styles.editButton} onClick={() => startEdit(expense)}><T>Edit</T></button></td>
            </tr>)}</tbody></table></div>}
        <p className={styles.recordCount}>{filtered.length} {t('records')} · {t('latest first')}</p>
      </section>

      <section className={styles.formPanel} ref={formRef} aria-labelledby="record-expense-title">
        <div className={styles.panelHeading}><h2 id="record-expense-title">{t(editingId ? 'Edit expense' : 'Record expense')}</h2><p><T>Add a new operating expense without affecting shop cash.</T></p></div>
        <form className={styles.form} onSubmit={handleSubmit}>
          {error ? <p className={styles.formError} role="alert">{t(error)}</p> : null}
          <div className={styles.categoryRow}>
            {creatingCategory ? <FormField className={styles.formField} label="New category" required htmlFor="exp-newcat">{(props) => <Input {...props} className={styles.fieldControl} value={form.newCategory} onChange={update('newCategory')} placeholder="Type category name" required disabled={saving} />}</FormField>
              : <FormField className={styles.formField} label="Category" required htmlFor="exp-cat">{(props) => <Select {...props} className={styles.fieldControl} value={form.categoryId} onChange={update('categoryId')} options={categories.map((category) => ({ value: category.id, label: category.name }))} required disabled={saving} />}</FormField>}
            <button className={styles.newCategoryButton} type="button" onClick={() => { setCreatingCategory((value) => !value); setForm((current) => ({ ...current, newCategory: '' })); }}>{t(creatingCategory ? 'Use existing' : '+ Add new category')}</button>
          </div>
          {creatingCategory ? <p className={styles.categoryHelp}><T>New category will be created when you save this expense.</T></p> : null}
          <FormField className={styles.formField} label="Date" required htmlFor="exp-date">{(props) => <Input {...props} className={styles.fieldControl} type="date" value={form.date} onChange={update('date')} required disabled={saving} />}</FormField>
          <FormField className={styles.formField} label="Amount (৳)" required htmlFor="exp-amount">{(props) => <Input {...props} className={styles.fieldControl} type="number" min="0.01" step="0.01" value={form.amount} onChange={update('amount')} placeholder="0.00" required disabled={saving} />}</FormField>
          <FormField className={styles.formField} label="Description" htmlFor="exp-desc">{(props) => <Textarea {...props} className={styles.textarea} rows={2} value={form.description} onChange={update('description')} placeholder="What was this expense for?" disabled={saving} />}</FormField>
          <div className={styles.formActions}>{editingId ? <button type="button" onClick={resetForm} disabled={saving}>{t('Cancel edit')}</button> : null}<button type="submit" disabled={saving || loading}>{t(saving ? 'Saving…' : editingId ? 'Save changes' : 'Add expense')}</button></div>
          <p className={styles.cashHint}><T>Expense log only — no cash transaction is created.</T></p>
        </form>
      </section>
    </div>
  </main>;
}
