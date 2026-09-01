/**
 * useRole — Phase 3.
 *
 * Exposes role-derived booleans plus two reusable helpers:
 *   - canSee(field)  — visibility matrix from REQUIREMENTS.md §79
 *   - canAct(action) — write-action matrix from PROJECT_RULES.md §8
 *
 * IMPORTANT: These helpers reflect ONLY the documented restrictions.
 * Do NOT add new permissions here. Per PROJECT_RULES.md §80, the AI
 * agent must not invent business rules; later phases may extend this
 * map when a new documented restriction is added.
 */

import { useMemo } from 'react';

import { ROLES } from '../constants/roles.js';
import { useAuth } from './useAuth.js';

/* -------------------------------------------------------------------------- */
/* canSee — "should this field/area render for the current role?"             */
/* -------------------------------------------------------------------------- */
/* Sourced from REQUIREMENTS.md §79 (Data Visibility) and §80 (Customer Due
 * Visibility). Anything not in this map defaults to OWNER-only.
 */
const EMPLOYEE_HIDDEN_FIELDS = new Set([
  // From REQUIREMENTS.md §79 "Employee must not see"
  'purchase_cost',
  'profit',
  'reports',
  'expenses',
  'supplier_information',
  'supplier_dues',
  'supplier_payment_history',
  'supplier_receipt_proofs',
  'cash',
  'current_cash',
  'raw_material_purchase_cost',
]);

const EMPLOYEE_HIDDEN_SECTIONS = new Set([
  // Whole pages / areas the employee must not see.
  'reports',
  'expenses',
  'suppliers',
  'purchases',
  'products_management', // product list/admin — employees sell, they don't manage stock
  'raw_materials',
  'cash',
]);

/* -------------------------------------------------------------------------- */
/* canAct — "can this role perform this write action?"                         */
/* -------------------------------------------------------------------------- */
/* Sourced from PROJECT_RULES.md §8 (Employee cannot). Anything not in
 * this map defaults to OWNER-only.
 */
const EMPLOYEE_DENIED_ACTIONS = new Set([
  'cancel_sale',
  'edit_sale',
  'adjust_stock',
  'deactivate_product',
  'manage_supplier',
  'manage_purchase',
  'manage_supplier_payment',
  'manage_raw_material',
  'manage_expense',
  'manage_cash',
  'view_report',
  'manage_employee',
]);

export function useRole() {
  const { role } = useAuth();

  return useMemo(() => {
    const isOwner = role === ROLES.OWNER;
    const isEmployee = role === ROLES.EMPLOYEE;
    const isAuthenticated = role === ROLES.OWNER || role === ROLES.EMPLOYEE;

    /**
     * Can the current role see this field / area?
     * Owners always can. Employees can unless the key is in the deny map.
     *
     * @param {string} key — documented field or section name.
     */
    function canSee(key) {
      if (!isAuthenticated) return false;
      if (isOwner) return true;
      return !(
        EMPLOYEE_HIDDEN_FIELDS.has(key) ||
        EMPLOYEE_HIDDEN_SECTIONS.has(key)
      );
    }

    /**
     * Can the current role perform this write/action?
     * Owners always can. Employees cannot unless explicitly allowed.
     *
     * @param {string} action — documented action name.
     */
    function canAct(action) {
      if (!isAuthenticated) return false;
      if (isOwner) return true;
      return !EMPLOYEE_DENIED_ACTIONS.has(action);
    }

    return { isOwner, isEmployee, isAuthenticated, canSee, canAct };
  }, [role]);
}