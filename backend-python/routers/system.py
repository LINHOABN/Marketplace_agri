from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text
from database import get_db

router = APIRouter(prefix="/system", tags=["system"])

@router.get("/debug-schema")
async def debug_schema(db: Session = Depends(get_db)):
    """Route temporaire pour vérifier le schéma de la base en production."""
    try:
        users = db.execute(text("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'users'")).mappings().all()
        roles = db.execute(text("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'user_roles'")).mappings().all()
        return {
            "users": users,
            "user_roles": roles
        }
    except Exception as e:
        return {"error": str(e)}

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
