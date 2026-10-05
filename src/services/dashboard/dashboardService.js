import { delay } from '../delay.js';
import { ROLES } from '../../constants/roles.js';
import { cashBusinessDate } from '../../utils/cashDate.js';
import { getCurrentCash } from '../cash/cashService.js';
import { getSales } from '../sales/salesService.js';
import { getCustomOrders } from '../customOrders/customOrderService.js';
import { getProducts } from '../products/productService.js';

function recentDates() {
  const today = cashBusinessDate();
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(`${today}T00:00:00+06:00`);
    date.setUTCDate(date.getUTCDate() - (6 - index));
    return cashBusinessDate(date);
  });
}

function byDay(rows, amount) {
  return recentDates().map((date) => rows
    .filter((row) => cashBusinessDate(row.createdAt) === date)
    .reduce((sum, row) => sum + amount(row), 0));
}

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
  await delay(100);
  const [sales, orders, products, currentCash] = await Promise.all([getSales(), getCustomOrders(), getProducts(), getCurrentCash()]);
  const saleTrend = byDay(sales, (sale) => Number(sale.total || 0));
  const orderTrend = byDay(orders, () => 1);
  const stock = products.filter((product) => product.isActive).reduce((sum, product) => sum + Number(product.stock || 0), 0);
  const activity = [
    ...sales.map((sale) => ({
      id: `sale-${sale.id}`, kind: 'sale', title: `Sale ${sale.salesCode}`,
      detail: `${sale.customerName} · ${sale.items.reduce((sum, item) => sum + Number(item.qty || 0), 0)} items`,
      amount: sale.total, at: sale.createdAt,
    })),
    ...orders.map((order) => ({
      id: `order-${order.id}`, kind: 'custom_order', title: `Custom order ${order.code}`,
      detail: `${order.customerName} · ${order.productName}`, amount: order.total, at: order.createdAt,
    })),
  ].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 5);
  return {
    generatedAt: new Date().toISOString(),
    stats: [
      { id: 'today-sales', value: saleTrend[6], trend: saleTrend },
      { id: 'today-custom-orders', value: orderTrend[6], trend: orderTrend },
      { id: 'current-cash', value: currentCash, trend: [currentCash] },
      { id: 'total-stock-items', value: stock, trend: [stock] },
    ],
    activity,
    quickActions: getQuickActions(role),
  };
}
