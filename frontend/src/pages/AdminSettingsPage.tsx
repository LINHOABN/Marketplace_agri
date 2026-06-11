import { useState, useEffect } from "react";
import { ChevronLeft, Save, Info, Percent } from "lucide-react";
import { useNavigate } from "react-router-dom";
import api from "../api";
import toast from "react-hot-toast";

export default function AdminSettingsPage() {
    const navigate = useNavigate();
    const [settings, setSettings] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    // Form states
    const [commissionRate, setCommissionRate] = useState("0.05");

    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const res = await api.get("/admin/settings");
                setSettings(res.data);
                const comm = res.data.find((s: any) => s.key === "commission_rate");
                if (comm) setCommissionRate(comm.value);
            } catch (err) {
                console.error("Failed to fetch admin settings", err);
                toast.error("Erreur chargement des réglages");
            } finally {
                setLoading(false);
            }
        };
        fetchSettings();
    }, []);

    const handleSave = async (key: string, value: string) => {
        setIsSaving(true);
        try {
            await api.post("/admin/settings", { key, value });
            toast.success("Réglage mis à jour !");
        } catch (err) {
            toast.error("Erreur lors de la sauvegarde");
        } finally {
            setIsSaving(false);
        }
    };

    if (loading) return <div className="admin-loading" style={{ padding: '2rem', textAlign: 'center' }}>Chargement...</div>;

    return (
        <div className="admin-dashboard-wrapper">
            <header className="admin-header" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <button onClick={() => navigate(-1)} className="btn-icon" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '8px' }}>
                    <ChevronLeft size={24} />
                </button>
                <h1 style={{ fontSize: '1.5rem', fontWeight: 900 }}>Configuration de la Plateforme</h1>
            </header>

            <main className="admin-content" style={{ maxWidth: '800px', margin: '2rem auto' }}>
                <section className="settings-section" style={{ background: 'white', padding: '2rem', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1.5rem' }}>
                        <Percent size={24} color="var(--primary)" />
                        <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800 }}>Frais et Commissions</h2>
                    </div>

                    <div className="setting-card" style={{ border: '1px solid #eee', padding: '1.5rem', borderRadius: '8px' }}>
                        <div style={{ marginBottom: '1rem' }}>
                            <label style={{ display: 'block', fontWeight: 700, marginBottom: '0.5rem' }}>Taux de commission plateforme</label>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    max="1"
                                    value={commissionRate}
                                    onChange={(e) => setCommissionRate(e.target.value)}
                                    style={{ padding: '10px', borderRadius: '6px', border: '1px solid #ddd', width: '120px' }}
                                />
                                <span style={{ fontWeight: 600, color: '#666' }}>
                                    (Ex: 0.05 = 5%, 0.10 = 10%)
                                </span>
                            </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#e3f2fd', padding: '12px', borderRadius: '6px', color: '#1976d2', fontSize: '13px', marginBottom: '1.5rem' }}>
                            <Info size={16} />
                            <span>Ce taux sera appliqué à toutes les nouvelles statistiques et calculs de commission sur les ventes livrées.</span>
                        </div>

                        <button
                            className="btn btn-primary"
                            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 24px', fontWeight: 700 }}
                            onClick={() => handleSave("commission_rate", commissionRate)}
                            disabled={isSaving}
                        >
                            <Save size={18} />
                            {isSaving ? "Sauvegarde..." : "Appliquer le taux"}
                        </button>
                    </div>
                </section>

                <section style={{ marginTop: '2rem', padding: '1rem', background: '#fff9c4', borderRadius: '12px', borderLeft: '5px solid #fbc02d', color: '#827717', fontSize: '14px' }}>
                    <strong>Note :</strong> Les changements de taux n'affectent pas les transactions passées déjà enregistrées en base de données, mais uniquement l'affichage des revenus prévisionnels et les calculs futurs.
                </section>
            </main>
        </div>
    );
}
