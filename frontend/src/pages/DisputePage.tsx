import React, { useState } from "react";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import {
  ChevronLeft,
  AlertTriangle,
  Camera,
  ShieldAlert,
} from "lucide-react";
import "./DisputePage.css";
import api from "../api";

export default function DisputePage() {
  const navigate = useNavigate();
  const { orderId: urlOrderId } = useParams();
  const location = useLocation();
  const orderId = location.state?.orderId || urlOrderId || "DEMO-8821";
  const [reason, setReason] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async () => {
    if (!reason || !description) return;
    setLoading(true);
    try {
      await api.post("/disputes/create", {
        order_id: orderId,
        reason,
        description
      });
      setSubmitted(true);
    } catch (err) {
      alert("Erreur lors de l'ouverture du litige.");
    } finally {
      setLoading(false);
    }
  };
  if (submitted) {
    return (
      <div className="dispute-page-wrapper success">
        {" "}
        <div className="status-view">
          {" "}
          <ShieldAlert size={80} color="#FF6600" /> <h2>Litige Ouvert</h2>{" "}
          <p>
            Le paiement de cette commande a été bloqué. Notre équipe d'arbitrage
            va examiner votre demande sous 48h.
          </p>{" "}
          <button className="btn-back-feed" onClick={() => navigate("/feed")}>
            Retour  l'accueil
          </button>{" "}
        </div>{" "}
      </div>
    );
  }
  return (
    <div className="dispute-page-wrapper">
      {" "}
      <header className="dispute-header">
        {" "}
        <button onClick={() => navigate(-1)} className="icon-btn">
          <ChevronLeft size={24} />
        </button>{" "}
        <h1>Signaler un problème</h1>{" "}
      </header>{" "}
      <main className="dispute-content">
        {" "}
        <div className="warning-banner">
          {" "}
          <AlertTriangle size={20} />{" "}
          <p>
            L'ouverture d'un litige bloque les fonds du vendeur jusqu'à la
            résolution.
          </p>{" "}
        </div>{" "}
        <section className="dispute-form">
          {" "}
          <div className="input-group">
            {" "}
            <label>Motif du litige</label>{" "}
            <select value={reason} onChange={(e) => setReason(e.target.value)}>
              {" "}
              <option value="">Sélectionnez une raison...</option>{" "}
              <option value="not_delivered">Produit non reçu</option>{" "}
              <option value="not_conform">
                Produit non conforme à la description
              </option>{" "}
              <option value="damaged">Produit endommagé</option>{" "}
              <option value="wrong_quantity">Mauvaise quantité</option>{" "}
            </select>{" "}
          </div>{" "}
          <div className="input-group">
            {" "}
            <label>Description détaillée</label>{" "}
            <textarea
              placeholder="Expliquez précisément le problème rencontré..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={5}
            ></textarea>{" "}
          </div>{" "}
          <div className="proof-upload">
            {" "}
            <button className="btn-upload">
              {" "}
              <Camera size={20} /> Ajouter des photos de preuve{" "}
            </button>{" "}
            <small>
              Les photos aident nos arbitres  trancher plus rapidement.
            </small>{" "}
          </div>{" "}
        </section>{" "}
      </main>{" "}
      <footer className="dispute-footer">
        {" "}
        <button
          className="btn-submit-dispute"
          disabled={loading || !reason || !description}
          onClick={handleSubmit}
        >
          {" "}
          {loading ? "Traitement..." : "Ouvrir le litige"}{" "}
        </button>{" "}
      </footer>{" "}
    </div>
  );
}
