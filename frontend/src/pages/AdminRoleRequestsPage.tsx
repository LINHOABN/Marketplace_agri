import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, Check, X, Maximize2, Eye } from "lucide-react";
import api from "../api";
import toast from "react-hot-toast";
import "./AdminDashboard.css";

import { API_URL } from "../config";

type RoleRequest = {
  id: string;
  user_id: string;
  user_name: string;
  email: string;
  phone: string;
  requested_role: string;
  id_card_url: string | null;
  selfie_url: string | null;
  created_at: string;
};

export default function AdminRoleRequestsPage() {
  const navigate = useNavigate();
  const [requests, setRequests] = useState<RoleRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const res = await api.get("/admin/role-requests");
      setRequests(Array.isArray(res.data) ? res.data : []);
    } catch {
      setRequests([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const decide = async (id: string, approve: boolean) => {
    try {
      await api.post(`/admin/role-requests/${id}/decide`, { approve });
      toast.success(approve ? "Demande approuvée" : "Demande refusée");
      fetchRequests();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Action impossible");
    }
  };

  const getFullUrl = (url: string | null) => {
    if (!url) return "";
    return url.startsWith('http') ? url : `${API_URL}${url}`;
  };

  return (
    <div className="admin-dashboard-wrapper">
      <header className="admin-header">
        <button type="button" onClick={() => navigate("/admin/dashboard")} className="btn-logout">
          <ChevronLeft size={16} /> Retour
        </button>
        <h1>Vérification des demandes ({requests.length})</h1>
      </header>

      <main className="admin-content">
        {loading ? (
          <p>Chargement…</p>
        ) : requests.length === 0 ? (
          <div style={{ textAlign: "center", padding: '40px', color: "#888" }}>
            <Check size={48} color="#ddd" style={{ marginBottom: '10px' }} />
            <p>Aucune demande en attente.</p>
          </div>
        ) : (
          <div className="role-requests-list" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {requests.map((r) => (
              <div key={r.id} className="request-card" style={{
                background: 'white',
                padding: '24px',
                borderRadius: '16px',
                boxShadow: '0 4px 20px rgba(0,0,0,0.05)',
                display: 'flex',
                gap: '24px',
                border: '1px solid #eee'
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                    <div>
                      <h3 style={{ margin: '0 0 4px', fontSize: '18px' }}>{r.user_name}</h3>
                      <p style={{ margin: 0, color: '#64748b', fontSize: '14px' }}>{r.email} • {r.phone}</p>
                    </div>
                    <span style={{
                      background: r.requested_role === 'seller' ? '#e8f5e9' : '#e3f2fd',
                      color: r.requested_role === 'seller' ? '#2e7d32' : '#1976d2',
                      padding: '4px 12px',
                      borderRadius: '20px',
                      fontSize: '12px',
                      fontWeight: 800,
                      textTransform: 'uppercase'
                    }}>
                      {r.requested_role === 'seller' ? 'VENDEUR' : 'LIVREUR'}
                    </span>
                  </div>

                  <div style={{ display: 'flex', gap: '16px', marginTop: '20px' }}>
                    <div style={{ flex: 1 }}>
                      <span style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>Pièce d'identité</span>
                      {r.id_card_url ? (
                        <div className="preview-container" style={{ position: 'relative', height: '140px', borderRadius: '12px', overflow: 'hidden', border: '1px solid #e2e8f0', cursor: 'pointer' }} onClick={() => setPreviewImage(getFullUrl(r.id_card_url))}>
                          <img src={getFullUrl(r.id_card_url)} alt="ID Card" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          <div className="preview-overlay" style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0, transition: 'opacity 0.2s' }}>
                            <Eye color="white" />
                          </div>
                        </div>
                      ) : <div style={{ height: '140px', background: '#f8fafc', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#dc2626', fontSize: '12px', border: '1px dashed #fee2e2' }}>Manquant</div>}
                    </div>

                    <div style={{ flex: 1 }}>
                      <span style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>Selfie de contrôle</span>
                      {r.selfie_url ? (
                        <div className="preview-container" style={{ position: 'relative', height: '140px', borderRadius: '12px', overflow: 'hidden', border: '1px solid #e2e8f0', cursor: 'pointer' }} onClick={() => setPreviewImage(getFullUrl(r.selfie_url))}>
                          <img src={getFullUrl(r.selfie_url)} alt="Selfie" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          <div className="preview-overlay" style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0, transition: 'opacity 0.2s' }}>
                            <Eye color="white" />
                          </div>
                        </div>
                      ) : <div style={{ height: '140px', background: '#f8fafc', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#dc2626', fontSize: '12px', border: '1px dashed #fee2e2' }}>Manquant</div>}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '12px', minWidth: '160px' }}>
                  <button
                    type="button"
                    className="btn btn-primary"
                    style={{ background: '#22c55e', border: 'none', padding: '12px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', color: 'white', fontWeight: 700 }}
                    onClick={() => decide(r.id, true)}
                  >
                    <Check size={18} /> Approuver
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ background: '#fef2f2', border: '1px solid #fee2e2', padding: '12px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', color: '#dc2626', fontWeight: 700 }}
                    onClick={() => decide(r.id, false)}
                  >
                    <X size={18} /> Refuser
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* LIGHTBOX MODAL */}
      {previewImage && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(15, 23, 42, 0.95)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          backdropFilter: 'blur(8px)',
          animation: 'fadeIn 0.2s ease'
        }} onClick={() => setPreviewImage(null)}>
          <button style={{
            position: 'absolute',
            top: '20px',
            right: '20px',
            background: 'white',
            border: 'none',
            width: '40px',
            height: '40px',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            zIndex: 10001
          }}>
            <X size={24} />
          </button>
          <img
            src={previewImage}
            alt="Preview"
            style={{
              maxWidth: '100%',
              maxHeight: '100%',
              borderRadius: '12px',
              objectFit: 'contain',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
            }}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      <style>{`
        .preview-container:hover .preview-overlay {
           opacity: 1 !important;
        }
        @keyframes fadeIn {
           from { opacity: 0; }
           to { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
