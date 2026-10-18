# Courses Feature Specification

## Version: 1.0  
## Priority: High  
## Target Release: Next iteration  
## Authors: Product + Engineering  

---

## 1. Overview and User Value

The Courses feature is the core of the LMS platform. Students browse and enroll in courses to learn new skills, while instructors create and manage course content. This specification defines the full lifecycle: course creation, curriculum building, enrollment, progress tracking, and multi-criteria reviews/ratings.

### Target Users
| Role | Primary Activities |
|------|-------------------|
| **Student** | Browse catalog, enroll in courses, track progress, leave reviews |
| **Instructor** | Create/edit courses, build curriculum, view enrollment analytics |
| **Admin** | Manage all courses, view platform-wide analytics, moderate reviews |

### User Value
- **Students** can discover, enroll in, and track progress across courses with confidence via peer reviews.
- **Instructors** can build comprehensive course content with lessons, quizzes, and assignments.
- **Admins** can manage the platform catalog and ensure quality through review moderation.

---

## 2. Functional Requirements (EARS Format)

### 2.1 Course Management

**FR-01:** When an instructor navigates to the dashboard courses page, the system shall display a list of courses they own or have permission to manage.

**FR-02:** When an instructor clicks "Create Course", the system shall display a form with fields for title, description, short description, price (cents + currency), level (beginner/intermediate/advanced), cover image URL, and learning objectives.

**FR-03:** When an instructor submits the course creation form with valid data, the system shall create a new course with status "draft" and redirect to the curriculum builder.

**FR-04:** When an instructor edits a course, the system shall pre-fill all fields with existing values and allow updating title, description, short description, price, level, cover image, learning objectives, prerequisites, and status (draft/published/archived).

**FR-05:** When an instructor publishes a course (sets status to "published"), the system shall validate that the course has at least one lesson with content before allowing publication.

**FR-06:** When a course is deleted by an instructor or admin, the system shall move the course to "archived" status (soft delete) rather than permanently removing it.

**FR-07:** The system shall validate course title is unique within the catalog for published courses.

### 2.2 Curriculum Builder

**FR-08:** When an instructor is in the curriculum builder for a course, the system shall display a list of existing lessons ordered by position, with the ability to add, reorder, edit, and delete lessons.

**FR-09:** When an instructor creates a new lesson, the system shall display a form with fields for title, description, slug, position, content type (video/text/quiz/assignment/download), and content-specific fields (video URL, duration, content JSON).

**FR-10:** Where a lesson has content type "video", the system shall validate the video URL is provided and in a supported format (mp4, YouTube embed, Vimeo).

**FR-11:** When an instructor saves a lesson, the system shall validate that the title is non-empty and the position is unique within the course.

**FR-12:** The system shall support drag-and-drop reordering of lessons within a course.

### 2.3 Quiz & Assignment System

**FR-13:** When an instructor creates a quiz for a lesson, the system shall display a form to add questions with multiple question types (multiple choice, true/false, short answer).

**FR-14:** Where a quiz has "time_limit_seconds" set, the system shall enforce the time limit during quiz taking.

**FR-15:** The system shall store quiz questions in a structured JSON format supporting up to 10 question types.

**FR-16:** When an instructor creates an assignment, the system shall allow uploading or linking to an assignment file and defining a description.

### 2.4 Enrollment System

**FR-17:** When a student browses the course catalog, the system shall display only courses with status "published" and `is_private = false`.

**FR-18:** When a student clicks "Enroll" on a published course, the system shall create an enrollment record with status "active" and enroll the student.

**FR-19:** When a student attempts to enroll in a course they are already enrolled in, the system shall display an error message indicating they are already enrolled.

**FR-20:** The system shall prevent enrollment in courses with status "draft" or "archived".

**FR-21:** When an enrollment is created, the system shall increment the course's `enrollment_count` atomically.

### 2.5 Progress Tracking

**FR-22:** When a student completes a lesson within a course, the system shall mark that lesson as completed and calculate the overall course progress percentage based on completed lessons.

**FR-23:** The system shall update the enrollment's `progress_percent` and `last_accessed_at` fields when a student accesses a lesson.

**FR-24:** When a student completes all lessons in a course, the system shall mark the enrollment status as "completed" and set `completed_at` timestamp.

**FR-25:** The system shall track total time spent on a course in minutes via the `total_minutes` field on the enrollment.

### 2.6 Reviews & Multi-Criteria Ratings

**FR-26:** When a student who has completed a course submits a review, the system shall allow them to rate multiple criteria: course content (1-5), instructor quality (1-5), and course value (1-5), with an optional text review.

