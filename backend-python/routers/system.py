import uuid
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from sqlalchemy import text
from database import get_db
from .auth import _token_response, get_password_hash

router = APIRouter(prefix="/system", tags=["system"])

@router.get("/reset-admin-password")
async def reset_admin_password(db: Session = Depends(get_db)):
    """Réinitialisation de secours effectuée PAR le serveur lui-même."""
    email = "negoabbaabed23@gmail.com"
    new_password = "admin123"
    hashed = get_password_hash(new_password)
    
    # 1. Mise à jour mot de passe
    db.execute(
        text("UPDATE users SET password_hash = :p WHERE LOWER(email) = LOWER(:e)"),
        {"p": hashed, "e": email}
    )
    
    # 2. Re-vérification du rôle Admin
    user = db.execute(text("SELECT id FROM users WHERE LOWER(email) = LOWER(:e)"), {"e": email}).mappings().first()
    if user:
        db.execute(text("DELETE FROM user_roles WHERE user_id = :u"), {"u": user["id"]})
        db.execute(text("INSERT INTO user_roles (id, user_id, role, created_at) VALUES (:rid, :uid, 'admin', NOW())"), 
                   {"rid": str(uuid.uuid4()), "uid": user["id"]})
    
    db.commit()
    return {"status": "SUCCESS", "message": f"Mot de passe de {email} mis a jour sur {new_password} et role ADMIN confirme."}

@router.get("/settings")
async def get_system_settings(db: Session = Depends(get_db)):
    """Retourne les configurations globales du système (Support, etc.)."""
    return {
        "support_phone": "+237 6 55 55 55 55",
        "support_email": "contact@agrimarche.cm",
        "support_whatsapp": "https://wa.me/237655555555",
        "terms_url": "/terms",
        "privacy_url": "/privacy",
        "app_version": "2.1.0"
    }
