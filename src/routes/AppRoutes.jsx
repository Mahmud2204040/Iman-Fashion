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
import { Suspense, lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { PageSkeleton } from '../components/common/index.js';

import { ROLES } from '../constants/roles.js';

import LoginPage from '../pages/auth/LoginPage.jsx';
const DashboardPage = lazy(() => import('../pages/dashboard/DashboardPage.jsx'));
const ProfilePage = lazy(() => import('../pages/users/ProfilePage.jsx'));

const SaleListPage = lazy(() => import('../pages/sales/SaleListPage.jsx'));
const NewSalePage = lazy(() => import('../pages/sales/NewSalePage.jsx'));

const CustomerListPage = lazy(() => import('../pages/customers/CustomerListPage.jsx'));
const CustomerDetailPage = lazy(() => import('../pages/customers/CustomerDetailPage.jsx'));
const NewCustomerPage = lazy(() => import('../pages/customers/NewCustomerPage.jsx'));

const CustomOrderListPage = lazy(() => import('../pages/customOrders/CustomOrderListPage.jsx'));
const NewCustomOrderPage = lazy(() => import('../pages/customOrders/NewCustomOrderPage.jsx'));
const ProductWorkbenchPage = lazy(() => import('../pages/products/ProductWorkbenchPage.jsx'));

const SupplierWorkbenchPage = lazy(() => import('../pages/suppliers/SupplierWorkbenchPage.jsx'));

const PurchaseWorkbenchPage = lazy(() => import('../pages/purchases/PurchaseWorkbenchPage.jsx'));
const NewPurchasePage = lazy(() => import('../pages/purchases/NewPurchasePage.jsx'));

const RawMaterialInventoryPage = lazy(() => import('../pages/rawMaterials/RawMaterialInventoryPage.jsx'));
const ExpensesPage = lazy(() => import('../pages/expenses/ExpensesPage.jsx'));
const CashPage = lazy(() => import('../pages/cash/CashPage.jsx'));
const CashOpeningPage = lazy(() => import('../pages/cash/CashPage.jsx').then(m => ({ default: m.CashOpeningPage })));
const CashClosingPage = lazy(() => import('../pages/cash/CashPage.jsx').then(m => ({ default: m.CashClosingPage })));
const CashClosingHistoryPage = lazy(() => import('../pages/cash/CashPage.jsx').then(m => ({ default: m.CashClosingHistoryPage })));

const ReportsIndexPage = lazy(() => import('../pages/reports/ReportsIndexPage.jsx'));
const ReportDetailPage = lazy(() => import('../pages/reports/ReportDetailPage.jsx'));

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
    <Suspense fallback={<PageSkeleton />}>
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
    </Suspense>
  );
}

