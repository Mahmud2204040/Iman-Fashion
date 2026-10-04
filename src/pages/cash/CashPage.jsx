import T from '../../components/common/LocalizedText.jsx';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth.js';
import { useTicker } from '../../hooks/useTicker.js';
import { useLocale } from '../../contexts/LocaleContext.jsx';
import Button from '../../components/common/Button/Button.jsx';
import ConfirmDialog from '../../components/common/ConfirmDialog/ConfirmDialog.jsx';
import EmptyState from '../../components/common/EmptyState/EmptyState.jsx';
import FormField from '../../components/common/FormField/FormField.jsx';
import Input from '../../components/common/Input/Input.jsx';
import Modal from '../../components/common/Modal/Modal.jsx';
import SearchInput from '../../components/common/SearchInput/SearchInput.jsx';
import Select from '../../components/common/Select/Select.jsx';
import Spinner from '../../components/common/Spinner/Spinner.jsx';
import Textarea from '../../components/common/Textarea/Textarea.jsx';
import {
  CASH_REFERENCE_LABELS, addCashIn, addCashOut, applyCashReconciliation,
  getCashSnapshot, saveCashReconciliation, setInitialCash,
} from '../../services/cash/cashService.js';
import { cashBusinessDate, cashDayStart } from '../../utils/cashDate.js';
import { formatCount, formatCurrency } from '../../utils/format.js';
import { getUiLanguage } from '../../utils/localeState.js';
import styles from './CashPage.module.css';

const money = (value) => formatCurrency(value, { maximumFractionDigits: 2 });
const wholeMoney = (value) => formatCurrency(value, { maximumFractionDigits: 0 });
const today = () => cashBusinessDate();
const blankManual = () => ({ amount: '', date: today(), reason: '' });
const statusLabels = { MATCHED: 'Matched', UNAPPLIED: 'Difference pending', ADJUSTED: 'Adjusted', SUPERSEDED: 'Superseded by recount' };
const signedMoney = (value) => `${value < 0 ? '−' : '+'}${money(Math.abs(value))}`;

function dhakaDateTime(value) {
  return new Intl.DateTimeFormat(getUiLanguage() === 'bn' ? 'bn-BD-u-nu-latn' : 'en-GB', {
    day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Dhaka',
  }).format(new Date(value));
}

function useSnapshot() {
  const { user } = useAuth();
  const businessDate = cashBusinessDate(useTicker());
  const [snapshot, setSnapshot] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getCashSnapshot({ actor: user });
      setSnapshot(data);
      setError('');
      return data;
    } catch (err) {
      setError(err.message || 'Could not load cash records.');
      return null;
    } finally { setLoading(false); }
  }, [user]);
  useEffect(() => { refresh(); }, [refresh, businessDate]);
  return { user, snapshot, loading, error, setError, refresh };
}

function Header({ title, eyebrow = 'FINANCE', description, actions }) {
  const { t } = useLocale();
  return <header className={styles.header}>
    <span className={styles.eyebrow}>{t(eyebrow)}</span>
    <div className={styles.titleRow}><h1>{t(title)}</h1>{actions ? <div className={styles.headerActions}>{actions}</div> : null}</div>
    {description ? <p className={styles.subtitle}>{t(description)}</p> : null}
  </header>;
}

function Message({ error, success, onRetry }) {
  const { t } = useLocale();
  return <>{error ? <p className={styles.error} role="alert">{t(error)} {onRetry ? <Button variant="secondary" size="sm" onClick={onRetry}>Retry</Button> : null}</p> : null}{success ? <p className={styles.success} role="status">{t(success)}</p> : null}</>;
}

function Loading() { return <div className={styles.loading}><Spinner size={20} /><T> Loading cash records…</T></div>; }

