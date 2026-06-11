import { useState, useEffect } from "react";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import api from "../api";
import {
  ChevronLeft,
  Loader2,
  CheckCircle,
  AlertCircle,
  ShieldCheck,
  RefreshCw,
  Smartphone,
  Wallet,
  ArrowRight,
  Lock,
  Info
} from "lucide-react";
import toast from "react-hot-toast";
import "./PaymentPage.css";

export default function PaymentPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { orderId: urlOrderId } = useParams();
  const [order, setOrder] = useState<any>(location.state?.order || null);

  const [status, setStatus] = useState<
    "idle" | "waiting" | "ussd" | "success" | "error"
  >("idle");

  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [loadingBalance, setLoadingBalance] = useState(true);
  const [rechargePhone, setRechargePhone] = useState("");
  const [rechargeMethod, setRechargeMethod] = useState<"momo" | "orange" | null>(
    order?.method === "orange" ? "orange" : order?.method === "momo" ? "momo" : null
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const fetchOrderAndWallet = async () => {
      try {
        // Fetch wallet
        const wRes = await api.get("/wallet/");
        setWalletBalance(wRes.data.balance || 0);

        // Fetch order if missing
        if (!order && urlOrderId) {
          const oRes = await api.get(`/orders/${urlOrderId}`);
          const orderData = oRes.data;
          // Normalisation : s'assurer que total_price est présent (backend retourne total_amount ou total_price via l'alias)
          if (!orderData.total_price && orderData.total_amount) {
            orderData.total_price = orderData.total_amount;
          }
          setOrder(orderData);
          setRechargeMethod(orderData.method === "orange" ? "orange" : "momo");
        }
      } catch (err) {
        console.error("Error fetching payment data", err);
        if (!order) toast.error("Commande introuvable");
      } finally {
        setLoadingBalance(false);
      }
    };
    fetchOrderAndWallet();
  }, [urlOrderId, order]);

  if (loadingBalance && !order) return <div className="loading-overlay">Récupération de la commande...</div>;
  if (!order) return <div className="error-overlay">Commande introuvable</div>;

  const handlePay = async () => {
    setStatus("waiting");
    setErrorMessage(null);
    try {
      const currentBalance = walletBalance ?? 0;
      const missingAmount = order.total_price - currentBalance;

      // 1. Si solde insuffisant, faire d'abord la recharge
      if (missingAmount > 0) {
        if (!rechargePhone.trim()) {
          toast.error("Numéro Mobile Money requis");
          setStatus("idle");
          return;
        }

        // Étape USSD simulée : "Entrez votre code secret"
        setStatus("ussd");
        await new Promise((resolve) => setTimeout(resolve, 3000));

        setStatus("waiting"); // Retour au chargement pour la validation serveur

        await api.post("/wallet/deposit", {
          amount: missingAmount,
          method: rechargeMethod === "momo" ? "MTN MoMo" : "Orange Money",
          phone: rechargePhone
        });

        toast.success("Wallet rechargé avec succès !");
      }

      // 2. Lancer le paiement final par portefeuille
      await api.post("/payments/initiate", {
        order_id: order.id,
        amount: order.total_price,
        payment_method: "wallet"
      });

      // Succès
      setStatus("success");
      if ("vibrate" in navigator) navigator.vibrate([100, 50, 100]);
      toast.success("Commande payée et sécurisée !");

    } catch (err: any) {
      console.error("Payment failed:", err);
      const msg = err.response?.data?.detail || err.response?.data?.error || err.message || "Le paiement a échoué.";
      setErrorMessage(msg);
      setStatus("error");
    }
  };

  return (
    <div className="payment-page-container dashboard-wrapper">
      <header className="payment-header dashboard-header">
        <button onClick={() => navigate(-1)} className="back-btn-round">
          <ChevronLeft size={22} />
        </button>
        <h1>Caisse Sécurisée</h1>
        <div style={{ width: 40 }} />
      </header>

      <main className="payment-main-content dashboard-content">
        <div className="payment-layout">
          {/* Section Montant et Transaction */}
          <div className="payment-recap-box">
            <div className="order-summary-card">
              <span className="tx-id">Transaction #{order.id}</span>
              <div className="total-display">
                <h2>{order.total_price?.toLocaleString()} <small>FCFA</small></h2>
                <p>Montant total incluant taxes et livraison</p>
              </div>
              <div className="security-badge-premium">
                <ShieldCheck size={18} />
                <span>Protection Séquestre AgriMarché</span>
              </div>
            </div>

            <div className="payment-steps-visual">
              <div className={`step-dot ${status !== 'idle' ? 'active' : ''}`}><CheckCircle size={16} /></div>
              <div className="step-line" />
              <div className={`step-dot ${status === 'ussd' || status === 'success' ? 'active' : ''}`}><Smartphone size={16} /></div>
              <div className="step-line" />
              <div className={`step-dot ${status === 'success' ? 'active' : ''}`}><CheckCircle size={16} /></div>
            </div>
          </div>

          {/* Section Action / Formulaire */}
          <div className="payment-action-card">
            {status === "idle" && (
              <div className="payment-methods-form animate-slide-up">
                <section className="wallet-status-section">
                  <div className="wallet-header">
                    <Wallet size={20} />
                    <h3>Votre Portefeuille</h3>
                  </div>
                  <div className="wallet-balance-row">
                    <span>Solde actuel</span>
                    <span className="balance-value">{(walletBalance ?? 0).toLocaleString()} FCFA</span>
                  </div>
                </section>

                {loadingBalance ? (
                  <div className="loading-state">
                    <Loader2 size={32} className="spinner" />
                    <span>Vérification du solde...</span>
                  </div>
                ) : (walletBalance || 0) >= order.total_price ? (
                  <div className="payment-ready-zone">
                    <div className="success-alert">
                      <CheckCircle size={20} />
                      <p>Votre solde est suffisant. Le paiement sera instantané.</p>
                    </div>
                    <button className="confirm-pay-btn" onClick={handlePay}>
                      Confirmer le paiement
                      <ArrowRight size={20} />
                    </button>
                  </div>
                ) : (
                  <div className="recharge-pay-form">
                    <div className="warning-alert">
                      <Info size={18} />
                      <p>Recharge requise de <strong>{(order.total_price - (walletBalance || 0)).toLocaleString()} FCFA</strong></p>
                    </div>

                    <div className="momo-selector">
                      <label>Sélectionnez votre opérateur</label>
                      <div className="operator-grid">
                        <button
                          className={`op-btn momo ${rechargeMethod === 'momo' ? 'active' : ''}`}
                          onClick={() => setRechargeMethod('momo')}
                        >MTN MoMo</button>
                        <button
                          className={`op-btn orange ${rechargeMethod === 'orange' ? 'active' : ''}`}
                          onClick={() => setRechargeMethod('orange')}
                        >Orange Money</button>
                      </div>
                    </div>

                    <div className="phone-input-group">
                      <label>Numéro de téléphone ({rechargeMethod === 'momo' ? 'MTN' : 'Orange'})</label>
                      <div className="input-box">
                        <Smartphone size={20} />
                        <input
                          type="tel"
                          placeholder="Ex: 6XXXXXXXX"
                          value={rechargePhone}
                          onChange={(e) => setRechargePhone(e.target.value)}
                        />
                      </div>
                    </div>

                    <button className="confirm-pay-btn recharge" onClick={handlePay}>
                      Recharger & Payer
                      <ArrowRight size={20} />
                    </button>
                  </div>
                )}
              </div>
            )}

            {status === "ussd" && (
              <div className="ussd-simulation-window animate-pulse">
                <div className="phone-mocker">
                  <div className="ussd-popup">
                    <Lock size={32} />
                    <h4>Validation {rechargeMethod === 'momo' ? 'MTN' : 'Orange'}</h4>
                    <p>Veuillez confirmer la transaction sur votre téléphone en saisissant votre code secret.</p>
                    <div className="ussd-progress">
                      <div className="bar"></div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {status === "waiting" && (
              <div className="waiting-full-view">
                <div className="loader-container-big">
                  <div className="circle-loader-outer"></div>
                  <Loader2 size={48} className="spinner-center" />
                </div>
                <h3>Traitement en cours...</h3>
                <p>Nous validons votre transaction avec le réseau opérateur.</p>
              </div>
            )}

            {status === "success" && (
              <div className="payment-success-outcome animate-bounce-in">
                <div className="success-icon-bg">
                  <CheckCircle size={64} color="white" fill="var(--primary)" />
                </div>
                <h2>Paiement Réussi !</h2>
                <div className="success-recap">
                  <div className="row">
                    <span>Transaction ID</span>
                    <strong>#{order.id}</strong>
                  </div>
                  <div className="row">
                    <span>Montant payé</span>
                    <strong>{order.total_price?.toLocaleString()} FCFA</strong>
                  </div>
                </div>
                <button className="go-back-btn" onClick={() => navigate(`/order/tracking/${order.id}`)}>
                  Suivre ma commande
                </button>
              </div>
            )}

            {status === "error" && (
              <div className="payment-error-outcome animate-shake">
                <div className="error-icon-bg">
                  <AlertCircle size={64} color="#e53e3e" />
                </div>
                <h2>Erreur de paiement</h2>
                <p>{errorMessage}</p>
                <button className="retry-btn" onClick={() => setStatus("idle")}>
                  <RefreshCw size={18} />
                  Réessayer
                </button>
              </div>
            )}
          </div>
        </div>
      </main>

      <footer className="payment-footer">
        <ShieldCheck size={18} />
        <span>Paiement protégé par le système de séquestre AgriMarché</span>
      </footer>
    </div>
  );
}
