import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "react-hot-toast";
import { ChevronLeft, Star } from "lucide-react";
import api from "../api";
import { useUser } from "../context/UserContext";

type ReviewLocationState = {
  orderId?: string;
};

type OrderResponse = {
  product_id?: string;
  product_name?: string;
};

type ProductReview = {
  id: string;
  rating: number;
  comment?: string | null;
  created_at?: string;
  user_id: string;
  author_name?: string;
};

export default function ReviewPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser } = useUser();

  const orderId = (location.state as ReviewLocationState | null)?.orderId;

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [order, setOrder] = useState<OrderResponse | null>(null);
  const productId = order?.product_id ? String(order.product_id) : null;

  const [reviews, setReviews] = useState<ProductReview[]>([]);
  const myReview = useMemo(() => {
    if (!currentUser?.id) return null;
    return reviews.find((r) => String(r.user_id) === String(currentUser.id)) || null;
  }, [reviews, currentUser?.id]);

  const [rating, setRating] = useState<number>(0);
  const [comment, setComment] = useState("");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        if (!orderId) {
          setError("Identifiant de commande manquant.");
          return;
        }

        const orderRes = await api.get(`/orders/${orderId}`);
        setOrder(orderRes.data as OrderResponse);

        const pId = orderRes.data?.product_id ? String(orderRes.data.product_id) : null;
        if (!pId) return;

        const reviewsRes = await api.get(`/products/${pId}/reviews`);
        const list = (Array.isArray(reviewsRes.data) ? reviewsRes.data : []) as ProductReview[];
        setReviews(list);

        const existing = list.find((r) => String(r.user_id) === String(currentUser?.id));
        if (existing?.rating) setRating(Number(existing.rating));
      } catch (e: unknown) {
        console.error(e);
        const detail =
          typeof e === "object" && e !== null
            ? (e as { response?: { data?: { detail?: string } } }).response?.data?.detail
            : undefined;
        setError(detail || "Erreur lors du chargement de la commande.");
      } finally {
        setLoading(false);
      }
    };

    // On re-charge si currentUser arrive plus tard (ProtectedRoute)
    if (!loading && !currentUser) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId, currentUser?.id]);

  const handleSubmit = async () => {
    if (!productId) {
      toast.error("Produit introuvable pour cette commande.");
      return;
    }
    if (!rating) {
      toast.error("Veuillez choisir une note (1 à 5).");
      return;
    }
    setSubmitting(true);
    try {
      await api.post(`/products/${productId}/reviews`, {
        rating,
        comment: comment.trim() ? comment.trim() : null,
      });
      toast.success("Merci ! Votre avis a été publié.");
      navigate(`/product/${productId}`);
    } catch (e: unknown) {
      const detail =
        typeof e === "object" && e !== null
          ? (e as { response?: { data?: { detail?: string } } }).response?.data?.detail
          : undefined;
      toast.error(detail || "Impossible de publier votre avis.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: "80px 16px", textAlign: "center" }}>
        Chargement de la commande…
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: "80px 16px", maxWidth: 700, margin: "0 auto" }}>
        <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 16 }}>
          <button onClick={() => navigate(-1)} className="icon-btn">
            <ChevronLeft size={24} />
          </button>
          <h1 style={{ margin: 0 }}>Avis</h1>
        </div>
        <p style={{ color: "var(--text-muted)" }}>{error}</p>
      </div>
    );
  }

  return (
    <div style={{ padding: "24px 16px", maxWidth: 800, margin: "0 auto" }}>
      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 18 }}>
        <button onClick={() => navigate(-1)} className="icon-btn">
          <ChevronLeft size={24} />
        </button>
        <h1 style={{ margin: 0 }}>Noter le produit</h1>
      </div>

      <div style={{ border: "1px solid var(--border-color)", borderRadius: 12, padding: 16, marginBottom: 16 }}>
        <div style={{ fontWeight: 800, marginBottom: 6 }}>
          {order?.product_name ? `Produit : ${order.product_name}` : "Produit : —"}
        </div>
        <div style={{ color: "var(--text-muted)", fontSize: 14 }}>
          {myReview ? "Vous avez déjà publié un avis pour ce produit." : "Donnez votre avis après l’achat."}
        </div>
      </div>

      <div style={{ border: "1px solid var(--border-color)", borderRadius: 12, padding: 16 }}>
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontWeight: 800, marginBottom: 8 }}>Votre note</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {[1, 2, 3, 4, 5].map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setRating(v)}
                aria-label={`${v} étoiles`}
                style={{
                  border: "none",
                  background: "transparent",
                  padding: 0,
                  cursor: "pointer",
                }}
              >
                <Star
                  size={28}
                  color="var(--secondary)"
                  fill={v <= rating ? "var(--secondary)" : "none"}
                />
              </button>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: 12 }}>
          <div style={{ fontWeight: 800, marginBottom: 8 }}>Commentaire (optionnel)</div>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={4}
            placeholder="Ex : Qualité au rendez-vous, livraison rapide…"
            style={{
              width: "100%",
              border: "1px solid var(--border-color)",
              borderRadius: 10,
              padding: 12,
              background: "transparent",
              color: "var(--text)",
              outline: "none",
              resize: "vertical",
            }}
          />
        </div>

        <button
          onClick={handleSubmit}
          disabled={submitting}
          style={{
            width: "100%",
            padding: "12px 16px",
            borderRadius: 10,
            border: "none",
            cursor: submitting ? "not-allowed" : "pointer",
            background: "var(--primary)",
            color: "#fff",
            fontWeight: 900,
          }}
        >
          {submitting ? "Publication..." : "Publier l’avis"}
        </button>
      </div>
    </div>
  );
}

