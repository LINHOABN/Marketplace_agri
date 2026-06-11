import { useState, useEffect } from "react";
import api from "../api";
import { ChevronLeft, Plus, Trash2, Lightbulb, Save, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";

export default function AdminTipsPage() {
    const navigate = useNavigate();
    const [tips, setTips] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    // Form state
    const [showForm, setShowForm] = useState(false);
    const [emoji, setEmoji] = useState("💡");
    const [title, setTitle] = useState("");
    const [text, setText] = useState("");
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        fetchTips();
    }, []);

    const fetchTips = async () => {
        try {
            const res = await api.get("/admin-tips/");
            setTips(res.data);
        } catch (err) {
            console.error(err);
            toast.error("Erreur lors du chargement des conseils");
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!title || !text) return toast.error("Veuillez remplir tous les champs");

        setSubmitting(true);
        try {
            await api.post("/admin-tips/", { emoji, title, text });
            toast.success("Conseil publié !");
            setShowForm(false);
            setTitle("");
            setText("");
            fetchTips();
        } catch (err) {
            toast.error("Erreur de publication");
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (id: number) => {
        if (!window.confirm("Supprimer ce conseil ?")) return;
        try {
            await api.delete(`/admin-tips/${id}`);
            toast.success("Conseil supprimé");
            setTips(tips.filter(t => t.id !== id));
        } catch (err) {
            toast.error("Erreur de suppression");
        }
    };

    return (
        <div className="admin-page-container" style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
            <header style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
                <button onClick={() => navigate(-1)} className="btn-ghost" style={{ padding: '8px' }}>
                    <ChevronLeft size={24} />
                </button>
                <h1 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Gestion des Conseils Agricoles</h1>
            </header>

            <button
                className="btn btn-primary"
                style={{ marginBottom: '2rem', width: 'auto' }}
                onClick={() => setShowForm(true)}
            >
                <Plus size={20} /> Nouveau Conseil
            </button>

            {showForm && (
                <div className="card animate-fade-up" style={{ padding: '1.5rem', marginBottom: '2rem', background: 'var(--surface-hover)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                        <h3 style={{ fontSize: '1.1rem' }}>Publier un conseil</h3>
                        <button onClick={() => setShowForm(false)} className="btn-ghost"><X size={20} /></button>
                    </div>
                    <form onSubmit={handleSubmit}>
                        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
                            <div style={{ width: '80px' }}>
                                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '4px' }}>Emoji</label>
                                <input
                                    className="input-field"
                                    value={emoji}
                                    onChange={(e) => setEmoji(e.target.value)}
                                    maxLength={2}
                                />
                            </div>
                            <div style={{ flex: 1 }}>
                                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '4px' }}>Titre</label>
                                <input
                                    className="input-field"
                                    placeholder="Ex: Saison des pluies"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                />
                            </div>
                        </div>
                        <div style={{ marginBottom: '1.5rem' }}>
                            <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '4px' }}>Contenu du conseil</label>
                            <textarea
                                className="input-field"
                                style={{ minHeight: '100px', resize: 'vertical' }}
                                placeholder="Écrivez votre conseil ici..."
                                value={text}
                                onChange={(e) => setText(e.target.value)}
                            />
                        </div>
                        <button className="btn btn-primary" style={{ width: '100%' }} disabled={submitting}>
                            <Save size={20} /> {submitting ? "Publication..." : "Publier maintenant"}
                        </button>
                    </form>
                </div>
            )}

            <div className="tips-list">
                {loading ? (
                    <div className="skeleton" style={{ height: '100px', marginBottom: '1rem' }} />
                ) : tips.length === 0 ? (
                    <p style={{ textAlign: 'center', color: '#888', padding: '2rem' }}>Aucun conseil publié pour le moment.</p>
                ) : (
                    tips.map(tip => (
                        <div key={tip.id} className="card hover-lift" style={{ padding: '1rem', marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                                <span style={{ fontSize: '24px' }}>{tip.emoji}</span>
                                <div>
                                    <h4 style={{ margin: 0, fontSize: '1rem' }}>{tip.title}</h4>
                                    <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#666' }}>{tip.text.substring(0, 80)}...</p>
                                </div>
                            </div>
                            <button
                                onClick={() => handleDelete(tip.id)}
                                style={{ padding: '8px', color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer' }}
                            >
                                <Trash2 size={20} />
                            </button>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
