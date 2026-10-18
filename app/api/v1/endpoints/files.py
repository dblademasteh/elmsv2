"""File upload endpoints (assignment submissions, course assets)"""
import os
import uuid
from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from app.core.config import settings
from app.db.database import get_db
from app.api.v1.endpoints.users import get_current_user_from_token

router = APIRouter()
bearer = HTTPBearer(auto_error=False)

# Allowlist of uploadable extensions (lowercase, with dot)
ALLOWED_EXTENSIONS = {
    ".pdf", ".doc", ".docx", ".ppt", ".pptx", ".xls", ".xlsx",
    ".txt", ".md", ".csv", ".json",
    ".png", ".jpg", ".jpeg", ".gif", ".webp",
    ".zip",
}

_CHUNK_SIZE = 1024 * 1024  # 1 MB


def get_upload_root() -> str:
    """Absolute path of the upload directory (created on demand)."""
    path = os.path.abspath(settings.UPLOAD_DIR)
    os.makedirs(path, exist_ok=True)
    return path


@router.post("/upload", response_model=dict, status_code=status.HTTP_201_CREATED)
async def upload_file(
    request: Request,
    file: UploadFile = File(...),
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db=Depends(get_db),
):
    """Upload a file and return its stored URL (any authenticated user)."""
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
    await get_current_user_from_token(credentials, db)

    original_name = file.filename or "file"
    extension = os.path.splitext(original_name)[1].lower()
    if extension not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File type '{extension or 'unknown'}' is not allowed. "
                   f"Allowed types: {', '.join(sorted(ALLOWED_EXTENSIONS))}",
        )

    max_bytes = settings.MAX_UPLOAD_MB * 1024 * 1024
    stored_name = f"{uuid.uuid4().hex}{extension}"
    destination = os.path.join(get_upload_root(), stored_name)

    size = 0
    try:
        with open(destination, "wb") as out:
            while chunk := await file.read(_CHUNK_SIZE):
                size += len(chunk)
                if size > max_bytes:
                    raise HTTPException(
                        status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                        detail=f"File exceeds the {settings.MAX_UPLOAD_MB} MB limit",
                    )
                out.write(chunk)
    except HTTPException:
        if os.path.exists(destination):
            os.remove(destination)
        raise
    finally:
        await file.close()

    if size == 0:
        if os.path.exists(destination):
            os.remove(destination)
        raise HTTPException(status_code=400, detail="Uploaded file is empty")

    base_url = str(request.base_url).rstrip("/")
    return {
        "file_url": f"{base_url}/uploads/{stored_name}",
        "file_name": original_name,
        "file_size_bytes": size,
        "content_type": file.content_type,
    }
