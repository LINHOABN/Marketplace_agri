"""
Stockage objet via Vercel Blob (API REST).
Configurez BLOB_READ_WRITE_TOKEN dans .env (depuis le dashboard Vercel > Storage > Blob).
"""
import os
from typing import Optional

import httpx

BLOB_READ_WRITE_TOKEN = os.getenv("BLOB_READ_WRITE_TOKEN", "")
BLOB_API_BASE = "https://blob.vercel-storage.com"
BLOB_API_VERSION = "7"
DEFAULT_TIMEOUT = 120.0


def is_blob_configured() -> bool:
    return bool(BLOB_READ_WRITE_TOKEN)


def upload_bytes_to_blob(
    data: bytes,
    pathname: str,
    content_type: Optional[str] = None,
) -> str:
    """Upload vers Vercel Blob. Retourne l'URL publique HTTPS."""
    if not is_blob_configured():
        raise RuntimeError("BLOB_READ_WRITE_TOKEN non configuré")

    headers = {
        "authorization": f"Bearer {BLOB_READ_WRITE_TOKEN}",
        "x-api-version": BLOB_API_VERSION,
        "access": "public",
        "x-add-random-suffix": "1",
    }
    if content_type:
        headers["x-content-type"] = content_type

    url = f"{BLOB_API_BASE}/{pathname.lstrip('/')}"

    with httpx.Client(timeout=DEFAULT_TIMEOUT) as client:
        response = client.put(url, headers=headers, content=data)
        response.raise_for_status()
        result = response.json()

    blob_url = result.get("url")
    if not blob_url:
        raise RuntimeError("Réponse Vercel Blob invalide : URL manquante")
    return blob_url
