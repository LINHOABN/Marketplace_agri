import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import api from "../api";
import {
  Search,
  Clock,
  TrendingUp,
  Leaf,
  PlusCircle,
  ChevronLeft,
  ChevronRight,
  Filter,
  Compass,
  Package,
  Fish,
  Tractor,
  Sprout,
  Egg
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import CompactProductCard from "../components/CompactProductCard";
import Footer from "../components/Footer/Footer";
import { usePersistentState } from "../hooks/usePersistentState";
import "./FeedPage.css";

// ── Correspondance catégorie → icône par défaut ──────────────────────────────
const ICON_MAP: Record<string, React.ReactNode> = {
  "Leaf": <Leaf size={20} />,
  "Egg": <Egg size={20} />,
  "Sprout": <Sprout size={20} />,
  "Tractor": <Tractor size={20} />,
  "Fish": <Fish size={20} />,
  "Package": <Package size={20} />,
};

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  "Agriculture": ["maïs", "mil", "sorgho", "blé", "riz", "céréale", "culture", "champ", "récolte", "manioc"],
  "Maraichage": ["tomate", "oignon", "carotte", "chou", "laitue", "épinard", "haricot", "piment", "légume"],
  "Élevage": ["bœuf", "vache", "mouton", "chèvre", "porc", "cochon", "poulet", "volaille", "lapin", "viande"],
  "Pêche": ["poisson", "tilapia", "carpe", "crevette", "pêche", "filet"],
  "Produits naturels": ["miel", "huile de palme", "cacao", "café", "épice", "mangue", "fruit", "ananas"],
  "Matériel": ["tracteur", "outil", "machine", "pompe", "arrosage", "engrais", "pesticide"],
  "Semences": ["graines", "semis", "bouture", "pépinière", "plants"],
};

function guessCategory(name: string, catName?: string): string {
  if (catName && catName !== "Général") return catName;
  const lower = (name || "").toLowerCase();
  for (const [cat, kws] of Object.entries(CATEGORY_KEYWORDS)) {
    if (kws.some((k) => lower.includes(k))) return cat;
  }
  return "Agriculture";
}

// ── Aide : URL des images (compatible Proxy /uploads) ─────────────────────────
function getImageUrl(url: string) {
  if (!url) return "https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=800";
  if (url.startsWith("http")) return url;
  // On privilégie le passage direct par /uploads (proxifié dans vite.config.ts)
  if (url.startsWith("/uploads")) return url;
  // Sinon au cas où c'est juste le nom du fichier
  return `/uploads/${url}`;
}

// ── Aide : Randomisation ──────────────────────────────────────────────────────
function shuffleArray(array: any[]) {
  const newArr = [...array];
  for (let i = newArr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArr[i], newArr[j]] = [newArr[j], newArr[i]];
  }
  return newArr;
}

// ── Conseil agricoles statiques (pas de fausse stat, juste utiles) ─────────────
const AGRI_TIPS = [
  { emoji: "🌽", title: "Saison du maïs", text: "La période idéale de semis est mars–avril, après les premières pluies." },
  { emoji: "🐄", title: "Santé animale", text: "Vaccinez vos bovins contre la fièvre aphteuse chaque année." },
  { emoji: "🌿", title: "Compostage", text: "Un compost bien fait enrichit votre sol naturellement sans engrais chimique." },
  { emoji: "🐟", title: "Pisciculture", text: "Renouvelez l'eau du bassin toutes les 2 semaines pour éviter les maladies." },
];

