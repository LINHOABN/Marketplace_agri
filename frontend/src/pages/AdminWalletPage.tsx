import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, Wallet, ArrowUpRight, History, Plus, Lock } from "lucide-react";
import api from "../api";
import toast from "react-hot-toast";

export default function AdminWalletPage() {
    const navigate = useNavigate();
    const [data, setData] = useState({ balance: 0, locked_balance: 0 });
    const [transactions, setTransactions] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showWithdraw, setShowWithdraw] = useState(false);

    // Withdraw form state
    const [withdrawAmount, setWithdrawAmount] = useState("");
    const [withdrawPhone, setWithdrawPhone] = useState("");
    const [withdrawPin, setWithdrawPin] = useState("");

    const fetchWalletData = async () => {
        try {
            const [walletRes, transRes] = await Promise.all([
                api.get("/wallet/"),
                api.get("/wallet/transactions"),
            ]);
            setData(walletRes.data);
            setTransactions(transRes.data);
        } catch (err) {
            console.error("Admin wallet error", err);
            toast.error("Erreur lors du chargement du portefeuille");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchWalletData();
    }, []);

    const handleWithdraw = async () => {
        const amount = parseFloat(withdrawAmount) || 0;
        if (!amount || !withdrawPhone || !withdrawPin) {
            toast.error("Veuillez remplir tous les champs.");
            return;
        }
        if (amount > data.balance) {
            toast.error("Solde insuffisant.");
            return;
        }

        // Simulation de retrait pour la démo
        try {
            await api.post("/wallet/withdraw", {
                amount,
                phone: withdrawPhone,
                pin: withdrawPin
            });
            setShowWithdraw(false);
            toast.success("Demande de retrait effectuée !");
            fetchWalletData();
        } catch (err: any) {
            toast.error(err.response?.data?.error || "Erreur lors du retrait");
        }
    };

    if (loading) return <div className="admin-loading" style={{ padding: '2rem', textAlign: 'center' }}>Chargement...</div>;

    return (
        <div className="admin-dashboard-wrapper">
            <header className="admin-header" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <button onClick={() => navigate(-1)} className="btn-icon" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '8px' }}>
                    <ChevronLeft size={24} />
                </button>
                <h1 style={{ fontSize: '1.5rem', fontWeight: 900 }}>Portefeuille de la Plateforme</h1>
            </header>

            <main className="admin-content" style={{ maxWidth: '900px', margin: '2rem auto' }}>
                {/* Balance Hero Section */}
                <section className="balance-hero-card" style={{ background: 'linear-gradient(135deg, #4F46E5, #3730A3)', color: 'white', padding: '2.5rem', borderRadius: '20px', boxShadow: '0 10px 25px rgba(79, 70, 229, 0.3)', marginBottom: '2rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                            <p style={{ opacity: 0.8, fontSize: '0.9rem', marginBottom: '0.5rem' }}>Commissions accumulées</p>
                            <h2 style={{ fontSize: '2.5rem', fontWeight: 900, margin: 0 }}>{(data.balance || 0).toLocaleString()} FCFA</h2>
                        </div>
                        <div style={{ background: 'rgba(255,255,255,0.2)', padding: '12px', borderRadius: '15px' }}>
                            <Wallet size={32} />
                        </div>
                    </div>

                    <div style={{ marginTop: '2rem', display: 'flex', gap: '1rem' }}>
                        <button
                            onClick={() => setShowWithdraw(true)}
                            style={{ background: 'white', color: '#4F46E5', border: 'none', padding: '12px 24px', borderRadius: '10px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', boxShadow: '0 4px 10px rgba(0,0,0,0.1)' }}
                        >
                            <ArrowUpRight size={18} />
                            Effectuer un retrait
                        </button>
                    </div>
                </section>

                {/* Transactions History */}
                <section className="transactions-section" style={{ background: 'white', padding: '2rem', borderRadius: '20px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1.5rem' }}>
                        <History size={24} color="var(--primary)" />
                        <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800 }}>Historique des Revenus</h2>
                    </div>

                    <div className="transaction-list">
                        {transactions.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '3rem', color: '#999' }}>
                                <p>Aucune transaction enregistrée.</p>
                            </div>
                        ) : (
                            transactions.map((t) => (
                                <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem', borderBottom: '1px solid #f0f0f0' }}>
                                    <div style={{
                                        width: '40px',
                                        height: '40px',
                                        borderRadius: '10px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        background: t.amount > 0 ? '#ECFDF5' : '#FEF2F2',
                                        color: t.amount > 0 ? '#10B981' : '#EF4444'
                                    }}>
                                        {t.amount > 0 ? <Plus size={20} /> : <ArrowUpRight size={20} />}
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <p style={{ margin: 0, fontWeight: 700, fontSize: '0.95rem' }}>{t.description || "Commission Plateforme"}</p>
                                        <small style={{ color: '#999' }}>{new Date(t.created_at).toLocaleString()}</small>
                                    </div>
                                    <div style={{
                                        fontWeight: 800,
                                        fontSize: '1.1rem',
                                        color: t.amount > 0 ? '#10B981' : '#EF4444'
                                    }}>
                                        {t.amount > 0 ? '+' : ''}{t.amount.toLocaleString()} FCFA
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </section>
            </main>

            {/* Withdrawal Modal */}
            {showWithdraw && (
                <div className="modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                    <div className="modal-content" style={{ background: 'white', padding: '2rem', borderRadius: '20px', width: '100%', maxWidth: '400px', boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }}>
                        <h3 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '1.5rem', textAlign: 'center' }}>Retirer de l'argent</h3>

                        <div style={{ marginBottom: '1rem' }}>
                            <label style={{ display: 'block', fontWeight: 700, marginBottom: '0.5rem', fontSize: '0.9rem' }}>Montant (FCFA)</label>
                            <input
                                type="number"
                                placeholder="Ex: 5000"
                                value={withdrawAmount}
                                onChange={(e) => setWithdrawAmount(e.target.value)}
                                style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #ddd', fontSize: '1rem' }}
                            />
                        </div>

                        <div style={{ marginBottom: '1rem' }}>
                            <label style={{ display: 'block', fontWeight: 700, marginBottom: '0.5rem', fontSize: '0.9rem' }}>Numéro Mobile Money</label>
                            <input
                                type="text"
                                placeholder="Ex: 677777777"
                                value={withdrawPhone}
                                onChange={(e) => setWithdrawPhone(e.target.value)}
                                style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #ddd', fontSize: '1rem' }}
                            />
                        </div>

                        <div style={{ marginBottom: '1.5rem' }}>
                            <label style={{ display: 'block', fontWeight: 700, marginBottom: '0.5rem', fontSize: '0.9rem' }}>Code PIN de sécurité</label>
                            <input
                                type="password"
                                placeholder="Entrez votre PIN"
                                value={withdrawPin}
                                onChange={(e) => setWithdrawPin(e.target.value)}
                                style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #ddd', fontSize: '1rem' }}
                            />
                            <p style={{ margin: '8px 0 0', fontSize: '12px', color: '#666' }}>Astuce démo : Utilisez '1234'</p>
                        </div>

                        <button
                            onClick={handleWithdraw}
                            style={{ width: '100%', background: '#4F46E5', color: 'white', border: 'none', padding: '15px', borderRadius: '12px', fontWeight: 800, fontSize: '1rem', cursor: 'pointer', marginBottom: '10px' }}
                        >
                            Confirmer le retrait
                        </button>

                        <button
                            onClick={() => setShowWithdraw(false)}
                            style={{ width: '100%', background: 'none', border: 'none', color: '#999', fontWeight: 700, cursor: 'pointer', padding: '10px' }}
                        >
                            Annuler
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
