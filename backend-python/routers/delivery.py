# =============================================================================
# routers/delivery.py — Gestion des Livraisons et des Missions
# =============================================================================

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from sqlalchemy import text
from database import get_db
from dependencies import get_current_user, is_deliverer, is_seller
from pydantic import BaseModel
from services.escrow import release_order_escrow

router = APIRouter(prefix="/delivery", tags=["delivery"])


class StatusUpdate(BaseModel):
    order_id: str
    status: str  # 'shipped' | 'en_route' | 'delivered'


class MissionAccept(BaseModel):
    order_id: str


class ConfirmDelivery(BaseModel):
    order_id: str
    code: str  # Les 6 derniers caractères de l'order_id (en majuscules)

class LinkDriver(BaseModel):
    driver_phone: str # On lie par numéro de téléphone pour simplifier


@router.get("/available")
async def get_available_missions(
    current_user: dict = Depends(is_deliverer), db: Session = Depends(get_db)
):
    try:
        user_res = db.execute(
            text("SELECT managed_by_id FROM users WHERE id = :id"),
            {"id": current_user["id"]},
        ).mappings().first()
        managed_by_id = user_res["managed_by_id"] if user_res else None

        base_query = """
            SELECT o.*, p.name as product_name, p.image_url, p.unit,
                   u.full_name as buyer_name, u.phone as buyer_phone,
                   COALESCE(o.delivery_lat, u.lat) as buyer_lat, 
                   COALESCE(o.delivery_lng, u.lng) as buyer_lng,
                   s.name as shop_name, seller.location as shop_location,
                   seller.phone as shop_phone, 
                   COALESCE(s.lat, seller.lat) as shop_lat, 
                   COALESCE(s.lng, seller.lng) as shop_lng
            FROM orders o
            JOIN products p ON o.product_id = p.id
            JOIN users u ON o.buyer_id = u.id
            JOIN shops s ON o.shop_id = s.id
            JOIN users seller ON s.seller_id = seller.id
            WHERE o.deliverer_id IS NULL
              AND o.status IN ('accepted', 'in_progress', 'pending', 'prepared')
        """

        if managed_by_id:
            query = text(
                base_query + """ 
                AND (s.seller_id = :seller_id 
                     OR s.seller_id IN (SELECT seller_id FROM seller_driver_links WHERE deliverer_id = :d_id)) 
                ORDER BY o.created_at DESC
                """
            )
            result = db.execute(
                query, {"seller_id": managed_by_id, "d_id": current_user["id"]}
            ).mappings().all()
        else:
            query = text(base_query + """
                AND (o.delivery_address = 'Retrait vendeur' 
                     OR s.seller_id IN (SELECT seller_id FROM seller_driver_links WHERE deliverer_id = :d_id)
                     OR (SELECT COUNT(*) FROM seller_driver_links WHERE deliverer_id = :d_id) = 0)
                ORDER BY o.created_at DESC
            """)
            result = db.execute(query, {"d_id": current_user["id"]}).mappings().all()

        return [dict(r) for r in result]
    except Exception as e:
        print(f"Error available missions: {e}")
        raise HTTPException(
            status_code=500, detail=f"Erreur lors de la récupération des missions: {str(e)}"
        )


@router.get("/my-missions")
async def get_my_missions(
    current_user: dict = Depends(is_deliverer), db: Session = Depends(get_db)
):
    try:
        result = db.execute(
            text("""
                SELECT o.*, p.name as product_name, p.image_url, p.unit,
                       u.full_name as buyer_name, u.phone as buyer_phone,
                       COALESCE(o.delivery_lat, u.lat) as buyer_lat, 
                       COALESCE(o.delivery_lng, u.lng) as buyer_lng,
                       s.name as shop_name, seller.location as shop_location,
                       seller.phone as shop_phone, seller.id as seller_user_id,
                       COALESCE(s.lat, seller.lat) as shop_lat, 
                       COALESCE(s.lng, seller.lng) as shop_lng
                FROM orders o
                JOIN products p ON o.product_id = p.id
                JOIN users u ON o.buyer_id = u.id
                JOIN shops s ON o.shop_id = s.id
                JOIN users seller ON s.seller_id = seller.id
                WHERE o.deliverer_id = :d_id
                  AND o.status NOT IN ('completed', 'cancelled')
                ORDER BY o.created_at DESC
            """),
            {"d_id": current_user["id"]},
        ).mappings().all()
        return [dict(r) for r in result]
    except Exception as e:
        print(f"Error my missions: {e}")
        raise HTTPException(status_code=500, detail="Erreur missions actives.")