export default function FeedPage() {
  const navigate = useNavigate();

  // ── État ──────────────────────────────────────────────────────────────────────
  const [allProducts, setAllProducts] = useState<any[]>([]);
  const [popularProducts, setPopularProducts] = useState<any[]>([]);
  const [newProducts, setNewProducts] = useState<any[]>([]);
  const [stories, setStories] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Use persistent state for the selected tab
  const [selectedTab, setSelectedTab] = usePersistentState("feed_selected_tab", "Tous");

  const [categories, setCategories] = useState<any[]>([]);
  const [tips, setTips] = useState<any[]>([]);

  // Slice stable pour le carrousel (évite re-shuffle à chaque render)
  const heroProducts = useMemo(() => popularProducts.slice(0, 5), [popularProducts]);

  // ── Chargement parallèle des données réelles ──────────────────────────────────
  useEffect(() => {
    setIsLoading(true);
    Promise.all([
      api.get("/feed?page=1&limit=100").catch(() => ({ data: { items: [] } })),
      api.get("/feed/popular?limit=20").catch(() => ({ data: { items: [] } })),
      api.get("/feed/new?limit=20").catch(() => ({ data: { items: [] } })),
      api.get("/feed/stats").catch(() => ({ data: null })),
      api.get("/categories").catch(() => ({ data: [] })),
      fetch("/api/admin-tips/").then(r => r.json()).catch(() => []),
    ]).then(([feedRes, popRes, newRes, statsRes, catRes, tipsRes]) => {
      const allItems = feedRes.data.items || [];
      setAllProducts(allItems.filter((i: any) => i.item_type === "product"));

      // Extraction des stories
      const rawStories = allItems.filter((i: any) => i.item_type === "post" && i.type === "story");
      const grouped = rawStories.reduce((acc: any, s: any) => {
        const uid = s.user_id;
        if (!acc[uid]) {
          acc[uid] = {
            user_id: uid,
            author_name: s.author_name || "Utilisateur",
            author_avatar: s.author_avatar,
            stories: []
          };
        }
        acc[uid].stories.push(s);
        return acc;
      }, {});
      setStories(Object.values(grouped));

      // Dédoublonner par id pour éviter les warnings de clés React
      const uniquePop = Array.from(
        new Map((popRes.data.items || []).map((p: any) => [p.id, p])).values()
      );
      const uniqueNew = Array.from(
        new Map((newRes.data.items || []).map((p: any) => [p.id, p])).values()
      );
      setPopularProducts(shuffleArray(uniquePop).slice(0, 15));
      setNewProducts(shuffleArray(uniqueNew).slice(0, 15));
      setStats(statsRes.data);
      setCategories(catRes.data || []);
      setTips(shuffleArray(tipsRes && tipsRes.length > 0 ? tipsRes : AGRI_TIPS));
    }).finally(() => {
      setIsLoading(false);
      // Restore scroll position after loading data
      const savedScroll = sessionStorage.getItem("feed_scroll_pos");
      if (savedScroll) {
        setTimeout(() => {
          window.scrollTo({
            top: parseInt(savedScroll, 10),
            behavior: "instant" as any
          });
        }, 100);
      }
    });
  }, []);

  // Save scroll position
  useEffect(() => {
    const handleScroll = () => {
      sessionStorage.setItem("feed_scroll_pos", window.scrollY.toString());
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // ── Groupement par catégorie ──────────────────────────────────────────────────
  const productsByCategory = allProducts.reduce<Record<string, any[]>>((acc, prod) => {
    const cat = guessCategory(prod.name || "", prod.category_name);
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(prod);
    return acc;
  }, {});

  // ── Filtrage selon l'onglet sélectionné ──────────────────────────────────────
  const filteredCategories = selectedTab === "Tous"
    ? Object.keys(productsByCategory).sort()
    : [selectedTab];

  const filteredProducts = selectedTab === "Tous"
    ? []
    : (productsByCategory[selectedTab] || []);

  return (
    <div className="feed-page-wrapper">

      {/* ── Barre de recherche sticky ─────────────────────────────────── */}
      <div className="feed-sticky-top">
        <div className="search-pill" onClick={() => navigate("/search")} role="button" tabIndex={0}>
          <Search size={16} />
          <span>Rechercher un produit, animal, semence…</span>
        </div>
      </div>

      {/* ── Onglets Catégories ───────────────────────────────────────────── */}
      <div className="category-tabs-bar">
        <button
          className={`cat-tab ${selectedTab === "Tous" ? "active" : ""}`}
          onClick={() => setSelectedTab("Tous")}
        >
          <Compass size={20} /> Tous
        </button>
        {categories.map(cat => (
          <button
            key={cat.id}
            className={`cat-tab ${selectedTab === cat.name ? "active" : ""}`}
            onClick={() => setSelectedTab(cat.name)}
          >
            {ICON_MAP[cat.icon_url] || <Leaf size={20} />} {cat.name}
          </button>
        ))}
      </div>

      {/* ── Contenu ──────────────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="feed-skeletons">
          {[1, 2, 3].map(i => <div key={i} className="skeleton-section" />)}
        </div>
      ) : (
        <div className="feed-body" style={{ flex: 1 }}>

          {/* Bannière stats réelles */}
          {stats && (
            <div className="stats-banner">
              <div className="stat-badge">
                <TrendingUp size={14} />
                <span><strong>{stats.total_products}</strong> produits</span>
              </div>
              <div className="stat-badge">
                <Clock size={14} />
                <span><strong>{stats.new_today}</strong> aujourd'hui</span>
              </div>
              <div className="stat-badge">
                <Leaf size={14} />
                <span><strong>{stats.total_shops}</strong> boutiques</span>
              </div>
            </div>
          )}

          {/* ── Vue filtrée : catégorie spécifique ─────────────────────── */}
          {selectedTab !== "Tous" && (
            <div className="filtered-view">
              {filteredProducts.length === 0 ? (
                <EmptyState category={selectedTab} onReset={() => setSelectedTab("Tous")} />
              ) : (
                <div className="products-grid-compact">
                  {filteredProducts.map(prod => (
                    <CompactProductCard key={prod.id} product={prod} />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Vue "Tous" : sections thématiques ──────────────────────── */}
          {selectedTab === "Tous" && (
            <>
              {/* Carrousel de présentation automatique (5 produits au hasard parmi les populaires) */}
              <HeroCarousel products={heroProducts} />

              {/* Lane des Stories (Style Instagram/Netflix) */}
              {stories.length > 0 && (
                <div className="feed-stories-lane">
                  <div className="story-pill add-story" onClick={() => navigate("/stories")}>
                    <div className="story-avatar-wrapper">
                      <PlusCircle size={20} />
                    </div>
                    <span>Ma story</span>
                  </div>
                  {stories.map((group: any) => (
                    <div
                      key={group.user_id}
                      className="story-pill"
                      onClick={() => navigate("/stories")} // Simplification : on va à la page stories
                    >
                      <div className="story-avatar-wrapper seen">
                        <img src={getImageUrl(group.author_avatar)} alt={group.author_name} />
                      </div>
                      <span>{group.author_name.split(" ")[0]}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Produits populaires */}
              {popularProducts.length > 0 && (
                <HorizontalSection
                  title="🔥 Populaires cette semaine"
                  products={popularProducts}
                  onSeeAll={() => navigate("/search/results?sort=popular")}
                />
              )}

              {/* Nouveautés */}
              {newProducts.length > 0 && (
                <HorizontalSection
                  title="🆕 Nouvelles publications"
                  products={newProducts}
                  onSeeAll={() => navigate("/search/results?sort=newest")}
                />
              )}

              {/* Sections par catégories réelles */}
              {filteredCategories.map(cat =>
                productsByCategory[cat] && productsByCategory[cat].length > 0 ? (
                  <HorizontalSection
                    key={cat}
                    title={<>{ICON_MAP[categories.find(c => c.name === cat)?.icon_url] || "🌱"} {cat}</>}
                    products={productsByCategory[cat]}
                    onSeeAll={() => setSelectedTab(cat)}
                  />
                ) : null
              )}

              {/* Conseils agricoles */}
              {(tips.length > 0 || AGRI_TIPS.length > 0) && (
                <div className="tips-section">
                  <h3 className="section-title-feed">📚 Conseils agricoles</h3>
                  <div className="tips-grid">
                    {(tips.length > 0 ? tips : AGRI_TIPS).map((tip, i) => (
                      <div key={i} className="tip-card" style={{ animationDelay: `${i * 0.1}s` }}>
                        <span className="tip-emoji">{tip.emoji}</span>
                        <div>
                          <strong>{tip.title}</strong>
                          <p>{tip.text}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* État vide global */}
              {allProducts.length === 0 && (
                <EmptyState category="Tous" onReset={() => { }} />
              )}
            </>
          )}

        </div>
      )}
      <Footer />
    </div>
  );
}

// ── Composant : Carrousel Hero Automatique (Sliding) ────────────────────────
function HeroCarousel({ products }: { products: any[] }) {
  const [index, setIndex] = useState(0);
  const navigate = useNavigate();
  const timerRef = useRef<any>(null);

  const startTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (products.length <= 1) return;
    timerRef.current = setInterval(() => {
      setIndex((prev) => (prev + 1) % products.length);
    }, 6000);
  }, [products]);

  useEffect(() => {
    startTimer();
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [startTimer]);

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIndex((prev) => (prev - 1 + products.length) % products.length);
    startTimer();
  };

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIndex((prev) => (prev + 1) % products.length);
    startTimer();
  };

  if (products.length === 0) return null;

  return (
    <div className="hero-carousel-container">
      <div className="hero-carousel">
        <div
          className="hero-track"
          style={{ transform: `translateX(-${index * 100}%)` }}
        >
          {products.map((active) => {
            const cleanName = (active.name || "").replace(/_/g, " ");
            const imageUrl = getImageUrl(active.image || active.image_url);
            const bgStyle = active.image || active.image_url
              ? { backgroundImage: `linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.2) 60%, rgba(0,0,0,0.1) 100%), url(${imageUrl})` }
              : { background: `linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%)` };

            return (
              <div
                key={active.id}
                className="hero-slide"
                style={bgStyle}
                onClick={() => navigate(`/product/${active.id}`)}
              >
                <div className="hero-content">
                  <span className="hero-tag">🌟 À ne pas manquer</span>
                  <h2 className="hero-title">{cleanName}</h2>
                  <p className="hero-price">{active.price.toLocaleString()} FCFA</p>
                  <button className="hero-btn">Voir l'offre</button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Navigation Arrows */}
        <button className="hero-nav-btn prev" onClick={handlePrev} aria-label="Précédent">
          <ChevronLeft size={24} />
        </button>
        <button className="hero-nav-btn next" onClick={handleNext} aria-label="Suivant">
          <ChevronRight size={24} />
        </button>

        {/* Indicators */}
        <div className="hero-indicators">
          {products.map((_, i) => (
            <div
              key={i}
              className={`indicator ${i === index ? "active" : ""}`}
              onClick={(e) => { e.stopPropagation(); setIndex(i); startTimer(); }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Composant : Section horizontale style Netflix ─────────────────────────────
function HorizontalSection({ title, products, onSeeAll }: {
  title: React.ReactNode;
  products: any[];
  onSeeAll: () => void;
}) {
  return (
    <div className="h-section">
      <div className="h-section-header">
        <h3 className="section-title-feed">{title}</h3>
        {products.length > 5 && (
          <button className="see-all-link" onClick={onSeeAll}>
            Tout voir <ChevronRight size={14} />
          </button>
        )}
      </div>
      <div className="h-lane">
        {shuffleArray(products)
          // Élimination des doublons par ID
          .filter((v, i, a) => a.findIndex(t => t.id === v.id) === i)
          .slice(0, 10).map(prod => (
            <div key={prod.id} className="h-lane-item">
              <CompactProductCard product={prod} />
            </div>
          ))}
      </div>
    </div>
  );
}

// ── Composant : État vide intelligent ─────────────────────────────────────────
function EmptyState({ category, onReset }: { category: string; onReset: () => void }) {
  const navigate = useNavigate();
  return (
    <div className="empty-state">
      <div className="empty-illustration">🌾</div>
      <h4>Aucun produit en <em>{category}</em></h4>
      <p>Soyez le premier à publier dans cette catégorie !</p>
      <div className="empty-actions">
        <button className="btn-publish" onClick={() => navigate("/product/new")}>
          + Publier un produit
        </button>
        {category !== "Tous" && (
          <button className="btn-explore" onClick={onReset}>
            Explorer tout
          </button>
        )}
      </div>
    </div>
  );
}
