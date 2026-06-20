import { Navigate } from "react-router-dom";
import { useUser } from "../hooks/useUser";

/** Page publique visible uniquement si non connecté (ex: landing). */
export default function PublicOnlyRoute({ children }: { children: React.ReactNode }) {
  const { currentUser, loading } = useUser();
  const token = sessionStorage.getItem("access_token") || localStorage.getItem("access_token");

  if (loading) {
    return (
      <div className="app-loading" style={{ padding: "2rem", textAlign: "center" }}>
        Chargement…
      </div>
    );
  }

  if (token && currentUser) {
    const dest =
      currentUser.role === "admin"
        ? "/admin/dashboard"
        : currentUser.role === "seller"
          ? "/seller/dashboard"
          : currentUser.role === "deliverer"
            ? "/deliverer/dashboard"
            : "/feed";
    return <Navigate to={dest} replace />;
  }

  return <>{children}</>;
}
