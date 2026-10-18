"""Application configuration"""
from pydantic_settings import BaseSettings
from typing import Optional
import secrets
import os

class Settings(BaseSettings):
    # Database
    DATABASE_URL: str = "postgresql://postgres:postgres@localhost:5432/lms_dev"
    DATABASE_HOST: Optional[str] = None
    DATABASE_PORT: Optional[int] = None
    DATABASE_USER: Optional[str] = None
    DATABASE_PASSWORD: Optional[str] = None
    DATABASE_NAME: Optional[str] = None
    
    # Redis
    REDIS_URL: str = "redis://localhost:6379"
    REDIS_HOST: Optional[str] = None
    REDIS_PORT: Optional[int] = None
    
    # Security
    SECRET_KEY: str = secrets.token_urlsafe(32)
    JWT_SECRET_KEY: str = secrets.token_urlsafe(32)
    
    # Server
    PORT: int = 8080
    
    # JWT Settings
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    ALGORITHM: str = "HS256"
    
    # Frontend URL for CORS
    FRONTEND_URL: str = "http://localhost:3000"
    ENVIRONMENT: str = "development"

    # File uploads (assignment submissions, etc.)
    UPLOAD_DIR: str = "uploads"
    MAX_UPLOAD_MB: int = 25

    class Config:
        env_file = ".env"
        case_sensitive = True
        extra = "ignore"  # Ignore extra environment variables

# Global settings instance
settings = Settings()