/** Normalise une réponse recherche API vers le format ProductCard */
export function normalizeSearchItem(raw: Record<string, unknown>): Record<string, unknown> {
  if (raw.item_type === "product" || raw.item_type === "post") {
    return {
      ...raw,
      image: raw.image || raw.image_url || "",
      sellerName: raw.sellerName || raw.shop_name || "Vendeur",
      distanceKm: raw.distanceKm ?? 0,
      likes: raw.likes ?? 0,
      isNew: raw.isNew ?? false,
    };
  }
  return {
    ...raw,
    item_type: "product",
    image: raw.image_url || raw.image || "",
    sellerName: raw.sellerName || raw.shop_name || "Vendeur",
    distanceKm: 0,
    likes: 0,
    isNew: false,
  };
}
