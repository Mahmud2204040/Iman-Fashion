/**
 * SaleListPage — Phase 5.
 *
 * Reads the recent sales list (mock service) and shows it as a
 * responsive list of rows. The page is intentionaly read-only —
 * new sales are created on /sales/new and full detail is on
 * /sales/:id.
 */
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import {
  EmptyState,
  FormField,
  Input,
  Spinner,
} from '../../components/common/index.js';
import { SaleIcon, SparklesIcon } from '../../components/icons/DashboardIcon.jsx';
import { getSales, searchSalesByCode } from '../../services/sales/salesService.js';
import { formatCurrency, timeAgo } from '../../utils/format.js';
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
      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}>Sales</span>
          <h1 className={styles.title}>Recent sales</h1>
          <p className={styles.subtitle}>
            Latest completed sales, newest first. Click a row to see full
            detail.
          </p>
        </div>
        <Link to="/sales/new" className={styles.newSaleCta}>
          <SparklesIcon size={16} />
          <span>New sale</span>
        </Link>
      </header>

      <div className={styles.controls}>
        <FormField label="Search">
          {(controlProps) => (
            <Input
              {...controlProps}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setDeepResults(null);
              }}
              placeholder="Sales code or customer…"
            />
          )}
        </FormField>
        {query.trim() ? (
          <button
            type="button"
            onClick={runDeepSearch}
            className={styles.deepSearchBtn}
          >
            Search by code
          </button>
        ) : null}
      </div>

      {loading ? (
        <div className={styles.loading} aria-busy="true">
          <Spinner /> <span>Loading sales…</span>
        </div>
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
        <ul className={styles.list} aria-label="Sales">
          {displayed.map((s) => (
            <li key={s.id}>
              <Link to={`/sales/${s.id}`} className={styles.row}>
                <div className={styles.rowMain}>
                  <span className={styles.code}>{s.salesCode}</span>
                  <span className={styles.customer}>{s.customerName}</span>
                </div>
                <div className={styles.rowMeta}>
                  <span className={styles.itemCount}>
                    {s.items.length} item{s.items.length === 1 ? '' : 's'}
                  </span>
                  <span className={styles.total}>
                    {formatCurrency(s.total)}
                  </span>
                  <span className={styles.ago}>{timeAgo(s.createdAt)}</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