function flowDays(entries, language) {
  const start = cashDayStart(today());
  const days = Array.from({ length: 14 }, (_, index) => {
    const date = new Date(start.getTime() - (13 - index) * 86400000);
    return { key: cashBusinessDate(date), label: new Intl.DateTimeFormat(language === 'bn' ? 'bn-BD-u-nu-latn' : 'en-GB', { day: 'numeric', month: 'short', timeZone: 'Asia/Dhaka' }).format(date), cashIn: 0, cashOut: 0 };
  });
  const byDate = new Map(days.map((day) => [day.key, day]));
  for (const entry of entries) {
    const day = byDate.get(entry.sessionDate || cashBusinessDate(entry.createdAt));
    if (day && entry.type === 'CASH_IN') day.cashIn += Number(entry.amount) || 0;
    if (day && entry.type === 'CASH_OUT') day.cashOut += Number(entry.amount) || 0;
  }
  return days;
}

function FlowGraph({ entries }) {
  const { language } = useLocale();
  const days = useMemo(() => flowDays(entries, language), [entries, language]);
  const max = Math.ceil(Math.max(1, ...days.flatMap((day) => [day.cashIn, day.cashOut])) / 500) * 500;
  return <section className={styles.flow} aria-labelledby="cash-flow-title">
    <div className={styles.flowHeading}><span className={styles.flowTitle}><strong id="cash-flow-title"><T>Cash flow</T></strong><small><T>Last 14 days</T></small></span></div>
    <div className={styles.flowBody}>
      <div className={styles.chartHead}><span><T>DAILY MOVEMENT</T></span><div className={styles.legend}><span><i className={styles.legendIn} /><T>Cash In</T></span><span><i className={styles.legendOut} /><T>Cash Out</T></span></div></div>
      <div className={styles.chart} role="img" aria-label={`Cash In and Cash Out per day from ${days[0].label} to ${days.at(-1).label}.`}>
        <div className={styles.axis}><span>{wholeMoney(max)}</span><span>{wholeMoney(max / 2)}</span><span>{wholeMoney(0)}</span></div>
        <div className={styles.chartDays}>{days.map((day) => <div className={styles.chartDay} key={day.key} title={`${day.label}: Cash In ${money(day.cashIn)}, Cash Out ${money(day.cashOut)}`}>
          <div className={styles.bars}><span className={styles.barIn} style={{ height: `${day.cashIn / max * 100}%` }} /><span className={styles.barOut} style={{ height: `${day.cashOut / max * 100}%` }} /></div><small>{day.label}</small>
        </div>)}</div>
      </div>
    </div>
  </section>;
}

function QuickStats({ entries }) {
  const { t } = useLocale();
  const [period, setPeriod] = useState(7);
  const lastDay = today();
  const firstDay = cashBusinessDate(new Date(cashDayStart(lastDay).getTime() - (period - 1) * 86400000));
  const recent = entries.filter((entry) => {
    const businessDate = entry.sessionDate || cashBusinessDate(entry.createdAt);
    return businessDate >= firstDay && businessDate <= lastDay;
  });
  const cashIn = recent.filter((entry) => entry.type === 'CASH_IN').reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
  const cashOut = recent.filter((entry) => entry.type === 'CASH_OUT').reduce((sum, entry) => sum + Math.abs(Number(entry.amount || 0)), 0);
  return <aside className={styles.quickStats} aria-label={`${t('Quick stats')} · ${t(period === 7 ? 'Last 7 days' : 'Last 30 days')}`}>
    <div className={styles.quickHead}><h2><T>Quick stats</T></h2><Select aria-label="Quick stats period" fullWidth={false} value={String(period)} onChange={(event) => setPeriod(Number(event.target.value))} options={[{ value: '7', label: 'Last 7 days' }, { value: '30', label: 'Last 30 days' }]} className={styles.quickPeriod} /></div>
    <div className={styles.quickFigure}><span><T>Total cash in</T></span><strong className={styles.amountIn}>{money(cashIn)}</strong></div>
    <div className={styles.quickPair}><div><span><T>Total cash out</T></span><strong className={styles.amountOut}>{money(cashOut)}</strong></div><div><span><T>Net cash flow</T></span><strong>{signedMoney(cashIn - cashOut)}</strong></div></div>
  </aside>;
}

function Stat({ label, value, hint, feature, tone }) {
  const { t } = useLocale();
  return <div className={`${styles.stat} ${feature ? styles.statFeature : ''} ${tone === 'in' ? styles.statIn : tone === 'out' ? styles.statOut : ''}`}><span>{t(label)}</span><strong>{money(value)}</strong><small>{t(hint)}</small></div>;
}

