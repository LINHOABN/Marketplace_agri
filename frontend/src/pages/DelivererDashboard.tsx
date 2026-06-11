import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Package,
  DollarSign,
  Loader2,
  MessageCircle,
  Navigation,
  RefreshCw,
  QrCode,
  Store,
  MapPin,
  Phone,
  Map,
} from "lucide-react";
import { Html5QrcodeScanner } from "html5-qrcode";
import { useRef } from "react";
import api from "../api";
import { API_URL } from "../config";
import { useUser } from "../hooks/useUser";
import { useGeolocation } from "../hooks/useGeolocation";
import DeliveryMap from "../components/DeliveryMap";
import toast from "react-hot-toast";
import "./DelivererDashboard.css";

export default function DelivererDashboard() {
  const navigate = useNavigate();
  const { currentUser, getAvatarSrc, getInitials } = useUser();
  const [tab, setTab] = useState<"available" | "active">("available");
  const [missions, setMissions] = useState<any[]>([]);
  const [myMissions, setMyMissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showScanModal, setShowScanModal] = useState(false);
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
  const [verificationCode, setVerificationCode] = useState("");
  const [linkedSeller, setLinkedSeller] = useState<any>(null);
  const [showLinkForm, setShowLinkForm] = useState(false);
  const [sellerIdInput, setSellerIdInput] = useState("");
  const [showMapModal, setShowMapModal] = useState(false);
  const [mapMission, setMapMission] = useState<any>(null);

  const handleStartChat = async (targetUserId: string, productId?: string) => {
    try {
      const res = await api.post("/chat/conversations", {
        participant_id: targetUserId,
        product_id: productId
      });
      navigate(`/chat/${res.data.id}`);
    } catch (err) {
      toast.error("Erreur d'ouverture du chat");
    }
  };

  // Stats calculate - On inclut 'delivered' et 'completed' pour les gains
  const totalEarnings = myMissions
    .filter(m => m.status === 'delivered' || m.status === 'completed')
    .reduce((sum, m) => sum + (m.total_amount || 0), 0);
  const activeCount = myMissions.filter(m => m.status !== 'delivered' && m.status !== 'completed').length;

  const fetchMissions = async () => {
    setLoading(true);
    try {
      const [availRes, myRes] = await Promise.all([
        api.get("/delivery/available"),
        api.get("/delivery/my-missions")
      ]);

      setMissions(Array.isArray(availRes.data) ? availRes.data : []);
      setMyMissions(Array.isArray(myRes.data) ? myRes.data : []);
    } catch (err) {
      console.error("Fetch missions failed", err);
      toast.error("Erreur de chargement des missions");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMissions();
    // Check link status
    api.get("/seller/deliverer-status").then(res => {
      if (res.data.is_linked) setLinkedSeller(res.data);
    }).catch(() => { });
  }, []);

  const handleLinkToSeller = async () => {
    if (!sellerIdInput.trim()) return;
    try {
      const linkRes = await api.post("/auth/link-deliverer", { seller_id: sellerIdInput.trim() });
      if (linkRes.data.success) {
        toast.success(linkRes.data.message || "Liaison réussie !");
        // Force refresh status
        const res = await api.get("/seller/deliverer-status");
        setLinkedSeller(res.data.is_linked ? res.data : null);
        setShowLinkForm(false);
        setSellerIdInput("");
        fetchMissions();
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Erreur de liaison");
    }
  };

  const handleAcceptMission = async (orderId: string) => {
    try {
      await api.post("/delivery/accept", { order_id: orderId });
      toast.success("Mission acceptée !");
      fetchMissions();
    } catch (err) {
      toast.error("Cette mission n'est plus disponible");
    }
  };

  const handleUpdateStatus = async (orderId: string, status: string) => {
    try {
      await api.patch("/delivery/update-status", { order_id: orderId, status: status });
      toast.success(`Statut mis à jour : ${status === 'shipped' ? 'En route' : 'Livré'}`);
      fetchMissions();
    } catch (err) {
      toast.error("Erreur lors de la mise à jour du statut");
    }
  };

  const currentList = tab === "available" ? missions : myMissions;

  const scannerRef = useRef<Html5QrcodeScanner | null>(null);

  useEffect(() => {
    if (showScanModal) {
      setTimeout(() => {
        const scanner = new Html5QrcodeScanner(
          "qr-reader",
          { fps: 10, qrbox: { width: 250, height: 250 } },
          /* verbose= */ false
        );
        scanner.render(
          (decodeText) => {
            // Handle expected format ORDER-UUID
            if (decodeText.startsWith("ORDER-")) {
              const codeFromQR = decodeText.replace("ORDER-", "").slice(-6).toUpperCase();
              setVerificationCode(codeFromQR);
              scanner.clear();
            } else {
              setVerificationCode(decodeText);
            }
          },
          (err) => {
            // Handle error if needed
          }
        );
        scannerRef.current = scanner;
      }, 300);
    } else {
      if (scannerRef.current) {
        scannerRef.current.clear().catch(() => { });
        scannerRef.current = null;
      }
    }
    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear().catch(() => { });
      }
    };
  }, [showScanModal]);

  const handleVerifyDelivery = async () => {
    if (!activeOrderId || !verificationCode.trim()) {
      toast.error("Veuillez saisir le code de confirmation.");
      return;
    }
    try {
      const res = await api.post("/delivery/confirm-delivery", {
        order_id: activeOrderId,
        code: verificationCode.trim().toUpperCase(),
      });

      const { deliverer_share } = res.data;
      toast.success(
        `✅ Livraison confirmée ! Votre gain : ${Number(deliverer_share).toLocaleString()} FCFA crédités.`,
        { duration: 5000 }
      );

      setShowScanModal(false);
      setVerificationCode("");
      setActiveOrderId(null);
      fetchMissions();
    } catch (err: any) {
      const detail = err?.response?.data?.detail || "Erreur lors de la validation";
      toast.error(detail);
    }
  };


  const userCoords = useGeolocation();

  return (
    <div className="deliverer-dashboard-wrapper dashboard-wrapper">
      {showMapModal && mapMission && (
        <div className="modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div className="modal-content" style={{ background: 'var(--surface)', padding: '1rem', borderRadius: '1.5rem', width: '100%', maxWidth: '800px', height: '80vh', position: 'relative', display: 'flex', flexDirection: 'column' }}>
            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Navigation size={20} color="var(--primary)" />
                <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 900 }}>Itinéraire Livraison</h2>
              </div>
              <button className="btn btn-secondary" onClick={() => setShowMapModal(false)} style={{ padding: '8px 12px' }}>Fermer</button>
            </header>
            <div style={{ flex: 1, position: 'relative', background: '#f5f5f5', borderRadius: '12px', overflow: 'hidden' }}>
              <DeliveryMap
                delivererPos={userCoords ? [userCoords.lat, userCoords.lng] : null}
                shopPos={mapMission.shop_lat && mapMission.shop_lng ? [mapMission.shop_lat, mapMission.shop_lng] : null}
                buyerPos={mapMission.delivery_lat && mapMission.delivery_lng ? [mapMission.delivery_lat, mapMission.delivery_lng] : (mapMission.buyer_lat && mapMission.buyer_lng ? [mapMission.buyer_lat, mapMission.buyer_lng] : null)}
              />
            </div>
            <footer style={{ marginTop: '1rem', padding: '1rem', background: 'var(--surface-hover)', borderRadius: '12px', fontSize: '13px' }}>
              <p style={{ margin: 0 }}><strong>Destination :</strong> {mapMission.delivery_address}</p>
              <p style={{ margin: '4px 0 0', color: 'var(--text-muted)' }}>Le trait pointillé vert indique la route directe vers le client.</p>
            </footer>
          </div>
        </div>
      )}

      {showScanModal && (
        <div className="modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div className="modal-content" style={{ background: 'var(--surface)', padding: '2rem', borderRadius: '1.5rem', width: '100%', maxWidth: '400px', textAlign: 'center', border: '1px solid var(--border-color)' }}>
            <div style={{ width: '64px', height: '64px', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem' }}>
              <QrCode size={32} />
            </div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 900, marginBottom: '0.5rem' }}>Confirmer Livraison</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '2rem' }}>Saisissez le code de 6 chiffres affiché sur le téléphone du client ou scannez son QR Code.</p>

            <div id="qr-reader" style={{ width: '100%', marginBottom: '1rem', borderRadius: '12px', overflow: 'hidden' }}></div>

            <input
              type="text"
              placeholder="Ou saisissez le code"
              value={verificationCode}
              onChange={(e) => setVerificationCode(e.target.value)}
              style={{ width: '100%', padding: '1rem', borderRadius: '12px', border: '2px solid var(--border-color)', background: 'var(--surface-hover)', fontSize: '1.5rem', textAlign: 'center', fontWeight: 900, letterSpacing: '0.1em', color: 'var(--text-main)', marginBottom: '1.5rem' }}
            />

            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                className="btn btn-primary"
                style={{ flex: 2, background: '#10b981' }}
                onClick={handleVerifyDelivery}
              >
                Vérifier & Terminer
              </button>
              <button
                className="btn btn-secondary"
                style={{ flex: 1 }}
                onClick={() => { setShowScanModal(false); setVerificationCode(""); }}
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}
      <header className="deliverer-header dashboard-header">
        <div className="user-profile">
          <div className="avatar-wrapper" style={{ width: "48px", height: "48px", borderRadius: "12px", overflow: "hidden", background: "var(--primary)", display: "flex", alignItems: "center", justifyContent: "center", border: "2px solid var(--surface)" }}>
            {getAvatarSrc(currentUser?.avatar_url) ? (
              <img src={getAvatarSrc(currentUser?.avatar_url)!} alt="Avatar" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (
              <span style={{ color: 'white', fontWeight: 800 }}>{getInitials(currentUser?.name || "L")}</span>
            )}
          </div>
          <div className="profile-text" style={{ marginLeft: "12px" }}>
            <h1 style={{ margin: 0, fontSize: "18px", fontWeight: 900 }}>Missions de Livraison</h1>
            <p style={{ margin: 0, fontSize: "11px", color: "var(--primary)", fontWeight: 800, textTransform: "uppercase" }}>
              {linkedSeller ? `📦 ${linkedSeller.shop_name}` : "Mode Indépendant • En Service"}
            </p>
          </div>
        </div>
        <div className="header-actions">
          <button className="btn btn-secondary" onClick={() => fetchMissions()} style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <RefreshCw size={16} className={loading ? "spinner" : ""} />
            <span>Actualiser</span>
          </button>
        </div>
      </header>

      <main className="deliverer-content dashboard-content">

        {/* === SELLER LINK STATUS BANNER === */}
        {linkedSeller ? (
          <div style={{
            background: "linear-gradient(135deg, #E8F5E9, #F1F8E9)",
            border: "1.5px solid #A5D6A7",
            borderRadius: "16px",
            padding: "1rem 1.5rem",
            marginBottom: "1.5rem",
            display: "flex",
            alignItems: "center",
            gap: "14px"
          }}>
            <div style={{ width: "44px", height: "44px", borderRadius: "12px", background: "var(--primary)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Store size={22} color="white" />
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ margin: 0, fontWeight: 900, fontSize: "15px", color: "#2E7D32" }}>
                ✅ Lié à : {linkedSeller.shop_name}
              </p>
              <p style={{ margin: 0, fontSize: "12px", color: "var(--text-muted)" }}>
                Vendeur : {linkedSeller.seller_name} • Toutes vos missions viennent de cette boutique
              </p>
            </div>
            <button
              className="btn btn-secondary"
              style={{ fontSize: "12px", padding: "6px 12px", whiteSpace: "nowrap" }}
              onClick={() => handleStartChat(linkedSeller.seller_id)}
            >
              <MessageCircle size={14} /> Contacter
            </button>
          </div>
        ) : (
          <div style={{
            background: "linear-gradient(135deg, #FFF8E1, #FFF3E0)",
            border: "1.5px dashed #FFB300",
            borderRadius: "16px",
            padding: "1rem 1.5rem",
            marginBottom: "1.5rem",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: showLinkForm ? "12px" : "0" }}>
              <div style={{ width: "40px", height: "40px", borderRadius: "10px", background: "#FFF3E0", border: "1.5px solid #FFB300", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Store size={20} color="#F57C00" />
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ margin: 0, fontWeight: 800, color: "#F57C00" }}>Vous n'êtes lié à aucun vendeur</p>
                <p style={{ margin: 0, fontSize: "12px", color: "var(--text-muted)" }}>Toutes les missions disponibles sont affichées (mode indépendant)</p>
              </div>
              <button
                className="btn btn-primary"
                style={{ background: "#F57C00", fontSize: "12px", padding: "8px 14px", whiteSpace: "nowrap" }}
                onClick={() => setShowLinkForm(!showLinkForm)}
              >
                {showLinkForm ? "Annuler" : "Se lier à un vendeur"}
              </button>
            </div>
            {showLinkForm && (
              <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                <input
                  type="text"
                  value={sellerIdInput}
                  onChange={(e) => setSellerIdInput(e.target.value)}
                  placeholder="Collez l'ID du vendeur ici..."
                  style={{ flex: 1, padding: "10px 14px", borderRadius: "10px", border: "1.5px solid #FFB300", background: "white", fontSize: "13px" }}
                  onKeyDown={(e) => e.key === "Enter" && handleLinkToSeller()}
                />
                <button className="btn btn-primary" style={{ background: "#2E7D32", padding: "10px 20px" }} onClick={handleLinkToSeller}>
                  Valider
                </button>
              </div>
            )}
          </div>
        )}

        <div className="kpi-grid">
          <div className="kpi-card">
            <div className="kpi-icon-wrapper" style={{ color: "#2E7D32", background: "rgba(46, 125, 50, 0.1)" }}>
              <DollarSign size={24} />
            </div>
            <div className="kpi-info" onClick={() => navigate("/wallet")}>
              <span>Gains Cumulés</span>
              <h3>{totalEarnings.toLocaleString()} <small style={{ fontSize: '12px' }}>FCFA</small></h3>
            </div>
          </div>
          <div className="kpi-card">
            <div className="kpi-icon-wrapper" style={{ color: "#0288D1", background: "rgba(2, 136, 209, 0.1)" }}>
              <Package size={24} />
            </div>
            <div className="kpi-info">
              <span>Missions</span>
              <h3>{activeCount} <small style={{ fontSize: '12px' }}>Actives</small></h3>
            </div>
          </div>
          <div className="kpi-card">
            <div className="kpi-icon-wrapper" style={{ color: "#F57C00", background: "rgba(245, 124, 0, 0.1)" }}>
              <Navigation size={24} />
            </div>
            <div className="kpi-info">
              <span>Disponibles</span>
              <h3>{missions.length}</h3>
            </div>
          </div>
        </div>

        <nav className="tab-nav">
          <button className={tab === "available" ? "active" : ""} onClick={() => setTab("available")}>
            Missions à proximité ({missions.length})
          </button>
          <button className={tab === "active" ? "active" : ""} onClick={() => setTab("active")}>
            Mon activité ({myMissions.length})
          </button>
        </nav>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '5rem' }}>
            <Loader2 className="spinner" size={40} color="var(--primary)" />
            <p style={{ marginTop: '1rem', color: 'var(--text-muted)' }}>Mise à jour des missions...</p>
          </div>
        ) : (
          <div className="mission-list">
            {currentList.map((m) => (
              <div key={m.id} className="mission-card">
                <div className="m-header">
                  <span className={`m-badge ${tab === 'active' ? m.status : 'new'}`}>
                    {tab === 'active' ? (
                      m.status === 'pending' ? 'En attente' :
                        m.status === 'prepared' ? 'Prêt pour pickup' :
                          m.status === 'shipped' ? 'En livraison' :
                            (m.status === 'delivered' || m.status === 'completed') ? 'Payé & Terminé' : m.status
                    ) : 'NOUVELLE OFFRE'}
                  </span>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                    <span className="m-price">{m.total_amount?.toLocaleString()} FCFA</span>
                    <span style={{ fontSize: '11px', color: 'var(--primary)', fontWeight: 800 }}>
                      Votre part: {(m.total_amount * 0.1).toLocaleString()} FCFA (10%)
                    </span>
                  </div>
                </div>

                <div className="m-product" style={{ display: 'flex', gap: '12px', margin: '1rem 0' }}>
                  <div style={{ width: '56px', height: '56px', borderRadius: '12px', background: 'var(--surface-hover)', overflow: 'hidden' }}>
                    <img src={m.image_url ? (m.image_url.startsWith('http') ? m.image_url : `${API_URL}${m.image_url}`) : "https://via.placeholder.com/100"} alt="prod" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 800 }}>{m.product_name}</h4>
                    <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-muted)' }}>{m.quantity} {m.unit} • Ref #{m.id.slice(-5)}</p>
                  </div>
                </div>

                <div className="m-route">
                  <div className="route-step">
                    <div className="icon-dot start"></div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <strong>Pickup: {m.shop_name}</strong>
                        {m.shop_phone && (
                          <a href={`tel:${m.shop_phone}`} style={{ fontSize: '11px', color: 'var(--primary)', textDecoration: 'none', fontWeight: 800 }}>
                            <Phone size={12} style={{ verticalAlign: 'middle', marginRight: '4px' }} /> Appeler
                          </a>
                        )}
                      </div>
                      <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>
                        <MapPin size={12} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
                        {m.shop_location || "Adresse du magasin non renseignée"}
                      </p>
                    </div>
                  </div>
                  <div style={{ height: '16px', borderLeft: '2px dashed var(--border-color)', marginLeft: '3px', margin: '4px 0' }}></div>
                  <div className="route-step">
                    <div className="icon-dot end"></div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <strong>Livraison: Vers le client</strong>
                        {m.buyer_phone && (
                          <a href={`tel:${m.buyer_phone}`} style={{ fontSize: '11px', color: 'var(--primary)', textDecoration: 'none', fontWeight: 800 }}>
                            <Phone size={12} style={{ verticalAlign: 'middle', marginRight: '4px' }} /> Appeler
                          </a>
                        )}
                      </div>
                      <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>
                        <MapPin size={12} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
                        {m.delivery_address}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="m-footer" style={{ marginTop: 'auto', paddingTop: '1rem' }}>
                  {tab === "available" ? (
                    <button className="btn btn-primary" style={{ width: '100%', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em' }} onClick={() => handleAcceptMission(m.id)}>
                      Prendre la mission
                    </button>
                  ) : (
                    <div style={{ display: 'flex', gap: '10px' }}>
                      {(m.status === 'accepted' || m.status === 'prepared' || m.status === 'paid' || m.status === 'pending') && (
                        <button className="btn btn-primary" style={{ flex: 1, background: '#3b82f6', fontWeight: 800 }} onClick={() => handleUpdateStatus(m.id, 'shipped')}>
                          Partir en livraison
                        </button>
                      )}
                      {m.status === 'shipped' && (
                        <button className="btn btn-primary" style={{ flex: 1, background: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontWeight: 800 }} onClick={() => { setActiveOrderId(m.id); setShowScanModal(true); }}>
                          <QrCode size={18} /> Scanner le Code
                        </button>
                      )}

                      {/* BOUTON CARTE */}
                      {(m.status === 'accepted' || m.status === 'prepared' || m.status === 'shipped') && (
                        <button
                          className="btn btn-secondary"
                          onClick={() => { setMapMission(m); setShowMapModal(true); }}
                          title="Voir l'itinéraire sur la carte"
                          style={{ width: '48px', height: '48px', padding: 0, border: '1.5px solid var(--primary)' }}
                        >
                          <Map size={20} color="var(--primary)" />
                        </button>
                      )}

                      <button className="btn btn-secondary" onClick={() => handleStartChat(m.buyer_id, m.product_id)} title="Chat avec l'acheteur" style={{ width: '48px', height: '48px', padding: 0 }}>
                        <MessageCircle size={20} />
                      </button>
                      <button className="btn btn-secondary" onClick={() => handleStartChat(m.seller_user_id || m.seller_id, m.product_id)} title="Chat avec le vendeur" style={{ width: '48px', height: '48px', padding: 0, border: '1px solid var(--primary-light)' }}>
                        <Store size={20} color="var(--primary)" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {currentList.length === 0 && (
              <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '5rem 0', opacity: 0.5 }}>
                <Package size={60} style={{ marginBottom: '1rem' }} />
                <p>Aucune mission disponible dans cette catégorie.</p>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
