"""FastAPI LMS Application Entry Point"""
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from app.api.v1.api import api_router
from app.db import database
from app.core.config import settings
from datetime import datetime
import os
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="LMS API",
    description="Learning Management System API",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/api/openapi.json"
)

# CORS Middleware
configured_frontend = settings.FRONTEND_URL.strip().rstrip("/")
allowed_origins = [configured_frontend] if configured_frontend and configured_frontend != "*" else []
if settings.ENVIRONMENT == "development":
    allowed_origins.extend((
        "http://localhost:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001",
    ))
allowed_origins = list(dict.fromkeys(allowed_origins))

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Health Check Endpoint
@app.get("/health")
async def health_check():
    """Health check endpoint for Docker/Traefik"""
    return {
        "status": "healthy",
        "service": "lms-api",
        "timestamp": datetime.utcnow().isoformat(),
        "database": "connected" if database.is_connected else "disconnected"
    }

# Root Endpoint
@app.get("/")
async def root():
    return {
        "message": "LMS API",
        "version": "1.0.0",
        "docs": "/docs",
        "health": "/health"
    }

# Include API routes
app.include_router(api_router, prefix="/api/v1")

# Event handlers
@app.on_event("startup")
async def startup():
    logger.info("Starting LMS API...")
    if not database.is_connected:
        await database.connect()
        logger.info("✅ Database connected")
    logger.info("🚀 LMS API is ready!")

@app.on_event("shutdown")
async def shutdown():
    if database.is_connected:
        await database.disconnect()
        logger.info("✅ Database disconnected")

# Global Exception Handler
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Global error: {exc}")
    return JSONResponse(
        status_code=500,
        content={
            "error": "Internal server error",
            "detail": str(exc) if os.getenv("ENVIRONMENT") == "development" else None
        }
    )
