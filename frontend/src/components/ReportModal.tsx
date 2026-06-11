import React, { useState } from "react";
import { Flag, X, AlertTriangle, ShieldAlert, DollarSign, MessageCircleWarning, Ban } from "lucide-react";
import "./ReportModal.css";
import axios from "axios";
import { API_URL } from "../config";
import toast from "react-hot-toast";

interface ReportModalProps {
  isOpen: boolean;
  targetId: string;
  targetType: "product" | "post" | "user";
  onClose: () => void;
}

const REASONS = [
  { id: "scam", label: "Arnaque / Fraude", icon: <ShieldAlert size={18} /> },
  { id: "fake", label: "Faux produit", icon: <AlertTriangle size={18} /> },
  { id: "forbidden", label: "Contenu interdit", icon: <Ban size={18} /> },
  { id: "spam", label: "Spam / Publicit abusive", icon: <MessageCircleWarning size={18} /> },
  { id: "price", label: "Prix trompeur", icon: <DollarSign size={18} /> },
  { id: "behavior", label: "Mauvais comportement", icon: <Flag size={18} /> },
];

export default function ReportModal({ isOpen, targetId, targetType, onClose }: ReportModalProps) {
  const [selectedReason, setSelectedReason] = useState("");
  const [details, setDetails] = useState("");
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async () => {
    if (!selectedReason) {
      toast.error("Veuillez slectionner une raison.");
      return;
    }
    setLoading(true);
    try {
      const token = localStorage.getItem("access_token");
      await axios.post(
        `${API_URL}/reports`,
        { target_id: targetId, target_type: targetType, reason: selectedReason, details },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success("Signalement envoy aux administrateurs. Merci !");
      onClose();
    } catch {
      toast.error("Erreur lors de l'envoi du signalement.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="report-overlay" onClick={onClose}>
      <div className="report-modal" onClick={(e) => e.stopPropagation()}>
        <div className="report-header">
          <div className="report-title">
            <Flag size={22} color="#e53e3e" />
            <h2>Signaler ce contenu</h2>
          </div>
          <button className="report-close" onClick={onClose}><X size={20} /></button>
        </div>

        <p className="report-subtitle">Pourquoi signalez-vous ce contenu ?</p>

        <div className="reason-list">
          {REASONS.map((r) => (
            <button
              key={r.id}
              className={`reason-item ${selectedReason === r.id ? "selected" : ""}`}
              onClick={() => setSelectedReason(r.id)}
            >
              {r.icon}
              <span>{r.label}</span>
              {selectedReason === r.id && <div className="reason-check"></div>}
            </button>
          ))}
        </div>

        <textarea
          className="report-details"
          placeholder="Détails supplémentaires (optionnel)..."
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          rows={3}
        />

        <div className="report-actions">
          <button className="btn-report-cancel" onClick={onClose}>Annuler</button>
          <button className="btn-report-submit" onClick={handleSubmit} disabled={loading}>
            {loading ? "Envoi..." : "Envoyer le signalement"}
          </button>
        </div>
      </div>
    </div>
  );
}
