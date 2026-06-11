# =============================================================================
# routers/products.py — Gestion du Catalogue Produits
# =============================================================================
#
# CE FICHIER FAIT QUOI ?
#   Il gère tout le cycle de vie d'un produit (Agriculture, Élevage, etc.) :
#   1. Affichage : Listage des produits sur le fil d'actualité.
#   2. Détail : Fiche technique complète d'un article.
#   3. Création : Publication par un vendeur (avec création auto de boutique).
#   4. Modification : Mise à jour des prix, stock ou images.
#   5. Suppression : Nettoyage sécurisé du produit.
#
# POUR MODIFIER :
#   - Changer le nombre de produits affichés par défaut → modifiez `LIMIT 20` dans `list_products`.
#   - Ajouter un champ technique (ex: 'Poids') → modifiez la classe `ProductCreate` 
#     et la requête `INSERT INTO products`.
#   - Unité par défaut (ex: changer 'pièce' en 'kg') → modifiez `unit: Optional[str] = "pièce"`.
# =============================================================================

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import text
from database import get_db
from dependencies import get_current_user, is_seller
from pydantic import BaseModel
from typing import List, Optional

router = APIRouter(prefix="/products", tags=["products"])

# ─── MODÈLE DE CRÉATION (Input du Frontend) ───────────────────────────────────
class ProductCreate(BaseModel):
    title: str
    description: Optional[str] = None
    category_id: Optional[str] = None
    price: float
    quantity_available: float = 0
    unit: Optional[str] = "pièce" # Unité de vente (Crate, Kg, Sac, etc.)
    media_urls: List[str] = []    # Liste des URLs d'images
    location: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None

class ProductUpdate(BaseModel):
    name: str  # Frontend sends 'name' in JSON body for put
    description: Optional[str] = None
    category_id: Optional[str] = None
    price: float
    quantity_available: float = 0
    unit: Optional[str] = "pièce"
    media_urls: List[str] = []
    image_url: Optional[str] = None


class ReviewCreate(BaseModel):
    rating: int
    comment: Optional[str] = None

# ─── LISTER LES DERNIERS PRODUITS ─────────────────────────────────────────────
@router.get("")
async def list_products(db: Session = Depends(get_db)):
    """Retourne les 20 derniers produits publiés pour la page d'accueil."""
    query = text("""
        SELECT p.id, p.name, p.description, p.price, p.unit, p.image_url as image, p.quantity_available as stock,
               u.full_name as sellerName, s.logo_url as vendor_avatar, s.name as shop_name, s.seller_id
        FROM products p
        JOIN shops s ON p.shop_id = s.id
        JOIN users u ON s.seller_id = u.id
        WHERE p.quantity_available > 0  -- On ne montre que ce qui est en stock
        ORDER BY p.created_at DESC
        LIMIT 20
    """)
    result = db.execute(query).mappings().all()
    return list(result)


# ─── DÉTAIL D'UN PRODUIT ──────────────────────────────────────────────────────
@router.get("/{id}")
async def get_product(id: str, db: Session = Depends(get_db)):
    """Fiche produit complète pour la page de détails."""
    query = text("""
        SELECT
            p.id,
            p.name,
            p.description,
            p.price,
            p.unit,
            p.image_url,
            p.media_urls,
            p.quantity_available,
            p.location AS city,
            p.latitude,
            p.longitude,
            p.shop_id,
            p.created_at,
            c.name AS category_name,
            s.name AS shop_name,
            s.logo_url AS vendor_avatar,
            u.id AS seller_id,
            u.full_name AS seller_name,
            u.full_name AS vendor_name,
            COALESCE(
                (SELECT AVG(r.rating)::float FROM product_reviews r WHERE r.product_id = p.id),
                0
            ) AS average_rating,
            COALESCE(
                (SELECT COUNT(*)::int FROM product_reviews r WHERE r.product_id = p.id),
                0
            ) AS reviews_count
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        JOIN shops s ON p.shop_id = s.id
        JOIN users u ON s.seller_id = u.id
        WHERE p.id = CAST(:id AS uuid)
    """)
    row = db.execute(query, {"id": id}).mappings().first()
    if not row:
        raise HTTPException(status_code=404, detail="Produit introuvable")

    item = dict(row)
    item["id"] = str(item["id"])
    item["shop_id"] = str(item["shop_id"]) if item.get("shop_id") else None
    item["seller_id"] = str(item["seller_id"]) if item.get("seller_id") else None
    item["vendor_id"] = item["seller_id"]
    if item.get("media_urls") is None and item.get("image_url"):
        item["media_urls"] = [item["image_url"]]
    return item


