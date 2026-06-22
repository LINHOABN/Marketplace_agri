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
        "Authorization": f"Bearer {BLOB_READ_WRITE_TOKEN}",
        "x-api-version": BLOB_API_VERSION,
        "access": "public",
        "x-add-random-suffix": "1",
    }
    if content_type:
        # Simplification des types pour Vercel Blob
        if "jfif" in content_type.lower():
            headers["x-content-type"] = "image/jpeg"
        else:
            headers["x-content-type"] = content_type

    url = f"{BLOB_API_BASE}/{pathname.lstrip('/')}"

    with httpx.Client(timeout=DEFAULT_TIMEOUT) as client:
        response = client.put(url, headers=headers, content=data)
        if response.status_code != 200:
            print(f"!!! VERCEL BLOB ERROR {response.status_code} !!!")
            print(f"URL: {url}")
            print(f"Response: {response.text}")
            response.raise_for_status()
        result = response.json()

    blob_url = result.get("url")
    if not blob_url:
        raise RuntimeError(f"Réponse Vercel Blob invalide ({response.status_code}): {response.text}")
    return blob_url
