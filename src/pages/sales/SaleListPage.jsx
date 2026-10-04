import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';

import { SearchInput, Spinner } from '../../components/common/index.js';
import { useAuth } from '../../hooks/useAuth.js';
import { useLocale } from '../../contexts/LocaleContext.jsx';
import { getSales, searchSalesByCode } from '../../services/sales/salesService.js';
import { cashBusinessDate } from '../../utils/cashDate.js';
import { formatCurrency, formatCount, formatExactDate, formatExactTime } from '../../utils/format.js';
import SaleDetailPage from './SaleDetailPage.jsx';
import plusIcon from '../../assets/figma/sales-history/imgPlus.svg';
import searchIcon from '../../assets/figma/sales-history/imgSearch1.svg';
import calendarIcon from '../../assets/figma/sales-history/imgCalendarDays1.svg';
import chevronDownIcon from '../../assets/figma/sales-history/imgChevronDown1.svg';
import sortIcon from '../../assets/figma/sales-history/imgArrowDownWideNarrow.svg';
import invoiceIcon from '../../assets/figma/sales-history/imgArrowUpRight.svg';
import previousIcon from '../../assets/figma/sales-history/imgChevronLeft.svg';
import nextIcon from '../../assets/figma/sales-history/imgChevronRight.svg';
import helpIcon from '../../assets/figma/sales-history/imgFileText.svg';
import styles from './SaleListPage.module.css';

const PAGE_SIZE = 10;
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function parseDateValue(value) {
  if (!value) return null;
  const [year, month, day] = value.split('-').map(Number);
  if (![year, month, day].every(Number.isFinite)) return null;
  return new Date(year, month - 1, day);
}

function toDateValue(date) {
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function buildCalendarDays(month) {
  const firstDay = month.getDay();
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(month.getFullYear(), month.getMonth(), index - firstDay + 1);
    return { date, currentMonth: date.getMonth() === month.getMonth() };
  });
}

