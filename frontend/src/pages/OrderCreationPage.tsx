import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import api from "../api";
import {
  ChevronLeft,
  MapPin,
  Smartphone,
  Wallet,
  Store,
  Truck,
  Info,
  ShieldCheck,
  ArrowRight,
  CheckCircle
} from "lucide-react";
import { useUser } from "../hooks/useUser";
import { useGeolocation } from "../hooks/useGeolocation";
import LocationPickerModal from "../components/LocationPickerModal";
import { Navigation } from "lucide-react";
import toast from "react-hot-toast";
import "./OrderCreationPage.css";

export default function OrderCreationPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { getAvatarSrc } = useUser();
  const [product] = useState<any>(location.state?.product || null);

  useEffect(() => {
    console.log("[DEBUG] OrderCreationPage location.state:", location.state);
    console.log("[DEBUG] OrderCreationPage product:", product);
  }, [location.state, product]);

  // Rediriger si aucun produit n'est passé
  useEffect(() => {
    if (!product) {
      navigate("/feed", { replace: true });
    }
  }, [product, navigate]);

  const [quantity, setQuantity] = useState(location.state?.negotiatedQuantity || 1);
  const [deliveryType, setDeliveryType] = useState<"pickup" | "delivery">(
    "pickup",
  );
  const [address, setAddress] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<
    "momo" | "orange" | "wallet"
  >("wallet");
  const [loading, setLoading] = useState(false);
  const [walletBalance, setWalletBalance] = useState(0);
  const [selectedCoords, setSelectedCoords] = useState<[number, number] | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const currPos = useGeolocation();

  useEffect(() => {
    const fetchWalletBalance = async () => {
      try {
        const res = await api.get("/wallet/");
        setWalletBalance(res.data.balance || 0);
      } catch (err) {
        console.error("Failed to fetch wallet balance", err);
      }
    };
    fetchWalletBalance();
  }, []);

  // Calculs financiers
  if (!product) return null;

  const subtotal = (product.price || 0) * quantity;
  const deliveryFee = deliveryType === "delivery" ? 2000 : 0;
  const commission = Math.round(subtotal * 0.03); // 3% commission
  const total = subtotal + deliveryFee + commission;

  const isWalletInsufficient =
    paymentMethod === "wallet" && walletBalance < total;

  const handleConfirmOrder = async () => {
    setLoading(true);
    try {
      const res = await api.post(
        "/orders/create",
        {
          product_id: product.id,
          quantity,
          delivery_address:
            deliveryType === "delivery" ? address : "Retrait vendeur",
          payment_method: paymentMethod,
          total_amount: total,
          delivery_lat: selectedCoords ? selectedCoords[0] : null,
          delivery_lng: selectedCoords ? selectedCoords[1] : null,
        }
      );

      // Redirige vers le paiement sécurisé
      navigate(`/payment/${res.data.id}`, {
        state: {
          order: {
            id: res.data.id,
            total_price: total,
            method: paymentMethod,
          }
        }
      });
    } catch (err: any) {
      console.error(err);
      const detail = err.response?.data?.detail || "Veuillez vérifier vos informations.";
      toast.error(`Erreur : ${detail}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="order-creation-page-container dashboard-wrapper">
      <header className="order-header-main dashboard-header">
        <button onClick={() => navigate(-1)} className="back-btn-round">
          <ChevronLeft size={22} />
        </button>
        <h1>Finaliser ma commande</h1>
        <div style={{ width: 40 }} />
      </header>

      {showPicker && (
        <LocationPickerModal
          initialPos={selectedCoords || (currPos ? [currPos.lat, currPos.lng] : null)}
          onClose={() => setShowPicker(false)}
          onSelect={(pos) => {
            setSelectedCoords(pos);
            setShowPicker(false);
            if (!address) setAddress("Position sélectionnée sur la carte");
            toast.success("Position de livraison enregistrée !");
          }}
        />
      )}

      <main className="order-main-content dashboard-content">
        <div className="order-grid">
          {/* Left Column: Form */}
          <div className="order-form-column">
            {/* 1. Produit Sélectionné */}
            <section className="order-step-card">
              <div className="step-header">
                <div className="step-number">1</div>
                <h3>Récapitulatif produit</h3>
              </div>
              <div className="order-product-details-card">
                <div className="product-img-box">
                  <img src={getAvatarSrc(product.image) || product.image_url} alt={product.name} />
                </div>
                <div className="product-info-box">
                  <h4>{product.name}</h4>
                  <p className="price-tag">
                    {product.price?.toLocaleString() || '0'} FCFA <small>/ {product.unit || 'unité'}</small>
                    {product.isNegotiated && (
                      <span className="negotiated-tag" style={{ marginLeft: '10px', fontSize: '10px', background: 'rgba(217, 119, 6, 0.1)', color: '#D97706', padding: '2px 6px', borderRadius: '4px', verticalAlign: 'middle', fontWeight: 800 }}>
                        ACHETÉ AU PRIX NÉGOCIÉ {product.originalPrice && product.originalPrice !== product.price && `(Initial: ${product.originalPrice.toLocaleString()} FCFA)`}
                      </span>
                    )}
                  </p>

                  <div className="quantity-picker">
                    <button
                      className="qty-btn"
                      onClick={() => setQuantity(Math.max(1, quantity - 1))}
                      disabled={quantity <= 1}
                    >-</button>
                    <span className="qty-value">{quantity}</span>
                    <button
                      className="qty-btn"
                      onClick={() => setQuantity(Math.min(product.stock || 99, quantity + 1))}
                      disabled={quantity >= (product.stock || 99)}
                    >+</button>
                    <span className="stock-hint">{product.stock || 0} en stock</span>
                  </div>
                </div>
              </div>
            </section>

            {/* 2. Mode de réception */}
            <section className="order-step-card">
              <div className="step-header">
                <div className="step-number">2</div>
                <h3>Mode de réception</h3>
              </div>
              <div className="delivery-options-grid">
                <div
                  className={`delivery-option-box ${deliveryType === 'pickup' ? 'selected' : ''}`}
                  onClick={() => setDeliveryType('pickup')}
                >
                  <div className="option-icon"><Store size={24} /></div>
                  <div className="option-text">
                    <span className="title">Point de retrait</span>
                    <span className="desc">Gratuit chez le vendeur</span>
                  </div>
                  {deliveryType === 'pickup' && <CheckCircle size={18} className="check-icon" />}
                </div>

                <div
                  className={`delivery-option-box ${deliveryType === 'delivery' ? 'selected' : ''}`}
                  onClick={() => setDeliveryType('delivery')}
                >
                  <div className="option-icon"><Truck size={24} /></div>
                  <div className="option-text">
                    <span className="title">Livraison Express</span>
                    <span className="desc">+2,000 FCFA à domicile</span>
                  </div>
                  {deliveryType === 'delivery' && <CheckCircle size={18} className="check-icon" />}
                </div>
              </div>

              {deliveryType === "delivery" && (
                <div className="address-input-wrapper animate-fade-in">
                  <label>Adresse de livraison exacte <span style={{ color: 'red' }}>*</span></label>
                  <div className="input-with-icon">
                    <MapPin size={18} />
                    <input
                      type="text"
                      placeholder="Ex: Yaoundé, Quartier Bastos, Rue 1.025"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                    />
                  </div>

                  <div style={{ marginTop: '10px', display: 'flex', gap: '10px' }}>
                    <button
                      className="btn btn-secondary"
                      style={{ flex: 1, fontSize: '12px', padding: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                      onClick={() => {
                        if (currPos) {
                          setSelectedCoords([currPos.lat, currPos.lng]);
                          setAddress("Ma position actuelle");
                          toast.success("Position GPS actuelle utilisée");
                        } else {
                          toast.error("GPS non disponible. Veuillez choisir sur la carte.");
                        }
                      }}
                    >
                      <Navigation size={14} /> Ma position GPS
                    </button>
                    <button
                      className="btn btn-secondary"
                      style={{ flex: 1, fontSize: '12px', padding: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                      onClick={() => setShowPicker(true)}
                    >
                      <MapPin size={14} /> Choisir sur la carte
                    </button>
                  </div>
                  {selectedCoords && (
                    <p style={{ margin: '8px 0 0', fontSize: '11px', color: 'var(--primary)', fontWeight: 800 }}>
                      ✅ Coordonnées enregistrées : {selectedCoords[0].toFixed(4)}, {selectedCoords[1].toFixed(4)}
                    </p>
                  )}
                </div>
              )}
            </section>

            {/* 3. Mode de paiement */}
            <section className="order-step-card">
              <div className="step-header">
                <div className="step-number">3</div>
                <h3>Mode de paiement sécurisé</h3>
              </div>

              <div className="payment-stack-premium">
                {/* Portefeuille */}
                <div
                  className={`payment-method-item ${paymentMethod === 'wallet' ? 'selected' : ''}`}
                  onClick={() => setPaymentMethod('wallet')}
                >
                  <div className="method-icon wallet"><Wallet size={20} /></div>
                  <div className="method-info">
                    <span className="method-name">Portefeuille AgriMarché</span>
                    <span className={`method-balance ${walletBalance < total ? 'low' : ''}`}>
                      Solde actuel: {walletBalance.toLocaleString()} FCFA
                    </span>
                  </div>
                  <div className="radio-circle"></div>
                </div>

                {/* MoMo */}
                <div
                  className={`payment-method-item ${paymentMethod === 'momo' ? 'selected' : ''}`}
                  onClick={() => setPaymentMethod('momo')}
                >
                  <div className="method-icon momo"><Smartphone size={20} /></div>
                  <div className="method-info">
                    <span className="method-name">MTN Mobile Money</span>
                    <span className="method-desc">Recharger & Payer instantanément</span>
                  </div>
                  <div className="radio-circle"></div>
                </div>

                {/* Orange */}
                <div
                  className={`payment-method-item ${paymentMethod === 'orange' ? 'selected' : ''}`}
                  onClick={() => setPaymentMethod('orange')}
                >
                  <div className="method-icon orange"><Smartphone size={20} /></div>
                  <div className="method-info">
                    <span className="method-name">Orange Money</span>
                    <span className="method-desc">Recharger & Payer instantanément</span>
                  </div>
                  <div className="radio-circle"></div>
                </div>
              </div>

              {isWalletInsufficient && (
                <div className="insufficient-balance-alert">
                  <Info size={18} />
                  <div>
                    <p><strong>Solde insuffisant</strong></p>
                    <span>Il vous manque {(total - walletBalance).toLocaleString()} FCFA. Vous pourrez recharger le reste à l'étape suivante.</span>
                  </div>
                </div>
              )}
            </section>
          </div>

          {/* Right Column: Recap & Sticky Summary */}
          <div className="order-recap-column">
            <div className="recap-sticky-card">
              <h3>Résumé de la commande</h3>

              <div className="recap-lines">
                <div className="recap-line">
                  <span>Sous-total ({quantity} art.)</span>
                  <span>{subtotal.toLocaleString()} FCFA</span>
                </div>
                <div className="recap-line">
                  <span>Frais de livraison</span>
                  <span>{deliveryFee === 0 ? 'Gratuit' : `${deliveryFee.toLocaleString()} FCFA`}</span>
                </div>
                <div className="recap-line">
                  <span className="with-info">
                    Commission service <Info size={12} />
                  </span>
                  <span>{commission.toLocaleString()} FCFA</span>
                </div>

                <div className="recap-divider" />

                <div className="recap-line total">
                  <span>Total à payer</span>
                  <span>{total.toLocaleString()} FCFA</span>
                </div>
              </div>

              <button
                className="btn-place-order"
                disabled={loading}
                onClick={() => {
                  if (deliveryType === 'delivery' && !address.trim()) {
                    toast.error("Veuillez saisir votre adresse de livraison exacte.");
                    return;
                  }
                  handleConfirmOrder();
                }}
              >
                {loading ? "Traitement..." : product.isNegotiated ? "Acheter au prix négocié" : "Procéder au paiement"}
                {!loading && <ArrowRight size={20} />}
              </button>

              <div className="security-guarantee">
                <ShieldCheck size={20} />
                <p>Paiement sécurisé par Séquestre AgriMarché. Le vendeur ne reçoit les fonds qu'après votre validation.</p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
