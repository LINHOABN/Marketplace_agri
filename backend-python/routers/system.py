from fastapi import APIRouter, Depends, Request, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from database import get_db
from .auth import _token_response

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
