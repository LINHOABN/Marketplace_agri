// CONFIGURATION DE L'API
// En production sur Vercel, utilisez les variables d'environnement VITE_API_URL et VITE_SOCKET_URL.
// Exemple VITE_API_URL : https://votre-api.onrender.com/api
let rawApiUrl = import.meta.env.VITE_API_URL || "/api";

// SÉCURITÉ : Si l'URL a été collée deux fois par accident (doublon https://...)
if (rawApiUrl.startsWith("http") && rawApiUrl.includes("http", 8)) {
    const parts = rawApiUrl.split("http");
    rawApiUrl = "http" + parts[1];
}

export const API_URL = rawApiUrl.endsWith("/") ? rawApiUrl.slice(0, -1) : rawApiUrl;

/** Base URL Socket.io — En prod, c'est l'URL du backend SANS le suffixe /api */
export const SOCKET_URL = import.meta.env.VITE_SOCKET_URL ||
    (API_URL.includes("/api") ? API_URL.replace("/api", "") : API_URL);
