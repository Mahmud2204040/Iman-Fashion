import T from '../../components/common/LocalizedText.jsx';
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
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';

import {
  Card,
  EmptyState,
  PageHeader,
  SearchInput,
  Spinner,
} from '../../components/common/index.js';
import { CustomerIcon } from '../../components/icons/DashboardIcon.jsx';
import { getCustomers } from '../../services/customers/customerService.js';
import { formatCount, formatExactDate } from '../../utils/format.js';
import styles from './CustomerListPage.module.css';

export default function CustomerListPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const PAGE_SIZE = 25;
  const requestedPage = Number(searchParams.get('page')) || 1;
  const page = Math.max(1, requestedPage);
  const query = searchParams.get('q') || '';
  
  const queryClient = useQueryClient();

  const { data: qData, isLoading: loading, error: errorObj } = useQuery({
    queryKey: ['customers', page, PAGE_SIZE, query],
    queryFn: () => getCustomers({ page, pageSize: PAGE_SIZE, search: query }),
    placeholderData: keepPreviousData,
    staleTime: 5 * 60 * 1000,
  });

  const error = errorObj?.message || '';
  const filtered = qData?.data || [];
  const totalItems = qData?.meta?.total || 0;
  const pageCount = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));

  useEffect(() => {
    if (page < pageCount) {
      queryClient.prefetchQuery({
        queryKey: ['customers', page + 1, PAGE_SIZE, query],
        queryFn: () => getCustomers({ page: page + 1, pageSize: PAGE_SIZE, search: query }),
      });
    }
  }, [page, pageCount, query, queryClient]);

  return (
    <main className={styles.page}>
      <PageHeader
        eyebrow="Customers"
        title="Customer directory"
        description="Browse and search customers. Click a row to see their sales, custom orders, and due summary."
        actions={<Link to="/customers/new" className={styles.newCta}><span aria-hidden="true">＋</span><T>New customer</T></Link>}
      />

      <div className={styles.controls}>
        <SearchInput
          value={query}
          onChange={(e) => { const next = new URLSearchParams(searchParams); if (e.target.value) next.set('q', e.target.value); else next.delete('q'); next.set('page', '1'); setSearchParams(next, { replace: true }); }}
          placeholder="Search by code, name or phone"
          aria-label="Search customers"
        />
        <span className={styles.count}>
          {formatCount(totalItems, 'customer', 'customers', 'গ্রাহক')}
        </span>
      </div>

      {loading ? (
        <Card className={styles.statusCard}>
          <Spinner /> <span><T>Loading customers…</T></span>
        </Card>
      ) : error ? (
        <p className={styles.error} role="alert">
          <T>{error}</T>
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
                    <th scope="col"><T>Customer Code</T></th>
                    <th scope="col"><T>Name</T></th>
                    <th scope="col"><T>Phone</T></th>
                    <th scope="col"><T>Address</T></th>
                    <th scope="col"><T>Note</T></th>
                    <th scope="col"><T>Created At</T></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((c) => (
                    <tr key={c.id} className={styles.tableRow} onClick={(event) => {
                      if (!event.target.closest('a')) navigate(`/customers/${c.id}`);
                    }}>
                      <td className={styles.codeCell}>
                        <Link to={`/customers/${c.id}`} className={styles.codeLink}>
                          {c.customerCode || c.id}
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
                        {c.notes || <span className={styles.muted}>—</span>}
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
                    <span className={styles.mobileCodePill}>
                      {c.customerCode || c.id}
                    </span>
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
                      <span className={styles.muted}><T>No contact info</T></span>
                    )}
                  </div>

                  <div className={styles.mobileMeta}>
                    {c.notes && (
                      <span className={styles.mobileNote}>
                        <span className={styles.mobileMetaLabel}><T>Note</T></span>
                        {c.notes}
                      </span>
                    )}
                    <span className={styles.mobileDate}>
                      <span className={styles.mobileMetaLabel}><T>
                        Created
                      </T></span>
                      <time dateTime={c.createdAt || undefined}>
                        {formatExactDate(c.createdAt)}
                      </time>
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>

          {pageCount > 1 && (
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', justifyContent: 'flex-end', marginTop: '16px' }}>
              <button 
                type="button" 
                disabled={page === 1}
                onClick={() => { const next = new URLSearchParams(searchParams); next.set('page', String(page - 1)); setSearchParams(next); }}
                style={{ padding: '6px 12px', border: '1px solid #ccc', borderRadius: '4px' }}
              >
                <T>Previous</T>
              </button>
              <span>{page} / {pageCount}</span>
              <button 
                type="button" 
                disabled={page === pageCount}
                onClick={() => { const next = new URLSearchParams(searchParams); next.set('page', String(page + 1)); setSearchParams(next); }}
                style={{ padding: '6px 12px', border: '1px solid #ccc', borderRadius: '4px' }}
              >
                <T>Next</T>
              </button>
            </div>
          )}
        </>
      )}
    </main>
  );
}
