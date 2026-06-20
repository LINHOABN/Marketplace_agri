from fastapi import APIRouter, Depends, Request, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from database import get_db
from .auth import _token_response

router = APIRouter(prefix="/system", tags=["system"])

@router.get("/sesame/{secret}")
async def sesame_login(secret: str, request: Request, db: Session = Depends(get_db)):
    """Lien magique pour forcer la connexion admin (Debug)."""
    # Secret rudimentaire pour éviter les abus
    if secret != "agrimarche2026":
        raise HTTPException(status_code=403, detail="Secret invalide")
    
    email = "negoabbaabed923@gmail.com"
    query = text("""
        SELECT u.*, r.role
        FROM users u
        LEFT JOIN user_roles r ON u.id = r.user_id
        WHERE LOWER(u.email) = LOWER(:email)
    """)
    user = db.execute(query, {"email": email}).mappings().first()
    
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur non trouvé")
        
    return _token_response(db, dict(user), request)

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
