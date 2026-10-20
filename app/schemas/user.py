"""User schemas"""
from pydantic import BaseModel, EmailStr, Field, field_validator
from typing import Optional
from datetime import datetime
import uuid

class UserBase(BaseModel):
    email: str
    full_name: str = Field(..., min_length=2, max_length=255)

class UserCreate(UserBase):
    password: str = Field(..., min_length=8, max_length=255)

class UserUpdate(BaseModel):
    full_name: Optional[str] = Field(None, min_length=2, max_length=255)
    avatar_url: Optional[str] = None
    password: Optional[str] = None
    current_password: Optional[str] = None
    role: Optional[str] = None
    is_active: Optional[bool] = None
    is_verified: Optional[bool] = None

class UserResponse(UserBase):
    id: uuid.UUID
    role: str
    is_verified: bool
    is_active: bool
    created_at: datetime

    @field_validator("is_verified", "is_active", mode="before")
    @classmethod
    def default_missing_status_flags(cls, value):
        return bool(value)

    class Config:
        from_attributes = True
