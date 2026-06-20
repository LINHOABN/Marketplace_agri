/** 
 * API_URL - Base URL for Axios requests.
 * On Render, we want the root domain (without /api) as the baseURL, 
 * and we will prefix our requests or handle the path merging correctly.
 */
const rawApiUrl = import.meta.env.VITE_API_URL || "/api";
export const API_URL = rawApiUrl.endsWith("/") ? rawApiUrl.slice(0, -1) : rawApiUrl;

/** Base URL Socket.io — root domain of the backend. */
export const SOCKET_URL = import.meta.env.VITE_SOCKET_URL ||
    (API_URL.includes("/api") ? API_URL.replace("/api", "") : API_URL);
