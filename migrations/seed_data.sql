-- Seed data for LMS

-- Get admin user ID
SELECT id FROM users WHERE email = 'admin@lms.com' INTO TEMP admin_id;

-- Create sample courses
INSERT INTO courses (
    id, title, slug, description, short_description, 
    price_cents, level, status, is_featured, instructor_id
) VALUES 
(
    uuid_generate_v4(),
    'Introduction to Web Development',
    'web-development-101',
    'Learn the fundamentals of modern web development with HTML, CSS, and JavaScript. This course covers everything from basic concepts to building your first interactive website.',
    'Master web development fundamentals in 8 weeks',
    4999,
    'beginner',
    'published',
    true,
    (SELECT id FROM users WHERE email = 'admin@lms.com')
),
(
    uuid_generate_v4(),
    'Advanced React Patterns',
    'advanced-react-patterns',
    'Dive deep into advanced React patterns, hooks, and state management. Learn how to build scalable, maintainable React applications.',
    'Master advanced React concepts for production apps',
    7999,
    'intermediate',
    'published',
    true,
    (SELECT id FROM users WHERE email = 'admin@lms.com')
);

-- Create sample lessons
INSERT INTO lessons (
    id, course_id, title, description, position, content_type, 
    video_duration_seconds, is_published
)
SELECT 
    uuid_generate_v4(),
    id,
    'Getting Started',
    'Introduction to the course and setup',
    1,
    'video',
    300,
    true
FROM courses;

-- Create enrollments
INSERT INTO enrollments (user_id, course_id, progress_percent)
SELECT 
    (SELECT id FROM users WHERE email = 'student@lms.com'),
    id,
    25
FROM courses;

-- Verify data
SELECT 'Users:' as entity, COUNT(*) as count FROM users
UNION ALL
SELECT 'Courses' as entity, COUNT(*) as count FROM courses
UNION ALL
SELECT 'Enrollments' as entity, COUNT(*) as count FROM enrollments;

SELECT * FROM courses LIMIT 5;