# ─── CRÉATION D'UN PRODUIT ────────────────────────────────────────────────────
@router.post("", status_code=201)
async def create_product(req: ProductCreate, current_user: dict = Depends(is_seller), db: Session = Depends(get_db)):
    """
    Crée un produit. IMPORTANT : Si le vendeur n'a pas de boutique, 
    le système en crée une automatiquement pour lui.
    """
    seller_id = current_user["id"]
    
    try:
        # 1. Vérification si le vendeur possède déjà une boutique
        shop_query = text("SELECT id FROM shops WHERE seller_id = :seller_id")
        shop = db.execute(shop_query, {"seller_id": seller_id}).mappings().first()
        
        if not shop:
            # Création automatique de la boutique
            shop_name = f"Boutique de {current_user.get('name', 'Vendeur')}"
            new_shop = db.execute(text("""
                INSERT INTO shops (seller_id, name, description) 
                VALUES (:seller_id, :name, 'Ma boutique AgriMarché') 
                RETURNING id
            """), {"seller_id": seller_id, "name": shop_name}).mappings().first()
            shop_id = new_shop["id"]
        else:
            shop_id = shop["id"]
            
        # 2. Insertion du produit
        # La première image de la liste devient l'image principale (image_url)
        main_image = req.media_urls[0] if req.media_urls else None
        
        # S'assurer que category_id est None si vide (pour éviter l'erreur de cast UUID)
        cat_id = req.category_id if req.category_id and req.category_id.strip() else None

        product_query = text("""
            INSERT INTO products (shop_id, name, description, price, unit, image_url, media_urls, 
                                 quantity_available, category_id, location, latitude, longitude)
            VALUES (:shop_id, :name, :description, :price, :unit, :image_url, :media_urls, 
                    :quantity, CAST(:cat_id AS uuid), :loc, :lat, :lng)
            RETURNING *
        """)
        
        result = db.execute(product_query, {
            "shop_id": shop_id,
            "name": req.title,
            "description": req.description,
            "price": req.price,
            "unit": req.unit,
            "image_url": main_image,
            "media_urls": req.media_urls,
            "quantity": req.quantity_available,
            "cat_id": cat_id,
            "loc": req.location,
            "lat": req.latitude,
            "lng": req.longitude
        }).mappings().first()
        
        db.commit()
        return result
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Erreur lors de la création : {str(e)}")

# ─── SUPPRESSION SÉCURISÉE ────────────────────────────────────────────────────
@router.delete("/{id}")
async def delete_product(id: str, current_user: dict = Depends(is_seller), db: Session = Depends(get_db)):
    """
    Supprime un produit. 
    SÉCURITÉ : Vérifie que celui qui demande la suppression est bien le propriétaire (le vendeur).
    """
    user_id = current_user["id"]
    
    # Vérification de propriété
    check_query = text("""
        SELECT p.id FROM products p
        JOIN shops s ON p.shop_id = s.id
        WHERE p.id = :id AND s.seller_id = :user_id
    """)
    product = db.execute(check_query, {"id": id, "user_id": user_id}).mappings().first()
    
    if not product:
        raise HTTPException(status_code=403, detail="Accès refusé. Ce produit ne vous appartient pas.")
        
    try:
        # Suppressions liées pour éviter les erreurs de clés étrangères
        db.execute(text("DELETE FROM product_reviews WHERE product_id = :id"), {"id": id})
        db.execute(text("DELETE FROM products WHERE id = :id"), {"id": id})
        
        db.commit()
        return {"message": "Produit supprimé avec succès."}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail="Erreur lors de la suppression.")

@router.put("/{id}")
async def update_product(
    id: str,
    req: ProductUpdate,
    current_user: dict = Depends(is_seller),
    db: Session = Depends(get_db)
):
    """
    Met à jour un produit existant.
    """
    user_id = current_user["id"]
    
    # Vérification de propriété
    check_query = text("""
        SELECT p.id FROM products p
        JOIN shops s ON p.shop_id = s.id
        WHERE p.id = CAST(:id AS uuid) AND s.seller_id = CAST(:user_id AS uuid)
    """)
    product = db.execute(check_query, {"id": id, "user_id": user_id}).mappings().first()
    
    if not product:
        raise HTTPException(status_code=403, detail="Accès refusé ou produit introuvable.")
        
    try:
        # S'assurer que category_id est None si vide (pour éviter l'erreur de cast UUID)
        cat_id = req.category_id if req.category_id and req.category_id.strip() else None

        update_query = text("""
            UPDATE products
            SET name = :name, 
                description = :description, 
                price = :price, 
                unit = :unit, 
                image_url = :image_url, 
                media_urls = :media_urls, 
                quantity_available = :quantity, 
                category_id = CAST(:cat_id AS uuid)
            WHERE id = CAST(:id AS uuid)
        """)
        
        db.execute(update_query, {
            "name": req.name,
            "description": req.description,
            "price": req.price,
            "unit": req.unit,
            "image_url": req.image_url,
            "media_urls": req.media_urls,
            "quantity": req.quantity_available,
            "cat_id": cat_id,
            "id": id
        })
        
        db.commit()
        return {"message": "Produit mis à jour avec succès."}
    except Exception as e:
        db.rollback()
        print(f"Error updating product {id}: {e}")
        raise HTTPException(status_code=500, detail=f"Erreur lors de la mise à jour : {str(e)}")


# ─── AVIS PRODUITS (REVIEWS) ──────────────────────────────────────────────────

