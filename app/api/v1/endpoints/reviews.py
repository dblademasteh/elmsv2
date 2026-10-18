"""Review endpoints"""
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from app.schemas.review import ReviewCreate, ReviewUpdate, ReviewResponse, CourseRatingSummary
from app.crud.review import (
    get_review_by_id,
    get_review_by_user_and_course,
    get_reviews_by_course,
    create_review,
    update_review,
    delete_review,
    get_course_rating_summary,
)
from app.crud.enrollment import get_enrollment_by_user_and_course
from app.crud.course import get_course_by_id, get_course_by_id_raw
from app.db.database import get_db
from app.api.v1.endpoints.users import get_current_user_from_token
from app.models.course import Course
from typing import List
import uuid

router = APIRouter()
bearer = HTTPBearer(auto_error=False)


async def _get_current_user(credentials: HTTPAuthorizationCredentials, db):
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return await get_current_user_from_token(credentials, db)


@router.get("/{course_id}/reviews", response_model=List[ReviewResponse])
async def list_course_reviews(
    course_id: uuid.UUID,
    skip: int = 0,
    limit: int = 100,
    approved_only: bool = True,
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db: get_db = Depends(),
):
    """Get all reviews for a course (public if approved_only=True)."""
    rows = await get_reviews_by_course(db, course_id, skip=skip, limit=limit, approved_only=approved_only)
    return [
        ReviewResponse(
            id=r.id,
            user_id=r.user_id,
            user_full_name=r.user_full_name,
            user_avatar_url=r.user_avatar_url,
            user_role=r.user_role,
            course_id=r.course_id,
            rating_content=r.rating_content,
            rating_instructor=r.rating_instructor,
            rating_value=r.rating_value,
            average_rating=round((r.rating_content + r.rating_instructor + r.rating_value) / 3, 1),
            title=r.title,
            review=r.review,
            is_approved=r.is_approved,
            is_featured=r.is_featured,
            created_at=r.created_at,
        )
        for r in rows
    ]


@router.get("/{course_id}/rating", response_model=CourseRatingSummary)
async def get_course_rating(
    course_id: uuid.UUID,
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db: get_db = Depends(),
):
    """Get aggregate rating summary for a course."""
    course = await get_course_by_id_raw(db, course_id)
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    summary = await get_course_rating_summary(db, course_id)
    return summary


@router.post("/{course_id}/reviews", response_model=ReviewResponse, status_code=status.HTTP_201_CREATED)
async def create_new_review(
    review_in: ReviewCreate,
    course_id: uuid.UUID,
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db: get_db = Depends(),
):
    """Create a review for a course (student must be enrolled)."""
    user = await _get_current_user(credentials, db)

    if user.role != "student":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only students can write reviews",
        )

    course = await get_course_by_id(db, course_id)
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    if course.status != "published":
        raise HTTPException(status_code=400, detail="Cannot review unpublished courses")

    # Verify enrollment
    enrollment = await get_enrollment_by_user_and_course(db, user.id, course_id)
    if not enrollment:
        raise HTTPException(
            status_code=403,
            detail="You must be enrolled in this course to review it",
        )

    # Check for existing review
    existing = await get_review_by_user_and_course(db, user.id, course_id)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="You have already reviewed this course",
        )

    review = await create_review(
        db=db,
        user_id=user.id,
        course_id=course_id,
        rating_content=review_in.rating_content,
        rating_instructor=review_in.rating_instructor,
        rating_value=review_in.rating_value,
        title=review_in.title,
        review=review_in.review,
    )

    # Update course rating stats
    summary = await get_course_rating_summary(db, course_id)
    await db.execute(
        """
        UPDATE courses
        SET rating_average = :avg, rating_count = :count
        WHERE id = :id
        """,
        {
            "avg": summary["overall_average"],
            "count": summary["total_reviews"],
            "id": str(course_id),
        }
    )
    await db.commit()

    return ReviewResponse(
        id=review.id,
        user_id=review.user_id,
        user_full_name=user.full_name,
        user_avatar_url=user.avatar_url,
        user_role=user.role,
        course_id=review.course_id,
        rating_content=review.rating_content,
        rating_instructor=review.rating_instructor,
        rating_value=review.rating_value,
        average_rating=round((review.rating_content + review.rating_instructor + review.rating_value) / 3, 1),
        title=review.title,
        review=review.review,
        is_approved=review.is_approved,
        is_featured=review.is_featured,
        created_at=review.created_at,
    )


