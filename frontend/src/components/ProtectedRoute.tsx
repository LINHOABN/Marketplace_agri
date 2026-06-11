import { Navigate, useLocation } from "react-router-dom";
import { useUser } from "../context/UserContext";

type ProtectedRouteProps = {
  children: React.ReactNode;
  requireAdmin?: boolean;
  allowedRoles?: string[];
};

export default function ProtectedRoute({
  children,
  requireAdmin = false,
  allowedRoles,
}: ProtectedRouteProps) {
  const { currentUser, loading } = useUser();
  const location = useLocation();
  const token = sessionStorage.getItem("access_token") || localStorage.getItem("access_token");

  if (loading) {
    return (
      <div className="app-loading" style={{ padding: "2rem", textAlign: "center" }}>
        Chargement…
      </div>
    );
  }

  if (!token || !currentUser) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  if (requireAdmin && currentUser.role !== "admin") {
    return <Navigate to="/feed" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(currentUser.role)) {
    // Si l'utilisateur n'a pas le bon rôle pour cette page, on le redirige
    return <Navigate to="/feed" replace />;
  }

  return <>{children}</>;
}