export default function CashPage({ dialog = null }) {
  const { user, snapshot, loading, error, setError, refresh } = useSnapshot();
  const { language, t } = useLocale();
  const location = useLocation();
  const navigate = useNavigate();
  const [notice, setNotice] = useState(location.state?.cashNotice || '');
  const [search, setSearch] = useState('');
  const [ledgerDateMode, setLedgerDateMode] = useState('all');
  const [ledgerDate, setLedgerDate] = useState('');
  const [ledgerType, setLedgerType] = useState('all');
  const [ledgerSort, setLedgerSort] = useState('newest');
  const [manualType, setManualType] = useState(null);
  const [form, setForm] = useState(blankManual);
  const [confirm, setConfirm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [openingAmount, setOpeningAmount] = useState('');
  const [physicalCash, setPhysicalCash] = useState('');
  const [closingNotes, setClosingNotes] = useState('');
  const [dialogError, setDialogError] = useState('');
  const countKey = useRef(crypto.randomUUID());
  const closingDifference = physicalCash === '' ? null : Math.round((Number(physicalCash) - (snapshot?.currentCash || 0)) * 100) / 100;
  useEffect(() => { if (dialog === 'opening' && snapshot?.initialized) navigate('/cash', { replace: true }); }, [dialog, snapshot?.initialized, navigate]);
  const entries = useMemo(() => snapshot?.entries || [], [snapshot]);
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return entries.filter((entry) => {
      const businessDate = entry.sessionDate || cashBusinessDate(entry.createdAt);
      const matchesQuery = !query || [entry.id, entry.reason, entry.referenceId, entry.referenceType, CASH_REFERENCE_LABELS[entry.referenceType], entry.createdBy].filter(Boolean).some((value) => String(value).toLowerCase().includes(query));
      const matchesDate = ledgerDateMode === 'all' || (ledgerDateMode === 'day' ? businessDate === ledgerDate : businessDate.startsWith(ledgerDate));
      return matchesQuery && matchesDate && (ledgerType === 'all' || entry.type === ledgerType);
    }).sort((a, b) => ledgerSort === 'oldest' ? a.createdAt.localeCompare(b.createdAt) : b.createdAt.localeCompare(a.createdAt));
  }, [entries, search, ledgerDateMode, ledgerDate, ledgerType, ledgerSort]);

  const openManual = (type) => { setError(''); setNotice(''); setForm(blankManual()); setManualType(type); };
  const saveManual = async (type, values) => {
    setSaving(true);
    try {
      await (type === 'in' ? addCashIn : addCashOut)({ amount: Number(values.amount), date: values.date, reason: values.reason.trim() }, { actor: user });
      setManualType(null); setForm(blankManual()); setNotice(`${type === 'in' ? 'Cash In' : 'Cash Out'} recorded.`);
      await refresh();
    } catch (err) { setError(err.message || 'Could not record cash movement.'); }
    finally { setSaving(false); setConfirm(null); }
  };
  const submitManual = (event) => {
    event.preventDefault(); setError('');
    const amount = Number(form.amount);
    if (form.amount.trim() === '' || !Number.isFinite(amount) || amount <= 0) { setError('Amount must be greater than zero.'); return; }
    if (form.reason.trim().length < 3) { setError('Reason must have at least 3 characters.'); return; }
    const values = { ...form };
    if (manualType === 'out') {
      setManualType(null);
      setConfirm({ title: 'Confirm Cash Out', message: `Record ${money(amount)} as Cash Out? Reason: ${values.reason.trim()}`, onConfirm: () => saveManual('out', values) });
    } else saveManual('in', values);
  };

  const saveOpening = async (event) => {
    event.preventDefault(); setSaving(true); setDialogError('');
    try {
      await setInitialCash({ amount: openingAmount, date: snapshot.suggestedOpeningDate }, { actor: user });
      navigate('/cash', { replace: true, state: { cashNotice: 'Initial opening recorded. Future daily openings are calculated automatically.' } });
    } catch (err) { setDialogError(err.message || 'Could not save initial opening.'); }
    finally { setSaving(false); }
  };
  const saveClosing = async (event) => {
    event.preventDefault(); setSaving(true); setDialogError('');
    try {
      const count = await saveCashReconciliation({ physicalCash, notes: closingNotes, ledgerVersion: snapshot.ledgerVersion, idempotencyKey: countKey.current }, { actor: user });
      countKey.current = crypto.randomUUID();
      navigate('/cash/closings', { state: { cashNotice: count.difference === 0 ? 'Cash matched. Closing record saved.' : 'Closing count saved. Review the difference before applying an adjustment.' } });
    } catch (err) {
      if (err.code === 'STALE_COUNT') await refresh();
      setDialogError(err.message || 'Could not save cash closing.');
    } finally { setSaving(false); }
  };

  const dateLabel = new Intl.DateTimeFormat(language === 'bn' ? 'bn-BD-u-nu-latn' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Dhaka' }).format(new Date());
  return <div className={styles.page}>
    <Header title="Cash management" description={language === 'bn' ? `আজকের দোকানের ক্যাশ এক নজরে · ${dateLabel} · ঢাকা` : `Today’s shop cash at a glance · ${dateLabel} · Dhaka`} actions={snapshot ? <>
      {snapshot.initialized ? <Link className={styles.secondaryAction} to="/cash/closing"><T>Cash closing</T></Link> : <Link className={styles.secondaryAction} to="/cash/opening"><T>Initial opening cash</T></Link>}
      <button className={styles.primaryAction} type="button" onClick={() => openManual('in')}><T>+ Cash In</T></button>
      <button className={styles.outAction} type="button" onClick={() => openManual('out')}><T>− Cash Out</T></button>
      <Link className={styles.secondaryAction} to="/cash/closings"><T>Closing history</T></Link>
    </> : null} />
    <Message error={error} success={notice} onRetry={!snapshot ? refresh : undefined} />
    {loading && !snapshot ? <Loading /> : snapshot ? <>
      {!snapshot.initialized ? <div className={styles.setupNote}><strong><T>Initial opening required.</T></strong><T> Record the starting shop cash once. Daily opening will carry forward automatically.</T></div> : null}
      <section className={styles.stats} aria-label="Today’s cash summary">
        <Stat label="Current cash" value={snapshot.currentCash} hint="Available in shop" feature />
        <Stat label="Cash In" value={snapshot.cashIn} hint="Received today" tone="in" />
        <Stat label="Cash Out" value={snapshot.cashOut} hint="Paid out today" tone="out" />
        <Stat label="Today’s opening" value={snapshot.opening} hint="Carried from closing" />
        <Stat label="Adjustment today" value={snapshot.adjustments} hint="Confirmed correction" />
      </section>
      <details className={styles.insights} open>
        <summary className={styles.insightsToggle}><span><T>Cash flow & quick stats</T></span><span className={styles.chevron} aria-hidden="true">⌄</span></summary>
        <div className={styles.insightGrid}><FlowGraph entries={entries} /><QuickStats entries={entries} /></div>
      </details>
      <section className={styles.ledgerSection} aria-labelledby="cash-ledger-title">
        <div className={styles.sectionHeading}><div><span className={styles.eyebrow}><T>LEDGER</T></span><h2 id="cash-ledger-title"><T>Cash movements</T></h2></div><span><T>Shop cash entries</T></span></div>
        <div className={styles.ledgerToolbar}>
          <SearchInput aria-label="Search cash movements" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by reason, reference or person" className={styles.search} />
          <Select aria-label="Filter cash date" fullWidth={false} value={ledgerDateMode} onChange={(event) => { const mode = event.target.value; setLedgerDateMode(mode); setLedgerDate(mode === 'day' ? today() : mode === 'month' ? today().slice(0, 7) : ''); }} options={[{ value: 'all', label: 'All dates' }, { value: 'day', label: 'Specific date' }, { value: 'month', label: 'By month' }]} className={styles.ledgerSelect} />
          {ledgerDateMode !== 'all' ? <Input aria-label={ledgerDateMode === 'day' ? 'Cash date' : 'Cash month'} fullWidth={false} type={ledgerDateMode === 'day' ? 'date' : 'month'} value={ledgerDate} max={ledgerDateMode === 'day' ? today() : today().slice(0, 7)} onChange={(event) => setLedgerDate(event.target.value)} className={styles.ledgerDate} /> : null}
          <Select aria-label="Filter cash type" fullWidth={false} value={ledgerType} onChange={(event) => setLedgerType(event.target.value)} options={[{ value: 'all', label: 'All types' }, { value: 'CASH_IN', label: 'Cash In' }, { value: 'CASH_OUT', label: 'Cash Out' }, { value: 'CASH_ADJUSTMENT', label: 'Adjustment' }, { value: 'OPENING', label: 'Initial opening' }]} className={styles.ledgerSelect} />
          <Select aria-label="Sort cash movements" fullWidth={false} value={ledgerSort} onChange={(event) => setLedgerSort(event.target.value)} options={[{ value: 'newest', label: 'Newest first' }, { value: 'oldest', label: 'Oldest first' }]} className={styles.ledgerSelect} />
          <span className={styles.ledgerCount}>{formatCount(filtered.length, 'movement', 'movements', 'লেনদেন')}</span>
        </div>
        {filtered.length === 0 ? <EmptyState title={search ? 'No matching cash movements' : 'No cash movements yet'} description={search ? 'Try a different search term.' : 'Sales and custom-order payments will appear here.'} /> : <div className={styles.tableWrap}><table className={styles.table}>
          <thead><tr><th><T>Date &amp; time</T></th><th><T>Type</T></th><th><T>Reference</T></th><th><T>Reason</T></th><th><T>Amount</T></th><th><T>By</T></th></tr></thead>
          <tbody>{filtered.map((entry) => {
            const isOut = entry.type === 'CASH_OUT' || Number(entry.amount) < 0;
            const typeLabel = entry.type === 'OPENING' ? 'Initial opening' : entry.type === 'CASH_ADJUSTMENT' ? 'Adjustment' : entry.type === 'CASH_IN' ? 'Cash In' : 'Cash Out';
            return <tr key={entry.id}>
              <td>{dhakaDateTime(entry.createdAt)}</td>
              <td><span className={`${styles.typeTag} ${entry.type === 'CASH_IN' ? styles.tagIn : entry.type === 'CASH_OUT' ? styles.tagOut : styles.tagAdjustment}`}>{t(typeLabel)}</span></td>
              <td>{entry.referenceId || CASH_REFERENCE_LABELS[entry.referenceType] || '—'}</td>
              <td className={styles.reasonCell}>{entry.reason || '—'}</td>
              <td className={`${styles.amountCell} ${isOut ? styles.amountOut : styles.amountIn}`}>{entry.type === 'OPENING' ? money(entry.amount) : signedMoney(isOut ? -Math.abs(entry.amount) : Math.abs(entry.amount))}</td>
              <td>{entry.createdByName || entry.createdBy || 'System'}</td>
            </tr>;
          })}</tbody>
        </table></div>}
      </section>
    </> : null}
    <Modal open={dialog === 'opening' && !snapshot?.initialized} onClose={saving ? undefined : () => navigate('/cash')} title="Initial opening cash" size="sm" className={styles.cashDialog}>
      {loading || !snapshot ? <Loading /> : <form className={styles.form} onSubmit={saveOpening}>
        <p className={styles.formHint}><T>Record the cash held before the first ledger movement. This is entered once; future daily openings carry forward automatically.</T></p>
        <div className={styles.detailIntro}><span><T>Opening date</T></span><strong>{snapshot.suggestedOpeningDate}</strong></div>
        <FormField label="Initial opening amount (৳)" htmlFor="initial-cash" required>{(props) => <Input {...props} id="initial-cash" type="number" min="0" step="0.01" required value={openingAmount} onChange={(event) => setOpeningAmount(event.target.value)} />}</FormField>
        <p className={styles.formHint}><T>Use 0 if the shop had no cash then.</T></p>
        {dialogError ? <p className={styles.error} role="alert">{t(dialogError)}</p> : null}
        <div className={styles.formActions}><Button type="button" variant="secondary" onClick={() => navigate('/cash')}><T>Cancel</T></Button><Button type="submit" loading={saving}><T>Save initial opening</T></Button></div>
      </form>}
    </Modal>
    <Modal open={dialog === 'closing'} onClose={saving ? undefined : () => navigate('/cash')} title="Cash closing" size="sm" className={styles.cashDialog}>
      {loading || !snapshot ? <Loading /> : !snapshot.initialized ? <div className={styles.setupNote}><T>Record </T><Link to="/cash/opening"><T>initial opening cash</T></Link><T> before the first closing.</T></div> : <form className={styles.form} onSubmit={saveClosing}>
        <p className={styles.formHint}><T>Count the cash physically held. Save the result even when it matches.</T></p>
        <div className={styles.detailIntro}><span><T>Expected cash</T></span><strong>{money(snapshot.currentCash)}</strong></div>
        <FormField label="Physical cash counted (৳)" htmlFor="physical-cash" required>{(props) => <Input {...props} id="physical-cash" type="number" min="0" step="0.01" required value={physicalCash} onChange={(event) => setPhysicalCash(event.target.value)} />}</FormField>
        <FormField label="Notes (optional)" htmlFor="closing-notes">{(props) => <Textarea {...props} id="closing-notes" rows={3} value={closingNotes} onChange={(event) => setClosingNotes(event.target.value)} />}</FormField>
        {closingDifference !== null && Number.isFinite(closingDifference) ? <div className={`${styles.differencePreview} ${closingDifference === 0 ? styles.differenceMatched : ''}`}><span><T>Difference</T></span><strong>{closingDifference === 0 ? money(0) : signedMoney(closingDifference)}</strong></div> : null}
        <p className={styles.formHint}><T>Saving a count does not change cash. Any difference requires a separate confirmed adjustment in Closing history.</T></p>
        {dialogError ? <p className={styles.error} role="alert">{t(dialogError)}</p> : null}
        <div className={styles.formActions}><Button type="button" variant="secondary" onClick={() => navigate('/cash')}><T>Cancel</T></Button><Button type="submit" loading={saving}><T>Save closing</T></Button></div>
      </form>}
    </Modal>
    <Modal open={manualType !== null} onClose={saving ? undefined : () => setManualType(null)} title={manualType === 'out' ? 'Record Cash Out' : 'Add Cash In'} size="sm" className={`${styles.cashDialog} ${manualType === 'out' ? styles.cashOutDialog : ''}`}>
      <form className={styles.form} onSubmit={submitManual}>
        <p className={styles.formHint}>{t(manualType === 'out' ? 'Record money leaving shop cash. You will confirm before saving.' : 'Record a manual addition to shop cash.')}</p>
        <FormField label="Amount (৳)" htmlFor="manual-cash-amount" required>{(props) => <Input {...props} id="manual-cash-amount" type="number" min="0.01" step="0.01" required value={form.amount} onChange={(event) => setForm((current) => ({ ...current, amount: event.target.value }))} />}</FormField>
        <FormField label="Date" htmlFor="manual-cash-date" required>{(props) => <Input {...props} id="manual-cash-date" type="date" max={today()} required value={form.date} onChange={(event) => setForm((current) => ({ ...current, date: event.target.value }))} />}</FormField>
        <FormField label="Reason" htmlFor="manual-cash-reason" required>{(props) => <Textarea {...props} id="manual-cash-reason" rows={3} required value={form.reason} onChange={(event) => setForm((current) => ({ ...current, reason: event.target.value }))} />}</FormField>
        {error ? <p className={styles.error} role="alert">{t(error)}</p> : null}
        <div className={styles.formActions}><Button type="button" variant="secondary" onClick={() => setManualType(null)}><T>Cancel</T></Button><Button type="submit" loading={saving} variant={manualType === 'out' ? 'danger' : 'primary'}>{manualType === 'out' ? 'Review Cash Out' : 'Save Cash In'}</Button></div>
      </form>
    </Modal>
    <ConfirmDialog open={!!confirm} title={confirm?.title || ''} message={confirm?.message || ''} confirmText="Confirm Cash Out" loading={saving} tone="danger" onConfirm={confirm?.onConfirm} onClose={() => { setConfirm(null); setManualType('out'); }} />
  </div>;
}

