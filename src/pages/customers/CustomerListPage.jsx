/**
 * CustomerListPage — Phase 6.
 *
 * Read-only list of customers with a quick search. The page surfaces:
 *   - Name
 *   - Phone
 *   - Current class (derived in the service)
 *   - Active / inactive badge
 *
 * Search filters on name, phone, or address (substring, case-insensitive).
 * The "New customer" CTA is owner-only — employees can browse the
 * directory but cannot create records (per PROJECT_RULES.md §8).
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
import { CustomerIcon } from '../../components/icons/DashboardIcon.jsx';
import { getCustomers } from '../../services/customers/customerService.js';
import { formatExactDate } from '../../utils/format.js';
import styles from './CustomerListPage.module.css';

export default function CustomerListPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    getCustomers()
      .then((data) => {
        if (cancelled) return;
        if (!Array.isArray(data)) {
          throw new Error(
            'Customer service did not return an array. Got ' + typeof data,
          );
        }
        setRows(data);
      })
      .catch((err_) => {
        if (cancelled) return;
        setError(err_?.message || 'Could not load customers.');
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
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.phone || '').toLowerCase().includes(q) ||
        (c.address || '').toLowerCase().includes(q),
    );
  }, [rows, query]);

  return (
    <main className={styles.page}>
      <PageHeader
        eyebrow="Customers"
        title="Customer directory"
        description="Browse and search customers. Click a row to see their sales, custom orders, and due summary."
      />

      <div className={styles.controls}>
        <SearchInput
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name, phone, or address"
          aria-label="Search customers"
        />
        <span className={styles.count}>
          {filtered.length} customer{filtered.length === 1 ? '' : 's'}
        </span>
      </div>

      {loading ? (
        <Card className={styles.statusCard}>
          <Spinner /> <span>Loading customers…</span>
        </Card>
      ) : error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<CustomerIcon size={28} />}
          title="No customers match"
          description={
            query.trim()
              ? 'Try a different name, phone, or address.'
              : 'Customers will appear here once they are created.'
          }
        />
      ) : (
        <>
          {/* Desktop / tablet (≥769px): 6-column data table */}
          <div className={styles.desktopTable}>
            <div className={styles.tableCard}>
              <table className={styles.table} aria-label="Customers">
                <colgroup>
                  <col className={styles.colCode} />
                  <col className={styles.colName} />
                  <col className={styles.colPhone} />
                  <col className={styles.colAddress} />
                  <col className={styles.colNote} />
                  <col className={styles.colCreated} />
                </colgroup>
                <thead>
                  <tr>
                    <th scope="col">Customer Code</th>
                    <th scope="col">Name</th>
                    <th scope="col">Phone</th>
                    <th scope="col">Address</th>
                    <th scope="col">Note</th>
                    <th scope="col">Created At</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((c) => (
                    <tr key={c.id} className={styles.tableRow}>
                      <td className={styles.codeCell}>
                        <Link to={`/customers/${c.id}`} className={styles.codeLink}>
                          {c.id}
                        </Link>
                      </td>
                      <td className={styles.nameCell}>
                        <Link to={`/customers/${c.id}`} className={styles.nameLink}>
                          {c.name}
                        </Link>
                      </td>
                      <td className={styles.phoneCell}>
                        {c.phone || <span className={styles.muted}>—</span>}
                      </td>
                      <td className={styles.addressCell}>
                        {c.address || <span className={styles.muted}>—</span>}
                      </td>
                      <td className={styles.noteCell}>
                        {c.note || <span className={styles.muted}>—</span>}
                      </td>
                      <td className={styles.dateCell}>
                        {formatExactDate(c.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile (≤768px): stacked card list */}
          <ul className={styles.mobileList} aria-label="Customers">
            {filtered.map((c) => (
              <li key={c.id} className={styles.mobileCard}>
                <Link to={`/customers/${c.id}`} className={styles.mobileCardLink}>
                  <div className={styles.mobileTopRow}>
                    <span className={styles.mobileCodePill}>{c.id}</span>
                    <span className={styles.mobileName}>{c.name}</span>
                  </div>

                  <div className={styles.mobileContact}>
                    {c.phone && (
                      <span className={styles.mobilePhone}>{c.phone}</span>
                    )}
                    {c.address && (
                      <span className={styles.mobileAddress}>{c.address}</span>
                    )}
                    {!c.phone && !c.address && (
                      <span className={styles.muted}>No contact info</span>
                    )}
                  </div>

                  <div className={styles.mobileMeta}>
                    {c.note && (
                      <span className={styles.mobileNote}>
                        <span className={styles.mobileMetaLabel}>Note</span>
                        {c.note}
                      </span>
                    )}
                    <span className={styles.mobileDate}>
                      <span className={styles.mobileMetaLabel}>
                        Created
                      </span>
                      <time dateTime={c.createdAt || undefined}>
                        {formatExactDate(c.createdAt)}
                      </time>
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </main>
  );
}