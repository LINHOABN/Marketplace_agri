from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import text
from database import get_db

router = APIRouter(prefix="/feed", tags=["feed"])

@router.get("")
async def get_feed(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db)
):
    """
    Flux principal : retourne les produits avec catégorie et les posts récents.
    Les produits sont triés par date de création (les plus récents d'abord).
    """
    try:
        offset = (page - 1) * limit

        products_query = text("""
            SELECT
                p.id,
                p.name,
                p.price,
                p.image_url         AS image,
                p.created_at,
                p.shop_id,
                p.quantity_available,
                p.location,
                s.name              AS shop_name,
                u.full_name         AS sellerName,
                u.id                AS seller_id,
                u.avatar_url        AS vendor_avatar,
                r.role              AS seller_role,
                c.name              AS category_name,
                c.id                AS category_id,
                COALESCE((
                    SELECT COUNT(*)::int
                    FROM product_reviews rv
                    WHERE rv.product_id = p.id
                ), 0) AS review_count,
                COALESCE((
                    SELECT AVG(rv.rating)::float
                    FROM product_reviews rv
                    WHERE rv.product_id = p.id
                ), 0) AS avg_rating,
                'product'           AS item_type
            FROM products p
            JOIN shops s ON p.shop_id = s.id
            JOIN users u ON s.seller_id = u.id
            LEFT JOIN user_roles r ON u.id = r.user_id
            LEFT JOIN categories c ON p.category_id = c.id
            WHERE p.quantity_available > 0
            ORDER BY p.created_at DESC
            LIMIT :limit OFFSET :offset
        """)
        products_result = db.execute(products_query, {"limit": limit, "offset": offset}).mappings().all()

        posts_query = text("""
            SELECT
                p.id,
                p.content,
                p.media_url,
                p.created_at,
                p.user_id,
                p.type,
                COALESCE(p.category, 'Général') AS category,
                u.full_name  AS author_name,
                u.avatar_url AS author_avatar,
                r.role       AS author_role,
                'post'       AS item_type
            FROM posts p
            JOIN users u ON p.user_id = u.id
            LEFT JOIN user_roles r ON u.id = r.user_id
            WHERE (p.type = 'permanent') OR (p.type = 'story' AND p.expires_at > NOW())
            ORDER BY p.created_at DESC
            LIMIT 50
        """)
        posts_result = db.execute(posts_query).mappings().all()

        final_list = []
        for row in list(products_result) + list(posts_result):
            item = dict(row)
            item["id"] = str(item["id"])
            if item.get("seller_id"):  item["seller_id"] = str(item["seller_id"])
            if item.get("shop_id"):    item["shop_id"]   = str(item["shop_id"])
            if item.get("user_id"):    item["user_id"]   = str(item["user_id"])
            if item.get("category_id"): item["category_id"] = str(item["category_id"])
            final_list.append(item)

        final_list.sort(key=lambda x: x["created_at"], reverse=True)
        return {"items": final_list, "page": page, "limit": limit}

    except Exception as e:
        print(f"Feed error: {e}")
        raise HTTPException(status_code=500, detail="Impossible de charger le flux")