@router.post("/{id}/reviews", status_code=201)
async def create_product_review(
    id: str,
    payload: ReviewCreate,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Ajoute un avis client sur un produit.
    Prévu pour les acheteurs ayant commandé le produit (contrôle simple côté BDD).
    """
    user_id = current_user["id"]

    if payload.rating < 1 or payload.rating > 5:
        raise HTTPException(status_code=400, detail="La note doit être comprise entre 1 et 5.")

    try:
        # Vérifier que l'utilisateur a au moins une commande pour ce produit
        order_check = db.execute(
            text(
                """
                SELECT 1 FROM orders
                WHERE buyer_id = :buyer_id
                  AND product_id = CAST(:product_id AS uuid)
                LIMIT 1
                """
            ),
            {"buyer_id": user_id, "product_id": id},
        ).mappings().first()

        if not order_check:
            raise HTTPException(
                status_code=403,
                detail="Vous devez avoir acheté ce produit pour laisser un avis.",
            )

        # Insertion de l'avis
        query = text(
            """
            INSERT INTO product_reviews (product_id, reviewer_id, rating, comment, created_at)
            VALUES (CAST(:product_id AS uuid), CAST(:user_id AS uuid), :rating, :comment, NOW())
            RETURNING *
            """
        )
        review = (
            db.execute(
                query,
                {
                    "product_id": id,
                    "user_id": user_id,
                    "rating": payload.rating,
                    "comment": payload.comment,
                },
            )
            .mappings()
            .first()
        )
        db.commit()
        return review
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Erreur lors de la création de l'avis : {str(e)}")


@router.get("/{id}/reviews")
async def list_product_reviews(id: str, db: Session = Depends(get_db)):
    """
    Liste les avis d'un produit, les plus récents en premier.
    """
    try:
        query = text(
            """
            SELECT
                r.id,
                r.rating,
                r.comment,
                r.created_at,
                r.reviewer_id,
                u.full_name AS author_name
            FROM product_reviews r
            JOIN users u ON u.id = r.reviewer_id
            WHERE r.product_id = CAST(:product_id AS uuid)
            ORDER BY r.created_at DESC
            """
        )
        rows = db.execute(query, {"product_id": id}).mappings().all()
        reviews = []
        for row in rows:
            item = dict(row)
            item["id"] = str(item["id"])
            item["user_id"] = str(item["reviewer_id"])
            reviews.append(item)
        return reviews
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur lors du chargement des avis : {str(e)}")
@router.get("/{id}/similar")
async def get_similar_products(id: str, db: Session = Depends(get_db)):
    """
    Retourne jusqu'à 8 produits de la même catégorie que le produit consulté.
    Exclut le produit actuellement consulté.
    """
    # 1. Obtenir la catégorie du produit actuel
    product = db.execute(
        text("SELECT category_id FROM products WHERE id = CAST(:id AS uuid)"),
        {"id": id}
    ).mappings().first()
    
    if not product or not product["category_id"]:
        # Si pas de catégorie, on retourne les derniers produits comme plan B
        query = text("""
            SELECT p.id, p.name, p.price, p.image_url as image, p.unit, p.location,
                   u.full_name as "sellerName", s.name as shop_name, s.seller_id, s.id as shop_id,
                   u_roles.role as seller_role,
                   (SELECT COUNT(*) FROM product_reviews r WHERE r.product_id = p.id) as reviews_count
            FROM products p
            JOIN shops s ON p.shop_id = s.id
            JOIN users u ON s.seller_id = u.id
            LEFT JOIN user_roles u_roles ON u_roles.user_id = u.id
            WHERE p.id != CAST(:id AS uuid) AND p.quantity_available > 0
            ORDER BY p.created_at DESC
            LIMIT 8
        """)
    else:
        # On cherche dans la même catégorie
        query = text("""
            SELECT p.id, p.name, p.price, p.image_url as image, p.unit, p.location,
                   u.full_name as "sellerName", s.name as shop_name, s.seller_id, s.id as shop_id,
                   u_roles.role as seller_role,
                   (SELECT COUNT(*) FROM product_reviews r WHERE r.product_id = p.id) as reviews_count
            FROM products p
            JOIN shops s ON p.shop_id = s.id
            JOIN users u ON s.seller_id = u.id
            LEFT JOIN user_roles u_roles ON u_roles.user_id = u.id
            WHERE p.category_id = :cat_id 
              AND p.id != CAST(:id AS uuid)
              AND p.quantity_available > 0
            ORDER BY p.created_at DESC
            LIMIT 8
        """)
        
    result = db.execute(query, {"id": id, "cat_id": product["category_id"] if product else None}).mappings().all()
    formatted = []
    for r in result:
        item = dict(r)
        item["id"] = str(item["id"])
        item["seller_id"] = str(item["seller_id"])
        item["shop_id"] = str(item["shop_id"])
        item["distanceKm"] = 2.4 # Simulation de distance par défaut
        item["likes"] = 0
        item["isNew"] = True
        formatted.append(item)
        
    return formatted
