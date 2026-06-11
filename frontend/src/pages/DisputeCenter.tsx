import { API_URL } from "../config";
import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import axios from "axios";
import {
  ChevronLeft,
  ShieldAlert,
  AlertCircle,
  Camera,
  CheckCircle,
} from "lucide-react";
import "./DisputeCenter.css";
export default function DisputeCenter() {
  const navigate = useNavigate();
  const location = useLocation();
  const orderId = location.state?.orderId || "CMD-882";
  const [reason, setReason] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<"form" | "processing" | "done">("form");
  const handleSubmit = async () => {
    setLoading(true);
    setStep("processing");
    try {
      const token = localStorage.getItem("access_token");
      await axios.post(
        `${API_URL}/disputes`,
        { order_id: orderId, reason, description },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      setTimeout(() => setStep("done"), 1500);
    } catch (err) {
      alert("Erreur lors de l'ouverture du litige.");
      setStep("form");
    } finally {
      setLoading(false);
    }
  };
  if (step === "processing")
    return (
      <div className="dispute-overlay">Traitement de votre demande...</div>
    );
  if (step === "done")
    return (
      <div className="dispute-center-wrapper success">
        {" "}
        <CheckCircle size={80} color="#FF6600" /> <h2>Litige Transmis</h2>{" "}
        <p>
          L'argent de la commande est bloqué. Un arbitre agrimarche reviendra
          vers vous sous 48h.
        </p>{" "}
        <button className="btn-back-home" onClick={() => navigate("/feed")}>
          Retour  l'accueil
        </button>{" "}
      </div>
    );
  return (
    <div className="dispute-center-wrapper">
      {" "}
      <header className="dispute-header">
        {" "}
        <button onClick={() => navigate(-1)} className="back-btn">
          <ChevronLeft />
        </button>{" "}
        <h1>Centre de Litiges</h1>{" "}
      </header>{" "}
      <main className="dispute-content">
        {" "}
        <div className="info-banner">
          {" "}
          <ShieldAlert size={20} />{" "}
          <p>
            L'ouverture d'un litige suspend immdiatement le paiement au
            vendeur.
          </p>{" "}
        </div>{" "}
        <section className="dispute-form-card">
          {" "}
          <label>Motif du dsaccord</label>{" "}
          <select value={reason} onChange={(e) => setReason(e.target.value)}>
            {" "}
            <option value="">Sélectionnez une raison...</option>{" "}
            <option value="not_received">Produit non reçu</option>{" "}
            <option value="damaged">Produit endommagé</option>{" "}
            <option value="not_conform">Non conforme à la description</option>{" "}
            <option value="missing_items">Articles manquants</option>{" "}
          </select>{" "}
          <label>Description du problème</label>{" "}
          <textarea
            placeholder="Détaillez le problème rencontré pour aider l'arbitre..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />{" "}
          <div className="proof-zone">
            {" "}
            <button className="btn-add-proof">
              <Camera size={18} /> Ajouter une preuve photo/vido
            </button>{" "}
            <p className="proof-hint">
              Les preuves visuelles accélèrent la résolution (90% des cas).
            </p>{" "}
          </div>{" "}
        </section>{" "}
      </main>{" "}
      <footer className="dispute-footer">
        {" "}
        <button
          className="btn-submit-dispute"
          disabled={!reason || !description || loading}
          onClick={handleSubmit}
        >
          {" "}
          Ouvrir le litige{" "}
        </button>{" "}
      </footer>{" "}
    </div>
  );
}
