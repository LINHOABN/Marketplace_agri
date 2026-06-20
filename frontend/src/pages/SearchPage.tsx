import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search,
  X,
  History,
  TrendingUp,
  ChevronRight,
  SlidersHorizontal,
  Leaf,
  Sparkles,
  ArrowLeft,
  MapPin,
} from "lucide-react";
import axios from "axios";
import { API_URL } from "../config";
import { usePersistentState } from "../hooks/usePersistentState";
import "./SearchPage.css";

const CATEGORIES = [
  "levage",
  "Agriculture",
  "Produits transforms",
  "Engins & Matriel",
];

export default function SearchPage() {
  const navigate = useNavigate();
  const [query, setQuery] = usePersistentState("search_query", "");
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showFilters, setShowFilters] = useState(false);

  // Filtres persistants
  const [selectedCat, setSelectedCat] = usePersistentState("search_cat", "");
  const [radius, setRadius] = usePersistentState("search_radius", 50);
  const [priceRange, setPriceRange] = usePersistentState("search_price_range", { min: 0, max: 100000 });

  useEffect(() => {
    const saved = localStorage.getItem("recentSearches");
    if (saved) setRecentSearches(JSON.parse(saved));
  }, []);

  // Fetch suggestions real-time
  useEffect(() => {
    if (!query.trim()) {
      setSuggestions([]);
      return;
    }
    const delayDebounce = setTimeout(async () => {
      try {
        const token = localStorage.getItem("access_token");
        const headers: Record<string, string> = {};
        if (token) headers["Authorization"] = `Bearer ${token}`;
        const res = await axios.get(`${API_URL}/search/suggest?q=${query}`, { headers });
        setSuggestions(res.data);
      } catch (err) {
        console.error("Suggestions error", err);
      }
    }, 200);
    return () => clearTimeout(delayDebounce);
  }, [query]);


  const handleSearch = (searchTerm: string) => {
    const q = searchTerm || query;
    if (!q.trim()) return;

    // Save to recent
    const updated = [
      q,
      ...recentSearches.filter((s) => s !== q),
    ].slice(0, 5);
    setRecentSearches(updated);
    localStorage.setItem("recentSearches", JSON.stringify(updated));

    // Navigate to results
    navigate(
      `/search/results?q=${q}&cat=${selectedCat}&radius=${radius}&min=${priceRange.min}&max=${priceRange.max}`,
    );
  };

  return (
    <div className="search-page-container dashboard-wrapper">
      <header className="search-header-main dashboard-header">
        <button
          className="btn-back-to-explore"
          onClick={() => navigate(-1)}
          style={{
            background: "var(--surface-hover)",
            border: "none",
            width: "40px",
            height: "40px",
            borderRadius: "50%",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <ArrowLeft size={20} />
        </button>

        <div className="search-bar-wrapper">
          <Search size={20} color="var(--text-muted)" />
          <input
            type="text"
            placeholder="Tomates, porcs, bufs..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyPress={(e) => e.key === "Enter" && handleSearch(query)}
            autoFocus
          />
          {query && (
            <button onClick={() => setQuery("")} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}>
              <X size={18} color="var(--text-muted)" />
            </button>
          )}
        </div>

        <button
          className="btn-filter-icon"
          onClick={() => setShowFilters(!showFilters)}
          style={{ background: showFilters ? 'var(--primary)' : 'var(--surface-hover)', color: showFilters ? 'white' : 'var(--text-main)' }}
        >
          <SlidersHorizontal size={22} />
        </button>
      </header>

      <main className="search-body dashboard-content">
        <section className="filter-chips">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              className={`chip ${selectedCat === cat ? "active" : ""}`}
              onClick={() => setSelectedCat(selectedCat === cat ? "" : cat)}
            >
              {cat}
            </button>
          ))}
        </section>

        {showFilters && (
          <section className="advanced-filters" style={{ animation: 'fadeInNotif 0.3s ease' }}>
            <div className="filter-group">
              <label>
                <MapPin size={14} style={{ marginRight: '6px' }} />
                Distance max: <strong>{radius} km</strong>
              </label>
              <input
                type="range"
                min="5"
                max="200"
                value={radius}
                onChange={(e) => setRadius(parseInt(e.target.value))}
              />
            </div>
            <div className="filter-group">
              <label>
                Prix max: <strong>{priceRange.max.toLocaleString()} FCFA</strong>
              </label>
              <input
                type="range"
                min="500"
                max="500000"
                step="500"
                value={priceRange.max}
                onChange={(e) =>
                  setPriceRange({
                    ...priceRange,
                    max: parseInt(e.target.value),
                  })
                }
              />
            </div>
          </section>
        )}

        {query && (
          <div className="autocomplete-suggestions-premium" style={{ marginBottom: '2rem' }}>
            {suggestions.length > 0 ? (
              <div className="suggestions-list" style={{ background: 'var(--surface)', borderRadius: '16px', border: '1px solid var(--border-color)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
                <div style={{ padding: '12px 16px', fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border-color)' }}>
                  Suggestions intelligentes
                </div>
                {suggestions.map((s, idx) => (
                  <div
                    key={idx}
                    className="suggestion-item"
                    onClick={() => handleSearch(s.label)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "14px 16px",
                      cursor: "pointer",
                      borderBottom: idx < suggestions.length - 1 ? "1px solid var(--border-color)" : "none",
                      transition: 'background 0.2s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = "var(--surface-hover)"}
                    onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'var(--surface-hover)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {s.domain === "Agriculture" ? <Leaf size={18} color="var(--primary)" /> : <Sparkles size={18} color="#F59E0B" />}
                      </div>
                      <div>
                        <p style={{ margin: 0, fontWeight: 700, fontSize: '15px' }}>{s.label}</p>
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{s.domain}</span>
                      </div>
                    </div>
                    <ChevronRight size={16} color="var(--border-color)" />
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                <Sparkles size={40} style={{ marginBottom: '1rem', opacity: 0.2 }} />
                <p>Aucune suggestion directe, appuyez sur Entrée pour rechercher tout agrimarche.</p>
              </div>
            )}
          </div>
        )}

        {!query && recentSearches.length > 0 && (
          <section className="search-history">
            <div className="section-title">
              <History size={18} />
              <h4>Rcemment recherch</h4>
            </div>
            <div className="history-list">
              {recentSearches.map((s) => (
                <div
                  key={s}
                  className="history-item"
                  onClick={() => handleSearch(s)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <History size={16} color="var(--text-muted)" />
                    <span>{s}</span>
                  </div>
                  <ChevronRight size={16} />
                </div>
              ))}
            </div>
          </section>
        )}

        {!query && (
          <section className="popular-suggestions">
            <div className="section-title">
              <TrendingUp size={18} />
              <h4>Populaires en ce moment</h4>
            </div>
            <div className="suggestion-grid">
              {[
                "Poulet de chair",
                "Mas sch",
                "Tomate frache",
                "Porcs locaux",
                "Huile de palme",
                "Oignons"
              ].map((s) => (
                <div
                  key={s}
                  className="suggest-card"
                  onClick={() => handleSearch(s)}
                >
                  {s}
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
