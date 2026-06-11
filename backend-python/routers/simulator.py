from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from database import get_db
from dependencies import is_admin
import time

from services import finance_service

router = APIRouter(prefix="/simulator", tags=["simulator"])

@router.get("/stats")
async def get_simulator_stats(db: Session = Depends(get_db), admin = Depends(is_admin)):
    """Récupère les statistiques globales pour le simulateur."""
    try:
        # 1. Total des fonds dans le système (Somme de tous les balances + séquestres)
        system_total = db.execute(text("SELECT SUM(balance + escrow_balance) FROM wallets")).scalar() or 0
        
        # 2. Total sous séquestre
        escrow_total = db.execute(text("SELECT SUM(escrow_balance) FROM wallets")).scalar() or 0
        
        # 3. Solde de l'admin
        admin_balance = db.execute(text("""
            SELECT balance FROM wallets w 
            JOIN users u ON w.user_id = u.id 
            WHERE u.role = 'admin' LIMIT 1
        """)).scalar() or 0
        
        # 4. Liste des derniers mouvements
        transactions = db.execute(text("""
            SELECT t.*, u.full_name 
            FROM transactions t
            JOIN wallets w ON t.wallet_id = w.id
            JOIN users u ON w.user_id = u.id
            ORDER BY t.created_at DESC LIMIT 10
        """)).mappings().all()
        
        return {
            "system_total": float(system_total),
            "escrow_total": float(escrow_total),
            "admin_balance": float(admin_balance),
            "transactions": [dict(t) for t in transactions]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/deposit")
async def simulate_deposit(user_id: str, amount: float, status_code: str = "SUCCESS", db: Session = Depends(get_db), admin = Depends(is_admin)):
    """Simule un dépôt via Mobile Money (utilise le service finance)."""
    try:
        result = finance_service.process_deposit(db, user_id, amount, status_code, "Simu Admin")
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/checkout")
async def simulate_checkout(buyer_id: str, amount: float, status_code: str = "SUCCESS", db: Session = Depends(get_db), admin = Depends(is_admin)):
    """Simule un paiement de commande (utilise le service finance)."""
    try:
        result = finance_service.process_checkout(db, buyer_id, amount, status_code)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/withdrawal")
async def simulate_withdrawal(user_id: str, amount: float, status_code: str = "SUCCESS", db: Session = Depends(get_db), admin = Depends(is_admin)):
    """Simule un retrait (utilise le service finance)."""
    try:
        result = finance_service.process_withdrawal(db, user_id, amount, status_code, "Withdraw Simu")
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/users")
async def get_simulator_users(db: Session = Depends(get_db), admin = Depends(is_admin)):
    """Liste les utilisateurs avec leurs rôles et soldes."""
    query = text("""
        SELECT u.id, u.full_name, u.email, u.role, w.balance, w.escrow_balance
        FROM users u
        LEFT JOIN wallets w ON u.id = w.user_id
        ORDER BY u.role, u.full_name
    """)
    result = db.execute(query).mappings().all()
    return [dict(r) for r in result]
