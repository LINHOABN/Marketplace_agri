from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from sqlalchemy import text
from database import get_db
from dependencies import get_current_user
from pydantic import BaseModel, ConfigDict
from typing import Optional

router = APIRouter(prefix="/orders", tags=["orders"])

class OrderCreate(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    
    product_id: str
    quantity: float
    delivery_address: str
    payment_method: str
    delivery_lat: Optional[float] = None
    delivery_lng: Optional[float] = None
    negotiation_id: Optional[str] = None

@router.post("/create", status_code=201)
async def create_order(req: OrderCreate, current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    buyer_id = current_user["id"]
    try:
        product_res = db.execute(text("SELECT * FROM products WHERE id = :id"), {"id": req.product_id}).mappings().first()
        if not product_res:
            raise HTTPException(status_code=404, detail="Produit non trouvé")
        
        from decimal import Decimal
        
        # Vérifier s'il existe une offre acceptée pour ce produit et cet acheteur dans le chat
        negotiation = db.execute(text("""
            SELECT m.offer_price FROM messages m
            JOIN conversations c ON m.conversation_id = c.id
            WHERE c.product_id = :p_id 
              AND (c.user1_id = :u_id OR c.user2_id = :u_id)
              AND m.type = 'offer' 
              AND m.offer_status = 'accepted'
            ORDER BY m.created_at DESC LIMIT 1
        """), {"p_id": req.product_id, "u_id": buyer_id}).mappings().first()

        price = negotiation["offer_price"] if negotiation else product_res["price"]
        subtotal = Decimal(str(price)) * Decimal(str(req.quantity))
        
        # Frais de livraison dynamiques
        # Si c'est un retrait, 0. Sinon, on peut imaginer un calcul par distance 
        # (Pour l'instant on garde 2000 par défaut si non retrait, mais extensible)
        is_pickup = req.delivery_address == "Retrait vendeur"
        delivery_fee = Decimal("0") if is_pickup else Decimal("2000")
        
        # Commission plateforme dynamique (défaut 1%)
        comm_res = db.execute(text("SELECT value FROM platform_settings WHERE key = 'commission_rate'")).scalar()
        comm_rate = Decimal(str(comm_res)) if comm_res else Decimal("0.01")
        commission_amount = (subtotal * comm_rate).quantize(Decimal("1"))
        
        # Montant pour le vendeur (brut avant frais de livraison s'il y a un livreur tiers)
        # S'il n'y a pas encore de livreur, on réserve le delivery_fee
        total = subtotal + delivery_fee + commission_amount
        seller_amount = subtotal # Le vendeur touche le sous-total

        # Déterminer les coordonnées de livraison
        d_lat = req.delivery_lat
        d_lng = req.delivery_lng

        if d_lat is None or d_lng is None:
            # Fallback
            buyer_coords = db.execute(
                text("SELECT lat, lng FROM users WHERE id = :id"),
                {"id": buyer_id}
            ).mappings().first()
            if buyer_coords:
                d_lat = buyer_coords["lat"]
                d_lng = buyer_coords["lng"]

        query = text("""
            INSERT INTO orders (buyer_id, shop_id, product_id, quantity, total_amount, 
                               status, delivery_address, payment_method, delivery_lat, delivery_lng, 
                               delivery_fee, commission_amount, seller_amount, negotiation_id, created_at)
            VALUES (:b_id, :s_id, :p_id, :q, :total, 'pending', :addr, :pay_m, :lat, :lng, 
                    :d_fee, :comm, :s_amt, :n_id, NOW())
            RETURNING *
        """)
        result = db.execute(query, {
            "b_id": buyer_id,
            "s_id": product_res["shop_id"],
            "p_id": req.product_id,
            "q": req.quantity,
            "total": total,
            "addr": req.delivery_address,
            "pay_m": req.payment_method,
            "lat": d_lat,
            "lng": d_lng,
            "d_fee": delivery_fee,
            "comm": commission_amount,
            "s_amt": seller_amount,
            "n_id": req.negotiation_id if req.negotiation_id else None
        }).mappings().first()
        
        db.commit()
        return result
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        print(f"ORDER CREATE ERROR: {e}")
        raise HTTPException(status_code=500, detail=f"Erreur lors de la création: {str(e)}")

@router.get("/{id}")
async def get_order(id: str, current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    query = text("""
        SELECT o.*, o.total_amount as total_price, p.name as product_name, p.image_url as product_image,
               d.full_name as deliverer_name, d.phone as deliverer_phone
        FROM orders o 
        JOIN products p ON o.product_id = p.id 
        LEFT JOIN users d ON o.deliverer_id = d.id
        WHERE o.id = :id
    """)
    result = db.execute(query, {"id": id}).mappings().first()
    if not result:
        raise HTTPException(status_code=404, detail="Commande non trouvée")
    return result

@router.get("/")
async def list_orders(role: Optional[str] = None, status: Optional[str] = None, current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    user_id = current_user["id"]
    try:
        if role == 'seller':
            query_str = """
                SELECT o.*, o.total_amount as total_price, p.name as product_name, p.image_url as product_image 
                FROM orders o 
                JOIN products p ON o.product_id = p.id 
                JOIN shops s ON o.shop_id = s.id
                WHERE s.seller_id = :u_id
            """
        else:
            query_str = """
                SELECT o.*, o.total_amount as total_price, p.name as product_name, p.image_url as product_image 
                FROM orders o 
                JOIN products p ON o.product_id = p.id 
                WHERE o.buyer_id = :u_id
            """
        
        params = {"u_id": user_id}
        if status and status != 'all':
            query_str += " AND o.status = :status"
            params["status"] = status
            
        query_str += " ORDER BY o.created_at DESC"
        
        result = db.execute(text(query_str), params).mappings().all()
        orders_list = []
        for o in result:
            order_dict = dict(o)
            # Calculate shares for seller's visibility
            total = float(order_dict.get("total_amount", 0))
            if role == 'seller':
                order_dict["deliverer_share"] = total * 0.10 if order_dict.get("deliverer_id") else 0
                order_dict["platform_commission"] = total * 0.03
                order_dict["seller_share"] = total - order_dict["platform_commission"] - order_dict["deliverer_share"]
            orders_list.append(order_dict)
        return orders_list
    except Exception as e:
        raise HTTPException(status_code=500, detail="Erreur historique")
