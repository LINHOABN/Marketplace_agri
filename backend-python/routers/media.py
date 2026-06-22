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
        import traceback
        print(f"!!! UPLOAD ERROR !!!")
        print(f"Exception: {str(e)}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Erreur lors de l'upload : {str(e)}")
