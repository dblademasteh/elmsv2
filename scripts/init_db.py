"""Initialize database with tables and seed data"""
import asyncio
import sys
import os
import uuid
from datetime import datetime

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db.database import database, engine, Base
from app.models.user import User
from app.models.course import Course
from app.models.lesson import Lesson
from app.models.quiz import Quiz, QuizAttempt
from app.core.security import get_password_hash
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def init_db():
    logger.info("🔄 Creating database tables...")
    
    # Create tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    logger.info("✅ Tables created successfully!")
    
    # Connect to database
    await database.connect()
    
    try:
        # Seed admin user
        admin = await database.fetch_one(
            "SELECT id FROM users WHERE email = :email",
            {"email": "admin@lms.com"}
        )
        
        if not admin:
            admin_password_hash = get_password_hash("Admin123!@#")
            query = """
                INSERT INTO users (id, email, full_name, hashed_password, role, is_active)
                VALUES (:id, :email, :full_name, :hashed_password, :role, :is_active)
            """
            await database.execute(query, {
                "id": str(uuid.uuid4()),
                "email": "admin@lms.com",
                "full_name": "Admin User",
                "hashed_password": admin_password_hash,
                "role": "admin",
                "is_active": True
            })
            logger.info("✅ Admin: admin@lms.com / Admin123!@#")
        
        # Seed instructor
        instructor = await database.fetch_one(
            "SELECT id FROM users WHERE email = :email",
            {"email": "instructor@lms.com"}
        )
        
        if not instructor:
            instructor_password_hash = get_password_hash("Instructor123!@#")
            query = """
                INSERT INTO users (id, email, full_name, hashed_password, role, is_active)
                VALUES (:id, :email, :full_name, :hashed_password, :role, :is_active)
            """
            await database.execute(query, {
                "id": str(uuid.uuid4()),
                "email": "instructor@lms.com",
                "full_name": "Instructor User",
                "hashed_password": instructor_password_hash,
                "role": "instructor",
                "is_active": True
            })
            logger.info("✅ Instructor: instructor@lms.com / Instructor123!@#")
        
        # Seed student
        student = await database.fetch_one(
            "SELECT id FROM users WHERE email = :email",
            {"email": "student@lms.com"}
        )
        
        if not student:
            student_password_hash = get_password_hash("Student123!@#")
            query = """
                INSERT INTO users (id, email, full_name, hashed_password, role, is_active)
                VALUES (:id, :email, :full_name, :hashed_password, :role, :is_active)
            """
            await database.execute(query, {
                "id": str(uuid.uuid4()),
                "email": "student@lms.com",
                "full_name": "Student User",
                "hashed_password": student_password_hash,
                "role": "student",
                "is_active": True
            })
            logger.info("✅ Student: student@lms.com / Student123!@#")
        
        # Seed sample courses
        course_count = await database.fetch_one("SELECT COUNT(*) as count FROM courses")
        if course_count["count"] == 0:
            admin_id = admin["id"] if isinstance(admin, dict) else (admin.id if hasattr(admin, 'id') else None)
            # Fetch admin UUID
            admin_row = await database.fetch_one("SELECT id FROM users WHERE email = :email", {"email": "admin@lms.com"})
            instructor_row = await database.fetch_one("SELECT id FROM users WHERE email = :email", {"email": "instructor@lms.com"})
            student_row = await database.fetch_one("SELECT id FROM users WHERE email = :email", {"email": "student@lms.com"})

            courses = [
                {
                    "id": str(uuid.uuid4()),
                    "title": "Introduction to Web Development",
                    "slug": "web-development-101",
                    "description": "Learn the fundamentals of modern web development with HTML, CSS, and JavaScript.",
                    "short_description": "Master web development fundamentals in 8 weeks",
                    "price_cents": 4999,
                    "level": "beginner",
                    "status": "published",
                    "is_featured": True,
                    "instructor_id": str(instructor_row["id"]) if instructor_row else str(admin_row["id"]),
                },
                {
                    "id": str(uuid.uuid4()),
                    "title": "Advanced React Patterns",
                    "slug": "advanced-react-patterns",
                    "description": "Dive deep into advanced React patterns, hooks, and state management.",
                    "short_description": "Master advanced React concepts for production apps",
                    "price_cents": 7999,
                    "level": "intermediate",
                    "status": "published",
                    "is_featured": True,
                    "instructor_id": str(instructor_row["id"]) if instructor_row else str(admin_row["id"]),
                },
                {
                    "id": str(uuid.uuid4()),
                    "title": "Python for Data Science",
                    "slug": "python-data-science",
                    "description": "Master Python for data analysis, visualization, and machine learning.",
                    "short_description": "From zero to data scientist with Python",
                    "price_cents": 6999,
                    "level": "intermediate",
                    "status": "published",
                    "is_featured": False,
                    "instructor_id": str(instructor_row["id"]) if instructor_row else str(admin_row["id"]),
                },
            ]

            for c in courses:
                c["enrollment_count"] = 0
                c["rating_average"] = 0
                await database.execute(
                    """
                    INSERT INTO courses (id, title, slug, description, short_description,
                                         price_cents, currency, level, status, cover_image_url,
                                         learning_objectives, prerequisites, instructor_id,
                                         published_at, is_featured, is_private, enrollment_count,
                                         rating_average, rating_count)
                    VALUES (:id, :title, :slug, :description, :short_description,
                            :price_cents, 'USD', :level, :status, NULL,
                            NULL, NULL, :instructor_id, NOW(), :is_featured, FALSE,
                            :enrollment_count, :rating_average, 0)
                    """,
                    {
                        "id": c["id"],
                        "title": c["title"],
                        "slug": c["slug"],
                        "description": c["description"],
                        "short_description": c["short_description"],
                        "price_cents": c["price_cents"],
                        "level": c["level"],
                        "status": c["status"],
                        "instructor_id": c["instructor_id"],
                        "is_featured": c["is_featured"],
                        "enrollment_count": c["enrollment_count"],
                        "rating_average": c["rating_average"],
                    }
                )
            logger.info(f"✅ Seeded {len(courses)} courses")

            # Update enrollment counts
            for c in courses:
                await database.execute(
                    "UPDATE courses SET enrollment_count = 1 WHERE id = :id",
                    {"id": c["id"]}
                )

            # Create sample enrollments for the student
            if student_row:
                student_id = str(student_row["id"])
                # Enroll student in first two courses
                for i, c in enumerate(courses[:2]):
                    await database.execute(
                        """
                        INSERT INTO enrollments (id, user_id, course_id, progress_percent, status)
                        VALUES (:id, :user_id, :course_id, :progress, :status)
                        """,
                        {
                            "id": str(uuid.uuid4()),
                            "user_id": student_id,
                            "course_id": c["id"],
                            "progress": 25 if i == 0 else 60,
                            "status": "active",
                        }
                    )
                logger.info("✅ Seeded sample enrollments for student")

        # Seed sample lessons for each course (runs independently of course seeding)
        lesson_count = await database.fetch_one("SELECT COUNT(*) as count FROM lessons")
        if lesson_count and lesson_count["count"] == 0:
            courses_all = await database.fetch_all("SELECT id, title FROM courses")
            for c in courses_all:
                for j in range(3):  # 3 lessons per course
                    lesson_id = str(uuid.uuid4())
                    await database.execute(
                        """
                        INSERT INTO lessons (id, course_id, title, description, position, content_type, duration_seconds, is_published, estimated_minutes)
                        VALUES (:id, :course_id, :title, :description, :position, :content_type, :duration_seconds, :is_published, :expected_minutes)
                        """,
                        {
                            "id": lesson_id,
                            "course_id": str(c["id"]),
                            "title": f"Lesson {j+1}: Fundamentals",
                            "description": f"Learn the basics of {c['title']}.",
                            "position": j,
                            "content_type": "video",
                            "duration_seconds": 300 * (j + 1),
                            "is_published": True,
                            "expected_minutes": 5 * (j + 1),
                        }
                    )
            logger.info(f"✅ Seeded {len(courses_all) * 3} sample lessons")

        logger.info("✨ Database setup complete!")

    finally:
        await database.disconnect()

if __name__ == "__main__":
    asyncio.run(init_db())