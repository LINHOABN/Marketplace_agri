/**
 * UserContext - Contexte global pour la gestion du profil utilisateur
 */
import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import api from "../api";
import { API_URL } from "../config";

interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: string;
  avatar_url: string | null;
  city: string | null;
  description: string | null;
  phone: string | null;
  shop_name: string | null;
  shop_logo: string | null;
  managed_by_id: string | null;
  is_verified: boolean;
  base_role: string | null;
  granted_roles: string[];
}

interface UserContextType {
  currentUser: UserProfile | null;
  loading: boolean;
  fetchError: boolean;
  refreshUser: () => Promise<void>;
  updateAvatar: (newAvatarUrl: string) => void;
  updateProfile: (updates: Partial<UserProfile>) => void;
  getAvatarSrc: (avatarUrl?: string | null) => string | null;
  getInitials: (name: string) => string;
  switchRole: (newRole: string) => Promise<void>;
  logout: () => void;
}

const UserContext = createContext<UserContextType>({
  currentUser: null,
  loading: true,
  fetchError: false,
  refreshUser: async () => { },
  updateAvatar: () => { },
  updateProfile: () => { },
  getAvatarSrc: () => null,
  getInitials: () => "?",
  switchRole: async () => { },
  logout: () => { },
});

export function UserProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);

  const getAvatarSrc = (avatarUrl?: string | null): string | null => {
    if (!avatarUrl) return null;
    if (avatarUrl.startsWith("http")) return avatarUrl;
    if (avatarUrl.startsWith("/uploads")) return avatarUrl;
    return `${API_URL}${avatarUrl}`;
  };

  const getInitials = (name: string): string => {
    if (!name) return "?";
    const parts = name.split(" ");
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name[0].toUpperCase();
  };

  const refreshUser = async () => {
    try {
      setFetchError(false);
      const token = sessionStorage.getItem("access_token") || localStorage.getItem("access_token");

      if (!token) {
        setCurrentUser(null);
        setLoading(false);
        return;
      }
      const res = await api.get("/auth/me");
      setCurrentUser(res.data);
      setFetchError(false);
    } catch (err: any) {
      const status = err?.response?.status;
      if (status === 401 || status === 403) {
        sessionStorage.removeItem("access_token");
        localStorage.removeItem("access_token");
        setCurrentUser(null);
      } else if (!err?.response) {
        setFetchError(true);
      } else {
        setFetchError(true);
      }
    } finally {
      setLoading(false);
    }
  };

  const updateAvatar = (newAvatarUrl: string) => {
    setCurrentUser((prev) => prev ? { ...prev, avatar_url: newAvatarUrl } : prev);
  };

  const updateProfile = (updates: Partial<UserProfile>) => {
    setCurrentUser((prev) => prev ? { ...prev, ...updates } : prev);
  };

  useEffect(() => {
    refreshUser();
  }, []);

  useEffect(() => {
    // On ne synchronise plus automatiquement les onglets pour permettre le multi-compte
    // (Un onglet peut être Vendeur A et l'autre Livreur B)
  }, []);

  const switchRole = async (newRole: string) => {
    try {
      const res = await api.post("/auth/switch-role", { new_role: newRole });

      const { access_token, refresh_token, session_id } = res.data;

      // Mise à jour de la session de l'onglet ACTUEL
      if (access_token) sessionStorage.setItem("access_token", access_token);
      if (refresh_token) sessionStorage.setItem("refresh_token", refresh_token);
      if (session_id) sessionStorage.setItem("session_id", session_id);

      // Mise à jour de la persistance globale (dernier compte utilisé)
      if (access_token) localStorage.setItem("access_token", access_token);
      if (refresh_token) localStorage.setItem("refresh_token", refresh_token);
      if (session_id) localStorage.setItem("session_id", session_id);

      await refreshUser();
    } catch (err: any) {
      console.error("Switch role error:", err.response?.data || err);
      throw err;
    }
  };

  const logout = async () => {
    try {
      await api.post("/auth/logout");
    } catch {
      /* session déjà invalide */
    }
    sessionStorage.removeItem("access_token");
    sessionStorage.removeItem("refresh_token");
    sessionStorage.removeItem("session_id");
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    localStorage.removeItem("session_id");
    setCurrentUser(null);
    window.location.href = "/login";
  };

  return (
    <UserContext.Provider value={{ currentUser, loading, fetchError, refreshUser, updateAvatar, updateProfile, getAvatarSrc, getInitials, switchRole, logout }}>
      {children}
    </UserContext.Provider>
  );
}

export const useUser = () => useContext(UserContext);
