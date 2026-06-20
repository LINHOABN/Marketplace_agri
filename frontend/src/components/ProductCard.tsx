import { useState } from "react";
import { MessageCircle, Heart, MapPin, Trash2, Flag, Pencil } from "lucide-react";
import { useNavigate } from "react-router-dom";
import api from "../api";
import { API_URL } from "../config";
import { useUser } from "../hooks/useUser";
import toast from "react-hot-toast";
import ConfirmModal from "./ConfirmModal";
import ReportModal from "./ReportModal";
import "./ProductCard.css";

interface ProductCardProps {
  product: {
    id: string;
    name: string;
    price: number;
    image: string;
    sellerName: string;
    seller_id?: string;
    shop_id?: string;
    distanceKm: number;
    likes: number;
    isNew: boolean;
  };
  onDeleted?: (id: string) => void;
}

export default function ProductCard({ product, onDeleted }: ProductCardProps) {
  const navigate = useNavigate();
  const { currentUser } = useUser();
  const [isLiked, setIsLiked] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);

  const userRole = currentUser?.role?.toLowerCase();

  // isOwnProduct: TRUE uniquement si le produit appartient AU compte connecté
  const isOwnProduct = !!(
    currentUser &&
    currentUser.id &&
    product.seller_id &&
    String(currentUser.id) === String(product.seller_id)
  );

  // isSeller = true SEULEMENT si c'est son propre produit (pas pour tout vendeur)
  const isSeller = isOwnProduct;
  const isDeliverer = userRole === "deliverer";

  const getImageUrl = (url: string) => {
    if (!url) return "https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=600";
    if (url.startsWith("http")) return url;
    return `${API_URL}${url}`;
  };

  const isVideoUrl = (url: string) => {
    if (!url) return false;
    const ext = url.split("?")[0].split(".").pop()?.toLowerCase();
    return ["mp4", "webm", "ogg", "mov", "avi"].includes(ext || "");
  };

  const handleLike = () => {
    setIsLiked(!isLiked);
  };

  const handleStartChat = async () => {
    const token =
      sessionStorage.getItem("access_token") || localStorage.getItem("access_token");
    if (!token) {
      toast.error("Connectez-vous pour discuter avec le vendeur.");
      navigate("/login");
      return;
    }
    if (!product.seller_id) {
      toast.error("Impossible de trouver le vendeur de ce produit.");
      return;
    }
    const loadingToast = toast.loading("Ouverture de la discussion...");
    try {
      const res = await api.post("/chat/conversations", {
        product_id: product.id,
        seller_id: product.seller_id,
      });
      const chatId = res.data?.id;
      if (!chatId) {
        toast.dismiss(loadingToast);
        toast.error("Conversation créée mais identifiant manquant.");
        return;
      }
      toast.dismiss(loadingToast);
      navigate("/conversations", { state: { openChatId: String(chatId) } });
    } catch (err: any) {
      toast.dismiss(loadingToast);
      const detail = err?.response?.data?.detail || "Erreur lors de la création de la conversation";
      toast.error(typeof detail === "string" ? detail : "Impossible de créer la conversation.");
    }
  };

  const openProduct = () => navigate(`/product/${product.id}`);

  const handleDelete = async () => {
    try {
      await api.delete(`/products/${product.id}`);
      toast.success("Produit supprimé avec succès !");
      if (onDeleted) onDeleted(product.id);
      else window.location.reload();
    } catch {
      toast.error("Erreur lors de la suppression du produit.");
    }
  };

  return (
    <>
      <ConfirmModal
        isOpen={showDeleteConfirm}
        title="Supprimer ce produit ?"
        message={`Êtes-vous sûr de vouloir supprimer "${product.name}" ? Cette action est irréversible.`}
        confirmText="Oui, supprimer"
        type="danger"
        onConfirm={() => { setShowDeleteConfirm(false); handleDelete(); }}
        onCancel={() => setShowDeleteConfirm(false)}
      />
      <ReportModal
        isOpen={showReportModal}
        targetId={product.id}
        targetType="product"
        onClose={() => setShowReportModal(false)}
      />

      <div className="product-card">
        <div
          className="product-image-container product-card-clickable"
          role="button"
          tabIndex={0}
          onClick={openProduct}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openProduct(); } }}
        >
          {product.isNew && <span className="badge-new">NOUVEAU</span>}
          {isOwnProduct && <span className="badge-own">MA PUBLICATION</span>}
          <button className="like-btn" onClick={(e) => { e.stopPropagation(); handleLike(); }}>
            <Heart size={20} fill={isLiked ? "#D32F2F" : "none"} color={isLiked ? "#D32F2F" : "#1A1A1A"} />
          </button>

          {!isSeller && (
            <button
              className="report-btn"
              title="Signaler ce produit"
              onClick={(e) => { e.stopPropagation(); setShowReportModal(true); }}
              style={{ position: "absolute", top: 44, right: 10, background: "rgba(255,255,255,0.9)", border: "none", borderRadius: "50%", width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", boxShadow: "0 2px 6px rgba(0,0,0,0.15)" }}
            >
              <Flag size={16} color="#e53e3e" />
            </button>
          )}

          {isVideoUrl(product.image) ? (
            <video
              src={getImageUrl(product.image)}
              className="product-image"
              controls
              muted
              playsInline
              style={{ background: "#000", objectFit: "cover" }}
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <img src={getImageUrl(product.image)} alt={product.name} className="product-image" loading="lazy" />
          )}
        </div>

        <div className="product-info">
          <div className="product-header">
            <h3
              className="product-title product-card-clickable"
              role="button"
              tabIndex={0}
              onClick={openProduct}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openProduct(); } }}
            >
              {product.name}
            </h3>
            <span className="product-price">{product.price.toLocaleString("fr-FR")} FCFA</span>
          </div>

          <div className="seller-info" style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '4px' }}>
            <span>
              Par {isSeller ? (
                <strong style={{ color: "var(--primary)" }}>Vous</strong>
              ) : (
                <button
                  type="button"
                  className="seller-link-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    const shopTarget = product.shop_id || product.seller_id;
                    if (shopTarget) navigate(`/shop/${shopTarget}`);
                  }}
                  style={{
                    background: "none",
                    border: "none",
                    padding: 0,
                    color: "var(--primary)",
                    fontWeight: 700,
                    cursor: "pointer",
                    textDecoration: "underline",
                  }}
                >
                  {product.sellerName || (product as any).shop_name || "Vendeur"}
                </button>
              )}
            </span>
            {(product as any).seller_role && (
              <span className={`post-role-tag ${(product as any).seller_role}`} style={{ fontSize: '9px', padding: '1px 4px' }}>
                {(product as any).seller_role === "seller" ? "Vendeur" : (product as any).seller_role === "deliverer" ? "Livreur" : ""}
              </span>
            )}
            <span></span>
            <div className="distance-badge">
              <MapPin size={12} />
              <span>{product.distanceKm || 0} km</span>
            </div>
          </div>

          <div className="product-actions">
            {isSeller ? (
              <div style={{ display: "flex", gap: 8, width: "100%" }}>
                <button
                  className="btn-buy"
                  style={{ flex: 1, backgroundColor: "var(--primary)", borderColor: "var(--primary)" }}
                  onClick={() => navigate(`/product/edit/${product.id}`)}
                >
                  <Pencil size={15} style={{ marginRight: 4 }} />
                  Gérer ma publication
                </button>
                <button
                  className="btn-chat"
                  style={{ backgroundColor: "#fee2e2", borderColor: "#fee2e2", color: "#e53e3e" }}
                  onClick={() => setShowDeleteConfirm(true)}
                  title="Supprimer ce produit"
                >
                  <Trash2 size={17} />
                </button>
              </div>
            ) : currentUser?.role === "admin" ? (
              <div style={{ width: "100%", textAlign: "center", color: "var(--primary)", fontWeight: 700, fontSize: "12px", padding: "6px", background: "rgba(46,125,50,0.1)", borderRadius: "6px" }}>
                Mode Admin : Liste consultable
              </div>
            ) : isDeliverer ? (
              <div style={{ width: "100%", textAlign: "center", color: "var(--primary)", fontWeight: 700, fontSize: "12px", padding: "6px", background: "rgba(46,125,50,0.1)", borderRadius: "6px" }}>
                Mode Livreur : Achat désactivé
              </div>
            ) : (
              <>
                <button className="btn-buy" onClick={() => navigate(`/product/${product.id}`)}>
                  Acheter maintenant
                </button>
                <button className="btn-chat" onClick={handleStartChat}>
                  <MessageCircle size={18} />
                  Discuter
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
