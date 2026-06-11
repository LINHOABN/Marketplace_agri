from fastapi import APIRouter, Depends, UploadFile, File, HTTPException

from dependencies import get_current_user
from utils.upload_service import save_uploaded_file

router = APIRouter(prefix="/media", tags=["media"])


@router.post("/upload")
async def upload_file(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
):
    try:
        url = await save_uploaded_file(file, prefix="media")
        return {"url": url}
    except Exception as e:
        print(f"Upload error: {e}")
        raise HTTPException(status_code=500, detail="Erreur lors de l'upload du fichier")
