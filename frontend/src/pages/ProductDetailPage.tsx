import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../api";
import {
  Star,
  ChevronLeft,
  ChevronRight,
  MessageCircle,
  ShoppingBag,
  BadgeCheck,
  Share2,
  X,
  Clock,
  ShieldCheck,
  Pencil,
} from "lucide-react";
import ProductCard from "../components/ProductCard";
import { toast } from "react-hot-toast";
import { API_URL } from "../config";
import { useUser } from "../hooks/useUser";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Correction des icônes Leaflet par défaut
const DefaultIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});
L.Marker.prototype.options.icon = DefaultIcon;
import "./ProductDetailPage.css";

export default function ProductDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currentUser, getInitials } = useUser();
  const [product, setProduct] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeSlide, setActiveSlide] = useState(0);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [similarProducts, setSimilarProducts] = useState<any[]>([]);

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        const res = await api.get(`/products/${id}`);
        setProduct(res.data);

        // Charger les produits similaires
        const simRes = await api.get(`/products/${id}/similar`);
        setSimilarProducts(simRes.data);
      } catch (err) {
        console.error("Erreur chargement produit ou similaires");
      } finally {
        setLoading(false);
      }
    };
    fetchProduct();
    window.scrollTo(0, 0); // Revenir en haut quand on change de produit
  }, [id]);

  const handleStartChat = async () => {
    const token = sessionStorage.getItem("access_token") || localStorage.getItem("access_token");
    if (!token) {
      navigate("/login");
      return;
    }
    const sellerId = product.seller_id || product.vendor_id;
    if (!sellerId) {
      toast.error("Vendeur introuvable pour ce produit.");
      return;
    }
    const loadingToast = toast.loading("Ouverture de la discussion...");
    try {
      const res = await api.post("/chat/conversations", {
        product_id: product.id,
        seller_id: sellerId,
      });
      const chatId = res.data?.id;
      toast.dismiss(loadingToast);
      navigate("/conversations", { state: { openChatId: String(chatId) } });
    } catch (err: any) {
      toast.dismiss(loadingToast);
      const detail = err?.response?.data?.detail;
      toast.error(typeof detail === "string" ? detail : "Impossible de créer la conversation.");
    }
  };

  const handleNegotiate = async () => {
    const token = sessionStorage.getItem("access_token") || localStorage.getItem("access_token");
    if (!token) {
      navigate("/login");
      return;
    }
    const sellerId = product.seller_id || product.vendor_id;
    const loadingToast = toast.loading("Ouverture de la négociation...");
    try {
      const res = await api.post("/chat/conversations", {
        product_id: product.id,
        seller_id: sellerId,
      });
      const chatId = res.data?.id;
      toast.dismiss(loadingToast);
      navigate("/conversations", { state: { openChatId: String(chatId), startNegotiation: true } });
    } catch (err) {
      toast.dismiss(loadingToast);
      toast.error("Impossible d'ouvrir la négociation.");
    }
  };

  const formatUrl = (url: string) => {
    if (!url) return "https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=800";
    if (url.startsWith("http")) return url;
    return `${API_URL}${url}`;
  };

  if (loading)
    return (
      <div className="loader-container dashboard-wrapper" style={{ padding: "100px", textAlign: "center", display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p>Chargement des détails...</p>
      </div>
    );
  if (!product)
    return (
      <div className="loader-container dashboard-wrapper" style={{ padding: "100px", textAlign: "center" }}>
        Produit introuvable.
      </div>
    );

  const medias =
    product.media_urls?.length > 0
      ? product.media_urls.map(formatUrl)
      : [formatUrl(product.image_url)];

  const isVideoUrl = (url: string) => {
    if (!url) return false;
    const ext = url.split("?")[0].split(".").pop()?.toLowerCase();
    return ["mp4", "webm", "ogg", "mov", "avi"].includes(ext || "");
  };

  const isSeller = !!(currentUser && currentUser.id && product &&
    (String(currentUser.id) === String(product.seller_id) ||
      String(currentUser.id) === String(product.vendor_id)));

  return (
    <div className="product-detail-wrapper dashboard-wrapper">
      {isLightboxOpen && (
        <div className="lightbox-overlay" onClick={() => setIsLightboxOpen(false)}>
          <button className="lightbox-close"><X size={32} /></button>
          <div className="lightbox-content" onClick={(e) => e.stopPropagation()}>
            {isVideoUrl(medias[activeSlide]) ? (
              <video src={medias[activeSlide]} controls autoPlay className="lightbox-media" />
            ) : (
              <img src={medias[activeSlide]} className="lightbox-media" alt="Full view" />
            )}
          </div>
        </div>
      )}

      <div className="detail-top-nav">
        <button className="nav-back-inner" onClick={() => navigate(-1)}>
          <ChevronLeft size={24} />
        </button>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button className="nav-share-inner" onClick={() => {
            navigator.share?.({ title: product.name, url: window.location.href });
          }}>
            <Share2 size={24} />
          </button>
        </div>
      </div>

      <div className="product-split-layout dashboard-content">
        <div className="product-gallery-side">
          <div className="gallery-container">
            <div className="gallery-main-view" onClick={() => setIsLightboxOpen(true)}>
              <div className="gallery-carousel" style={{ transform: `translateX(-${activeSlide * 100}%)` }}>
                {medias.map((url: string, idx: number) => (
                  <div key={idx} className="gallery-item-wrapper">
                    {isVideoUrl(url) ? (
                      <video src={url} className="gallery-item" controls muted playsInline />
                    ) : (
                      <img src={url} className="gallery-item" alt="Product" />
                    )}
                  </div>
                ))}
              </div>

              {medias.length > 1 && (
                <>
                  <button
                    className="nav-arrow left"
                    onClick={(e) => { e.stopPropagation(); setActiveSlide(prev => prev > 0 ? prev - 1 : medias.length - 1); }}
                  >
                    <ChevronLeft size={24} />
                  </button>
                  <button
                    className="nav-arrow right"
                    onClick={(e) => { e.stopPropagation(); setActiveSlide(prev => prev < medias.length - 1 ? prev + 1 : 0); }}
                  >
                    <ChevronRight size={24} />
                  </button>
                </>
              )}
            </div>

            {medias.length > 1 && (
              <div className="thumbnails-row">
                {medias.map((url: string, idx: number) => (
                  <div
                    key={idx}
                    className={`thumb-item ${idx === activeSlide ? "active" : ""}`}
                    onClick={() => setActiveSlide(idx)}
                  >
                    {isVideoUrl(url) ? (
                      <div className="thumb-video-placeholder"><ShoppingBag size={14} /></div>
                    ) : (
                      <img src={url} alt="thumbnail" />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="product-info-side">
          <div className="detail-content">
            <div className="detail-category">
              {product.category_name || "PRODUITS FERMIERS"}
            </div>
            <h1 className="detail-title">
              {product.name.replace(/\.(jpg|jpeg|png|webp|mp4|mov)$/i, "").replace(/_/g, " ")}
            </h1>

            <div className="rating-row">
              <div className="stars">
                {[...Array(5)].map((_, i) => {
                  const ratingVal = product.average_rating ? parseFloat(product.average_rating) : 0;
                  return (
                    <Star
                      key={i}
                      size={16}
                      fill={i < Math.round(ratingVal) ? "var(--secondary)" : "none"}
                      color="var(--secondary)"
                    />
                  );
                })}
              </div>
              <span className="reviews-count">
                ({product.reviews_count !== undefined ? product.reviews_count : 0} avis)
              </span>
            </div>

            <div className="detail-price-row">
              <span className="detail-price">{product.price?.toLocaleString()} FCFA</span>
              <span className="detail-unit">/ {product.unit || "unit"}</span>
            </div>

            <div className="dashboard-section detail-description">
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Clock size={18} color="var(--primary)" /> Détails du produit
              </h3>
              <p>{product.description || "Aucune description fournie pour ce produit."}</p>
              <div style={{ display: 'flex', gap: '20px', marginTop: '1.5rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
                <div>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block' }}>Stock Disponible</span>
                  <strong style={{ fontSize: '15px' }}>{product.quantity_available} {product.unit}</strong>
                </div>
                <div>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block' }}>Localisation</span>
                  <strong style={{ fontSize: '15px' }}>{product.city || ""}</strong>
                </div>
              </div>
            </div>

            <div className="seller-card">
              {product.vendor_avatar ? (
                <img src={product.vendor_avatar.startsWith("http") ? product.vendor_avatar : `${API_URL}${product.vendor_avatar}`} className="seller-avatar" alt="Seller" />
              ) : (
                <div className="sidebar-avatar-initials" style={{ width: "56px", height: "56px", fontSize: "20px", background: 'var(--primary)', color: 'white' }}>
                  {getInitials(product.vendor_name || product.seller_name || "V")}
                </div>
              )}
              <div className="seller-info-content">
                <div style={{ display: "flex", alignItems: "center", gap: "6px", fontWeight: 800, fontSize: "16px" }}>
                  {product.vendor_name || product.seller_name || "Vendeur agrimarche"}{" "}
                  {product.vendor_is_verified && <BadgeCheck size={18} color="#2E7D32" fill="#E8F5E9" />}
                </div>
                <div style={{ fontSize: "12px", color: "#666" }}>
                  Membre vérifié {product.shop_name ? `• Boutique ${product.shop_name}` : ""}
                </div>
              </div>
              <button className="btn-visit-shop" onClick={() => navigate(`/shop/${product.shop_id}`)}>
                Visiter
              </button>
            </div>

            <div className="map-section" style={{ marginTop: '1rem' }}>
              <h4 style={{ marginBottom: '10px', fontSize: '14px', fontWeight: 800 }}>Emplacement du stock</h4>
              <div className="map-wrapper" style={{ height: "200px", width: "100%", borderRadius: "12px", overflow: "hidden", border: '1px solid var(--border-color)' }}>
                <MapContainer
                  center={[product.latitude || 4.0511, product.longitude || 9.7679]}
                  zoom={12}
                  scrollWheelZoom={false}
                  style={{ height: "100%", width: "100%" }}
                >
                  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                  <Marker position={[product.latitude || 4.0511, product.longitude || 9.7679]}>
                    <Popup>{product.name}</Popup>
                  </Marker>
                </MapContainer>
              </div>
            </div>

            <div className="fixed-actions">
              {isSeller ? (
                <button
                  className="btn-buy-detail"
                  style={{ width: "100%", backgroundColor: "var(--text-muted)" }}
                  onClick={() => navigate(`/product/edit/${product.id}`)}
                >
                  <Pencil size={20} style={{ marginRight: "10px" }} />
                  Modifier ce produit
                </button>
              ) : currentUser?.role === "admin" ? (
                <div style={{ width: "100%", textAlign: "center", color: "var(--primary)", fontWeight: 800, padding: "10px", background: "rgba(46,125,50,0.1)", borderRadius: "8px" }}>
                  Mode Administrateur : Liste consultable uniquement
                </div>
              ) : currentUser?.role === "deliverer" ? (
                <div style={{ width: "100%", textAlign: "center", color: "var(--primary)", fontWeight: 800, padding: "10px", background: "rgba(46,125,50,0.1)", borderRadius: "8px" }}>
                  Mode Livreur : Achat désactivé
                </div>
              ) : (
                <>
                  <button className="btn btn-icon btn-chat-detail" onClick={handleStartChat}>
                    <MessageCircle size={22} />
                    <span>Discuter</span>
                  </button>
                  <button className="btn btn-icon btn-negotiate-detail" onClick={handleNegotiate} style={{ background: 'rgba(245, 158, 11, 0.1)', color: '#D97706', border: '1px solid rgba(245, 158, 11, 0.3)' }}>
                    <Share2 size={22} style={{ transform: 'rotate(-45deg)' }} />
                    <span>Négocier</span>
                  </button>
                  <button
                    className="btn btn-primary btn-buy-detail"
                    disabled={product.quantity_available <= 0}
                    onClick={() => navigate(`/order/create/${product.id}`, { state: { product } })}
                  >
                    <ShoppingBag size={22} style={{ marginRight: "10px" }} />
                    Acheter maintenant
                  </button>
                </>
              )}
            </div>

            <div style={{ padding: '1.5rem', background: 'rgba(46, 125, 50, 0.05)', borderRadius: '12px', display: 'flex', gap: '12px', marginTop: '1rem' }}>
              <ShieldCheck color="var(--primary)" size={24} />
              <div>
                <h5 style={{ margin: 0, fontWeight: 800, fontSize: '14px' }}>Garanti agrimarche</h5>
                <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)' }}>Votre paiement est sécurisé jusqu'à la réception de la marchandise.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {similarProducts.length > 0 && (
        <div className="dashboard-content" style={{ marginTop: '2rem', paddingBottom: '100px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 900, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <ShoppingBag size={24} color="var(--primary)" />
            Produits similaires
          </h2>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: '20px'
          }}>
            {similarProducts.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
