import T from '../../components/common/LocalizedText.jsx';
import { useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';

import { Button, Spinner } from '../../components/common/index.js';
import { SaleIcon } from '../../components/icons/DashboardIcon.jsx';
import { useAuth } from '../../hooks/useAuth.js';
import { useLocale } from '../../contexts/LocaleContext.jsx';
import { getSaleById } from '../../services/sales/salesService.js';
import { formatCurrency, formatExactDateTime } from '../../utils/format.js';
import styles from './SaleDetailPage.module.css';

export default function SaleDetailPage({ saleId, embedded = false }) {
  const { id: routeId } = useParams();
  const location = useLocation();
  const id = saleId || routeId;
  const Root = embedded ? 'div' : 'main';
  const SaleHeading = embedded ? 'h3' : 'h1';
  const backToSales = `/sales${location.search}`;
  const { user, role } = useAuth();
  const { t } = useLocale();
  const [sale, setSale] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    getSaleById(id, { actor: user })
      .then((data) => { if (!cancelled) setSale(data); })
      .catch((err) => { if (!cancelled) setError(err?.message || 'Could not load sale.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [id, user, reloadKey]);

  if (loading) {
    return <Root className={`${styles.page} ${embedded ? styles.embedded : ''}`} aria-busy="true">
      <div className={styles.stateCard}><Spinner size="sm" /><span>{t('Loading sale…')}</span></div>
    </Root>;
  }

  if (error || !sale) {
    return <Root className={`${styles.page} ${embedded ? styles.embedded : ''}`}>
      <div className={styles.errorCard} role="alert">
        <span>{t(error || 'Sale not found.')}</span>
        <div className={styles.errorActions}>
          <Link to={backToSales} className={styles.secondaryAction}>{t('← Back to sales')}</Link>
          {error ? <Button variant="secondary" size="sm" onClick={() => setReloadKey((value) => value + 1)}>{t('Retry')}</Button> : null}
        </div>
      </div>
    </Root>;
  }

  const saleDate = formatExactDateTime(sale.createdAt);
  const itemCount = sale.items.reduce((total, line) => total + Number(line.qty || 0), 0);

  return (
    <Root className={`${styles.page} ${embedded ? styles.embedded : ''}`}>
      <header className={styles.pageHeading}>
        <div className={styles.headingIdentity}>
          <Link to={backToSales} className={styles.backLink}>← <T>Sales history</T></Link>
          <span className={styles.eyebrow}><T>Sale</T> / <T>Invoice</T></span>
          <div className={styles.codeRow}>
            <SaleHeading>{sale.salesCode}</SaleHeading>
            <span className={styles.statusBadge}><span aria-hidden="true" />{t('Completed')}</span>
          </div>
          <p>{sale.customerId ? <Link className={styles.customerLink} to={`/customers/${sale.customerId}`}>{sale.customerName}</Link> : <strong className={styles.customerName}>{sale.customerName || t('Walk-in')}</strong>} <span aria-hidden="true">·</span> {saleDate}</p>
        </div>
        <div className={styles.totalCard}><span>{t('Total')}</span><strong>{formatCurrency(sale.total)}</strong></div>
      </header>

      <div className={styles.summaryGrid} aria-label={t('Sale summary')}>
        <div><span>{t('Items')}</span><strong>{itemCount}</strong></div>
        <div><span>{t('Created by')}</span><strong>{sale.createdBy || 'system'}</strong></div>
        <div><span>{t('Paired cash-in')}</span><strong>{sale.cashInId || '—'}</strong></div>
      </div>

      <div className={styles.contentGrid}>
        <section className={styles.itemsCard} aria-labelledby="sale-items">
          <header className={styles.cardHead}>
            <div className={styles.cardTitleWrap}><span className={styles.cardIcon}><SaleIcon size={17} strokeWidth={1.9} /></span><h2 id="sale-items"><T>Items</T></h2></div>
            <span className={styles.cardHint}>{sale.items.length} {sale.items.length === 1 ? t('line') : t('lines')}</span>
          </header>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead><tr>
                <th scope="col"><T>Item</T></th><th scope="col" className={styles.numCol}><T>Qty</T></th><th scope="col" className={styles.numCol}><T>Price</T></th><th scope="col" className={styles.numCol}><T>Line total</T></th>
                {role === 'OWNER' ? <th scope="col" className={styles.numCol}>{t('Cost snapshot')}</th> : null}
              </tr></thead>
              <tbody>{sale.items.map((line) => (
                <tr key={line.productId}>
                  <td><div className={styles.itemCell}><strong>{line.productName}</strong><span>{line.sku}</span></div></td>
                  <td className={styles.numCol}>{line.qty}</td><td className={styles.numCol}>{formatCurrency(line.price)}</td><td className={styles.numCol}>{formatCurrency(line.qty * Number(line.price))}</td>
                  {role === 'OWNER' ? <td className={styles.numCol}>{line.purchaseCostAtSale == null ? t('Unknown cost') : formatCurrency(line.purchaseCostAtSale)}</td> : null}
                </tr>
              ))}</tbody>
              <tfoot><tr><td colSpan={3} className={styles.totalLabel}><T>Total</T></td><td className={styles.numCol}><strong>{formatCurrency(sale.total)}</strong></td>{role === 'OWNER' ? <td /> : null}</tr></tfoot>
            </table>
          </div>
        </section>

        <aside className={styles.sideStack}>
          <section className={styles.auditCard} aria-labelledby="sale-audit">
            <header className={styles.sideHead}><h2 id="sale-audit"><T>Audit</T></h2><span className={styles.readOnly}><T>Read only</T></span></header>
            <dl className={styles.auditGrid}>
              <div><dt><T>Created at</T></dt><dd>{saleDate}</dd></div><div><dt><T>Created by</T></dt><dd>{sale.createdBy || 'system'}</dd></div>
              {role === 'OWNER' && sale.cashInId ? <div><dt><T>Paired cash-in</T></dt><dd><code>{sale.cashInId}</code></dd></div> : null}
            </dl>
          </section>
          <section className={styles.movementCard} aria-labelledby="stock-movement">
            <h2 id="stock-movement"><T>Stock movement</T></h2>
            <ul>{sale.items.map((line) => <li key={line.productId}><span>{line.productName}</span><strong>−{line.qty}</strong></li>)}</ul>
          </section>
        </aside>
      </div>

      <footer className={styles.footer}><Link to={backToSales} className={styles.secondaryAction}>{t('← Back to sales')}</Link></footer>
    </Root>
  );
}
