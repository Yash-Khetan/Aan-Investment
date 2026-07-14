import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../features/auth/AuthContext";

/** Gate for ADMIN-only pages. Must be nested inside ProtectedRoute, so `user` is already loaded. */
export function AdminRoute() {
  const { user } = useAuth();

  if (!user?.roles.includes("ADMIN")) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}
