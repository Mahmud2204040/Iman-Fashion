/**
 * AppRoutes — Phase 3.
 *
 * Route structure mirrors the supported modules from REQUIREMENTS.md.
 * Auth-aware redirects and route guards are wired up here:
 *
 *   - /           → role-specific landing page or /login
 *   - /login      → public; bounces authenticated users to their landing page
 *   - everything else goes through <ProtectedRoute>
 *
 * Owner-only modules are additionally gated by <RoleRoute roles={[OWNER]}>,
 * matching the modules listed in FRONTEND_PLAN.md §13 (Owner-only):
 *   dashboard, products, suppliers, purchases, raw-materials, expenses, cash,
 *   reports.
 *
 * Per PROJECT_RULES.md §9, RoleRoute is a UX gate only — backend still
 * has to enforce every authorization decision.
 */
import { Navigate, Route, Routes } from 'react-router-dom';

import { ROLES } from '../constants/roles.js';

import LoginPage from '../pages/auth/LoginPage.jsx';
import DashboardPage from '../pages/dashboard/DashboardPage.jsx';
import ProfilePage from '../pages/users/ProfilePage.jsx';

import SaleListPage from '../pages/sales/SaleListPage.jsx';
import NewSalePage from '../pages/sales/NewSalePage.jsx';

import CustomerListPage from '../pages/customers/CustomerListPage.jsx';
import CustomerDetailPage from '../pages/customers/CustomerDetailPage.jsx';
import NewCustomerPage from '../pages/customers/NewCustomerPage.jsx';

import CustomOrderListPage from '../pages/customOrders/CustomOrderListPage.jsx';
import NewCustomOrderPage from '../pages/customOrders/NewCustomOrderPage.jsx';
import ProductWorkbenchPage from '../pages/products/ProductWorkbenchPage.jsx';

import SupplierWorkbenchPage from '../pages/suppliers/SupplierWorkbenchPage.jsx';

import PurchaseWorkbenchPage from '../pages/purchases/PurchaseWorkbenchPage.jsx';
import NewPurchasePage from '../pages/purchases/NewPurchasePage.jsx';

import RawMaterialInventoryPage from '../pages/rawMaterials/RawMaterialInventoryPage.jsx';
import ExpensesPage from '../pages/expenses/ExpensesPage.jsx';
import CashPage, { CashOpeningPage, CashClosingPage, CashClosingHistoryPage } from '../pages/cash/CashPage.jsx';

import ReportsIndexPage from '../pages/reports/ReportsIndexPage.jsx';
import ReportDetailPage from '../pages/reports/ReportDetailPage.jsx';

import NotFoundPage from '../pages/NotFoundPage.jsx';

// Phase 2 — Design-system preview (development only).
// Removed in Phase 3 once real navigation lands.
import DesignSystemPreviewPage from '../pages/designSystem/DesignSystemPreviewPage.jsx';

import ProtectedRoute from './ProtectedRoute.jsx';
import RoleRoute from './RoleRoute.jsx';
import RootRedirect from './RootRedirect.jsx';

const OWNER_ONLY = [ROLES.OWNER];

