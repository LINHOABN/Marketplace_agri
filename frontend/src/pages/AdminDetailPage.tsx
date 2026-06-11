import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ChevronLeft, LayoutGrid, Users, DollarSign, AlertCircle, ShoppingCart } from "lucide-react";
import api from "../api";
import "./AdminDashboard.css";

const SECTION_TITLES: Record<string, string> = {
  revenue: "Volume des ventes",
  commissions: "Commissions",
  transactions: "Transactions du jour",
  users: "Nouveaux utilisateurs",
  disputes: "Litiges ouverts",
  charts: "Graphiques détaillés",
};

export default function AdminDetailPage() {
  const { section } = useParams<{ section: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        if (section === "disputes") {
          const res = await api.get("/admin/disputes");
          setData(res.data);
        } else if (section === "charts") {
          const res = await api.get("/admin/stats/charts");
          setData(res.data);
        } else if (section === "users") {
          const res = await api.get("/admin/users");
          setData(res.data);
        } else {
          const res = await api.get("/admin/stats");
          setData(res.data);
        }
      } catch {
        setData(null);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [section]);

  const title = SECTION_TITLES[section || ""] || "Détails";

  const renderContent = () => {
    if (loading) return <div className="admin-loading">Chargement des données...</div>;
    if (!data) return <div className="empty-state">Aucune donnée disponible pour cette section.</div>;

    if (section === "disputes") {
      return (
        <div className="disputes-full-list">
          <div className="table-responsive">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Acheteur</th>
                  <th>Raison</th>
                  <th>Commande</th>
                  <th>Montant</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {data.map((d: any) => (
                  <tr key={d.id}>
                    <td>{new Date(d.created_at).toLocaleDateString()}</td>
                    <td>{d.buyer_name}</td>
                    <td><span className="badge-reason">{d.reason}</span></td>
                    <td>#{d.order_id.slice(0, 8)}</td>
                    <td className="text-danger">{d.total_price.toLocaleString()} F</td>
                    <td>
                      <button className="btn-small" onClick={() => navigate(`/order/tracking/${d.order_id}`)}>Voir</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      );
    }

    if (section === "users") {
      return (
        <div className="users-full-list">
          <div className="admin-table-actions">
            <div className="search-box">
              <Users size={18} />
              <input
                type="text"
                placeholder="Rechercher un utilisateur (nom, email)..."
                onChange={(e) => {
                  // Logic for client-side search or calling API with search param
                }}
              />
            </div>
          </div>
          <div className="table-responsive">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Nom / Email</th>
                  <th>Rôle</th>
                  <th>Statut</th>
                  <th>Inscrit le</th>
                  <th>Commandes</th>
                  <th>Documents</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.users?.map((u: any) => (
                  <tr key={u.id}>
                    <td>
                      <div className="user-info-cell">
                        <span className="user-name">{u.name}</span>
                        <span className="user-email">{u.email}</span>
                      </div>
                    </td>
                    <td><span className={`badge-role ${u.role}`}>{u.role}</span></td>
                    <td>
                      {u.is_verified ? (
                        <span className="status-badge approved">Vérifié</span>
                      ) : (
                        <span className="status-badge pending">Non vérifié</span>
                      )}
                    </td>
                    <td>{new Date(u.created_at).toLocaleDateString()}</td>
                    <td>{u.orders_count}</td>
                    <td>
                      {u.id_card_url ? (
                        <div className="doc-icons">
                          <span title="Pièce d'identité" onClick={() => window.open(u.id_card_url.startsWith('http') ? u.id_card_url : `/api${u.id_card_url}`, '_blank')}>📇</span>
                          {u.selfie_url && <span title="Selfie" onClick={() => window.open(u.selfie_url.startsWith('http') ? u.selfie_url : `/api${u.selfie_url}`, '_blank')}>🤳</span>}
                        </div>
                      ) : <span className="no-docs">Aucun</span>}
                    </td>
                    <td>
                      <button className="btn-small" onClick={() => navigate(`/admin/role-requests`)}>Gérer</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      );
    }

    if (section === "transactions" || section === "revenue" || section === "commissions") {
      // Fetch transactions if section is transactions
      return (
        <div className="detail-stats-grid">
          {/* Summary first */}
          <div className="detail-stat-card">
            <LayoutGrid size={40} color="var(--primary)" />
            <h3>Résumé Global</h3>
            <div className="stat-rows">
              <div className="stat-row"><span>Revenue Mois:</span> <strong>{data.revenue_month?.toLocaleString()} F</strong></div>
              <div className="stat-row"><span>Commissions Total:</span> <strong>{data.commissions_total?.toLocaleString()} F</strong></div>
              <div className="stat-row"><span>Transactions Aujourd'hui:</span> <strong>{data.transactions_today}</strong></div>
            </div>
          </div>

          <div className="detail-info-box">
            <AlertCircle size={20} />
            <p>Les listes détaillées par transaction sont accessibles via le bouton "Tout voir" sur le dashboard.</p>
          </div>
        </div>
      );
    }

    return (
      <pre className="raw-json-fallback">
        {JSON.stringify(data, null, 2)}
      </pre>
    );
  };

  return (
    <div className="admin-dashboard-wrapper">
      <header className="admin-header">
        <button type="button" onClick={() => navigate("/admin/dashboard")} className="btn-logout">
          <ChevronLeft size={16} /> Retour
        </button>
        <div className="header-title">
          {section === 'disputes' && <AlertCircle size={24} color="#d32f2f" />}
          {section === 'users' && <Users size={24} color="#1976d2" />}
          {section === 'revenue' && <DollarSign size={24} color="#2e7d32" />}
          <h1>{title}</h1>
        </div>
      </header>
      <main className="admin-content">
        {renderContent()}
      </main>
    </div>
  );
}
