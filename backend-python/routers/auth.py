from fastapi import APIRouter, Depends, HTTPException, status, Query, Request
from sqlalchemy.orm import Session
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
import uuid
from database import get_db
from dependencies import get_current_user
from utils.security import verify_password, get_password_hash
from services.sessions import (
    create_user_session,
    refresh_session_tokens,
    revoke_session,
    revoke_all_sessions,
    list_user_sessions,
)
from pydantic import BaseModel, EmailStr
from typing import Optional

router = APIRouter(prefix="/auth", tags=["auth"])


class LoginRequest(BaseModel):
    identifier: Optional[str] = None
    email: Optional[str] = None
    password: str


class RegisterRequest(BaseModel):
    name: Optional[str] = None
    full_name: Optional[str] = None
    email: EmailStr
    password: str
    phone: Optional[str] = None
    role: Optional[str] = "buyer"
    location: Optional[str] = None


class SwitchRoleRequest(BaseModel):
    new_role: str


class RoleRequestBody(BaseModel):
    requested_role: str

class KYCSubmission(BaseModel):
    id_card_url: str
    selfie_url: str


class RefreshRequest(BaseModel):
    refresh_token: str


def _client_meta(request: Request) -> dict:
    return {
        "user_agent": request.headers.get("user-agent"),
        "ip_address": request.client.host if request.client else None,
    }


def _token_response(db: Session, user: dict, request: Request) -> dict:
    user_id = str(user["id"])
    user_email = str(user["email"])
    user_role = str(user["role"]) if user.get("role") else "buyer"
    meta = _client_meta(request)
    tokens = create_user_session(
        db,
        user_id,
        user_email,
        user_role,
        user_agent=meta["user_agent"],
        ip_address=meta["ip_address"],
    )
    db.commit()
    return {
        "access_token": tokens["access_token"],
        "refresh_token": tokens["refresh_token"],
        "session_id": tokens["session_id"],
        "token_type": "bearer",
        "user": {
            "id": user_id,
            "name": user.get("full_name") or user.get("name"),
            "email": user_email,
            "role": user_role,
        },
    }


