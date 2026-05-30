import { Navigate, Outlet } from "react-router-dom";

import { useAuthStore } from "../store/auth";

export function ProtectedRoute() {
  const token = useAuthStore((state) => state.accessToken);
  return token ? <Outlet /> : <Navigate to="/login" replace />;
}