@router.get("/popular")
async def get_popular_products(
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db)
):
    """
    Produits populaires : classés par nombre de reviews desc, puis note moyenne desc.
    Uniquement des données réelles de la base.
    """
    try:
        query = text("""
            SELECT
                p.id,
                p.name,
                p.price,
                p.image_url         AS image,
                p.created_at,
                p.shop_id,
                s.name              AS shop_name,
                u.full_name         AS sellerName,
                u.id                AS seller_id,
                r.role              AS seller_role,
                c.name              AS category_name,
                COALESCE((
                    SELECT COUNT(*)::int
                    FROM product_reviews rv WHERE rv.product_id = p.id
                ), 0) AS review_count,
                COALESCE((
                    SELECT AVG(rv.rating)::float
                    FROM product_reviews rv WHERE rv.product_id = p.id
                ), 0) AS avg_rating,
                'product' AS item_type
            FROM products p
            JOIN shops s ON p.shop_id = s.id
            JOIN users u ON s.seller_id = u.id
            LEFT JOIN user_roles r ON u.id = r.user_id
            LEFT JOIN categories c ON p.category_id = c.id
            WHERE p.quantity_available > 0
            ORDER BY review_count DESC, avg_rating DESC, p.created_at DESC
            LIMIT :limit
        """)
        rows = db.execute(query, {"limit": limit}).mappings().all()
        result = []
        for row in rows:
            item = dict(row)
            item["id"] = str(item["id"])
            if item.get("seller_id"): item["seller_id"] = str(item["seller_id"])
            if item.get("shop_id"):   item["shop_id"]   = str(item["shop_id"])
            result.append(item)
        return {"items": result}
    except Exception as e:
        print(f"Popular error: {e}")
        raise HTTPException(status_code=500, detail="Erreur lors du chargement des produits populaires")


@router.get("/new")
async def get_new_products(
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db)
):
    """
    Nouveautés : les produits publiés le plus récemment.
    """
    try:
        query = text("""
            SELECT
                p.id,
                p.name,
                p.price,
                p.image_url         AS image,
                p.created_at,
                p.shop_id,
                s.name              AS shop_name,
                u.full_name         AS sellerName,
                u.id                AS seller_id,
                r.role              AS seller_role,
                c.name              AS category_name,
                'product' AS item_type
            FROM products p
            JOIN shops s ON p.shop_id = s.id
            JOIN users u ON s.seller_id = u.id
            LEFT JOIN user_roles r ON u.id = r.user_id
            LEFT JOIN categories c ON p.category_id = c.id
            WHERE p.quantity_available > 0
            ORDER BY p.created_at DESC
            LIMIT :limit
        """)
        rows = db.execute(query, {"limit": limit}).mappings().all()
        result = []
        for row in rows:
            item = dict(row)
            item["id"] = str(item["id"])
            if item.get("seller_id"): item["seller_id"] = str(item["seller_id"])
            if item.get("shop_id"):   item["shop_id"]   = str(item["shop_id"])
            result.append(item)
        return {"items": result}
    except Exception as e:
        print(f"New products error: {e}")
        raise HTTPException(status_code=500, detail="Erreur lors du chargement des nouveautés")


@router.get("/stats")
async def get_feed_stats(db: Session = Depends(get_db)):
    """
    Statistiques réelles du marketplace pour les bannières dynamiques.
    """
    try:
        stats = db.execute(text("""
            SELECT
                (SELECT COUNT(*) FROM products WHERE quantity_available > 0) AS total_products,
                (SELECT COUNT(*) FROM shops) AS total_shops,
                (SELECT COUNT(*) FROM users WHERE is_active = true) AS total_users,
                (SELECT COUNT(*) FROM products WHERE created_at >= NOW() - INTERVAL '24 hours') AS new_today,
                (SELECT COUNT(*) FROM products WHERE created_at >= NOW() - INTERVAL '7 days') AS new_this_week
        """)).mappings().first()

        top_cats = db.execute(text("""
            SELECT c.name, COUNT(p.id) AS product_count
            FROM categories c
            JOIN products p ON p.category_id = c.id
            WHERE p.quantity_available > 0
            GROUP BY c.name
            ORDER BY product_count DESC
            LIMIT 5
        """)).mappings().all()

        return {
            "total_products":  stats["total_products"]  if stats else 0,
            "total_shops":     stats["total_shops"]     if stats else 0,
            "total_users":     stats["total_users"]     if stats else 0,
            "new_today":       stats["new_today"]       if stats else 0,
            "new_this_week":   stats["new_this_week"]   if stats else 0,
            "top_categories": [dict(r) for r in top_cats]
        }
    except Exception as e:
        print(f"Stats error: {e}")
        return {"total_products": 0, "total_shops": 0, "total_users": 0, "new_today": 0, "new_this_week": 0, "top_categories": []}
