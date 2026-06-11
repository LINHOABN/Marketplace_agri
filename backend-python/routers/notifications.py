from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from database import get_db
from dependencies import get_current_user

router = APIRouter(prefix="/notifications", tags=["notifications"])

@router.get("/")
async def get_notifications(current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    user_id = current_user["id"]
    try:
        result = db.execute(
            text("SELECT * FROM notifications WHERE user_id = :u_id ORDER BY created_at DESC"),
            {"u_id": user_id}
        ).mappings().all()
        return list(result)
    except Exception as e:
        raise HTTPException(status_code=500, detail="Erreur lors de la récupération des notifications")

@router.post("/read")
async def mark_read(current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    user_id = current_user["id"]
    try:
        db.execute(
            text("UPDATE notifications SET is_read = TRUE WHERE user_id = :u_id"),
            {"u_id": user_id}
        )
        db.commit()
        return {"success": True, "message": "Notifications marquées comme lues"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail="Erreur")
