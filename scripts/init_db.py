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
        
        logger.info("✨ Database setup complete!")
        
    finally:
        await database.disconnect()

if __name__ == "__main__":
    asyncio.run(init_db())