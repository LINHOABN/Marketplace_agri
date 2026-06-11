from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from sqlalchemy.orm import Session
from sqlalchemy import text
from database import get_db
from dependencies import get_current_user, get_db_user_role
import uuid
from utils.upload_service import guess_extension, make_filename, save_bytes

router = APIRouter(prefix="/posts", tags=["posts"])

@router.post("/")
async def create_post(
    content: str = Form(...),
    media: UploadFile = File(None),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    user_id = current_user["id"]
    
    # Sécurité : Seuls les vendeurs, livreurs et admins peuvent publier des stories.
    db_role = await get_db_user_role(user_id, db)
    if str(db_role) == "buyer":
        raise HTTPException(
            status_code=403, 
            detail="Seuls les professionnels (Vendeurs/Livreurs) peuvent publier des stories."
        )

    media_url = None
    
    if media:
        content = await media.read()
        ext = guess_extension(media.filename, media.content_type)
        filename = make_filename("story", ext)
        media_url = await save_bytes(
            content,
            filename,
            media.content_type,
            prefix="stories",
        )
        
    try:
        post_id = str(uuid.uuid4())
        # Déterminer la catégorie (peut être nulle ou passée en Form)
        category = "Général"
        
        query = text("""
            INSERT INTO posts (id, user_id, content, media_url, type, category, created_at, expires_at)
            VALUES (CAST(:id AS uuid), CAST(:user_id AS uuid), :content, :media_url, CAST('story' AS post_type), :category, NOW(), NOW() + INTERVAL '24 hours')
            RETURNING *
        """)
        result = db.execute(query, {
            "id": post_id,
            "user_id": user_id,
            "content": content,
            "media_url": media_url,
            "category": category
        }).mappings().first()
        db.commit()
        return result
    except Exception as e:
        db.rollback()
        print(f"Error creating story for user {user_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Erreur story: {str(e)}")

@router.put("/{id}")
async def update_post(
    id: str,
    content: str = Form(...),
    media: UploadFile = File(None),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    user_id = current_user["id"]
    try:
        # Vérification de propriété
        post = db.execute(
            text("SELECT * FROM posts WHERE id = :id AND user_id = :user_id"),
            {"id": id, "user_id": user_id}
        ).mappings().first()
        
        if not post:
            raise HTTPException(status_code=404, detail="Story introuvable ou non autorisée")

        media_url = post["media_url"]
        if media:
            file_content = await media.read()
            ext = guess_extension(media.filename, media.content_type)
            filename = make_filename("story_update", ext)
            media_url = await save_bytes(
                file_content,
                filename,
                media.content_type,
                prefix="stories",
            )

        db.execute(text("""
            UPDATE posts 
            SET content = :content, media_url = :media_url 
            WHERE id = :id AND user_id = :user_id
        """), {
            "content": content,
            "media_url": media_url,
            "id": id,
            "user_id": user_id
        })
        db.commit()
        return {"message": "Story mise à jour avec succès", "media_url": media_url}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Erreur lors de la mise à jour: {str(e)}")

@router.delete("/{id}")
async def delete_post(id: str, current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    user_id = current_user["id"]
    try:
        result = db.execute(
            text("DELETE FROM posts WHERE id = :id AND user_id = :user_id RETURNING *"),
            {"id": id, "user_id": user_id}
        ).mappings().first()
        
        if not result:
            raise HTTPException(status_code=404, detail="Story introuvable ou non autorisée")
            
        db.commit()
        return {"message": "Story supprimée avec succès"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail="Erreur lors de la suppression")

@router.post("/{id}/like")
async def like_post(id: str, current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    liker_id = current_user["id"]
    try:
        # DB Like
        db.execute(
            text("INSERT INTO post_likes (post_id, user_id) VALUES (:post_id, :user_id) ON CONFLICT DO NOTHING"),
            {"post_id": id, "user_id": liker_id}
        )
        
        # Notification logic (Simplified for now - will be completed with real-time later)
        post_res = db.execute(text("SELECT user_id FROM posts WHERE id = :id"), {"id": id}).mappings().first()
        if post_res and post_res["user_id"] != liker_id:
            user_res = db.execute(text("SELECT full_name FROM users WHERE id = :id"), {"id": liker_id}).mappings().first()
            liker_name = user_res["full_name"] if user_res else "Un utilisateur"
            
            db.execute(text("""
                INSERT INTO notifications (user_id, type, title, content, target_id)
                VALUES (:author_id, 'like', 'Nouveau Like', :content, :target_id)
            """), {
                "author_id": post_res["user_id"],
                "content": f"{liker_name} a aimé votre publication.",
                "target_id": id
            })
            
        db.commit()
        return {"liked": True}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail="Erreur lors du like")

@router.post("/{id}/comment")
async def comment_post(id: str, content: str = Form(...), current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    commenter_id = current_user["id"]
    try:
        comment_res = db.execute(text("""
            INSERT INTO post_comments (post_id, user_id, content)
            VALUES (:post_id, :user_id, :content)
            RETURNING *
        """), {"post_id": id, "user_id": commenter_id, "content": content}).mappings().first()
        
        # Notification logic
        post_res = db.execute(text("SELECT user_id FROM posts WHERE id = :id"), {"id": id}).mappings().first()
        if post_res and post_res["user_id"] != commenter_id:
            user_res = db.execute(text("SELECT full_name FROM users WHERE id = :id"), {"id": commenter_id}).mappings().first()
            name = user_res["full_name"] if user_res else "Un utilisateur"
            
            db.execute(text("""
                INSERT INTO notifications (user_id, type, title, content, target_id)
                VALUES (:author_id, 'comment', 'Nouveau Commentaire', :notif_content, :target_id)
            """), {
                "author_id": post_res["user_id"],
                "notif_content": f"{name} a commenté votre publication.",
                "target_id": id
            })
            
        db.commit()
        return comment_res
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail="Erreur lors du commentaire")
