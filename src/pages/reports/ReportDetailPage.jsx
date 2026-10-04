import T from '../../components/common/LocalizedText.jsx';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth.js';
import { ROLES } from '../../constants/roles.js';
import { useLocale } from '../../contexts/LocaleContext.jsx';
import { formatCurrency } from '../../utils/format.js';
import { getUiLanguage } from '../../utils/localeState.js';
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

const ACTOR_ONLY_REPORTS = new Set([
  getSalesMonthly,
  getCustomOrderOutstandingDues,
  getInventoryCurrent,
  getCustomerListReport,
  getSupplierOutstandingDues,
  getSupplierWiseTotals,
  getExpensesMonthly,
  getExpensesYearly,
]);

function formatMoney(amount) {
  if (amount === null || amount === undefined || Number.isNaN(Number(amount))) {
    return '—';
  }
  return formatCurrency(Number(amount));
}

function reportRows(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.rows)) return data.rows;
  if (Array.isArray(data?.products)) return data.products;
  return [];
}

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat(getUiLanguage() === 'bn' ? 'bn-BD-u-nu-latn' : 'en-GB', {
    day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Dhaka',
  }).format(date);
}

function useReportData(loader, deps = [], range) {
  const { user } = useAuth();
  const [state, setState] = useState({ loading: true, error: '', data: null });
  const [retryVersion, setRetryVersion] = useState(0);

  const depsKey = useMemo(() => JSON.stringify(deps), [deps]);
  const rangeKey = useMemo(
    () => JSON.stringify(range),
    [range]
  );

  useEffect(() => {
    if (!user) return undefined;
    let cancelled = false;
    setState({ loading: true, error: '', data: null });
    Promise.resolve()
      .then(() => {
        const options = { actor: { username: user.username, role: user.role } };
        return ACTOR_ONLY_REPORTS.has(loader)
          ? loader(options)
          : loader(range || {}, options);
      })
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
  }, [user, depsKey, rangeKey, retryVersion]);

  return { ...state, retry: () => setRetryVersion((version) => version + 1) };
}

