"""Review CRUD operations"""
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.review import Review
from app.models.user import User
from app.models.course import Course
from typing import List, Optional, Tuple
import uuid


async def get_review_by_id(db: AsyncSession, review_id: uuid.UUID) -> Optional[Review]:
    """Get a review by ID."""
    result = await db.execute(select(Review).where(Review.id == review_id))
    return result.scalar_one_or_none()


async def get_review_by_user_and_course(
    db: AsyncSession, user_id: uuid.UUID, course_id: uuid.UUID
) -> Optional[Review]:
    """Get a specific user's review for a course."""
    result = await db.execute(
        select(Review).where(
            and_(Review.user_id == user_id, Review.course_id == course_id)
        )
    )
    return result.scalar_one_or_none()


async def get_reviews_by_course(
    db: AsyncSession,
    course_id: uuid.UUID,
    skip: int = 0,
    limit: int = 100,
    approved_only: bool = True,
) -> List[tuple]:
    """Get all reviews for a course with user details, joined."""
    stmt = (
        select(
            Review.id,
            Review.user_id,
            User.full_name.label("user_full_name"),
            User.avatar_url.label("user_avatar_url"),
            User.role.label("user_role"),
            Review.course_id,
            Review.rating_content,
            Review.rating_instructor,
            Review.rating_value,
            Review.title,
            Review.review,
            Review.is_approved,
            Review.is_featured,
            Review.created_at,
        )
        .join(User, Review.user_id == User.id)
        .where(Review.course_id == course_id)
        .order_by(Review.created_at.desc())
        .offset(skip)
        .limit(limit)
    )

    if approved_only:
        stmt = stmt.where(Review.is_approved == True)

    result = await db.execute(stmt)
    return result.fetchall()


async def create_review(
    db: AsyncSession,
    user_id: uuid.UUID,
    course_id: uuid.UUID,
    rating_content: int,
    rating_instructor: int,
    rating_value: int,
    title: str = None,
    review: str = None,
) -> Review:
    """Create a new review for a course."""
    db_review = Review(
        user_id=user_id,
        course_id=course_id,
        rating_content=rating_content,
        rating_instructor=rating_instructor,
        rating_value=rating_value,
        title=title,
        review=review,
    )
    db.add(db_review)
    await db.commit()
    await db.refresh(db_review)
    return db_review


async def update_review(
    db: AsyncSession,
    review_id: uuid.UUID,
    rating_content: int = None,
    rating_instructor: int = None,
    rating_value: int = None,
    title: str = None,
    review: str = None,
    is_approved: bool = None,
    is_featured: bool = None,
) -> Optional[Review]:
    """Update an existing review."""
    rev = await get_review_by_id(db, review_id)
    if not rev:
        return None

    if rating_content is not None:
        rev.rating_content = rating_content
    if rating_instructor is not None:
        rev.rating_instructor = rating_instructor
    if rating_value is not None:
        rev.rating_value = rating_value
    if title is not None:
        rev.title = title
    if review is not None:
        rev.review = review
    if is_approved is not None:
        rev.is_approved = is_approved
    if is_featured is not None:
        rev.is_featured = is_featured

    await db.commit()
    await db.refresh(rev)
    return rev


async def delete_review(db: AsyncSession, review_id: uuid.UUID) -> bool:
    """Delete a review."""
    review = await get_review_by_id(db, review_id)
    if not review:
        return False
    await db.delete(review)
    await db.commit()
    return True


async def get_featured_reviews(
    db: AsyncSession,
    limit: int = 6,
) -> List[tuple]:
    """Get approved, featured reviews across all published courses (public)."""
    stmt = (
        select(
            Review.id,
            User.full_name.label("user_full_name"),
            User.avatar_url.label("user_avatar_url"),
            User.role.label("user_role"),
            Review.course_id,
            Course.title.label("course_title"),
            ((Review.rating_content + Review.rating_instructor + Review.rating_value) / 3.0)
            .label("average_rating"),
            Review.title,
            Review.review,
            Review.created_at,
        )
        .join(User, Review.user_id == User.id)
        .join(Course, Review.course_id == Course.id)
        .where(
            Review.is_approved == True,
            Review.is_featured == True,
            Course.status == "published",
            Course.is_private.is_(False),
        )
        .order_by(Review.created_at.desc())
        .limit(min(max(limit, 1), 12))
    )
    result = await db.execute(stmt)
    return result.fetchall()


async def get_course_rating_summary(db: AsyncSession, course_id: uuid.UUID) -> dict:
    """Get aggregate rating summary for a course."""
    result = await db.execute(
        select(
            func.avg(Review.rating_content).label("avg_content"),
            func.avg(Review.rating_instructor).label("avg_instructor"),
            func.avg(Review.rating_value).label("avg_value"),
            func.count(Review.id).label("total"),
        )
        .where(
            and_(
                Review.course_id == course_id,
                Review.is_approved == True,
            )
        )
    )
    row = result.fetchone()

    # Get rating distribution (count of each 1-5 star rating based on overall average)
    dist_result = await db.execute(
        select(
            func.count().filter(
                (Review.rating_content + Review.rating_instructor + Review.rating_value) / 3 >= 4.5
            ).label("star_5"),
            func.count().filter(
                and_(
                    (Review.rating_content + Review.rating_instructor + Review.rating_value) / 3 >= 3.5,
                    (Review.rating_content + Review.rating_instructor + Review.rating_value) / 3 < 4.5
                )
            ).label("star_4"),
            func.count().filter(
                and_(
                    (Review.rating_content + Review.rating_instructor + Review.rating_value) / 3 >= 2.5,
                    (Review.rating_content + Review.rating_instructor + Review.rating_value) / 3 < 3.5
                )
            ).label("star_3"),
            func.count().filter(
                and_(
                    (Review.rating_content + Review.rating_instructor + Review.rating_value) / 3 >= 1.5,
                    (Review.rating_content + Review.rating_instructor + Review.rating_value) / 3 < 2.5
                )
            ).label("star_2"),
            func.count().filter(
                (Review.rating_content + Review.rating_instructor + Review.rating_value) / 3 < 1.5
            ).label("star_1"),
        )
        .where(
            and_(
                Review.course_id == course_id,
                Review.is_approved == True,
            )
        )
    )
    dist_row = dist_result.fetchone()

    avg_content = float(row.avg_content or 0)
    avg_instructor = float(row.avg_instructor or 0)
    avg_value = float(row.avg_value or 0)
    overall = round((avg_content + avg_instructor + avg_value) / 3, 1) if (row.total or 0) > 0 else 0.0

    # Access distribution by index (SQLAlchemy returns tuples)
    stars = [0, 0, 0, 0, 0]  # 1-star through 5-star
    if dist_row:
        for i in range(5):
            try:
                val = dist_row[i] or 0
                stars[i] = int(val) if val is not None else 0
            except (IndexError, TypeError):
                pass

    return {
        "course_id": str(course_id),
        "average_content": round(avg_content, 1),
        "average_instructor": round(avg_instructor, 1),
        "average_value": round(avg_value, 1),
        "overall_average": overall,
        "total_reviews": int(row.total or 0),
        "rating_distribution": {
            "5": stars[0],  # star_5 is the first column
            "4": stars[1],  # star_4 is the second
            "3": stars[2],
            "2": stars[3],
            "1": stars[4],  # star_1 is the last column
        },
    }
