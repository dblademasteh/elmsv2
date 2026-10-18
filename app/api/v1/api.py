"""API router for v1 endpoints"""
from fastapi import APIRouter
from app.api.v1.endpoints import auth, users, courses, enrollments, quizzes, lessons, reviews, assignments

api_router = APIRouter()

api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(courses.router, prefix="/courses", tags=["courses"])
api_router.include_router(enrollments.router, prefix="/enrollments", tags=["enrollments"])
api_router.include_router(quizzes.router, prefix="/courses", tags=["quizzes"])
api_router.include_router(lessons.router, prefix="/courses", tags=["lessons"])
api_router.include_router(reviews.router, prefix="/courses", tags=["reviews"])
api_router.include_router(assignments.router, prefix="/courses", tags=["assignments"])