from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from database import get_db
from dependencies import get_current_user
from pydantic import BaseModel
from decimal import Decimal

router = APIRouter(prefix="/seller", tags=["seller"])

class ShopUpdate(BaseModel):
    name: str

@router.get("/shop")
async def get_shop_info(current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    if current_user.get("role") != "seller":
        raise HTTPException(status_code=403, detail="Accès réservé aux vendeurs")
    seller_id = current_user["id"]
    try:
        shop = db.execute(text("SELECT * FROM shops WHERE seller_id = CAST(:s_id AS uuid)"), {"s_id": seller_id}).mappings().first()
        if not shop:
            return {"id": None, "name": "Ma Boutique", "seller_id": seller_id}
        return dict(shop)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur boutique: {str(e)}")

@router.patch("/shop")
async def update_shop_name(req: ShopUpdate, current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    seller_id = current_user["id"]
    try:
        db.execute(text("UPDATE shops SET name = :name WHERE seller_id = CAST(:s_id AS uuid)"), {"name": req.name, "s_id": seller_id})
        db.commit()
        return {"success": True, "name": req.name}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Erreur mise à jour boutique: {str(e)}")

@router.get("/deliverer-status")
async def get_deliverer_status(current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    """Check if this deliverer is linked to a seller."""
    user_id = current_user["id"]
    try:
        res = db.execute(text("""
            SELECT u.managed_by_id, s.name as shop_name, m.full_name as seller_name
            FROM users u
            LEFT JOIN shops s ON s.seller_id = u.managed_by_id
            LEFT JOIN users m ON m.id = u.managed_by_id
            WHERE u.id = CAST(:u_id AS uuid)
        """), {"u_id": user_id}).mappings().first()
        if res and res["managed_by_id"]:
            return {
                "is_linked": True,
                "seller_id": str(res["managed_by_id"]),
                "shop_name": res["shop_name"] or "Boutique inconnue",
                "seller_name": res["seller_name"] or "Vendeur"
            }
        return {"is_linked": False}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur statut livreur: {str(e)}")

@router.get("/linked-deliverers")
async def get_linked_deliverers(current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    seller_id = current_user["id"]
    try:
        deliverers = db.execute(text("""
            SELECT id, full_name, phone, email, avatar_url
            FROM users
            WHERE managed_by_id = CAST(:s_id AS uuid) AND role = 'deliverer'
        """), {"s_id": seller_id}).mappings().all()
        return list(deliverers)
    except Exception as e:
        raise HTTPException(status_code=500, detail="Erreur liste livreurs")

@router.get("/stats")
async def get_stats(current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    seller_id = current_user["id"]
    try:
        query = text("""
            SELECT 
                (SELECT COALESCE(SUM(total_amount), 0) FROM orders WHERE status IN ('delivered', 'completed') AND shop_id IN (SELECT id FROM shops WHERE seller_id = :s_id)) as total_earnings,
                (SELECT COUNT(*) FROM orders WHERE shop_id IN (SELECT id FROM shops WHERE seller_id = :s_id)) as total_sales,
                (SELECT COUNT(*) FROM products WHERE shop_id IN (SELECT id FROM shops WHERE seller_id = :s_id) AND quantity_available < 5) as low_stock_count,
                (SELECT COALESCE(escrow_balance, 0) FROM wallets WHERE user_id = :s_id) as escrow_balance
        """)
        result = db.execute(query, {"s_id": seller_id}).mappings().first()
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail="Erreur stats vendeur")

@router.post("/orders/{order_id}/accept")
async def accept_seller_order(
    order_id: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Vendeur accepte la commande → statut « Préparation de la commande »."""
    seller_id = current_user["id"]
    try:
        # 1. D'abord, vérifier que la commande existe et appartient au vendeur
        check = db.execute(
            text("""
                SELECT o.id, o.status, s.seller_id
                FROM orders o
                JOIN shops s ON o.shop_id = s.id
                WHERE o.id = CAST(:o_id AS uuid)
            """),
            {"o_id": order_id},
        ).mappings().first()

        if not check:
            raise HTTPException(status_code=404, detail="Commande introuvable (ID incorrect)")

        if str(check["seller_id"]) != str(seller_id):
            raise HTTPException(status_code=403, detail="Cette commande n'appartient pas à votre boutique")

        if check["status"] not in ("pending",):
            raise HTTPException(
                status_code=400,
                detail=f"Cette commande ne peut pas être acceptée (statut actuel: {check['status']}). Elle doit être en statut 'pending'."
            )

        # 2. Mettre à jour le statut (accepted = commande acceptée par le vendeur)
        db.execute(
            text("""
                UPDATE orders SET status = 'accepted', updated_at = NOW()
                WHERE id = CAST(:o_id AS uuid)
            """),
            {"o_id": order_id},
        )
        db.commit()

        print(f"[SELLER] Order {order_id[:8]} accepted by seller {str(seller_id)[:8]}")
        return {"success": True, "status": "accepted", "label": "Commande acceptée — En préparation"}

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        print(f"[SELLER] Accept order error: {e}")
        raise HTTPException(status_code=500, detail=f"Erreur technique: {str(e)}")


@router.get("/orders")
async def get_seller_orders(current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    seller_id = current_user["id"]
    try:
        query = text("""
            SELECT o.*, o.total_amount as total_price, u.full_name as buyer_name, p.name as product_name,
                   p.image_url
            FROM orders o
            JOIN users u ON o.buyer_id = u.id
            JOIN shops s ON o.shop_id = s.id
            JOIN products p ON o.product_id = p.id
            WHERE s.seller_id = :s_id
            ORDER BY o.created_at DESC
        """)
        result = db.execute(query, {"s_id": seller_id}).mappings().all()
        final = []
        for r in result:
            o = dict(r)
            o["id"] = str(o["id"])
            o["buyer_id"] = str(o["buyer_id"])
            o["shop_id"] = str(o["shop_id"])
            o["product_id"] = str(o["product_id"])
            # Money split: 10% to deliverer, 90% to seller
            total = Decimal(str(o.get("total_amount") or 0))
            o["deliverer_share"] = int(total * Decimal("0.10"))
            o["seller_share"] = int(total * Decimal("0.90"))
            final.append(o)
        return final
    except Exception as e:
        raise HTTPException(status_code=500, detail="Erreur commandes vendeur")

@router.get("/publications")
async def get_publications(current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    seller_id = current_user["id"]
    try:
        products = db.execute(text("""
            SELECT p.*, s.name as shop_name 
            FROM products p
            JOIN shops s ON p.shop_id = s.id
            WHERE s.seller_id = :s_id
            ORDER BY p.created_at DESC
        """), {"s_id": seller_id}).mappings().all()

        stories = db.execute(text("""
            SELECT * FROM posts WHERE user_id = :s_id ORDER BY created_at DESC
        """), {"s_id": seller_id}).mappings().all()

        return {
            "products": [dict(p) for p in products],
            "stories": [dict(s) for s in stories]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail="Erreur publications")
