# =============================================================================
# routers/ai.py — AgriBot (assistant IA AgriMarché)
# =============================================================================

from typing import List, Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from database import get_db
from dependencies import get_optional_user
from services.agribot import build_user_context, generate_reply, get_suggestions

router = APIRouter(prefix="/ai", tags=["ai"])


class ChatMessage(BaseModel):
    role: str = "user"
    content: str = ""


class AIChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=4000)
    history: Optional[List[ChatMessage]] = None


@router.get("/suggestions")
async def list_suggestions(
    current_user: Optional[dict] = Depends(get_optional_user),
):
    """Questions rapides selon le rôle de l'utilisateur."""
    role = current_user.get("role") if current_user else None
    return {"suggestions": get_suggestions(role)}


@router.post("/chat")
async def chat_with_ai(
    req: AIChatRequest,
    db: Session = Depends(get_db),
    current_user: Optional[dict] = Depends(get_optional_user),
):
    """
    Envoie un message à AgriBot.
    Auth optionnelle : si connecté, le bot connaît le rôle et un résumé d'activité.
    """
    user_context = ""
    if current_user:
        user_context = build_user_context(
            db, str(current_user["id"]), current_user.get("role", "buyer")
        )

    history = None
    if req.history:
        history = [h.model_dump() for h in req.history]

    role = current_user.get("role", "buyer") if current_user else None
    result = await generate_reply(req.message, history, user_context, role)
    response_text = result["response"]

    return {
        "response": response_text,
        "reply": response_text,
        "source": result.get("source", "local"),
        "quick_actions": result.get("quick_actions", []),
        "suggestions": result.get("suggestions", []),
        "intent": result.get("intent", "general"),
    }
