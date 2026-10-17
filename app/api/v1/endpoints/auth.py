"""Authentication endpoints"""
from fastapi import APIRouter, Depends, HTTPException, status
from app.schemas.auth import Token, LoginRequest, RegisterRequest, RefreshTokenRequest
from app.schemas.user import UserResponse
from app.core import security
from app.db.database import get_db
from app.crud.user import get_user_by_email, create_user
from datetime import timedelta

router = APIRouter()

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
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password"
        )
    
    if not security.verify_password(form_data.password, user.hashed_password) or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password"
        )
    
    access_token = security.create_access_token(
        data={"sub": str(user.id), "email": user.email, "role": user.role},
        expires_delta=timedelta(minutes=30)
    )
    refresh_token = security.create_refresh_token(
        data={"sub": str(user.id)}
    )
    
    return Token(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer"
    )
