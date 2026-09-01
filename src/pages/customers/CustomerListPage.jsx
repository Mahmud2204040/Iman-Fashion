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
import { timeAgo } from '../../utils/format.js';
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
        description="Browse, search, and open a customer to see sales, custom orders, and due summary."
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
        <ul className={styles.list} aria-label="Customers">
          {filtered.map((c) => (
            <li key={c.id}>
              <Link to={`/customers/${c.id}`} className={styles.row}>
                <div className={styles.rowMain}>
                  <span className={styles.name}>{c.name}</span>
                  <span className={styles.meta}>
                    {c.phone || 'No phone'} &middot; since{' '}
                    {timeAgo(c.createdAt)}
                  </span>
                </div>
                <div className={styles.rowSide}>
                  <span className={styles.classBadge}>
                    Class {c.currentClass || '—'}
                  </span>
                  <span
                    className={[
                      styles.statusBadge,
                      c.isActive ? styles.statusActive : styles.statusInactive,
                    ]
                      .filter(Boolean)
                      .join(' ')}
                  >
                    {c.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}