export default function SaleListPage() {
  const { id: routeSaleId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const { language, t } = useLocale();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const query = searchParams.get('q') || '';
  const dateFilter = searchParams.get('date') || '';
  const sortOrder = searchParams.get('sort') === 'oldest' ? 'oldest' : 'newest';
  const [deepResults, setDeepResults] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => startOfMonth(parseDateValue(cashBusinessDate(new Date().toISOString())) || new Date()));
  const datePickerRef = useRef(null);

  const calendarDays = useMemo(() => buildCalendarDays(calendarMonth), [calendarMonth]);
  const calendarMonthLabel = useMemo(() => new Intl.DateTimeFormat(language === 'bn' ? 'bn-BD-u-nu-latn' : 'en-GB', {
    month: 'long', year: 'numeric',
  }).format(calendarMonth), [calendarMonth, language]);
  const todayValue = cashBusinessDate(new Date().toISOString());

  function updateView(patch) {
    const next = new URLSearchParams(searchParams);
    Object.entries(patch).forEach(([key, value]) => {
      if (value === '' || value === null || value === undefined || value === 1 || value === 'newest') next.delete(key);
      else next.set(key, String(value));
    });
    setSearchParams(next, { replace: true });
  }

  useEffect(() => {
    if (!calendarOpen) return undefined;
    const closeOnOutsidePointer = (event) => {
      if (!datePickerRef.current?.contains(event.target)) setCalendarOpen(false);
    };
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setCalendarOpen(false);
    };
    document.addEventListener('pointerdown', closeOnOutsidePointer);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePointer);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [calendarOpen]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    getSales({ actor: user })
      .then((data) => {
        if (cancelled) return;
        if (!Array.isArray(data)) throw new Error('Sales service did not return an array. Got ' + typeof data);
        setRows(data);
      })
      .catch((err) => { if (!cancelled) setError(err?.message || 'Could not load sales.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [user, reloadKey]);

  const filtered = useMemo(() => {
    const dated = dateFilter ? rows.filter((sale) => cashBusinessDate(sale.createdAt) === dateFilter) : rows;
    if (!query.trim()) return dated;
    const value = query.trim().toLowerCase();
    return dated.filter((sale) => sale.salesCode.toLowerCase().includes(value) || (sale.customerName || '').toLowerCase().includes(value));
  }, [rows, query, dateFilter]);

  async function runDeepSearch() {
    if (!query.trim()) { setDeepResults(null); return; }
    try { setDeepResults(await searchSalesByCode(query.trim(), { actor: user })); }
    catch { setDeepResults([]); }
  }

  const displayed = useMemo(() => {
    const merged = deepResults === null ? filtered : [
      ...filtered,
      ...deepResults.filter((sale) => (!dateFilter || cashBusinessDate(sale.createdAt) === dateFilter) && !filtered.some((item) => item.id === sale.id)),
    ];
    return [...merged].sort((a, b) => sortOrder === 'newest'
      ? String(b.createdAt).localeCompare(String(a.createdAt))
      : String(a.createdAt).localeCompare(String(b.createdAt)));
  }, [deepResults, filtered, dateFilter, sortOrder]);

  const pageCount = Math.max(1, Math.ceil(displayed.length / PAGE_SIZE));
  const requestedPage = Number(searchParams.get('page')) || 1;
  const page = Math.min(Math.max(1, requestedPage), pageCount);
  const firstIndex = (page - 1) * PAGE_SIZE;
  const pageRows = displayed.slice(firstIndex, firstIndex + PAGE_SIZE);
  const selectedSaleId = routeSaleId || pageRows[0]?.id || null;
  const listSearch = searchParams.toString();

  function openDatePicker() {
    setCalendarMonth(startOfMonth(parseDateValue(dateFilter) || parseDateValue(todayValue) || new Date()));
    setCalendarOpen(true);
  }

  function selectCalendarDate(date) {
    updateView({ date: toDateValue(date), page: 1 });
    setCalendarOpen(false);
  }

  return (
    <main className={`${styles.page} ${routeSaleId ? styles.detailActive : ''}`}>
      <header className={styles.pageHeading}>
        <div>
          <h1>{t('Sales history')}</h1>
          <p>{t('Select a sale to view its invoice beside the history.')}</p>
        </div>
        <Link to="/sales/new" className={styles.newSaleCta}><img src={plusIcon} alt="" />{t('New sale')}</Link>
      </header>

      <div className={styles.workbench}>
        <section className={styles.ledger} aria-label={t('Sales history')}>
          <div className={styles.ledgerTitle}>
            <div><strong>{t('Sales history')}</strong><span>{t('Choose a sale to see its full invoice.')}</span></div>
            <span className={styles.countChip} aria-live="polite">{formatCount(displayed.length, 'sale', 'sales', 'বিক্রয়')}</span>
          </div>

          <div className={styles.controls}>
            <SearchInput
              className={styles.search}
              icon={<img src={searchIcon} alt="" />}
              value={query}
              onChange={(event) => { updateView({ q: event.target.value, page: 1 }); setDeepResults(null); }}
              onKeyDown={(event) => { if (event.key === 'Enter') runDeepSearch(); }}
              placeholder="Search by sales code or customer"
              aria-label="Search sales"
            />
            <div className={styles.filterRow}>
              <div ref={datePickerRef} className={styles.datePickerWrap}>
                <button type="button" className={styles.dateFilter} aria-label={t('Filter sales by date')}
                  aria-haspopup="dialog" aria-expanded={calendarOpen}
                  onClick={() => (calendarOpen ? setCalendarOpen(false) : openDatePicker())}>
                  <img src={calendarIcon} alt="" />
                  <span>{dateFilter ? formatExactDate(`${dateFilter}T12:00:00+06:00`) : t('All dates')}</span>
                  <img src={chevronDownIcon} alt="" />
                </button>
                {calendarOpen && (
                  <div className={styles.calendarPopover} role="dialog" aria-label={t('Choose a date')}>
                    <div className={styles.calendarHeader}>
                      <button type="button" aria-label={t('Previous month')} onClick={() => setCalendarMonth((month) => new Date(month.getFullYear(), month.getMonth() - 1, 1))}>‹</button>
                      <strong>{calendarMonthLabel}</strong>
                      <button type="button" aria-label={t('Next month')} onClick={() => setCalendarMonth((month) => new Date(month.getFullYear(), month.getMonth() + 1, 1))}>›</button>
                    </div>
                    <div className={styles.calendarWeekdays} aria-hidden="true">
                      {WEEKDAYS.map((day) => <span key={day}>{t(day)}</span>)}
                    </div>
                    <div className={styles.calendarGrid}>
                      {calendarDays.map(({ date, currentMonth }) => {
                        const value = toDateValue(date);
                        return <button type="button" key={value}
                          className={`${styles.calendarDay} ${currentMonth ? '' : styles.calendarDayMuted} ${value === dateFilter ? styles.calendarDaySelected : ''} ${value === todayValue ? styles.calendarDayToday : ''}`}
                          aria-label={formatExactDate(`${value}T12:00:00+06:00`)} aria-pressed={value === dateFilter}
                          onClick={() => selectCalendarDate(date)}>{date.getDate()}</button>;
                      })}
                    </div>
                    <div className={styles.calendarFooter}>
                      <button type="button" onClick={() => selectCalendarDate(parseDateValue(todayValue) || new Date())}>{t('Today')}</button>
                      <button type="button" disabled={!dateFilter} onClick={() => { updateView({ date: '', page: 1 }); setCalendarOpen(false); }}>{t('All dates')}</button>
                    </div>
                  </div>
                )}
              </div>
              <button type="button" className={styles.sortButton}
                onClick={() => updateView({ sort: sortOrder === 'newest' ? 'oldest' : 'newest', page: 1 })}
                aria-label={t(sortOrder === 'newest' ? 'Newest first' : 'Oldest first')}>
                <img src={sortIcon} alt="" /><span>{t(sortOrder === 'newest' ? 'Newest first' : 'Oldest first')}</span>
                <img src={chevronDownIcon} alt="" />
              </button>
            </div>
            {(dateFilter || query.trim()) && <div className={styles.quickActions}>
              {dateFilter && <button type="button" onClick={() => updateView({ date: '', page: 1 })}>{t('Clear date')}</button>}
              {query.trim() && <button type="button" onClick={runDeepSearch}>{t('Search by code')}</button>}
            </div>}
          </div>

          {loading ? <div className={styles.statusCard} aria-busy="true"><Spinner size="sm" />{t('Loading sales…')}</div>
            : error ? <div className={styles.error} role="alert">{t(error)} <button type="button" onClick={() => setReloadKey((value) => value + 1)}>{t('Retry')}</button></div>
              : displayed.length === 0 ? <div className={styles.empty}><img src={helpIcon} alt="" /><h2>{t(rows.length ? 'No matching sales' : 'No sales yet')}</h2><p>{t(rows.length ? 'Try another search or date.' : 'When you complete a sale, it will show up here.')}</p></div>
                : <>
                  <ol className={styles.saleList}>
                    {pageRows.map((sale) => <li key={sale.id}>
                      <Link to={`/sales/${sale.id}${listSearch ? `?${listSearch}` : ''}`} className={`${styles.saleRow} ${sale.id === selectedSaleId ? styles.selectedRow : ''}`}>
                        <span className={styles.saleRowTop}><span className={styles.saleCode}>{sale.salesCode}</span><strong>{formatCurrency(sale.total)}</strong></span>
                        <span className={styles.saleCustomer}>{sale.customerName || t('Walk-in')}</span>
                        <span className={styles.saleRowBottom}><time dateTime={sale.createdAt || undefined}>{formatExactDate(sale.createdAt)} · {formatExactTime(sale.createdAt)}</time><img src={invoiceIcon} alt="" /></span>
                      </Link>
                    </li>)}
                  </ol>
                  <div className={styles.tableFooter}>
                    <span>{t('Showing')} {pageCount > 1 ? `${firstIndex + 1}–${firstIndex + pageRows.length}` : pageRows.length} {t('out of')} {formatCount(displayed.length, 'sale', 'sales', 'বিক্রয়')}</span>
                    <div className={styles.pagination}>
                      <button type="button" disabled={page === 1} onClick={() => updateView({ page: page - 1 })} aria-label={t('Previous')}><img src={previousIcon} alt="" /></button>
                      <button type="button" disabled={page === pageCount} onClick={() => updateView({ page: page + 1 })} aria-label={t('Next')}><img src={nextIcon} alt="" /></button>
                    </div>
                  </div>
                </>}
        </section>

        <section className={styles.invoicePane} aria-label={t('Invoice')}>
          <div className={styles.invoiceHeading}><div><span>{t('INVOICE')}</span><h2>{t('Sale details')}</h2></div><span className={styles.readOnly}>{t('Read only')}</span></div>
          {selectedSaleId ? <SaleDetailPage saleId={selectedSaleId} embedded /> : <div className={styles.invoiceEmpty}><img src={helpIcon} alt="" /><p>{t('Select a sale to view its invoice.')}</p></div>}
        </section>
      </div>
    </main>
  );
}