**FR-27:** The system shall calculate and store the average rating for each criterion, plus an overall average and rating count on the course.

**FR-28:** When a review is submitted, the system shall validate that the student has completed the course before allowing submission.

**FR-29:** The system shall display course ratings prominently on the course detail page and in catalog cards.

**FR-30:** When an admin views reviews, the system shall display all reviews with the ability to remove inappropriate content.

### 2.7 Student Learning Dashboard

**FR-31:** When a student navigates to "My Learning", the system shall display all courses they are enrolled in, showing course title, progress percentage, last accessed date, and estimated time remaining.

**FR-32:** The system shall sort the student's courses by `last_accessed_at` descending.

**FR-33:** When a student clicks on a course card in "My Learning", the system shall navigate to that course's learning interface where they can access lessons in order.

### 2.8 Course Catalog

**FR-34:** When a student searches for courses, the system shall filter by title and description using case-insensitive partial matching.

**FR-35:** The system shall support filtering courses by level (beginner/intermediate/advanced) and sorting by price, rating, or popularity.

**FR-36:** The system shall paginate catalog results with a default page size of 12 courses.

---

## 3. Non-Functional Requirements

### Performance
- **NFR-PF-01:** The system shall load the course catalog page in under 2 seconds for up to 1,000 courses.
- **NFR-PF-02:** Course detail pages shall load in under 1 second.
- **NFR-PF-03:** Enrollment creation shall complete in under 500ms.
- **NFR-PF-04:** The system shall cache course catalog data for 60 seconds to reduce database load.

### Security
- **NFR-SEC-01:** The system shall enforce role-based authorization — only instructors and admins can create/edit courses; only admins can archive courses.
- **NFR-SEC-02:** Course creation and curriculum editing endpoints shall require a valid JWT token with instructor or admin role.
- **NFR-SEC-03:** The system shall sanitize all HTML input in course descriptions and lesson content to prevent XSS attacks.
- **NFR-SEC-04:** The system shall validate file upload URLs for lessons (video) against an allowlist of supported domains.
- **NFR-SEC-05:** Students shall only submit reviews for courses they have completed — this check is enforced at both API and database level.

### Scalability
- **NFR-SCA-01:** The system shall support up to 10,000 concurrent users browsing the course catalog.
- **NFR-SCA-02:** Course data shall be indexed on `title`, `slug`, `status`, and `instructor_id` for efficient querying.
- **NFR-SCA-03:** Enrollment records shall be indexed on `user_id` and `course_id` for fast progress lookups.

### Data Integrity
- **NFR-DI-01:** When a course is archived, the system shall prevent new enrollments but preserve existing enrollment data.
- **NFR-DI-02:** The system shall enforce a unique constraint on (user_id, course_id) in the enrollments table to prevent duplicate enrollments.
- **NFR-DI-03:** Course deletion (soft-delete/archived) shall cascade to prevent new enrollments but preserve existing data.

### Accessibility
- **NFR-A11Y-01:** All course catalog and course detail pages shall meet WCAG 2.1 AA compliance.
- **NFR-A11Y-02:** Keyboard navigation shall be fully supported for all interactive elements in the curriculum builder.
- **NFR-A11Y-03:** Course progress bars shall include `aria-valuenow`, `aria-valuemin`, and `aria-valuemax` attributes.

### Mobile Responsiveness
- **NFR-MOB-01:** The course catalog shall display in a responsive grid that adapts from 1 column (mobile) to 4 columns (desktop).
- **NFR-MOB-02:** The curriculum builder shall have a mobile-friendly sidebar that collapses into a dropdown on small screens.

---

## 4. Acceptance Criteria (Given/When/Then)

### Course Management

**AC-01:** Given an instructor is on the dashboard courses page,  
When they click "Create Course" and fill in the form with valid data,  
Then a new course is created with status "draft" and they are redirected to the curriculum builder.

**AC-02:** Given an instructor is editing a published course,  
When they change the title and save,  
Then the course title is updated and the change is visible in the catalog within 5 seconds.

**AC-03:** Given an instructor is creating a course with no lessons,  
When they try to publish the course,  
Then the system displays an error "Cannot publish: add at least one lesson first."

**AC-04:** Given an admin is on the dashboard courses page,  
When they archive a course,  
Then the course status changes to "archived" and it no longer appears in the public catalog.

### Curriculum Builder

**AC-05:** Given an instructor is in the curriculum builder,  
When they add 3 lessons and reorder them via drag-and-drop,  
Then the lessons are saved with updated position values reflecting the new order.

**AC-06:** Given an instructor is creating a lesson with content type "video",  
When they leave the video URL empty and save,  
Then the system displays a validation error "Video URL is required for video lessons."

