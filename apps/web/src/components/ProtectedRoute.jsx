import { Navigate } from "react-router-dom";
import { useAuth } from "../auth.jsx";

export function ProtectedRoute({ children }) {
  const { token, loading } = useAuth();

  if (loading) {
    return <div className="screen-center">正在恢复登录状态...</div>;
  }

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  return children;
}
