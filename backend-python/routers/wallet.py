from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from sqlalchemy import text
from database import get_db
from dependencies import get_current_user
from pydantic import BaseModel
from typing import Optional, List
import time

from services import finance_service

router = APIRouter(prefix="/wallet", tags=["wallet"])

class WalletAction(BaseModel):
    amount: float
    method: str = "MTN MoMo"
    phone: str = ""
    pin: str = ""
    status_code: Optional[str] = "SUCCESS"

@router.get("/")
async def get_wallet_info(current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    """Affiche le solde actuel avec alias pour le frontend."""
    user_id = current_user["id"]
    role = current_user.get("role", "buyer")
    
    finance_service.ensure_wallet_exists(db, user_id)
    
    query = text("SELECT balance, escrow_balance FROM wallets WHERE user_id = :u_id")
    wallet = db.execute(query, {"u_id": user_id}).mappings().first()

    in_transit = 0.0
    if role == "seller":
        transit_res = db.execute(
            text("""
                SELECT COALESCE(SUM(o.total_amount), 0) as total
                FROM orders o
                JOIN shops s ON o.shop_id = s.id
                WHERE s.seller_id = :u_id
                  AND o.status IN ('accepted', 'in_progress', 'shipped', 'pending')
            """),
            {"u_id": user_id},
        ).mappings().first()
        in_transit = float(transit_res["total"] or 0) if transit_res else 0.0

    balance = float(wallet["balance"])
    escrow = float(wallet["escrow_balance"])

    return {
        "balance": balance,
        "in_transit_balance": in_transit,
        "locked_balance": escrow if role != "seller" else in_transit,
    }

@router.post("/deposit")
async def deposit(req: WalletAction, request: Request, current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    """Dépôt via Mobile Money (utilise la logique métier centrale)."""
    user_id = current_user["id"]
    try:
        result = finance_service.process_deposit(
            db, 
            user_id, 
            req.amount, 
            req.status_code or "SUCCESS", 
            req.method
        )
        
        # Temps réel : Mise à jour du solde dans l'interface (si succès)
        if result["success"]:
            sio = getattr(request.app.state, "sio", None)
            if sio:
                wallet_bal = db.execute(text("SELECT balance FROM wallets WHERE user_id = :u_id"), {"u_id": user_id}).scalar()
                await sio.emit("wallet-updated", {"balance": float(wallet_bal)}, room=str(user_id))

        return result
    except Exception as e:
        db.rollback()
        print(f"[WALLET_ERROR] Deposit failed: {e}")
        raise HTTPException(status_code=500, detail=f"Erreur technique lors de la recharge: {str(e)}")

@router.post("/withdraw")
async def withdraw(req: WalletAction, request: Request, current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    """Simule un retrait Mobile Money."""
    user_id = current_user["id"]
    
    wallet = db.execute(text("SELECT id, balance FROM wallets WHERE user_id = :u_id"), {"u_id": user_id}).mappings().first()
    if not wallet or wallet["balance"] < req.amount:
        raise HTTPException(status_code=400, detail="Solde insuffisant")
    
    try:
        # 1. Update balance
        db.execute(text("""
            UPDATE wallets SET balance = balance - :amt 
            WHERE user_id = :u_id
        """), {"amt": req.amount, "u_id": user_id})
        
        # 2. Add transaction record
        db.execute(text("""
                INSERT INTO transactions (id, wallet_id, type, amount, status, description, reference)
                VALUES (gen_random_uuid(), :w_id, 'withdrawal', :amt, 'completed', :desc, :ref)
            """), {
                "w_id": wallet["id"],
                "amt": -req.amount,
                "desc": f"Retrait vers {req.phone}",
                "ref": f"WITH-{str(user_id)[:8]}"
            })
        
        db.commit()

        # Temps réel : Mise à jour du solde après retrait
        sio = getattr(request.app.state, "sio", None)
        if sio:
            new_bal_final = db.execute(text("SELECT balance FROM wallets WHERE user_id = :u_id"), {"u_id": user_id}).scalar()
            await sio.emit("wallet-updated", {"balance": float(new_bal_final)}, room=str(user_id))

        return {"message": "Success"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/transactions")
async def get_transactions(current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    """Historique des paiements et dépôts."""
    user_id = current_user["id"]
    query = text("""
        SELECT t.id, t.type, t.amount, t.status, t.description, t.created_at 
        FROM transactions t
        JOIN wallets w ON t.wallet_id = w.id
        WHERE w.user_id = :u_id
        ORDER BY t.created_at DESC
    """)
    result = db.execute(query, {"u_id": user_id}).mappings().all()
    return [dict(r) for r in result]
