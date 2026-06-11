import { API_URL } from "../config";
import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import {
  ChevronLeft,
  Star,
  MapPin,
  CheckCircle,
  MessageCircle,
  Filter,
  Search,
  ShoppingCart,
  BadgeCheck,
} from "lucide-react";
import { useUser } from "../hooks/useUser";
import "./ShopPage.css";

export default function ShopPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currentUser, getInitials } = useUser();
  const [shop, setShop] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState("Tous");

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [shopRes, prodRes] = await Promise.all([
          axios.get(`${API_URL}/shops/${id}`),
          axios.get(`${API_URL}/shops/${id}/products`),
        ]);
        setShop(shopRes.data);
        setProducts(prodRes.data);
      } catch (err) {
        console.error("Shop fetch error:", err);
        setShop(null);
        setProducts([]);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id]);

  if (loading)
    return (
      <div className="shop-loader dashboard-wrapper" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <p>Chargement de la boutique...</p>
      </div>
    );
  if (!shop) return <div className="shop-error dashboard-wrapper">Boutique introuvable</div>;

  const categories = ["Tous", ...new Set(products.map(p => p.category_name).filter(Boolean))];

  return (
    <div className="shop-page-wrapper dashboard-wrapper">
      <header className="shop-nav dashboard-header">
        <button onClick={() => navigate(-1)} className="back-btn btn-icon" style={{ padding: '8px', borderRadius: '50%', background: 'var(--surface-hover)' }}>
          <ChevronLeft />
        </button>
        <div className="search-bar-sim" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Search size={16} />
          <span>Rechercher dans {shop.name}...</span>
        </div>
      </header>

      <section className="shop-hero">
        <div className="shop-banner">
          {shop.banner_url ? (
            <img
              src={shop.banner_url.startsWith("http") ? shop.banner_url : `${API_URL}${shop.banner_url}`}
              alt="Bannière boutique"
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
          ) : (
            <div style={{ width: '100%', height: '100%', background: 'linear-gradient(135deg, #1b3a1e 0%, #2e7d32 100%)' }} />
          )}
        </div>
        <div className="shop-profile-card">
          {shop.logo_url || shop.user_avatar ? (
            <img
              src={(shop.logo_url || shop.user_avatar).startsWith("http") ? (shop.logo_url || shop.user_avatar) : `${API_URL}${shop.logo_url || shop.user_avatar}`}
              alt="avatar"
              className="shop-avatar"
            />
          ) : (
            <div className="shop-avatar-placeholder" style={{ width: '120px', height: '120px', background: 'linear-gradient(135deg, #2e7d32 0%, #1b3a1e 100%)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '42px', borderRadius: '24px', fontWeight: 800, boxShadow: '0 8px 16px rgba(0,0,0,0.1)' }}>
              {getInitials(shop.name)}
            </div>
          )}
          <div className="shop-info-main">
            <div className="title-row">
              <h2>{shop.name}</h2>
              {shop.is_verified && (
                <BadgeCheck size={24} color="var(--primary)" fill="rgba(46, 125, 50, 0.1)" />
              )}
            </div>
            <p className="shop-desc">
              {shop.description || ""}
            </p>
            <div className="shop-meta">
              <span className="rating">
                <Star size={16} fill={shop.avg_rating > 0 ? "#F59E0B" : "none"} color={shop.avg_rating > 0 ? "#F59E0B" : "var(--text-muted)"} />
                {shop.avg_rating && shop.avg_rating > 0 ? Number(shop.avg_rating).toFixed(1) : "Nouveau"}
                <small style={{ color: 'var(--text-muted)', marginLeft: '4px' }}>
                  ({shop.review_count || 0} avis)
                </small>
              </span>
              <span className="loc">
                <MapPin size={16} /> {shop.city || ""}
              </span>
            </div>
          </div>
          <div className="shop-actions">
            {currentUser && String(currentUser.id) === String(shop.seller_id) ? (
              <button
                className="btn btn-primary btn-contact-shop"
                style={{ background: 'var(--text-muted)' }}
                onClick={() => navigate("/seller/dashboard")}
              >
                Grer ma boutique
              </button>
            ) : (
              <button
                className="btn btn-primary btn-contact-shop"
                onClick={() => navigate(`/chat/new/${shop.seller_id}`)}
              >
                <MessageCircle size={18} />
                <span>Contacter</span>
              </button>
            )}
          </div>
        </div>
      </section>

      <nav className="category-tabs dashboard-content" style={{ paddingBottom: '0' }}>
        {categories.map((cat: any) => (
          <button
            key={cat}
            className={activeCategory === cat ? "active" : ""}
            onClick={() => setActiveCategory(cat)}
          >
            {cat}
          </button>
        ))}
      </nav>

      <main className="shop-products-grid dashboard-content">
        <div className="grid-header">
          <h3 style={{ fontWeight: 800 }}>{products.length} Produits disponibles</h3>
          <button className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px' }}>
            <Filter size={16} /> Filtrer
          </button>
        </div>

        <div className="products-container">
          {products.filter(p => activeCategory === "Tous" || p.category_name === activeCategory).map((p) => (
            <div
              key={p.id}
              className="product-mini-card"
              onClick={() => navigate(`/product/${p.id}`)}
            >
              <div className="img-wrapper">
                <img src={p.image_url?.startsWith('http') ? p.image_url : `${API_URL}${p.image_url}`} alt={p.name} />
                {p.stock < 10 && p.stock > 0 && (
                  <span className="stock-low">Stock limit</span>
                )}
                {p.stock === 0 && (
                  <span className="stock-low" style={{ background: '#333' }}>puis</span>
                )}
              </div>
              <div className="p-details">
                <h4 style={{ margin: '0 0 4px', fontSize: '15px' }}>{p.name.split('.')[0].replace(/_/g, ' ')}</h4>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                  <p className="p-price" style={{ margin: 0 }}>
                    {p.price.toLocaleString()} <small>FCFA</small>
                  </p>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>par {p.unit}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '10px' }}>
                  <div style={{ width: '100%', height: '4px', background: 'var(--surface-hover)', borderRadius: '2px', overflow: 'hidden' }}>
                    <div style={{ width: `${Math.min(100, (p.stock / 50) * 100)}%`, height: '100%', background: p.stock < 10 ? '#EF4444' : 'var(--primary)' }}></div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>

      <footer className="shop-footer dashboard-content" style={{ paddingBottom: '4rem' }}>
        <div className="dashboard-section" style={{ display: 'flex', justifyContent: 'space-around', padding: '2rem', background: 'var(--surface)' }}>
          <div style={{ textAlign: 'center' }}>
            <strong style={{ display: 'block', fontSize: '1.5rem', color: 'var(--primary)' }}>{shop.product_count ?? products.length}</strong>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Produits</span>
          </div>
          <div style={{ textAlign: 'center', borderLeft: '1px solid var(--border-color)', borderRight: '1px solid var(--border-color)', padding: '0 3rem' }}>
            <strong style={{ display: 'block', fontSize: '1.5rem', color: 'var(--primary)' }}>
              {shop.avg_rating && shop.avg_rating > 0 ? Number(shop.avg_rating).toFixed(1) + "/5" : "N/A"}
            </strong>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Note vendeur</span>
          </div>
          <div style={{ textAlign: 'center' }}>
            <strong style={{ display: 'block', fontSize: '1.5rem', color: 'var(--primary)' }}>
              {(() => {
                if (!shop.user_joined_at) return "Nouveau";
                const joined = new Date(shop.user_joined_at);
                const now = new Date();
                const diffYears = now.getFullYear() - joined.getFullYear();
                const diffMonths = (now.getMonth() + 1) + (12 * now.getFullYear()) - ((joined.getMonth() + 1) + (12 * joined.getFullYear()));
                if (diffYears >= 1) return `${diffYears} an${diffYears > 1 ? 's' : ''}`;
                if (diffMonths >= 1) return `${diffMonths} mois`;
                return "Nouveau";
              })()}
            </strong>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Sur agrimarche</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
