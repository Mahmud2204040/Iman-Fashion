/**
 * ReportsIndexPage — Phase 13.
 *
 * Landing page for all 25 owner-only report types.
 *
 * Per REQUIREMENTS.md §69-76 and §77-78, reports are read-only summaries
 * derived from the existing modules. The role guard is enforced at the
 * route level via <RoleRoute role={ROLES.OWNER}>; the service functions
 * inside reportService.js additionally reject non-owner actors with a
 * FORBIDDEN_ROLE error.
 *
 * UX:
 *   - Eyebrow + title + description via PageHeader.
 *   - Nine compact groups, with a direct link to every report.
 */
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import SearchInput from '../../components/common/SearchInput/SearchInput.jsx';
import { useLocale } from '../../contexts/LocaleContext.jsx';
import {
  SaleIcon,
  CustomOrderIcon,
  ProductIcon,
  CustomerIcon,
  SupplierIcon,
  RawMaterialIcon,
  ExpenseIcon,
  CashIcon,
  ReportIcon,
} from '../../components/icons/DashboardIcon.jsx';

import styles from './ReportsIndexPage.module.css';

/**
 * Group links map directly to the :reportType route parameter.
 */
const REPORT_GROUPS = [
  {
    id: 'sales',
    title: 'Sales',
    description: 'Daily, weekly, monthly and yearly totals; per-product breakdown; full sale list.',
    icon: SaleIcon,
    reports: [['Sales summary', 'sales-summary'], ['Sales by month', 'sales-monthly'], ['Sales by product', 'sales-by-product'], ['Sales list', 'sales-list']],
  },
  {
    id: 'custom-orders',
    title: 'Custom Orders',
    description: 'Status counts, outstanding dues, and recorded payments.',
    icon: CustomOrderIcon,
    reports: [['Status counts', 'custom-order-status'], ['Outstanding dues', 'custom-order-dues'], ['Payments', 'custom-order-payments']],
  },
  {
    id: 'inventory',
    title: 'Inventory',
    description: 'Current stock, stock value, and full adjustment history.',
    icon: ProductIcon,
    reports: [['Current inventory', 'inventory-current'], ['Stock adjustments', 'stock-adjustments']],
  },
  {
    id: 'customers',
    title: 'Customers',
    description: 'Customer directory snapshot with status and audit fields.',
    icon: CustomerIcon,
    reports: [['Customer list', 'customer-list']],
  },
  {
    id: 'suppliers',
    title: 'Suppliers',
    description: 'Purchases, payments, outstanding dues, and per-supplier totals.',
    icon: SupplierIcon,
    reports: [['Supplier totals', 'supplier-totals'], ['Purchases', 'supplier-purchases'], ['Outstanding dues', 'supplier-dues'], ['Payment history', 'supplier-payments']],
  },
  {
    id: 'raw-materials',
    title: 'Raw Materials',
    description: 'Date-wise purchases with optional cost tracking.',
    icon: RawMaterialIcon,
    reports: [['Raw materials', 'raw-materials']],
  },
  {
    id: 'expenses',
    title: 'Expenses',
    description: 'List, monthly, yearly, and by-category breakdowns.',
    icon: ExpenseIcon,
    reports: [['Expense list', 'expenses-list'], ['By month', 'expenses-monthly'], ['By year', 'expenses-yearly'], ['By category', 'expenses-by-category']],
  },
  {
    id: 'cash',
    title: 'Cash',
    description: 'Cash In / Cash Out / expected position across the window.',
    icon: CashIcon,
    reports: [['Opening', 'cash-opening'], ['Cash in', 'cash-in'], ['Cash out', 'cash-out'], ['Reconciliations', 'cash-adjustments'], ['Expected cash', 'cash-expected']],
  },
  {
    id: 'profit',
    title: 'Product profit',
    description: 'Sales revenue minus sale-time product purchase cost; unknown costs are flagged.',
    icon: ReportIcon,
    reports: [['Product profit', 'profit']],
  },
];

const FILTERS = [
  { id: 'all', label: 'All', groups: null },
  { id: 'sales', label: 'Sales', groups: ['sales'] },
  { id: 'orders', label: 'Orders', groups: ['custom-orders'] },
  { id: 'inventory', label: 'Inventory', groups: ['inventory', 'raw-materials'] },
  { id: 'customers', label: 'Customers', groups: ['customers'] },
  { id: 'suppliers', label: 'Suppliers', groups: ['suppliers'] },
  { id: 'finance', label: 'Finance', groups: ['expenses', 'cash'] },
  { id: 'profit', label: 'Profit', groups: ['profit'] },
];

export default function ReportsIndexPage() {
  const { t } = useLocale();
  const [query, setQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const visibleGroups = useMemo(() => {
    const filter = FILTERS.find((item) => item.id === activeFilter);
    const term = query.trim().toLocaleLowerCase();
    return REPORT_GROUPS.filter((group) => !filter?.groups || filter.groups.includes(group.id))
      .map((group) => {
        const categories = FILTERS.filter((item) => item.groups?.includes(group.id)).flatMap((item) => [item.label, t(item.label)]);
        return {
          ...group,
          reports: group.reports.filter(([title]) => !term || [group.title, group.description, title, t(group.title), t(group.description), t(title), ...categories]
            .some((value) => value.toLocaleLowerCase().includes(term))),
        };
      })
      .filter((group) => group.reports.length > 0);
  }, [activeFilter, query, t]);

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <span className={styles.eyebrow}>{t('Reports')}</span>
        <h1>{t('Reports')}</h1>
        <p>{t('Owner-only read-only summaries across sales, custom orders, inventory, customers, suppliers, raw materials, expenses, cash, and profit. Pick a group to drill in.')}</p>
      </header>

      <div className={styles.toolbar}>
        <SearchInput
          className={styles.search}
          aria-label="Search reports or categories"
          placeholder="Search reports or categories..."
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <div className={styles.filters} role="group" aria-label={t('Filter report categories')}>
          {FILTERS.map((filter) => (
            <button
              key={filter.id}
              type="button"
              className={`${styles.filter} ${activeFilter === filter.id ? styles.filterActive : ''}`}
              aria-pressed={activeFilter === filter.id}
              onClick={() => setActiveFilter(filter.id)}
            >{t(filter.label)}</button>
          ))}
        </div>
      </div>

      {visibleGroups.length === 0 ? <div className={styles.empty} role="status">
        <strong>{t('No matching reports')}</strong>
        <p>{t('Try another search or category.')}</p>
        <button type="button" onClick={() => { setQuery(''); setActiveFilter('all'); }}>{t('Clear filters')}</button>
      </div> : <ul className={styles.grid}>
        {visibleGroups.map((g) => {
          const Icon = g.icon;
          return (
            <li key={g.id} className={styles.gridItem}>
              <section className={styles.card} aria-label={t(g.title)}>
                <div className={styles.cardHeading}>
                  <span className={styles.titleIcon} aria-hidden="true"><Icon size={23} strokeWidth={1.85} /></span>
                  <div><h2>{t(g.title)}</h2><p className={styles.desc}>{t(g.description)}</p></div>
                </div>
                <div className={styles.reportLinks}>
                  {g.reports.map(([title, slug]) => (
                    <Link key={slug} to={`/reports/${slug}`} className={styles.reportLink}>
                      <span>{t(title)}</span><span className={styles.arrow} aria-hidden="true">›</span>
                    </Link>
                  ))}
                </div>
              </section>
            </li>
          );
        })}
      </ul>}
    </main>
  );
}
