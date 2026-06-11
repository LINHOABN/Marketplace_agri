import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { Eye, EyeOff, AlertTriangle, Loader2, Leaf } from "lucide-react";
import { API_URL } from "../config";
import { useUser } from "../context/UserContext";
import "./LoginPage.css";

export default function LoginPage() {
  const navigate = useNavigate();
  const { refreshUser } = useUser();

  // States - Auth
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [identifierType, setIdentifierType] = useState<"email" | "phone">(
    "email",
  );
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Handlers
  const toggleIdentifierType = () => {
    setIdentifierType((prev) => (prev === "email" ? "phone" : "email"));
    setIdentifier("");
    setError(null);
  };

  const validateForm = () => {
    if (!identifier.trim()) {
      setError(
        `Veuillez entrer votre ${identifierType === "email" ? "adresse e-mail" : "numéro de téléphone"}.`,
      );
      return false;
    }
    if (!password) {
      setError("Veuillez entrer votre mot de passe.");
      return false;
    }
    if (identifierType === "email" && !/\S+@\S+\.\S+/.test(identifier)) {
      setError("Format d'adresse e-mail invalide.");
      return false;
    }
    return true;
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!validateForm()) return;

    setIsLoading(true);

    try {
      const response = await axios.post(`${API_URL}/auth/login`, {
        identifier,
        password,
      });

      const { access_token, refresh_token, session_id, user } = response.data;

      if (access_token) {
        // Isolation de la session (Onglet actuel)
        sessionStorage.setItem("access_token", access_token);
        if (refresh_token) sessionStorage.setItem("refresh_token", refresh_token);
        if (session_id) sessionStorage.setItem("session_id", session_id);

        // Persistance globale (Dernier compte connecté)
        localStorage.setItem("access_token", access_token);
        if (refresh_token) localStorage.setItem("refresh_token", refresh_token);
        if (session_id) localStorage.setItem("session_id", session_id);

        await refreshUser();
        if (user && user.role === "admin") {
          navigate("/admin/dashboard");
        } else {
          navigate("/feed");
        }
      }
    } catch (err: any) {
      if (err.response) {
        const detail = err.response.data?.detail;
        if (err.response.status === 401) {
          setError("Identifiants incorrects. Vérifiez votre email/téléphone et mot de passe.");
        } else if (err.response.status === 403) {
          setError("Accès refusé. Veuillez réessayer ou contacter le support.");
        } else {
          setError(detail || "Une erreur serveur est survenue. Veuillez réessayer plus tard.");
        }
      } else {
        setError("Erreur de connexion : impossible d'atteindre les serveurs AgriMarché.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-standalone-container">
      <div className="login-logo" onClick={() => navigate("/")} style={{ cursor: "pointer" }}>
        <Leaf size={32} color="#2E7D32" />
        <span>AgriMarché</span>
      </div>

      <div className="login-card">
        <h1 className="login-title">Connexion</h1>
        <p className="login-subtitle">Accédez à votre compte AgriMarché</p>

        {error && (
          <div className="login-error">
            <AlertTriangle size={20} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleLogin} className="login-form">
          <div className="login-field">
            <label htmlFor="identifier" className="login-label">
              {identifierType === "email"
                ? "Adresse e-mail"
                : "Numéro de téléphone"}
            </label>
            <input
              id="identifier"
              type={identifierType === "email" ? "email" : "tel"}
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              className={`login-input ${error && !identifier ? "error" : ""}`}
              placeholder={
                identifierType === "email"
                  ? "exemple@domaine.com"
                  : "+237 ..."
              }
              disabled={isLoading}
              autoFocus
            />
            <button
              type="button"
              className="toggle-identifier"
              onClick={toggleIdentifierType}
              disabled={isLoading}
            >
              Utiliser{" "}
              {identifierType === "email" ? "le téléphone" : "l'e-mail"} à la place
            </button>
          </div>

          <div className="login-field">
            <label htmlFor="password" className="login-label">
              Mot de passe
            </label>
            <div className="login-input-wrapper">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={`login-input ${error && !password ? "error" : ""}`}
                disabled={isLoading}
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </div>

          <button type="submit" className="login-btn" disabled={isLoading}>
            {isLoading ? (
              <Loader2 className="spinner" size={20} />
            ) : (
              "Se connecter"
            )}
          </button>
        </form>

        <div className="login-links">
          <a href="#" className="login-link">
            Mot de passe oublié ?
          </a>
        </div>
      </div>

      <div className="login-divider">Nouveau sur AgriMarché ?</div>

      <button
        type="button"
        className="login-secondary-btn"
        onClick={() => navigate("/register")}
      >
        Créer votre compte AgriMarché
      </button>
    </div>
  );
}