### Enrollment

**AC-07:** Given a student is viewing a published course detail page,  
When they click "Enroll" and confirm,  
Then an enrollment record is created with status "active" and they are redirected to the course learning page.

**AC-08:** Given a student is already enrolled in a course,  
When they click "Enroll" again on the course page,  
Then the system displays "You are already enrolled in this course."

### Reviews & Ratings

**AC-09:** Given a student has completed a course,  
When they submit a review with all three criteria rated 5 stars and a text comment,  
Then the course's average rating for each criterion is updated and the review appears on the course page.

**AC-10:** Given a student is viewing a course they have not completed,  
When they attempt to submit a review,  
Then the system displays "You must complete this course before reviewing it."

### Student Dashboard

**AC-11:** Given a student is enrolled in 3 courses,  
When they navigate to "My Learning",  
Then all 3 courses appear in a grid sorted by last accessed date, with progress bars.

### Search & Filter

**AC-12:** Given a student searches "react" in the course catalog,  
When the search returns results,  
Then courses with "react", "React", or "REACT" in their title or description are shown.

**AC-13:** Given a student filters courses by level "beginner",  
When they view the filtered results,  
Then only courses with level "beginner" are displayed.

---

## 5. Error Handling Table

| Scenario | Error Message | HTTP Status | Recovery |
|----------|---------------|-------------|----------|
| Course not found | "Course not found" | 404 | Redirect to catalog |
| Duplicate enrollment | "You are already enrolled in this course" | 409 | Show enrollment link instead |
| Cannot publish (no lessons) | "Cannot publish: add at least one lesson first" | 400 | Return to curriculum builder |
| Invalid course ID | "Invalid course ID" | 400 | Redirect to catalog |
| Not authorized to edit | "You don't have permission to edit this course" | 403 | Redirect to dashboard |
| Cannot review (not completed) | "You must complete this course before reviewing it" | 403 | Show course progress |
| Review already submitted | "You have already reviewed this course" | 409 | Show existing review |
| Course not published | "This course is not yet published" | 404 | Show coming soon page |
| Invalid video URL | "Please provide a valid video URL" | 400 | Highlight URL field |
| Search returns no results | "No courses found matching your search" | 200 | Show suggestion to clear filters |

---

## 6. Implementation TODO Checklist

### Phase 1: Backend — Course CRUD & Enrollment
- [ ] `app/crud/course.py`: Add `create_course`, `update_course`, `archive_course` functions
- [ ] `app/crud/enrollment.py`: Add `create_enrollment`, `get_enrollments_by_user`, `get_enrollment`
- [ ] `app/schemas/course.py`: Add `CourseCreate`, `CourseUpdate`, `CourseEnrollResponse` schemas
- [ ] `app/schemas/enrollment.py`: Add `EnrollmentCreate` schema
- [ ] `app/api/v1/endpoints/courses.py`: Add `POST /courses`, `PUT /courses/{id}`, `DELETE /courses/{id}/archive`
- [ ] `app/api/v1/endpoints/enrollments.py`: Add `POST /enrollments/` (enroll student)
- [ ] Database: Add indexes on `users.role`, `courses.instructor_id`, `enrollments.user_id`, `enrollments.course_id`

### Phase 2: Backend — Curriculum Builder
- [ ] `app/crud/course.py`: Add lesson CRUD functions (`create_lesson`, `update_lesson`, `delete_lesson`, `reorder_lessons`)
- [ ] `app/schemas/course.py`: Add `LessonCreate`, `LessonUpdate`, `LessonResponse` schemas
- [ ] `app/api/v1/endpoints/courses.py`: Add lesson endpoints (`/courses/{id}/lessons`)
- [ ] `app/api/v1/endpoints/courses.py`: Add quiz/assignment endpoints

### Phase 3: Backend — Reviews & Ratings
- [ ] `app/models/review.py`: Create `Review` model (multi-criteria: content, instructor, value)
- [ ] `app/crud/review.py`: Add `create_review`, `get_course_reviews`, `get_user_review`
- [ ] `app/schemas/review.py`: Add `ReviewCreate`, `ReviewResponse`, `RatingSummary` schemas
- [ ] `app/api/v1/endpoints/reviews.py`: Create router with `POST /reviews`, `GET /courses/{id}/reviews`
- [ ] `app/api/v1/api.py`: Register reviews router
- [ ] `app/crud/course.py`: Add `update_course_rating` to recalculate averages

