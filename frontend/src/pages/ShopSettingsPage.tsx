import { useState, useEffect } from "react";
import { ChevronLeft, Store, Camera, Save, MapPin } from "lucide-react";
import LocationPickerModal from "../components/LocationPickerModal";
import { useNavigate } from "react-router-dom";
import api from "../api";
import { API_URL } from "../config";
import toast from "react-hot-toast";

export default function ShopSettingsPage() {
    const navigate = useNavigate();
    const [shopName, setShopName] = useState("");
    const [description, setDescription] = useState("");
    const [logoUrl, setLogoUrl] = useState("");
    const [bannerUrl, setBannerUrl] = useState("");
    const [shopCoords, setShopCoords] = useState<[number, number] | null>(null);
    const [showPicker, setShowPicker] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchShop = async () => {
            try {
                const res = await api.get("/auth/me");
                if (res.data.shop_name) setShopName(res.data.shop_name);
                if (res.data.description) setDescription(res.data.description);
                if (res.data.shop_logo) setLogoUrl(res.data.shop_logo);
                if (res.data.shop_banner) setBannerUrl(res.data.shop_banner);
                if (res.data.lat && res.data.lng) {
                    setShopCoords([res.data.lat, res.data.lng]);
                }
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        fetchShop();
    }, []);

    const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
            const formData = new FormData();
            formData.append("file", file);
            const res = await api.post("/media/upload", formData);
            setLogoUrl(res.data.url);
            toast.success("Logo téléchargé!");
        } catch (err) {
            toast.error("Erreur téléchargement logo");
        }
    };

    const handleBannerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
            const formData = new FormData();
            formData.append("file", file);
            const res = await api.post("/media/upload", formData);
            setBannerUrl(res.data.url);
            toast.success("Image de couverture téléchargée!");
        } catch (err) {
            toast.error("Erreur téléchargement couverture");
        }
    };

    const handleSave = async () => {
        if (!shopName) {
            toast.error("Le nom de la boutique est obligatoire.");
            return;
        }
        setIsSaving(true);
        try {
            await api.put("/shops/me", {
                name: shopName,
                description: description,
                logo_url: logoUrl,
                banner_url: bannerUrl,
                lat: shopCoords ? shopCoords[0] : null,
                lng: shopCoords ? shopCoords[1] : null
            });
            toast.success("Informations boutique enregistrées!");
            navigate("/seller/dashboard");
        } catch (err) {
            toast.error("Erreur lors de la sauvegarde.");
        } finally {
            setIsSaving(false);
        }
    };

    if (loading) return <div className="dashboard-wrapper">Chargement...</div>;

    return (
        <div className="dashboard-wrapper">
            <header className="dashboard-header" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <button onClick={() => navigate(-1)} className="btn-icon"><ChevronLeft /></button>
                <h1 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Paramètres de ma Boutique</h1>
            </header>

            {showPicker && (
                <LocationPickerModal
                    initialPos={shopCoords}
                    onClose={() => setShowPicker(false)}
                    onSelect={(pos) => {
                        setShopCoords(pos);
                        setShowPicker(false);
                        toast.success("Emplacement boutique mis à jour !");
                    }}
                />
            )}

            <main className="dashboard-content" style={{ maxWidth: '650px', margin: '0 auto' }}>
                {/* Section Bannière / Couverture */}
                <div style={{ position: 'relative', width: '100%', height: '180px', borderRadius: 'var(--radius-md)', background: '#e8f5e9', marginBottom: '4rem', overflow: 'visible' }}>
                    {bannerUrl ? (
                        <img
                            src={bannerUrl.startsWith('http') ? bannerUrl : `${API_URL}${bannerUrl}`}
                            alt="Couverture"
                            style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'var(--radius-md)' }}
                        />
                    ) : (
                        <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#aaa', fontSize: '13px', gap: '8px', borderRadius: 'var(--radius-md)' }}>
                            <Camera size={28} color="#aaa" />
                            Aucune image de couverture
                        </div>
                    )}

                    <label style={{
                        position: 'absolute',
                        top: '10px',
                        right: '10px',
                        background: 'rgba(255,255,255,0.92)',
                        color: 'var(--primary)',
                        padding: '7px 12px',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: '12px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px',
                        boxShadow: 'var(--shadow-sm)'
                    }}>
                        <Camera size={13} />
                        Changer la couverture
                        <input type="file" hidden accept="image/*" onChange={handleBannerUpload} />
                    </label>

                    {/* Logo superposé sur la bannière */}
                    <div style={{
                        position: 'absolute',
                        bottom: '-38px',
                        left: '20px',
                        display: 'flex',
                        alignItems: 'flex-end',
                        gap: '12px'
                    }}>
                        <div style={{ position: 'relative' }}>
                            <div style={{
                                width: '88px',
                                height: '88px',
                                borderRadius: 'var(--radius-md)',
                                background: 'white',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                overflow: 'hidden',
                                border: '3px solid white',
                                boxShadow: 'var(--shadow-md)'
                            }}>
                                {logoUrl ? (
                                    <img src={logoUrl.startsWith('http') ? logoUrl : `${API_URL}${logoUrl}`} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                ) : (
                                    <Store size={38} color="#ccc" />
                                )}
                            </div>
                            <label style={{
                                position: 'absolute',
                                bottom: '-4px',
                                right: '-4px',
                                background: 'var(--primary)',
                                color: 'white',
                                width: '26px',
                                height: '26px',
                                borderRadius: '50%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                boxShadow: 'var(--shadow-sm)',
                                border: '2px solid white'
                            }}>
                                <Camera size={13} />
                                <input type="file" hidden accept="image/*" onChange={handleLogoUpload} />
                            </label>
                        </div>
                        <div style={{ paddingBottom: '8px' }}>
                            <h2 style={{ fontSize: '1rem', margin: 0, fontWeight: 800, color: 'var(--text-dark)' }}>{shopName || "Ma Boutique"}</h2>
                            <p style={{ margin: 0, fontSize: '11px', color: '#777' }}>ID Vendeur visible par tous</p>
                        </div>
                    </div>
                </div>

                <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 700 }}>Nom de la Boutique</label>
                    <input
                        type="text"
                        className="form-input"
                        style={{ width: '100%', padding: '0.8rem', borderRadius: 'var(--radius-sm)', border: '1px solid #ddd' }}
                        value={shopName}
                        onChange={(e) => setShopName(e.target.value)}
                        placeholder="Ex: Plantation Saint-Joseph"
                    />
                </div>

                <div className="form-group" style={{ marginBottom: '2rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 700 }}>Description</label>
                    <textarea
                        className="form-input"
                        style={{ width: '100%', padding: '0.8rem', borderRadius: 'var(--radius-sm)', border: '1px solid #ddd', minHeight: '120px' }}
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Décrivez votre activité, vos produits phares..."
                    />
                </div>

                <div className="form-group" style={{ marginBottom: '2rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 700 }}>Emplacement Géographique</label>
                    <button
                        className="btn btn-secondary"
                        style={{ width: '100%', padding: '0.8rem', display: 'flex', alignItems: 'center', gap: '10px' }}
                        onClick={() => setShowPicker(true)}
                    >
                        <MapPin size={20} color="var(--primary)" />
                        {shopCoords ? `Épingle placée (${shopCoords[0].toFixed(4)}, ${shopCoords[1].toFixed(4)})` : "Marquer l'emplacement sur la carte"}
                    </button>
                    <p style={{ marginTop: '5px', fontSize: '11px', color: '#888' }}>
                        Cela permet aux livreurs de trouver exactement votre point de vente.
                    </p>
                </div>

                <button
                    className="btn btn-primary"
                    style={{ width: '100%', padding: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', fontWeight: 800 }}
                    onClick={handleSave}
                    disabled={isSaving}
                >
                    <Save size={20} />
                    {isSaving ? "Enregistrement..." : "Sauvegarder les modifications"}
                </button>
            </main>
        </div>
    );
}
