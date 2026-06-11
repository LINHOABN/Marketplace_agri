import { API_URL } from '../config';
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Copy,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  User,
  Store,
  Package,
  MapPin,
  DollarSign,
  Shield,
  Unlock,
  RefreshCcw,
  Ban,
  ExternalLink,
  Loader2,
} from 'lucide-react';
import './TransactionDetail.css';

const API_BASE = `${API_URL}`;
const getToken = () => localStorage.getItem('admin_token');

// ── Helpers ──────────────────────────────────────────────────
const fmt = (amount) =>
  new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'XAF',
    minimumFractionDigits: 0,
  }).format(amount || 0);

const fmtDate = (iso) =>
  iso
    ? new Date(iso).toLocaleString('fr-FR', {
        weekday: 'short',
        day: '2-digit',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—';

const STATUS_CONFIG = {
  pending: { label: 'En attente', color: '#F59E0B', bg: '#FEF3C7', icon: Clock },
  completed: { label: 'Complétée', color: '#10B981', bg: '#D1FAE5', icon: CheckCircle },
  failed: { label: 'Échouée', color: '#EF4444', bg: '#FEE2E2', icon: XCircle },
};

const TIMELINE_STEPS = [
  { type: 'escrow_lock', label: 'Escrow bloqué', icon: Shield, color: '#F59E0B' },
  { type: 'commission', label: 'Commission', icon: DollarSign, color: '#6366F1' },
  { type: 'escrow_release', label: 'Escrow libéré', icon: Unlock, color: '#10B981' },
  { type: 'refund', label: 'Remboursement', icon: RefreshCcw, color: '#EC4899' },
];

// ── Sub-components ────────────────────────────────────────────

const StatusBadge = ({ status }) => {
  const cfg = STATUS_CONFIG[status] || {
    label: status,
    color: '#6B7280',
    bg: '#F3F4F6',
    icon: Clock,
  };
  const Icon = cfg.icon;
  return (
    <span className="td-badge" style={{ color: cfg.color, background: cfg.bg }}>
      <Icon size={14} /> {cfg.label}
    </span>
  );
};

const CopyButton = ({ text }) => {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <button className="copy-btn" onClick={handleCopy} title="Copier">
      {copied ? <CheckCircle size={13} color="#10B981" /> : <Copy size={13} />}
    </button>
  );
};

const InfoRow = ({ label, value, mono, copyable }) => (
  <div className="info-row">
    <span className="info-label">{label}</span>
    <span className={`info-value ${mono ? 'mono' : ''}`}>
      {value || <span className="muted">—</span>}
      {copyable && value && <CopyButton text={String(value)} />}
    </span>
  </div>
);

const ActionButton = ({ onClick, icon: Icon, label, variant, loading, disabled }) => (
  <button
    className={`action-btn action-btn-${variant}`}
    onClick={onClick}
    disabled={loading || disabled}
  >
    {loading ? <Loader2 size={16} className="spin" /> : <Icon size={16} />}
    {label}
  </button>
);

// ── Modal de confirmation ─────────────────────────────────────
const ConfirmModal = ({ isOpen, title, message, onConfirm, onCancel, variant, loading }) => {
  if (!isOpen) return null;
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className={`modal-icon modal-icon-${variant}`}>
          {variant === 'danger' ? (
            <Ban size={24} />
          ) : variant === 'warning' ? (
            <AlertTriangle size={24} />
          ) : (
            <CheckCircle size={24} />
          )}
        </div>
        <h3 className="modal-title">{title}</h3>
        <p className="modal-message">{message}</p>
        <div className="modal-actions">
          <button className="modal-btn modal-btn-ghost" onClick={onCancel} disabled={loading}>
            Annuler
          </button>
          <button
            className={`modal-btn modal-btn-${variant}`}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? <Loader2 size={15} className="spin" /> : null}
            Confirmer
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Timeline ─────────────────────────────────────────────────
const Timeline = ({ timeline }) => {
  if (!timeline || timeline.length === 0) {
    return (
      <div className="timeline-empty">
        <Clock size={20} />
        <p>Aucun événement de timeline disponible</p>
      </div>
    );
  }

  return (
    <div className="timeline">
      {timeline.map((event, idx) => {
        const typeCfg = TIMELINE_STEPS.find((s) => s.type === event.type) || {};
        const Icon = typeCfg.icon || Clock;
        const isLast = idx === timeline.length - 1;
        const isCompleted = event.status === 'completed';

        return (
          <div key={event.id} className="timeline-item">
            {/* Ligne verticale */}
            {!isLast && <div className={`timeline-line ${isCompleted ? 'completed' : ''}`} />}

            {/* Icône */}
            <div
              className={`timeline-dot ${isCompleted ? 'completed' : event.status}`}
              style={
                isCompleted
                  ? { background: typeCfg.color, boxShadow: `0 0 12px ${typeCfg.color}44` }
                  : {}
              }
            >
              <Icon size={14} />
            </div>

            {/* Contenu */}
            <div className="timeline-content">
              <div className="timeline-header-row">
                <span className="timeline-type" style={{ color: typeCfg.color || '#94A3B8' }}>
                  {typeCfg.label || event.type}
                </span>
                <StatusBadge status={event.status} />
              </div>
              <div className="timeline-meta">
                <span className="timeline-date">{fmtDate(event.created_at)}</span>
                <span className="timeline-amount">{fmt(event.amount)}</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

// ── Composant Principal ───────────────────────────────────────
export default function TransactionDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [tx, setTx] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Action states
  const [modal, setModal] = useState(null); // { type, title, message, variant }
  const [actionLoading, setActionLoading] = useState(false);
  const [actionResult, setActionResult] = useState(null); // { success, message }

  // ── Fetch detail ──
  useEffect(() => {
    const fetchDetail = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await axios.get(`${API_BASE}/admin/transactions/${id}`, {
          headers: { Authorization: `Bearer ${getToken()}` },
        });
        setTx(res.data);
      } catch (err) {
        if (err.response?.status === 401) navigate('/admin/dashboard');
        else if (err.response?.status === 404) setError('Transaction introuvable');
        else setError(err.response?.data?.error || 'Erreur de chargement');
      } finally {
        setLoading(false);
      }
    };
    fetchDetail();
  }, [id, navigate]);

  // ── Actions ──
  const openModal = (type) => {
    const config = {
      forceRelease: {
        title: 'Forcer la libération Escrow',
        message: `Cette action libèrera immédiatement les fonds de la transaction ${id?.substring(
          0,
          8
        )}... vers le vendeur. Cette opération est irréversible.`,
        variant: 'warning',
      },
      refund: {
        title: 'Rembourser intégralement',
        message: `Un remboursement complet de ${fmt(
          tx?.amount
        )} sera effectué vers l'acheteur. La commande sera annulée. Cette opération est irréversible.`,
        variant: 'danger',
      },
      block: {
        title: 'Bloquer la transaction',
        message: `La transaction sera marquée comme échouée et bloquée définitivement. Cette opération est irréversible.`,
        variant: 'danger',
      },
    };
    setModal({ type, ...config[type] });
  };

  const handleConfirmAction = async () => {
    setActionLoading(true);
    const endpoints = {
      forceRelease: `/admin/transactions/${id}/force-release`,
      refund: `/admin/transactions/${id}/refund`,
      block: `/admin/transactions/${id}/block`,
    };
    try {
      const res = await axios.post(
        `${API_BASE}${endpoints[modal.type]}`,
        {},
        { headers: { Authorization: `Bearer ${getToken()}` } }
      );
      setActionResult({ success: true, message: res.data.message });
      setModal(null);
      // Recharger les données
      const updated = await axios.get(`${API_BASE}/admin/transactions/${id}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      setTx(updated.data);
    } catch (err) {
      setActionResult({
        success: false,
        message: err.response?.data?.error || "Erreur lors de l'action",
      });
      setModal(null);
    } finally {
      setActionLoading(false);
    }
  };

  // ── Rendu ──
  if (loading) {
    return (
      <div className="td-loading-screen">
        <div className="td-loading-spinner">
          <Loader2 size={36} className="spin" />
        </div>
        <p>Chargement de la transaction…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="td-error-screen">
        <AlertTriangle size={48} />
        <h2>{error}</h2>
        <button
          className="action-btn action-btn-ghost"
          onClick={() => navigate('/admin/transactions')}
        >
          <ArrowLeft size={16} /> Retour à la liste
        </button>
      </div>
    );
  }

  const canForceRelease = tx?.status === 'pending';
  const canRefund = tx?.status !== 'failed';
  const canBlock = tx?.status === 'pending';

  return (
    <div className="td-wrapper">
      {/* ── Confirmation Modal ── */}
      <ConfirmModal
        isOpen={!!modal}
        title={modal?.title}
        message={modal?.message}
        variant={modal?.variant}
        loading={actionLoading}
        onConfirm={handleConfirmAction}
        onCancel={() => setModal(null)}
      />

      {/* ── Action Result Banner ── */}
      {actionResult && (
        <div className={`action-banner ${actionResult.success ? 'success' : 'error'}`}>
          {actionResult.success ? <CheckCircle size={18} /> : <AlertTriangle size={18} />}
          {actionResult.message}
          <button className="banner-close" onClick={() => setActionResult(null)}>
            ✕
          </button>
        </div>
      )}

      {/* ── Top Bar ── */}
      <div className="td-topbar">
        <button className="back-btn" onClick={() => navigate('/admin/transactions')}>
          <ArrowLeft size={18} /> Transactions
        </button>
        <div className="td-topbar-right">
          <StatusBadge status={tx.status} />
        </div>
      </div>

      {/* ── Hero Section ── */}
      <div className="td-hero">
        <div className="td-hero-left">
          <div className="td-hero-amount">{fmt(tx.amount)}</div>
          <div className="td-hero-type">{tx.type?.replace(/_/g, ' ').toUpperCase()}</div>
          {tx.reference && (
            <div className="td-hero-ref">
              <code>{tx.reference}</code>
              <CopyButton text={tx.reference} />
            </div>
          )}
        </div>
        <div className="td-hero-right">
          <div className="td-commission-card">
            <span className="commission-label">Commission</span>
            <span className="commission-value">{fmt(tx.commission)}</span>
            {tx.commission_rate && <span className="commission-rate">{tx.commission_rate}%</span>}
          </div>
        </div>
      </div>

      {/* ── Main Grid ── */}
      <div className="td-grid">
        {/* Colonne Gauche */}
        <div className="td-col-left">
          {/* Timeline */}
          <div className="td-card">
            <h3 className="td-card-title">
              <Clock size={16} /> Timeline de la transaction
            </h3>
            <Timeline timeline={tx.timeline} />
          </div>

          {/* Infos Commande */}
          {tx.order_id && (
            <div className="td-card">
              <h3 className="td-card-title">
                <Package size={16} /> Commande liée
              </h3>
              <InfoRow label="ID Commande" value={tx.order_id} mono copyable />
              <InfoRow label="Statut" value={tx.order_status} />
              <InfoRow label="Montant total" value={fmt(tx.total_amount)} />
              <InfoRow label="Adresse livraison" value={tx.delivery_address} />
              <InfoRow label="Créée le" value={fmtDate(tx.order_created_at)} />
            </div>
          )}
        </div>

        {/* Colonne Droite */}
        <div className="td-col-right">
          {/* Acheteur */}
          <div className="td-card">
            <h3 className="td-card-title">
              <User size={16} /> Acheteur
            </h3>
            {tx.buyer_name ? (
              <>
                <div className="user-avatar-row">
                  <div className="user-avatar">{tx.buyer_name?.charAt(0)}</div>
                  <div>
                    <div className="user-name">{tx.buyer_name}</div>
                    <div className="user-email">{tx.buyer_email}</div>
                  </div>
                </div>
                <InfoRow label="Téléphone" value={tx.buyer_phone} />
                <InfoRow label="ID" value={tx.buyer_id} mono copyable />
              </>
            ) : (
              <p className="muted">Aucun acheteur associé</p>
            )}
          </div>

          {/* Vendeur */}
          <div className="td-card">
            <h3 className="td-card-title">
              <Store size={16} /> Vendeur &amp; Boutique
            </h3>
            {tx.seller_name ? (
              <>
                <div className="user-avatar-row">
                  <div className="user-avatar seller">{tx.seller_name?.charAt(0)}</div>
                  <div>
                    <div className="user-name">{tx.seller_name}</div>
                    <div className="user-email">{tx.seller_email}</div>
                  </div>
                </div>
                <InfoRow label="Boutique" value={tx.shop_name} />
                <InfoRow label="ID Vendeur" value={tx.seller_id} mono copyable />
              </>
            ) : (
              <p className="muted">Aucun vendeur associé</p>
            )}
          </div>

          {/* Métadonnées */}
          <div className="td-card">
            <h3 className="td-card-title">
              <ExternalLink size={16} /> Détails techniques
            </h3>
            <InfoRow label="ID Transaction" value={tx.id} mono copyable />
            <InfoRow label="Référence" value={tx.reference} mono copyable />
            <InfoRow label="Type" value={tx.type} />
            <InfoRow label="Créée le" value={fmtDate(tx.created_at)} />
            <InfoRow label="Mise à jour" value={fmtDate(tx.updated_at)} />
          </div>

          {/* Actions Admin */}
          <div className="td-card td-card-actions">
            <h3 className="td-card-title">
              <Shield size={16} /> Actions administrateur
            </h3>
            <p className="actions-warning">
              <AlertTriangle size={14} />
              Ces actions sont irréversibles et tracées dans les logs d'audit.
            </p>
            <div className="actions-grid">
              <ActionButton
                icon={Unlock}
                label="Forcer libération Escrow"
                variant="warning"
                disabled={!canForceRelease}
                onClick={() => openModal('forceRelease')}
              />
              <ActionButton
                icon={RefreshCcw}
                label="Rembourser intégralement"
                variant="danger"
                disabled={!canRefund}
                onClick={() => openModal('refund')}
              />
              <ActionButton
                icon={Ban}
                label="Bloquer la transaction"
                variant="danger"
                disabled={!canBlock}
                onClick={() => openModal('block')}
              />
            </div>
            {!canForceRelease && !canBlock && (
              <p className="actions-note">
                Certaines actions sont désactivées car la transaction est déjà au statut{' '}
                <strong>{tx.status}</strong>.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