export default function AppRoutes() {
  return (
    <Routes>
      {/* Default entry — auth-aware. */}
      <Route path="/" element={<RootRedirect />} />

      {/* Public — Login. The page itself bounces authenticated users away. */}
      <Route path="/login" element={<LoginPage />} />

      {/* Dashboard — Owner only. Employees land on New Sale. */}
      <Route
        path="/dashboard"
        element={
          <RoleRoute roles={OWNER_ONLY}>
            <DashboardPage />
          </RoleRoute>
        }
      />
      <Route path="/profile" element={<RoleRoute roles={OWNER_ONLY}><ProfilePage /></RoleRoute>} />
      <Route path="/users" element={<RoleRoute roles={OWNER_ONLY}><Navigate to="/profile" replace /></RoleRoute>} />

      {/* Sales */}
      <Route
        path="/sales/:id?"
        element={
          <ProtectedRoute>
            <SaleListPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/sales/new"
        element={
          <ProtectedRoute>
            <NewSalePage />
          </ProtectedRoute>
        }
      />
      {/* Customers */}
      <Route
        path="/customers"
        element={
          <ProtectedRoute>
            <CustomerListPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/customers/new"
        element={
          <ProtectedRoute>
            <NewCustomerPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/customers/:id"
        element={
          <ProtectedRoute>
            <CustomerDetailPage />
          </ProtectedRoute>
        }
      />

      {/* Custom Orders */}
      <Route
        path="/custom-orders/:id?"
        element={
          <ProtectedRoute>
            <CustomOrderListPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/custom-orders/new"
        element={
          <ProtectedRoute>
            <NewCustomOrderPage />
          </ProtectedRoute>
        }
      />
      {/* Owner-only — Products & Stock */}
      <Route
        path="/products"
        element={
          <RoleRoute roles={OWNER_ONLY}>
            <ProductWorkbenchPage />
          </RoleRoute>
        }
      />
      <Route
        path="/products/new"
        element={
          <RoleRoute roles={OWNER_ONLY}>
            <ProductWorkbenchPage />
          </RoleRoute>
        }
      />
      <Route
        path="/products/:id"
        element={
          <RoleRoute roles={OWNER_ONLY}>
            <ProductWorkbenchPage />
          </RoleRoute>
        }
      />

      {/* Owner-only — Suppliers & Purchases */}
      <Route
        path="/suppliers/:id?"
        element={
          <RoleRoute roles={OWNER_ONLY}>
            <SupplierWorkbenchPage />
          </RoleRoute>
        }
      />
      <Route
        path="/purchases/:id?"
        element={
          <RoleRoute roles={OWNER_ONLY}>
            <PurchaseWorkbenchPage />
          </RoleRoute>
        }
      />
      <Route path="/purchases/new" element={<RoleRoute roles={OWNER_ONLY}><NewPurchasePage /></RoleRoute>} />

      {/* Owner-only — Raw Materials / Expenses / Cash */}
      <Route
        path="/raw-materials"
        element={
          <RoleRoute roles={OWNER_ONLY}>
            <RawMaterialInventoryPage />
          </RoleRoute>
        }
      />
      <Route
        path="/raw-materials/new"
        element={
          <RoleRoute roles={OWNER_ONLY}>
            <RawMaterialInventoryPage />
          </RoleRoute>
        }
      />
      <Route
        path="/expenses"
        element={
          <RoleRoute roles={OWNER_ONLY}>
            <ExpensesPage />
          </RoleRoute>
        }
      />
      <Route
        path="/cash"
        element={
          <RoleRoute roles={OWNER_ONLY}>
            <CashPage />
          </RoleRoute>
        }
      />
      <Route path="/cash/opening" element={<RoleRoute roles={OWNER_ONLY}><CashOpeningPage /></RoleRoute>} />
      <Route path="/cash/closing" element={<RoleRoute roles={OWNER_ONLY}><CashClosingPage /></RoleRoute>} />
      <Route path="/cash/closings" element={<RoleRoute roles={OWNER_ONLY}><CashClosingHistoryPage /></RoleRoute>} />

      {/* Owner-only — Reports */}
      <Route
        path="/reports"
        element={
          <RoleRoute roles={OWNER_ONLY}>
            <ReportsIndexPage />
          </RoleRoute>
        }
      />
      <Route
        path="/reports/:reportType"
        element={
          <RoleRoute roles={OWNER_ONLY}>
            <ReportDetailPage />
          </RoleRoute>
        }
      />

      {/* Phase 2 — Design System Preview (development only) */}
      {import.meta.env.DEV ? (
        <Route
          path="/design-system"
          element={<RoleRoute roles={OWNER_ONLY}><DesignSystemPreviewPage /></RoleRoute>}
        />
      ) : null}

      {/* Catch-all */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

