import { apiRequest } from '../api/apiClient.js';
import { ROLES } from '../../constants/roles.js';

function getQuickActions(role) {
  const base = [
    { id: 'new-sale', label: 'New sale', path: '/sales/new', tone: 'brand' },
    { id: 'new-customer', label: 'Add customer', path: '/customers/new', tone: 'info' },
    { id: 'new-order', label: 'Custom order', path: '/custom-orders/new', tone: 'warning' },
  ];
  if (role === ROLES.OWNER) base.push({ id: 'add-stock', label: 'Add stock', path: '/products', tone: 'success' });
  return base;
}

export async function getDashboardSnapshot(role) {
  if (role !== ROLES.OWNER) {
    const error = new Error('Only the owner can view the dashboard.');
    error.code = 'FORBIDDEN_ROLE';
    throw error;
  }
  
  // Dashboard mock using existing summary queries till backend has a fully mapped `/api/v1/dashboard`
  const { getSalesList } = await import('../reports/reportService.js');
  const { getCustomOrders } = await import('../customOrders/customOrderService.js');
  const { getProducts } = await import('../products/productService.js');
  const { getCashExpected } = await import('../reports/reportService.js');

  const [sales, orders, products, cash] = await Promise.all([
     getSalesList({ range: 'week' }, { actor: { role: ROLES.OWNER } }),
     getCustomOrders(), // custom order mock used, real API is mapped but hasn't full date filter locally
     getProducts(),
     getCashExpected({}, { actor: { role: ROLES.OWNER } })
  ]);
  
  const today = new Date().toISOString().slice(0, 10);
  const saleTrendData = (sales || []).filter(s => s.createdAt?.startsWith(today));
  const todaySalesVal = saleTrendData.reduce((sum, sale) => sum + Number(sale.total || 0), 0);
  const todayOrderVal = (orders || []).filter(o => o.createdAt?.startsWith(today)).length;
  
  const currentCash = cash?.expected || 0;
  const stock = products.filter((product) => product.isActive).reduce((sum, product) => sum + Number(product.stock || 0), 0);

  const activity = [
    ...(sales || []).map((sale) => ({
      id: `sale-${sale.id}`, kind: 'sale', title: `Sale ${sale.salesCode}`,
      detail: `${sale.customerName} · ${(sale.items || []).reduce((sum, item) => sum + Number(item.qty || 0), 0)} items`,
      amount: sale.total, at: sale.createdAt,
    })),
    ...(orders || []).map((order) => ({
      id: `order-${order.id}`, kind: 'custom_order', title: `Custom order ${order.code}`,
      detail: `${order.customerName} · ${order.productName}`, amount: order.total, at: order.createdAt,
    })),
  ].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 5);

  return {
    generatedAt: new Date().toISOString(),
    stats: [
      { id: 'today-sales', value: todaySalesVal, trend: [todaySalesVal] },
      { id: 'today-custom-orders', value: todayOrderVal, trend: [todayOrderVal] },
      { id: 'current-cash', value: currentCash, trend: [currentCash] },
      { id: 'total-stock-items', value: stock, trend: [stock] },
    ],
    activity,
    quickActions: getQuickActions(role),
  };
}
