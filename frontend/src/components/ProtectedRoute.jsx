import { Navigate, Outlet } from "react-router-dom";
import { useAuth, homeFor } from "../context/AuthContext.jsx";
export default function ProtectedRoute({ roles }) {
  const { user, loading } = useAuth();
  if (loading) return <p className="p-8">Checking session…</p>;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to={homeFor(user.role)} replace />;
  return <Outlet />;
}
