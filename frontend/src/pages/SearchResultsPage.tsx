import { API_URL } from '../config';
import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  ChevronLeft, Search, Filter,
  LayoutGrid, List, ArrowUpDown, Store
} from 'lucide-react';
import ProductCard from '../components/ProductCard';
import '../components/ProductCard.css';
import PostCard from '../components/PostCard';
import ShopResultCard from '../components/ShopResultCard/ShopResultCard';
import { normalizeSearchItem } from '../utils/searchNormalize';
import { usePersistentState } from '../hooks/usePersistentState';
import './SearchResultsPage.css';

export default function SearchResultsPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const searchParams = new URLSearchParams(location.search);
  const query = searchParams.get('q') || '';
  const category = searchParams.get('cat') || '';

  const [products, setProducts] = useState<any[]>([]);
  const [shops, setShops] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = usePersistentState<'grid' | 'list'>('search_results_view_mode', 'grid');
  const [sortBy, setSortBy] = usePersistentState('search_results_sort_by', searchParams.get('sort') || 'recent');

  useEffect(() => {
    const fetchResults = async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem("access_token");
        const res = await axios.get(
          `${API_URL}/search/?q=${encodeURIComponent(query)}&category=${encodeURIComponent(category)}&sort=${sortBy}`,
          token ? { headers: { Authorization: `Bearer ${token}` } } : undefined
        );

        const data = res.data;
        if (data.products) {
          setProducts(data.products.map((item: any) => normalizeSearchItem(item)));
          setShops(data.shops || []);
        } else {
          // Fallback pour l'ancien format si non mis à jour partout
          const raw = Array.isArray(data) ? data : [];
          setProducts(raw.map((item: any) => normalizeSearchItem(item)));
          setShops([]);
        }
      } catch (err) {
        console.error("Search error", err);
        setProducts([]);
        setShops([]);
      } finally {
        setLoading(false);
        // Restore scroll position after loading data
        const savedScroll = sessionStorage.getItem("search_results_scroll_pos");
        if (savedScroll) {
          setTimeout(() => {
            window.scrollTo({
              top: parseInt(savedScroll, 10),
              behavior: "instant" as any
            });
          }, 100);
        }
      }
    };
    fetchResults();
  }, [query, category, sortBy]);

  // Save scroll position
  useEffect(() => {
    const handleScroll = () => {
      sessionStorage.setItem("search_results_scroll_pos", window.scrollY.toString());
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const hasAnyResults = products.length > 0 || shops.length > 0;

  return (
    <div className="search-results-wrapper dashboard-wrapper">
      <header className="results-header dashboard-header">
        <div className="header-top">
          <button onClick={() => navigate(-1)} className="back-btn btn-icon" style={{ padding: '8px', borderRadius: '50%', background: 'var(--surface-hover)' }}>
            <ChevronLeft size={20} />
          </button>
          <div className="search-bar-mini" onClick={() => navigate('/search')}>
            <Search size={18} color="var(--text-muted)" />
            <input type="text" value={query || category} readOnly />
          </div>
        </div>
        <div className="results-info">
          <span>{products.length + shops.length} résultats trouvés</span>
          <div className="view-toggles">
            <button className={viewMode === 'grid' ? 'active' : ''} onClick={() => setViewMode('grid')}><LayoutGrid size={18} /></button>
            <button className={viewMode === 'list' ? 'active' : ''} onClick={() => setViewMode('list')}><List size={18} /></button>
          </div>
        </div>
      </header>

      <div className="results-toolbar dashboard-content" style={{ paddingBottom: '0' }}>
        <button className="tool-btn"><Filter size={18} /> Affiner</button>
        <button className="tool-btn" onClick={() => setSortBy(sortBy === 'price_asc' ? 'price_desc' : 'price_asc')}>
          <ArrowUpDown size={18} /> Trier par {sortBy === 'price_asc' ? 'prix croissant' : sortBy === 'price_desc' ? 'prix décroissant' : 'pertinence'}
        </button>
      </div>

      <main className={`results-container ${viewMode} dashboard-content`}>
        {loading ? (
          <div className="results-loading">
            <p>Analyse des offres en cours...</p>
          </div>
        ) : !hasAnyResults ? (
          <div className="empty-results">
            <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'var(--surface-hover)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1rem' }}>
              <Search size={32} color="var(--border-color)" />
            </div>
            <h3>Aucun résultat exact pour "{query || category}"</h3>
            <p>Essayez d'élargir votre recherche ou de consulter nos boutiques spécialisées.</p>
            <button className="btn btn-primary" onClick={() => navigate('/search')} style={{ marginTop: '1rem' }}>
              Nouvelle recherche
            </button>
          </div>
        ) : (
          <div className="search-results-content">
            {products.length > 0 ? (
              <div className="results-products-section">
                <h3 className="section-title-search">
                  Marché en direct
                </h3>
                <div className={`products-grid ${viewMode === 'grid' ? 'dashboard-grid' : 'list-view'}`}>
                  {products.map(product => (
                    <ProductCard key={`prod-${product.id}`} product={product} />
                  ))}
                </div>
              </div>
            ) : shops.length > 0 && (
              <div className="no-exact-match-notice" style={{ padding: '2rem', background: 'rgba(46, 125, 50, 0.05)', borderRadius: '16px', marginBottom: '2rem', border: '1px dashed var(--primary-light)' }}>
                <h3 style={{ margin: 0, color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Store size={24} /> Aucun produit exact trouvé
                </h3>
                <p style={{ margin: '8px 0 0', color: 'var(--text-muted)' }}>
                  Voici des boutiques spécialisées qui pourraient avoir ce que vous cherchez :
                </p>
              </div>
            )}

            {shops.length > 0 && (
              <div className="results-shops-section" style={{ marginTop: products.length > 0 ? '3rem' : '0' }}>
                <h3 className="section-title-search" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Store size={20} color="var(--primary)" /> Boutiques recommandées
                </h3>
                <div className="shops-results-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem', marginTop: '1.5rem' }}>
                  {shops.map(shop => (
                    <ShopResultCard key={`shop-${shop.id}`} shop={shop} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
