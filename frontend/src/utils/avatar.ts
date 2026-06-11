import { API_URL } from "../config";

const PLACEHOLDER_HOSTS = [
  "unsplash.com",
  "pravatar.cc",
  "i.pravatar.cc",
  "placeholder.com",
  "via.placeholder.com",
];

/** URL absolue pour un média API (/uploads/...) */
export function resolveMediaUrl(url?: string | null): string | null {
  if (!url || typeof url !== "string") return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }
  const path = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  return `${API_URL}${path}`;
}

export function isPlaceholderAvatar(url: string): boolean {
  try {
    const host = new URL(url, window.location.origin).hostname.toLowerCase();
    return PLACEHOLDER_HOSTS.some((h) => host.includes(h.replace("www.", "")));
  } catch {
    return PLACEHOLDER_HOSTS.some((h) => url.includes(h));
  }
}

/** Photo de profil utilisable (pas placeholder, pas la même que l'image produit). */
export function pickUserAvatarSrc(
  avatarUrl?: string | null,
  options?: { productImageUrl?: string | null },
): string | null {
  const resolved = resolveMediaUrl(avatarUrl);
  if (!resolved) return null;
  if (isPlaceholderAvatar(resolved)) return null;

  const productResolved = resolveMediaUrl(options?.productImageUrl);
  if (productResolved && resolved === productResolved) return null;

  return resolved;
}

export function getInitials(name?: string | null): string {
  if (!name?.trim()) return "?";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return parts[0][0].toUpperCase();
}
