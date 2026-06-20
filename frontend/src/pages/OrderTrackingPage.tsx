import { API_URL } from "../config";
import { toast } from "react-hot-toast";
import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../api";
import {
  Package,
  Truck,
  CheckCircle,
  ChevronLeft,
  Phone,
  ShieldCheck,
  AlertTriangle,
  XCircle,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import io from "socket.io-client";
import { useUser } from "../hooks/useUser";
import "./OrderTrackingPage.css";

export default function OrderTrackingPage() {
  const { currentUser } = useUser();
  const { orderId } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [deliveryCode, setDeliveryCode] = useState("");
  const [submittingCode, setSubmittingCode] = useState(false);

  useEffect(() => {
    const fetchOrder = async () => {
      try {
        const res = await api.get(`/orders/${orderId}`);
        setOrder(res.data);
      } catch (err) {
        console.error("Order fetch error");
      } finally {
        setLoading(false);
      }
    };

    fetchOrder();

    const socket = io(`${API_URL}`);
    socket.on(`order-update-${orderId}`, (updatedOrder) => {
      setOrder(updatedOrder);
    });

    return () => {
      socket.disconnect();
    };
  }, [orderId]);

  const handleConfirmReceipt = async () => {
    try {
      await api.post("/payments/confirm-receipt", { order_id: orderId });
      toast.success("Réception confirmée !");
      window.location.reload();
    } catch (err) {
      toast.error("Erreur confirmation");
    }
  };

  const handleManualCodeSubmit = async () => {
    if (!deliveryCode.trim()) {
      toast.error("Veuillez saisir le code complet.");
      return;
    }
    setSubmittingCode(true);
    try {
      await api.post("/delivery/confirm-delivery", {
        order_id: orderId,
        code: deliveryCode
      });
      toast.success("Livraison validée avec succès !");
      window.location.reload();
    } catch (err: any) {
      console.error(err);
      const detail = err.response?.data?.detail || "Code invalide. Vérifiez avec l'acheteur.";
      toast.error(detail);
    } finally {
      setSubmittingCode(false);
    }
  };

  if (loading)
    return (
      <div className="tracking-loading dashboard-wrapper" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <p>Localisation de votre colis...</p>
      </div>
    );
  if (!order) return <div className="tracking-error dashboard-wrapper">Commande introuvable</div>;

  const steps = [
    { status: "pending", label: "Confirmé", icon: <Package size={22} /> },
    { status: "shipped", label: "En route", icon: <Truck size={22} /> },
    { status: "delivered", label: "Livré", icon: <CheckCircle size={22} /> },
    { status: "completed", label: "Termine", icon: <ShieldCheck size={22} /> },
  ];

  const statusStepMap: Record<string, number> = {
    "pending": 0,
    "prepared": 0,
    "accepted": 0,
    "shipped": 1,
    "delivered": 2,
    "completed": 3,
  };

  const currentStepIdx = statusStepMap[order.status] ?? -1;

  return (
    <div className="tracking-page-wrapper dashboard-wrapper">
      <header className="tracking-header dashboard-header">
        <button onClick={() => navigate(-1)} className="back-btn btn" style={{ padding: '8px', borderRadius: '50%', background: 'var(--surface-hover)' }}>
          <ChevronLeft />
        </button>
        <h1>Suivi de Commande</h1>
        <div className="order-id-badge">
          ORD-#{order.id?.slice(-8).toUpperCase()}
        </div>
      </header>

      <main className="tracking-content dashboard-content">
        <div className="tracking-main-side">
          <section className="timeline-card">
            <h3 style={{ marginBottom: '2rem', fontSize: '1.25rem', fontWeight: 800 }}>Progression de la livraison</h3>
            <div className="timeline-container">
              {steps.map((step, idx) => {
                const isActive = idx <= currentStepIdx;
                const isCompleted = idx < currentStepIdx;
                return (
                  <div
                    key={idx}
                    className={`timeline-item ${isActive ? "active" : ""}`}
                  >
                    <div className={`step-icon ${isCompleted ? "done" : ""}`}>
                      {step.icon}
                    </div>
                    <div className="step-label">
                      {isCompleted && <small>Valid</small>}
                      <p>{step.label}</p>
                    </div>
                    {idx < steps.length - 1 && (
                      <div className="timeline-line"></div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          <div className="tracking-actions" style={{ marginTop: '2rem' }}>
            {order.status === "delivered" && (
              <div className="dashboard-section" style={{ background: 'rgba(46, 125, 50, 0.05)', border: '1px dashed var(--primary)', padding: '1.5rem', borderRadius: '12px' }}>
                <h4 style={{ color: 'var(--primary)', marginBottom: '10px' }}>Livraison effectue !</h4>
                <p style={{ fontSize: '14px', marginBottom: '1.5rem' }}>Avez-vous bien reçu tous vos articles en bon état ?</p>
                <div style={{ display: 'flex', gap: '1rem' }}>
                  <button
                    className="btn btn-primary btn-confirm-all"
                    onClick={handleConfirmReceipt}
                    style={{ flex: 1 }}
                  >
                    <ShieldCheck size={18} /> Confirmer la réception
                  </button>
                  <button
                    className="btn btn-dispute"
                    onClick={() => navigate("/dispute")}
                    style={{ flex: 1 }}
                  >
                    <AlertTriangle size={18} /> Signaler un litige
                  </button>
                </div>
              </div>
            )}
            {order.status === "pending" && (
              <button className="btn btn-cancel">
                <XCircle size={18} /> Annuler la commande
              </button>
            )}
          </div>
        </div>

        <aside className="tracking-sidebar">
          <section className="info-card">
            <h4 style={{ marginBottom: '1rem', fontWeight: 800 }}>Détails de la commande</h4>
            <div className="product-summary">
              <img src={order.product_image?.startsWith('http') ? order.product_image : `${API_URL}${order.product_image}`} alt="prod" />
              <div className="text">
                <h4>{order.product_name}</h4>
                <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Quantité : {order.quantity}</p>
                <p className="price">
                  {order.total_price?.toLocaleString()} FCFA
                </p>
              </div>
            </div>
          </section>

          {order.deliverer_id && (
            <section className="driver-card" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div className="driver-avatar" style={{ width: '48px', height: '48px', background: 'var(--primary)', color: 'white', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
                {order.deliverer_name ? order.deliverer_name.split(' ').map((n: any) => n[0]).join('').toUpperCase().slice(0, 2) : "L"}
              </div>
              <div className="driver-info" style={{ flex: 1 }}>
                <h4 style={{ margin: 0, fontSize: '14px' }}>{order.deliverer_name || "Livreur indépendant"}</h4>
                <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)' }}>Votre livreur AgriMarché</p>
              </div>
              {order.deliverer_phone && (
                <a href={`tel:${order.deliverer_phone}`} className="btn btn-icon" style={{ padding: '10px', background: 'var(--surface-hover)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Phone size={18} />
                </a>
              )}
            </section>
          )}

          {order.status !== 'completed' && (
            <section className="confirmation-card">
              {currentUser?.id === order.buyer_id ? (
                <>
                  <h4 style={{ fontWeight: 800 }}>Votre code de réception</h4>
                  <div className="qr-wrapper">
                    <QRCodeSVG value={`ORDER-${order.id}`} size={180} />
                    <div className="digits-code" style={{ fontSize: '2rem', letterSpacing: '0.2em', marginTop: '1rem', color: 'var(--primary)', fontWeight: 900 }}>
                      {order.id?.slice(-6).toUpperCase()}
                    </div>
                  </div>
                  <p className="hint" style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '1rem' }}>
                    Montrez ce code au livreur (ou au vendeur) pour confirmer que vous avez bien reçu votre colis.
                  </p>
                </>
              ) : (
                <>
                  <h4 style={{ fontWeight: 800 }}>Valider la réception</h4>
                  <div className="manual-code-input-wrapper" style={{ marginTop: '1.5rem' }}>
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px' }}>
                      Saisissez les 6 caractères du code fournis par l'acheteur pour finaliser la transaction.
                    </p>
                    <input
                      type="text"
                      className="input-code-manual"
                      placeholder="Ex: A1B2C3"
                      maxLength={6}
                      value={deliveryCode}
                      onChange={(e) => setDeliveryCode(e.target.value.toUpperCase())}
                      style={{
                        width: '100%',
                        fontSize: '24px',
                        textAlign: 'center',
                        letterSpacing: '0.3em',
                        padding: '12px',
                        borderRadius: '12px',
                        border: '2px solid var(--border-color)',
                        fontWeight: '900',
                        textTransform: 'uppercase',
                        marginBottom: '1rem'
                      }}
                    />
                    <button
                      className="btn btn-primary"
                      onClick={handleManualCodeSubmit}
                      disabled={submittingCode || deliveryCode.length < 6}
                      style={{ width: '100%', height: '50px', fontWeight: 800 }}
                    >
                      {submittingCode ? "Validation en cours..." : "Valider la livraison"}
                    </button>
                  </div>
                </>
              )}
            </section>
          )}
        </aside>
      </main>
    </div>
  );
}
