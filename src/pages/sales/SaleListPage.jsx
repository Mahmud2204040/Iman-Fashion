/**
 * SaleListPage — Phase 5.
 *
 * Premium sales history:
 *   • Desktop / tablet: real <table> with a <colgroup>, so headers
 *     and body cells share the exact same column widths.
 *   • Mobile (< 720px): the table is hidden and each sale is shown
 *     as a vertically stacked card so no field truncates.
 */
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import {
  Card,
  EmptyState,
  PageHeader,
  SearchInput,
  Spinner,
} from '../../components/common/index.js';
import { SaleIcon, SparklesIcon } from '../../components/icons/DashboardIcon.jsx';
import { getSales, searchSalesByCode } from '../../services/sales/salesService.js';
import {
  formatCurrency,
  formatExactDate,
  formatExactDateTime,
  formatExactTime,
} from '../../utils/format.js';
import styles from './SaleListPage.module.css';

export default function SaleListPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');

    getSales()
      .then((data) => {
        if (cancelled) return;
        // Guard: getSales must always be an array (contract).
        if (!Array.isArray(data)) {
          throw new Error(
            'Sales service did not return an array. Got ' + typeof data,
          );
        }
        setRows(data);
      })
      .catch((err_) => {
        if (cancelled) return;
        setError(err_?.message || 'Could not load sales.');
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    if (!query.trim()) return rows;
    const q = query.trim().toLowerCase();
    return rows.filter(
      (s) =>
        s.salesCode.toLowerCase().includes(q) ||
        (s.customerName || '').toLowerCase().includes(q),
    );
  }, [rows, query]);

  // On-demand deeper search against the service (sales_code index)
  const [deepResults, setDeepResults] = useState(null);
  async function runDeepSearch() {
    if (!query.trim()) {
      setDeepResults(null);
      return;
    }
    try {
      const found = await searchSalesByCode(query.trim());
      setDeepResults(found);
    } catch {
      setDeepResults([]);
    }
  }

  const displayed =
    deepResults !== null
      ? [
          ...filtered,
          ...deepResults.filter((d) => !filtered.some((f) => f.id === d.id)),
        ]
      : filtered;

  return (
    <main className={styles.page}>
      <PageHeader
        eyebrow="Sales"
        title="Sales history"
        description="Every completed sale, newest first. Click any row to see the full invoice detail."
        actions={
          <Link to="/sales/new" className={styles.newSaleCta}>
            <SparklesIcon size={16} strokeWidth={1.75} />
            <span>New sale</span>
          </Link>
        }
      />

      <Card className={styles.controlsCard}>
        <div className={styles.controls}>
          <SearchInput
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setDeepResults(null);
            }}
            placeholder="Search by sales code or customer…"
            aria-label="Search sales"
          />
          {query.trim() ? (
            <button
              type="button"
              onClick={runDeepSearch}
              className={styles.deepSearchBtn}
            >
              Search by code
            </button>
          ) : null}
          <span className={styles.countChip} aria-live="polite">
            {displayed.length} {displayed.length === 1 ? 'sale' : 'sales'}
          </span>
        </div>
      </Card>

      {loading ? (
        <Card className={styles.statusCard}>
          <Spinner /> <span>Loading sales…</span>
        </Card>
      ) : error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : displayed.length === 0 ? (
        <EmptyState
          icon={<SaleIcon size={28} />}
          title="No sales yet"
          description="When you complete a sale, it will show up here."
        />
      ) : (
        <Card className={styles.tableCard} padding="none">
          {/* Desktop / tablet grid table.
              Header row + each data row use the same 5-column grid
              (1.5fr 2fr 1fr 1fr 1fr) so columns can never drift. */}
          <div className={styles.tableWrap} role="table" aria-label="Sales">
            <div className={styles.gridHeader} role="row">
              <span role="columnheader">Sales ID</span>
              <span role="columnheader">Customer name</span>
              <span role="columnheader">Amount</span>
              <span role="columnheader">Date</span>
              <span role="columnheader">Time</span>
            </div>

            <ul className={styles.gridBody} role="rowgroup">
              {displayed.map((s) => (
                <li
                  key={s.id}
                  className={styles.dataRow}
                  role="row"
                >
                  <div className={styles.gridCell} role="cell">
                    <Link to={`/sales/${s.id}`} className={styles.cellLink}>
                      <span className={styles.codePill}>{s.salesCode}</span>
                    </Link>
                  </div>
                  <div className={styles.gridCell} role="cell">
                    <Link to={`/sales/${s.id}`} className={styles.cellLink}>
                      <span className={styles.customerName}>
                        {s.customerName || 'Walk-in'}
                      </span>
                    </Link>
                  </div>
                  <div className={`${styles.gridCell} ${styles.alignRight}`} role="cell">
                    <Link to={`/sales/${s.id}`} className={styles.cellLink}>
                      <span className={styles.amount}>{formatCurrency(s.total)}</span>
                    </Link>
                  </div>
                  <div className={styles.gridCell} role="cell">
                    <Link to={`/sales/${s.id}`} className={styles.cellLink}>
                      <time
                        className={styles.dateValue}
                        dateTime={s.createdAt || undefined}
                        title={s.createdAt ? formatExactDate(s.createdAt) : ''}
                      >
                        {formatExactDate(s.createdAt)}
                      </time>
                    </Link>
                  </div>
                  <div className={`${styles.gridCell} ${styles.alignRight}`} role="cell">
                    <Link to={`/sales/${s.id}`} className={styles.cellLink}>
                      <time
                        className={styles.timeValue}
                        dateTime={s.createdAt || undefined}
                        title={s.createdAt ? formatExactTime(s.createdAt) : ''}
                      >
                        {formatExactTime(s.createdAt)}
                      </time>
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {/* Mobile stacked card list */}
          <ul className={styles.mobileList} aria-label="Sales">
            {displayed.map((s) => (
              <li key={s.id} className={styles.mobileCard}>
                <Link to={`/sales/${s.id}`} className={styles.mobileCardLink}>
                  {/* Top row — Sales ID pill (left) + Amount (right) */}
                  <div className={styles.mobileTopRow}>
                    <span className={styles.mobileCodePill}>{s.salesCode}</span>
                    <span className={styles.mobileAmount}>
                      {formatCurrency(s.total)}
                    </span>
                  </div>

                  {/* Middle — Customer name, large & bold */}
                  <span className={styles.mobileCustomer}>
                    {s.customerName || 'Walk-in'}
                  </span>

                  {/* Bottom — Date · Time, muted, dot-separated */}
                  <span className={styles.mobileDateTime}>
                    <time
                      dateTime={s.createdAt || undefined}
                      title={s.createdAt ? formatExactDateTime(s.createdAt) : ''}
                    >
                      {formatExactDate(s.createdAt)}
                    </time>
                    <span className={styles.mobileDot} aria-hidden="true">·</span>
                    <time
                      dateTime={s.createdAt || undefined}
                      title={s.createdAt ? formatExactDateTime(s.createdAt) : ''}
                    >
                      {formatExactTime(s.createdAt)}
                    </time>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </main>
  );
}
