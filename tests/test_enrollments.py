"""Enrollment, gradebook, and grading notification tests."""
import uuid


def _published_course(client, instructor_headers, title):
    create = client.post(
        "/api/v1/courses/",
        headers=instructor_headers,
        json={"title": title, "price_cents": 0, "level": "beginner"},
    )
    assert create.status_code == 201
    course_id = create.json()["id"]
    publish = client.put(
        f"/api/v1/courses/{course_id}", headers=instructor_headers, json={"status": "published"}
    )
    assert publish.status_code == 200
    return course_id


def test_enroll_flow_and_duplicate(client, auth_headers):
    course_id = _published_course(
        client, auth_headers["instructor"], f"Enroll Course {uuid.uuid4().hex[:6]}"
    )

    enroll = client.post(
        "/api/v1/enrollments/",
        headers=auth_headers["student"],
        json={"course_id": course_id},
    )
    assert enroll.status_code == 201, enroll.text

    duplicate = client.post(
        "/api/v1/enrollments/",
        headers=auth_headers["student"],
        json={"course_id": course_id},
    )
    assert duplicate.status_code == 409

    mine = client.get("/api/v1/enrollments/me", headers=auth_headers["student"])
    assert any(e["course_id"] == course_id for e in mine.json())


def test_enrollment_notifies_instructor(client, auth_headers):
    course_id = _published_course(
        client, auth_headers["instructor"], f"Notify Course {uuid.uuid4().hex[:6]}"
    )
    enroll = client.post(
        "/api/v1/enrollments/",
        headers=auth_headers["student"],
        json={"course_id": course_id},
    )
    assert enroll.status_code == 201

    notifications = client.get("/api/v1/notifications/", headers=auth_headers["instructor"]).json()
    enrollment_notes = [n for n in notifications["notifications"] if n["type"] == "enrollment"]
    assert any(course_id in (n["link_url"] or "") or "enrolled in" in (n["body"] or "") for n in enrollment_notes)


def test_gradebook_role_views(client, auth_headers):
    course_id = _published_course(
        client, auth_headers["instructor"], f"Gradebook Course {uuid.uuid4().hex[:6]}"
    )
    client.post(
        "/api/v1/enrollments/", headers=auth_headers["student"], json={"course_id": course_id}
    )

    instructor_rows = client.get(
        "/api/v1/dashboard/gradebook", headers=auth_headers["instructor"]
    ).json()
    course_rows = [r for r in instructor_rows if r["course_id"] == course_id]
    assert len(course_rows) == 1
    assert course_rows[0]["student_email"] == "student@test.com"

    student_rows = client.get(
        "/api/v1/dashboard/gradebook", headers=auth_headers["student"]
    ).json()
    assert all(r["student_email"] == "student@test.com" for r in student_rows)
    assert any(r["course_id"] == course_id for r in student_rows)

    forbidden = client.get(
        "/api/v1/dashboard/gradebook/export", headers=auth_headers["student"]
    )
    assert forbidden.status_code == 403


def test_assignment_grading_notifies_student(client, auth_headers):
    course_id = _published_course(
        client, auth_headers["instructor"], f"Graded Course {uuid.uuid4().hex[:6]}"
    )
    client.post(
        "/api/v1/enrollments/", headers=auth_headers["student"], json={"course_id": course_id}
    )

    lessons = client.get(
        f"/api/v1/courses/lessons/course/{course_id}", headers=auth_headers["instructor"]
    ).json()
    create_lesson = client.post(
        "/api/v1/courses/lessons",
        headers=auth_headers["instructor"],
        json={"course_id": course_id, "title": "Assignment Lesson", "is_published": True},
    )
    lesson_id = create_lesson.json()["id"]
    assert lessons is not None

    assignment = client.post(
        "/api/v1/courses/assignments",
        headers=auth_headers["instructor"],
        json={"lesson_id": lesson_id, "title": "Graded Task", "max_score": 100, "is_published": True},
    )
    assert assignment.status_code == 201, assignment.text
    assignment_id = assignment.json()["id"]

    submission = client.post(
        f"/api/v1/courses/assignments/{assignment_id}/submit",
        headers=auth_headers["student"],
        json={
            "file_url": "https://example.com/work.zip",
            "file_name": "work.zip",
            "file_size_bytes": 2048,
        },
    )
    assert submission.status_code in (200, 201), submission.text
    submission_id = submission.json()["id"]

    graded = client.put(
        f"/api/v1/courses/submissions/{submission_id}/grade",
        headers=auth_headers["instructor"],
        json={"score": 88, "feedback": "Well done"},
    )
    assert graded.status_code == 200
    assert graded.json()["score"] == 88

    notifications = client.get("/api/v1/notifications/", headers=auth_headers["student"]).json()
    grade_notes = [n for n in notifications["notifications"] if n["type"] == "grade"]
    assert any("Graded Task" in n["title"] for n in grade_notes)


def _assignable_assignment(client, auth_headers):
    """A published course + lesson + published assignment for a student."""
    course_id = _published_course(
        client, auth_headers["instructor"], f"URL Course {uuid.uuid4().hex[:6]}"
    )
    client.post(
        "/api/v1/enrollments/", headers=auth_headers["student"], json={"course_id": course_id}
    )
    lesson = client.post(
        "/api/v1/courses/lessons",
        headers=auth_headers["instructor"],
        json={"course_id": course_id, "title": "File Lesson", "is_published": True},
    )
    assert lesson.status_code == 201, lesson.text
    assignment = client.post(
        "/api/v1/courses/assignments",
        headers=auth_headers["instructor"],
        json={
            "lesson_id": lesson.json()["id"],
            "title": "File Task",
            "max_score": 100,
            "is_published": True,
        },
    )
    assert assignment.status_code == 201, assignment.text
    return course_id, assignment.json()["id"]


def test_submission_file_url_rejects_unsafe_schemes(client, auth_headers):
    """A student-controlled URL must not reach staff as a clickable link.

    The submission URL is rendered as an ``href`` in the instructor's
    grading view, so only http(s) URLs and same-origin paths are accepted.
    """
    _, assignment_id = _assignable_assignment(client, auth_headers)

    unsafe_urls = [
        "javascript:alert(document.cookie)",
        "JaVaScRiPt:alert(1)",
        "java\nscript:alert(1)",
        "data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==",
        "file:///etc/passwd",
        "vbscript:msgbox(1)",
        "//evil.example/payload.exe",
        "/\\evil.example/payload.exe",
        "ftp://example.com/secret.txt",
    ]

    for url in unsafe_urls:
        response = client.post(
            f"/api/v1/courses/assignments/{assignment_id}/submit",
            headers=auth_headers["student"],
            json={
                "file_url": url,
                "file_name": "work.zip",
                "file_size_bytes": 1024,
            },
        )
        assert response.status_code == 422, f"{url!r} was accepted: {response.text}"


def test_submission_accepts_safe_file_urls(client, auth_headers):
    """http(s) URLs and same-origin paths are still accepted and stored."""
    _, assignment_id = _assignable_assignment(client, auth_headers)

    for url in (
        "https://example.com/work.zip",
        "http://example.com/work.zip",
        "/uploads/deadbeef.zip",
    ):
        response = client.post(
            f"/api/v1/courses/assignments/{assignment_id}/submit",
            headers=auth_headers["student"],
            json={
                "file_url": url,
                "file_name": "work.zip",
                "file_size_bytes": 1024,
            },
        )
        assert response.status_code in (200, 201), f"{url!r} was rejected: {response.text}"
        assert response.json()["file_url"] == url
