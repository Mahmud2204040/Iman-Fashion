import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth.js';
import { ROLES } from '../../constants/roles.js';
import {
  PageHeader,
  Card,
  Badge,
  DataTable,
  EmptyState,
  Spinner,
  Button,
} from '../../components/common/index.js';
import {
  resolveRange,
  getSalesSummary,
  getSalesMonthly,
  getSalesByProduct,
  getSalesList,
  getCustomOrderStatusCounts,
  getCustomOrderOutstandingDues,
  getCustomOrderPaymentsReport,
  getInventoryCurrent,
  getStockAdjustmentsReport,
  getCustomerListReport,
  getSupplierPurchasesReport,
  getSupplierOutstandingDues,
  getSupplierWiseTotals,
  getSupplierPaymentHistory,
  getRawMaterialsReport,
  getExpensesListReport,
  getExpensesMonthly,
  getExpensesYearly,
  getExpensesByCategory,
  getCashOpening,
  getCashInReport,
  getCashOutReport,
  getCashAdjustmentsReport,
  getCashExpected,
  getProfitReport,
} from '../../services/reports/reportService.js';

import styles from './ReportDetailPage.module.css';

const RANGE_OPTIONS = [
  { id: 'today', label: 'Today' },
  { id: 'week', label: 'This week' },
  { id: 'month', label: 'This month' },
  { id: 'year', label: 'This year' },
];

function formatMoney(amount) {
  if (amount === null || amount === undefined || Number.isNaN(Number(amount))) {
    return '—';
  }
  return Number(amount).toFixed(2);
}

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString();
}

