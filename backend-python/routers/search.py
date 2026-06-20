# =============================================================================
# routers/search.py — Algorithme de Recherche
# =============================================================================

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text
from database import get_db
from utils.text_normalize import fold_accents

router = APIRouter(prefix="/search", tags=["search"])


@router.get("/categories")
async def get_categories(db: Session = Depends(get_db)):
    """Retourne toutes les catégories produits pour le formulaire de création."""
    result = db.execute(
        text("SELECT id, name, description FROM categories ORDER BY name")
    ).mappings().all()
    return [dict(r) for r in result]


@router.get("/suggest")
async def suggest(q: str = "", db: Session = Depends(get_db)):
    """Auto-complétion intelligente depuis le catalogue de recherche."""
    if not q or len(q) < 2:
        return []
    pattern = f"%{q.lower()}%"

    # 1) Tentative depuis le catalogue de recherche dédié (si alimenté)
    result = db.execute(
        text("""
        SELECT DISTINCT common_name as label, category as domain
        FROM search_catalog
        WHERE LOWER(common_name) LIKE :p
           OR EXISTS (
               SELECT 1 FROM unnest(search_keywords) kw WHERE LOWER(kw) LIKE :p
           )
           OR EXISTS (
               SELECT 1 FROM unnest(synonyms) syn WHERE LOWER(syn) LIKE :p
           )
        ORDER BY common_name
        LIMIT 8
    """),
        {"p": pattern},
    ).mappings().all()
    rows = [dict(r) for r in result]
    if rows:
        return rows

    # 2) Fallback : suggestions directement à partir des produits existants
    fallback = db.execute(
        text("""
        SELECT DISTINCT
            p.name AS label,
            COALESCE(c.name, 'Produit') AS domain
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        WHERE LOWER(p.name) LIKE :p
           OR LOWER(COALESCE(p.description, '')) LIKE :p
        ORDER BY p.name
        LIMIT 8
    """),
        {"p": pattern},
    ).mappings().all()
    return [dict(r) for r in fallback]


def _map_product_row(row: dict) -> dict:
    """Format unifié pour ProductCard / SearchResultsPage."""
    item = dict(row)
    item["id"] = str(item["id"])
    item["item_type"] = "product"
    item["image"] = item.get("image_url") or item.get("image") or ""
    item["sellerName"] = (
        item.get("sellerName")
        or item.get("seller_name")
        or item.get("shop_name")
        or "Vendeur"
    )
    if item.get("seller_id"):
        item["seller_id"] = str(item["seller_id"])
    if item.get("shop_id"):
        item["shop_id"] = str(item["shop_id"])
    item["distanceKm"] = item.get("distanceKm") or 0
    item["likes"] = item.get("likes") or 0
    item["isNew"] = item.get("isNew") or False
    return item


@router.get("/")
async def search_all(
    q: str = "",
    category: str = "",
    sort: str = "recent",
    db: Session = Depends(get_db),
):
    """Recherche des produits avec filtres et tris (global si q/cat vides)."""

    params: dict = {}
    conditions = ["1=1"]

    if q:
        conditions.append(
            """(
                p.name ILIKE :q
                OR p.description ILIKE :q
                OR c.name ILIKE :q
                OR s.name ILIKE :q
            )"""
        )
        params["q"] = f"%{q}%"

    if category:
        conditions.append("LOWER(COALESCE(c.name, '')) LIKE LOWER(:cat)")
        params["cat"] = f"%{category}%"

    if sort == "price_asc":
        order_clause = "ORDER BY p.price ASC"
    elif sort == "price_desc":
        order_clause = "ORDER BY p.price DESC"
    elif sort == "popular":
        order_clause = """ORDER BY (
            SELECT COUNT(*) FROM product_reviews rv WHERE rv.product_id = p.id
        ) DESC, (
            SELECT AVG(rv.rating) FROM product_reviews rv WHERE rv.product_id = p.id
        ) DESC NULLS LAST, p.created_at DESC"""
    else:
        order_clause = "ORDER BY p.created_at DESC"

    query = text(f"""
        SELECT p.id, p.name, p.price, p.unit, p.image_url, p.image_url as image,
               p.quantity_available, p.shop_id,
               c.name as category_name, s.name as shop_name,
               u.id as seller_id, u.full_name as sellerName,
               'product' as item_type
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        LEFT JOIN shops s ON p.shop_id = s.id
        LEFT JOIN users u ON s.seller_id = u.id
        WHERE {" AND ".join(conditions)}
        {order_clause}
        LIMIT 40
    """)

    result = db.execute(query, params).mappings().all()
    products = [_map_product_row(dict(r)) for r in result]
    
    # Si aucun produit n'est trouvé et qu'on a une recherche textuelle, on cherche des boutiques
    shops = []
    if not products and q:
        shop_query = text("""
            SELECT s.id, s.name, s.description, s.logo_url, s.specialties,
                   u.full_name as seller_name, u.location as city, 'shop' as item_type
            FROM shops s
            JOIN users u ON s.seller_id = u.id
            WHERE LOWER(s.name) LIKE LOWER(:q)
               OR LOWER(COALESCE(s.description, '')) LIKE LOWER(:q)
               OR LOWER(COALESCE(s.specialties, '')) LIKE LOWER(:q)
            LIMIT 10
        """)
        shop_res = db.execute(shop_query, {"q": f"%{q}%"}).mappings().all()
        shops = [dict(r) for r in shop_res]
        for s in shops:
            s["id"] = str(s["id"])
            
    return {
        "products": products,
        "shops": shops,
        "query": q,
        "category": category
    }

@router.get("/shops")
async def search_shops(q: str = "", db: Session = Depends(get_db)):
    """Endpoint dédié à la recherche de boutiques spécialisées."""
    if not q: return []
    query = text("""
        SELECT s.id, s.name, s.description, s.logo_url, s.specialties,
               u.full_name as seller_name, u.location as city, 'shop' as item_type
        FROM shops s
        JOIN users u ON s.seller_id = u.id
        WHERE LOWER(s.name) LIKE LOWER(:q)
           OR LOWER(COALESCE(s.description, '')) LIKE LOWER(:q)
           OR LOWER(COALESCE(s.specialties, '')) LIKE LOWER(:q)
        LIMIT 20
    """)
    result = db.execute(query, {"q": f"%{q}%"}).mappings().all()
    rows = [dict(r) for r in result]
    for r in rows: r["id"] = str(r["id"])
    return rows
