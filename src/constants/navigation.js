/**
 * Navigation items — Phase 4.
 *
 * Single source of truth for the sidebar. Each entry maps to a route and
 * declares which role(s) may see it. Both `path` and `roles` are used by
 * the sidebar and by future role-aware UI passes (Phase 14).
 *
 * Groups can be either:
 *   - flat (a list of leaf items), or
 *   - nested (one or more sub-groups, each containing leaf items).
 *
 * The sidebar flattens nested groups into direct links under the top-level
 * static section label; there are no navigation dropdowns.
 *
 * `icon` is a small inline SVG component reference so we don't need an
 * icon library. The Icon component renders the actual SVG.
 */
import { ROLES } from './roles.js';

import {
  DashboardIcon,
  CustomerIcon,
  ProductIcon,
  SupplierIcon,
  PurchaseIcon,
  ExpenseIcon,
  CashIcon,
  ReportIcon,
  HistoryIcon,
  PlusIcon,
  UserPlusIcon,
  BookIcon,
  SpoolIcon,
} from '../components/icons/DashboardIcon.jsx';

/**
 * Shape of a leaf nav item.
 * @typedef {Object} NavLeaf
 * @property {string} id
 * @property {string} label
 * @property {string} path
 * @property {React.ComponentType} icon
 * @property {string[]} roles
 * @property {boolean} [end]
 */

/**
 * Shape of a sub-group.
 * @typedef {Object} NavSubGroup
 * @property {string} id
 * @property {string} label
 * @property {NavLeaf[]} items
 */

/**
 * Shape of a top-level group.
 * @typedef {Object} NavGroup
 * @property {string} id
 * @property {string} label
 * @property {NavLeaf[] | NavSubGroup[]} items  - either flat leaves or nested sub-groups
 */

/** @type {NavGroup[]} */
export const NAV_GROUPS = [
  {
    id: 'overview',
    label: 'Overview',
    items: [
      {
        id: 'dashboard',
        label: 'Dashboard',
        path: '/dashboard',
        icon: DashboardIcon,
        roles: [ROLES.OWNER],
        end: true,
      },
    ],
  },
  {
    id: 'sales',
    label: 'Sales',
    items: [
      {
        id: 'sales-history',
        label: 'Sales History',
        path: '/sales',
        icon: HistoryIcon,
        roles: [ROLES.OWNER, ROLES.EMPLOYEE],
        end: true,
      },
      {
        id: 'sales-new',
        label: 'New Sale',
        path: '/sales/new',
        icon: PlusIcon,
        roles: [ROLES.OWNER, ROLES.EMPLOYEE],
      },
    ],
  },
  {
    id: 'customers',
    label: 'Customers',
    items: [
      {
        id: 'customer-directory',
        label: 'Customer Directory',
        path: '/customers',
        icon: CustomerIcon,
        roles: [ROLES.OWNER, ROLES.EMPLOYEE],
        end: true,
      },
      {
        id: 'customer-new',
        label: 'Add New Customer',
        path: '/customers/new',
        icon: UserPlusIcon,
        roles: [ROLES.OWNER, ROLES.EMPLOYEE],
      },
      {
        id: 'custom-order-new',
        label: 'New Custom Order',
        path: '/custom-orders/new',
        icon: PlusIcon,
        roles: [ROLES.OWNER, ROLES.EMPLOYEE],
      },
      {
        id: 'custom-order-tracker',
        label: 'Custom Order Tracker',
        path: '/custom-orders',
        icon: BookIcon,
        roles: [ROLES.OWNER, ROLES.EMPLOYEE],
        end: true,
      },
    ],
  },
  {
    id: 'inventory',
    label: 'Inventory',
    items: [
      {
        id: 'inventory-products',
        label: 'Products & stock',
        items: [
          {
            id: 'products-current',
            label: 'Products & stock',
            path: '/products',
            icon: ProductIcon,
            roles: [ROLES.OWNER],
          },
        ],
      },
      {
        id: 'inventory-raw',
        label: 'Raw material stock',
        items: [
          {
            id: 'raw-materials-current',
            label: 'Raw material stock',
            path: '/raw-materials',
            icon: SpoolIcon,
            roles: [ROLES.OWNER],
          },
        ],
      },
    ],
  },
  {
    id: 'procurement',
    label: 'Procurement',
    items: [
      {
        id: 'suppliers',
        label: 'Suppliers',
        path: '/suppliers',
        icon: SupplierIcon,
        roles: [ROLES.OWNER],
        end: true,
      },
      {
        id: 'purchases',
        label: 'Purchase history',
        path: '/purchases',
        icon: PurchaseIcon,
        roles: [ROLES.OWNER],
        end: true,
      },
    ],
  },
  {
    id: 'finance',
    label: 'Finance',
    items: [
      {
        id: 'cash',
        label: 'Cash Management',
        path: '/cash',
        icon: CashIcon,
        roles: [ROLES.OWNER],
        end: true,
      },
      {
        id: 'expenses',
        label: 'Expenses',
        path: '/expenses',
        icon: ExpenseIcon,
        roles: [ROLES.OWNER],
        end: true,
      },
      {
        id: 'reports',
        label: 'Reports',
        path: '/reports',
        icon: ReportIcon,
        roles: [ROLES.OWNER],
        end: true,
      },
    ],
  },
];

/**
 * A nav entry has either `path` (leaf) or `items` (sub-group). This
 * helper tells the renderer which case we're in.
 */
export function isSubGroup(entry) {
  return Array.isArray(entry && entry.items) && !entry.path;
}

/**
 * Filter NAV_GROUPS down to only what the current role can see.
 * - Top-level groups with zero visible children are dropped.
 * - Sub-groups with zero visible leaves are dropped from inside a group.
 */
export function filterNavByRole(role) {
  if (!role) return [];

  function leafVisible(entry) {
    return entry && Array.isArray(entry.roles) && entry.roles.includes(role);
  }

  return NAV_GROUPS
    .map((group) => {
      const filteredItems = (group.items || []).map((entry) => {
        if (isSubGroup(entry)) {
          return {
            ...entry,
            items: entry.items.filter(leafVisible),
          };
        }
        return leafVisible(entry) ? entry : null;
      })
        .filter(Boolean)
        .filter((entry) => !isSubGroup(entry) || entry.items.length > 0);

      return { ...group, items: filteredItems };
    })
    .filter((group) => group.items.length > 0);
}