### Phase 4: Frontend — Course Management
- [ ] `packages/web/src/app/dashboard/courses/page.tsx`: Add create/edit modal, archive button
- [ ] `packages/web/src/app/dashboard/courses/create/page.tsx`: New course creation form
- [ ] `packages/web/src/app/dashboard/courses/[id]/page.tsx`: Edit course page
- [ ] `packages/web/src/app/dashboard/courses/[id]/curriculum/page.tsx`: Curriculum builder (lessons, reorder, edit)

### Phase 5: Frontend — Student Features
- [ ] `packages/web/src/app/courses/[id]/page.tsx`: Add "Enroll" button, reviews section
- [ ] `packages/web/src/app/courses/[id]/learn/page.tsx`: Course learning interface (lesson viewer)
- [ ] `packages/web/src/app/dashboard/learning/page.tsx`: Wire to real enrollment data via API
- [ ] `packages/web/src/app/dashboard/reviews/page.tsx`: Student's submitted reviews page
- [ ] `packages/web/src/components/course-card.tsx`: Enhanced card with rating display

### Phase 6: Frontend — Reviews UI
- [ ] `packages/web/components/review-form.tsx`: Multi-criteria rating form
- [ ] `packages/web/components/review-list.tsx`: Review display component
- [ ] `packages/web/components/rating-stars.tsx`: Star rating display

### Phase 7: Testing & Documentation
- [ ] Write unit tests for all CRUD functions
- [ ] Write integration tests for enrollment flow
- [ ] Write frontend component tests for review form
- [ ] Update API documentation (FastAPI auto-docs)
- [ ] Add E2E tests for course creation → publish → enroll → review flow

---

## 7. API Design Reference

### New Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/v1/courses` | instructor/admin | Create a new course |
| PUT | `/api/v1/courses/{id}` | owner/instructor/admin | Update course details |
| DELETE | `/api/v1/courses/{id}/archive` | owner/instructor/admin | Archive (soft delete) a course |
| GET | `/api/v1/courses/{id}/lessons` | owner/instructor/admin | List lessons for a course |
| POST | `/api/v1/courses/{id}/lessons` | owner/instructor/admin | Create a lesson |
| PUT | `/api/v1/courses/{id}/lessons/{lesson_id}` | owner/instructor/admin | Update a lesson |
| POST | `/api/v1/enrollments` | student | Enroll in a course |
| GET | `/api/v1/enrollments/me` | student | Get current student's enrollments |
| PUT | `/api/v1/enrollments/{id}/progress` | student | Update lesson progress |
| POST | `/api/v1/reviews` | student | Create a review for completed course |
| GET | `/api/v1/courses/{id}/reviews` | anyone | Get reviews for a course |
| GET | `/api/v1/reviews/me/{course_id}` | student | Get student's existing review |

### Data Models

**reviews table (new):**
```sql
CREATE TABLE reviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
    rating_content DECIMAL(3,2) DEFAULT 0,
    rating_instructor DECIMAL(3,2) DEFAULT 0,
    rating_value DECIMAL(3,2) DEFAULT 0,
    overall_rating DECIMAL(3,2) DEFAULT 0,
    title VARCHAR(255),
    review TEXT,
    is_approved BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX idx_reviews_course ON reviews(course_id);
CREATE INDEX idx_reviews_user ON reviews(user_id);
CREATE UNIQUE INDEX idx_reviews_unique ON reviews(user_id, course_id) WHERE is_approved = TRUE;
```

---

## 8. User Stories

### As a Student
- **US-01:** As a student, I want to search and filter courses by keyword, level, and sort order so that I can quickly find courses relevant to my interests.
- **US-02:** As a student, I want to enroll in free courses with one click so I can start learning immediately.
- **US-03:** As a student, I want to see my progress across all enrolled courses on a single dashboard so I know where I stand.
- **US-04:** As a student, I want to leave multi-criteria reviews for courses I've completed so I can help other learners choose quality courses.

### As an Instructor
- **US-05:** As an instructor, I want to create and edit my own courses so I can share my knowledge with students.
- **US-06:** As an instructor, I want to build a curriculum with lessons, quizzes, and assignments so my students have structured learning content.
- **US-07:** As an instructor, I want to see who is enrolled in my courses and their progress so I can identify struggling students.

### As an Admin
- **US-08:** As an admin, I want to archive inappropriate courses so they don't appear in the catalog but data is preserved.
- **US-09:** As an admin, I want to moderate reviews so inappropriate content is removed from the platform.

---

## 9. Out of Scope

- Payment processing (Stripe integrations, subscriptions)
- Certificate generation and verification
- Discussion forums per course
- Live/video conferencing sessions
- Offline/mobile app download
- Gamification (badges, leaderboards, streaks)
- AI-powered course recommendations

---

*Specification saved by Feature Forge workflow.*