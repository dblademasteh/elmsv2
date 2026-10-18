"""Authentication endpoints"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from app.schemas.auth import (
    Token,
    LoginRequest,
    RegisterRequest,
    RefreshTokenRequest,
    LogoutRequest,
    PasswordResetRequest,
    PasswordResetConfirm,
)
from app.schemas.user import UserResponse
from app.core import security
from app.core.security import get_password_hash
from app.core.config import settings
from app.db.database import get_db
from app.crud.user import get_user_by_email, get_user_by_id, create_user
from app.models.password_reset import PasswordResetToken
from datetime import datetime, timedelta
import hashlib
import secrets
import uuid

router = APIRouter()

MAX_FAILED_ATTEMPTS = 5
LOCKOUT_MINUTES = 15
RESET_TOKEN_EXPIRE_MINUTES = 60


@router.post("/register", response_model=UserResponse)
async def register(user_in: RegisterRequest, db: get_db = Depends()):
    user = await get_user_by_email(db, user_in.email)
    if user:
        raise HTTPException(status_code=400, detail="Email already registered")

    new_user = await create_user(
        db,
        email=user_in.email,
        full_name=user_in.full_name,
        password=user_in.password
    )

    return UserResponse(
        id=new_user.id,
        email=new_user.email,
        full_name=new_user.full_name,
        role=new_user.role,
        is_verified=new_user.is_verified,
        is_active=new_user.is_active,
        created_at=new_user.created_at
    )

@router.post("/login", response_model=Token)
async def login(form_data: LoginRequest, db: get_db = Depends()):
    user = await get_user_by_email(db, form_data.email)
    now = datetime.utcnow()

    if user and user.locked_until and user.locked_until > now:
        minutes = max(1, int((user.locked_until - now).total_seconds() // 60) + 1)
        raise HTTPException(
            status_code=status.HTTP_423_LOCKED,
            detail=f"Account temporarily locked after repeated failed logins. Try again in ~{minutes} min.",
        )

    if not user or not security.verify_password(form_data.password, user.hashed_password):
        if user:
            user.failed_login_attempts = (user.failed_login_attempts or 0) + 1
            if user.failed_login_attempts >= MAX_FAILED_ATTEMPTS:
                user.locked_until = now + timedelta(minutes=LOCKOUT_MINUTES)
                user.failed_login_attempts = 0
                await db.commit()
                raise HTTPException(
                    status_code=status.HTTP_423_LOCKED,
                    detail=f"Account temporarily locked after {MAX_FAILED_ATTEMPTS} failed logins. Try again later.",
                )
            await db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password"
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password"
        )

    user.failed_login_attempts = 0
    user.locked_until = None
    await db.commit()

    access_token = security.create_access_token(
        data={"sub": str(user.id), "email": user.email, "role": user.role},
        expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    refresh_token = security.create_refresh_token(
        data={"sub": str(user.id)}
    )

    return Token(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer"
    )


@router.post("/reset-password", response_model=dict)
async def request_password_reset(body: PasswordResetRequest, db: get_db = Depends()):
    """Request a password reset. Responses do not reveal whether the email exists."""
    user = await get_user_by_email(db, body.email)
    response = {
        "message": "If an account with that email exists, a reset link has been sent."
    }
    if user:
        token = secrets.token_urlsafe(32)
        db.add(
            PasswordResetToken(
                user_id=user.id,
                token_hash=hashlib.sha256(token.encode()).hexdigest(),
                expires_at=datetime.utcnow() + timedelta(minutes=RESET_TOKEN_EXPIRE_MINUTES),
            )
        )
        await db.commit()
        if settings.ENVIRONMENT == "development":
            # No email service is configured; return the token inline in dev only.
            response["reset_token"] = token
    return response


@router.post("/reset-password/confirm", response_model=dict)
async def confirm_password_reset(body: PasswordResetConfirm, db: get_db = Depends()):
    """Reset the password using a token from /reset-password."""
    token_hash = hashlib.sha256(body.token.encode()).hexdigest()
    result = await db.execute(
        select(PasswordResetToken).where(
            PasswordResetToken.token_hash == token_hash,
            PasswordResetToken.used_at.is_(None),
            PasswordResetToken.expires_at > datetime.utcnow(),
        )
    )
    reset_row = result.scalar_one_or_none()
    if not reset_row:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired reset token",
        )

    user = await get_user_by_id(db, reset_row.user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired reset token",
        )

    user.hashed_password = get_password_hash(body.new_password)
    user.failed_login_attempts = 0
    user.locked_until = None
    reset_row.used_at = datetime.utcnow()
    await db.commit()
    return {"message": "Password updated successfully. You can now sign in."}

@router.post("/refresh", response_model=Token)
async def refresh_access_token(refresh_in: RefreshTokenRequest, db: get_db = Depends()):
    """Exchange a valid refresh token for a new access + refresh token pair."""
    payload = security.decode_token(refresh_in.refresh_token)
    if not payload or payload.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
        )

    try:
        user_id = uuid.UUID(payload.get("sub", ""))
    except (ValueError, TypeError, AttributeError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
        )

    user = await get_user_by_id(db, user_id)
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
        )

    return Token(
        access_token=security.create_access_token(
            data={"sub": str(user.id), "email": user.email, "role": user.role},
            expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
        ),
        refresh_token=security.create_refresh_token(data={"sub": str(user.id)}),
        token_type="bearer",
    )

@router.post("/logout", response_model=dict)
async def logout(payload: LogoutRequest = None):
    """Log out. JWTs are stateless, so the client discards its tokens; the
    refresh token (if provided) is simply no longer used."""
    return {"message": "Logged out successfully"}