@router.put("/reviews/{review_id}", response_model=ReviewResponse)
async def update_existing_review(
    review_id: uuid.UUID,
    review_in: ReviewUpdate,
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db: get_db = Depends(),
):
    """Update a review (owner or admin only)."""
    user = await _get_current_user(credentials, db)

    review = await get_review_by_id(db, review_id)
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")

    if review.user_id != user.id and user.role != "admin":
        raise HTTPException(status_code=403, detail="You can only edit your own reviews")

    update_data = {}
    if review_in.rating_content is not None:
        update_data["rating_content"] = review_in.rating_content
    if review_in.rating_instructor is not None:
        update_data["rating_instructor"] = review_in.rating_instructor
    if review_in.rating_value is not None:
        update_data["rating_value"] = review_in.rating_value
    if review_in.title is not None:
        update_data["title"] = review_in.title
    if review_in.review is not None:
        update_data["review"] = review_in.review
    if user.role == "admin":
        if review_in.is_approved is not None:
            update_data["is_approved"] = review_in.is_approved
        if review_in.is_featured is not None:
            update_data["is_featured"] = review_in.is_featured

    updated = await update_review(db, review_id, **update_data)

    return ReviewResponse(
        id=updated.id,
        user_id=updated.user_id,
        user_full_name=user.full_name,
        user_avatar_url=user.avatar_url,
        user_role=user.role,
        course_id=updated.course_id,
        rating_content=updated.rating_content,
        rating_instructor=updated.rating_instructor,
        rating_value=updated.rating_value,
        average_rating=round((updated.rating_content + updated.rating_instructor + updated.rating_value) / 3, 1),
        title=updated.title,
        review=updated.review,
        is_approved=updated.is_approved,
        is_featured=updated.is_featured,
        created_at=updated.created_at,
    )


@router.delete("/reviews/{review_id}", response_model=dict)
async def delete_existing_review(
    review_id: uuid.UUID,
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db: get_db = Depends(),
):
    """Delete a review (owner or admin only)."""
    user = await _get_current_user(credentials, db)

    review = await get_review_by_id(db, review_id)
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")

    if review.user_id != user.id and user.role != "admin":
        raise HTTPException(status_code=403, detail="You can only delete your own reviews")

    course_id = review.course_id
    await delete_review(db, review_id)

    # Update course rating stats
    summary = await get_course_rating_summary(db, course_id)
    await db.execute(
        """
        UPDATE courses
        SET rating_average = :avg, rating_count = :count
        WHERE id = :id
        """,
        {
            "avg": summary["overall_average"],
            "count": summary["total_reviews"],
            "id": str(course_id),
        }
    )
    await db.commit()

    return {"message": "Review deleted successfully", "review_id": str(review_id)}


@router.get("/{course_id}/reviews/my", response_model=ReviewResponse)
async def get_my_review(
    course_id: uuid.UUID,
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db: get_db = Depends(),
):
    """Get the current user's review for a course."""
    user = await _get_current_user(credentials, db)
    review = await get_review_by_user_and_course(db, user.id, course_id)
    if not review:
        raise HTTPException(status_code=404, detail="You have not reviewed this course")
    return ReviewResponse(
        id=review.id,
        user_id=review.user_id,
        user_full_name=user.full_name,
        user_avatar_url=user.avatar_url,
        user_role=user.role,
        course_id=review.course_id,
        rating_content=review.rating_content,
        rating_instructor=review.rating_instructor,
        rating_value=review.rating_value,
        average_rating=round((review.rating_content + review.rating_instructor + review.rating_value) / 3, 1),
        title=review.title,
        review=review.review,
        is_approved=review.is_approved,
        is_featured=review.is_featured,
        created_at=review.created_at,
    )
