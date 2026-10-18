"""User endpoints"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from app.schemas.user import UserResponse, UserUpdate
from app.crud.user import get_user_by_id, get_users, get_user_count, update_user
from app.db.database import get_db
from app.core.security import decode_token, get_password_hash
from typing import List, Optional
import uuid

router = APIRouter()
bearer = HTTPBearer(auto_error=False)


async def get_current_user_from_token(
    credentials: HTTPAuthorizationCredentials,
    db,
):
    """Shared helper: resolve the authenticated user or raise 401."""
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
    return user


@router.get("/me", response_model=UserResponse)
async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db: get_db = Depends(),
):
    user = await get_current_user_from_token(credentials, db)

    return UserResponse(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        role=user.role,
        is_verified=user.is_verified,
        is_active=user.is_active,
        created_at=user.created_at,
    )


@router.put("/me", response_model=UserResponse)
async def update_current_user(
    user_in: UserUpdate,
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db: get_db = Depends(),
):
    """Update the current user's profile (full_name, avatar_url, password)."""
    user = await get_current_user_from_token(credentials, db)

    update_data = {}
    if user_in.full_name is not None:
        update_data["full_name"] = user_in.full_name
    if user_in.avatar_url is not None:
        update_data["avatar_url"] = user_in.avatar_url

    # Handle password change separately
    if user_in.password:
        update_data["hashed_password"] = get_password_hash(user_in.password)

    if not update_data:
        return user

    updated = await update_user(db, user.id, **update_data)
    if not updated:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    return UserResponse(
        id=updated.id,
        email=updated.email,
        full_name=updated.full_name,
        role=updated.role,
        is_verified=updated.is_verified,
        is_active=updated.is_active,
        created_at=updated.created_at,
    )


@router.get("/", response_model=List[UserResponse])
async def list_users(
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1, le=100),
    role: Optional[str] = Query(default=None),
    is_active: Optional[bool] = Query(default=None),
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db: get_db = Depends(),
):
    """List all users (admin only)."""
    user = await get_current_user_from_token(credentials, db)
    if user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can list users",
        )

    users = await get_users(db, skip=skip, limit=limit, role=role, is_active=is_active)
    return [
        UserResponse(
            id=u.id,
            email=u.email,
            full_name=u.full_name,
            role=u.role,
            is_verified=u.is_verified,
            is_active=u.is_active,
            created_at=u.created_at,
        )
        for u in users
    ]


@router.get("/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: uuid.UUID,
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db: get_db = Depends(),
):
    """Get a specific user by ID (admin only)."""
    user = await get_current_user_from_token(credentials, db)
    if user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can view user details",
        )

    target = await get_user_by_id(db, user_id)
    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    return UserResponse(
        id=target.id,
        email=target.email,
        full_name=target.full_name,
        role=target.role,
        is_verified=target.is_verified,
        is_active=target.is_active,
        created_at=target.created_at,
    )


@router.put("/{user_id}", response_model=UserResponse)
async def update_user_endpoint(
    user_id: uuid.UUID,
    user_in: UserUpdate,
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db: get_db = Depends(),
):
    """Update a user (admin only)."""
    user = await get_current_user_from_token(credentials, db)
    if user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can update users",
        )

    target = await get_user_by_id(db, user_id)
    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    update_data = {}
    if user_in.full_name is not None:
        update_data["full_name"] = user_in.full_name
    if user_in.avatar_url is not None:
        update_data["avatar_url"] = user_in.avatar_url
    if user_in.password:
        update_data["hashed_password"] = get_password_hash(user_in.password)
    if user_in.role is not None:
        update_data["role"] = user_in.role
    if user_in.is_active is not None:
        update_data["is_active"] = user_in.is_active
    if user_in.is_verified is not None:
        update_data["is_verified"] = user_in.is_verified

    if update_data:
        updated = await update_user(db, user_id, **update_data)
    else:
        updated = target

    return UserResponse(
        id=updated.id,
        email=updated.email,
        full_name=updated.full_name,
        role=updated.role,
        is_verified=updated.is_verified,
        is_active=updated.is_active,
        created_at=updated.created_at,
    )
