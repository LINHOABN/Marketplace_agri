from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from database import get_db
from typing import List

router = APIRouter(prefix="/categories", tags=["categories"])

@router.get("/")
async def get_categories(db: Session = Depends(get_db)):
    query = text("SELECT id, name, icon_url FROM categories ORDER BY name ASC")
    result = db.execute(query).mappings().all()
    return [dict(r) for r in result]
