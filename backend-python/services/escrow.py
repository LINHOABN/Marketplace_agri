"""Libération des fonds en séquestre vers vendeur et livreur."""
import time
from decimal import Decimal
from sqlalchemy.orm import Session
from sqlalchemy import text
from fastapi import HTTPException


def release_order_escrow(db: Session, order_id: str) -> dict:
    """
    Débloque l'escrow de l'acheteur et crédite vendeur + livreur.
    Appelée lorsque le livreur valide le code de livraison.
    - Vérifie que la commande n'est pas déjà finalisée ou en litige
    - Déduit l'escrow de l'acheteur
    - Crédite le vendeur (montant net) et le livreur (sa part)
    - Enregistre les transactions dans l'historique
    """
    # 1. Récupérer la commande avec les infos du vendeur
    order = db.execute(
        text("""
            SELECT o.*, s.seller_id
            FROM orders o
            JOIN shops s ON o.shop_id = s.id
            WHERE o.id = :id
        """),
        {"id": order_id},
    ).mappings().first()

    if not order:
        raise HTTPException(status_code=404, detail="Commande non trouvée")

    # 2. Gardes : litige ou déjà finalisée
    if order["status"] == "dispute":
        raise HTTPException(
            status_code=400,
            detail="Fonds bloqués car il y a un litige en cours.",
        )

    if order["status"] in ("completed",):
        return {"success": True, "message": "Paiement déjà libéré."}

    # 3. Calcul des parts selon les réglages dynamiques
    # On récupère le montant total et les frais de livraison stockés sur la commande
    total_paid = Decimal(str(order["total_amount"]))
    delivery_fee = Decimal(str(order["delivery_fee"] or 0))
    # Le sous-total produit est total - livraison - commission_initiale (mais l'acheteur paye Produit + Livraison)
    # Selon l'audio : Produit = 10000, Livraison = 2000. Total payé = 12000.
    # On va calculer la part de l'admin sur le "vrai" prix du produit (total_paid - delivery_fee).
    product_price = total_paid - delivery_fee
    
    # Récupérer le taux de commission depuis Platform Settings (défaut 0.01 soit 1% selon l'audio)
    res_comm = db.execute(text("SELECT value FROM platform_settings WHERE key = 'commission_rate'")).scalar()
    commission_rate = Decimal(str(res_comm)) if res_comm else Decimal("0.01")

    admin_commission = (product_price * commission_rate).quantize(Decimal("1"))
    deliverer_share  = delivery_fee if order.get("deliverer_id") else Decimal("0")
    vendor_net       = product_price - admin_commission

    # ID de l'administrateur pour recevoir les fonds (récupéré précédemment: admin@agrimarche.cm)
    ADMIN_ID = "ddd693b2-55d2-45b3-8a2a-d1fd29b508db"

    # 4. Réduire l'escrow de l'acheteur
    buyer_wallet = db.execute(
        text("SELECT id, escrow_balance FROM wallets WHERE user_id = :u_id FOR UPDATE"),
        {"u_id": order["buyer_id"]},
    ).mappings().first()

    if buyer_wallet:
        # On déduit au mieux
        deduct = min(Decimal(str(buyer_wallet["escrow_balance"])), total_paid)
        if deduct > 0:
            db.execute(
                text("UPDATE wallets SET escrow_balance = escrow_balance - :amount WHERE id = :id"),
                {"amount": deduct, "id": buyer_wallet["id"]},
            )

    # 5. Créditer le vendeur
    seller_id = order["seller_id"]
    db.execute(
        text("""
            INSERT INTO wallets (user_id, balance, escrow_balance)
            VALUES (:u_id, :amount, 0)
            ON CONFLICT (user_id) DO UPDATE
            SET balance = wallets.balance + EXCLUDED.balance
        """),
        {"amount": vendor_net, "u_id": seller_id},
    )

    # Enregistrer la transaction du vendeur
    seller_wallet = db.execute(
        text("SELECT id FROM wallets WHERE user_id = :u_id"),
        {"u_id": seller_id},
    ).mappings().first()
    if seller_wallet:
        db.execute(
            text("""
                INSERT INTO transactions (wallet_id, order_id, type, amount, status, description, reference)
                VALUES (:w_id, :o_id, 'escrow_release', :amount, 'completed', :desc, :ref)
            """),
            {
                "w_id":   seller_wallet["id"],
                "o_id":   order_id,
                "amount": vendor_net,
                "desc":   f"Vente finalisée - Commande #{order_id[-6:].upper()}",
                "ref":    f"PAY-SELLER-{order_id[-8:].upper()}-{int(time.time())}",
            },
        )

    # 6. Créditer le livreur (si assigné)
    if deliverer_share > 0 and order.get("deliverer_id"):
        db.execute(
            text("""
                INSERT INTO wallets (user_id, balance, escrow_balance)
                VALUES (:u_id, :amount, 0)
                ON CONFLICT (user_id) DO UPDATE
                SET balance = wallets.balance + EXCLUDED.balance
            """),
            {"amount": deliverer_share, "u_id": order["deliverer_id"]},
        )

        deliverer_wallet = db.execute(
            text("SELECT id FROM wallets WHERE user_id = :u_id"),
            {"u_id": order["deliverer_id"]},
        ).mappings().first()
        if deliverer_wallet:
            db.execute(
                text("""
                    INSERT INTO transactions (wallet_id, order_id, type, amount, status, description, reference)
                    VALUES (:w_id, :o_id, 'escrow_release', :amount, 'completed', :desc, :ref)
                """),
                {
                    "w_id":   deliverer_wallet["id"],
                    "o_id":   order_id,
                    "amount": deliverer_share,
                    "desc":   f"Commission livraison - Commande #{order_id[-6:].upper()}",
                    "ref":    f"PAY-DELIV-{order_id[-8:].upper()}-{int(time.time())}",
                },
            )

    # 7. Créditer l'Administrateur
    if admin_commission > 0:
        db.execute(
            text("""
                INSERT INTO wallets (user_id, balance, escrow_balance)
                VALUES (:u_id, :amount, 0)
                ON CONFLICT (user_id) DO UPDATE
                SET balance = wallets.balance + EXCLUDED.balance
            """),
            {"amount": admin_commission, "u_id": ADMIN_ID},
        )
        
        admin_wallet = db.execute(
            text("SELECT id FROM wallets WHERE user_id = :u_id"),
            {"u_id": ADMIN_ID},
        ).mappings().first()
        
        if admin_wallet:
            db.execute(
                text("""
                    INSERT INTO transactions (wallet_id, order_id, type, amount, status, description, reference)
                    VALUES (:w_id, :o_id, 'platform_fee', :amount, 'completed', :desc, :ref)
                """),
                {
                    "w_id":   admin_wallet["id"],
                    "o_id":   order_id,
                    "amount": admin_commission,
                    "desc":   f"Commission plateforme - Commande #{order_id[-6:].upper()}",
                    "ref":    f"PAY-ADMIN-{order_id[-8:].upper()}-{int(time.time())}",
                },
            )

    # 7. Passer la commande à 'completed' et solder les transactions escrow en attente
    db.execute(
        text("UPDATE orders SET status = 'completed', updated_at = NOW() WHERE id = :id"),
        {"id": order_id},
    )
    db.execute(
        text("""
            UPDATE transactions SET status = 'completed'
            WHERE order_id = :o_id AND type = 'escrow_lock' AND status = 'pending'
        """),
        {"o_id": order_id},
    )

    return {
        "success":         True,
        "message":         "Paiement libéré avec succès.",
        "vendor_net":      float(vendor_net),
        "deliverer_share": float(deliverer_share),
        "platform_fee":    float(admin_commission),
    }
