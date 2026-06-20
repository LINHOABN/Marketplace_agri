import api from "../api";
import { useUser } from "../hooks/useUser";
import { toast } from "react-hot-toast";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  ChevronLeft,
  Plus,
  ArrowUpRight,
  Lock,
  History,
} from "lucide-react";
import "./WalletPage.css";

export default function WalletPage() {
  const navigate = useNavigate();
  const { currentUser } = useUser();
  const [data, setData] = useState({ balance: 0, in_transit_balance: 0, locked_balance: 0 });
  const [userRole, setUserRole] = useState<string>("buyer");
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDeposit, setShowDeposit] = useState(false);
  const [customAmount, setCustomAmount] = useState("");
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawPhone, setWithdrawPhone] = useState("");
  const [withdrawPin, setWithdrawPin] = useState("");

  const [selectedMethod, setSelectedMethod] = useState("MTN MoMo");
  const [showPhoneSim, setShowPhoneSim] = useState(false);
  const [simPin, setSimPin] = useState("");
  const [simLoading, setSimLoading] = useState(false);
  const [simPhone, setSimPhone] = useState("");
  const [selectedStatusCode, setSelectedStatusCode] = useState("SUCCESS");

  const handleDeposit = async () => {
    const amount = parseFloat(customAmount) || 0;
    if (!amount) return;
    setSimLoading(true);
    // Simulation du délai de validation réseau (2 secondes)
    await new Promise((resolve) => setTimeout(resolve, 2000));
    try {
      await api.post("/wallet/deposit", {
        amount,
        method: selectedMethod,
        phone: simPhone,
        status_code: selectedStatusCode
      });
      setSimLoading(false);
      setShowPhoneSim(false);
      setSimPin("");
      toast.success("Recharge réussie !");
      // Recharger les données au lieu de recharger toute la page
      fetchWalletData();
    } catch (err) {
      toast.error("La recharge a échoué.");
      setSimLoading(false);
    }
  };

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
    if (withdrawPin !== "1234") {
      toast.error("Code PIN de sécurité incorrect ! (Astuce : Entrez '1234' pour réussir la simulation)");
      return;
    }
    try {
      await api.post("/wallet/withdraw", {
        amount,
        phone: withdrawPhone,
        pin: withdrawPin
      });
      setShowWithdraw(false);
      toast.success("Retrait effectué !");
      fetchWalletData();
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Erreur lors du retrait");
    }
  };

  const fetchWalletData = async () => {
    try {
      const [walletRes, transRes] = await Promise.all([
        api.get("/wallet/"),
        api.get("/wallet/transactions"),
      ]);
      setData(walletRes.data);
      setTransactions(transRes.data);
      if (currentUser?.role) setUserRole(currentUser.role);
    } catch (err) {
      console.error("Wallet error", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWalletData();
  }, []);

  if (loading)
    return <div className="loading">Chargement du portefeuille...</div>;

  return (
    <div className="wallet-page-wrapper dashboard-wrapper">
      <header className="wallet-header-main dashboard-header">
        <button onClick={() => navigate(-1)} className="back-btn">
          <ChevronLeft />
        </button>
        <h1>Mon Portefeuille</h1>
      </header>

      <main className="wallet-content">
        <section className="balance-hero-card">
          <div className="balance-grid">
            <div className="balance-col main-balance">
              <p>Solde disponible</p>
              <h2>{(data.balance || 0).toLocaleString()} FCFA</h2>
            </div>
            <div className="balance-col escrow-balance-col">
              <p>
                <Lock size={13} style={{ marginRight: "4px" }} />
                {userRole === "seller" ? "Argent en cours" : "Séquestre (achats)"}
              </p>
              <h2>
                {(userRole === "seller"
                  ? data.in_transit_balance ?? data.locked_balance
                  : data.locked_balance || 0
                ).toLocaleString()}{" "}
                FCFA
              </h2>
            </div>
          </div>
          <div className="balance-actions">
            <button
              className="btn-deposit"
              onClick={() => setShowDeposit(true)}
            >
              <Plus size={18} /> Recharger
            </button>
            <button className="btn-withdraw" onClick={() => setShowWithdraw(true)}>
              <ArrowUpRight size={18} /> Retirer
            </button>
          </div>
        </section>

        <section className="transactions-section">
          <div className="section-title">
            <History size={18} />
            <h3>Historique des Transactions</h3>
          </div>
          <div className="transaction-list">
            {transactions.length === 0 ? (
              <div className="wallet-empty-state">
                <p>Aucune transaction pour le moment.</p>
              </div>
            ) : (
              transactions.map((t) => (
                <div key={t.id} className="transaction-item">
                  <div className={`type-icon ${t.amount > 0 ? "in" : "out"}`}>
                    {t.amount > 0 ? (
                      <Plus size={16} />
                    ) : (
                      <ArrowUpRight size={16} />
                    )}
                  </div>
                  <div className="t-info">
                    <p className="t-desc">{t.description || t.type}</p>
                    <small>{new Date(t.created_at).toLocaleDateString()}</small>
                  </div>
                  <div className={`t-amount ${t.amount > 0 ? "pos" : "neg"}`}>
                    {t.amount > 0 ? "+" : ""}
                    {t.amount.toLocaleString()} FCFA
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </main>

      {showDeposit && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Recharger mon compte</h3>
            <div className="input-group-deposit">
              <label>Montant à recharger (FCFA)</label>
              <input
                type="number"
                className="custom-deposit-input"
                placeholder="Ex: 1500"
                value={customAmount}
                onChange={(e) => setCustomAmount(e.target.value)}
              />
            </div>
            <div className="quick-amounts">
              {[1000, 2000, 5000, 10000].map((amt) => (
                <button
                  key={amt}
                  className="amt-chip"
                  onClick={() => setCustomAmount(amt.toString())}
                >
                  {amt} FCFA
                </button>
              ))}
            </div>
            <div className="input-group-deposit" style={{ marginTop: "12px" }}>
              <label>Numéro de téléphone Mobile Money</label>
              <input
                type="text"
                className="custom-deposit-input"
                placeholder="Ex: 677777777"
                value={simPhone}
                onChange={(e) => setSimPhone(e.target.value)}
              />
            </div>
            <div className="method-select">
              <div
                className={`method-box ${selectedMethod === "MTN MoMo" ? "active" : ""}`}
                onClick={() => setSelectedMethod("MTN MoMo")}
              >
                MTN MoMo
              </div>
              <div
                className={`method-box ${selectedMethod === "Orange Money" ? "active" : ""}`}
                onClick={() => setSelectedMethod("Orange Money")}
              >
                Orange Money
              </div>
            </div>
            <button
              className="btn-confirm-deposit"
              onClick={() => {
                const amt = parseFloat(customAmount) || 0;
                if (amt <= 0) {
                  toast.error("Veuillez saisir un montant valide.");
                  return;
                }
                if (!simPhone.trim()) {
                  toast.error("Veuillez saisir votre numéro Mobile Money.");
                  return;
                }
                setShowDeposit(false);
                setShowPhoneSim(true);
              }}
            >
              Lancer la recharge
            </button>
            <button
              className="btn-close-modal"
              onClick={() => setShowDeposit(false)}
            >
              Annuler
            </button>
          </div>
        </div>
      )}

      {showWithdraw && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Retirer des fonds</h3>
            <div className="input-group-deposit">
              <label>Montant à retirer (FCFA)</label>
              <input
                type="number"
                className="custom-deposit-input"
                placeholder="Ex: 5000"
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value)}
              />
            </div>
            <div className="input-group-deposit" style={{ marginTop: "12px" }}>
              <label>Numéro de téléphone Mobile Money</label>
              <input
                type="text"
                className="custom-deposit-input"
                placeholder="Ex: 677777777"
                value={withdrawPhone}
                onChange={(e) => setWithdrawPhone(e.target.value)}
              />
            </div>
            <div className="input-group-deposit" style={{ marginTop: "12px" }}>
              <label>Code PIN secret de sécurité</label>
              <input
                type="password"
                className="custom-deposit-input"
                placeholder="Entrez votre PIN"
                value={withdrawPin}
                onChange={(e) => setWithdrawPin(e.target.value)}
              />
            </div>
            <button className="btn-confirm-deposit" style={{ marginTop: "20px" }} onClick={handleWithdraw}>
              Confirmer le retrait
            </button>
            <button
              className="btn-close-modal"
              onClick={() => setShowWithdraw(false)}
            >
              Annuler
            </button>
          </div>
        </div>
      )}

      {showPhoneSim && (
        <div className="modal-overlay">
          <div className="phone-simulator-frame">
            <div className="phone-screen">
              <div className="phone-status-bar">
                <span>12:00</span>
                <span>📶 🔕 🔋 100%</span>
              </div>
              <div className="ussd-prompt-box">
                <div className="ussd-header">{selectedMethod} Pay</div>
                <div className="ussd-content">
                  <p>
                    Autoriser le débit de{" "}
                    <strong>{parseFloat(customAmount).toLocaleString()} FCFA</strong>{" "}
                    au profit de <strong>AgriMarché</strong> ?
                  </p>
                  <p className="ussd-sub">Saisir votre code PIN (4 chiffres) :</p>
                  <input
                    type="password"
                    maxLength={4}
                    className="ussd-pin-input"
                    placeholder=""
                    value={simPin}
                    onChange={(e) => setSimPin(e.target.value)}
                    disabled={simLoading}
                    autoFocus
                  />
                </div>

                {/* Mode Test Simulation */}
                <div style={{ padding: '0 15px 10px', display: 'flex', flexWrap: 'wrap', gap: '5px', fontSize: '10px' }}>
                  <span style={{ width: '100%', opacity: 0.6, marginBottom: '2px' }}>Mode Test : simuler un résultat</span>
                  {['SUCCESS', 'FAILED', 'INSUFFICIENT_FUNDS', 'CANCELLED'].map(code => (
                    <button
                      key={code}
                      onClick={() => setSelectedStatusCode(code)}
                      style={{
                        padding: '2px 6px', borderRadius: '4px', border: 'none',
                        background: selectedStatusCode === code ? (code === 'SUCCESS' ? '#10B981' : '#EF4444') : '#eee',
                        color: selectedStatusCode === code ? 'white' : '#666',
                        cursor: 'pointer', fontSize: '9px'
                      }}
                    >
                      {code}
                    </button>
                  ))}
                </div>

                <div className="ussd-actions">
                  <button
                    className="ussd-btn cancel"
                    onClick={() => {
                      setShowPhoneSim(false);
                      setSimPin("");
                    }}
                    disabled={simLoading}
                  >
                    Annuler
                  </button>
                  <button
                    className={`ussd-btn confirm ${selectedMethod === "MTN MoMo" ? "mtn" : "orange"}`}
                    onClick={() => {
                      if (simPin.length < 4) {
                        toast.error("Le code PIN doit comporter 4 chiffres.");
                        return;
                      }
                      if (simPin !== "1234") {
                        setSimLoading(true);
                        setTimeout(() => {
                          setSimLoading(false);
                          toast.error("Code PIN incorrect ! (Astuce : 1234)");
                          setSimPin("");
                        }, 1000);
                        return;
                      }
                      handleDeposit();
                    }}
                    disabled={simLoading}
                  >
                    {simLoading ? "Patientez..." : "Envoyer"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
