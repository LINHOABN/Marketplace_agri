import { API_URL } from "../config";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";
import {
  ChevronLeft,
  ShoppingBag,
  DollarSign,
  Download,
  RefreshCcw,
  Star,
  Filter,
  Calendar,
} from "lucide-react";
import "./HistoryPage.css";

export default function HistoryPage() {
  const navigate = useNavigate();
  const [role, setRole] = useState<"buyer" | "seller">("buyer");
  const [statusFilter, setStatusFilter] = useState("all");
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const fetchOrders = async () => {
      setLoading(true);
      try {
        const res = await api.get(`/orders/?role=${role}&status=${statusFilter}`);
        setOrders(res.data || []);
      } catch (err) {
        console.error("Erreur lors du chargement de l'historique:", err);
        setOrders([]);
      } finally {
        setLoading(false);
      }
    };
    fetchOrders();
  }, [role, statusFilter]);
  return (
    <div className="history-page-wrapper dashboard-wrapper">
      {" "}
      <header className="history-header dashboard-header">
        <button onClick={() => navigate(-1)} className="back-btn">
          <ChevronLeft size={20} />
        </button>
        <h1>Mon Historique</h1>
      </header>{" "}
      {/* Tabs Rôles */}{" "}
      <nav className="history-tabs">
        {" "}
        <button
          className={role === "buyer" ? "active" : ""}
          onClick={() => setRole("buyer")}
        >
          {" "}
          <ShoppingBag size={18} /> Mes achats{" "}
        </button>{" "}
        <button
          className={role === "seller" ? "active" : ""}
          onClick={() => setRole("seller")}
        >
          {" "}
          <DollarSign size={18} /> Mes ventes{" "}
        </button>{" "}
      </nav>{" "}
      <main className="history-content dashboard-content">
        {" "}
        {/* Filtres Rapides */}{" "}
        <div className="history-filters">
          {" "}
          <div className="filter-item">
            {" "}
            <Filter size={14} />{" "}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              {" "}
              <option value="all">Tous les statuts</option>{" "}
              <option value="completed">Livr</option>{" "}
              <option value="pending">En cours</option>{" "}
              <option value="cancelled">Annul</option>{" "}
              <option value="dispute">En litige</option>{" "}
            </select>{" "}
          </div>{" "}
          <div className="filter-item">
            {" "}
            <Calendar size={14} />{" "}
            <select>
              {" "}
              <option>30 derniers jours</option>{" "}
              <option>3 derniers mois</option> <option>Tout 2026</option>{" "}
            </select>{" "}
          </div>{" "}
        </div>{" "}
        {/* Liste des Commandes */}{" "}
        <div className="orders-list">
          {" "}
          {loading ? (
            <div className="loader-box">Chargement de votre historique...</div>
          ) : orders.length === 0 ? (
            <div className="empty-state">
              {" "}
              <ShoppingBag size={48} color="#DDD" />{" "}
              <p>Aucune transaction trouve.</p>{" "}
            </div>
          ) : (
            orders.map((order) => (
              <div
                key={order.id}
                className="history-order-card clickable"
                onClick={() => navigate(`/order/tracking/${order.id}`)}
                style={{ cursor: "pointer" }}
              >
                {" "}
                <div className="card-top">
                  {" "}
                  <img
                    src={
                      order.product_image && order.product_image.startsWith("http")
                        ? order.product_image
                        : `${API_URL}${order.product_image || "/placeholder.png"}`
                    }
                    alt="prod"
                  />{" "}
                  <div className="info">
                    {" "}
                    <h4>{order.product_name}</h4>{" "}
                    <span className="date">
                      {new Date(order.created_at).toLocaleDateString()}
                    </span>{" "}
                  </div>{" "}
                  <div className={`status-badge ${order.status}`}>
                    {order.status === 'pending' ? 'En attente' :
                      order.status === 'shipped' ? 'Expédié' :
                        order.status === 'delivered' ? 'Livré' :
                          order.status === 'completed' ? 'Terminé' :
                            order.status === 'cancelled' ? 'Annulé' :
                              order.status === 'dispute' ? 'En litige' : order.status}
                  </div>{" "}
                </div>{" "}
                <div className="card-middle">
                  {" "}
                  <div className="detail">
                    <span>Quantité :</span> <strong>{order.quantity}</strong>
                  </div>{" "}
                  <div className="detail">
                    <span>Total:</span>{" "}
                    <strong className="price">
                      {order.total_price.toLocaleString()} FCFA
                    </strong>
                  </div>{" "}
                </div>{" "}
                <div className="card-actions" onClick={(e) => e.stopPropagation()}>
                  {" "}
                  <button
                    className="action-btn track-btn"
                    onClick={() => navigate(`/order/tracking/${order.id}`)}
                  >
                    Suivre
                  </button>{" "}
                  <button
                    className="action-btn download"
                    onClick={() => {
                      const token = sessionStorage.getItem("access_token") || localStorage.getItem("access_token");
                      window.open(`${API_URL}/invoices/${order.id}/download?token=${token}`);
                    }}
                  >
                    {" "}
                    <Download size={16} /> Facture{" "}
                  </button>{" "}
                  {order.status === "completed" && role === "buyer" && (
                    <>
                      {" "}
                      <button
                        className="action-btn renew"
                        onClick={() => navigate(`/product/${order.product_id}`)}
                      >
                        {" "}
                        <RefreshCcw size={16} /> Renouveler{" "}
                      </button>{" "}
                      <button
                        className="action-btn review"
                        onClick={() =>
                          navigate("/review", { state: { orderId: order.id } })
                        }
                      >
                        {" "}
                        <Star size={16} /> Noter{" "}
                      </button>{" "}
                    </>
                  )}{" "}
                </div>{" "}
              </div>
            ))
          )}{" "}
        </div>{" "}
      </main>{" "}
    </div>
  );
}
