from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from sqlalchemy import text
from database import get_db
from dependencies import get_current_user
from pydantic import BaseModel

router = APIRouter(prefix="/disputes", tags=["disputes"])

class DisputeCreate(BaseModel):
    order_id: str
    reason: str
    description: str

@router.post("/create")
async def create_dispute(req: DisputeCreate, current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    buyer_id = current_user["id"]
    try:
        # Check order
        order = db.execute(
            text("SELECT * FROM orders WHERE id = :id AND buyer_id = :b_id"),
            {"id": req.order_id, "b_id": buyer_id}
        ).mappings().first()
        
        if not order:
            raise HTTPException(status_code=404, detail="Commande introuvable")

        # Block Escrow
        db.execute(text("UPDATE orders SET status = 'dispute' WHERE id = :id"), {"id": req.order_id})

        # Create Dispute
        result = db.execute(text("""
            INSERT INTO disputes (order_id, initiator_id, reason, description, status, created_at)
            VALUES (:o_id, :initiator_id, :reason, :desc, 'open', NOW())
            RETURNING *
        """), {
            "o_id": req.order_id,
            "initiator_id": buyer_id,
            "reason": req.reason,
            "desc": req.description
        }).mappings().first()
        
        db.commit()
        return result
    except Exception as e:
        db.rollback()
        raise e if isinstance(e, HTTPException) else HTTPException(status_code=500, detail=str(e))

@router.post("/resolve")
async def resolve_dispute(dispute_id: int, resolution: str, current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    if current_user.get("role") != 'admin':
        raise HTTPException(status_code=403, detail="Accès refusé")

    try:
        # Implementation of resolution logic (simplified)
        db.execute(text("UPDATE disputes SET status = 'resolved', resolved_at = NOW() WHERE id = :id"), {"id": dispute_id})
        db.commit()
        return {"success": True, "message": "Litige résolu"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
