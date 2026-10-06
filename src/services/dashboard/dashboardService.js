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
  
  const result = await apiRequest('/api/v1/dashboard/summary', { raw: true });
  return {
    ...result.data,
    quickActions: getQuickActions(role),
    generatedAt: result.meta?.generatedAt || new Date().toISOString()
  };
}
