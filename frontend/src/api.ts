// =============================================================================
// api.ts — Client HTTP Axios (auth + sessions)
// =============================================================================

import axios, { type InternalAxiosRequestConfig } from "axios";
import { API_URL } from "./config";

/**
 * FIX ULTIME : On n'utilise PLUS le baseURL automatique d'Axios car il se comporte
 * de manière imprévisible avec les chemins commençant par un slash en production.
 * On gère tout manuellement dans l'intercepteur pour une fiabilité de 100%.
 */
const api = axios.create();

let isRefreshing = false;
let refreshQueue: Array<(token: string | null) => void> = [];

function processQueue(token: string | null) {
  refreshQueue.forEach((cb) => cb(token));
  refreshQueue = [];
}

function getAuthItem(key: string): string | null {
  return sessionStorage.getItem(key) || localStorage.getItem(key);
}

function setAuthItem(key: string, value: string) {
  sessionStorage.setItem(key, value);
  localStorage.setItem(key, value);
}

async function tryRefreshToken(): Promise<string | null> {
  const refresh = getAuthItem("refresh_token");
  if (!refresh) return null;
  try {
    const res = await axios.post(`${API_URL}/auth/refresh`, {
      refresh_token: refresh,
    });
    const newAccess = res.data.access_token as string;
    const newRefresh = res.data.refresh_token as string | undefined;

    setAuthItem("access_token", newAccess);
    if (newRefresh) setAuthItem("refresh_token", newRefresh);
    if (res.data.session_id) {
      setAuthItem("session_id", res.data.session_id);
    }
    return newAccess;
  } catch {
    return null;
  }
}

api.interceptors.request.use(
  (config) => {
    // 1. MANIFESTATION DE L'URL
    if (config.url && !config.url.startsWith("http")) {
      // On s'assure que API_URL ne finit pas par un slash pour la jointure
      const cleanBase = API_URL.endsWith("/") ? API_URL.slice(0, -1) : API_URL;

      // On retire le leading slash du chemin pour éviter de casser la jointure
      const cleanPath = config.url.startsWith("/") ? config.url.slice(1) : config.url;

      // Si le chemin contient déjà "api/", on l'enlève car cleanBase l'a déjà
      const finalPath = cleanPath.startsWith("api/") ? cleanPath.slice(4) : cleanPath;

      config.url = `${cleanBase}/${finalPath}`;
    }

    // 2. AUTHENTICATION
    const token = getAuthItem("access_token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    const sessionId = getAuthItem("session_id");
    if (sessionId) {
      config.headers["X-Session-Id"] = sessionId;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };

    if (
      error.response?.status === 401 &&
      originalRequest &&
      !originalRequest._retry &&
      !originalRequest.url?.includes("/auth/login") &&
      !originalRequest.url?.includes("/auth/register") &&
      !originalRequest.url?.includes("/auth/refresh")
    ) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          refreshQueue.push((token) => {
            if (!token) {
              reject(error);
              return;
            }
            originalRequest.headers.Authorization = `Bearer ${token}`;
            resolve(api(originalRequest));
          });
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;
      const newToken = await tryRefreshToken();
      isRefreshing = false;
      processQueue(newToken);

      if (newToken) {
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        // Important: on relance avec l'instance 'api'
        return api(originalRequest);
      }

      sessionStorage.removeItem("access_token");
      sessionStorage.removeItem("refresh_token");
      sessionStorage.removeItem("session_id");
      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");
      localStorage.removeItem("session_id");

      if (
        !window.location.pathname.startsWith("/login") &&
        window.location.pathname !== "/" &&
        !window.location.pathname.startsWith("/product/") &&
        !window.location.pathname.startsWith("/shop/") &&
        !window.location.pathname.startsWith("/search")
      ) {
        window.location.href = "/login";
      }
    }

    return Promise.reject(error);
  }
);

export default api;
