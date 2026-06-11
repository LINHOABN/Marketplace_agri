# =============================================================================
# routers/payments.py — Système de Paiement et Séquestre (Escrow)
# =============================================================================
#
# CE FICHIER FAIT QUOI ?
#   C'est ici qu'est géré l'argent. Le flux est le suivant :
#   1. Initiate : L'acheteur paye, l'argent quitte son solde "balance" 
#      pour aller dans son solde "escrow_balance" (fonds bloqués).
#   2. Confirm Receipt : Quand l'acheteur confirme avoir reçu le colis, 
#      le système calcule les parts (Vendeur, Plateforme, Livreur) 
#      et distribue l'argent aux concernés.
#
# POUR MODIFIER :
#   - Changer la commission plateforme (ex: passer de 3% à 5%) → modifiez 
#     la ligne `commission = total * Decimal('0.03')` dans `confirm_receipt`.
#   - Modifier la part du livreur → modifiez `total * Decimal('0.10')`.
#   - Ajouter un nouveau mode de paiement (ex: Crypto) → modifiez `initiate_payment` 
#     pour traiter ce nouveau type dans le bloc `if req.payment_method == ...`.
# =============================================================================

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from sqlalchemy import text
from database import get_db
from dependencies import get_current_user
from pydantic import BaseModel
from decimal import Decimal
from services.escrow import release_order_escrow

router = APIRouter(prefix="/payments", tags=["payments"])

# ─── MODÈLE DE REQUÊTE ────────────────────────────────────────────────────────
class PaymentInit(BaseModel):
    order_id: str
    amount: float
    payment_method: str # 'wallet', 'orange_money', 'mtn_money'

# ─── ÉTAPE 1 : SÉCURISATION DES FONDS (INITIATE) ─────────────────────────────
@router.post("/initiate")
async def initiate_payment(req: PaymentInit, request: Request, current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    buyer_id = current_user["id"]
    try:
        # a. Verrouiller la commande en base pour éviter les modifications pendant le paiement
        # FOR UPDATE empêche d'autres transactions de toucher à cette ligne
        order_query = text("""
            SELECT o.*, p.quantity_available as stock, p.name as product_name, s.seller_id, u.full_name as buyer_name
            FROM orders o 
            JOIN products p ON o.product_id = p.id 
            JOIN shops s ON o.shop_id = s.id
            JOIN users u ON o.buyer_id = u.id
            WHERE o.id = :id FOR UPDATE
        """)
        order = db.execute(order_query, {"id": req.order_id}).mappings().first()
        
        if not order:
            raise HTTPException(status_code=404, detail="Commande introuvable")
        
        # b. Vérification du stock au dernier moment
        if order["stock"] < order["quantity"]:
            raise HTTPException(status_code=400, detail="Stock insuffisant pour finaliser l'achat")

        requested_amount = Decimal(str(req.amount))

        # c. Logique pour le paiement par Portefeuille (Wallet)
        if req.payment_method == 'wallet':
            # On vérifie le solde
            wallet = db.execute(text("SELECT id, balance FROM wallets WHERE user_id = :u_id FOR UPDATE"), {"u_id": buyer_id}).mappings().first()
            
            if not wallet or wallet["balance"] < requested_amount:
                raise HTTPException(status_code=400, detail="Solde insuffisant dans votre portefeuille AgriMarché")
            
            # TRANSFERT INTERNE : balance -> escrow_balance
            # L'argent est "bloqué" mais pas encore versé au vendeur.
            db.execute(text("UPDATE wallets SET balance = balance - :amount, escrow_balance = escrow_balance + :amount WHERE id = :id"), 
                      {"amount": requested_amount, "id": wallet["id"]})
            
            # Création d'une ligne de transaction pour l'historique
            db.execute(text("""
                INSERT INTO transactions (wallet_id, order_id, amount, type, status)
                VALUES (:w_id, :o_id, :amount, 'escrow_lock', 'pending')
            """), {"w_id": wallet["id"], "o_id": req.order_id, "amount": requested_amount})

        # d. Mise à jour de la commande et diminution réelle du stock
        db.execute(text("UPDATE orders SET status = 'pending' WHERE id = :id"), {"id": req.order_id})
        db.execute(text("UPDATE products SET quantity_available = quantity_available - :q WHERE id = :p_id"), 
                  {"q": order["quantity"], "p_id": order["product_id"]})

        # e. NOTIFICATION AU VENDEUR (Temps réel via Socket.IO)
        # On insère en base d'abord
        notif_res = db.execute(text("""
            INSERT INTO notifications (user_id, title, content, type, target_id)
            VALUES (:s_id, 'Paiement Reçu !', :content, 'payment', :o_id)
            RETURNING *
        """), {
            "s_id": order["seller_id"],
            "content": f"{order['buyer_name']} a payé {req.amount} FCFA pour {order['product_name']}.",
            "o_id": req.order_id
        }).mappings().first()
        
        db.commit() # On valide tout en base de données

        # Puis on envoie l'alerte sonore/visuelle si le vendeur est connecté via sa Room
        sio = request.app.state.sio
        if sio:
            # Sécurisation pour JSON (Socket.IO n'aime pas les UUID/Datetime bruts)
            notif_data = dict(notif_res)
            # Conversion de toutes les valeurs non-standard en strings
            for k, v in notif_data.items():
                if hasattr(v, '__str__') and not isinstance(v, (str, int, float, bool, type(None))):
                    notif_data[k] = str(v)
            
            await sio.emit('incoming-payment', {"amount": req.amount, "product": order["product_name"]}, room=str(order["seller_id"]))
            await sio.emit('new-notification', notif_data, room=str(order["seller_id"]))

        return {"success": True, "message": "Fonds sécurisés en séquestre"}
    except Exception as e:
        db.rollback()
        print(f"PAYMENT INITIATE ERROR: {e}")
        raise HTTPException(status_code=500, detail=f"Erreur technique: {str(e)}")

class ConfirmReceipt(BaseModel):
    order_id: str

# ─── ÉTAPE 2 : LIBÉRATION DES FONDS AU VENDEUR (CONFIRM) ────────────────────
@router.post("/confirm-receipt")
async def confirm_receipt(req: ConfirmReceipt, current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    """Confirme la réception et libère l'escrow vers vendeur et livreur."""
    try:
        result = release_order_escrow(db, req.order_id)
        db.commit()
        return result
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        raise e
