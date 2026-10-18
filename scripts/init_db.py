"""Initialize database with tables and seed data"""
import asyncio
import sys
import os
import uuid
from datetime import datetime

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text

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

    # Lightweight column migrations (create_all does not alter existing tables)
    alter_statements = [
        "ALTER TABLE lessons ADD COLUMN IF NOT EXISTS section_title VARCHAR(255)",
    ]
    async with engine.begin() as conn:
        for statement in alter_statements:
            await conn.execute(text(statement))

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

        # Seed demo students with enrollments and featured reviews (idempotent)
        demo_students = [
            {"email": "sarah.chen@demo.lms.com", "full_name": "Sarah Chen"},
            {"email": "marcus.johnson@demo.lms.com", "full_name": "Marcus Johnson"},
            {"email": "priya.patel@demo.lms.com", "full_name": "Priya Patel"},
            {"email": "alex.morgan@demo.lms.com", "full_name": "Alex Morgan"},
            {"email": "lena.hoffman@demo.lms.com", "full_name": "Lena Hoffman"},
            {"email": "diego.ramos@demo.lms.com", "full_name": "Diego Ramos"},
        ]
        demo_password_hash = get_password_hash("Student123!@#")
        demo_user_ids = []
        for s in demo_students:
            row = await database.fetch_one(
                "SELECT id FROM users WHERE email = :email", {"email": s["email"]}
            )
            if not row:
                await database.execute(
                    """
                    INSERT INTO users (id, email, full_name, hashed_password, role, is_active)
                    VALUES (:id, :email, :full_name, :hashed_password, 'student', TRUE)
                    """,
                    {
                        "id": str(uuid.uuid4()),
                        "email": s["email"],
                        "full_name": s["full_name"],
                        "hashed_password": demo_password_hash,
                    },
                )
                row = await database.fetch_one(
                    "SELECT id FROM users WHERE email = :email", {"email": s["email"]}
                )
            demo_user_ids.append(str(row["id"]))

        demo_courses = await database.fetch_all(
            "SELECT id, title FROM courses ORDER BY title"
        )
        if demo_courses:
            # Enroll each demo student in one course (round-robin)
            for i, uid in enumerate(demo_user_ids):
                course = demo_courses[i % len(demo_courses)]
                existing = await database.fetch_one(
                    "SELECT id FROM enrollments WHERE user_id = :user_id AND course_id = :course_id",
                    {"user_id": uid, "course_id": str(course["id"])},
                )
                if not existing:
                    await database.execute(
                        """
                        INSERT INTO enrollments (id, user_id, course_id, progress_percent, status)
                        VALUES (:id, :user_id, :course_id, :progress, 'active')
                        """,
                        {
                            "id": str(uuid.uuid4()),
                            "user_id": uid,
                            "course_id": str(course["id"]),
                            "progress": 35 + (i * 7) % 60,
                        },
                    )

            demo_reviews = [
                (0, 0, "The hands-on projects gave me real skills I use every day at work.", 5, 5, 4, True),
                (1, 1, "I've taken courses from many platforms. This one stands out for its quality.", 5, 4, 5, True),
                (2, 2, "The pacing and real-world examples made complex topics feel approachable.", 4, 5, 5, True),
                (3, 1, "Clear explanations and practical exercises throughout.", 5, 5, 4, False),
                (4, 0, "Great fundamentals course with modern tooling and friendly support.", 4, 4, 4, False),
                (5, 2, "Exactly what I needed to level up my data skills.", 5, 4, 4, False),
            ]
            for student_idx, course_idx, review_text, rc, ri, rv, featured in demo_reviews:
                if student_idx >= len(demo_user_ids) or course_idx >= len(demo_courses):
                    continue
                uid = demo_user_ids[student_idx]
                cid = str(demo_courses[course_idx]["id"])
                existing = await database.fetch_one(
                    "SELECT id FROM reviews WHERE user_id = :user_id AND course_id = :course_id",
                    {"user_id": uid, "course_id": cid},
                )
                if not existing:
                    await database.execute(
                        """
                        INSERT INTO reviews (id, user_id, course_id, rating_content, rating_instructor,
                                             rating_value, review, is_approved, is_featured)
                        VALUES (:id, :user_id, :course_id, :rc, :ri, :rv, :review, TRUE, :featured)
                        """,
                        {
                            "id": str(uuid.uuid4()),
                            "user_id": uid,
                            "course_id": cid,
                            "rc": rc,
                            "ri": ri,
                            "rv": rv,
                            "review": review_text,
                            "featured": featured,
                        },
                    )

            # Recalculate enrollment counts and rating stats from real rows
            await database.execute(
                """
                UPDATE courses c SET enrollment_count = COALESCE(stats.cnt, 0)
                FROM (
                    SELECT course_id, COUNT(*) AS cnt FROM enrollments GROUP BY course_id
                ) stats
                WHERE c.id = stats.course_id
                """
            )
            await database.execute(
                """
                UPDATE courses c SET
                    rating_average = COALESCE(stats.avg_rating, 0),
                    rating_count = COALESCE(stats.cnt, 0)
                FROM (
                    SELECT course_id,
                           AVG((rating_content + rating_instructor + rating_value) / 3.0) AS avg_rating,
                           COUNT(*) AS cnt
                    FROM reviews
                    WHERE is_approved = TRUE
                    GROUP BY course_id
                ) stats
                WHERE c.id = stats.course_id
                """
            )
            logger.info("✅ Seeded demo students, enrollments, and reviews")

        logger.info("✨ Database setup complete!")

    finally:
        await database.disconnect()

if __name__ == "__main__":
    asyncio.run(init_db())