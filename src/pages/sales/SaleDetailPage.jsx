/**
 * SaleDetailPage — Phase 5.
 *
 * Read-only view of a completed sale: header (sales code + total +
 * customer + timestamp), line-item table, audit footer.
 */
import { useEffect, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';

import { Spinner } from '../../components/common/index.js';
import { SaleIcon } from '../../components/icons/DashboardIcon.jsx';
import { getSaleById } from '../../services/sales/salesService.js';
import { formatCurrency, timeAgo } from '../../utils/format.js';
import styles from './SaleDetailPage.module.css';

export default function SaleDetailPage() {
  const { id } = useParams();
  const [sale, setSale] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');

    getSaleById(id)
      .then((data) => {
        if (cancelled) return;
        setSale(data);
      })
      .catch((err_) => {
        if (cancelled) return;
        setError(err_?.message || 'Could not load sale.');
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) {
    return (
      <main className={styles.page} aria-busy="true">
        <div className={styles.loading}>
          <Spinner /> <span>Loading sale…</span>
        </div>
      </main>
    );
  }

  if (error || !sale) {
    return <Navigate to="/sales" replace />;
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}>Sale</span>
          <h1 className={styles.code}>{sale.salesCode}</h1>
          <p className={styles.subtitle}>
            {sale.customerName} &middot; {timeAgo(sale.createdAt)}
          </p>
        </div>
        <div className={styles.headerTotal}>
          <span className={styles.headerTotalLabel}>Total</span>
          <span className={styles.headerTotalValue}>
            {formatCurrency(sale.total)}
          </span>
        </div>
      </header>

      <section className={styles.card} aria-labelledby="sale-items">
        <header className={styles.cardHead}>
          <h2 id="sale-items" className={styles.cardTitle}>
            <SaleIcon size={18} strokeWidth={1.75} /> Items
          </h2>
          <span className={styles.cardHint}>
            {sale.items.length} line{sale.items.length === 1 ? '' : 's'}
          </span>
        </header>

        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">Item</th>
                <th scope="col" className={styles.numCol}>
                  Qty
                </th>
                <th scope="col" className={styles.numCol}>
                  Price
                </th>
                <th scope="col" className={styles.numCol}>
                  Line total
                </th>
              </tr>
            </thead>
            <tbody>
              {sale.items.map((line) => (
                <tr key={line.productId}>
                  <td>
                    <div className={styles.itemCell}>
                      <span className={styles.itemName}>{line.productName}</span>
                      <span className={styles.itemSku}>{line.sku}</span>
                    </div>
                  </td>
                  <td className={styles.numCol}>{line.qty}</td>
                  <td className={styles.numCol}>{formatCurrency(line.price)}</td>
                  <td className={styles.numCol}>
                    {formatCurrency(line.qty * Number(line.price))}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={3} className={styles.totalLabel}>
                  Total
                </td>
                <td className={styles.numCol}>
                  <strong>{formatCurrency(sale.total)}</strong>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      <section className={styles.audit} aria-labelledby="sale-audit">
        <h2 id="sale-audit" className={styles.auditTitle}>
          Audit
        </h2>
        <dl className={styles.auditGrid}>
          <div>
            <dt>Created at</dt>
            <dd>{new Date(sale.createdAt).toLocaleString()}</dd>
          </div>
          <div>
            <dt>Created by</dt>
            <dd>{sale.createdBy || 'system'}</dd>
          </div>
          {sale.cashInId ? (
            <div>
              <dt>Paired cash-in</dt>
              <dd>
                <code>{sale.cashInId}</code>
              </dd>
            </div>
          ) : null}
        </dl>
      </section>

      <footer className={styles.footer}>
        <Link to="/sales" className={styles.backLink}>
          &larr; Back to sales
        </Link>
      </footer>
    </main>
  );
}
