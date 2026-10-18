"""Course endpoints"""
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from app.schemas.course import CourseResponse, CourseListResponse, CourseDetailResponse, CourseUpdate
from app.crud.course import get_course_by_id, get_courses, create_course, update_course, archive_course
from app.db.database import get_db
from app.api.v1.endpoints.users import get_current_user_from_token
from typing import List, Optional
import uuid

router = APIRouter()
bearer = HTTPBearer(auto_error=False)


async def get_current_instructor_or_admin(credentials: HTTPAuthorizationCredentials = Depends(bearer), db: get_db = Depends()):
    """Dependency: ensure the user is an instructor or admin."""
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
    user = await get_current_user_from_token(credentials, db)
    if user.role not in ("admin", "instructor"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only instructors and admins can manage courses",
        )
    return user


@router.get("/", response_model=List[CourseListResponse])
async def list_courses(
    skip: int = 0,
    limit: int = 100,
    featured: Optional[bool] = None,
    mine: bool = False,
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db: get_db = Depends(),
):
    """List courses. `mine=true` returns the current instructor's courses (drafts included)."""
    instructor_id = None
    if mine:
        if not credentials:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Not authenticated",
                headers={"WWW-Authenticate": "Bearer"},
            )
        user = await get_current_user_from_token(credentials, db)
        if user.role == "instructor":
            instructor_id = user.id
        elif user.role != "admin":
            instructor_id = uuid.UUID(int=0)  # students: no courses

    rows = await get_courses(db, skip, limit, featured=featured, instructor_id=instructor_id)
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
            cover_image_url=c.cover_image_url,
            is_featured=c.is_featured,
            instructor_name=instructor_name,
        ) for c, instructor_name in rows
    ]

@router.get("/{course_id}", response_model=CourseResponse)
async def get_course(course_id: uuid.UUID, db: get_db = Depends()):
    course = await get_course_by_id(db, course_id)
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    return course


@router.get("/{course_id}/detail", response_model=CourseDetailResponse)
async def get_course_detail(course_id: uuid.UUID, db: get_db = Depends()):
    """Get detailed course info for the learning interface."""
    from app.crud.course import get_course_by_id_raw
    course = await get_course_by_id_raw(db, course_id)
    if not course or course.status not in ("published", "draft"):
        raise HTTPException(status_code=404, detail="Course not found")
    return CourseDetailResponse(
        id=course.id,
        title=course.title,
        slug=course.slug,
        description=course.description,
        short_description=course.short_description,
        price_cents=course.price_cents,
        currency=course.currency,
        level=course.level,
        status=course.status,
        cover_image_url=course.cover_image_url,
        learning_objectives=course.learning_objectives,
        prerequisites=course.prerequisites,
        instructor_id=course.instructor_id,
        published_at=course.published_at,
        is_featured=course.is_featured,
        is_private=course.is_private,
        enrollment_count=course.enrollment_count,
        completion_rate=course.completion_rate or 0,
        rating_average=course.rating_average or 0,
        rating_count=course.rating_count or 0,
        created_at=course.created_at,
    )


@router.post("/", response_model=CourseListResponse, status_code=status.HTTP_201_CREATED)
async def create_new_course(
    course_in: CourseUpdate,
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db: get_db = Depends(),
):
    """Create a new course (instructors and admins only)."""
    user = await get_current_instructor_or_admin(credentials, db)

    from app.schemas.course import CourseCreate
    # Use CourseCreate-like defaults
    new_course = await create_course(
        db=db,
        title=course_in.title or "",
        instructor_id=user.id,
        description=course_in.description,
        short_description=course_in.short_description,
        price_cents=course_in.price_cents or 0,
        currency=course_in.currency or "USD",
        level=course_in.level or "beginner",
        cover_image_url=course_in.cover_image_url,
        learning_objectives=course_in.learning_objectives,
        prerequisites=course_in.prerequisites,
        is_private=course_in.is_private or False,
        is_featured=course_in.is_featured or False,
    )

    return CourseListResponse(
        id=new_course.id,
        title=new_course.title,
        slug=new_course.slug,
        price_cents=new_course.price_cents,
        currency=new_course.currency,
        enrollment_count=new_course.enrollment_count or 0,
        short_description=new_course.short_description,
        description=new_course.description,
        level=new_course.level,
        rating_average=new_course.rating_average or 0,
    )


@router.put("/{course_id}", response_model=CourseDetailResponse)
async def edit_course(
    course_id: uuid.UUID,
    course_in: CourseUpdate,
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db: get_db = Depends(),
):
    """Update an existing course (owner or admin only)."""
    user = await get_current_instructor_or_admin(credentials, db)
    from app.crud.course import get_course_by_id_raw
    course = await get_course_by_id_raw(db, course_id)
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    # Only the owner instructor or admin can edit
    if course.instructor_id != user.id and user.role != "admin":
        raise HTTPException(status_code=403, detail="You don't have permission to edit this course")

    updated = await update_course(
        db=db,
        course_id=course_id,
        title=course_in.title,
        description=course_in.description,
        short_description=course_in.short_description,
        price_cents=course_in.price_cents,
        currency=course_in.currency,
        level=course_in.level,
        status=course_in.status,
        cover_image_url=course_in.cover_image_url,
        learning_objectives=course_in.learning_objectives,
        prerequisites=course_in.prerequisites,
        is_private=course_in.is_private,
        is_featured=course_in.is_featured,
        published_at=course_in.published_at,
    )

    return CourseDetailResponse(
        id=updated.id,
        title=updated.title,
        slug=updated.slug,
        description=updated.description,
        short_description=updated.short_description,
        price_cents=updated.price_cents,
        currency=updated.currency,
        level=updated.level,
        status=updated.status,
        cover_image_url=updated.cover_image_url,
        learning_objectives=updated.learning_objectives,
        prerequisites=updated.prerequisites,
        instructor_id=updated.instructor_id,
        published_at=updated.published_at,
        is_featured=updated.is_featured,
        is_private=updated.is_private,
        enrollment_count=updated.enrollment_count or 0,
        completion_rate=updated.completion_rate or 0,
        rating_average=updated.rating_average or 0,
        rating_count=updated.rating_count or 0,
        created_at=updated.created_at,
    )


@router.delete("/{course_id}/archive", response_model=dict)
async def archive_course_endpoint(
    course_id: uuid.UUID,
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db: get_db = Depends(),
):
    """Archive (soft-delete) a course (owner or admin only)."""
    user = await get_current_instructor_or_admin(credentials, db)
    from app.crud.course import get_course_by_id_raw
    course = await get_course_by_id_raw(db, course_id)
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    if course.instructor_id != user.id and user.role != "admin":
        raise HTTPException(status_code=403, detail="You don't have permission to archive this course")

    await archive_course(db, course_id)
    return {"message": "Course archived successfully", "course_id": str(course_id)}
