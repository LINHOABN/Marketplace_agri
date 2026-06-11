from typing import Optional
from jose import JWTError, jwt
from sqlalchemy.orm import Session
import os
from dotenv import load_dotenv
from database import get_db
from services.sessions import is_session_active
from fastapi import Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordBearer

load_dotenv()

SECRET_KEY = os.getenv("JWT_SECRET", "supersecretkey123")
ALGORITHM = os.getenv("ALGORITHM", "HS256")

# Indique à FastAPI où trouver le token dans la doc Swagger.
# On met auto_error=False pour gérer l'erreur nous-mêmes dans get_current_user
# et permettre le fallback sur le paramètre 'token' de l'URL.
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login", auto_error=False)
oauth2_scheme_optional = OAuth2PasswordBearer(tokenUrl="auth/login", auto_error=False)

async def get_current_user(
    request: Request,
    token_header: Optional[str] = Depends(oauth2_scheme_optional),
    db: Session = Depends(get_db),
):
    """
    Récupère l'utilisateur actuel via le token JWT (Header ou URL).
    """
    token = token_header
    
    # Fallback sur le paramètre 'token' de l'URL si pas de header
    if not token:
        token = request.query_params.get("token")

    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Token invalide ou expiré.",
        headers={"WWW-Authenticate": "Bearer"},
    )

    if not token:
        raise credentials_exception

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("id")
        if user_id is None:
            raise credentials_exception

        session_id = payload.get("session_id")
        if session_id and not is_session_active(db, str(session_id), str(user_id)):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Session expirée ou déconnectée. Reconnectez-vous.",
                headers={"WWW-Authenticate": "Bearer"},
            )

        return payload

    except JWTError:
        raise credentials_exception

async def get_optional_user(
    request: Request,
    token_header: Optional[str] = Depends(oauth2_scheme_optional),
    db: Session = Depends(get_db)
) -> Optional[dict]:
    """Version optionnelle (IA, flux publics)."""
    try:
        # On tente de récupérer le token
        token = token_header or request.query_params.get("token")
        if not token:
            return None
        
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("id")
        if user_id is None:
            return None
            
        session_id = payload.get("session_id")
        if session_id and not is_session_active(db, str(session_id), str(user_id)):
            return None
            
        return payload
    except JWTError:
        return None

# ─── NOUVELLES DÉPENDANCES DE RÔLES ───────────────────────────────────────────

async def get_db_authorized_roles(user_id: str, db: Session):
    from sqlalchemy import text
    query = text("SELECT role::text as role FROM user_roles WHERE user_id = CAST(:u_id AS uuid)")
    result = db.execute(query, {"u_id": user_id}).mappings().all()
    roles = [r["role"] for r in result]
    if not roles:
        roles = ["buyer"]
    return roles

async def get_db_user_role(user_id: str, db: Session) -> str:
    """Retourne le rôle principal d'un utilisateur depuis la BD (sans lever d'exception)."""
    from sqlalchemy import text
    row = db.execute(
        text("SELECT role::text FROM user_roles WHERE user_id = CAST(:u_id AS uuid) LIMIT 1"),
        {"u_id": str(user_id)}
    ).scalar()
    return row if row else "buyer"

async def is_seller(current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    authorized_roles = await get_db_authorized_roles(current_user["id"], db)
    if "seller" not in authorized_roles:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Accès réservé aux vendeurs.")
    return current_user

async def is_deliverer(current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    authorized_roles = await get_db_authorized_roles(current_user["id"], db)
    if "deliverer" not in authorized_roles:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Accès réservé aux livreurs.")
    return current_user

async def is_admin(current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    authorized_roles = await get_db_authorized_roles(current_user["id"], db)
    if "admin" not in authorized_roles:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Accès réservé aux admins.")
    return current_user
