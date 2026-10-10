import { Navigate, Outlet } from "react-router-dom";
import { useAuth, homeFor } from "../context/AuthContext.jsx";
import LoadingBlock from "./common/LoadingBlock.jsx";
export default function ProtectedRoute({ roles }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="p-4"><LoadingBlock label="Checking your session" height="h-40" /></div>;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to={homeFor(user.role)} replace />;
  return <Outlet />;
}