@router.post("/login")
async def login(req: LoginRequest, request: Request, db: Session = Depends(get_db)):
    login_id = (req.identifier or req.email or "").strip()
    
    # Normalisation du téléphone (Cameroun)
    norm_phone = login_id
    # On retire tout sauf les chiffres et le + pour la comparaison
    digits_only = "".join(filter(str.isdigit, login_id))
    
    if len(digits_only) == 9:
        norm_phone = "+237" + digits_only
    elif len(digits_only) == 12 and digits_only.startswith("237"):
        norm_phone = "+" + digits_only
    
    # login_id brute peut déjà contenir le +
    if not norm_phone.startswith("+") and norm_phone.startswith("237") and len(norm_phone) == 12:
        norm_phone = "+" + norm_phone

    query = text("""
        SELECT u.*, r.role
        FROM users u
        LEFT JOIN user_roles r ON u.id = r.user_id
        WHERE LOWER(u.email) = LOWER(:login_id) 
           OR u.phone = :login_id 
           OR u.phone = :norm_phone
    """)
    user = db.execute(query, {"login_id": login_id, "norm_phone": norm_phone}).mappings().first()

    if not user or not verify_password(req.password, user["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Identifiants invalides",
        )

    return _token_response(db, dict(user), request)


@router.post("/register")
async def register(req: RegisterRequest, request: Request, db: Session = Depends(get_db)):
    display_name = req.name or req.full_name
    if not display_name:
        raise HTTPException(status_code=400, detail="Le nom est obligatoire.")
    hashed_password = get_password_hash(req.password)
    new_user_id = str(uuid.uuid4())
    new_role_id = str(uuid.uuid4())

    try:
        user_params = {
            "id": new_user_id,
            "name": display_name,
            "email": req.email,
            "password": hashed_password,
            "phone": req.phone,
            "location": req.location or "Cameroun",
        }

        # 1. Création de l'utilisateur avec ID explicite
        user_query = text("""
            INSERT INTO users (id, full_name, email, password_hash, phone, location, created_at)
            VALUES (:id, :name, :email, :password, :phone, :location, NOW())
            RETURNING id, full_name, email
        """)
        user_res = db.execute(user_query, user_params).mappings().first()

        # 2. Attribution du rôle avec ID explicite
        role = "buyer"
        role_query = text("""
            INSERT INTO user_roles (id, user_id, role, created_at)
            VALUES (:role_id, :user_id, CAST(:role AS user_role), NOW())
        """)
        db.execute(role_query, {
            "role_id": new_role_id,
            "user_id": user_res["id"],
            "role": role
        })
        
        db.commit()

        # 3. Génération de la réponse
        return _token_response(
            db,
            {
                "id": str(user_res["id"]),
                "email": user_res["email"],
                "full_name": user_res["full_name"],
                "role": role,
            },
            request,
        )
    except IntegrityError as e:
        db.rollback()
        error_msg = str(e.orig)
        if "users_email_key" in error_msg:
            raise HTTPException(
                status_code=400,
                detail="Cet e-mail est déjà utilisé par un autre compte.",
            )
        if "users_phone_key" in error_msg:
            raise HTTPException(
                status_code=400, detail="Ce numéro de téléphone est déjà utilisé."
            )
        raise HTTPException(status_code=400, detail="Erreur d'intégrité des données.")
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        # Diagnostic TRES VISIBLE pour la console Render
        print("\n" + "="*50)
        print(f"!!! CRITICAL REGISTER ERROR !!!")
        print(f"Détail: {str(e)}")
        print("="*50 + "\n")
        raise HTTPException(status_code=500, detail=f"Erreur technique : {str(e)}")


@router.post("/refresh")
async def refresh_tokens(req: RefreshRequest, db: Session = Depends(get_db)):
    """Renouvelle l'access token avec un refresh token valide."""
    result = refresh_session_tokens(db, req.refresh_token)
    if not result:
        raise HTTPException(status_code=401, detail="Session invalide ou expirée")
    db.commit()
    return {
        "access_token": result["access_token"],
        "refresh_token": result["refresh_token"],
        "session_id": result["session_id"],
        "token_type": "bearer",
        "user": result.get("user"),
    }


@router.post("/logout")
async def logout(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Déconnecte la session courante."""
    session_id = current_user.get("session_id")
    user_id = current_user["id"]
    if session_id:
        revoke_session(db, str(session_id), str(user_id))
    db.commit()
    return {"success": True, "message": "Déconnexion effectuée"}


@router.get("/sessions")
async def get_sessions(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Liste les sessions de connexion actives."""
    sessions = list_user_sessions(db, current_user["id"])
    current_sid = current_user.get("session_id")
    for s in sessions:
        s["is_current"] = s["id"] == current_sid
    return sessions


@router.delete("/sessions/{session_id}")
async def delete_session(
    session_id: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Révoque une session (autre appareil)."""
    ok = revoke_session(db, session_id, current_user["id"])
    if not ok:
        raise HTTPException(status_code=404, detail="Session introuvable")
    db.commit()
    return {"success": True}


@router.post("/logout-all")
async def logout_all_devices(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Déconnecte tous les appareils sauf la session actuelle."""
    count = revoke_all_sessions(
        db, current_user["id"], except_session_id=current_user.get("session_id")
    )
    db.commit()
    return {"success": True, "revoked_count": count}


@router.get("/me")
async def get_me(
    current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)
):
    user_id = current_user["id"]
    query = text("""
        SELECT u.id, u.full_name as name, u.email, u.phone, u.location as city,
               u.description, u.avatar_url, u.created_at, u.is_verified,
               u.lat, u.lng,
               r.role as base_role, u.managed_by_id,
               s.name as shop_name, s.logo_url as shop_logo, s.banner_url as shop_banner,
               m.full_name as managed_by_name
        FROM users u
        LEFT JOIN user_roles r ON u.id = r.user_id
        LEFT JOIN shops s ON u.id = s.seller_id
        LEFT JOIN users m ON u.managed_by_id = m.id
        WHERE u.id = :user_id
    """)
    result = db.execute(query, {"user_id": user_id}).mappings().first()
    if result:
        user_data = dict(result)
        user_data["id"] = str(user_data["id"])
        
        # Récupérer tous les rôles autorisés (pour permettre le changement de mode)
        granted_res = db.execute(
            text("SELECT role::text FROM user_roles WHERE user_id = :u_id"),
            {"u_id": user_id}
        ).scalars().all()
        # On s'assure que 'buyer' est toujours présent dans les rôles accordés
        all_roles = set(granted_res) if granted_res else set()
        all_roles.add("buyer")
        user_data["granted_roles"] = list(all_roles)
        
        # Coordonnées (fixer si null)
        user_data["lat"] = float(user_data["lat"]) if user_data.get("lat") is not None else None
        user_data["lng"] = float(user_data["lng"]) if user_data.get("lng") is not None else None

        # Inclure le rôle actuel du Token (session)
        user_data["role"] = current_user.get("role", "buyer") 
        if user_data.get("managed_by_id"):
            user_data["managed_by_id"] = str(user_data["managed_by_id"])
        return user_data
class ProfileUpdate(BaseModel):
    name: Optional[str] = None
    full_name: Optional[str] = None
    city: Optional[str] = None
    description: Optional[str] = None
    phone: Optional[str] = None
    avatar_url: Optional[str] = None

@router.put("/me")
@router.patch("/me")  # Alias pour compatibilité
async def update_me(
    req: ProfileUpdate, 
    current_user: dict = Depends(get_current_user), 
    db: Session = Depends(get_db)
):
    """Met à jour les informations du profil utilisateur."""
    user_id = current_user["id"]
    fields = []
    params = {"u_id": user_id}
    
    if req.name is not None or req.full_name is not None:
        fields.append("full_name = :name")
        params["name"] = req.name or req.full_name
    if req.city is not None:
        fields.append("location = :city")
        params["city"] = req.city
    if req.description is not None:
        fields.append("description = :desc")
        params["desc"] = req.description
    if req.phone is not None:
        fields.append("phone = :phone")
        params["phone"] = req.phone
    if req.avatar_url is not None:
        fields.append("avatar_url = :avatar")
        params["avatar"] = req.avatar_url
        
    if not fields:
        return {"success": True, "message": "Aucun changement"}

    try:
        query = text(f"UPDATE users SET {', '.join(fields)}, updated_at = NOW() WHERE id = CAST(:u_id AS uuid)")
        db.execute(query, params)
        db.commit()
        return {"success": True, "message": "Profil mis à jour"}
    except Exception as e:
        db.rollback()
        print(f"Update Profile Error: {e}")
        raise HTTPException(status_code=500, detail="Erreur lors de la mise à jour du profil")


@router.post("/request-role")
async def request_role(
    req: RoleRequestBody,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Demande d'ajout de rôle (vendeur / livreur) — validation admin requise."""
    user_id = current_user["id"]
    role = req.requested_role
    if role not in ("seller", "deliverer"):
        raise HTTPException(status_code=400, detail="Rôle demandé invalide")
    try:
        pending = db.execute(
            text(
                "SELECT id FROM role_requests WHERE user_id = :u AND requested_role = :r AND status = 'pending'"
            ),
            {"u": user_id, "r": role},
        ).mappings().first()
        if pending:
            return {"success": True, "message": "Demande déjà en attente"}

        result = db.execute(
            text("""
                INSERT INTO role_requests (user_id, requested_role, status, created_at)
                VALUES (:u_id, :role, 'pending', NOW())
                RETURNING id
            """),
            {"u_id": user_id, "role": role},
        ).mappings().first()
        db.commit()
        return {"success": True, "id": str(result["id"])}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail="Erreur lors de la demande de rôle")


@router.get("/role-requests/me")
async def get_my_role_requests(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Récupère les demandes de changement de rôle de l'utilisateur actuel."""
    user_id = current_user["id"]
    try:
        query = text("""
            SELECT id, requested_role, status, note, created_at, updated_at
            FROM role_requests
            WHERE user_id = CAST(:u_id AS uuid)
            ORDER BY created_at DESC
        """)
        results = db.execute(query, {"u_id": str(user_id)}).mappings().all()
        return results
    except Exception as e:
        print(f"Error fetching role requests: {e}")
        raise HTTPException(status_code=500, detail="Erreur lors de la récupération des demandes.")


@router.post("/verify-profile")
async def verify_profile(
    req: KYCSubmission,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Soumet les documents d'identité pour vérification admin."""
    user_id = current_user["id"]
    try:
        db.execute(
            text("""
                UPDATE users 
                SET id_card_url = :id_card, 
                    selfie_url = :selfie, 
                    verification_submitted_at = NOW() 
                WHERE id = CAST(:u_id AS uuid)
            """),
            {
                "id_card": req.id_card_url,
                "selfie": req.selfie_url,
                "u_id": str(user_id)
            }
        )
        db.commit()
        return {"success": True, "message": "Documents soumis pour analyse."}
    except Exception as e:
        db.rollback()
        print(f"KYC Submit Error: {e}")
        raise HTTPException(status_code=500, detail="Erreur lors de la soumission KYC")


@router.post("/switch-role")
async def switch_role(
    req: SwitchRoleRequest,
    request: Request,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user_id = current_user.get("id")
    target_role = req.new_role

    if not user_id:
        raise HTTPException(status_code=401, detail="User ID non trouvé dans le token")

    if target_role not in ("buyer", "seller", "deliverer"):
        raise HTTPException(status_code=400, detail=f"Rôle '{target_role}' invalide")

    try:
        # Sécurité : Récupérer TOUS les rôles actuels de l'utilisateur
        all_db_roles = db.execute(
            text("SELECT role::text FROM user_roles WHERE user_id = CAST(:u_id AS uuid)"),
            {"u_id": user_id}
        ).scalars().all()

        # Sécurité : Bloquer toute tentative d'escalade vers admin
        is_admin = "admin" in all_db_roles
        
        if target_role == "admin" and not is_admin:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Le rôle administrateur ne peut pas être activé sans droits préalables."
            )

        # Si la cible est un rôle professionnel, vérifier l'autorisation (SAUF pour les admins qui ont tout les droits)
        if not is_admin and target_role != "buyer" and target_role not in all_db_roles:
            check_approval = db.execute(
                text("SELECT 1 FROM role_requests WHERE user_id = CAST(:u_id AS uuid) AND requested_role = :role AND status = 'approved'"),
                {"u_id": user_id, "role": target_role}
            ).scalar()

            if not check_approval:
                raise HTTPException(
                    status_code=403,
                    detail=f"Vous n'avez pas l'autorisation d'utiliser le rôle {target_role}. Une validation administrative est requise."
                )

        # On s'assure que le rôle est inscrit dans user_roles (sans écraser les autres)
        db.execute(
            text("INSERT INTO user_roles (user_id, role) VALUES (CAST(:u_id AS uuid), CAST(:role AS user_role)) ON CONFLICT (user_id, role) DO NOTHING"),
            {"role": target_role, "u_id": user_id}
        )

        db.commit()
        
        # On récupère les infos complètes de l'utilisateur pour générer un nouveau token
        user_query = text("SELECT * FROM users WHERE id = :id")
        user = db.execute(user_query, {"id": user_id}).mappings().first()
        
        # On injecte le nouveau rôle car user_roles a été mis à jour mais user ne le contient pas forcément dans le mapping direct si on a fait un join partiel
        user_dict = dict(user)
        user_dict["role"] = target_role
        
        return _token_response(db, user_dict, request)
    except Exception as e:
        db.rollback()
        print(f"Error switching role for user {user_id}: {e}")
        raise HTTPException(status_code=500, detail="Erreur lors du changement de rôle.")


class FcmTokenRequest(BaseModel):
    token: str


@router.post("/save-fcm-token")
async def save_fcm_token(
    req: FcmTokenRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Enregistre le token FCM si la colonne existe en base."""
    try:
        db.execute(
            text("UPDATE users SET fcm_token = :token WHERE id = :id"),
            {"token": req.token, "id": current_user["id"]},
        )
        db.commit()
        return {"success": True}
    except Exception:
        db.rollback()
        return {"success": False, "detail": "Colonne fcm_token absente ou erreur SQL"}


class LinkDelivererRequest(BaseModel):
    seller_id: str


@router.post("/link-deliverer")
async def link_deliverer(
    req: LinkDelivererRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user_id = current_user["id"]
    try:
        # On vérifie si l'ID vendeur existe vraiment
        seller = db.execute(
            text("SELECT u.id FROM users u JOIN user_roles r ON u.id = r.user_id WHERE u.id = CAST(:s_id AS uuid) AND r.role = 'seller'"),
            {"s_id": req.seller_id}
        ).mappings().first()

        if not seller:
            raise HTTPException(status_code=404, detail="ID Vendeur invalide ou ce vendeur n'existe pas.")

        db.execute(
            text("UPDATE users SET managed_by_id = CAST(:s_id AS uuid) WHERE id = CAST(:u_id AS uuid)"),
            {"s_id": req.seller_id, "u_id": user_id},
        )
        db.commit()
        return {"success": True, "message": "Vous êtes maintenant lié à ce vendeur."}
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        print(f"LINK ERROR: {e}")
        raise HTTPException(status_code=500, detail="Erreur lors de la liaison au vendeur.")


class LocationUpdate(BaseModel):
    lat: float
    lng: float

@router.post("/update-location")
async def update_location(
    req: LocationUpdate,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        db.execute(
            text("UPDATE users SET lat = :lat, lng = :lng, updated_at = NOW() WHERE id = :id"),
            {"lat": req.lat, "lng": req.lng, "id": current_user["id"]}
        )
        db.commit()
        return {"success": True}
    except Exception as e:
        db.rollback()
        print(f"Location update error: {e}")
        return {"success": False}
