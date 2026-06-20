import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell
} from "recharts";
import {
  Users, ShoppingBag, DollarSign, AlertCircle,
  TrendingUp, LogOut, ShieldCheck, ArrowRight, ChevronRight, Layout, Activity
} from "lucide-react";
import api from "../api";
import { useUser } from "../hooks/useUser";
import "./AdminDashboard.css";

const COLORS = ["#2E7D32", "#1976D2", "#FFA000", "#D32F2F"];

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { logout } = useUser();
  const [stats, setStats] = useState<any>(null);
  const [charts, setCharts] = useState<any>(null);
  const [disputes, setDisputes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsRes, chartRes, disputesRes] = await Promise.all([
          api.get("/admin/stats"),
          api.get("/admin/stats/charts"),
          api.get("/admin/disputes")
        ]);
        setStats(statsRes.data);
        setCharts(chartRes.data);
        setDisputes(disputesRes.data);
      } catch (error) {
        console.error("Failed to fetch admin data", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) return <div className="admin-loading">Chargement du panel admin...</div>;

  return (
    <div className="admin-dashboard-wrapper">
      <header className="admin-header">
        <div className="header-left">
          <ShieldCheck color="#2E7D32" size={28} />
          <h1>Console d'Administration AgriMarché</h1>
        </div>
        <div className="header-right">
          <div className="status-indicator">Système Opérationnel</div>
          <button className="btn-logout" onClick={logout}>
            <LogOut size={16} /> Déconnexion
          </button>
        </div>
      </header>

      <main className="admin-content">
        {/* KPIs Section */}
        <section className="kpi-grid">
          <KPI
            icon={<DollarSign size={24} color="#2e7d32" />}
            label="Volume Ventes (Mois)"
            value={`${stats?.revenue_month?.toLocaleString() || 0} F`}
            premium
            onClick={() => navigate("/admin/detail/revenue")}
          />
          <KPI
            icon={<TrendingUp size={24} color="#1976d2" />}
            label="Commissions Total"
            value={`${stats?.commissions_total?.toLocaleString() || 0} F`}
            onClick={() => navigate("/admin/detail/commissions")}
          />
          <KPI
            icon={<ShoppingBag size={24} color="#ffa000" />}
            label="Transactions (Aujourd'hui)"
            value={stats?.transactions_today || 0}
            onClick={() => navigate("/admin/detail/transactions")}
          />
          <KPI
            icon={<Users size={24} color="#616161" />}
            label="Nouv. Utilisateurs (7j)"
            value={stats?.active_users_7d || 0}
            onClick={() => navigate("/admin/detail/users")}
          />
          <KPI
            icon={<AlertCircle size={24} color="#d32f2f" />}
            label="Litiges Ouverts"
            value={stats?.open_disputes || 0}
            warning={stats?.open_disputes > 0}
            alert={stats?.open_disputes > 0 ? "ACTION REQUISE" : ""}
            onClick={() => navigate("/admin/detail/disputes")}
          />
        </section>

        {/* Notifications / Actions Section */}
        <section className="admin-actions-banner" style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          {stats?.pending_role_requests > 0 ? (
            <div className="action-card info clickable" style={{ flex: 1, minWidth: '300px' }} onClick={() => navigate("/admin/role-requests")}>
              <div className="action-icon"><Users color="white" /></div>
              <div className="action-text">
                <strong>{stats.pending_role_requests} nouvelles demandes de rôle</strong>
                <span>Cliquer pour valider les nouveaux vendeurs et livreurs</span>
              </div>
              <ChevronRight size={20} />
            </div>
          ) : (
            <div className="action-card subtle" style={{ flex: 1, minWidth: '300px' }}>
              <Users size={18} color="#999" />
              <span>Aucune demande de rôle en attente</span>
              <button className="btn-link" onClick={() => navigate("/admin/role-requests")} style={{ marginLeft: 'auto', fontSize: '12px', background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontWeight: 600 }}>Voir l'historique</button>
            </div>
          )}

          <div className="action-card info clickable" style={{ flex: 1, minWidth: '300px', background: 'var(--primary)', color: 'white' }} onClick={() => navigate("/admin/tips")}>
            <div className="action-icon" style={{ background: 'rgba(255,255,255,0.2)' }}><AlertCircle color="white" /></div>
            <div className="action-text">
              <strong style={{ color: 'white' }}>Gestion des Conseils Agricoles</strong>
              <span style={{ color: 'rgba(255,255,255,0.8)' }}>Publier des astuces et conseils sur le flux d'accueil</span>
            </div>
            <ChevronRight size={20} />
          </div>

          <div className="action-card warning clickable" style={{ flex: 1, minWidth: '300px', background: '#F59E0B', color: 'white' }} onClick={() => navigate("/admin/settings")}>
            <div className="action-icon" style={{ background: 'rgba(255,255,255,0.2)' }}><DollarSign color="white" /></div>
            <div className="action-text">
              <strong style={{ color: 'white' }}>Configuration des Frais</strong>
              <span style={{ color: 'rgba(255,255,255,0.8)' }}>Gérer les commissions et frais de plateforme</span>
            </div>
            <ChevronRight size={20} />
          </div>

          <div className="action-card success clickable" style={{ flex: 1, minWidth: '300px', background: '#10B981', color: 'white' }} onClick={() => navigate("/admin/wallet")}>
            <div className="action-icon" style={{ background: 'rgba(255,255,255,0.2)' }}><Layout color="white" /></div>
            <div className="action-text">
              <strong style={{ color: 'white' }}>Mon Portefeuille Admin</strong>
              <span style={{ color: 'rgba(255,255,255,0.8)' }}>Voir mon solde et retirer les commissions</span>
            </div>
            <ChevronRight size={20} />
          </div>

          <div className="action-card primary clickable" style={{ flex: 1, minWidth: '300px', background: '#4F46E5', color: 'white' }} onClick={() => navigate("/admin/finance-simulator")}>
            <div className="action-icon" style={{ background: 'rgba(255,255,255,0.2)' }}><Activity color="white" /></div>
            <div className="action-text">
              <strong style={{ color: 'white' }}>Simulateur Financier</strong>
              <span style={{ color: 'rgba(255,255,255,0.8)' }}>Valider les flux de paiement et d'escrow</span>
            </div>
            <ChevronRight size={20} />
          </div>
        </section>

        <div className="charts-grid">
          <div className="chart-container chart-clickable" onClick={() => navigate("/admin/detail/charts")} role="button" tabIndex={0}>
            <h3>Volume des Transactions (30 jours)</h3>
            <div style={{ height: 300, minHeight: "300px" }}>
              <ResponsiveContainer width="100%" height="100%" minHeight={300} minWidth={0}>
                <LineChart data={charts?.transactions}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="date" fontSize={10} />
                  <YAxis fontSize={10} />
                  <Tooltip />
                  <Line type="monotone" dataKey="count" stroke="#2E7D32" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="chart-container chart-clickable" onClick={() => navigate("/admin/detail/charts")} role="button" tabIndex={0}>
            <h3>Répartition des Rôles</h3>
            <div style={{ height: 300, minHeight: "300px" }}>
              <ResponsiveContainer width="100%" height="100%" minHeight={300} minWidth={0}>
                <PieChart>
                  <Pie
                    data={charts?.distribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {charts?.distribution?.map((_: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="chart-container chart-clickable" onClick={() => navigate("/admin/detail/charts")} role="button" tabIndex={0}>
            <h3>Top Catégories Produits</h3>
            <div style={{ height: 300, minHeight: "300px" }}>
              <ResponsiveContainer width="100%" height="100%" minHeight={300} minWidth={0}>
                <BarChart data={charts?.categories} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" fontSize={10} />
                  <YAxis dataKey="category" type="category" fontSize={10} width={80} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#FFA000" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Bottom Lists */}
        <div className="admin-bottom-grid">
          <div className="alerts-section">
            <h3>Alertes Systèmes & Logs</h3>
            <div className="alerts-list">
              <div className="alert-item high-priority">
                <AlertCircle size={14} />
                <span>Base de données Postgres : {stats?.open_disputes > 10 ? "Charge élevée" : "Optimale"}</span>
              </div>
              <div className="alert-item">
                <Users size={14} />
                <span>{stats?.new_users_week || 0} nouvelles inscriptions cette semaine</span>
              </div>
            </div>
          </div>

          <div className="disputes-section">
            <h3>Litiges Récents</h3>
            <div className="disputes-mini-list">
              {disputes.length > 0 ? disputes.slice(0, 5).map((d) => (
                <div key={d.id} className="dispute-row">
                  <div className="row-info">
                    <strong>{d.reason}</strong>
                    <span>Par {d.buyer_name} • Commande #{d.order_id.slice(0, 8)}</span>
                  </div>
                  <div className="row-amount text-danger">{d.total_price.toLocaleString()} F</div>
                  <button className="btn-icon">
                    <ArrowRight size={18} />
                  </button>
                </div>
              )) : (
                <p style={{ textAlign: 'center', color: '#999', padding: '20px' }}>Aucun litige ouvert.</p>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function KPI({ icon, label, value, premium, warning, alert, onClick }: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  premium?: boolean;
  warning?: boolean;
  alert?: string;
  onClick?: () => void;
}) {
  return (
    <div
      className={`kpi-card ${premium ? 'premium' : ''} ${warning ? 'warning' : ''} ${onClick ? 'kpi-clickable' : ''}`}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      <div className="kpi-icon-box">{icon}</div>
      <div className="kpi-info">
        <span>{label}</span>
        <h3>{value}</h3>
        {alert && <div className="badge-alert">{alert}</div>}
      </div>
    </div>
  );
}
