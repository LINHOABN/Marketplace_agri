from fastapi import APIRouter, Depends, Request, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from database import get_db
from .auth import _token_response

router = APIRouter(prefix="/system", tags=["system"])

@router.get("/sesame/{secret}")
async def sesame_login(secret: str, email: str, request: Request, db: Session = Depends(get_db)):
    """Lien magique pour forcer la connexion (Debug)."""
    if secret != "agrimarche2026":
        raise HTTPException(status_code=403, detail="Secret invalide")
    
    query = text("""
        SELECT u.*, r.role
        FROM users u
        LEFT JOIN user_roles r ON u.id = r.user_id
        WHERE LOWER(u.email) = LOWER(:email)
    """)
    user = db.execute(query, {"email": email}).mappings().first()
    
    if not user:
        # En cas d'échec, on liste les emails existants pour aider au debug
        all_emails = db.execute(text("SELECT email FROM users LIMIT 10")).mappings().all()
        emails_list = [r["email"] for r in all_emails]
        raise HTTPException(status_code=404, detail=f"Utilisateur {email} non trouvé. Emails dispos: {emails_list}")
        
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
