import { createBrowserRouter, Navigate } from "react-router-dom";

import { AppShell } from "./components/AppShell";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { AdminPage } from "./pages/AdminPage";
import { StaffManagementPage } from "./pages/StaffManagementPage";
import { AppliedLoansPage } from "./pages/AppliedLoansPage";
import { LoanDeptDashboardPage } from "./pages/LoanDeptDashboardPage";
import { LoanDeptUserManagementPage } from "./pages/LoanDeptUserManagementPage";
import { LoanDeptStatementsPage } from "./pages/LoanDeptStatementsPage";
import { MerchantDashboardPage } from "./pages/MerchantDashboardPage";
import { MerchantStatementsPage } from "./pages/MerchantStatementsPage";
import { MerchantLoansPage } from "./pages/MerchantLoansPage";
import { AdminDashboardPage } from "./pages/AdminDashboardPage";
import { UserManagementPage } from "./pages/UserManagementPage";
import { StatementsAdminPage } from "./pages/StatementsAdminPage";
import { LoansAdminPage } from "./pages/LoansAdminPage";
import { BankStatementsPage } from "./pages/BankStatementsPage";
import { DashboardPage } from "./pages/DashboardPage";
import { PsychometricPage } from "./pages/PsychometricPage";
import { GuarantorPage } from "./pages/GuarantorPage";
import { LoansPage } from "./pages/LoansPage";
import { LoginPage } from "./pages/LoginPage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { SignupPage } from "./pages/SignupPage";
import { TrustScorePage } from "./pages/TrustScorePage";

export const router = createBrowserRouter([
  { path: "/", element: <Navigate to="/app" replace /> },
  { path: "/login", element: <LoginPage /> },
  { path: "/signup", element: <SignupPage /> },
  {
    path: "/app",
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppShell />,
        children: [
          { index: true, element: <DashboardPage /> },
          { path: "admin/staff-management", element: <StaffManagementPage /> },
          { path: "psychometric", element: <PsychometricPage /> },
          { path: "guarantor", element: <GuarantorPage /> },
          { path: "admin/dashboard", element: <AdminDashboardPage /> },
          { path: "admin/users", element: <UserManagementPage /> },
          { path: "admin/statements", element: <StatementsAdminPage /> },
          { path: "admin/loans", element: <LoansAdminPage /> },
          { path: "loans/applied", element: <AppliedLoansPage /> },
          { path: "loan-department/dashboard", element: <LoanDeptDashboardPage /> },
          { path: "loan-department/users", element: <LoanDeptUserManagementPage /> },
          { path: "loan-department/statements", element: <LoanDeptStatementsPage /> },
          { path: "merchant/dashboard", element: <MerchantDashboardPage /> },
          { path: "merchant/statements", element: <MerchantStatementsPage /> },
          { path: "merchant/loans", element: <MerchantLoansPage /> },
          { path: "trust-score", element: <TrustScorePage /> },
          { path: "bank-statements", element: <BankStatementsPage /> },
          { path: "loans", element: <LoansPage /> },
          { path: "admin", element: <AdminPage /> },
        ],
      },
    ],
  },
  { path: "*", element: <NotFoundPage /> },
]);
