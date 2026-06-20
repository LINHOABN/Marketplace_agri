// =============================================================================
// api.ts — Client HTTP Axios (auth + sessions)
// =============================================================================

import axios, { type InternalAxiosRequestConfig } from "axios";
import { API_URL } from "./config";

// On définit la baseURL sans le suffixe /api pour éviter les conflits de merging
// avec les chemins commençant par un slash (Axios remplace le chemin de la baseURL sinon).
const baseRoot = API_URL.replace(/\/api\/?$/, "");

const api = axios.create({
  baseURL: baseRoot,
});

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
    // On utilise axios direct pour éviter l'intercepteur de boucle
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
    // NORMALISATION : Si l'URL n'est pas absolue et ne commence pas par /api, on l'ajoute.
    // Cela permet aux appels comme api.get("/auth/me") de devenir /api/auth/me
    // et d'être correctement joints à la baseURL (le domaine racine).
    if (config.url && !config.url.startsWith("http") && !config.url.startsWith("/api")) {
      const separator = config.url.startsWith("/") ? "" : "/";
      config.url = `/api${separator}${config.url}`;
    }

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
        return api(originalRequest);
      }

      // Logout on refresh failure
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
