"""
Service centralisé pour l'upload de fichiers (Vercel Blob ou dossier local en secours).
"""
import asyncio
import os
import random
import time
from pathlib import Path
from typing import Optional

from fastapi import UploadFile

from utils.blob_storage import is_blob_configured, upload_bytes_to_blob

BASE_DIR = Path(__file__).resolve().parent.parent
UPLOAD_DIR = BASE_DIR / "uploads"

CONTENT_TYPE_EXTENSIONS = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
    "video/mp4": ".mp4",
    "video/webm": ".webm",
    "audio/webm": ".webm",
    "audio/mpeg": ".mp3",
    "audio/ogg": ".ogg",
    "audio/wav": ".wav",
}


def guess_extension(filename: Optional[str], content_type: Optional[str]) -> str:
    ext = os.path.splitext(filename or "")[1].lower()
    if ext:
        return ext
    if content_type:
        for mime, guessed in CONTENT_TYPE_EXTENSIONS.items():
            if mime in content_type:
                return guessed
    return ".bin"


def make_filename(prefix: str, ext: str) -> str:
    return f"{prefix}-{int(time.time())}-{random.randint(1, 10**9)}{ext}"


async def save_uploaded_file(file: UploadFile, prefix: str = "media") -> str:
    """Lit le fichier uploadé et retourne une URL publique (Blob) ou relative (/uploads/)."""
    content = await file.read()
    ext = guess_extension(file.filename, file.content_type)
    filename = make_filename(prefix, ext)
    return await save_bytes(content, filename, file.content_type, prefix=prefix)


async def save_bytes(
    content: bytes,
    filename: str,
    content_type: Optional[str] = None,
    prefix: str = "media",
) -> str:
    if is_blob_configured():
        pathname = f"agrimarche/{prefix}/{filename}"
        return await asyncio.to_thread(
            upload_bytes_to_blob,
            content,
            pathname,
            content_type,
        )

    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    filepath = UPLOAD_DIR / filename
    filepath.write_bytes(content)
    return f"/uploads/{filename}"
