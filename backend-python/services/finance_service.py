from sqlalchemy.orm import Session
from sqlalchemy import text
from decimal import Decimal
import time
from typing import Optional

def ensure_wallet_exists(db: Session, user_id: str):
    """S'assure que l'utilisateur possède un portefeuille, le crée sinon."""
    wallet = db.execute(
        text("SELECT id FROM wallets WHERE user_id = :u_id"),
        {"u_id": user_id}
    ).mappings().first()
    
    if not wallet:
        w_id = db.execute(
            text("INSERT INTO wallets (id, user_id, balance, escrow_balance) VALUES (gen_random_uuid(), :u_id, 0, 0) RETURNING id"),
            {"u_id": user_id}
        ).scalar()
        db.commit()
        return w_id
    return wallet["id"]

def process_deposit(db: Session, user_id: str, amount: float, status_code: str = "SUCCESS", method: str = "Mobile Money"):
    """
    Logique Métier : Effectuer un dépôt.
    Le solde n'est crédité que si status_code == 'SUCCESS'.
    La transaction est toujours enregistrée pour historique.
    """
    wallet_id = ensure_wallet_exists(db, user_id)
    amt_decimal = Decimal(str(amount))
    
    if status_code == "SUCCESS":
        db.execute(text("""
            UPDATE wallets SET balance = balance + :amt 
            WHERE id = :w_id
        """), {"amt": amt_decimal, "w_id": wallet_id})
    
    db_status = 'completed' if status_code == 'SUCCESS' else 'failed'
    
    db.execute(text("""
        INSERT INTO transactions (id, wallet_id, type, amount, status, description, reference)
        VALUES (gen_random_uuid(), :w_id, 'deposit', :amt, :status, :desc, :ref)
    """), {
        "w_id": wallet_id,
        "amt": amt_decimal if status_code == "SUCCESS" else 0,
        "status": db_status,
        "desc": f"Dépôt {method} [{status_code}]",
        "ref": f"DEP-{str(user_id)[:8]}-{int(time.time())}"
    })
    
    db.commit()
    return {"success": status_code == "SUCCESS", "code": status_code}

def process_checkout(db: Session, user_id: str, amount: float, status_code: str = "SUCCESS"):
    """
    Logique Métier : Paiement de commande (Passage en séquestre).
    """
    wallet_id = ensure_wallet_exists(db, user_id)
    amt_decimal = Decimal(str(amount))
    
    # Vérifier le solde avant de bloquer
    wallet = db.execute(text("SELECT balance FROM wallets WHERE id = :w_id"), {"w_id": wallet_id}).mappings().first()
    
    if status_code == "SUCCESS":
        if wallet['balance'] < amt_decimal:
            status_code = "INSUFFICIENT_FUNDS"
        else:
            db.execute(text("""
                UPDATE wallets 
                SET balance = balance - :amt, 
                    escrow_balance = escrow_balance + :amt 
                WHERE id = :w_id
            """), {"w_id": wallet_id, "amt": amt_decimal})
    
    db_status = 'completed' if status_code == 'SUCCESS' else 'failed'
    
    db.execute(text("""
        INSERT INTO transactions (id, wallet_id, type, amount, status, description, reference)
        VALUES (gen_random_uuid(), :w_id, 'escrow_lock', :amt, :status, :desc, :ref)
    """), {
        "w_id": wallet_id,
        "amt": -amt_decimal if status_code == "SUCCESS" else 0,
        "status": db_status,
        "desc": f"Paiement commande [{status_code}]",
        "ref": f"PAY-{str(user_id)[:8]}-{int(time.time())}"
    })
    
    db.commit()
    return {"success": status_code == "SUCCESS", "code": status_code}

def process_withdrawal(db: Session, user_id: str, amount: float, status_code: str = "SUCCESS", phone: str = ""):
    """
    Logique Métier : Retrait de fonds.
    """
    wallet_id = ensure_wallet_exists(db, user_id)
    amt_decimal = Decimal(str(amount))
    
    wallet = db.execute(text("SELECT balance FROM wallets WHERE id = :w_id"), {"w_id": wallet_id}).mappings().first()
    
    if status_code == "SUCCESS":
        if wallet['balance'] < amt_decimal:
            status_code = "INSUFFICIENT_FUNDS"
        else:
            db.execute(text("""
                UPDATE wallets SET balance = balance - :amt WHERE id = :w_id
            """), {"w_id": wallet_id, "amt": amt_decimal})
    
    db_status = 'completed' if status_code == 'SUCCESS' else 'failed'
    
    db.execute(text("""
        INSERT INTO transactions (id, wallet_id, type, amount, status, description, reference)
        VALUES (gen_random_uuid(), :w_id, 'withdrawal', :amt, :status, :desc, :ref)
    """), {
        "w_id": wallet_id,
        "amt": -amt_decimal if status_code == "SUCCESS" else 0,
        "status": db_status,
        "desc": f"Retrait {phone} [{status_code}]",
        "ref": f"WDR-{str(user_id)[:8]}-{int(time.time())}"
    })
    
    db.commit()
    return {"success": status_code == "SUCCESS", "code": status_code}
