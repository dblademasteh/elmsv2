"""Announcements, notification read-state, and discussion tests."""
import uuid


def test_announcement_visibility_and_permissions(client, auth_headers):
    # Admin posts platform-wide
    platform = client.post(
        "/api/v1/announcements/",
        headers=auth_headers["admin"],
        json={"title": f"Platform News {uuid.uuid4().hex[:6]}", "body": "Visible to everyone"},
    )
    assert platform.status_code == 201
    assert platform.json()["course_id"] is None

    # Instructor posts to their course
    course = client.post(
        "/api/v1/courses/",
        headers=auth_headers["instructor"],
        json={"title": f"Announcement Course {uuid.uuid4().hex[:6]}", "price_cents": 0},
    )
    course_id = course.json()["id"]
    scoped = client.post(
        "/api/v1/announcements/",
        headers=auth_headers["instructor"],
        json={"title": "Course update", "body": "New lesson added", "course_id": course_id},
    )
    assert scoped.status_code == 201

    # Instructor cannot post platform-wide
    denied = client.post(
        "/api/v1/announcements/",
        headers=auth_headers["instructor"],
        json={"title": "Global attempt", "body": "should fail"},
    )
    assert denied.status_code == 400

    # Student cannot post
    forbidden = client.post(
        "/api/v1/announcements/",
        headers=auth_headers["student"],
        json={"title": "Student post", "body": "nope", "course_id": course_id},
    )
    assert forbidden.status_code == 403

    # Student (not enrolled in that course) sees platform-wide only
    visible = client.get("/api/v1/announcements/", headers=auth_headers["outsider"]).json()
    titles = [a["title"] for a in visible]
    assert any(t.startswith("Platform News") for t in titles)
    assert "Course update" not in titles


def test_notifications_read_state(client, auth_headers):
    # Generate a notification by posting a platform-wide announcement (visible
    # via feed) is not a notification; instead use read-all on whatever exists.
    before = client.get("/api/v1/notifications/", headers=auth_headers["student"]).json()
    assert "unread_count" in before

    read_all = client.post("/api/v1/notifications/read-all", headers=auth_headers["student"])
    assert read_all.status_code == 200

    after = client.get("/api/v1/notifications/", headers=auth_headers["student"]).json()
    assert after["unread_count"] == 0


def test_discussion_flow_and_access_control(client, auth_headers):
    course = client.post(
        "/api/v1/courses/",
        headers=auth_headers["instructor"],
        json={"title": f"Discussion Course {uuid.uuid4().hex[:6]}", "price_cents": 0},
    )
    course_id = course.json()["id"]
    client.put(
        f"/api/v1/courses/{course_id}", headers=auth_headers["instructor"], json={"status": "published"}
    )

    # Non-enrolled user denied
    denied = client.get(f"/api/v1/discussions/course/{course_id}", headers=auth_headers["outsider"])
    assert denied.status_code == 403

    client.post(
        "/api/v1/enrollments/", headers=auth_headers["student"], json={"course_id": course_id}
    )

    # Enrolled student creates a thread
    thread = client.post(
        f"/api/v1/discussions/course/{course_id}",
        headers=auth_headers["student"],
        json={"title": "How does grading work?", "body": "Asking for a friend."},
    )
    assert thread.status_code == 201
    thread_id = thread.json()["id"]

    # Instructor replies -> student notified
    reply = client.post(
        f"/api/v1/discussions/{thread_id}/posts",
        headers=auth_headers["instructor"],
        json={"body": "Automatically on submission."},
    )
    assert reply.status_code == 201

    notifications = client.get("/api/v1/notifications/", headers=auth_headers["student"]).json()
    discussion_notes = [n for n in notifications["notifications"] if n["type"] == "discussion"]
    assert any("How does grading work?" in n["title"] for n in discussion_notes)

    # Thread detail shows both posts with roles
    detail = client.get(f"/api/v1/discussions/{thread_id}", headers=auth_headers["student"]).json()
    assert [p["author_role"] for p in detail["posts"]] == ["student", "instructor"]

    # Student cannot delete the instructor's post
    instructor_post = detail["posts"][1]["id"]
    delete = client.delete(
        f"/api/v1/discussions/posts/{instructor_post}", headers=auth_headers["student"]
    )
    assert delete.status_code == 403

    # Instructor moderates the student's post
    student_post = detail["posts"][0]["id"]
    moderate = client.delete(
        f"/api/v1/discussions/posts/{student_post}", headers=auth_headers["instructor"]
    )
    assert moderate.status_code == 200

    # Author deletes the thread
    cleanup = client.delete(f"/api/v1/discussions/{thread_id}", headers=auth_headers["student"])
    assert cleanup.status_code == 200
