import { API_URL } from '../config';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Download,
  Filter,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  RefreshCw,
  Eye,
  TrendingUp,
  DollarSign,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  X,
} from 'lucide-react';
import './TransactionsList.css';

const API_BASE = `${API_URL}`;

// ── Helpers ──────────────────────────────────────────────────
const getToken = () => localStorage.getItem('admin_token');

const STATUS_CONFIG = {
  pending: { label: 'En attente', color: '#F59E0B', bg: '#FEF3C7', icon: Clock },
  completed: { label: 'Complétée', color: '#10B981', bg: '#D1FAE5', icon: CheckCircle },
  failed: { label: 'Échouée', color: '#EF4444', bg: '#FEE2E2', icon: XCircle },
};

const TYPE_CONFIG = {
  deposit: { label: 'Dépôt', color: '#3B82F6' },
  withdrawal: { label: 'Retrait', color: '#8B5CF6' },
  escrow_lock: { label: 'Escrow bloqué', color: '#F59E0B' },
  escrow_release: { label: 'Escrow libéré', color: '#10B981' },
  commission: { label: 'Commission', color: '#6366F1' },
  refund: { label: 'Remboursement', color: '#EC4899' },
};

const fmt = (amount) =>
  new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'XAF',
    minimumFractionDigits: 0,
  }).format(amount);

const fmtDate = (iso) =>
  new Date(iso).toLocaleString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

const StatusBadge = ({ status }) => {
  const cfg = STATUS_CONFIG[status] || { label: status, color: '#6B7280', bg: '#F3F4F6' };
  const Icon = cfg.icon || Clock;
  return (
    <span className="tx-badge" style={{ color: cfg.color, background: cfg.bg }}>
      <Icon size={12} /> {cfg.label}
    </span>
  );
};

const TypeBadge = ({ type }) => {
  const cfg = TYPE_CONFIG[type] || { label: type, color: '#6B7280' };
  return (
    <span className="tx-type-badge" style={{ borderColor: cfg.color, color: cfg.color }}>
      {cfg.label}
    </span>
  );
};

