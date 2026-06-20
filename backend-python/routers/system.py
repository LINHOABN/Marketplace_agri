from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from database import get_db

router = APIRouter(prefix="/system", tags=["system"])

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

@router.get("/init-db")
async def initialize_database(key: str = None):
    """Initialise la base de données (Tables et Enums)."""
    if key != "agrimarche2026":
        return {"error": "Clé d'initialisation invalide."}
    
    from init_database import run
    try:
        run()
        return {"success": True, "message": "Base de données initialisée avec succès."}
    except Exception as e:
        return {"success": False, "error": str(e)}
