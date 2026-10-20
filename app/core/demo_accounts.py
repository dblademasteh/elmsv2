"""The development-only demo accounts.

These credentials exist to seed a local development database. They are
served by a single API endpoint that 404s unless ``ENVIRONMENT`` is
``development``, so a deployed instance never hands them out — and the web
client never has them in its bundle.
"""
from typing import Dict, List

DEMO_ADMIN = {
    "email": "admin@lms.com",
    "password": "Admin123!@#",
    "full_name": "Admin User",
    "role": "admin",
}

DEMO_INSTRUCTOR = {
    "email": "instructor@lms.com",
    "password": "Instructor123!@#",
    "full_name": "Instructor User",
    "role": "instructor",
}

DEMO_STUDENT = {
    "email": "student@lms.com",
    "password": "Student123!@#",
    "full_name": "Student User",
    "role": "student",
}

DEMO_ACCOUNTS: List[Dict[str, str]] = [DEMO_ADMIN, DEMO_INSTRUCTOR, DEMO_STUDENT]
