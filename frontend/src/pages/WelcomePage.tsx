import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Search, MapPin, Leaf, Globe, ShoppingBag, Eye, Clock, ArrowRight } from "lucide-react";
import api from "../api";
import { API_URL } from "../config";
import Footer from "../components/Footer/Footer";
import "./WelcomePage.css";

type FeedItem = {
  id: string;
  name?: string;
  content?: string;
  price?: number;
  image?: string;
  media_url?: string;
  created_at: string;
  item_type: 'product' | 'post';
  shop_name?: string;
  author_name?: string;
  author_avatar?: string;
  vendor_avatar?: string;
  category?: string;
};

export default function WelcomePage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchFeed = async () => {
      try {
        const res = await api.get("/feed");
        setItems(res.data.items || []);
      } catch (err) {
        console.error("Failed to fetch feed:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchFeed();
  }, []);

  const getImageUrl = (item: FeedItem) => {
    const path = item.item_type === 'product' ? item.image : item.media_url;
    if (!path) return "https://images.unsplash.com/photo-1592982537447-6f2a6a0a2021?auto=format&fit=crop&w=800&q=80";
    if (path.startsWith('http')) return path;
    return `${API_URL}${path}`;
  };

  const getAvatarUrl = (item: FeedItem) => {
    const path = item.item_type === 'product' ? item.vendor_avatar : item.author_avatar;
    if (!path) return `https://ui-avatars.com/api/?name=${item.author_name || item.shop_name || 'Agri'}`;
    if (path.startsWith('http')) return path;
    return `${API_URL}${path}`;
  };

  return (
    <div className="booking-welcome-container">
      {/* Navigation Header */}
      <nav className="booking-header">
        <div className="header-content">
          <div className="brand" onClick={() => navigate("/")}>
            <Leaf size={32} className="brand-icon" />
            <span>AgriMarché</span>
          </div>
          <div className="header-actions" style={{ display: 'flex', gap: '12px' }}>
            <button className="nav-btn secondary" onClick={() => navigate("/register")}>S'inscrire</button>
            <button className="nav-btn primary" onClick={() => navigate("/login")}>Connexion</button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="booking-hero">
        <div className="hero-content">
          <h1>Le meilleur de la terre, en un clic.</h1>
          <p>La première plateforme agricole du Cameroun pour acheter et vendre en toute confiance.</p>
        </div>
      </section>

      {/* Search Bar */}
      <div className="search-bar-wrapper">
        <div className="search-bar-container">
          <div className="search-field">
            <Search size={24} className="field-icon" />
            <input type="text" placeholder="Tomates, Volaille, Engrais..." />
          </div>
          <div className="search-field border-left">
            <MapPin size={24} className="field-icon" />
            <input type="text" placeholder="Toutes les régions" />
          </div>
          <button className="search-submit-btn" onClick={() => navigate("/login")}>
            Découvrir
          </button>
        </div>
      </div>

      {/* Main Content */}
      <main className="booking-main-content" style={{ flex: 1 }}>
        {/* Featured Section */}
        <section className="featured-section">
          <div className="section-header">
            <div>
              <h2>Publications Récentes</h2>
              <p style={{ color: 'var(--agri-text-muted)' }}>Découvrez les nouveautés de nos producteurs</p>
            </div>
            <button className="view-btn" style={{ fontSize: '16px' }} onClick={() => navigate("/login")}>
              Tout voir <ArrowRight size={18} />
            </button>
          </div>

          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
              <div className="loader"></div>
            </div>
          ) : (
            <div className="featured-grid">
              {items.slice(0, 8).map((item) => (
                <div
                  key={`${item.item_type}-${item.id}`}
                  className="publication-card"
                  onClick={() => {
                    if (item.item_type === 'product') {
                      navigate(`/product/${item.id}`);
                    } else {
                      navigate("/login"); // For posts, we might still need login or a public view
                    }
                  }}
                >
                  <div className="card-media">
                    <img src={getImageUrl(item)} alt={item.name || "Publication"} />
                    <span className="item-badge">
                      {item.item_type === 'product' ? 'Produit' : 'Post'}
                    </span>
                  </div>
                  <div className="card-body">
                    <div className="author-info">
                      <img src={getAvatarUrl(item)} alt="" className="author-avatar" />
                      <span className="author-name">{item.author_name || item.shop_name}</span>
                    </div>
                    <h3 className="pub-title">{item.name || item.content}</h3>
                    {item.item_type === 'product' && (
                      <p className="pub-price">{item.price?.toLocaleString()} CFA</p>
                    )}
                    <div className="pub-meta">
                      <div className="time-ago">
                        <Clock size={12} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
                        {new Date(item.created_at).toLocaleDateString()}
                      </div>
                      <div className="view-btn">
                        Détails <Eye size={14} />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Promo Banner */}
        <section className="promo-banner">
          <div className="promo-text">
            <h2 style={{ fontSize: '42px', fontWeight: 900 }}>Devenez acteur du changement</h2>
            <p style={{ fontSize: '20px', opacity: 0.9, marginTop: '12px' }}>Vendez vos récoltes au meilleur prix sans intermédiaire.</p>
            <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', marginTop: '32px' }}>
              <button
                className="nav-btn primary"
                style={{ padding: '16px 32px', fontSize: '18px' }}
                onClick={() => navigate("/register")}
              >
                Ouvrir ma boutique
              </button>
              <button
                className="nav-btn secondary"
                style={{ padding: '16px 32px', fontSize: '18px', border: '2px solid white' }}
                onClick={() => navigate("/login")}
              >
                Parcourir le marché
              </button>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
