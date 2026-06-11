import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  ChevronLeft,
  User,
  Shield,
  Trash2,
  ChevronRight,
  LogOut,
  Smartphone,
  Monitor,
  RefreshCw,
  ShoppingCart
} from "lucide-react";
import api from "../api";
import { useUser } from "../context/UserContext";
import toast from "react-hot-toast";
import "./SettingsPage.css";

type UserSession = {
  id: string;
  device_label: string;
  ip_address?: string;
  created_at: string;
  last_used_at?: string;
  is_active: boolean;
  is_current?: boolean;
};

export default function SettingsPage() {
  const navigate = useNavigate();
  const { currentUser, logout } = useUser();
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [sessions, setSessions] = useState<UserSession[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [systemSettings, setSystemSettings] = useState<any>(null);
  const [roleRequestStatus, setRoleRequestStatus] = useState<string | null>(null);

  const loadData = async () => {
    setLoadingSessions(true);
    try {
      const [sessRes, sysRes, roleRes] = await Promise.all([
        api.get("/auth/sessions"),
        api.get("/system/settings"),
        api.get("/auth/role-requests/me").catch(() => ({ data: [] }))
      ]);
      setSessions(sessRes.data);
      setSystemSettings(sysRes.data);
      if (roleRes.data && roleRes.data.length > 0) {
        setRoleRequestStatus(roleRes.data[0].status);
      }
    } catch {
      setSessions([]);
    } finally {
      setLoadingSessions(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleRequestRole = async (target: string) => {
    if (!currentUser?.is_verified) {
      toast("Veuillez d'abord vérifier votre identité", { icon: "🛡️" });
      navigate(`/verify-profile?role=${target}`);
      return;
    }

    try {
      await api.post("/auth/request-role", { requested_role: target });
      toast.success("Demande envoyée !");
      loadData();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Erreur lors de la demande");
    }
  };

  const handleLogout = async () => {
    await logout();
  };

  const formatDate = (d: string) => {
    try {
      return new Date(d).toLocaleString("fr-FR", { dateStyle: 'short' });
    } catch { return d; }
  };

  if (!currentUser) return null;

  // Filtrer pour n'afficher que la session actuelle et max 1 autre session récente pour alléger la page
  const displaySessions = sessions.slice(0, 2);

  return (
    <div className="settings-page-wrapper">
      <header className="settings-header">
        <button type="button" onClick={() => navigate(-1)} className="back-btn">
          <ChevronLeft />
        </button>
        <h1>Paramètres</h1>
      </header>

      <main className="settings-content">
        {/* SECTION 1: COMPTE PRO */}
        <section className="settings-group">
          <h3>Statut Professionnel</h3>
          <div className="settings-card">
            {currentUser.base_role && currentUser.base_role !== 'buyer' ? (
              <div className="status-info-row approved">
                <Shield size={20} color="#2e7d32" />
                <div className="row-info">
                  <h4>Compte {currentUser.base_role === 'seller' ? 'Vendeur' : 'Livreur'} Actif</h4>
                  <p>Votre statut pro est validé. Utilisez le switch sur votre profil pour basculer.</p>
                </div>
              </div>
            ) : roleRequestStatus === 'pending' ? (
              <div className="status-info-row pending">
                <RefreshCw size={20} color="#ffa000" className="spin-slow" />
                <div className="row-info">
                  <h4>Demande en cours d'examen</h4>
                  <p>L'administrateur vérifie vos documents. Repassez plus tard.</p>
                </div>
              </div>
            ) : (
              <>
                <div className="settings-row clickable" onClick={() => handleRequestRole('seller')}>
                  <div className="row-icon"><ShoppingCart size={20} /></div>
                  <div className="row-info">
                    <h4>Devenir Vendeur</h4>
                    <p>Vendez vos produits sur AgriMarché</p>
                  </div>
                  <ChevronRight size={18} color="#CCC" />
                </div>
                <div className="settings-row clickable" onClick={() => handleRequestRole('deliverer')}>
                  <div className="row-icon"><Smartphone size={20} /></div>
                  <div className="row-info">
                    <h4>Devenir Livreur</h4>
                    <p>Gagnez de l'argent en livrant des colis</p>
                  </div>
                  <ChevronRight size={18} color="#CCC" />
                </div>
              </>
            )}
          </div>
        </section>

        {/* SECTION 2: SÉCURITÉ (Allégée) */}
        {displaySessions.length > 0 && (
          <section className="settings-group">
            <h3>Appareils connectés</h3>
            <div className="settings-card sessions-card">
              {loadingSessions ? (
                <p className="sessions-empty">Chargement...</p>
              ) : displaySessions.map((s) => (
                <div key={s.id} className={`session-row ${s.is_current ? "current" : ""}`}>
                  <div className="session-icon">
                    {s.device_label?.toLowerCase().includes("mobile") ? <Smartphone size={18} /> : <Monitor size={18} />}
                  </div>
                  <div className="session-info">
                    <h4>{s.device_label || "Appareil"} {s.is_current && <span className="session-badge-current">Actuel</span>}</h4>
                    <p>{s.ip_address || "IP masquée"} · {formatDate(s.last_used_at || s.created_at)}</p>
                  </div>
                </div>
              ))}
              {sessions.length > 2 && (
                <button className="view-more-sessions" onClick={() => toast("Gestion complète des sessions bientôt disponible.")}>
                  Voir les {sessions.length - 2} autres appareils
                </button>
              )}
            </div>
          </section>
        )}

        {/* SECTION 3: SUPPORT */}
        <section className="settings-group">
          <h3>Aide & Support</h3>
          <div className="settings-card">
            <div className="settings-row clickable" onClick={() => window.open(`mailto:${systemSettings?.support_email || 'support@agrimarche.com'}`)}>
              <div className="row-icon"><User size={20} /></div>
              <div className="row-info">
                <h4>Email Support</h4>
                <p>{systemSettings?.support_email || "support@agrimarche.com"}</p>
              </div>
            </div>
            <div className="settings-row clickable" onClick={() => window.open(`tel:${systemSettings?.support_phone || '+237'}`)}>
              <div className="row-icon"><Smartphone size={20} /></div>
              <div className="row-info">
                <h4>Téléphone</h4>
                <p>{systemSettings?.support_phone || "Contactez l'assistance"}</p>
              </div>
            </div>
          </div>
        </section>

        <section className="settings-group actions">
          <button type="button" className="settings-action-btn logout" onClick={handleLogout}>
            <LogOut size={18} /> Se déconnecter
          </button>
          <button type="button" className="settings-action-btn delete" onClick={() => setShowDeleteModal(true)}>
            <Trash2 size={18} /> Supprimer le compte
          </button>
          <div className="app-version">AgriMarché v{systemSettings?.app_version || '2.4.1'}</div>
        </section>
      </main>

      {showDeleteModal && (
        <div className="modal-overlay">
          <div className="modal-content danger">
            <Shield size={40} color="#dc2626" />
            <h3>Supprimer mon compte ?</h3>
            <p>Attention, cette action supprimera toutes vos données de manière irréversible.</p>
            <div className="modal-btns">
              <button className="btn-confirm-final" onClick={() => { toast.success("Compte supprimé"); navigate("/login"); }}>Confirmer</button>
              <button className="btn-cancel-modal" onClick={() => setShowDeleteModal(false)}>Annuler</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
