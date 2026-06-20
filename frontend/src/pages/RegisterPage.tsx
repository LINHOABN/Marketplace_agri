import { API_URL } from "../config";
import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import api from "../api";
import {
  Leaf,
  AlertTriangle,
  Loader2,
  Check,
  ChevronDown,
  User,
  ShoppingBag,
  Truck,
} from "lucide-react";
import { useUser } from "../hooks/useUser";
import "./RegisterPage.css";

const CAMEROON_REGIONS = [
  {
    id: "Adamaoua",
    name: "Adamaoua",
    cities: ["Ngaoundéré", "Banyo", "Meiganga", "Tibati"],
  },
  {
    id: "Centre",
    name: "Centre",
    cities: ["Yaoundé", "Bafia", "Mbalmayo", "Obala", "Eséka"],
  },
  {
    id: "Est",
    name: "Est",
    cities: ["Bertoua", "Batouri", "Abong-Mbang", "Yokadouma"],
  },
  {
    id: "Extreme-Nord",
    name: "Extrême-Nord",
    cities: ["Maroua", "Yagoua", "Kousséri", "Mokolo"],
  },
  {
    id: "Littoral",
    name: "Littoral",
    cities: ["Douala", "Edéa", "Nkongsamba", "Loum", "Mbanga"],
  },
  { id: "Nord", name: "Nord", cities: ["Garoua", "Guider", "Figuil", "Pitoa"] },
  {
    id: "Nord-Ouest",
    name: "Nord-Ouest",
    cities: ["Bamenda", "Kumbo", "Fundong", "Wum"],
  },
  {
    id: "Ouest",
    name: "Ouest",
    cities: ["Bafoussam", "Dschang", "Foumban", "Mbouda", "Bangangté"],
  },
  {
    id: "Sud",
    name: "Sud",
    cities: ["Ebolowa", "Sangmélima", "Kribi", "Ambam"],
  },
  {
    id: "Sud-Ouest",
    name: "Sud-Ouest",
    cities: ["Buea", "Limbe", "Kumba", "Tiko", "Mamfe"],
  },
];

const CAROUSEL_IMAGES = [
  "https://images.unsplash.com/photo-1592982537447-6f2a6a0a2021?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1488459716781-31db52582fe9?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1625246333195-78d9c38ad449?auto=format&fit=crop&w=1200&q=80",
];

const CAROUSEL_TEXTS = [
  {
    title: "Rejoignez agrimarche",
    subtitle: "La plus grande communauté agricole du Cameroun.",
  },
  {
    title: "Vendez sans limite",
    subtitle: "Trouvez des acheteurs dans tout le pays facilement.",
  },
  {
    title: "Achetez en confiance",
    subtitle: "Produits de qualité, paiements sécurisés.",
  },
];