export function CashOpeningPage() {
  return <CashPage dialog="opening" />;
}

export function CashClosingPage() {
  return <CashPage dialog="closing" />;
}

export function CashClosingHistoryPage() {
  const { user, snapshot, loading, error, setError, refresh } = useSnapshot();
  const { language, t } = useLocale();
  const location = useLocation();
  const [notice, setNotice] = useState(location.state?.cashNotice || '');
  const [reasons, setReasons] = useState({});
  const [confirm, setConfirm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [dateMode, setDateMode] = useState('all');
  const [dateFilter, setDateFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const counts = useMemo(() => snapshot?.reconciliations || [], [snapshot]);
  const visibleCounts = useMemo(() => counts.filter((count) => {
    const matchesDate = dateMode === 'all' || (dateMode === 'day' ? count.businessDate === dateFilter : count.businessDate.startsWith(dateFilter));
    return matchesDate && (statusFilter === 'all' || count.status === statusFilter);
  }), [counts, dateMode, dateFilter, statusFilter]);
  const filterActive = dateMode !== 'all' || statusFilter !== 'all';
  const changeDateMode = (event) => {
    const mode = event.target.value;
    setDateMode(mode);
    setDateFilter(mode === 'day' ? today() : mode === 'month' ? today().slice(0, 7) : '');
  };
  const requestAdjustment = (count) => {
    const reason = (reasons[count.id] || '').trim();
    if (reason.length < 3) { setError('Enter an adjustment reason of at least 3 characters.'); return; }
    setError('');
    setConfirm({ title: 'Apply cash adjustment?', message: `Change shop cash by ${signedMoney(count.difference)} to match the counted ${money(count.physicalCash)}? Reason: ${reason}`, onConfirm: async () => {
      setSaving(true);
      try {
        await applyCashReconciliation(count.id, { reason, confirmed: true }, { actor: user });
        setNotice('Adjustment applied. The original count remains in history.');
        await refresh();
      } catch (err) { await refresh(); setError(err.message); }
      finally { setSaving(false); setConfirm(null); }
    } });
  };
  return <div className={`${styles.page} ${styles.historyPage}`}>
    <Link className={styles.backLink} to="/cash"><T>← Cash management</T></Link>
    <Header title="Closing history" eyebrow="DAILY CASH" description="Every saved count stays in the history, including matching and superseded counts." actions={<div className={styles.historyFilters} aria-label="Filter closing history">
      <Select aria-label="Filter by date period" fullWidth={false} value={dateMode} onChange={changeDateMode} options={[{ value: 'all', label: 'All dates' }, { value: 'day', label: 'Specific date' }, { value: 'month', label: 'By month' }]} className={styles.filterSelect} />
      {dateMode !== 'all' ? <Input aria-label={dateMode === 'day' ? 'Closing date' : 'Closing month'} fullWidth={false} type={dateMode === 'day' ? 'date' : 'month'} value={dateFilter} max={dateMode === 'day' ? today() : today().slice(0, 7)} onChange={(event) => setDateFilter(event.target.value)} className={styles.filterDate} /> : null}
      <Select aria-label="Filter by status" fullWidth={false} value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} options={[{ value: 'all', label: 'All statuses' }, { value: 'MATCHED', label: 'Matched' }, { value: 'ADJUSTED', label: 'Adjusted' }, { value: 'UNAPPLIED', label: 'Difference pending' }, { value: 'SUPERSEDED', label: 'Superseded' }]} className={styles.filterSelect} />
    </div>} />
    <Message error={error} success={notice} />
    {loading && !snapshot ? <Loading /> : snapshot ? <>
      <section className={styles.historyStats} aria-label="Closing status summary">
        <div className={styles.historyStat}><span><T>Total records</T></span><strong>{counts.length}</strong><small><T>closing counts</T></small></div>
        <div className={`${styles.historyStat} ${styles.historyStatPending}`}><span><T>Pending difference</T></span><strong>{counts.filter((count) => count.status === 'UNAPPLIED').length}</strong><small><T>needs review</T></small></div>
        <div className={styles.historyStat}><span><T>Superseded</T></span><strong>{counts.filter((count) => count.status === 'SUPERSEDED').length}</strong><small><T>recounted later</T></small></div>
        <div className={`${styles.historyStat} ${styles.historyStatMatched}`}><span><T>Matched</T></span><strong>{counts.filter((count) => count.status === 'MATCHED').length}</strong><small><T>no difference</T></small></div>
      </section>
      <div className={styles.historySummary}><span>{language === 'bn' ? `${counts.length}টির মধ্যে ${visibleCounts.length}টি ক্লোজিং রেকর্ড` : `${visibleCounts.length} of ${formatCount(counts.length, 'closing record', 'closing records', 'ক্লোজিং রেকর্ড')}`}</span>{filterActive ? <button type="button" onClick={() => { setDateMode('all'); setDateFilter(''); setStatusFilter('all'); }}><T>Clear filters</T></button> : null}</div>
      {visibleCounts.length ? <div className={styles.historyList}>{visibleCounts.map((count) => <article className={styles.historyCard} key={count.id}>
      <div className={styles.historyHeader}><div><strong>{dhakaDateTime(count.countedAt)}</strong><small><T>Counted by </T>{count.reconciledBy}</small></div><span className={`${styles.statusTag} ${count.status === 'MATCHED' ? styles.statusMatched : count.status === 'ADJUSTED' ? styles.statusAdjusted : count.status === 'UNAPPLIED' ? styles.statusPending : styles.statusNeutral}`}>{t(statusLabels[count.status])}</span></div>
      <div className={styles.historyFigures}><div><span><T>Expected</T></span><strong>{money(count.expectedCash)}</strong></div><div><span><T>Physical</T></span><strong>{money(count.physicalCash)}</strong></div><div><span><T>Difference</T></span><strong className={`${styles.differenceAmount} ${count.difference < 0 ? styles.amountOut : count.difference > 0 ? styles.amountIn : styles.amountMuted}`}>{count.difference < 0 ? <svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M8 2.5v10m0 0-4-4m4 4 4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg> : null}{count.difference === 0 ? money(0) : signedMoney(count.difference)}</strong></div></div>
      <div className={styles.historyAside}>{count.notes ? <div className={styles.historyNote}><svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M4.5 3.5h8l3 3v10h-11v-13Zm8 0v3h3M7 10h6M7 13h5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg><div><span><T>Closing note</T></span><p>{count.notes}</p></div></div> : <span className={styles.noNote}><T>No closing note</T></span>}
      {count.adjustmentTransactionId ? <p className={styles.historyFoot}><T>Adjustment linked: </T>{count.adjustmentTransactionId}</p> : count.canAdjust ? <div className={styles.adjustmentRow}><Input aria-label={`Adjustment reason for ${count.id}`} placeholder="Reason for cash adjustment" value={reasons[count.id] || ''} onChange={(event) => setReasons((current) => ({ ...current, [count.id]: event.target.value }))} /><Button variant="secondary" disabled={saving} onClick={() => requestAdjustment(count)}><T>Review adjustment</T></Button></div> : count.difference !== 0 && count.stale ? <p className={styles.historyFoot}><T>Cash changed after this count. Make a new closing to adjust.</T></p> : null}
      </div>
    </article>)}</div> : <div className={styles.historyEmpty}><EmptyState title={filterActive ? 'No matching closings' : 'No closings recorded yet'} description={filterActive ? 'Try another date or status, or clear the filters.' : 'The first saved cash closing will appear here.'} /></div>}
    </> : null}
    <ConfirmDialog open={!!confirm} title={confirm?.title || ''} message={confirm?.message || ''} confirmText="Apply adjustment" loading={saving} tone="danger" onConfirm={confirm?.onConfirm} onClose={() => setConfirm(null)} />
  </div>;
}
