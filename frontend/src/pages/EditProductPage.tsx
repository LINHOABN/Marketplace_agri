import React, { useState, useRef, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import { ImagePlus, X, Loader2, AlertCircle, ChevronLeft, CheckCircle } from "lucide-react";
import { toast } from "react-hot-toast";
import { API_URL } from "../config";
import { usePersistentState } from "../hooks/usePersistentState";
import "./CreateProductPage.css";

export default function EditProductPage() {
    const navigate = useNavigate();
    const { id } = useParams<{ id: string }>();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [formData, setFormData] = usePersistentState(`product_edit_draft_${id}`, {
        title: "",
        description: "",
        category_id: "",
        price: "",
        quantity: "",
        unit: "kg",
    });

    const [existingImages, setExistingImages] = useState<string[]>([]);
    const [selectedMedias, setSelectedMedias] = useState<File[]>([]);
    const [previews, setPreviews] = useState<string[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [categories, setCategories] = useState<any[]>([]);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [productRes, catsRes] = await Promise.all([
                    axios.get(`${API_URL}/products/${id}`),
                    axios.get(`${API_URL}/search/categories`),
                ]);
                const p = productRes.data;
                // Only set if we don't have a newer draft or if it's the first load
                setFormData(prev => ({
                    title: prev.title || p.name || "",
                    description: prev.description || p.description || "",
                    category_id: prev.category_id || p.category_id || "",
                    price: prev.price || String(p.price || ""),
                    quantity: prev.quantity || String(p.quantity_available || ""),
                    unit: prev.unit || p.unit || "kg",
                }));
                // Collect existing images
                const imgs: string[] = [];
                if (p.image_url) imgs.push(p.image_url);
                if (p.media_urls) {
                    try {
                        const parsed = typeof p.media_urls === "string" ? JSON.parse(p.media_urls) : p.media_urls;
                        if (Array.isArray(parsed)) imgs.push(...parsed);
                    } catch { }
                }
                setExistingImages([...new Set(imgs)]);
                setCategories(catsRes.data);
            } catch (err) {
                toast.error("Impossible de charger le produit");
                navigate("/seller/dashboard");
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, [id]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        setSelectedMedias([...selectedMedias, ...files]);
        const newPreviews = files.map((f) => URL.createObjectURL(f));
        setPreviews([...previews, ...newPreviews]);
    };

    const removeNewMedia = (index: number) => {
        const newMedias = [...selectedMedias];
        newMedias.splice(index, 1);
        setSelectedMedias(newMedias);
        const newPreviews = [...previews];
        URL.revokeObjectURL(newPreviews[index]);
        newPreviews.splice(index, 1);
        setPreviews(newPreviews);
    };

    const removeExistingImage = (index: number) => {
        const newImgs = [...existingImages];
        newImgs.splice(index, 1);
        setExistingImages(newImgs);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        setError(null);
        try {
            const token = localStorage.getItem("access_token");
            const newMediaUrls: string[] = [];

            for (const file of selectedMedias) {
                const fd = new FormData();
                fd.append("file", file, file.name);
                const res = await axios.post(`${API_URL}/media/upload`, fd, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                newMediaUrls.push(res.data.url);
            }

            const allMediaUrls = [...existingImages, ...newMediaUrls];

            await axios.put(
                `${API_URL}/products/${id}`,
                {
                    name: formData.title,
                    description: formData.description,
                    category_id: formData.category_id,
                    price: parseFloat(formData.price),
                    quantity_available: parseFloat(formData.quantity),
                    unit: formData.unit,
                    media_urls: allMediaUrls,
                    image_url: allMediaUrls[0] || null,
                },
                { headers: { Authorization: `Bearer ${token}` } }
            );

            toast.success("Produit mis à jour !");
            sessionStorage.removeItem(`product_edit_draft_${id}`);
            setTimeout(() => navigate("/seller/dashboard"), 1000);
        } catch (err: any) {
            const msg = err.response?.data?.detail || "Erreur lors de la mise à jour.";
            setError(msg);
            toast.error(msg);
        } finally {
            setIsSubmitting(false);
        }
    };

    if (isLoading) {
        return (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
                <Loader2 className="spinner" size={40} color="var(--primary)" />
            </div>
        );
    }

    return (
        <div className="create-product-wrapper dashboard-wrapper">
            <header className="dashboard-header" style={{ padding: "0 2rem", height: "64px", display: "flex", alignItems: "center", background: "var(--surface)", borderBottom: "1px solid var(--border-color)" }}>
                <button onClick={() => navigate(-1)} className="btn-icon" style={{ background: "var(--surface-hover)", border: "none", padding: "8px", borderRadius: "50%", cursor: "pointer", marginRight: "1rem" }}>
                    <ChevronLeft />
                </button>
                <h1 style={{ fontSize: "1.25rem", fontWeight: 800 }}>Modifier le produit</h1>
            </header>

            <main className="create-product-container dashboard-content">
                <h2 className="create-product-title">Mettre à jour votre annonce</h2>

                <div className="product-form-card">
                    {error && (
                        <div className="error-alert" style={{ background: "rgba(239,68,68,0.05)", color: "#EF4444", padding: "1rem", borderRadius: "12px", marginBottom: "1.5rem", display: "flex", gap: "10px", alignItems: "center", fontSize: "14px", border: "1px solid rgba(239,68,68,0.1)" }}>
                            <AlertCircle size={20} /> <span>{error}</span>
                        </div>
                    )}

                    <form onSubmit={handleSubmit}>
                        <div className="form-group">
                            <label className="form-label">Nom du produit</label>
                            <input className="form-input" value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} required />
                        </div>

                        <div className="form-group">
                            <label className="form-label">Catégorie</label>
                            <select className="form-input" value={formData.category_id} onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}>
                                {categories.map((cat) => (
                                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                                ))}
                            </select>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Description</label>
                            <textarea className="form-textarea" rows={4} value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} required />
                        </div>

                        <div className="price-unit-row">
                            <div className="form-group">
                                <label className="form-label">Prix (FCFA)</label>
                                <input type="number" className="form-input" value={formData.price} onChange={(e) => setFormData({ ...formData, price: e.target.value })} required />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Unité</label>
                                <select className="form-input" value={formData.unit} onChange={(e) => setFormData({ ...formData, unit: e.target.value })}>
                                    <option value="kg">kilogramme (kg)</option>
                                    <option value="tonnes">Tonnes (T)</option>
                                    <option value="sac">Sac</option>
                                    <option value="seau">Seau</option>
                                    <option value="unité">Unité / Tête</option>
                                </select>
                            </div>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Quantité en stock</label>
                            <input type="number" className="form-input" value={formData.quantity} onChange={(e) => setFormData({ ...formData, quantity: e.target.value })} required />
                        </div>

                        {/* Existing images */}
                        {existingImages.length > 0 && (
                            <div className="form-group">
                                <label className="form-label">Images actuelles</label>
                                <div className="preview-grid">
                                    {existingImages.map((url, idx) => (
                                        <div key={idx} className="preview-item">
                                            <img src={url.startsWith("http") ? url : `${API_URL}${url}`} className="preview-img" alt="existing" />
                                            <div className="remove-media" onClick={() => removeExistingImage(idx)}>
                                                <X size={14} />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* New media uploads */}
                        <div className="form-group">
                            <label className="form-label">Ajouter de nouvelles photos</label>
                            <div className="media-upload-section" onClick={() => fileInputRef.current?.click()}>
                                <ImagePlus size={36} style={{ marginBottom: "8px" }} />
                                <span className="upload-main-text">Cliquez pour ajouter</span>
                                <input type="file" ref={fileInputRef} style={{ display: "none" }} multiple accept="image/*,video/*" onChange={handleFileChange} />
                            </div>
                            {previews.length > 0 && (
                                <div className="preview-grid" style={{ marginTop: "12px" }}>
                                    {previews.map((src, idx) => (
                                        <div key={idx} className="preview-item">
                                            <img src={src} className="preview-img" alt="new" />
                                            <div className="remove-media" onClick={() => removeNewMedia(idx)}>
                                                <X size={14} />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <button type="submit" className="btn-submit" disabled={isSubmitting}>
                            {isSubmitting ? <Loader2 className="spinner" /> : <><CheckCircle size={18} style={{ marginRight: "8px" }} /> Sauvegarder les modifications</>}
                        </button>
                    </form>
                </div>
            </main>
        </div>
    );
}
