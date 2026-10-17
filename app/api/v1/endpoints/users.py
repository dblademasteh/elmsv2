"""User endpoints"""
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from app.schemas.user import UserResponse
from app.crud.user import get_user_by_id
from app.db.database import get_db
from app.core.security import decode_token
import uuid

router = APIRouter()
bearer = HTTPBearer(auto_error=False)

@router.get("/me", response_model=UserResponse)
async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(bearer), db: get_db = Depends()):
    unauthorized = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    payload = decode_token(credentials.credentials) if credentials else None
    if not payload or payload.get("type") != "access":
        raise unauthorized
    try:
        user_id = uuid.UUID(payload.get("sub", ""))
    except (ValueError, TypeError, AttributeError):
        raise unauthorized
    user = await get_user_by_id(db, user_id)
    if not user or not user.is_active:
        raise unauthorized
    
    return UserResponse(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        role=user.role,
        is_verified=user.is_verified,
        is_active=user.is_active,
        created_at=user.created_at
    )
