"""Gestion des sessions utilisateur (connexions persistantes)."""
import uuid
from datetime import datetime, timedelta
from typing import Optional

from sqlalchemy import text
from sqlalchemy.orm import Session

from utils.security import (
    REFRESH_TOKEN_EXPIRE_DAYS,
    create_access_token,
    create_refresh_token,
    hash_token,
)

REFRESH_EXPIRE = timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)


def _device_label(user_agent: Optional[str]) -> str:
    if not user_agent:
        return "Appareil inconnu"
    ua = user_agent.lower()
    if "mobile" in ua or "android" in ua or "iphone" in ua:
        if "chrome" in ua:
            return "Mobile — Chrome"
        if "safari" in ua:
            return "Mobile — Safari"
        return "Téléphone / tablette"
    if "firefox" in ua:
        return "Navigateur — Firefox"
    if "edg" in ua:
        return "Navigateur — Edge"
    if "chrome" in ua:
        return "Navigateur — Chrome"
    return "Navigateur web"


def create_user_session(
    db: Session,
    user_id: str,
    email: str,
    role: str,
    *,
    user_agent: Optional[str] = None,
    ip_address: Optional[str] = None,
) -> dict:
    """Crée une session BDD + tokens JWT."""
    session_id = str(uuid.uuid4())
    refresh_plain = create_refresh_token()
    refresh_hash = hash_token(refresh_plain)
    expires_at = datetime.utcnow() + REFRESH_EXPIRE
    label = _device_label(user_agent)

    db.execute(
        text("""
            INSERT INTO user_sessions (
                id, user_id, refresh_token_hash, device_label,
                ip_address, user_agent, is_revoked, created_at, expires_at, last_used_at
            )
            VALUES (
                CAST(:id AS uuid), CAST(:uid AS uuid), :hash, :label,
                :ip, :ua, FALSE, NOW(), :exp, NOW()
            )
        """),
        {
            "id": session_id,
            "uid": user_id,
            "hash": refresh_hash,
            "label": label,
            "ip": ip_address,
            "ua": user_agent,
            "exp": expires_at,
        },
    )

    access_token = create_access_token(
        data={"id": user_id, "email": email, "role": role, "session_id": session_id}
    )

    return {
        "access_token": access_token,
        "refresh_token": refresh_plain,
        "session_id": session_id,
        "expires_at": expires_at.isoformat(),
        "device_label": label,
    }


def refresh_session_tokens(db: Session, refresh_token_plain: str) -> Optional[dict]:
    """Renouvelle l'access token si le refresh est valide."""
    token_hash = hash_token(refresh_token_plain)
    row = db.execute(
        text("""
            SELECT s.id, s.user_id, s.expires_at, s.is_revoked,
                   u.email, r.role
            FROM user_sessions s
            JOIN users u ON s.user_id = u.id
            LEFT JOIN user_roles r ON u.id = r.user_id
            WHERE s.refresh_token_hash = :hash
        """),
        {"hash": token_hash},
    ).mappings().first()

    if not row or row["is_revoked"]:
        return None
    if row["expires_at"] and row["expires_at"] < datetime.utcnow():
        return None

    user_id = str(row["user_id"])
    session_id = str(row["id"])
    email = str(row["email"])
    role = str(row["role"]) if row["role"] else "buyer"

    db.execute(
        text("UPDATE user_sessions SET last_used_at = NOW() WHERE id = CAST(:id AS uuid)"),
        {"id": session_id},
    )

    access_token = create_access_token(
        data={"id": user_id, "email": email, "role": role, "session_id": session_id}
    )

    return {
        "access_token": access_token,
        "refresh_token": refresh_token_plain,
        "session_id": session_id,
        "user": {"id": user_id, "email": email, "role": role},
    }


def is_session_active(db: Session, session_id: str, user_id: str) -> bool:
    row = db.execute(
        text("""
            SELECT id FROM user_sessions
            WHERE id = CAST(:sid AS uuid)
              AND user_id = CAST(:uid AS uuid)
              AND is_revoked = FALSE
              AND expires_at > NOW()
        """),
        {"sid": session_id, "uid": user_id},
    ).mappings().first()
    return row is not None


def revoke_session(db: Session, session_id: str, user_id: str) -> bool:
    result = db.execute(
        text("""
            UPDATE user_sessions SET is_revoked = TRUE, last_used_at = NOW()
            WHERE id = CAST(:sid AS uuid) AND user_id = CAST(:uid AS uuid)
            RETURNING id
        """),
        {"sid": session_id, "uid": user_id},
    )
    return result.fetchone() is not None


def revoke_all_sessions(db: Session, user_id: str, except_session_id: Optional[str] = None) -> int:
    if except_session_id:
        result = db.execute(
            text("""
                UPDATE user_sessions SET is_revoked = TRUE
                WHERE user_id = CAST(:uid AS uuid)
                  AND id != CAST(:keep AS uuid)
                  AND is_revoked = FALSE
            """),
            {"uid": user_id, "keep": except_session_id},
        )
    else:
        result = db.execute(
            text("""
                UPDATE user_sessions SET is_revoked = TRUE
                WHERE user_id = CAST(:uid AS uuid) AND is_revoked = FALSE
            """),
            {"uid": user_id},
        )
    return result.rowcount


def list_user_sessions(db: Session, user_id: str) -> list:
    rows = db.execute(
        text("""
            SELECT id, device_label, ip_address, created_at, last_used_at,
                   expires_at, is_revoked,
                   (expires_at > NOW() AND is_revoked = FALSE) AS is_active
            FROM user_sessions
            WHERE user_id = CAST(:uid AS uuid)
            ORDER BY last_used_at DESC NULLS LAST, created_at DESC
        """),
        {"uid": user_id},
    ).mappings().all()
    out = []
    for r in rows:
        item = dict(r)
        item["id"] = str(item["id"])
        out.append(item)
    return out
