import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Search, MapPin, Leaf, ArrowRight, ChevronRight } from "lucide-react";
import api from "../api";
import { API_URL } from "../config";
import CompactProductCard from "../components/CompactProductCard";
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
  const [searchQuery, setSearchQuery] = useState("");

  const handleSearch = () => {
    if (searchQuery.trim()) {
      navigate(`/search/results?q=${encodeURIComponent(searchQuery.trim())}`);
    } else {
      navigate("/login");
    }
  };

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
            <input
              type="text"
              placeholder="Tomates, Volaille, Engrais..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            />
          </div>
          <div className="search-field border-left">
            <MapPin size={24} className="field-icon" />
            <input type="text" placeholder="Toutes les régions" />
          </div>
          <button className="search-submit-btn" onClick={handleSearch}>
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
            <div style={{ display: 'flex', gap: '12px', padding: '8px 0', overflowX: 'hidden' }}>
              {[1, 2, 3, 4].map(i => <div key={i} className="welcome-card-skeleton" />)}
            </div>
          ) : (
            <div className="welcome-h-lane">
              {items
                .filter(item => item.item_type === 'product')
                .slice(0, 12)
                .map((item) => (
                  <div key={`${item.item_type}-${item.id}`} className="welcome-h-lane-item">
                    <CompactProductCard
                      product={{
                        id: item.id,
                        name: item.name || "Produit",
                        price: item.price || 0,
                        image: item.image || "",
                        sellerName: item.shop_name || item.author_name || "",
                        category: item.category,
                      }}
                    />
                  </div>
                ))}
              {/* Voir plus */}
              <div className="welcome-see-more-card" onClick={() => navigate("/login")}>
                <ChevronRight size={28} />
                <span>Voir tout</span>
              </div>
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
