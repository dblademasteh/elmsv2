"""Course endpoints"""
from fastapi import APIRouter, Depends, HTTPException
from app.schemas.course import CourseResponse, CourseListResponse
from app.crud.course import get_course_by_id, get_courses
from app.db.database import get_db
import uuid

router = APIRouter()

@router.get("/", response_model=list[CourseListResponse])
async def list_courses(skip: int = 0, limit: int = 100, db: get_db = Depends()):
    courses = await get_courses(db, skip, limit)
    return [
        CourseListResponse(
            id=c.id,
            title=c.title,
            slug=c.slug,
            price_cents=c.price_cents,
            currency=c.currency,
            enrollment_count=c.enrollment_count,
            short_description=c.short_description,
            description=c.description,
            level=c.level,
            rating_average=c.rating_average or 0,
        ) for c in courses
    ]

@router.get("/{course_id}", response_model=CourseResponse)
async def get_course(course_id: uuid.UUID, db: get_db = Depends()):
    course = await get_course_by_id(db, course_id)
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    return course
