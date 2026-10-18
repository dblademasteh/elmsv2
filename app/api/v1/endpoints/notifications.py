"""Notification endpoints"""
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.db.database import get_db
from app.api.v1.endpoints.users import get_current_user_from_token
from app.crud import notification as notification_crud
from app.models.user import User

router = APIRouter()
bearer = HTTPBearer(auto_error=False)


async def _get_current_user(credentials: HTTPAuthorizationCredentials, db) -> User:
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return await get_current_user_from_token(credentials, db)


@router.get("/")
async def list_notifications(
    unread_only: bool = False,
    skip: int = 0,
    limit: int = 50,
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db: get_db = Depends(),
):
    """List the current user's notifications with an unread count."""
    user = await _get_current_user(credentials, db)
    rows = await notification_crud.list_for_user(
        db, user.id, unread_only=unread_only, skip=skip, limit=limit
    )
    return {
        "unread_count": await notification_crud.unread_count(db, user.id),
        "notifications": [
            {
                "id": str(n.id),
                "type": n.type,
                "title": n.title,
                "body": n.body,
                "link_url": n.link_url,
                "read_at": n.read_at.isoformat() if n.read_at else None,
                "created_at": n.created_at.isoformat() if n.created_at else None,
            }
            for n in rows
        ],
    }


@router.post("/read-all")
async def read_all_notifications(
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db: get_db = Depends(),
):
    """Mark all of the current user's notifications as read."""
    user = await _get_current_user(credentials, db)
    updated = await notification_crud.mark_all_read(db, user.id)
    return {"message": f"Marked {updated} notifications as read"}


@router.post("/{notification_id}/read")
async def read_notification(
    notification_id: uuid.UUID,
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db: get_db = Depends(),
):
    """Mark a single notification as read."""
    user = await _get_current_user(credentials, db)
    notification = await notification_crud.mark_read(db, notification_id, user.id)
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")
    return {
        "message": "Notification marked as read",
        "notification_id": str(notification.id),
    }
