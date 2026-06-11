from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from database import get_db
from dependencies import get_current_user
from pydantic import BaseModel
from typing import Optional

router = APIRouter(prefix="/shops", tags=["shops"])

class ShopUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    logo_url: Optional[str] = None
    banner_url: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None

@router.get("/{id}")
async def get_shop(id: str, db: Session = Depends(get_db)):
    try:
        # Requête optimisée pour obtenir les vraies statistiques
        query = text("""
            SELECT s.*, u.full_name as seller_name, u.location as city, u.avatar_url as user_avatar, 
                   u.is_verified, u.created_at as user_joined_at,
                   (SELECT COUNT(*) FROM products WHERE shop_id = s.id) as product_count,
                   (SELECT COALESCE(AVG(rating), 0) FROM product_reviews pr JOIN products p ON pr.product_id = p.id WHERE p.shop_id = s.id) as avg_rating,
                   (SELECT COUNT(*) FROM product_reviews pr JOIN products p ON pr.product_id = p.id WHERE p.shop_id = s.id) as review_count
            FROM shops s
            JOIN users u ON s.seller_id = u.id
            WHERE s.id::text = :id OR s.seller_id::text = :id
            LIMIT 1
        """)
        result = db.execute(query, {"id": id}).mappings().first()
        
        if not result:
            # Fallback si la boutique n'existe pas encore (on affiche le profil utilisateur)
            user_res = db.execute(text("SELECT full_name, location, avatar_url, description, is_verified, created_at FROM users WHERE id::text = :id"), {"id": id}).mappings().first()
            if user_res:
                return {
                    "id": id,
                    "seller_id": id,
                    "name": f"Boutique de {user_res['full_name']}",
                    "description": user_res["description"] or "Vendeur sur AgriMarché",
                    "city": user_res["location"],
                    "logo_url": user_res["avatar_url"],
                    "avatar_url": user_res["avatar_url"],
                    "is_verified": user_res["is_verified"],
                    "product_count": 0,
                    "avg_rating": 0,
                    "review_count": 0,
                    "user_joined_at": user_res["created_at"]
                }
            raise HTTPException(status_code=404, detail="Boutique non trouvée")
        
        return dict(result)
    except Exception as e:
        if isinstance(e, HTTPException): raise e
        print(f"Error get_shop: {e}")
        raise HTTPException(status_code=500, detail="Erreur lors de la récupération de la boutique")

@router.put("/me")
async def update_my_shop(update_data: ShopUpdate, current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    """Permet à un vendeur de modifier les informations de sa boutique."""
    user_id = current_user["id"]
    
    # Vérifier si l'utilisateur a une boutique
    shop = db.execute(text("SELECT id FROM shops WHERE seller_id = :u_id"), {"u_id": user_id}).mappings().first()
    
    if not shop:
        # Création automatique si inexistante
        db.execute(text("""
            INSERT INTO shops (seller_id, name, description, logo_url, banner_url, lat, lng, created_at)
            VALUES (:u_id, :name, :desc, :logo, :banner, :lat, :lng, NOW())
        """), {
            "u_id": user_id,
            "name": update_data.name or "Ma Boutique",
            "desc": update_data.description or "",
            "logo": update_data.logo_url,
            "banner": update_data.banner_url,
            "lat": update_data.lat,
            "lng": update_data.lng
        })
    else:
        # Mise à jour
        fields = []
        params = {"s_id": shop["id"]}
        if update_data.name is not None:
            fields.append("name = :name")
            params["name"] = update_data.name
        if update_data.description is not None:
            fields.append("description = :desc")
            params["desc"] = update_data.description
        if update_data.logo_url is not None:
            fields.append("logo_url = :logo")
            params["logo"] = update_data.logo_url
        if update_data.banner_url is not None:
            fields.append("banner_url = :banner")
            params["banner"] = update_data.banner_url
        if update_data.lat is not None:
            fields.append("lat = :lat")
            params["lat"] = update_data.lat
        if update_data.lng is not None:
            fields.append("lng = :lng")
            params["lng"] = update_data.lng
            
        if fields:
            query = text(f"UPDATE shops SET {', '.join(fields)}, updated_at = NOW() WHERE id = :s_id")
            db.execute(query, params)
            
    db.commit()
    return {"success": True, "message": "Boutique mise à jour"}

@router.get("/{id}/products")
async def get_shop_products(id: str, category: Optional[str] = None, sort: Optional[str] = None, db: Session = Depends(get_db)):
    try:
        query_str = "SELECT p.* FROM products p LEFT JOIN shops s ON p.shop_id = s.id WHERE p.shop_id::text = :id OR s.seller_id::text = :id"
        params = {"id": id}

        if category and category != 'Tous':
            query_str += " AND category_id = :cat_id"
            params["cat_id"] = category

        if sort == 'price_asc': query_str += " ORDER BY price ASC"
        else: query_str += " ORDER BY created_at DESC"

        result = db.execute(text(query_str), params).mappings().all()
        return list(result)
    except Exception as e:
        raise HTTPException(status_code=500, detail="Erreur produits boutique")

