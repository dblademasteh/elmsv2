"""Authentication schemas"""
from pydantic import BaseModel, EmailStr, Field
from typing import Optional
from datetime import datetime
import uuid

class Token(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str

class TokenData(BaseModel):
    user_id: Optional[uuid.UUID] = None
    email: Optional[str] = None
    role: Optional[str] = None

class LoginRequest(BaseModel):
    email: str
    password: str

class RegisterRequest(BaseModel):
    email: str
    full_name: str
    password: str

class RefreshTokenRequest(BaseModel):
    refresh_token: str