function KpiCard({ label, value, hint }) {
  const { t } = useLocale();
  return (
    <Card padding="md" className={styles.kpiCard}>
      <p className={styles.kpiLabel}>{t(label)}</p>
      <p className={styles.kpiValue}>{value}</p>
      {hint ? <p className={styles.kpiHint}>{t(hint)}</p> : null}
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
  const { t } = useLocale();
  const changeDate = (field) => (event) => {
    const value = event.currentTarget.value;
    onRangeChange({ ...range, [field]: value });
  };
  return (
    <Card padding="md" className={styles.filterCard}>
      <div className={styles.filterRow}>
        {RANGE_OPTIONS.map((opt) => (
          <Button
            key={opt.id}
            type="button"
            variant={preset === opt.id ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => onPresetChange(opt.id)}
          >
            {t(opt.label)}
          </Button>
        ))}
        {customSupported ? (
          <div className={styles.dateRow}>
            <input
              type="date"
              aria-label={t('From date')}
              value={range.from || ''}
              onInput={changeDate('from')}
            />
            <span aria-hidden="true">{t('to')}</span>
            <input
              type="date"
              aria-label={t('To date')}
              value={range.to || ''}
              onInput={changeDate('to')}
            />
          </div>
        ) : null}
      </div>
    </Card>
  );
}

function LoadingBlock() {
  const { t } = useLocale();
  return (
    <Card padding="lg">
      <div className={styles.loading}>
        <Spinner size="sm" />
        <span>{t('Loading report…')}</span>
      </div>
    </Card>
  );
}

function ErrorBlock({ message, retry }) {
  const { t } = useLocale();
  return (
    <Card padding="md">
      <Badge tone="danger" variant="soft">
        {t(message || 'Something went wrong.')}
      </Badge>
      {retry ? <Button type="button" variant="secondary" size="sm" onClick={retry}>{t('Try again')}</Button> : null}
    </Card>
  );
}

function Note({ message }) {
  const { t } = useLocale();
  if (!message) return null;
  return <p className={styles.note}>{t(message)}</p>;
}

function ReportShell({ title, subtitle, action, children }) {
  const { t } = useLocale();
  return (
    <div className={styles.page}>
      <PageHeader
        className={styles.reportHeader}
        eyebrow="Reports"
        title={title}
        subtitle={subtitle}
        actions={
          <div className={styles.headerActions}>
            <Link to="/reports" className={styles.linkButton}>
              ← {t('All reports')}
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

function selectedReportRange(preset, from, to) {
  return resolveRange({
    preset,
    from: preset === 'custom' ? from : undefined,
    to: preset === 'custom' ? to : undefined,
  });
}

function DateRangeReport({ title, subtitle, loader, deps, render, customSupported = true }) {
  const { preset, setPreset, range, setRange } = useRangeState();
  const resolved = useMemo(
    () => selectedReportRange(preset, range.from, range.to),
    [preset, range.from, range.to]
  );
  const { loading, error, data, retry } = useReportData(loader, deps, resolved);
  return (
    <ReportShell title={title} subtitle={subtitle}>
      {!ACTOR_ONLY_REPORTS.has(loader) ? <FiltersBar
        preset={preset}
        onPresetChange={setPreset}
        range={range}
        onRangeChange={(nextRange) => { setRange(nextRange); setPreset('custom'); }}
        customSupported={customSupported}
      /> : null}
      {loading ? <LoadingBlock /> : error ? <ErrorBlock message={error} retry={retry} /> : render(data)}
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
              { label: 'Sales count', value: data.saleCount ?? 0 },
              { label: 'Items sold', value: data.itemCount ?? 0 },
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
            rows={reportRows(data)}
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
            rows={reportRows(data)}
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
              { key: 'salesCode', header: 'Sale #', render: (row) => row.salesCode || '—' },
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
            rows={reportRows(data)}
            emptyLabel="No sales yet."
            getRowKey={(row) => row.id || row.salesCode}
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
    () => selectedReportRange(preset, range.from, range.to),
    [preset, range.from, range.to]
  );
  const { loading, error, data, retry } = useReportData(getCustomOrderStatusCounts, [], resolved);
  return (
    <ReportShell title="Custom orders by status" subtitle="Current status snapshot">
      <FiltersBar
        preset={preset}
        onPresetChange={setPreset}
        range={range}
        onRangeChange={(nextRange) => { setRange(nextRange); setPreset('custom'); }}
        customSupported
      />
      {loading ? <LoadingBlock /> : error ? <ErrorBlock message={error} retry={retry} /> : (
        <KpiRow
          items={Object.entries(data?.counts || {}).map(([status, count]) => ({
            label: status,
            value: count,
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
            rows={reportRows(data)}
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
              { label: 'Payments', value: reportRows(data).length },
              { label: 'Amount collected', value: formatMoney(reportRows(data).reduce((sum, row) => sum + Number(row.amount || 0), 0)) },
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
              { key: 'orderCode', header: 'Order #', render: (row) => row.orderCode || '—' },
              {
                key: 'customerName',
                header: 'Customer',
                render: (row) => row.customerName || '—',
              },
              { key: 'amount', header: 'Amount', render: (row) => formatMoney(row.amount) },
            ]}
            rows={reportRows(data)}
            emptyLabel="No payments yet."
            getRowKey={(row, idx) => `${row.id || row.orderCode || 'row'}-${idx}`}
          />
        </Card>
      )}
    />
  );
}

/* ------------------------------ Inventory ------------------------------- */

function InventoryCurrentReport() {
  const navigate = useNavigate();
  const { loading, error, data, retry } = useReportData(getInventoryCurrent, [], null);
  return (
    <ReportShell title="Current inventory" subtitle="Stock on hand right now">
      {loading ? (
        <LoadingBlock />
      ) : error ? (
        <ErrorBlock message={error} retry={retry} />
      ) : (
        <Card padding="md">
          <KpiRow items={[{ label: 'Total units', value: data?.totalUnits ?? 0 }, { label: 'Stock value', value: formatMoney(data?.totalValue) }]} />
          <DataTable
            columns={[
              { key: 'name', header: 'Product', render: (row) => row.name || '—' },
              { key: 'sku', header: 'SKU', render: (row) => row.sku || '—' },
              { key: 'category', header: 'Category', render: (row) => row.category || '—' },
              { key: 'stock', header: 'Stock', render: (row) => row.stock ?? 0 },
              { key: 'stockValue', header: 'Stock value', render: (row) => formatMoney(row.stockValue) },
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
            rows={reportRows(data)}
            emptyTitle="No products yet"
            emptyDescription="Add products from the Products page to track stock."
            emptyAction={<Button type="button" variant="primary" size="sm" onClick={() => navigate('/products')}><T>Open products</T></Button>}
            getRowKey={(row) => row.id || row.sku}
          />
        </Card>
      )}
    </ReportShell>
  );
}

function StockAdjustmentsReport() {
  const { t } = useLocale();
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
              { key: 'reason', header: 'Reason', render: (row) => row.reason === 'OPENING_STOCK' ? t('OPENING_STOCK') : row.reason || '—' },
              { key: 'note', header: 'Note', render: (row) => row.note || '—' },
              { key: 'createdBy', header: 'By', render: (row) => row.createdBy || '—' },
            ]}
            rows={reportRows(data)}
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
  const { loading, error, data, retry } = useReportData(getCustomerListReport, [], null);
  return (
    <ReportShell title="Customer list" subtitle="All customers with current class">
      {loading ? (
        <LoadingBlock />
      ) : error ? (
        <ErrorBlock message={error} retry={retry} />
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
            rows={reportRows(data)}
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
              { key: 'supplierName', header: 'Supplier', render: (row) => row.supplierName || '—' },
              { key: 'purchases', header: 'Purchases', render: (row) => row.purchases ?? 0 },
              {
                key: 'total',
                header: 'Total',
                render: (row) => formatMoney(row.total),
              },
              {
                key: 'paid',
                header: 'Paid',
                render: (row) => formatMoney(row.paid),
              },
              {
                key: 'due',
                header: 'Due',
                render: (row) => formatMoney(row.due),
              },
            ]}
            rows={reportRows(data)}
            emptyLabel="No purchases yet."
            getRowKey={(row) => row.supplierId || row.supplierName}
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
              { key: 'code', header: 'Purchase #', render: (row) => row.code || '—' },
              {
                key: 'supplierName',
                header: 'Supplier',
                render: (row) => row.supplierName || '—',
              },
              { key: 'total', header: 'Total', render: (row) => formatMoney(row.total) },
              { key: 'due', header: 'Due', render: (row) => formatMoney(row.due) },
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
            rows={reportRows(data)}
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
              { key: 'code', header: 'Purchase #', render: (row) => row.code || '—' },
              { key: 'total', header: 'Total', render: (row) => formatMoney(row.total) },
              { key: 'paid', header: 'Paid', render: (row) => formatMoney(row.paid) },
              { key: 'due', header: 'Due', render: (row) => formatMoney(row.due) },
            ]}
            rows={reportRows(data)}
            emptyLabel="Nothing owed."
            getRowKey={(row) => row.purchaseId}
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
                key: 'createdAt',
                header: 'Date',
                render: (row) => formatDate(row.createdAt),
              },
              { key: 'purchaseCode', header: 'Purchase #', render: (row) => row.purchaseCode || '—' },
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
            rows={reportRows(data)}
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
  const { preset, setPreset, range, setRange } = useRangeState();
  const resolved = useMemo(() => selectedReportRange(preset, range.from, range.to), [preset, range.from, range.to]);
  const { loading, error, data, retry } = useReportData(getRawMaterialsReport, [], resolved);
  return (
    <ReportShell title="Raw materials" subtitle="Stock list of raw materials">
      <FiltersBar preset={preset} onPresetChange={setPreset} range={range} onRangeChange={(nextRange) => { setRange(nextRange); setPreset('custom'); }} customSupported />
      {loading ? (
        <LoadingBlock />
      ) : error ? (
        <ErrorBlock message={error} retry={retry} />
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
            rows={reportRows(data)}
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
            rows={reportRows(data)}
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
            rows={reportRows(data)}
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
            rows={reportRows(data)}
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
            rows={reportRows(data)}
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
  return (
    <DateRangeReport title="Cash opening" subtitle="Opening balance before the selected period" loader={getCashOpening} render={(data) => (
        <Card padding="md">
          <KpiRow
            items={[
              {
                label: 'Opening balance',
                value: formatMoney(data?.opening),
                hint: '',
              },
            ]}
          />
          <Note message={data?.note} />
        </Card>
      )} />
  );
}

function CashInReport() {
  const { t } = useLocale();
  return (
    <DateRangeReport
      title="Cash in"
      subtitle="Money received in the selected period"
      loader={getCashInReport}
      render={(data) => (
        <Card padding="md">
          <KpiRow
            items={[
              { label: 'Entries', value: data?.length ?? 0 },
              { label: 'Total in', value: formatMoney((data || []).reduce((sum, row) => sum + row.amount, 0)) },
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
                render: (row) => t(row.referenceType || 'MANUAL'),
              },
              { key: 'amount', header: 'Amount', render: (row) => formatMoney(row.amount) },
              { key: 'reason', header: 'Reason', render: (row) => row.reason || '—' },
              {
                key: 'createdBy',
                header: 'By',
                render: (row) => row.createdBy || '—',
              },
            ]}
            rows={data || []}
            emptyLabel="No cash in."
            getRowKey={(row) => row.id}
          />
        </Card>
      )}
    />
  );
}

function CashOutReport() {
  const { t } = useLocale();
  return (
    <DateRangeReport
      title="Cash out"
      subtitle="Money paid out in the selected period"
      loader={getCashOutReport}
      render={(data) => (
        <Card padding="md">
          <KpiRow
            items={[
              { label: 'Entries', value: data?.length ?? 0 },
              { label: 'Total out', value: formatMoney((data || []).reduce((sum, row) => sum + row.amount, 0)) },
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
                render: (row) => t(row.referenceType || 'MANUAL'),
              },
              { key: 'amount', header: 'Amount', render: (row) => formatMoney(row.amount) },
              { key: 'reason', header: 'Reason', render: (row) => row.reason || '—' },
              {
                key: 'createdBy',
                header: 'By',
                render: (row) => row.createdBy || '—',
              },
            ]}
            rows={data || []}
            emptyLabel="No cash out."
            getRowKey={(row) => row.id}
          />
        </Card>
      )}
    />
  );
}

function CashAdjustmentsReport() {
  return (
    <DateRangeReport title="Cash reconciliations & adjustments" subtitle="Saved counts and confirmed corrections" loader={getCashAdjustmentsReport} render={(data) => (
        <Card padding="md">
          <h2><T>Reconciliation observations</T></h2>
          <DataTable columns={[
            { key: 'businessDate', header: 'Business date' },
            { key: 'expectedCash', header: 'Expected', render: (row) => formatMoney(row.expectedCash) },
            { key: 'physicalCash', header: 'Physical', render: (row) => formatMoney(row.physicalCash) },
            { key: 'difference', header: 'Difference', render: (row) => formatMoney(row.difference) },
            { key: 'status', header: 'Status' },
            { key: 'reconciledBy', header: 'Counted by' },
          ]} rows={data?.reconciliations || []} getRowKey={(row) => row.id} emptyLabel="No counts in this period." />
          <h2><T>Applied adjustments</T></h2>
          <DataTable columns={[
            { key: 'createdAt', header: 'Date', render: (row) => new Date(row.createdAt).toLocaleString('en-GB', { timeZone: 'Asia/Dhaka' }) },
            { key: 'amount', header: 'Signed amount', render: (row) => formatMoney(row.amount) },
            { key: 'reason', header: 'Reason' },
            { key: 'createdBy', header: 'By' },
          ]} rows={data?.rows || []} getRowKey={(row) => row.id} emptyLabel="No applied adjustments in this period." />
          <Note message={data?.note} />
        </Card>
      )} />
  );
}

function CashExpectedReport() {
  return (
    <DateRangeReport title="Expected cash" subtitle="Closing balance based on cash movements" loader={getCashExpected} render={(data) => (
        <>
          <KpiRow
            items={[
              { label: 'Opening', value: formatMoney(data?.opening) },
              { label: 'Initial setup in period', value: formatMoney(data?.initialOpening) },
              { label: 'Cash in', value: formatMoney(data?.cashIn) },
              { label: 'Cash out', value: formatMoney(data?.cashOut) },
              { label: 'Adjustments', value: formatMoney(data?.adjustments) },
              { label: 'Expected closing', value: formatMoney(data?.expected) },
            ]}
          />
          <Note message={data?.note} />
        </>
      )} />
  );
}

/* ------------------------------- Profit --------------------------------- */

function ProfitReport() {
  const { preset, setPreset, range, setRange } = useRangeState();
  const resolved = useMemo(
    () => selectedReportRange(preset, range.from, range.to),
    [preset, range.from, range.to]
  );
  const { loading, error, data, retry } = useReportData(getProfitReport, [], resolved);
  return (
    <ReportShell
      title="Product profit"
      subtitle="Sales revenue minus sale-time product purchase cost. Expenses are excluded."
    >
      <FiltersBar
        preset={preset}
        onPresetChange={setPreset}
        range={range}
        onRangeChange={(nextRange) => { setRange(nextRange); setPreset('custom'); }}
        customSupported
      />
      {loading ? (
        <LoadingBlock />
      ) : error ? (
        <ErrorBlock message={error} retry={retry} />
      ) : (
        <>
          <KpiRow
            items={[
              { label: 'Revenue', value: formatMoney(data?.revenue) },
              { label: 'Known purchase cost', value: formatMoney(data?.cogs) },
              { label: 'Known-cost subtotal', value: formatMoney(data?.knownCostSubtotal), hint: 'Only lines with a cost snapshot' },
              {
                label: 'Product profit',
                value:
                  data?.profit === null
                    ? 'N/A'
                    : formatMoney(data?.profit),
                hint:
                  data?.missingCogsLines > 0
                    ? `${data.missingCogsLines} of ${data.totalCogsLines} sale lines lack a sale-time cost snapshot`
                    : data?.complete
                      ? 'All sale lines have sale-time cost snapshots'
                      : '',
              },
            ]}
          />
          <Note
            message={
              data?.missingCogsLines > 0
                ? 'Full product profit is unavailable where a sale-time cost is unknown. The known-cost subtotal excludes those lines; later product cost edits never backfill them.'
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
                  header: 'Purchase cost',
                  render: (row) => formatMoney(row.cogs),
                },
                {
                  key: 'profit',
                  header: 'Product profit',
                  render: (row) => row.profit === null ? 'N/A' : formatMoney(row.profit),
                },
                {
                  key: 'hasPurchasePrice',
                  header: 'Cost snapshot',
                  render: (row) =>
                    row.hasPurchasePrice ? (
                      <Badge tone="success" variant="soft"><T>
                        OK
                      </T></Badge>
                    ) : (
                      <Badge tone="warning" variant="soft"><T>
                        Missing
                      </T></Badge>
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
              <Link to="/reports" className={styles.linkButton}><T>
                Back to all reports
              </T></Link>
            }
          />
        </Card>
      </ReportShell>
    );
  }

  return <Component />;
}

export default ReportDetailPage;
