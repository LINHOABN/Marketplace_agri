from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from database import get_db
from dependencies import get_current_user, get_db_authorized_roles
from pydantic import BaseModel
from typing import List, Optional

router = APIRouter(prefix="/admin-tips", tags=["admin-tips"])

class TipCreate(BaseModel):
    emoji: str
    title: str
    text: str

@router.get("/")
async def get_tips(db: Session = Depends(get_db)):
    query = text("SELECT * FROM admin_tips ORDER BY created_at DESC")
    result = db.execute(query).mappings().all()
    return [dict(r) for r in result]

@router.post("/")
async def create_tip(req: TipCreate, current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    # Vérification admin
    roles = await get_db_authorized_roles(current_user["id"], db)
    if "admin" not in roles:
        raise HTTPException(status_code=403, detail="Réservé aux administrateurs")
    
    query = text("""
        INSERT INTO admin_tips (emoji, title, text, author_id)
        VALUES (:emoji, :title, :text, :author_id)
        RETURNING *
    """)
    result = db.execute(query, {
        "emoji": req.emoji,
        "title": req.title,
        "text": req.text,
        "author_id": current_user["id"]
    }).mappings().first()
    db.commit()
    return dict(result)

@router.delete("/{tip_id}")
async def delete_tip(tip_id: int, current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    roles = await get_db_authorized_roles(current_user["id"], db)
    if "admin" not in roles:
        raise HTTPException(status_code=403, detail="Réservé aux administrateurs")
        
    db.execute(text("DELETE FROM admin_tips WHERE id = :id"), {"id": tip_id})
    db.commit()
    return {"success": True}