// ── Composant Principal ───────────────────────────────────────
export default function TransactionsList() {
  const navigate = useNavigate();
  const debounceRef = useRef(null);

  // Data state
  const [transactions, setTransactions] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters state
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');
  const [minAmount, setMinAmount] = useState('');
  const [maxAmount, setMaxAmount] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [sortField, setSortField] = useState('created_at');
  const [sortDir, setSortDir] = useState('desc');
  const [exporting, setExporting] = useState(false);

  const LIMIT = 20;

  // ── Fetch ──
  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = { page, limit: LIMIT };
      if (search) params.search = search;
      if (filterStatus) params.status = filterStatus;
      if (filterFrom) params.from = filterFrom;
      if (filterTo) params.to = filterTo;
      if (minAmount) params.minAmount = minAmount;
      if (maxAmount) params.maxAmount = maxAmount;

      const res = await axios.get(`${API_BASE}/admin/transactions`, {
        headers: { Authorization: `Bearer ${getToken()}` },
        params,
      });
      setTransactions(res.data.transactions || []);
      setTotal(res.data.total || 0);
      setTotalPages(res.data.totalPages || 1);
    } catch (err) {
      if (err.response?.status === 401 || err.response?.status === 403) {
        navigate('/admin/dashboard');
      }
      setError(err.response?.data?.error || 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  }, [page, search, filterStatus, filterFrom, filterTo, minAmount, maxAmount, navigate]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  // ── Search debounce ──
  const handleSearchChange = (val) => {
    clearTimeout(debounceRef.current);
    setSearch(val);
    debounceRef.current = setTimeout(() => {
      setPage(1);
    }, 400);
  };

  // ── CSV Export ──
  const handleExport = async () => {
    setExporting(true);
    try {
      const params = {};
      if (search) params.search = search;
      if (filterStatus) params.status = filterStatus;
      if (filterFrom) params.from = filterFrom;
      if (filterTo) params.to = filterTo;

      const res = await axios.get(`${API_BASE}/admin/transactions/export-csv`, {
        headers: { Authorization: `Bearer ${getToken()}` },
        params,
        responseType: 'blob',
      });

      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `transactions_${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert("Erreur lors de l'export CSV");
    } finally {
      setExporting(false);
    }
  };

  // ── Sort (client-side) ──
  const handleSort = (field) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const sorted = [...transactions].sort((a, b) => {
    let av = a[sortField],
      bv = b[sortField];
    if (sortField === 'amount') {
      av = parseFloat(av);
      bv = parseFloat(bv);
    }
    if (av < bv) return sortDir === 'asc' ? -1 : 1;
    if (av > bv) return sortDir === 'asc' ? 1 : -1;
    return 0;
  });

  const resetFilters = () => {
    setSearch('');
    setFilterStatus('');
    setFilterFrom('');
    setFilterTo('');
    setMinAmount('');
    setMaxAmount('');
    setPage(1);
  };

  const hasActiveFilters =
    search || filterStatus || filterFrom || filterTo || minAmount || maxAmount;

  return (
    <div className="txlist-wrapper">
      <div className="txlist-header">
        <div className="txlist-title-group">
          <div className="txlist-icon-wrap">
            <TrendingUp size={22} />
          </div>
          <div>
            <h1 className="txlist-title">Transactions</h1>
            <p className="txlist-subtitle">
              {total.toLocaleString()} transaction{total > 1 ? 's' : ''} au total
            </p>
          </div>
        </div>
        <div className="txlist-header-actions">
          <button
            className={`txlist-btn txlist-btn-ghost ${showFilters ? 'active' : ''}`}
            onClick={() => setShowFilters((f) => !f)}
          >
            <Filter size={16} />
            Filtres
            {hasActiveFilters && <span className="filter-dot" />}
          </button>
          <button className="txlist-btn txlist-btn-ghost" onClick={fetchTransactions}>
            <RefreshCw size={16} className={loading ? 'spin' : ''} />
          </button>
          <button
            className="txlist-btn txlist-btn-primary"
            onClick={handleExport}
            disabled={exporting}
          >
            <Download size={16} />
            {exporting ? 'Export...' : 'Exporter CSV'}
          </button>
        </div>
      </div>

      <div className="txlist-search-row">
        <div className="txlist-search-wrap">
          <Search size={16} className="txlist-search-icon" />
          <input
            className="txlist-search"
            placeholder="Rechercher par ID, référence, nom d'acheteur ou vendeur..."
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
          />
          {search && (
            <button className="txlist-search-clear" onClick={() => handleSearchChange('')}>
              <X size={14} />
            </button>
          )}
        </div>
        <select
          className="txlist-select"
          value={filterStatus}
          onChange={(e) => {
            setFilterStatus(e.target.value);
            setPage(1);
          }}
        >
          <option value="">Tous les statuts</option>
          <option value="pending">En attente</option>
          <option value="completed">Complétée</option>
          <option value="failed">Échouée</option>
        </select>
      </div>

      {showFilters && (
        <div className="txlist-filters-panel">
          <div className="filters-grid">
            <div className="filter-group">
              <label>Date de début</label>
              <input
                type="date"
                value={filterFrom}
                onChange={(e) => {
                  setFilterFrom(e.target.value);
                  setPage(1);
                }}
              />
            </div>
            <div className="filter-group">
              <label>Date de fin</label>
              <input
                type="date"
                value={filterTo}
                onChange={(e) => {
                  setFilterTo(e.target.value);
                  setPage(1);
                }}
              />
            </div>
            <div className="filter-group">
              <label>Montant min (FCFA)</label>
              <input
                type="number"
                placeholder="0"
                value={minAmount}
                onChange={(e) => {
                  setMinAmount(e.target.value);
                  setPage(1);
                }}
              />
            </div>
            <div className="filter-group">
              <label>Montant max (FCFA)</label>
              <input
                type="number"
                placeholder="∞"
                value={maxAmount}
                onChange={(e) => {
                  setMaxAmount(e.target.value);
                  setPage(1);
                }}
              />
            </div>
          </div>
          {hasActiveFilters && (
            <button className="txlist-btn txlist-btn-ghost reset-btn" onClick={resetFilters}>
              <X size={14} /> Réinitialiser les filtres
            </button>
          )}
        </div>
      )}

      <div className="txlist-table-wrap">
        {error ? (
          <div className="txlist-error">
            <AlertTriangle size={20} /> {error}
          </div>
        ) : (
          <table className="txlist-table">
            <thead>
              <tr>
                <th onClick={() => handleSort('id')} className="sortable">
                  ID <ArrowUpDown size={12} />
                </th>
                <th onClick={() => handleSort('created_at')} className="sortable">
                  Date <ArrowUpDown size={12} />
                </th>
                <th>Type</th>
                <th>Acheteur</th>
                <th>Vendeur</th>
                <th onClick={() => handleSort('amount')} className="sortable">
                  Montant <ArrowUpDown size={12} />
                </th>
                <th>Commission</th>
                <th>Statut</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="skeleton-row">
                    {Array.from({ length: 9 }).map((_, j) => (
                      <td key={j}>
                        <div className="skeleton-cell" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : sorted.length === 0 ? (
                <tr>
                  <td colSpan={9} className="txlist-empty">
                    <DollarSign size={40} />
                    <p>Aucune transaction trouvée</p>
                    {hasActiveFilters && (
                      <button className="txlist-btn txlist-btn-ghost" onClick={resetFilters}>
                        Effacer les filtres
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                sorted.map((tx) => (
                  <tr
                    key={tx.id}
                    className="txlist-row"
                    onClick={() => navigate(`/admin/transactions/${tx.id}`)}
                  >
                    <td className="tx-id">
                      <code>{tx.id?.substring(0, 8)}…</code>
                      {tx.reference && <span className="tx-ref">{tx.reference}</span>}
                    </td>
                    <td className="tx-date">{fmtDate(tx.created_at)}</td>
                    <td>
                      <TypeBadge type={tx.type} />
                    </td>
                    <td className="tx-user">{tx.buyer_name || <span className="muted">—</span>}</td>
                    <td className="tx-user">{tx.seller_name || <span className="muted">—</span>}</td>
                    <td className="tx-amount">{fmt(tx.amount)}</td>
                    <td className="tx-commission">{fmt(tx.commission || 0)}</td>
                    <td>
                      <StatusBadge status={tx.status} />
                    </td>
                    <td>
                      <button
                        className="txlist-icon-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/admin/transactions/${tx.id}`);
                        }}
                      >
                        <Eye size={15} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>

      {!loading && totalPages > 1 && (
        <div className="txlist-pagination">
          <span className="page-info">
            Page {page} / {totalPages} — {total} résultats
          </span>
          <div className="page-controls">
            <button className="page-btn" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              <ChevronLeft size={16} />
            </button>
            {Array.from({ length: Math.min(7, totalPages) }, (_, i) => {
              const p = page <= 4 ? i + 1 : page - 3 + i;
              if (p < 1 || p > totalPages) return null;
              return (
                <button
                  key={p}
                  className={`page-btn ${p === page ? 'active' : ''}`}
                  onClick={() => setPage(p)}
                >
                  {p}
                </button>
              );
            })}
            <button
              className="page-btn"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
