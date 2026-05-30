import { Navigate, Outlet } from "react-router-dom";

import { useAuthStore } from "../store/auth";

export function ProtectedRoute() {
  const token = useAuthStore((state) => state.accessToken);
  const user = useAuthStore((state) => state.user);
  if (!token) return <Navigate to="/login" replace />;
  // Allow access for authenticated users regardless of onboarding status
  return <Outlet />;
}
