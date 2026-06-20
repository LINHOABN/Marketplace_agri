/** 
 * API_URL - Base URL for Axios requests.
 * On Render, we want the root domain (without /api) as the baseURL, 
 * and we will prefix our requests or handle the path merging correctly.
 */
let rawApiUrl = import.meta.env.VITE_API_URL || "/api";

// SÉCURITÉ : Si l'URL a été collée deux fois par accident (doublon https://...)
// on ne garde que la première occurrence.
if (rawApiUrl.startsWith("http") && rawApiUrl.includes("http", 8)) {
    const parts = rawApiUrl.split("http");
    rawApiUrl = "http" + parts[1]; // On prend le premier bloc propre
}

export const API_URL = rawApiUrl.endsWith("/") ? rawApiUrl.slice(0, -1) : rawApiUrl;

/** Base URL Socket.io — root domain of the backend. */
export const SOCKET_URL = import.meta.env.VITE_SOCKET_URL ||
    (API_URL.includes("/api") ? API_URL.replace("/api", "") : API_URL);
