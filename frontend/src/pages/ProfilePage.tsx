import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
    Mail, Phone, MapPin, Camera,
    Shield, ShoppingBag,
    Settings, LogOut, ChevronRight, Pencil, RefreshCw
} from "lucide-react";

import { useUser } from "../hooks/useUser";
import api from "../api";
import toast from "react-hot-toast";
import "./ProfilePage.css";

export default function ProfilePage() {
    const navigate = useNavigate();
    const { currentUser, logout, switchRole, refreshUser, getInitials, getAvatarSrc } = useUser();
    const [isEditing, setIsEditing] = useState(false);
    const [formData, setFormData] = useState({
        name: "",
        city: "",
        description: "",
        phone: ""
    });
    const [isSaving, setIsSaving] = useState(false);


    useEffect(() => {
        if (currentUser) {
            setFormData({
                name: currentUser.name || "",
                city: currentUser.city || "",
                description: currentUser.description || "",
                phone: currentUser.phone || ""
            });
        }
    }, [currentUser]);

    const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const uploadData = new FormData();
        uploadData.append("file", file);

        const loadingId = toast.loading("Mise à jour de la photo...");
        try {
            const res = await api.post("/media/upload", uploadData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            const avatarUrl = res.data.url;
            await api.put("/auth/me", { avatar_url: avatarUrl });
            await refreshUser();
            toast.success("Photo de profil mise à jour !", { id: loadingId });
        } catch (err: any) {
            console.error("Détails de l'erreur upload:", err.response?.data || err);
            const errMsg = err.response?.data?.detail || "Erreur lors de l'envoi de la photo";
            toast.error(errMsg, { id: loadingId });
        }
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await api.put("/auth/me", formData);
            await refreshUser();
            setIsEditing(false);
            toast.success("Profil mis à jour avec succès !");
        } catch {
            toast.error("Erreur lors de la mise à jour du profil");
        } finally {
            setIsSaving(false);
        }
    };

    if (!currentUser) return <div className="profile-loader">Chargement...</div>;


    return (
        <div className="profile-page-wrapper">
            <header className="profile-header">
                <h1>Mon Profil</h1>
                <button className="logout-btn" onClick={logout} title="Déconnexion">
                    <LogOut size={20} />
                </button>
            </header>

            <main className="profile-content">
                <div className={`profile-hero ${isEditing ? 'editing' : ''}`}>
                    <div className="profile-avatar-wrapper" onClick={() => document.getElementById('avatar-input')?.click()}>
                        <input
                            type="file"
                            id="avatar-input"
                            hidden
                            accept="image/*"
                            onChange={handleAvatarChange}
                        />
                        {currentUser.avatar_url ? (
                            <img src={getAvatarSrc(currentUser.avatar_url) || ""} alt={currentUser.name} />
                        ) : (
                            <div className="avatar-placeholder-large">{getInitials(currentUser.name)}</div>
                        )}
                        <div className="edit-avatar">
                            <Camera size={20} />
                        </div>
                    </div>

                    <div className="profile-info">
                        {!isEditing ? (
                            <>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                    <h2 style={{ margin: 0 }}>
                                        {currentUser.name}
                                    </h2>
                                    <button
                                        className="btn btn-secondary"
                                        style={{ padding: '4px 10px', fontSize: '12px', height: 'auto' }}
                                        onClick={() => setIsEditing(true)}
                                    >
                                        <Pencil size={12} style={{ marginRight: '4px' }} />
                                        Modifier
                                    </button>
                                </div>
                                <p className="profile-email"><Mail size={14} /> {currentUser.email}</p>
                                <p className="profile-phone"><Phone size={14} /> {currentUser.phone || "Aucun numéro"}</p>

                                <div className="profile-id-box">
                                    <code style={{ fontSize: '11px', color: '#64748b' }}>#{currentUser.id?.slice(0, 8)}</code>
                                    <button
                                        onClick={() => {
                                            navigator.clipboard.writeText(currentUser.id);
                                            toast.success("ID copié !");
                                        }}
                                        className="btn-text"
                                    >
                                        Copier l'ID
                                    </button>
                                </div>

                                <div className="profile-badges">
                                    <div className="badge location">
                                        <MapPin size={12} /> {currentUser.city || "Ville non précisée"}
                                    </div>
                                    <div className={`badge role-badge ${currentUser.role}`}>
                                        <Shield size={12} /> {currentUser.role === 'admin' ? 'Administrateur' : currentUser.role === 'seller' ? 'Vendeur' : currentUser.role === 'deliverer' ? 'Livreur' : 'Acheteur'}
                                    </div>
                                    {currentUser.is_verified ? (
                                        <div className="badge verified">
                                            <Shield size={12} /> Vérifié
                                        </div>
                                    ) : (
                                        <div
                                            className="badge unverified"
                                            onClick={() => navigate("/verify-profile")}
                                            title="Cliquer pour vérifier votre identité"
                                        >
                                            <Shield size={12} /> Non vérifié
                                        </div>
                                    )}
                                </div>
                            </>
                        ) : (
                            <div className="profile-edit-form" onClick={(e) => e.stopPropagation()}>
                                <div className="form-group">
                                    <label>Nom complet</label>
                                    <input
                                        type="text"
                                        className="edit-profile-input"
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        placeholder="Nom complet"
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Téléphone</label>
                                    <input
                                        type="text"
                                        className="edit-profile-input"
                                        value={formData.phone}
                                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                        placeholder="+237 ..."
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Ville</label>
                                    <input
                                        type="text"
                                        className="edit-profile-input"
                                        value={formData.city}
                                        onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                                        placeholder="Ville"
                                    />
                                </div>
                                <div className="edit-form-buttons">
                                    <button className="save-profile-btn" onClick={handleSave} disabled={isSaving}>
                                        {isSaving ? "Enregistrement..." : "Enregistrer"}
                                    </button>
                                    <button className="cancel-profile-btn" onClick={() => setIsEditing(false)}>
                                        Annuler
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div className="profile-actions-grid">
                    <section className="profile-menu">
                        {/* CHANGEMENT DE RÔLE (Si PAS admin) */}
                        {(() => {
                            const grantedRoles = currentUser.granted_roles ?? (currentUser.base_role ? [currentUser.base_role] : []);
                            const hasAdminRights = grantedRoles.includes("admin");

                            // Si admin, on donne accès à tous les rôles pour le test
                            const proRoles = hasAdminRights
                                ? ["seller", "deliverer"]
                                : grantedRoles.filter(r => r !== "buyer" && r !== "admin");

                            const isInProMode = currentUser.role !== "buyer" && currentUser.role !== "admin";
                            const isCurrentlyAdmin = currentUser.role === "admin";

                            return (
                                <>
                                    {/* Revenir en mode Acheteur */}
                                    {(isInProMode || (isCurrentlyAdmin && hasAdminRights)) && (
                                        <MenuItem
                                            icon={<RefreshCw size={20} />}
                                            title="Passer en mode Acheteur"
                                            subtitle={`Mode actuel : ${currentUser.role}`}
                                            onClick={async () => {
                                                try {
                                                    await switchRole("buyer");
                                                    toast.success("Mode Acheteur activé");
                                                    navigate("/feed");
                                                } catch {
                                                    toast.error("Erreur - Impossible de basculer");
                                                }
                                            }}
                                        />
                                    )}

                                    {/* Revenir au Panel Admin */}
                                    {hasAdminRights && !isCurrentlyAdmin && (
                                        <MenuItem
                                            icon={<Shield size={20} />}
                                            title="Revenir au Panel Admin"
                                            subtitle="Reprendre les commandes globales"
                                            onClick={async () => {
                                                try {
                                                    await switchRole("admin");
                                                    toast.success("Console d'administration activée");
                                                    navigate("/admin/dashboard");
                                                } catch {
                                                    toast.error("Échec de l'activation Admin");
                                                }
                                            }}
                                        />
                                    )}

                                    {/* Activer les modes Pro */}
                                    {proRoles.map(role => (
                                        role !== currentUser.role && (
                                            <MenuItem
                                                key={role}
                                                icon={<RefreshCw size={20} />}
                                                title={`Passer en mode ${role === 'seller' ? 'Vendeur' : 'Livreur'}`}
                                                subtitle={`Accéder au tableau de bord ${role}`}
                                                onClick={async () => {
                                                    try {
                                                        await switchRole(role);
                                                        toast.success(`Mode ${role} activé`);
                                                        navigate(role === "seller" ? "/seller/dashboard" : "/deliverer/dashboard");
                                                    } catch {
                                                        toast.error("Erreur - Vérifiez vos droits");
                                                    }
                                                }}
                                            />
                                        )
                                    ))}
                                </>
                            );
                        })()}

                        {/* ACHATS (Buyer only visible) */}
                        {currentUser.role === "buyer" && (
                            <MenuItem
                                icon={<ShoppingBag size={20} />}
                                title="Mes achats"
                                subtitle="Suivi et historique des commandes"
                                onClick={() => navigate("/history")}
                            />
                        )}

                        <MenuItem
                            icon={<Settings size={20} />}
                            title="Paramètres & Sécurité"
                            subtitle="Notifications, mot de passe et plus"
                            onClick={() => navigate("/settings")}
                        />
                    </section>

                    {currentUser.role === "deliverer" && (
                        <section className="profile-menu deliverer-link-section">
                            <div className="menu-item" style={{ border: "none", cursor: "default" }}>
                                <div className="icon-bg" style={{ background: "#e0f2fe" }}>
                                    <Shield size={20} color="#0369a1" />
                                </div>
                                <div className="text">
                                    <h4>Liaison Vendeur</h4>
                                    <p>{currentUser.managed_by_id ? "Déjà lié à un marchand" : "Non lié à un marchand"}</p>
                                </div>
                            </div>
                            <div style={{ padding: "0 1rem 1rem" }}>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <input
                                        type="text"
                                        placeholder="Coller l'ID du vendeur ici..."
                                        className="edit-profile-input"
                                        style={{ margin: 0, fontSize: '13px' }}
                                        id="seller-id-input"
                                    />
                                    <button
                                        className="save-profile-btn"
                                        style={{ width: 'auto', whiteSpace: 'nowrap' }}
                                        onClick={async () => {
                                            const input = document.getElementById('seller-id-input') as HTMLInputElement;
                                            const sid = input?.value.trim();
                                            if (!sid) return toast.error("Veuillez saisir un ID");
                                            try {
                                                await api.post("/auth/link-deliverer", { seller_id: sid });
                                                toast.success("Liaison réussie !");
                                                refreshUser();
                                            } catch (err: any) {
                                                toast.error(err.response?.data?.detail || "ID invalide ou erreur");
                                            }
                                        }}
                                    >
                                        Lier
                                    </button>
                                </div>
                                <p style={{ fontSize: '11px', color: '#64748b', marginTop: '8px' }}>
                                    Liez votre compte à un vendeur pour recevoir ses missions de livraison prioritaires.
                                </p>
                            </div>
                        </section>
                    )}

                </div>
            </main>
        </div>
    );
}

function MenuItem({ icon, title, subtitle, onClick }: {
    icon: React.ReactNode;
    title: string;
    subtitle: string;
    onClick: () => void;
}) {
    return (
        <div className="menu-item" onClick={onClick}>
            <div className="icon-bg">{icon}</div>
            <div className="text">
                <h4>{title}</h4>
                <p>{subtitle}</p>
            </div>
            <ChevronRight size={18} color="#CBD5E1" />
        </div>
    );
}
