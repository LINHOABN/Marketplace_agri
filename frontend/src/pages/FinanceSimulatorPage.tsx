import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
    ChevronLeft, Activity, Shield,
    ArrowDownCircle, RefreshCw,
    Database
} from "lucide-react";
import api from "../api";
import toast from "react-hot-toast";

export default function FinanceSimulatorPage() {
    const navigate = useNavigate();
    const [stats, setStats] = useState<any>(null);
    const [users, setUsers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);

    const [operationType, setOperationType] = useState<"deposit" | "checkout" | "withdrawal">("deposit");
    const [selectedUser, setSelectedUser] = useState("");
    const [depositAmount, setDepositAmount] = useState("");
    const [selectedStatusCode, setSelectedStatusCode] = useState("SUCCESS");

    const fetchData = async () => {
        try {
            const [statsRes, usersRes] = await Promise.all([
                api.get("/simulator/stats"),
                api.get("/simulator/users")
            ]);
            setStats(statsRes.data);
            setUsers(usersRes.data);
        } catch (err) {
            console.error("Simulator fetch error", err);
            toast.error("Erreur de chargement des données de simulation");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleSimulation = async () => {
        if (!selectedUser || !depositAmount) {
            toast.error("Veuillez sélectionner un utilisateur et un montant");
            return;
        }
        setActionLoading(true);
        try {
            let endpoint = "";
            let params = `user_id=${selectedUser}&amount=${depositAmount}&status_code=${selectedStatusCode}`;

            if (operationType === "deposit") endpoint = "/simulator/deposit";
            else if (operationType === "checkout") {
                endpoint = "/simulator/checkout";
                params = `buyer_id=${selectedUser}&amount=${depositAmount}&status_code=${selectedStatusCode}`;
            }
            else if (operationType === "withdrawal") endpoint = "/simulator/withdrawal";

            const res = await api.post(`${endpoint}?${params}`);

            if (res.data.success) {
                toast.success(`${operationType.toUpperCase()} réussi [${selectedStatusCode}]`);
            } else {
                toast.error(`Simulation échec : ${res.data.code || selectedStatusCode}`);
            }
            setDepositAmount("");
            fetchData();
        } catch (err: any) {
            toast.error(err.response?.data?.detail || "Erreur lors de la simulation");
        } finally {
            setActionLoading(false);
        }
    };

    if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}>Initialisation du simulateur financier...</div>;

    return (
        <div className="admin-dashboard-wrapper simulator-wrapper" style={{ background: '#f8fafc', minHeight: '100vh' }}>
            <header className="admin-header" style={{ background: '#1e293b', color: 'white', padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
                <button onClick={() => navigate(-1)} className="btn-icon" style={{ background: 'rgba(255,255,255,0.1)', border: 'none', cursor: 'pointer', padding: '8px', borderRadius: '8px', color: 'white' }}>
                    <ChevronLeft size={24} />
                </button>
                <div>
                    <h1 style={{ fontSize: '1.5rem', fontWeight: 900, margin: 0 }}>Simulateur de Logique Financière</h1>
                    <p style={{ margin: 0, opacity: 0.7, fontSize: '0.85rem' }}>Outil de validation des flux transactionnels et de l'escrow</p>
                </div>
            </header>

            <main style={{ maxWidth: '1200px', margin: '2rem auto', padding: '0 1.5rem' }}>

                {/* Visual Flow Indicators */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
                    <div style={{ background: 'white', padding: '1.5rem', borderRadius: '16px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', borderLeft: '6px solid #fbbf24' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px', color: '#92400e' }}>
                            <Database size={20} />
                            <span style={{ fontWeight: 800, textTransform: 'uppercase', fontSize: '0.75rem' }}>Compte Système (Cash)</span>
                        </div>
                        <h2 style={{ fontSize: '1.8rem', fontWeight: 900, margin: 0 }}>{(stats?.system_total || 0).toLocaleString()} FCFA</h2>
                        <p style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '5px' }}>Total des fonds réels détenus</p>
                    </div>

                    <div style={{ background: 'white', padding: '1.5rem', borderRadius: '16px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', borderLeft: '6px solid #4f46e5' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px', color: '#3730A3' }}>
                            <Shield size={20} />
                            <span style={{ fontWeight: 800, textTransform: 'uppercase', fontSize: '0.75rem' }}>Séquestre (Escrow)</span>
                        </div>
                        <h2 style={{ fontSize: '1.8rem', fontWeight: 900, margin: 0 }}>{(stats?.escrow_total || 0).toLocaleString()} FCFA</h2>
                        <p style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '5px' }}>Fonds bloqués en attente de livraison</p>
                    </div>

                    <div style={{ background: 'white', padding: '1.5rem', borderRadius: '16px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', borderLeft: '6px solid #10b981' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px', color: '#065f46' }}>
                            <Activity size={20} />
                            <span style={{ fontWeight: 800, textTransform: 'uppercase', fontSize: '0.75rem' }}>Revenus Plateforme (Commissions)</span>
                        </div>
                        <h2 style={{ fontSize: '1.8rem', fontWeight: 900, margin: 0 }}>{(stats?.admin_balance || 0).toLocaleString()} FCFA</h2>
                        <p style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '5px' }}>Profits nets accumulés (Admin)</p>
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '2rem' }}>

                    {/* Simulation Controls */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        <section style={{ background: 'white', padding: '1.5rem', borderRadius: '16px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
                            <div style={{ display: 'flex', gap: '5px', background: '#f1f5f9', padding: '5px', borderRadius: '12px', marginBottom: '1.5rem' }}>
                                <button
                                    onClick={() => setOperationType("deposit")}
                                    style={{ flex: 1, padding: '8px', borderRadius: '8px', border: 'none', background: operationType === 'deposit' ? 'white' : 'transparent', fontWeight: 700, cursor: 'pointer', boxShadow: operationType === 'deposit' ? '0 2px 4px rgba(0,0,0,0.1)' : 'none' }}
                                >Dépôt</button>
                                <button
                                    onClick={() => setOperationType("checkout")}
                                    style={{ flex: 1, padding: '8px', borderRadius: '8px', border: 'none', background: operationType === 'checkout' ? 'white' : 'transparent', fontWeight: 700, cursor: 'pointer', boxShadow: operationType === 'checkout' ? '0 2px 4px rgba(0,0,0,0.1)' : 'none' }}
                                >Paiement</button>
                                <button
                                    onClick={() => setOperationType("withdrawal")}
                                    style={{ flex: 1, padding: '8px', borderRadius: '8px', border: 'none', background: operationType === 'withdrawal' ? 'white' : 'transparent', fontWeight: 700, cursor: 'pointer', boxShadow: operationType === 'withdrawal' ? '0 2px 4px rgba(0,0,0,0.1)' : 'none' }}
                                >Retrait</button>
                            </div>

                            <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '0 0 1.5rem 0', fontSize: '1.1rem', fontWeight: 800 }}>
                                <ArrowDownCircle color={operationType === 'deposit' ? "#10b981" : "#ef4444"} />
                                {operationType === 'deposit' ? "Simuler un Dépôt" : operationType === 'checkout' ? "Simuler un Paiement" : "Simuler un Retrait"}
                            </h3>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                <div style={{ marginBottom: '12px' }}>
                                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#64748b', marginBottom: '5px' }}>
                                        {operationType === 'checkout' ? 'Acheteur' : 'Utilisateur concerné'}
                                    </label>
                                    <select
                                        value={selectedUser}
                                        onChange={(e) => setSelectedUser(e.target.value)}
                                        style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#f8fafc' }}
                                    >
                                        <option value="">Sélectionner un compte...</option>
                                        {users.map(u => (
                                            <option key={u.id} value={u.id}>
                                                [{u.role || 'user'}] {u.full_name} ({u.balance.toLocaleString()} FCFA)
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div style={{ marginBottom: '12px' }}>
                                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#64748b', marginBottom: '5px' }}>Statut de l'API externe</label>
                                    <select
                                        value={selectedStatusCode}
                                        onChange={(e) => setSelectedStatusCode(e.target.value)}
                                        style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0', background: selectedStatusCode === 'SUCCESS' ? '#f0fdf4' : '#fef2f2' }}
                                    >
                                        <option value="SUCCESS">✅ SUCCESS (Opération réussie)</option>
                                        <option value="FAILED">❌ FAILED (Échec critique)</option>
                                        <option value="PENDING">⏳ PENDING (En attente/Traitement)</option>
                                        <option value="INSUFFICIENT_FUNDS">💰 INSUFFICIENT_FUNDS (Solde insuffisant)</option>
                                        <option value="CANCELLED">🚫 CANCELLED (Annulé par l'utilisateur)</option>
                                        <option value="EXPIRED">⏰ EXPIRED (Session expirée)</option>
                                        <option value="INVALID_NUMBER">📞 INVALID_NUMBER (Numéro erroné)</option>
                                        <option value="NETWORK_ERROR">🌐 NETWORK_ERROR (Erreur réseau)</option>
                                    </select>
                                </div>
                                <div style={{ marginBottom: '1.5rem' }}>
                                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#64748b', marginBottom: '5px' }}>Montant (FCFA)</label>
                                    <input
                                        type="number"
                                        placeholder="Ex: 5000"
                                        value={depositAmount}
                                        onChange={(e) => setDepositAmount(e.target.value)}
                                        style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0' }}
                                    />
                                </div>
                                <button
                                    onClick={handleSimulation}
                                    disabled={actionLoading}
                                    style={{ width: '100%', background: selectedStatusCode === 'SUCCESS' ? '#10b981' : '#ef4444', color: 'white', border: 'none', padding: '12px', borderRadius: '10px', fontWeight: 800, cursor: 'pointer', opacity: actionLoading ? 0.7 : 1 }}
                                >
                                    {actionLoading ? "Traitement..." : `Exécuter le ${operationType}`}
                                </button>
                            </div>
                        </section>

                        <section style={{ background: '#f1f5f9', padding: '1.5rem', borderRadius: '16px', border: '2px dashed #cbd5e1' }}>
                            <h3 style={{ margin: '0 0 1rem 0', fontSize: '1rem', fontWeight: 800, color: '#475569' }}>Prochaines Simulations</h3>
                            <ul style={{ padding: 0, margin: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <li style={{ background: 'white', padding: '10px', borderRadius: '8px', fontSize: '0.85rem', border: '1px solid #e2e8f0', opacity: 0.6 }}>Simuler Paiement Commande (Auto-Escrow)</li>
                                <li style={{ background: 'white', padding: '10px', borderRadius: '8px', fontSize: '0.85rem', border: '1px solid #e2e8f0', opacity: 0.6 }}>Simuler Validation Livraison (Split logic)</li>
                                <li style={{ background: 'white', padding: '10px', borderRadius: '8px', fontSize: '0.85rem', border: '1px solid #e2e8f0', opacity: 0.6 }}>Simuler Litige (Lock funds)</li>
                            </ul>
                        </section>
                    </div>

                    {/* Transaction Feed */}
                    <section style={{ background: 'white', padding: '1.5rem', borderRadius: '16px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                            <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>
                                <RefreshCw size={20} className={loading ? "spin" : ""} />
                                Logs des Flux Financiers
                            </h3>
                            <button onClick={fetchData} style={{ background: 'none', border: 'none', color: '#4f46e5', fontWeight: 700, cursor: 'pointer', fontSize: '0.85rem' }}>Rafraîchir</button>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {stats?.transactions?.length === 0 ? (
                                <p style={{ textAlign: 'center', color: '#94a3b8', padding: '2rem' }}>Aucune transaction récente</p>
                            ) : (
                                stats?.transactions?.map((t: any) => (
                                    <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', borderBottom: '1px solid #f1f5f9' }}>
                                        <div style={{
                                            width: '36px', height: '36px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            background: t.type === 'deposit' ? '#ECFDF5' : t.type === 'escrow_lock' ? '#EFF6FF' : '#FFF7ED',
                                            color: t.type === 'deposit' ? '#10B981' : t.type === 'escrow_lock' ? '#3B82F6' : '#F59E0B'
                                        }}>
                                            {t.type === 'deposit' ? <ArrowDownCircle size={18} /> : t.type === 'escrow_lock' ? <Shield size={18} /> : <Activity size={18} />}
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <p style={{ margin: 0, fontWeight: 700, fontSize: '0.9rem' }}>{t.description}</p>
                                            <div style={{ display: 'flex', gap: '10px', fontSize: '0.75rem', color: '#64748b' }}>
                                                <span>#{t.reference.split('-').pop()}</span>
                                                <span>•</span>
                                                <span>{new Date(t.created_at).toLocaleTimeString()}</span>
                                            </div>
                                        </div>
                                        <div style={{ fontWeight: 800, color: t.amount > 0 ? '#10b981' : '#ef4444' }}>
                                            {t.amount > 0 ? '+' : ''}{t.amount.toLocaleString()}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </section>
                </div>
            </main>
        </div>
    );
}
