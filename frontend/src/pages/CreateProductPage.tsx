import React, { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";
import { ImagePlus, X, Loader2, AlertCircle, Leaf, Video, ChevronLeft, Info, BadgeCheck } from "lucide-react";
import { toast } from "react-hot-toast";
import "./CreateProductPage.css";

import { useUser } from "../hooks/useUser";
import { usePersistentState } from "../hooks/usePersistentState";

export default function CreateProductPage() {
  const navigate = useNavigate();
  const { currentUser } = useUser();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Guard: Seuls les vendeurs peuvent accéder à cette page
  React.useEffect(() => {
    if (currentUser && currentUser.role !== 'seller' && currentUser.role !== 'admin') {
      toast.error("Accès réservé aux vendeurs. Veuillez d'abord valider votre compte pro.");
      navigate("/settings");
    }
  }, [currentUser]);

  const [formData, setFormData] = usePersistentState("product_create_draft", {
    title: "",
    description: "",
    category_id: "",
    price: "",
    quantity: "",
    unit: "kg",
    location: "Position actuelle",
    latitude: null as number | null,
    longitude: null as number | null,
  });

  const [selectedMedias, setSelectedMedias] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [categories, setCategories] = useState<any[]>([]);

  // Autocomplete suggestions states
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const handleTitleChange = async (val: string) => {
    setFormData((prev) => ({ ...prev, title: val }));
    if (!val.trim()) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    setIsLoadingSuggestions(true);
    try {
      const res = await api.get(`/search/suggest?q=${encodeURIComponent(val)}`);
      setSuggestions(res.data);
      setShowSuggestions(res.data.length > 0);
    } catch (err) {
      console.error("Error fetching suggestions:", err);
    } finally {
      setIsLoadingSuggestions(false);
    }
  };

  const handleSelectSuggestion = (sug: any) => {
    setFormData((prev) => {
      const updated = { ...prev, title: sug.label };
      const sugCategory = (sug.domain || "").toLowerCase();
      let targetCatName = "";

      if (sugCategory.includes("fruit") || sugCategory.includes("lgume") || sugCategory.includes("vegetable") || sugCategory.includes("agri")) {
        targetCatName = "Fruits & Lgumes";
      } else if (sugCategory.includes("anim") || sugCategory.includes("levage") || sugCategory.includes("poisson") || sugCategory.includes("aquaculture") || sugCategory.includes("insecte")) {
        targetCatName = "levage";
      } else if (sugCategory.includes("crale") || sugCategory.includes("grain") || sugCategory.includes("graines")) {
        targetCatName = "Crales";
      } else if (sugCategory.includes("tubercule") || sugCategory.includes("manioc") || sugCategory.includes("patate")) {
        targetCatName = "Tubercules";
      }

      if (targetCatName) {
        const found = categories.find((c) => c.name.toLowerCase() === targetCatName.toLowerCase());
        if (found) {
          updated.category_id = found.id;
        }
      }
      return updated;
    });
    setShowSuggestions(false);
  };

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Charger les catgories au montage
  React.useEffect(() => {
    const fetchCats = async () => {
      try {
        const res = await api.get("/search/categories");
        setCategories(res.data);
        if (res.data.length > 0 && !formData.category_id) {
          setFormData(prev => ({ ...prev, category_id: res.data[0].id }));
        }
      } catch (err) {
        console.error("Erreur catgories");
      }
    };
    fetchCats();

    // Capture location
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition((pos) => {
        setFormData(prev => ({
          ...prev,
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude
        }));
      });
    }
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (selectedMedias.length + files.length > 10) {
      setError("Maximum 10 mdias autoriss.");
      return;
    }
    setSelectedMedias([...selectedMedias, ...files]);
    const newPreviews = files.map((file) => URL.createObjectURL(file));
    setPreviews([...previews, ...newPreviews]);
  };

  const removeMedia = (index: number) => {
    const newMedias = [...selectedMedias];
    newMedias.splice(index, 1);
    setSelectedMedias(newMedias);
    const newPreviews = [...previews];
    URL.revokeObjectURL(newPreviews[index]);
    newPreviews.splice(index, 1);
    setPreviews(newPreviews);
  };

  // Draft persistence is now handled by usePersistentState

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const mediaUrls: string[] = [];

      for (const file of selectedMedias) {
        const uploadFormData = new FormData();
        uploadFormData.append("file", file, file.name);

        const uploadRes = await api.post("/media/upload", uploadFormData);
        mediaUrls.push(uploadRes.data.url);
      }

      await api.post("/products", {
        ...formData,
        name: formData.title,
        price: parseFloat(formData.price),
        quantity_available: parseFloat(formData.quantity),
        media_urls: mediaUrls,
      });

      // Effacer le brouillon après succès
      sessionStorage.removeItem("product_create_draft");
      toast.success("Produit publié avec succès !");
      setTimeout(() => navigate("/seller/dashboard"), 1500);

    } catch (err: any) {
      const errorMsg = err.response?.data?.detail || "Erreur lors de la création du produit.";
      setError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="create-product-wrapper dashboard-wrapper">
      <header className="dashboard-header" style={{ padding: '0 2rem', height: '64px', display: 'flex', alignItems: 'center', background: 'var(--surface)', borderBottom: '1px solid var(--border-color)' }}>
        <button onClick={() => navigate(-1)} className="btn-icon" style={{ background: 'var(--surface-hover)', border: 'none', padding: '8px', borderRadius: '50%', cursor: 'pointer', marginRight: '1rem' }}>
          <ChevronLeft />
        </button>
        <h1 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Vendre un nouveau produit</h1>
      </header>

      <main className="create-product-container dashboard-content">
        <h2 className="create-product-title">Lancez votre annonce</h2>

        <div className="product-form-card">
          {error && (
            <div className="error-alert" style={{ background: 'rgba(239, 68, 68, 0.05)', color: '#EF4444', padding: '1rem', borderRadius: '12px', marginBottom: '1.5rem', display: 'flex', gap: '10px', alignItems: 'center', fontSize: '14px', border: '1px solid rgba(239, 68, 68, 0.1)' }}>
              <AlertCircle size={20} /> <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmitForm}>
            <div className="form-group" style={{ position: "relative" }} ref={dropdownRef}>
              <label className="form-label">Quel produit vendez-vous ?</label>
              <div className="search-bar-wrapper" style={{ margin: 0, width: '100%' }}>
                <input
                  className="form-input"
                  placeholder="Ex: Sac de Mas, Poulets, Tomates..."
                  value={formData.title}
                  onChange={(e) => handleTitleChange(e.target.value)}
                  onFocus={() => { if (suggestions.length > 0) setShowSuggestions(true); }}
                  required
                  autoComplete="off"
                />
              </div>
              {isLoadingSuggestions && (
                <div style={{ position: 'absolute', right: '12px', top: '40px' }}>
                  <Loader2 className="spinner" size={16} />
                </div>
              )}
              {showSuggestions && (
                <div className="autocomplete-dropdown">
                  {suggestions.map((sug, i) => (
                    <div key={i} className="suggestion-item" onClick={() => handleSelectSuggestion(sug)}>
                      <span className="suggestion-name">{sug.label}</span>
                      <span className="suggestion-category-tag">{sug.domain}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="form-group">
              <label className="form-label">Catgorie du produit</label>
              <select
                className="form-input"
                value={formData.category_id}
                onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
              >
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Description détaillée</label>
              <textarea
                className="form-textarea"
                rows={4}
                placeholder="Dcrivez l'origine, la fracheur, la varit..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                required
              />
            </div>

            <div className="price-unit-row">
              <div className="form-group">
                <label className="form-label">Prix unitaire (FCFA)</label>
                <input
                  type="number"
                  className="form-input"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Unit de mesure</label>
                <select
                  className="form-input"
                  value={formData.unit}
                  onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                >
                  <option value="kg">kilogramme (kg)</option>
                  <option value="tonnes">Tonnes (T)</option>
                  <option value="sac">Sac</option>
                  <option value="seau">Seau</option>
                  <option value="unit">Unit / Tte</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Quantit en stock</label>
              <input
                type="number"
                className="form-input"
                value={formData.quantity}
                onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                required
              />
            </div>

            <div className="form-group" style={{ marginTop: '2rem' }}>
              <label className="form-label">Photos & Vidos (Minimum 1)</label>
              <div className="media-upload-section" onClick={() => fileInputRef.current?.click()}>
                <ImagePlus size={40} style={{ marginBottom: '10px' }} />
                <span className="upload-main-text">Capturez vos produits</span>
                <span className="upload-sub-text">Cliquez pour ajouter du contenu mdia</span>
                <input
                  type="file"
                  ref={fileInputRef}
                  style={{ display: "none" }}
                  multiple
                  accept="image/*,video/*"
                  onChange={handleFileChange}
                />
              </div>
              <div className="preview-grid">
                {previews.map((src, idx) => (
                  <div key={idx} className="preview-item">
                    {selectedMedias[idx]?.type?.startsWith("video/") ? (
                      <video src={src} className="preview-img" muted />
                    ) : (
                      <img src={src} className="preview-img" alt="p" />
                    )}
                    <div className="remove-media" onClick={(e) => { e.stopPropagation(); removeMedia(idx); }}>
                      <X size={14} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <button type="submit" className="btn-submit" disabled={isSubmitting || selectedMedias.length === 0}>
              {isSubmitting ? <Loader2 className="spinner" /> : "Mettre mon produit en vente"}
            </button>
          </form>
        </div>

        <aside className="create-sidebar">
          <div className="preview-card-sidebar">
            <h4 style={{ margin: '0 0 1rem', fontSize: '14px', fontWeight: 800 }}>Conseils de vente</h4>
            <ul style={{ padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <li style={{ fontSize: '13px', display: 'flex', gap: '8px' }}>
                <Info size={16} color="var(--primary)" style={{ flexShrink: 0 }} />
                Des photos claires et lumineuses attirent 3x plus d'acheteurs.
              </li>
              <li style={{ fontSize: '13px', display: 'flex', gap: '8px' }}>
                <Info size={16} color="var(--primary)" style={{ flexShrink: 0 }} />
                Soyez précis sur la localisation pour faciliter la livraison.
              </li>
            </ul>

            <div style={{ marginTop: '2rem', padding: '1rem', background: 'rgba(46, 125, 50, 0.05)', borderRadius: '12px', border: '1px solid var(--primary-light)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <BadgeCheck size={18} color="var(--primary)" />
                <span style={{ fontWeight: 800, fontSize: '13px', color: 'var(--primary)' }}>Vendeur de confiance</span>
              </div>
              <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)' }}>agrimarche sécurisée toutes vos transactions.</p>
            </div>
          </div>
        </aside>
      </main>
    </div>
  );
}
