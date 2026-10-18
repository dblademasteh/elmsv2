"""Course CRUD operations"""
from sqlalchemy import select, desc, asc, or_
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.course import Course
from app.models.user import User
from typing import List, Optional, Tuple
import uuid
from datetime import datetime

SORT_OPTIONS = {
    "popular": [desc(Course.enrollment_count), Course.title],
    "rating": [desc(Course.rating_average), desc(Course.rating_count)],
    "price_asc": [asc(Course.price_cents), Course.title],
    "price_desc": [desc(Course.price_cents), Course.title],
    "newest": [desc(Course.created_at)],
}

async def get_course_by_slug(db: AsyncSession, slug: str) -> Optional[Course]:
    result = await db.execute(select(Course).where(Course.slug == slug))
    return result.scalar_one_or_none()

async def get_course_by_id(db: AsyncSession, course_id: uuid.UUID) -> Optional[Course]:
    result = await db.execute(
        select(Course).where(
            Course.id == course_id,
            Course.status == "published",
            Course.is_private.is_(False),
        )
    )
    return result.scalar_one_or_none()

async def get_courses(
    db: AsyncSession,
    skip: int = 0,
    limit: int = 100,
    featured: Optional[bool] = None,
    instructor_id: Optional[uuid.UUID] = None,
    search: Optional[str] = None,
    level: Optional[str] = None,
    min_price_cents: Optional[int] = None,
    max_price_cents: Optional[int] = None,
    sort: str = "popular",
) -> List[Tuple[Course, Optional[str]]]:
    """List courses with instructor names.

    Returns (course, instructor_name) tuples. Published public courses by
    default; pass instructor_id to list that instructor's courses regardless
    of status (drafts included). Supports search, level, price-range filters
    and sorting.
    """
    stmt = (
        select(Course, User.full_name)
        .outerjoin(User, Course.instructor_id == User.id)
        .where(Course.is_private.is_(False))
    )
    if instructor_id is not None:
        stmt = stmt.where(Course.instructor_id == instructor_id)
    else:
        stmt = stmt.where(Course.status == "published")

    if featured is not None:
        stmt = stmt.where(Course.is_featured.is_(featured))
    if search:
        pattern = f"%{search}%"
        stmt = stmt.where(
            or_(
                Course.title.ilike(pattern),
                Course.short_description.ilike(pattern),
                Course.description.ilike(pattern),
            )
        )
    if level:
        stmt = stmt.where(Course.level == level)
    if min_price_cents is not None:
        stmt = stmt.where(Course.price_cents >= min_price_cents)
    if max_price_cents is not None:
        stmt = stmt.where(Course.price_cents <= max_price_cents)

    order_by = SORT_OPTIONS.get(sort, SORT_OPTIONS["popular"])
    stmt = stmt.order_by(*order_by)
    stmt = stmt.offset(max(skip, 0)).limit(min(max(limit, 1), 100))
    result = await db.execute(stmt)
    return [(row[0], row[1]) for row in result.all()]

async def create_course(
    db: AsyncSession,
    title: str,
    instructor_id: uuid.UUID = None,
    description: str = None,
    short_description: str = None,
    price_cents: int = 0,
    currency: str = "USD",
    level: str = "beginner",
    cover_image_url: str = None,
    learning_objectives: str = None,
    prerequisites: str = None,
    is_private: bool = False,
    is_featured: bool = False,
):
    """Create a new course."""
    # Generate unique slug
    base_slug = title.lower().replace(' ', '-').replace('/', '-').replace('_', '-')
    slug = base_slug
    counter = 1
    # Ensure slug is unique
    while True:
        existing = await db.execute(select(Course).where(Course.slug == slug))
        if not existing.scalar_one_or_none():
            break
        slug = f"{base_slug}-{counter}"
        counter += 1

    db_course = Course(
        title=title,
        slug=slug,
        description=description,
        short_description=short_description,
        price_cents=price_cents,
        currency=currency,
        level=level,
        cover_image_url=cover_image_url,
        learning_objectives=learning_objectives,
        prerequisites=prerequisites,
        instructor_id=instructor_id,
        is_private=is_private,
        is_featured=is_featured,
        status="draft",
    )
    db.add(db_course)
    await db.commit()
    await db.refresh(db_course)
    return db_course


async def update_course(
    db: AsyncSession,
    course_id: uuid.UUID,
    title: str = None,
    description: str = None,
    short_description: str = None,
    price_cents: int = None,
    currency: str = None,
    level: str = None,
    status: str = None,
    cover_image_url: str = None,
    learning_objectives: str = None,
    prerequisites: str = None,
    is_private: bool = None,
    is_featured: bool = None,
    published_at: datetime = None,
):
    """Update an existing course."""
    course = await get_course_by_id_raw(db, course_id)
    if not course:
        return None

    if title is not None:
        course.title = title
        # Regenerate slug if title changed
        if title != getattr(course, '_original_title', title):
            base_slug = title.lower().replace(' ', '-').replace('/', '-').replace('_', '-')
            course.slug = base_slug

    if description is not None:
        course.description = description
    if short_description is not None:
        course.short_description = short_description
    if price_cents is not None:
        course.price_cents = price_cents
    if currency is not None:
        course.currency = currency
    if level is not None:
        course.level = level
    if status is not None:
        course.status = status
        if status == "published" and not course.published_at:
            course.published_at = datetime.now()
    if cover_image_url is not None:
        course.cover_image_url = cover_image_url
    if learning_objectives is not None:
        course.learning_objectives = learning_objectives
    if prerequisites is not None:
        course.prerequisites = prerequisites
    if is_private is not None:
        course.is_private = is_private
    if is_featured is not None:
        course.is_featured = is_featured
    if published_at is not None:
        course.published_at = published_at

    await db.commit()
    await db.refresh(course)
    return course


async def get_course_by_id_raw(db: AsyncSession, course_id: uuid.UUID):
    """Get a course by ID (internal, no status filtering)."""
    result = await db.execute(select(Course).where(Course.id == course_id))
    return result.scalar_one_or_none()


async def archive_course(db: AsyncSession, course_id: uuid.UUID):
    """Archive (soft-delete) a course."""
    course = await get_course_by_id_raw(db, course_id)
    if not course:
        return None
    course.status = "archived"
    await db.commit()
    await db.refresh(course)
    return course
