"""Course and lesson tests: authoring, publish, search, sections."""
import uuid


def _create_course(client, headers, title, level="beginner", price_cents=4900):
    response = client.post(
        "/api/v1/courses/",
        headers=headers,
        json={
            "title": title,
            "short_description": "Test course",
            "description": "Created by the automated suite",
            "level": level,
            "price_cents": price_cents,
        },
    )
    assert response.status_code == 201, response.text
    return response.json()


def _publish(client, headers, course_id):
    response = client.put(
        f"/api/v1/courses/{course_id}", headers=headers, json={"status": "published"}
    )
    assert response.status_code == 200


def test_instructor_create_publish_and_list(client, auth_headers):
    title = f"Searchable Course {uuid.uuid4().hex[:6]}"
    course = _create_course(client, auth_headers["instructor"], title)
    course_id = course["id"]
    assert course["status"] == "draft"

    # Draft is not publicly visible
    public = client.get("/api/v1/courses/")
    assert all(c["id"] != course_id for c in public.json())

    # But it is visible to its instructor via mine=true
    mine = client.get("/api/v1/courses/?mine=true", headers=auth_headers["instructor"])
    assert any(c["id"] == course_id for c in mine.json())

    _publish(client, auth_headers["instructor"], course_id)

    public = client.get("/api/v1/courses/")
    assert any(c["id"] == course_id for c in public.json())


def test_admin_mine_list_includes_own_drafts(client, auth_headers):
    title = f"Admin Draft {uuid.uuid4().hex[:6]}"
    course = _create_course(client, auth_headers["admin"], title)
    course_id = course["id"]
    assert course["status"] == "draft"

    # The admin's own draft must be listed, otherwise a newly created
    # course disappears from "My Courses" right after saving it.
    mine = client.get("/api/v1/courses/?mine=true", headers=auth_headers["admin"])
    assert any(c["id"] == course_id for c in mine.json())

    # Drafts of other instructors stay out of the admin's list.
    other = _create_course(client, auth_headers["instructor"], f"Instructor Draft {uuid.uuid4().hex[:6]}")
    mine = client.get("/api/v1/courses/?mine=true", headers=auth_headers["admin"])
    assert all(c["id"] != other["id"] for c in mine.json())


def test_course_search_filter_and_sort(client, auth_headers):
    unique = uuid.uuid4().hex[:8]
    cheap = _create_course(
        client, auth_headers["instructor"], f"Zebra Basics {unique}", "beginner", 0
    )
    _publish(client, auth_headers["instructor"], cheap["id"])

    found = client.get(f"/api/v1/courses/?search=Zebra Basics {unique}")
    assert found.status_code == 200
    assert [c["id"] for c in found.json()] == [cheap["id"]]

    free = client.get("/api/v1/courses/?max_price_cents=0&search=Zebra")
    assert any(c["id"] == cheap["id"] for c in free.json())

    paid_only = client.get("/api/v1/courses/?min_price_cents=1&search=Zebra")
    assert all(c["id"] != cheap["id"] for c in paid_only.json())

    by_price = client.get("/api/v1/courses/?sort=price_asc&search=Zebra")
    prices = [c["price_cents"] for c in by_price.json()]
    assert prices == sorted(prices)


def test_student_cannot_create_course(client, auth_headers):
    response = client.post(
        "/api/v1/courses/",
        headers=auth_headers["student"],
        json={"title": "Student Course", "price_cents": 0},
    )
    assert response.status_code == 403


def test_lesson_sections(client, auth_headers):
    course = _create_course(client, auth_headers["instructor"], f"Sections Course {uuid.uuid4().hex[:6]}")
    course_id = course["id"]

    create = client.post(
        "/api/v1/courses/lessons",
        headers=auth_headers["instructor"],
        json={
            "course_id": course_id,
            "title": "Setup & Install",
            "section_title": "Getting Started",
            "position": 0,
        },
    )
    assert create.status_code == 201
    lesson = create.json()
    assert lesson["section_title"] == "Getting Started"

    lessons = client.get(
        f"/api/v1/courses/lessons/course/{course_id}", headers=auth_headers["instructor"]
    ).json()
    assert any(l["id"] == lesson["id"] and l["section_title"] == "Getting Started" for l in lessons)

    update = client.put(
        f"/api/v1/courses/lessons/{lesson['id']}",
        headers=auth_headers["instructor"],
        json={"section_title": "Setup"},
    )
    assert update.status_code == 200
    assert update.json()["section_title"] == "Setup"


def test_course_detail_includes_lessons(client, auth_headers):
    course = _create_course(client, auth_headers["instructor"], f"Detail Course {uuid.uuid4().hex[:6]}")
    lesson = client.post(
        "/api/v1/courses/lessons",
        headers=auth_headers["instructor"],
        json={"course_id": course["id"], "title": "Lesson One"},
    ).json()
    publish = client.put(
        f"/api/v1/courses/lessons/{lesson['id']}",
        headers=auth_headers["instructor"],
        json={"is_published": True},
    )
    assert publish.status_code == 200

    # Draft courses are hidden from the public detail endpoint
    draft = client.get(f"/api/v1/courses/{course['id']}")
    assert draft.status_code == 404

    _publish(client, auth_headers["instructor"], course["id"])
    detail = client.get(f"/api/v1/courses/{course['id']}")
    assert detail.status_code == 200

    # Published lessons are visible via the lessons endpoint (syllabus source)
    lessons = client.get(
        f"/api/v1/courses/lessons/course/{course['id']}", headers=auth_headers["instructor"]
    ).json()
    assert any(l["title"] == "Lesson One" for l in lessons)