@router.post("/accept")
async def accept_mission(
    req: MissionAccept,
    request: Request,
    current_user: dict = Depends(is_deliverer),
    db: Session = Depends(get_db),
):
    """Livreur accepte → statut « accepted »."""
    order_id = req.order_id
    deliverer_id = current_user["id"]
    try:
        query = text("""
            UPDATE orders
            SET deliverer_id = :d_id, status = 'accepted', updated_at = NOW()
            WHERE id = :o_id AND deliverer_id IS NULL
            RETURNING *
        """)
        result = db.execute(
            query, {"d_id": deliverer_id, "o_id": order_id}
        ).mappings().first()

        if not result:
            raise HTTPException(
                status_code=400,
                detail="Désolé, cette mission a déjà été prise par un autre livreur.",
            )

        # Notify Buyer
        notif_buyer = db.execute(text("""
            INSERT INTO notifications (user_id, title, content, type, target_id)
            VALUES (:u_id, :title, :content, 'order_update', :o_id)
            RETURNING *
        """), {
            "u_id": result["buyer_id"],
            "title": "Livreur trouvé !",
            "content": f"{current_user.get('full_name', 'Un livreur')} a accepté votre livraison.",
            "o_id": order_id
        }).mappings().first()

        # Notify Seller
        seller_res = db.execute(text("SELECT seller_id FROM shops WHERE id = :s_id"), {"s_id": result["shop_id"]}).mappings().first()
        notif_seller = None
        if seller_res:
            notif_seller = db.execute(text("""
                INSERT INTO notifications (user_id, title, content, type, target_id)
                VALUES (:u_id, :title, :content, 'order_update', :o_id)
                RETURNING *
            """), {
                "u_id": seller_res["seller_id"],
                "title": "Livreur assigné",
                "content": "Un livreur va passer récupérer la commande.",
                "o_id": order_id
            }).mappings().first()

        db.commit()

        # Emit real-time notifications via Rooms
        sio = getattr(request.app.state, "sio", None)
        if sio:
            def serialize_notif(n):
                data = dict(n)
                for k, v in data.items():
                    if hasattr(v, '__str__') and not isinstance(v, (str, int, float, bool, type(None))):
                        data[k] = str(v)
                return data

            # Notify Buyer room
            await sio.emit("new-notification", serialize_notif(notif_buyer), room=str(result["buyer_id"]))
            
            # Notify Seller room
            if seller_res:
                await sio.emit("new-notification", serialize_notif(notif_seller), room=str(seller_res["seller_id"]))

        return {
            "success": True,
            "status": "accepted",
            "label": "Acceptée",
            "message": "Mission acceptée !",
        }
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise e


@router.patch("/update-status")
async def update_status(
    req: StatusUpdate,
    request: Request,
    current_user: dict = Depends(is_deliverer),
    db: Session = Depends(get_db),
):
    order_id = req.order_id
    status = req.status
    if status == "shipped":
        status = "shipped"

    try:
        order_check = db.execute(
            text("SELECT status, buyer_id, shop_id FROM orders WHERE id = :id"),
            {"id": order_id},
        ).mappings().first()
        if not order_check:
            raise HTTPException(status_code=404, detail="Commande introuvable")
        if order_check["status"] == "dispute":
            raise HTTPException(
                status_code=400, detail="Commande en litige — mise à jour bloquée."
            )

        db.execute(
            text("UPDATE orders SET status = :status, updated_at = NOW() WHERE id = :id"),
            {"status": status, "id": order_id},
        )

        # NOTE: le statut 'delivered' et la libération des fonds sont gérés
        # exclusivement par /confirm-delivery (validation par code QR).
        # Ici on ne gère que les mises à jour intermédiaires (ex: shipped).
        if status == "delivered":
            raise HTTPException(
                status_code=400,
                detail="Utilisez le scan QR / code pour finaliser la livraison.",
            )

        title, content = "", ""
        if status == "shipped":
            title = "Commande en route !"
            content = "Votre livreur a récupéré votre colis et arrive vers vous."

        if title and content:
            # Notify Buyer
            notif_buyer = db.execute(
                text("""
                INSERT INTO notifications (user_id, title, content, type, target_id)
                VALUES (:u_id, :title, :content, 'order_update', :o_id)
                RETURNING *
            """),
                {
                    "u_id": order_check["buyer_id"],
                    "title": title,
                    "content": content,
                    "o_id": order_id,
                },
            ).mappings().first()

            # Les notifications vendeur sur 'delivered' sont gérées par /confirm-delivery

            db.commit()

            sio = getattr(request.app.state, "sio", None)
            if sio:
                def serialize_notif(n):
                    data = dict(n)
                    for k, v in data.items():
                        if hasattr(v, '__str__') and not isinstance(v, (str, int, float, bool, type(None))):
                            data[k] = str(v)
                    return data
                await sio.emit("new-notification", serialize_notif(notif_buyer), room=str(order_check["buyer_id"]))
        else:
            db.commit()

        return {"success": True, "new_status": status}
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        print(f"Update status error: {e}")
        raise HTTPException(status_code=500, detail="Erreur lors de la mise à jour du statut.")


