/**
 * ReportsIndexPage — Phase 13.
 *
 * Landing page for the Reports module. Eight owner-only report groups
 * plus a Profit tile, each linking to /reports/:reportType.
 *
 * Per REQUIREMENTS.md §69-76 and §77-78, reports are read-only summaries
 * derived from the existing modules. The role guard is enforced at the
 * route level via <RoleRoute role={ROLES.OWNER}>; the service functions
 * inside reportService.js additionally reject non-owner actors with a
 * FORBIDDEN_ROLE error.
 *
 * UX:
 *   - Eyebrow + title + description via PageHeader.
 *   - 9 interactive Cards on a responsive grid.
 *   - Each tile shows an icon, name, summary, and "View report" affordance.
 *   - Cards are also <Link>s so middle-click and keyboard navigation work.
 */
import { Link } from 'react-router-dom';

import { Card, PageHeader } from '../../components/common/index.js';
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
 * The 9 report groups. `path` maps to the :reportType route param. `kind`
 * is the key the detail page uses to dispatch the loader. `icon` is a
 * component reference so we don't add an icon library.
 */
const REPORT_GROUPS = [
  {
    id: 'sales',
    title: 'Sales',
    description: 'Daily, weekly, monthly and yearly totals; per-product breakdown; full sale list.',
    icon: SaleIcon,
    path: '/reports/sales-summary',
  },
  {
    id: 'custom-orders',
    title: 'Custom Orders',
    description: 'Status counts, outstanding dues, and recorded payments.',
    icon: CustomOrderIcon,
    path: '/reports/custom-order-status',
  },
  {
    id: 'inventory',
    title: 'Inventory',
    description: 'Current stock, stock value, and full adjustment history.',
    icon: ProductIcon,
    path: '/reports/inventory-current',
  },
  {
    id: 'customers',
    title: 'Customers',
    description: 'Customer directory snapshot with status and audit fields.',
    icon: CustomerIcon,
    path: '/reports/customer-list',
  },
  {
    id: 'suppliers',
    title: 'Suppliers',
    description: 'Purchases, payments, outstanding dues, and per-supplier totals.',
    icon: SupplierIcon,
    path: '/reports/supplier-totals',
  },
  {
    id: 'raw-materials',
    title: 'Raw Materials',
    description: 'Date-wise purchases with optional cost tracking.',
    icon: RawMaterialIcon,
    path: '/reports/raw-materials',
  },
  {
    id: 'expenses',
    title: 'Expenses',
    description: 'List, monthly, yearly, and by-category breakdowns.',
    icon: ExpenseIcon,
    path: '/reports/expenses-list',
  },
  {
    id: 'cash',
    title: 'Cash',
    description: 'Cash In / Cash Out / expected position across the window.',
    icon: CashIcon,
    path: '/reports/cash-expected',
  },
  {
    id: 'profit',
    title: 'Profit',
    description: 'Revenue, COGS, expenses, and profit — flags missing purchase prices.',
    icon: ReportIcon,
    path: '/reports/profit',
  },
];

export default function ReportsIndexPage() {
  return (
    <main className={styles.page}>
      <PageHeader
        eyebrow="Reports"
        title="Reports"
        description="Owner-only read-only summaries across sales, custom orders, inventory, customers, suppliers, raw materials, expenses, cash, and profit. Pick a group to drill in."
      />

      <ul className={styles.grid}>
        {REPORT_GROUPS.map((g) => {
          const Icon = g.icon;
          return (
            <li key={g.id} className={styles.gridItem}>
              <Link
                to={g.path}
                className={styles.cardLink}
                aria-label={`Open ${g.title} report`}
              >
                <Card padding="md" interactive>
                  <Card.Header>
                    <Card.Title>
                      <span className={styles.titleIcon} aria-hidden="true">
                        <Icon size={20} />
                      </span>
                      {g.title}
                    </Card.Title>
                  </Card.Header>
                  <Card.Body>
                    <p className={styles.desc}>{g.description}</p>
                    <span className={styles.cta}>View report →</span>
                  </Card.Body>
                </Card>
              </Link>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