export default function RegisterPage() {
  const navigate = useNavigate();
  const { refreshUser } = useUser();
  const [step, setStep] = useState(1);
  const [apiError, setApiError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % CAROUSEL_IMAGES.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
    trigger,
  } = useForm({
    defaultValues: {
      name: "",
      phone: "",
      email: "",
      password: "",
      confirmPassword: "",
      region: "",
      city: "",
      neighborhood: "",
      role: "buyer",
    },
    mode: "onTouched",
  });

  const roleValue = watch("role");

  const passwordValue = watch("password");
  const selectedRegion = watch("region");
  const availableCities =
    CAMEROON_REGIONS.find((r) => r.id === selectedRegion)?.cities || [];

  const nextStep = async () => {
    let isValid = false;
    if (step === 1) {
      isValid = await trigger([
        "name",
        "phone",
        "email",
        "password",
        "confirmPassword",
      ]);
    } else if (step === 2) {
      isValid = await trigger(["role"]);
    }
    if (isValid) {
      setStep((prev) => prev + 1);
      setApiError(null);
    }
  };

  const prevStep = () => {
    setStep((prev) => prev - 1);
    setApiError(null);
  };

  const onSubmit = async (data: any) => {
    setIsLoading(true);
    setApiError(null);
    try {
      const response = await api.post("/auth/register", {
        name: data.name,
        phone: data.phone,
        email: data.email,
        password: data.password,
        role: data.role,
        location: `${data.city} (${data.region}), ${data.neighborhood}`,
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
        if (user) {
          const { saveAccount } = await import("../utils/accounts");
          saveAccount({
            id: String(user.id),
            name: user.name || data.name,
            email: user.email || data.email,
            role: user.role || data.role,
            access_token,
            refresh_token,
            session_id,
          });
        }
      }
      navigate("/feed");
    } catch (err: any) {
      if (err.response && err.response.status === 400) {
        setApiError("Cet email ou ce numéro de téléphone est déjà utilis.");
      } else {
        setApiError("Une erreur est survenue lors de la création du compte.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="register-page-wrapper">
      <div className="register-presentation">
        <div className="carousel-container">
          {CAROUSEL_IMAGES.map((img, idx) => (
            <img
              key={idx}
              src={img}
              alt={`Slide ${idx}`}
              className={`carousel-image ${idx === currentSlide ? "active" : ""}`}
            />
          ))}
          <div className="carousel-overlay"></div>
        </div>
        <div className="presentation-content">
          <h2 className="presentation-title">
            {CAROUSEL_TEXTS[currentSlide].title}
          </h2>
          <p className="presentation-subtitle">
            {CAROUSEL_TEXTS[currentSlide].subtitle}
          </p>
        </div>
        <div className="carousel-indicators">
          {CAROUSEL_IMAGES.map((_, idx) => (
            <div
              key={idx}
              className={`indicator ${idx === currentSlide ? "active" : ""}`}
              onClick={() => setCurrentSlide(idx)}
            />
          ))}
        </div>
      </div>
      <div className="register-form-container">
        <div className="register-logo">
          <Leaf size={32} color="#2E7D32" />
          <span>agrimarche</span>
        </div>
        <div className="register-card">
          <h1 className="register-title">Créer un compte</h1>
          <div className="stepper">
            {[1, 2, 3].map((s) => (
              <div
                key={s}
                className={`step-indicator ${step === s ? "active" : ""} ${step > s ? "completed" : ""}`}
              >
                <div className="step-circle">
                  {step > s ? <Check size={16} /> : s}
                </div>
                <span className="step-label">
                  {s === 1 ? "Identité" : s === 2 ? "Rôle" : "Localisation"}
                </span>
              </div>
            ))}
          </div>
          {apiError && (
            <div className="register-error">
              <AlertTriangle size={20} />
              <span>{apiError}</span>
            </div>
          )}
          <form onSubmit={handleSubmit(onSubmit)} className="register-form">
            {step === 1 && (
              <>
                <div className="register-field">
                  <label className="register-label">Nom complet</label>
                  <input
                    type="text"
                    {...register("name", { required: "Le nom est requis" })}
                    className={`register-input ${errors.name ? "error" : ""}`}
                    placeholder="Jean Dupont"
                  />
                  {errors.name && (
                    <span className="field-error-msg">
                      {errors.name.message as string}
                    </span>
                  )}
                </div>
                <div className="register-field">
                  <label className="register-label">Numro de téléphone</label>
                  <input
                    type="tel"
                    {...register("phone", {
                      required: "Le numéro est requis",
                      pattern: {
                        value: /^(?:\+237|237)?[62]\d{8}$/,
                        message: "Format invalide (ex: +2376XXXXXXXX)",
                      },
                    })}
                    className={`register-input ${errors.phone ? "error" : ""}`}
                    placeholder="+237 6XX XX XX XX"
                  />
                  {errors.phone && (
                    <span className="field-error-msg">
                      {errors.phone.message as string}
                    </span>
                  )}
                </div>
                <div className="register-field">
                  <label className="register-label">Adresse e-mail</label>
                  <input
                    type="email"
                    {...register("email", {
                      required: "L'e-mail est requis",
                      pattern: {
                        value: /\S+@\S+\.\S+/,
                        message: "Format d'e-mail invalide",
                      },
                    })}
                    className={`register-input ${errors.email ? "error" : ""}`}
                    placeholder="exemple@domaine.com"
                  />
                  {errors.email && (
                    <span className="field-error-msg">
                      {errors.email.message as string}
                    </span>
                  )}
                </div>
                <div className="register-field">
                  <label className="register-label">Mot de passe</label>
                  <input
                    type="password"
                    {...register("password", {
                      required: "Le mot de passe est requis",
                      minLength: {
                        value: 8,
                        message:
                          "Le mot de passe doit faire au moins 8 caractères",
                      },
                    })}
                    className={`register-input ${errors.password ? "error" : ""}`}
                    placeholder="Au moins 8 caractères"
                  />
                  {errors.password && (
                    <span className="field-error-msg">
                      {errors.password.message as string}
                    </span>
                  )}
                </div>
                <div className="register-field">
                  <label className="register-label">
                    Confirmer le mot de passe
                  </label>
                  <input
                    type="password"
                    {...register("confirmPassword", {
                      validate: (value) =>
                        value === passwordValue ||
                        "Les mots de passe ne correspondent pas",
                    })}
                    className={`register-input ${errors.confirmPassword ? "error" : ""}`}
                  />
                  {errors.confirmPassword && (
                    <span className="field-error-msg">
                      {errors.confirmPassword.message as string}
                    </span>
                  )}
                </div>
              </>
            )}

            {step === 2 && (
              <>
                <div className="register-field">
                  <label className="register-label">Je suis un...</label>
                  <div className="role-grid">
                    <div
                      className={`role-card ${roleValue === "buyer" ? "selected" : ""}`}
                      onClick={() => setValue("role", "buyer")}
                    >
                      <div className="role-icon">
                        <ShoppingBag size={20} />
                      </div>
                      <div className="role-info">
                        <span className="role-title">Acheteur</span>
                        <span className="role-desc">Pour acheter des produits frais.</span>
                      </div>
                    </div>
                    <div
                      className={`role-card ${roleValue === "seller" ? "selected" : ""}`}
                      onClick={() => setValue("role", "seller")}
                    >
                      <div className="role-icon">
                        <User size={20} />
                      </div>
                      <div className="role-info">
                        <span className="role-title">Vendeur / Producteur</span>
                        <span className="role-desc">Pour vendre ma production.</span>
                      </div>
                    </div>
                    <div
                      className={`role-card ${roleValue === "deliverer" ? "selected" : ""}`}
                      onClick={() => setValue("role", "deliverer")}
                    >
                      <div className="role-icon">
                        <Truck size={20} />
                      </div>
                      <div className="role-info">
                        <span className="role-title">Livreur</span>
                        <span className="role-desc">Pour livrer des commandes.</span>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}

            {step === 3 && (
              <>
                <p className="register-subtitle">
                  Sélectionnez votre zone de vente ou d'achat au Cameroun.
                </p>
                <div className="register-field">
                  <label className="register-label">Rgion</label>
                  <div className="register-input-wrapper">
                    <select
                      {...register("region", {
                        required: "Veuillez choisir une région",
                      })}
                      className={`register-input ${errors.region ? "error" : ""}`}
                      style={{ appearance: "none", cursor: "pointer" }}
                      onChange={(e) => {
                        setValue("region", e.target.value);
                        setValue("city", "");
                      }}
                    >
                      <option value="">Sélectionnez une région...</option>
                      {CAMEROON_REGIONS.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name}
                        </option>
                      ))}
                    </select>
                    <ChevronDown
                      size={18}
                      color="#666"
                      style={{
                        position: "absolute",
                        right: "12px",
                        pointerEvents: "none",
                      }}
                    />
                  </div>
                  {errors.region && (
                    <span className="field-error-msg">
                      {errors.region.message as string}
                    </span>
                  )}
                </div>
                <div
                  className="register-field"
                  style={{
                    opacity: selectedRegion ? 1 : 0.5,
                    transition: "opacity 0.2s",
                  }}
                >
                  <label className="register-label">Ville</label>
                  <div className="register-input-wrapper">
                    <select
                      {...register("city", {
                        required: "Veuillez choisir une ville",
                      })}
                      className={`register-input ${errors.city ? "error" : ""}`}
                      style={{
                        appearance: "none",
                        cursor: selectedRegion ? "pointer" : "not-allowed",
                      }}
                      disabled={!selectedRegion}
                    >
                      <option value="">Sélectionnez une ville...</option>
                      {availableCities.map((city) => (
                        <option key={city} value={city}>
                          {city}
                        </option>
                      ))}
                    </select>
                    <ChevronDown
                      size={18}
                      color="#666"
                      style={{
                        position: "absolute",
                        right: "12px",
                        pointerEvents: "none",
                      }}
                    />
                  </div>
                  {errors.city && (
                    <span className="field-error-msg">
                      {errors.city.message as string}
                    </span>
                  )}
                </div>
                <div className="register-field">
                  <label className="register-label">Quartier (Optionnel)</label>
                  <input
                    type="text"
                    {...register("neighborhood")}
                    className="register-input"
                    placeholder="Ex: Deido, Bastos, Mvan..."
                  />
                </div>
              </>
            )}
            <div className="form-navigation">
              {step > 1 && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={prevStep}
                  disabled={isLoading}
                >
                  Précédent
                </button>
              )}
              {step < 3 ? (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={nextStep}
                  style={{ width: step === 1 ? "100%" : "auto" }}
                >
                  Continuer
                </button>
              ) : (
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <Loader2 className="spinner" size={20} />
                  ) : (
                    "Créer mon compte"
                  )}
                </button>
              )}
            </div>
          </form>
        </div>
        <div
          className="register-divider"
          style={{ maxWidth: "380px", width: "100%" }}
        >
          Déjà un compte ?
        </div>
        <Link
          to="/login"
          className="btn btn-secondary"
          style={{ maxWidth: "380px", width: "100%", textDecoration: "none" }}
        >
          Connectez-vous
        </Link>
      </div>
    </div>
  );
}
