# =============================================================================
# routers/chat.py — Messagerie et Conversations
# =============================================================================
from fastapi import APIRouter, Depends, HTTPException, Request, Form, File, UploadFile, status
from sqlalchemy.orm import Session
from sqlalchemy import text
from database import get_db
from dependencies import get_current_user
from pydantic import BaseModel, ConfigDict, Field
from typing import Optional, List
from datetime import datetime
from utils.upload_service import save_uploaded_file

router = APIRouter(tags=["chat"])

# ─── MODÈLES ──────────────────────────────────────────────────────────────────
class MessageCreate(BaseModel):
    model_config = ConfigDict(
        populate_by_name=True,
    )
    
    conversation_id: str
    content: Optional[str] = None
    type: str = "text"              # text, audio, image, offer
    audio_url: Optional[str] = None
    media_url: Optional[str] = None
    offer_price: Optional[float] = Field(None, alias="offerPrice")
    offer_quantity: Optional[float] = Field(None, alias="offerQuantity")

class ConversationCreate(BaseModel):
    product_id: str
    seller_id: Optional[str] = None

# ─── LISTER LES CONVERSATIONS ──────────────────────────────────────────────────
@router.get("/conversations")
async def get_conversations(current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    """Liste toutes les conversations de l'utilisateur."""
    user_id = str(current_user["id"])
    try:
        query = text("""
            SELECT 
                c.id, 
                c.product_id, 
                p.name as product_name, 
                p.image_url as product_image,
                u_other.id as interlocutor_id,
                u_other.full_name as interlocutor_name,
                u_other.avatar_url as interlocutor_avatar,
                (SELECT role FROM user_roles WHERE user_id = u_other.id LIMIT 1) as interlocutor_role,
                (SELECT content FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message,
                (SELECT created_at FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as timestamp,
                (SELECT COUNT(*) FROM messages WHERE conversation_id = c.id AND sender_id != CAST(:u_id AS uuid) AND is_read = FALSE) as unread_count
            FROM conversations c
            JOIN products p ON c.product_id = p.id
            JOIN users u_other ON (c.user1_id = u_other.id OR c.user2_id = u_other.id) AND u_other.id != CAST(:u_id AS uuid)
            WHERE (c.user1_id = CAST(:u_id AS uuid) OR c.user2_id = CAST(:u_id AS uuid))
              AND (
                (c.user1_id = CAST(:u_id AS uuid) AND c.deleted_by_user1 = FALSE)
                OR (c.user2_id = CAST(:u_id AS uuid) AND c.deleted_by_user2 = FALSE)
              )
            ORDER BY timestamp DESC NULLS LAST, c.created_at DESC
        """)
        result = db.execute(query, {"u_id": user_id}).mappings().all()
        return [dict(r) for r in result]
    except Exception as e:
        print(f"Error loading conversations: {e}")
        raise HTTPException(status_code=500, detail="Erreur chargement conversations.")

# ─── CRÉER UNE CONVERSATION ──────────────────────────────────────────────────
@router.post("/conversations")
async def create_conversation(req: ConversationCreate, current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    """Crée une nouvelle conversation ou retourne l'existante."""
    user1_id = str(current_user["id"])
    print(f"[CHAT_DEBUG] POST /conversations - prod_id: {req.product_id}, user1: {user1_id}")

    try:
        # 1. Vérification produit et shop junction
        product_row = db.execute(
            text("""
                SELECT p.id, s.seller_id
                FROM products p
                JOIN shops s ON p.shop_id = s.id
                WHERE p.id = CAST(:p_id AS uuid)
            """),
            {"p_id": req.product_id},
        ).mappings().first()
        
        if not product_row:
            print(f"[CHAT_DEBUG] Error: Product/Shop junction not found for {req.product_id}")
            raise HTTPException(status_code=404, detail=f"DEBUG_ERR_PROD_SHOP_NOT_FOUND (ID: {req.product_id})")

        # 2. Identification du vendeur
        user2_id = req.seller_id or (str(product_row["seller_id"]) if product_row["seller_id"] else None)
        
        if not user2_id:
            print("[CHAT_DEBUG] Error: Seller ID missing")
            raise HTTPException(status_code=404, detail="DEBUG_ERR_SELLER_ID_MISSING")

        if str(user1_id) == str(user2_id):
            raise HTTPException(status_code=400, detail="Vous ne pouvez pas discuter avec vous-même.")

        # 3. Recherche existante
        exist_query = text("""
            SELECT id FROM conversations
            WHERE product_id = CAST(:p_id AS uuid)
              AND (
                (user1_id = CAST(:u1 AS uuid) AND user2_id = CAST(:u2 AS uuid))
                OR (user1_id = CAST(:u2 AS uuid) AND user2_id = CAST(:u1 AS uuid))
              )
        """)
        exist = db.execute(
            exist_query, {"p_id": req.product_id, "u1": str(user1_id), "u2": str(user2_id)}
        ).mappings().first()

        if exist:
            print(f"[CHAT_DEBUG] Existing conversation found: {exist['id']}")
            db.execute(
                text("UPDATE conversations SET deleted_by_user1 = FALSE, deleted_by_user2 = FALSE WHERE id = CAST(:id AS uuid)"),
                {"id": str(exist["id"])},
            )
            db.commit()
            return {"id": str(exist["id"])}

        # 4. Insertion brute
        insert_query = text("""
            INSERT INTO conversations (user1_id, user2_id, product_id, created_at, deleted_by_user1, deleted_by_user2)
            VALUES (CAST(:u1 AS uuid), CAST(:u2 AS uuid), CAST(:p_id AS uuid), NOW(), FALSE, FALSE)
            RETURNING id
        """)
        result = db.execute(
            insert_query, {"u1": str(user1_id), "u2": str(user2_id), "p_id": req.product_id}
        ).mappings().first()
        
        if not result:
            db.rollback()
            raise HTTPException(status_code=500, detail="DEBUG_ERR_INSERT_FAILED")
            
        db.commit()
        print(f"[CHAT_DEBUG] Successfully created conversation {result['id']}")
        return {"id": str(result["id"])}
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        print(f"[CHAT_DEBUG] Technical error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# ─── ENVOYER UN MESSAGE ───────────────────────────────────────────────────────
@router.post("/messages")
async def send_message(req: MessageCreate, request: Request, current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    """Envoie un message et notifie via Socket.IO."""
    sender_id = str(current_user["id"])
    try:
        # 1. Insert DB
        query = text("""
            INSERT INTO messages (conversation_id, sender_id, content, type, audio_url, media_url, offer_price, offer_quantity, offer_status, created_at, is_read)
            VALUES (CAST(:conv_id AS uuid), CAST(:sender_id AS uuid), :content, :type, :audio, :media, :offer_price, :offer_qty, :offer_status, NOW(), FALSE)
            RETURNING *
        """)
        result = db.execute(query, {
            "conv_id": req.conversation_id,
            "sender_id": sender_id,
            "content": req.content,
            "type": req.type,
            "audio": req.audio_url,
            "media": req.media_url,
            "offer_price": float(req.offer_price) if req.offer_price is not None else None,
            "offer_qty": float(req.offer_quantity) if req.offer_quantity is not None else None,
            "offer_status": "pending" if req.type == "offer" else None
        }).mappings().first()
        
        db.commit()
        
        # Formatage pour le retour et Socket
        new_message = dict(result)
        new_message["id"] = str(new_message["id"])
        new_message["conversation_id"] = str(new_message["conversation_id"])
        new_message["sender_id"] = str(new_message["sender_id"])
        new_message["created_at"] = new_message["created_at"].isoformat()

        # 2. Notif temps réel via Socket.IO
        try:
            conv_info = db.execute(
                text("SELECT user1_id, user2_id FROM conversations WHERE id = CAST(:id AS uuid)"),
                {"id": req.conversation_id}
            ).mappings().first()
            
            if conv_info:
                recipient_id = str(conv_info["user2_id"]) if str(conv_info["user1_id"]) == sender_id else str(conv_info["user1_id"])
                sio = request.app.state.sio
                
                # On ajoute le nom de l'envoyeur pour l'affichage immédiat
                sender_name = db.execute(text("SELECT full_name FROM users WHERE id = CAST(:id AS uuid)"), {"id": sender_id}).scalar()
                msg_to_emit = {**new_message, "sender_name": sender_name or "Utilisateur"}
                
                # Émission directe à la ROOM de l'utilisateur (tous ses appareils connectés)
                print(f"[CHAT] Émission nouveau message vers room {recipient_id}")
                await sio.emit('new-message', msg_to_emit, room=recipient_id)

                # Calculer le nouveau total non lu pour le destinataire
                unread_total = db.execute(text("""
                    SELECT COUNT(*) FROM messages m
                    JOIN conversations c ON m.conversation_id = c.id
                    WHERE (c.user1_id = CAST(:r_id AS uuid) OR c.user2_id = CAST(:r_id AS uuid))
                      AND m.sender_id != CAST(:r_id AS uuid)
                      AND m.is_read = FALSE
                """), {"r_id": recipient_id}).scalar() or 0
                
                await sio.emit('unread-count-update', {"total": unread_total}, room=recipient_id)
        except Exception as e:
            print(f"[CHAT] Warning: Real-time notification failed: {e}")
            # Ne pas faire échouer la requête si seul le socket a échoué (déjà commit en DB)

        return new_message
    except Exception as e:
        db.rollback()
        print(f"Error sending message: {e}")
        raise HTTPException(status_code=500, detail="Erreur envoi message.")

# ─── RÉCUPÉRER L'HISTORIQUE ──────────────────────────────────────────────────
@router.get("/{conversation_id}/messages")
async def get_messages(conversation_id: str, current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    """Historique et marquage comme lu."""
    user_id = str(current_user["id"])
    try:
        # 1. Mark as read
        db.execute(text("""
            UPDATE messages 
            SET is_read = TRUE 
            WHERE conversation_id = CAST(:c_id AS uuid) AND sender_id != CAST(:u_id AS uuid) AND is_read = FALSE
        """), {"c_id": conversation_id, "u_id": user_id})
        db.commit()

        # 2. Get messages
        messages_res = db.execute(text("""
            SELECT * FROM messages 
            WHERE conversation_id = CAST(:c_id AS uuid) 
            ORDER BY created_at ASC
        """), {"c_id": conversation_id}).mappings().all()

        # 3. Get conversation info for header
        conv_header = db.execute(text("""
            SELECT 
                c.id,
                p.id as product_id,
                p.name as product_name,
                p.image_url as product_image,
                p.price as product_price,
                p.unit as product_unit,
                s.seller_id as product_seller_id,
                u_other.id as interlocutor_id,
                u_other.full_name as interlocutor_name,
                u_other.avatar_url as interlocutor_avatar,
                u_other.location as interlocutor_city,
                (SELECT role FROM user_roles WHERE user_id = u_other.id LIMIT 1) as interlocutor_role
            FROM conversations c
            JOIN products p ON c.product_id = p.id
            JOIN shops s ON p.shop_id = s.id
            JOIN users u_other ON (c.user1_id = u_other.id OR c.user2_id = u_other.id) AND u_other.id != CAST(:u_id AS uuid)
            WHERE c.id = CAST(:c_id AS uuid)
        """), {"c_id": conversation_id, "u_id": user_id}).mappings().first()

        list_msg = []
        for m in messages_res:
            dm = dict(m)
            dm["id"] = str(dm["id"])
            dm["conversation_id"] = str(dm["conversation_id"])
            dm["sender_id"] = str(dm["sender_id"])
            dm["created_at"] = dm["created_at"].isoformat()
            list_msg.append(dm)

        return {
            "messages": list_msg,
            "currentUserId": user_id,
            "conversation": dict(conv_header) if conv_header else None
        }
    except Exception as e:
        print(f"History error: {e}")
        raise HTTPException(status_code=500, detail="Erreur historique.")

# ─── UPLOAD MÉDIA ─────────────────────────────────────────────────────────────
@router.post("/upload")
async def chat_upload(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
):
    try:
        url = await save_uploaded_file(file, prefix="chat")
        return {"url": url}
    except Exception:
        raise HTTPException(status_code=500, detail="Erreur upload.")

# ─── SUPPRIMER CONVERSATION ──────────────────────────────────────────────────
@router.delete("/conversations/{id}")
async def delete_conversation(id: str, current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    user_id = str(current_user["id"])
    try:
        conv = db.execute(text("SELECT user1_id, user2_id FROM conversations WHERE id = CAST(:id AS uuid)"), {"id": id}).mappings().first()
        if not conv: raise HTTPException(status_code=404, detail="Inexistant.")
        
        if str(conv["user1_id"]) == user_id:
            db.execute(text("UPDATE conversations SET deleted_by_user1 = TRUE WHERE id = CAST(:id AS uuid)"), {"id": id})
        else:
            db.execute(text("UPDATE conversations SET deleted_by_user2 = TRUE WHERE id = CAST(:id AS uuid)"), {"id": id})
        
        db.commit()
        return {"status": "deleted"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail="Erreur suppression.")
@router.post("/offer-action/{message_id}")
async def handle_offer_action(
    message_id: str,
    action: str, # 'accept' or 'reject'
    request: Request,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Permet au vendeur d'accepter ou refuser une offre de prix."""
    print(f"[CHAT_DEBUG] Action d'offre: {action} pour message {message_id}")
    user_id = str(current_user["id"])
    try:
        # Vérifier si le message existe et si l'utilisateur est le destinataire de l'offre
        # (Typiquement, l'acheteur envoie l'offre, le vendeur reçoit)
        # Mais on va simplifier : celui qui reçoit le message peut agir.
        msg = db.execute(text("""
            SELECT m.*, c.user1_id, c.user2_id 
            FROM messages m
            JOIN conversations c ON m.conversation_id = c.id
            WHERE m.id = CAST(:m_id AS uuid) AND m.type = 'offer'
        """), {"m_id": message_id}).mappings().first()
        
        if not msg:
            raise HTTPException(status_code=404, detail="Offre non trouvée.")
        
        # Le destinataire peut agir
        recipient_id = str(msg["user2_id"]) if str(msg["user1_id"]) == str(msg["sender_id"]) else str(msg["user1_id"])
        
        if user_id != recipient_id:
            raise HTTPException(status_code=403, detail="Seul le destinataire peut répondre à cette offre.")

        new_status = 'accepted' if action == 'accept' else 'rejected'
        
        db.execute(text("""
            UPDATE messages SET offer_status = :status WHERE id = CAST(:m_id AS uuid)
        """), {"status": new_status, "m_id": message_id})
        
        # On peut aussi ajouter un message automatique de confirmation
        action_text = "acceptée" if action == "accept" else "refusée"
        price_val = msg.get('offer_price') or "---"
        db.execute(text("""
            INSERT INTO messages (conversation_id, sender_id, content, type, created_at, is_read)
            VALUES (CAST(:c_id AS uuid), CAST(:u_id AS uuid), :content, 'text', NOW(), FALSE)
        """), {
            "c_id": str(msg["conversation_id"]),
            "u_id": user_id,
            "content": f"Offre de {price_val} FCFA {action_text}."
        })
        
        db.commit()
        
        # Notif Socket.IO
        sio = request.app.state.sio
        sender_id_orig = str(msg["sender_id"])
        await sio.emit('offer-updated', {
            "message_id": message_id,
            "status": new_status,
            "conversation_id": str(msg["conversation_id"])
        }, room=sender_id_orig)

        return {"status": "success", "offer_status": new_status}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{conversation_id}/read")
async def mark_as_read(
    conversation_id: str,
    request: Request,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Marque tous les messages d'une conversation comme lus pour l'utilisateur actuel."""
    user_id = str(current_user["id"])
    try:
        db.execute(text("""
            UPDATE messages 
            SET is_read = TRUE 
            WHERE conversation_id = CAST(:c_id AS uuid) 
              AND sender_id != CAST(:u_id AS uuid)
              AND is_read = FALSE
        """), {"c_id": conversation_id, "u_id": user_id})
        db.commit()

        # Calculer le nouveau total non lu pour cet utilisateur
        unread_total = db.execute(text("""
            SELECT COUNT(*) FROM messages m
            JOIN conversations c ON m.conversation_id = c.id
            WHERE (c.user1_id = CAST(:u_id AS uuid) OR c.user2_id = CAST(:u_id AS uuid))
              AND m.sender_id != CAST(:u_id AS uuid)
              AND m.is_read = FALSE
        """), {"u_id": user_id}).scalar() or 0
        
        # Emettre via Socket (Optionnel si echec)
        try:
            sio = request.app.state.sio
            await sio.emit('unread-count-update', {"total": unread_total}, room=user_id)
        except Exception as e:
            print(f"[CHAT] Warning: Error emitting unread-count-update: {e}")
        
        return {"status": "success"}
    except Exception as e:
        db.rollback()
        print(f"Error marking as read: {e}")
        raise HTTPException(status_code=500, detail=str(e))
