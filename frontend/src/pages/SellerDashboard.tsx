import { useEffect, useState } from "react";
import {
    BarChart3, Package, ShoppingCart, Wallet, Plus,
    Edit3, Trash2, ChevronRight, Store
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import api from "../api";
import { API_URL } from "../config";
import { getOrderStatusLabel } from "../utils/orderStatus";
import toast from "react-hot-toast";
import { usePersistentState } from "../hooks/usePersistentState";
import "./SellerDashboard.css";

export default function SellerDashboard() {
    const navigate = useNavigate();
    const [stats, setStats] = useState<any>(null);
    const [orders, setOrders] = useState<any[]>([]);
    const [publications, setPublications] = useState<any>({ products: [], stories: [] });
    const [activeTab, setActiveTab] = usePersistentState<"orders" | "products" | "stories">("seller_dashboard_tab", "orders");
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [statsRes, ordersRes, pubRes] = await Promise.all([
                    api.get("/seller/stats"),
                    api.get("/seller/orders"),
                    api.get("/seller/publications")
                ]);
                setStats(statsRes.data);
                setOrders(ordersRes.data);
                setPublications(pubRes.data);
            } catch (err) {
                console.error("Error fetching seller data", err);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    const handleAcceptOrder = async (orderId: string) => {
        try {
            await api.post(`/seller/orders/${orderId}/accept`);
            toast.success("Commande acceptée — préparation en cours");
            const ordersRes = await api.get("/seller/orders");
            setOrders(ordersRes.data);
        } catch (err: any) {
            const detail = err?.response?.data?.detail || "Impossible d'accepter la commande";
            toast.error(detail);
        }
    };

    if (loading) return <div className="loading-overlay">Chargement du dashboard vendeur...</div>;

    return (
        <div className="seller-dashboard-wrapper">
            <header className="seller-header">
                <Store size={28} color="var(--primary)" />
                <h1>Tableau de bord Vendeur</h1>
                <div style={{ marginLeft: 'auto', display: 'flex', gap: '10px' }}>
                    <button className="btn-secondary" onClick={() => navigate("/seller/shop-settings")} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Store size={18} /> Boutique
                    </button>
                    <button className="btn-primary" onClick={() => navigate("/product/create")}>
                        <Plus size={18} /> Nouveau Produit
                    </button>
                </div>
            </header>

            <main className="seller-content">
                {/* KPI Grid */}
                <section className="kpi-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
                    <div className="kpi-card">
                        <div className="kpi-icon-wrapper" style={{ background: '#E8F5E9' }}>
                            <BarChart3 color="#2E7D32" />
                        </div>
                        <div className="kpi-info">
                            <span>Revenus Totaux</span>
                            <h3>{stats?.total_earnings?.toLocaleString() || 0} F</h3>
                        </div>
                    </div>
                    <div className="kpi-card">
                        <div className="kpi-icon-wrapper" style={{ background: '#E3F2FD' }}>
                            <ShoppingCart color="#1976D2" />
                        </div>
                        <div className="kpi-info">
                            <span>Ventes Totales</span>
                            <h3>{stats?.total_sales || 0}</h3>
                        </div>
                    </div>
                    <div className="kpi-card">
                        <div className="kpi-icon-wrapper" style={{ background: '#FFF3E0' }}>
                            <Package color="#FFA000" />
                        </div>
                        <div className="kpi-info">
                            <span>Stock Faible</span>
                            <h3>{stats?.low_stock_count || 0}</h3>
                        </div>
                    </div>
                    <div className="kpi-card">
                        <div className="kpi-icon-wrapper" style={{ background: '#F3E5F5' }}>
                            <Wallet color="#7B1FA2" />
                        </div>
                        <div className="kpi-info">
                            <span>En Escrow</span>
                            <h3>{stats?.escrow_balance?.toLocaleString() || 0} F</h3>
                        </div>
                    </div>
                </section>

                {/* Tabs Control */}
                <div className="mgmt-tabs">
                    <button
                        className={`mgmt-tab ${activeTab === "orders" ? "active" : ""}`}
                        onClick={() => setActiveTab("orders")}
                    >
                        Commandes ({orders.length})
                    </button>
                    <button
                        className={`mgmt-tab ${activeTab === "products" ? "active" : ""}`}
                        onClick={() => setActiveTab("products")}
                    >
                        Mes Produits ({publications.products.length})
                    </button>
                    <button
                        className={`mgmt-tab ${activeTab === "stories" ? "active" : ""}`}
                        onClick={() => setActiveTab("stories")}
                    >
                        Mes Stories ({publications.stories.length})
                    </button>
                </div>

                {/* Dynamic Content */}
                <div className="mgmt-content">
                    {activeTab === "orders" && (
                        <div className="mgmt-cards-grid">
                            {orders.length > 0 ? orders.map(order => (
                                <div key={order.id} className="mgmt-pub-card">
                                    <div className="mgmt-pub-info" style={{ flex: 1 }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                            <h4>Commande #{order.id.slice(0, 8)}</h4>
                                            <span className={`m-badge ${order.status}`}>{getOrderStatusLabel(order.status)}</span>
                                        </div>
                                        <p style={{ margin: '4px 0', fontSize: '14px' }}><strong>{order.product_name}</strong> par {order.buyer_name}</p>
                                        <p className="price">{order.total_price.toLocaleString()} F</p>
                                        <div style={{ fontSize: '12px', color: '#666', borderTop: '1px solid #eee', paddingTop: '8px', marginTop: '8px', display: 'flex', gap: '15px' }}>
                                            <span>Vendeur : {order.seller_share.toLocaleString()} F</span>
                                            <span>Livreur : {order.deliverer_share.toLocaleString()} F</span>
                                        </div>
                                    </div>
                                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                        {["pending", "paid"].includes(order.status) && (
                                            <button
                                                type="button"
                                                className="btn-primary"
                                                style={{ fontSize: 12, padding: "6px 10px" }}
                                                onClick={() => handleAcceptOrder(order.id)}
                                            >
                                                Accepter
                                            </button>
                                        )}
                                        <button className="btn-icon" onClick={() => navigate(`/order/tracking/${order.id}`)}>
                                            <ChevronRight />
                                        </button>
                                    </div>
                                </div>
                            )) : (
                                <div className="empty-state">Aucune commande reçue pour le moment.</div>
                            )}
                        </div>
                    )}

                    {activeTab === "products" && (
                        <div className="mgmt-cards-grid">
                            {publications.products.length > 0 ? publications.products.map((p: any) => (
                                <div key={p.id} className="mgmt-pub-card">
                                    <img src={p.image?.startsWith('http') ? p.image : `${API_URL}${p.image}`} alt={p.name} />
                                    <div className="mgmt-pub-info" style={{ flex: 1 }}>
                                        <h4>{p.name}</h4>
                                        <p className="price">{p.price.toLocaleString()} F</p>
                                        <span className={`stock-status ${p.quantity_available > 0 ? 'in-stock' : 'out-of-stock'}`}>
                                            Stock : {p.quantity_available}
                                        </span>
                                    </div>
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <button className="btn-icon" onClick={() => navigate(`/product/edit/${p.id}`)}><Edit3 size={18} /></button>
                                        <button className="btn-icon" style={{ color: '#D32F2F' }}><Trash2 size={18} /></button>
                                    </div>
                                </div>
                            )) : (
                                <div className="empty-state">Vous n'avez pas encore de produits.</div>
                            )}
                        </div>
                    )}

                    {activeTab === "stories" && (
                        <div className="mgmt-cards-grid">
                            {publications.stories.length > 0 ? publications.stories.map((s: any) => (
                                <div key={s.id} className="mgmt-pub-card">
                                    {s.media_url && (
                                        <img src={s.media_url.startsWith('http') ? s.media_url : `${API_URL}${s.media_url}`} alt="" />
                                    )}
                                    <div className="mgmt-pub-info" style={{ flex: 1 }}>
                                        <p style={{ fontSize: '14px', margin: 0 }}>{s.content}</p>
                                        <span style={{ fontSize: '11px', color: '#888' }}>{new Date(s.created_at).toLocaleDateString()}</span>
                                    </div>
                                    <button className="btn-icon" style={{ color: '#D32F2F' }}><Trash2 size={18} /></button>
                                </div>
                            )) : (
                                <div className="empty-state">Aucune story publiée.</div>
                            )}
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}
