import { apiRequest } from '../api/apiClient.js';
import { ROLES } from '../../constants/roles.js';
import { cashDateRange } from '../../utils/cashDate.js';

const OWNER_ROLE = [ROLES.OWNER];

function requireOwner({ actor, action = 'view report' } = {}) {
  if (!actor || !OWNER_ROLE.includes(actor.role)) {
    const err = new Error(`Only the owner can ${action}.`);
    err.code = 'FORBIDDEN_ROLE';
    throw err;
  }
}

export function resolveRange(filters = {}) {
  const [start, end] = cashDateRange(filters, new Date('2026-10-06T00:00:00Z'));
  return {
    from: start ? start.toISOString().slice(0, 10) : undefined,
    to: end ? end.toISOString().slice(0, 10) : undefined
  };
}

function generateQueryString(filters = {}) {
  const range = resolveRange(filters);
  const params = new URLSearchParams();
  if (range.from) params.set('from', range.from);
  if (range.to) params.set('to', range.to);
  if (filters.groupBy) params.set('groupBy', filters.groupBy);
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export async function getSalesSummary(filters = {}, { actor } = {}) {
  requireOwner({ actor });
  const result = await apiRequest(`/api/v1/reports/sales-summary${generateQueryString(filters)}`);
  return {
    range: filters.range || 'today',
    start: resolveRange(filters).from,
    end: resolveRange(filters).to,
    revenue: Number(result?.summary?.total || 0),
    sales: result?.rows || [],
    itemCount: 0, saleCount: 0, averageSale: 0
  };
}

export async function getSalesMonthly({ actor } = {}) {
  requireOwner({ actor });
  const result = await apiRequest(`/api/v1/reports/sales-monthly?groupBy=month`);
  return (result?.rows || []).map(r => ({ month: r.bucket, revenue: Number(r.amount) }));
}

export async function getSalesByProduct(filters = {}, { actor } = {}) {
  requireOwner({ actor });
  const result = await apiRequest(`/api/v1/reports/sales-by-product${generateQueryString(filters)}`);
  return (result?.rows || []).map(r => ({
      productId: r.productId,
      productName: r.name,
      revenue: Number(r.revenue),
  }));
}

export async function getSalesList(filters = {}, { actor } = {}) {
  requireOwner({ actor });
  const { getSales } = await import('../sales/salesService.js');
  const result = await getSales({ pageSize: 5000 });
  return result.data || [];
}

export async function getCustomOrderStatusCounts(filters = {}, { actor } = {}) {
  requireOwner({ actor });
  const result = await apiRequest(`/api/v1/reports/custom-order-status${generateQueryString(filters)}`);
  const counts = { PENDING: 0, READY: 0, DELIVERED: 0, CANCELLED: 0 };
  (result?.rows || []).forEach(r => counts[r.status] = r.count);
  return { counts };
}

export async function getCustomOrderOutstandingDues({ actor } = {}) {
  requireOwner({ actor });
  const result = await apiRequest(`/api/v1/reports/custom-order-dues`);
  return (result?.rows || []).map(r => ({ ...r, due: Number(r.due), total: Number(r.total), paid: Number(r.paid) }));
}

export async function getCustomOrderPaymentsReport(filters = {}, { actor } = {}) {
  requireOwner({ actor });
  const result = await apiRequest(`/api/v1/reports/custom-order-payments${generateQueryString(filters)}`);
  return (result?.rows || []).map(r => ({ ...r, amount: Number(r.amount) }));
}

export async function getInventoryCurrent({ actor } = {}) {
  requireOwner({ actor });
  const result = await apiRequest(`/api/v1/reports/inventory-current`);
  return { products: (result?.rows || []).map(r => ({ ...r, stockValue: Number(r.totalValue || r.stockValue || 0) })) };
}

export async function getStockAdjustmentsReport(filters = {}, { actor } = {}) {
  requireOwner({ actor });
  return []; // Mock list for now
}

export async function getCustomerListReport({ actor } = {}) {
  requireOwner({ actor });
  const { getCustomers } = await import('../customers/customerService.js');
  const result = await getCustomers({ pageSize: 5000 });
  return result.data || [];
}

export async function getSupplierPurchasesReport(filters = {}, { actor } = {}) {
  requireOwner({ actor });
  const { getPurchases } = await import('../purchases/purchaseService.js');
  return getPurchases();
}

export async function getSupplierOutstandingDues({ actor } = {}) {
  requireOwner({ actor });
  const result = await apiRequest(`/api/v1/reports/supplier-dues`);
  return (result?.rows || []).map(r => ({ ...r, due: Number(r.due), total: Number(r.total), paid: Number(r.paid) }));
}

export async function getSupplierWiseTotals({ actor } = {}) {
  requireOwner({ actor });
  return [];
}

export async function getSupplierPaymentHistory(filters = {}, { actor } = {}) {
  requireOwner({ actor });
  const result = await apiRequest(`/api/v1/reports/supplier-payments${generateQueryString(filters)}`);
  return (result?.rows || []).map(r => ({ ...r, amount: Number(r.amount) }));
}

export async function getRawMaterialsReport(filters = {}, { actor } = {}) {
  requireOwner({ actor });
  const { getRawMaterials } = await import('../rawMaterials/rawMaterialService.js');
  return getRawMaterials();
}

export async function getExpensesListReport(filters = {}, { actor } = {}) {
  requireOwner({ actor });
  const result = await apiRequest(`/api/v1/reports/expenses-list${generateQueryString(filters)}`);
  return (result?.rows || []).map(r => ({ ...r, amount: Number(r.amount) }));
}

export async function getExpensesMonthly({ actor } = {}) {
  requireOwner({ actor });
  const result = await apiRequest(`/api/v1/reports/expenses-monthly?groupBy=month`);
  return (result?.rows || []).map(r => ({ month: r.bucket, total: Number(r.amount) }));
}

export async function getExpensesYearly({ actor } = {}) {
  requireOwner({ actor });
  const result = await apiRequest(`/api/v1/reports/expenses-monthly?groupBy=year`);
  return (result?.rows || []).map(r => ({ year: r.bucket, total: Number(r.amount) }));
}

export async function getExpensesByCategory(filters = {}, { actor } = {}) {
  requireOwner({ actor });
  const { getExpenses } = await import('../expenses/expenseService.js');
  return getExpenses(); // using local for now fallback
}

export async function getCashOpening(filters = {}, { actor } = {}) {
  requireOwner({ actor });
  const { getCashPeriodSummary } = await import('../cash/cashService.js');
  const summary = await getCashPeriodSummary(filters, { actor });
  return { opening: summary.opening };
}

export async function getCashInReport(filters = {}, { actor } = {}) {
  requireOwner({ actor });
  const { getCashPeriodSummary } = await import('../cash/cashService.js');
  const summary = await getCashPeriodSummary(filters, { actor });
  return summary.rows.filter((r) => r.type === 'CASH_IN');
}

export async function getCashOutReport(filters = {}, { actor } = {}) {
  requireOwner({ actor });
  const { getCashPeriodSummary } = await import('../cash/cashService.js');
  const summary = await getCashPeriodSummary(filters, { actor });
  return summary.rows.filter((r) => r.type === 'CASH_OUT');
}

export async function getCashAdjustmentsReport(filters = {}, { actor } = {}) {
  requireOwner({ actor });
  const { getCashPeriodSummary, getCashReconciliations } = await import('../cash/cashService.js');
  const summary = await getCashPeriodSummary(filters, { actor });
  return { rows: summary.rows.filter((row) => row.type === 'CASH_ADJUSTMENT'), reconciliations: [] };
}

export async function getCashExpected(filters = {}, { actor } = {}) {
  requireOwner({ actor });
  const { getCashPeriodSummary } = await import('../cash/cashService.js');
  return getCashPeriodSummary(filters, { actor });
}

export async function getProfitReport(filters = {}, { actor } = {}) {
  requireOwner({ actor });
  const result = await apiRequest(`/api/v1/reports/profit${generateQueryString(filters)}`);
  return {
     revenue: Number(result?.summary?.revenue || 0),
     products: (result?.rows || []).map(r => ({ ...r, revenue: Number(r.revenue), knownProfit: Number(r.knownProfit || 0), knownCost: Number(r.knownCost || 0) }))
  };
}