function useReportData(loader, deps = [], range) {
  const { user } = useAuth();
  const [state, setState] = useState({ loading: true, error: '', data: null });

  const depsKey = useMemo(() => JSON.stringify(deps), [deps]);
  const rangeKey = useMemo(
    () => `${range?.preset || ''}|${range?.from || ''}|${range?.to || ''}`,
    [range?.preset, range?.from, range?.to]
  );

  useEffect(() => {
    if (!user) return undefined;
    let cancelled = false;
    setState({ loading: true, error: '', data: null });
    Promise.resolve()
      .then(() =>
        loader({
          actor: { username: user.username, role: user.role },
          range,
        })
      )
      .then((data) => {
        if (!cancelled) setState({ loading: false, error: '', data });
      })
      .catch((err) => {
        if (cancelled) return;
        if (err && err.code === 'FORBIDDEN_ROLE') {
          setState({
            loading: false,
            error: 'You do not have permission to view this report.',
            data: null,
          });
        } else {
          setState({
            loading: false,
            error: (err && err.message) || 'Failed to load report.',
            data: null,
          });
        }
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, depsKey, rangeKey]);

  return state;
}

function KpiCard({ label, value, hint }) {
  return (
    <Card padding="md">
      <p className={styles.kpiLabel}>{label}</p>
      <p className={styles.kpiValue}>{value}</p>
      {hint ? <p className={styles.kpiHint}>{hint}</p> : null}
    </Card>
  );
}

function KpiRow({ items }) {
  if (!items || items.length === 0) return null;
  return (
    <div className={styles.kpiRow}>
      {items.map((item) => (
        <KpiCard key={item.label} label={item.label} value={item.value} hint={item.hint} />
      ))}
    </div>
  );
}

function FiltersBar({ preset, onPresetChange, range, onRangeChange, customSupported }) {
  return (
    <Card padding="md">
      <div className={styles.filterRow}>
        {RANGE_OPTIONS.map((opt) => (
          <Button
            key={opt.id}
            type="button"
            variant={preset === opt.id ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => onPresetChange(opt.id)}
          >
            {opt.label}
          </Button>
        ))}
        {customSupported ? (
          <div className={styles.dateRow}>
            <input
              type="date"
              aria-label="From date"
              value={range.from || ''}
              onChange={(e) => onRangeChange({ ...range, from: e.target.value })}
            />
            <span aria-hidden="true">to</span>
            <input
              type="date"
              aria-label="To date"
              value={range.to || ''}
              onChange={(e) => onRangeChange({ ...range, to: e.target.value })}
            />
          </div>
        ) : null}
      </div>
    </Card>
  );
}

function LoadingBlock() {
  return (
    <Card padding="lg">
      <div className={styles.loading}>
        <Spinner size="sm" />
        <span>Loading report…</span>
      </div>
    </Card>
  );
}

function ErrorBlock({ message }) {
  return (
    <Card padding="md">
      <Badge tone="danger" variant="soft">
        {message || 'Something went wrong.'}
      </Badge>
    </Card>
  );
}

function Note({ message }) {
  if (!message) return null;
  return <p className={styles.note}>{message}</p>;
}

function ReportShell({ title, subtitle, action, children }) {
  return (
    <div className={styles.page}>
      <PageHeader
        title={title}
        subtitle={subtitle}
        actions={
          <div className={styles.headerActions}>
            <Link to="/reports" className={styles.linkButton}>
              ← All reports
            </Link>
            {action}
          </div>
        }
      />
      {children}
    </div>
  );
}

function useRangeState() {
  const [preset, setPreset] = useState('month');
  const [range, setRange] = useState({ from: '', to: '' });
  return { preset, setPreset, range, setRange };
}

function DateRangeReport({ title, subtitle, loader, deps, render, customSupported = true }) {
  const { preset, setPreset, range, setRange } = useRangeState();
  const resolved = useMemo(
    () => resolveRange({ preset, from: range.from, to: range.to }),
    [preset, range.from, range.to]
  );
  const { loading, error, data } = useReportData(loader, deps, resolved);
  return (
    <ReportShell title={title} subtitle={subtitle}>
      <FiltersBar
        preset={preset}
        onPresetChange={setPreset}
        range={range}
        onRangeChange={setRange}
        customSupported={customSupported}
      />
      {loading ? <LoadingBlock /> : error ? <ErrorBlock message={error} /> : render(data)}
    </ReportShell>
  );
}

/* ------------------------------- Sales ---------------------------------- */

function SalesSummaryReport() {
  return (
    <DateRangeReport
      title="Sales summary"
      subtitle="Headline totals for the selected period"
      loader={getSalesSummary}
      render={(data) => (
        <>
          <KpiRow
            items={[
              { label: 'Sales count', value: data.count ?? 0 },
              { label: 'Items sold', value: data.itemsSold ?? 0 },
              { label: 'Revenue', value: formatMoney(data.revenue) },
              { label: 'Average sale', value: formatMoney(data.averageSale) },
            ]}
          />
        </>
      )}
    />
  );
}

function SalesMonthlyReport() {
  return (
    <DateRangeReport
      title="Sales by month"
      subtitle="Revenue grouped by month"
      loader={getSalesMonthly}
      render={(data) => (
        <Card padding="md">
          <DataTable
            columns={[
              { key: 'month', header: 'Month', render: (row) => row.month || '—' },
              { key: 'count', header: 'Sales', render: (row) => row.count ?? 0 },
              { key: 'revenue', header: 'Revenue', render: (row) => formatMoney(row.revenue) },
            ]}
            rows={data?.rows || []}
            emptyLabel="No sales recorded."
            getRowKey={(row, idx) => `${row.month || 'month'}-${idx}`}
          />
        </Card>
      )}
    />
  );
}

function SalesByProductReport() {
  return (
    <DateRangeReport
      title="Sales by product"
      subtitle="Quantity and revenue per product"
      loader={getSalesByProduct}
      render={(data) => (
        <Card padding="md">
          <DataTable
            columns={[
              { key: 'productName', header: 'Product', render: (row) => row.productName || '—' },
              { key: 'sku', header: 'SKU', render: (row) => row.sku || '—' },
              { key: 'quantity', header: 'Qty sold', render: (row) => row.quantity ?? 0 },
              { key: 'revenue', header: 'Revenue', render: (row) => formatMoney(row.revenue) },
            ]}
            rows={data?.rows || []}
            emptyLabel="No product sales."
            getRowKey={(row, idx) => `${row.productId || 'p'}-${idx}`}
          />
        </Card>
      )}
    />
  );
}

function SalesListReport() {
  return (
    <DateRangeReport
      title="Sales list"
      subtitle="Every sale in the selected period"
      loader={getSalesList}
      render={(data) => (
        <Card padding="md">
          <DataTable
            columns={[
              { key: 'code', header: 'Sale #', render: (row) => row.code || '—' },
              {
                key: 'createdAt',
                header: 'Date',
                render: (row) => formatDate(row.createdAt),
              },
              {
                key: 'customerName',
                header: 'Customer',
                render: (row) => row.customerName || 'Walk-in',
              },
              {
                key: 'items',
                header: 'Items',
                render: (row) => (Array.isArray(row.items) ? row.items.length : 0),
              },
              { key: 'total', header: 'Total', render: (row) => formatMoney(row.total) },
            ]}
            rows={data?.rows || []}
            emptyLabel="No sales yet."
            getRowKey={(row) => row.id || row.code}
          />
        </Card>
      )}
    />
  );
}

/* ---------------------------- Custom orders ----------------------------- */

function CustomOrderStatusReport() {
  const { preset, setPreset, range, setRange } = useRangeState();
  const resolved = useMemo(
    () => resolveRange({ preset, from: range.from, to: range.to }),
    [preset, range.from, range.to]
  );
  const { loading, error, data } = useReportData(getCustomOrderStatusCounts, [], resolved);
  return (
    <ReportShell title="Custom orders by status" subtitle="Current status snapshot">
      <FiltersBar
        preset={preset}
        onPresetChange={setPreset}
        range={range}
        onRangeChange={setRange}
        customSupported
      />
      {loading ? <LoadingBlock /> : error ? <ErrorBlock message={error} /> : (
        <KpiRow
          items={(data?.counts || []).map((c) => ({
            label: c.status || '—',
            value: c.count ?? 0,
          }))}
        />
      )}
    </ReportShell>
  );
}

function CustomOrderDuesReport() {
  return (
    <DateRangeReport
      title="Custom order outstanding dues"
      subtitle="Orders that still owe money"
      loader={getCustomOrderOutstandingDues}
      render={(data) => (
        <Card padding="md">
          <DataTable
            columns={[
              { key: 'code', header: 'Order #', render: (row) => row.code || '—' },
              {
                key: 'customerName',
                header: 'Customer',
                render: (row) => row.customerName || '—',
              },
              {
                key: 'dueDate',
                header: 'Due date',
                render: (row) => formatDate(row.dueDate),
              },
              { key: 'total', header: 'Total', render: (row) => formatMoney(row.total) },
              { key: 'paid', header: 'Paid', render: (row) => formatMoney(row.paid) },
              { key: 'due', header: 'Due', render: (row) => formatMoney(row.due) },
              {
                key: 'status',
                header: 'Status',
                render: (row) => (
                  <Badge tone={row.status === 'CANCELLED' ? 'neutral' : 'warning'} variant="soft">
                    {row.status || '—'}
                  </Badge>
                ),
              },
            ]}
            rows={data?.rows || []}
            emptyLabel="No outstanding dues."
            getRowKey={(row) => row.id || row.code}
          />
        </Card>
      )}
    />
  );
}

function CustomOrderPaymentsReport() {
  return (
    <DateRangeReport
      title="Custom order payments"
      subtitle="Payments received against custom orders"
      loader={getCustomOrderPaymentsReport}
      render={(data) => (
        <Card padding="md">
          <KpiRow
            items={[
              { label: 'Payments', value: data?.count ?? 0 },
              { label: 'Amount collected', value: formatMoney(data?.total) },
            ]}
          />
          <div style={{ height: 12 }} />
          <DataTable
            columns={[
              {
                key: 'paidAt',
                header: 'Date',
                render: (row) => formatDate(row.paidAt),
              },
              { key: 'code', header: 'Order #', render: (row) => row.code || '—' },
              {
                key: 'customerName',
                header: 'Customer',
                render: (row) => row.customerName || '—',
              },
              { key: 'amount', header: 'Amount', render: (row) => formatMoney(row.amount) },
            ]}
            rows={data?.rows || []}
            emptyLabel="No payments yet."
            getRowKey={(row, idx) => `${row.id || row.code || 'row'}-${idx}`}
          />
        </Card>
      )}
    />
  );
}

/* ------------------------------ Inventory ------------------------------- */

function InventoryCurrentReport() {
  const navigate = useNavigate();
  const { loading, error, data } = useReportData(getInventoryCurrent, [], null);
  return (
    <ReportShell title="Current inventory" subtitle="Stock on hand right now">
      {loading ? (
        <LoadingBlock />
      ) : error ? (
        <ErrorBlock message={error} />
      ) : (
        <Card padding="md">
          <DataTable
            columns={[
              { key: 'name', header: 'Product', render: (row) => row.name || '—' },
              { key: 'sku', header: 'SKU', render: (row) => row.sku || '—' },
              { key: 'category', header: 'Category', render: (row) => row.category || '—' },
              { key: 'stock', header: 'Stock', render: (row) => row.stock ?? 0 },
              {
                key: 'status',
                header: 'Status',
                render: (row) => (
                  <Badge tone={row.isActive ? 'success' : 'neutral'} variant="soft">
                    {row.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                ),
              },
            ]}
            rows={data?.rows || []}
            emptyLabel={
              <EmptyState
                title="No products yet"
                description="Add products from the Products page to track stock."
                action={
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    onClick={() => navigate('/products')}
                  >
                    Open products
                  </Button>
                }
              />
            }
            getRowKey={(row) => row.id || row.sku}
          />
        </Card>
      )}
    </ReportShell>
  );
}

function StockAdjustmentsReport() {
  return (
    <DateRangeReport
      title="Stock adjustments"
      subtitle="Every quantity change with reason"
      loader={getStockAdjustmentsReport}
      render={(data) => (
        <Card padding="md">
          <DataTable
            columns={[
              {
                key: 'createdAt',
                header: 'Date',
                render: (row) => formatDate(row.createdAt),
              },
              { key: 'productName', header: 'Product', render: (row) => row.productName || '—' },
              { key: 'delta', header: 'Δ', render: (row) => row.delta ?? 0 },
              { key: 'reason', header: 'Reason', render: (row) => row.reason || '—' },
              { key: 'note', header: 'Note', render: (row) => row.note || '—' },
              { key: 'createdBy', header: 'By', render: (row) => row.createdBy || '—' },
            ]}
            rows={data?.rows || []}
            emptyLabel="No stock movements."
            getRowKey={(row) => row.id || `${row.productId}-${row.createdAt}`}
          />
        </Card>
      )}
    />
  );
}

/* ------------------------------ Customers ------------------------------- */

function CustomerListReport() {
  const { loading, error, data } = useReportData(getCustomerListReport, [], null);
  return (
    <ReportShell title="Customer list" subtitle="All customers with current class">
      {loading ? (
        <LoadingBlock />
      ) : error ? (
        <ErrorBlock message={error} />
      ) : (
        <Card padding="md">
          <DataTable
            columns={[
              { key: 'name', header: 'Name', render: (row) => row.name || '—' },
              { key: 'phone', header: 'Phone', render: (row) => row.phone || '—' },
              { key: 'initialClass', header: 'Initial class', render: (row) => row.initialClass || '—' },
              { key: 'currentClass', header: 'Current class', render: (row) => row.currentClass || '—' },
              {
                key: 'isActive',
                header: 'Status',
                render: (row) => (
                  <Badge tone={row.isActive ? 'success' : 'neutral'} variant="soft">
                    {row.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                ),
              },
            ]}
            rows={data?.rows || []}
            emptyLabel="No customers yet."
            getRowKey={(row) => row.id}
          />
        </Card>
      )}
    </ReportShell>
  );
}

/* ------------------------------ Suppliers ------------------------------- */

function SupplierTotalsReport() {
  return (
    <DateRangeReport
      title="Supplier totals"
      subtitle="Purchases, paid and outstanding per supplier"
      loader={getSupplierWiseTotals}
      render={(data) => (
        <Card padding="md">
          <DataTable
            columns={[
              { key: 'name', header: 'Supplier', render: (row) => row.name || '—' },
              { key: 'phone', header: 'Phone', render: (row) => row.phone || '—' },
              {
                key: 'totalPurchases',
                header: 'Purchases',
                render: (row) => formatMoney(row.totalPurchases),
              },
              {
                key: 'totalPaid',
                header: 'Paid',
                render: (row) => formatMoney(row.totalPaid),
              },
              {
                key: 'outstanding',
                header: 'Due',
                render: (row) => formatMoney(row.outstanding),
              },
            ]}
            rows={data?.rows || []}
            emptyLabel="No purchases yet."
            getRowKey={(row) => row.id}
          />
        </Card>
      )}
    />
  );
}

function SupplierPurchasesReport() {
  return (
    <DateRangeReport
      title="Supplier purchase list"
      subtitle="Every purchase order in the period"
      loader={getSupplierPurchasesReport}
      render={(data) => (
        <Card padding="md">
          <DataTable
            columns={[
              { key: 'createdAt', header: 'Date', render: (row) => formatDate(row.createdAt) },
              {
                key: 'supplierName',
                header: 'Supplier',
                render: (row) => row.supplierName || '—',
              },
              {
                key: 'items',
                header: 'Items',
                render: (row) => (Array.isArray(row.items) ? row.items.length : 0),
              },
              { key: 'total', header: 'Total', render: (row) => formatMoney(row.total) },
              {
                key: 'status',
                header: 'Status',
                render: (row) => (
                  <Badge tone="info" variant="soft">
                    {row.status || '—'}
                  </Badge>
                ),
              },
            ]}
            rows={data?.rows || []}
            emptyLabel="No purchases."
            getRowKey={(row) => row.id}
          />
        </Card>
      )}
    />
  );
}

function SupplierDuesReport() {
  return (
    <DateRangeReport
      title="Supplier outstanding dues"
      subtitle="Amount still owed to suppliers"
      loader={getSupplierOutstandingDues}
      render={(data) => (
        <Card padding="md">
          <DataTable
            columns={[
              {
                key: 'supplierName',
                header: 'Supplier',
                render: (row) => row.supplierName || '—',
              },
              {
                key: 'phone',
                header: 'Phone',
                render: (row) => row.phone || '—',
              },
              { key: 'total', header: 'Total', render: (row) => formatMoney(row.total) },
              { key: 'paid', header: 'Paid', render: (row) => formatMoney(row.paid) },
              { key: 'due', header: 'Due', render: (row) => formatMoney(row.due) },
            ]}
            rows={data?.rows || []}
            emptyLabel="Nothing owed."
            getRowKey={(row) => row.id}
          />
        </Card>
      )}
    />
  );
}

function SupplierPaymentsReport() {
  return (
    <DateRangeReport
      title="Supplier payment history"
      subtitle="Every payment made to suppliers"
      loader={getSupplierPaymentHistory}
      render={(data) => (
        <Card padding="md">
          <DataTable
            columns={[
              {
                key: 'paidAt',
                header: 'Date',
                render: (row) => formatDate(row.paidAt),
              },
              {
                key: 'supplierName',
                header: 'Supplier',
                render: (row) => row.supplierName || '—',
              },
              { key: 'amount', header: 'Amount', render: (row) => formatMoney(row.amount) },
              {
                key: 'method',
                header: 'Method',
                render: (row) => row.method || '—',
              },
              { key: 'note', header: 'Note', render: (row) => row.note || '—' },
            ]}
            rows={data?.rows || []}
            emptyLabel="No supplier payments."
            getRowKey={(row, idx) => `${row.id || 'row'}-${idx}`}
          />
        </Card>
      )}
    />
  );
}

/* ---------------------------- Raw materials ----------------------------- */

function RawMaterialsReport() {
  const { loading, error, data } = useReportData(getRawMaterialsReport, [], null);
  return (
    <ReportShell title="Raw materials" subtitle="Stock list of raw materials">
      {loading ? (
        <LoadingBlock />
      ) : error ? (
        <ErrorBlock message={error} />
      ) : (
        <Card padding="md">
          <DataTable
            columns={[
              { key: 'itemName', header: 'Item', render: (row) => row.itemName || '—' },
              { key: 'quantity', header: 'Qty', render: (row) => row.quantity ?? 0 },
              {
                key: 'purchaseCost',
                header: 'Cost',
                render: (row) => formatMoney(row.purchaseCost),
              },
              { key: 'date', header: 'Date', render: (row) => formatDate(row.date) },
              {
                key: 'description',
                header: 'Description',
                render: (row) => row.description || '—',
              },
            ]}
            rows={data?.rows || []}
            emptyLabel="No raw materials."
            getRowKey={(row) => row.id}
          />
        </Card>
      )}
    </ReportShell>
  );
}

/* ------------------------------ Expenses -------------------------------- */

function ExpensesListReport() {
  return (
    <DateRangeReport
      title="Expenses list"
      subtitle="Every expense in the period"
      loader={getExpensesListReport}
      render={(data) => (
        <Card padding="md">
          <DataTable
            columns={[
              {
                key: 'expenseDate',
                header: 'Date',
                render: (row) => formatDate(row.expenseDate),
              },
              {
                key: 'categoryName',
                header: 'Category',
                render: (row) => row.categoryName || '—',
              },
              { key: 'amount', header: 'Amount', render: (row) => formatMoney(row.amount) },
              {
                key: 'description',
                header: 'Description',
                render: (row) => row.description || '—',
              },
              {
                key: 'createdBy',
                header: 'By',
                render: (row) => row.createdBy || '—',
              },
            ]}
            rows={data?.rows || []}
            emptyLabel="No expenses recorded."
            getRowKey={(row) => row.id}
          />
        </Card>
      )}
    />
  );
}

function ExpensesMonthlyReport() {
  return (
    <DateRangeReport
      title="Expenses by month"
      subtitle="Monthly expense totals"
      loader={getExpensesMonthly}
      render={(data) => (
        <Card padding="md">
          <DataTable
            columns={[
              { key: 'month', header: 'Month', render: (row) => row.month || '—' },
              { key: 'total', header: 'Total', render: (row) => formatMoney(row.total) },
            ]}
            rows={data?.rows || []}
            emptyLabel="No expenses."
            getRowKey={(row, idx) => `${row.month || 'm'}-${idx}`}
          />
        </Card>
      )}
    />
  );
}

function ExpensesYearlyReport() {
  return (
    <DateRangeReport
      title="Expenses by year"
      subtitle="Yearly expense totals"
      loader={getExpensesYearly}
      render={(data) => (
        <Card padding="md">
          <DataTable
            columns={[
              { key: 'year', header: 'Year', render: (row) => row.year || '—' },
              { key: 'total', header: 'Total', render: (row) => formatMoney(row.total) },
            ]}
            rows={data?.rows || []}
            emptyLabel="No expenses."
            getRowKey={(row, idx) => `${row.year || 'y'}-${idx}`}
          />
        </Card>
      )}
    />
  );
}

function ExpensesByCategoryReport() {
  return (
    <DateRangeReport
      title="Expenses by category"
      subtitle="Spend grouped by category"
      loader={getExpensesByCategory}
      render={(data) => (
        <Card padding="md">
          <DataTable
            columns={[
              {
                key: 'categoryName',
                header: 'Category',
                render: (row) => row.categoryName || '—',
              },
              { key: 'count', header: 'Entries', render: (row) => row.count ?? 0 },
              { key: 'total', header: 'Total', render: (row) => formatMoney(row.total) },
            ]}
            rows={data?.rows || []}
            emptyLabel="No expenses."
            getRowKey={(row, idx) => `${row.categoryId || row.categoryName || 'c'}-${idx}`}
          />
        </Card>
      )}
    />
  );
}

/* -------------------------------- Cash ---------------------------------- */

function CashOpeningReport() {
  const { loading, error, data } = useReportData(getCashOpening, [], null);
  return (
    <ReportShell title="Cash opening" subtitle="Opening balance for the day">
      {loading ? (
        <LoadingBlock />
      ) : error ? (
        <ErrorBlock message={error} />
      ) : (
        <Card padding="md">
          <KpiRow
            items={[
              {
                label: 'Opening balance',
                value: formatMoney(data?.opening),
                hint: data?.derivedFrom || '',
              },
            ]}
          />
          <Note message={data?.note} />
        </Card>
      )}
    </ReportShell>
  );
}

function CashInReport() {
  return (
    <DateRangeReport
      title="Cash in"
      subtitle="Money received in the selected period"
      loader={getCashInReport}
      render={(data) => (
        <Card padding="md">
          <KpiRow
            items={[
              { label: 'Entries', value: data?.count ?? 0 },
              { label: 'Total in', value: formatMoney(data?.total) },
            ]}
          />
          <div style={{ height: 12 }} />
          <DataTable
            columns={[
              {
                key: 'createdAt',
                header: 'Date',
                render: (row) => formatDate(row.createdAt),
              },
              {
                key: 'referenceType',
                header: 'Source',
                render: (row) => row.referenceType || 'MANUAL',
              },
              { key: 'amount', header: 'Amount', render: (row) => formatMoney(row.amount) },
              { key: 'reason', header: 'Reason', render: (row) => row.reason || '—' },
              {
                key: 'createdBy',
                header: 'By',
                render: (row) => row.createdBy || '—',
              },
            ]}
            rows={data?.rows || []}
            emptyLabel="No cash in."
            getRowKey={(row) => row.id}
          />
        </Card>
      )}
    />
  );
}

function CashOutReport() {
  return (
    <DateRangeReport
      title="Cash out"
      subtitle="Money paid out in the selected period"
      loader={getCashOutReport}
      render={(data) => (
        <Card padding="md">
          <KpiRow
            items={[
              { label: 'Entries', value: data?.count ?? 0 },
              { label: 'Total out', value: formatMoney(data?.total) },
            ]}
          />
          <div style={{ height: 12 }} />
          <DataTable
            columns={[
              {
                key: 'createdAt',
                header: 'Date',
                render: (row) => formatDate(row.createdAt),
              },
              {
                key: 'referenceType',
                header: 'Source',
                render: (row) => row.referenceType || 'MANUAL',
              },
              { key: 'amount', header: 'Amount', render: (row) => formatMoney(row.amount) },
              { key: 'reason', header: 'Reason', render: (row) => row.reason || '—' },
              {
                key: 'createdBy',
                header: 'By',
                render: (row) => row.createdBy || '—',
              },
            ]}
            rows={data?.rows || []}
            emptyLabel="No cash out."
            getRowKey={(row) => row.id}
          />
        </Card>
      )}
    />
  );
}

function CashAdjustmentsReport() {
  const { loading, error, data } = useReportData(getCashAdjustmentsReport, [], null);
  return (
    <ReportShell
      title="Cash adjustments"
      subtitle="Reconciliation corrections"
      action={null}
    >
      {loading ? (
        <LoadingBlock />
      ) : error ? (
        <ErrorBlock message={error} />
      ) : (
        <Card padding="md">
          <EmptyState
            title="No adjustments"
            description="Manual reconciliation entries will appear here when used."
          />
          <Note message={data?.note} />
        </Card>
      )}
    </ReportShell>
  );
}

function CashExpectedReport() {
  const { loading, error, data } = useReportData(getCashExpected, [], null);
  return (
    <ReportShell title="Expected cash" subtitle="Closing balance based on cash movements">
      {loading ? (
        <LoadingBlock />
      ) : error ? (
        <ErrorBlock message={error} />
      ) : (
        <>
          <KpiRow
            items={[
              { label: 'Opening', value: formatMoney(data?.opening) },
              { label: 'Cash in', value: formatMoney(data?.cashIn) },
              { label: 'Cash out', value: formatMoney(data?.cashOut) },
              { label: 'Expected closing', value: formatMoney(data?.expected) },
            ]}
          />
          <Note message={data?.note} />
        </>
      )}
    </ReportShell>
  );
}

/* ------------------------------- Profit --------------------------------- */

function ProfitReport() {
  const { preset, setPreset, range, setRange } = useRangeState();
  const resolved = useMemo(
    () => resolveRange({ preset, from: range.from, to: range.to }),
    [preset, range.from, range.to]
  );
  const { loading, error, data } = useReportData(getProfitReport, [], resolved);
  return (
    <ReportShell
      title="Profit & loss"
      subtitle="Revenue, COGS and expense for the period"
    >
      <FiltersBar
        preset={preset}
        onPresetChange={setPreset}
        range={range}
        onRangeChange={setRange}
        customSupported
      />
      {loading ? (
        <LoadingBlock />
      ) : error ? (
        <ErrorBlock message={error} />
      ) : (
        <>
          <KpiRow
            items={[
              { label: 'Revenue', value: formatMoney(data?.revenue) },
              { label: 'COGS', value: formatMoney(data?.cogs) },
              { label: 'Expenses', value: formatMoney(data?.expenseTotal) },
              {
                label: data?.profit === null ? 'Profit (partial)' : 'Profit',
                value:
                  data?.profit === null
                    ? '—'
                    : formatMoney(data?.profit),
                hint:
                  data?.missingCogsLines > 0
                    ? `${data.missingCogsLines} of ${data.totalCogsLines} sale lines missing purchase price`
                    : data?.complete
                      ? 'All sale lines have purchase price'
                      : '',
              },
            ]}
          />
          <Note
            message={
              data?.missingCogsLines > 0
                ? 'Some sales happened before purchase prices were recorded. Profit is reported as partial so we do not invent a number.'
                : ''
            }
          />
          <div style={{ height: 12 }} />
          <Card padding="md">
            <DataTable
              columns={[
                {
                  key: 'productName',
                  header: 'Product',
                  render: (row) => row.productName || '—',
                },
                { key: 'quantity', header: 'Sold', render: (row) => row.quantity ?? 0 },
                {
                  key: 'revenue',
                  header: 'Revenue',
                  render: (row) => formatMoney(row.revenue),
                },
                {
                  key: 'cogs',
                  header: 'COGS',
                  render: (row) => formatMoney(row.cogs),
                },
                {
                  key: 'profit',
                  header: 'Profit',
                  render: (row) => formatMoney(row.profit),
                },
                {
                  key: 'hasPurchasePrice',
                  header: 'COGS source',
                  render: (row) =>
                    row.hasPurchasePrice ? (
                      <Badge tone="success" variant="soft">
                        OK
                      </Badge>
                    ) : (
                      <Badge tone="warning" variant="soft">
                        Missing
                      </Badge>
                    ),
                },
              ]}
              rows={data?.products || []}
              emptyLabel="No product sales in this period."
              getRowKey={(row) => row.productId || row.productName}
            />
          </Card>
        </>
      )}
    </ReportShell>
  );
}

/* ------------------------------- Router --------------------------------- */

const RENDERERS = {
  'sales-summary': SalesSummaryReport,
  'sales-monthly': SalesMonthlyReport,
  'sales-by-product': SalesByProductReport,
  'sales-list': SalesListReport,
  'custom-order-status': CustomOrderStatusReport,
  'custom-order-dues': CustomOrderDuesReport,
  'custom-order-payments': CustomOrderPaymentsReport,
  'inventory-current': InventoryCurrentReport,
  'stock-adjustments': StockAdjustmentsReport,
  'customer-list': CustomerListReport,
  'supplier-totals': SupplierTotalsReport,
  'supplier-purchases': SupplierPurchasesReport,
  'supplier-dues': SupplierDuesReport,
  'supplier-payments': SupplierPaymentsReport,
  'raw-materials': RawMaterialsReport,
  'expenses-list': ExpensesListReport,
  'expenses-monthly': ExpensesMonthlyReport,
  'expenses-yearly': ExpensesYearlyReport,
  'expenses-by-category': ExpensesByCategoryReport,
  'cash-opening': CashOpeningReport,
  'cash-in': CashInReport,
  'cash-out': CashOutReport,
  'cash-adjustments': CashAdjustmentsReport,
  'cash-expected': CashExpectedReport,
  profit: ProfitReport,
};

export function ReportDetailPage() {
  const { reportType } = useParams();
  const { user } = useAuth();

  if (!user) return null;

  if (user.role !== ROLES.OWNER) {
    return (
      <ReportShell title="Reports" subtitle="Owner only">
        <ErrorBlock message="You do not have permission to view this report." />
      </ReportShell>
    );
  }

  const Component = RENDERERS[reportType];

  if (!Component) {
    return (
      <ReportShell title="Report not found" subtitle={reportType || ''}>
        <Card padding="md">
          <EmptyState
            title="Unknown report"
            description="That report does not exist. Pick one from the list."
            action={
              <Link to="/reports" className={styles.linkButton}>
                Back to all reports
              </Link>
            }
          />
        </Card>
      </ReportShell>
    );
  }

  return <Component />;
}

export default ReportDetailPage;
