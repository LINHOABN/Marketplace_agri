import React from "react";
import { AlertTriangle, CheckCircle, X } from "lucide-react";
import "./ConfirmModal.css";

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: "danger" | "warning" | "success";
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmModal({
  isOpen,
  title,
  message,
  confirmText = "Confirmer",
  cancelText = "Annuler",
  type = "warning",
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  if (!isOpen) return null;

  const iconColor = type === "danger" ? "#e53e3e" : type === "success" ? "#38a169" : "#d69e2e";

  return (
    <div className="confirm-overlay" onClick={onCancel}>
      <div className="confirm-modal" onClick={(e) => e.stopPropagation()}>
        <button className="confirm-close" onClick={onCancel}>
          <X size={20} />
        </button>
        <div className="confirm-icon" style={{ color: iconColor }}>
          {type === "success" ? <CheckCircle size={48} /> : <AlertTriangle size={48} />}
        </div>
        <h2 className="confirm-title">{title}</h2>
        <p className="confirm-message">{message}</p>
        <div className="confirm-actions">
          <button className="btn-cancel" onClick={onCancel}>
            {cancelText}
          </button>
          <button
            className={`btn-confirm ${type}`}
            onClick={() => { onConfirm(); }}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