# =============================================================================
# CONFIRMATION FINALE : Code QR → Libération des fonds
# =============================================================================
@router.post("/confirm-delivery")
async def confirm_delivery(
    req: ConfirmDelivery,
    request: Request,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Déclenché quand le livreur saisit/scanne le code de l'acheteur.
    1. Vérifie que le livreur est bien assigné à cette commande.
    2. Valide le code (6 derniers caractères du UUID sans tirets).
    3. Appelle release_order_escrow() → distribue l'argent.
    4. Envoie notifications + wallet-updated en temps réel.
    """
    # Autoriser livreur OU vendeur (pour retrait direct)
    from dependencies import get_db_user_role
    db_role = await get_db_user_role(current_user["id"], db)
    if str(db_role) not in ("deliverer", "seller", "admin"):
        raise HTTPException(status_code=403, detail="Accès non autorisé")

    order_id  = req.order_id
    code_sent = req.code.strip().upper()

    # 1. Charger la commande
    order = db.execute(
        text("""
            SELECT o.*, s.seller_id
            FROM orders o
            JOIN shops s ON o.shop_id = s.id
            WHERE o.id = :oid
        """),
        {"oid": order_id},
    ).mappings().first()

    if not order:
        raise HTTPException(status_code=404, detail="Commande introuvable")

    # 2. Vérifier les droits (soit c'est le livreur assigné, soit c'est le vendeur pour un retrait)
    is_deliverer = str(order.get("deliverer_id")) == str(current_user["id"])
    is_seller = str(order.get("seller_id")) == str(current_user["id"])

    if not (is_deliverer or (is_seller and not order.get("deliverer_id"))):
        raise HTTPException(
            status_code=403, 
            detail="Seul le livreur assigné ou le vendeur (pour retrait) peut valider le code."
        )

    # 3. Valider le code (6 derniers chars du UUID sans tirets)
    expected_code = order_id.replace("-", "")[-6:].upper()
    if code_sent != expected_code:
        raise HTTPException(
            status_code=400,
            detail="Code invalide. Demandez le code correct à l'acheteur.",
        )

    # 4. Gardes sur le statut
    if order["status"] in ("completed", "cancelled"):
        raise HTTPException(status_code=400, detail="Cette commande est déjà finalisée.")
    if order["status"] == "dispute":
        raise HTTPException(status_code=400, detail="Fonds bloqués — litige en cours.")

    try:
        # 5. Libérer l'escrow → crédite vendeur + livreur
        result = release_order_escrow(db, order_id)

        # 6. Récupérer les nouveaux soldes pour les retourner
        seller_wallet = db.execute(
            text("SELECT balance FROM wallets WHERE user_id = :u_id"),
            {"u_id": order["seller_id"]},
        ).mappings().first()

        deliverer_wallet = db.execute(
            text("SELECT balance FROM wallets WHERE user_id = :u_id"),
            {"u_id": current_user["id"]},
        ).mappings().first()

        vendor_net      = result["vendor_net"]
        deliverer_share = result["deliverer_share"]

        # 7. Notifications en base
        notif_buyer = db.execute(text("""
            INSERT INTO notifications (user_id, title, content, type, target_id)
            VALUES (:u_id, :title, :content, 'order_update', :o_id)
            RETURNING *
        """), {
            "u_id":    order["buyer_id"],
            "title":   "Livraison confirmée !",
            "content": f"Votre commande #{order_id[-6:].upper()} a été livrée avec succès.",
            "o_id":    order_id,
        }).mappings().first()

        notif_seller = db.execute(text("""
            INSERT INTO notifications (user_id, title, content, type, target_id)
            VALUES (:u_id, :title, :content, 'payment', :o_id)
            RETURNING *
        """), {
            "u_id":    order["seller_id"],
            "title":   "Vente finalisée !",
            "content": f"Commande #{order_id[-6:].upper()} livrée. +{int(vendor_net):,} FCFA credites.",
            "o_id":    order_id,
        }).mappings().first()

        notif_deliverer = db.execute(text("""
            INSERT INTO notifications (user_id, title, content, type, target_id)
            VALUES (:u_id, :title, :content, 'payment', :o_id)
            RETURNING *
        """), {
            "u_id":    current_user["id"],
            "title":   "Mission accomplie !",
            "content": f"Livraison #{order_id[-6:].upper()} terminee. +{int(deliverer_share):,} FCFA credites.",
            "o_id":    order_id,
        }).mappings().first()

        db.commit()

        # 8. Temps réel via Rooms (Indispensable pour éviter d'avoir à actualiser la page)
        sio = getattr(request.app.state, "sio", None)
        if sio:
            def serialize_notif(n):
                data = dict(n)
                for k, v in data.items():
                    if hasattr(v, '__str__') and not isinstance(v, (str, int, float, bool, type(None))):
                        data[k] = str(v)
                return data

            # Notifications globales aux différentes parties
            for uid, notif in [
                (str(order["buyer_id"]),  notif_buyer),
                (str(order["seller_id"]), notif_seller),
                (str(current_user["id"]), notif_deliverer),
            ]:
                await sio.emit("new-notification", serialize_notif(notif), room=uid)
                await sio.emit("order-completed", {"order_id": order_id}, room=uid)

            # Mise à jour des soldes de portefeuille en direct
            if seller_wallet:
                await sio.emit("wallet-updated", {"balance": float(seller_wallet["balance"])}, room=str(order["seller_id"]))
            
            if deliverer_wallet:
                await sio.emit("wallet-updated", {"balance": float(deliverer_wallet["balance"])}, room=str(current_user["id"]))

        return {
            "success":         True,
            "message":         "Livraison confirmée ! Paiements distribués.",
            "vendor_net":      int(vendor_net),
            "deliverer_share": int(deliverer_share),
        }

    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        print(f"[CONFIRM-DELIVERY ERROR] {e}")
        raise HTTPException(status_code=500, detail="Erreur lors de la confirmation de livraison.")

# ─── GESTION DES LIENS VENDEUR-LIVREUR ─────────────────────────────────────────

@router.post("/link-driver")
async def link_driver(req: LinkDriver, current_user: dict = Depends(is_seller), db: Session = Depends(get_db)):
    """Un vendeur lie un livreur à sa boutique par son numéro de téléphone."""
    seller_id = current_user["id"]
    try:
        # 1. Trouver le livreur
        driver = db.execute(text("SELECT id, full_name FROM users WHERE phone = :phone"), {"phone": req.driver_phone}).mappings().first()
        if not driver:
            raise HTTPException(status_code=404, detail="Livreur introuvable avec ce numéro.")
        
        # 2. Créer le lien
        db.execute(text("""
            INSERT INTO seller_driver_links (seller_id, deliverer_id)
            VALUES (:s_id, :d_id)
            ON CONFLICT DO NOTHING
        """), {"s_id": seller_id, "d_id": driver["id"]})
        
        db.commit()
        return {"success": True, "message": f"Le livreur {driver['full_name']} est maintenant lié à votre boutique."}
    except Exception as e:
        db.rollback()
        if isinstance(e, HTTPException): raise e
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/my-drivers")
async def list_my_drivers(current_user: dict = Depends(is_seller), db: Session = Depends(get_db)):
    """Liste les livreurs liés à la boutique du vendeur."""
    seller_id = current_user["id"]
    try:
        result = db.execute(text("""
            SELECT u.id, u.full_name, u.phone, u.avatar_url, u.is_verified
            FROM users u
            JOIN seller_driver_links l ON u.id = l.deliverer_id
            WHERE l.seller_id = :s_id
        """), {"s_id": seller_id}).mappings().all()
        return [dict(r) for r in result]
    except Exception:
        raise HTTPException(status_code=500, detail="Erreur récupération livreurs")
