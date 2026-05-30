import { createBrowserRouter, Navigate } from "react-router-dom";

import { AppShell } from "./components/AppShell";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { AdminPage } from "./pages/AdminPage";
import { BankStatementsPage } from "./pages/BankStatementsPage";
import { DashboardPage } from "./pages/DashboardPage";
import { LoansPage } from "./pages/LoansPage";
import { LoginPage } from "./pages/LoginPage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { TrustScorePage } from "./pages/TrustScorePage";

export const router = createBrowserRouter([
  { path: "/", element: <Navigate to="/app" replace /> },
  { path: "/login", element: <LoginPage /> },
  {
    path: "/app",
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppShell />,
        children: [
          { index: true, element: <DashboardPage /> },
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
