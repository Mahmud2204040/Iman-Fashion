/**
 * AppRoutes — Phase 3.
 *
 * Route structure mirrors the supported modules from REQUIREMENTS.md.
 * Auth-aware redirects and route guards are wired up here:
 *
 *   - /           → /dashboard (auth) or /login (unauth)
 *   - /login      → public; bounces an already-authenticated user to /dashboard
 *   - everything else goes through <ProtectedRoute>
 *
 * Owner-only modules are additionally gated by <RoleRoute roles={[OWNER]}>,
 * matching the modules listed in FRONTEND_PLAN.md §13 (Owner-only):
 *   products, suppliers, purchases, raw-materials, expenses, cash, reports.
 *
 * Per PROJECT_RULES.md §9, RoleRoute is a UX gate only — backend still
 * has to enforce every authorization decision.
 */
import { Route, Routes } from 'react-router-dom';

import { ROLES } from '../constants/roles.js';

import LoginPage from '../pages/auth/LoginPage.jsx';
import DashboardPage from '../pages/dashboard/DashboardPage.jsx';

import SaleListPage from '../pages/sales/SaleListPage.jsx';
import NewSalePage from '../pages/sales/NewSalePage.jsx';
import SaleDetailPage from '../pages/sales/SaleDetailPage.jsx';

import CustomerListPage from '../pages/customers/CustomerListPage.jsx';
import CustomerDetailPage from '../pages/customers/CustomerDetailPage.jsx';
import NewCustomerPage from '../pages/customers/NewCustomerPage.jsx';

import CustomOrderListPage from '../pages/customOrders/CustomOrderListPage.jsx';
import NewCustomOrderPage from '../pages/customOrders/NewCustomOrderPage.jsx';
import CustomOrderDetailPage from '../pages/customOrders/CustomOrderDetailPage.jsx';
import ProductListPage from '../pages/products/ProductListPage.jsx';
import ProductDetailPage from '../pages/products/ProductDetailPage.jsx';
import NewProductPage from '../pages/products/NewProductPage.jsx';

import SupplierListPage from '../pages/suppliers/SupplierListPage.jsx';
import SupplierDetailPage from '../pages/suppliers/SupplierDetailPage.jsx';

import PurchaseListPage from '../pages/purchases/PurchaseListPage.jsx';
import PurchaseDetailPage from '../pages/purchases/PurchaseDetailPage.jsx';

import RawMaterialsPage from '../pages/rawMaterials/RawMaterialsPage.jsx';
import NewRawMaterialPage from '../pages/rawMaterials/NewRawMaterialPage.jsx';
import ExpensesPage from '../pages/expenses/ExpensesPage.jsx';
import CashPage from '../pages/cash/CashPage.jsx';

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

      {/* Authenticated routes — both roles. */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        }
      />

      {/* Sales */}
      <Route
        path="/sales"
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
      <Route
        path="/sales/:id"
        element={
          <ProtectedRoute>
            <SaleDetailPage />
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
        path="/custom-orders"
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
      <Route
        path="/custom-orders/:id"
        element={
          <ProtectedRoute>
            <CustomOrderDetailPage />
          </ProtectedRoute>
        }
      />

      {/* Owner-only — Products & Stock */}
      <Route
        path="/products"
        element={
          <RoleRoute roles={OWNER_ONLY}>
            <ProductListPage />
          </RoleRoute>
        }
      />
      <Route
        path="/products/new"
        element={
          <RoleRoute roles={OWNER_ONLY}>
            <NewProductPage />
          </RoleRoute>
        }
      />
      <Route
        path="/products/:id"
        element={
          <RoleRoute roles={OWNER_ONLY}>
            <ProductDetailPage />
          </RoleRoute>
        }
      />

      {/* Owner-only — Suppliers & Purchases */}
      <Route
        path="/suppliers"
        element={
          <RoleRoute roles={OWNER_ONLY}>
            <SupplierListPage />
          </RoleRoute>
        }
      />
      <Route
        path="/suppliers/:id"
        element={
          <RoleRoute roles={OWNER_ONLY}>
            <SupplierDetailPage />
          </RoleRoute>
        }
      />
      <Route
        path="/purchases"
        element={
          <RoleRoute roles={OWNER_ONLY}>
            <PurchaseListPage />
          </RoleRoute>
        }
      />
      <Route
        path="/purchases/:id"
        element={
          <RoleRoute roles={OWNER_ONLY}>
            <PurchaseDetailPage />
          </RoleRoute>
        }
      />

      {/* Owner-only — Raw Materials / Expenses / Cash */}
      <Route
        path="/raw-materials"
        element={
          <RoleRoute roles={OWNER_ONLY}>
            <RawMaterialsPage />
          </RoleRoute>
        }
      />
      <Route
        path="/raw-materials/new"
        element={
          <RoleRoute roles={OWNER_ONLY}>
            <NewRawMaterialPage />
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
      <Route
        path="/design-system"
        element={
          <ProtectedRoute>
            <DesignSystemPreviewPage />
          </ProtectedRoute>
        }
      />

      {/* Catch-all */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

