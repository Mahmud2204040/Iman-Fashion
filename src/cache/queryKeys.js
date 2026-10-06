export const CACHE_SCHEMA_VERSION = 'v1';

/**
 * Generates a standard query cache key array.
 * Browser keys include the user ID and role for isolation on device.
 * 
 * Shape: [schemaVersion, userId, role, domain, resource, params]
 */
export function createQueryKey({ user, domain, resource = 'list', params = {} }) {
  const userId = user?.id || 'anonymous';
  const role = user?.role || 'anonymous';
  
  // Normalize params to ensure stable keys (sorting keys, removing undefined)
  const normalizedParams = Object.keys(params)
    .filter((k) => params[k] !== undefined && params[k] !== null && params[k] !== '')
    .sort()
    .reduce((acc, k) => {
      acc[k] = params[k];
      return acc;
    }, {});

  return [CACHE_SCHEMA_VERSION, userId, role, domain, resource, normalizedParams];
}

// Domain constants
export const DOMAIN = {
  SALES: 'sales',
  CUSTOMERS: 'customers',
  DASHBOARD: 'dashboard',
  CUSTOM_ORDERS: 'custom-orders',
  PRODUCTS: 'products',
  REPORTS: 'reports',
};
