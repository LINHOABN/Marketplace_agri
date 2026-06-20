/** Base URL API — proxifiée par Vite en dev, directe en prod. */
export const API_URL = import.meta.env.VITE_API_URL || "/api";

/** Base URL Socket.io — nécessaire quand le backend est sur un domaine différent. */
export const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || (import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace("/api", "") : "/");
