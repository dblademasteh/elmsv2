"""Quiz workflow tests: type taxonomy, grading, answer keys, manual review."""
import os
import uuid

import sqlalchemy as sa

QUIZES = "/api/v1/courses/quizzes"

AUTO_QUESTIONS = [
    {
        "id": "q_mc",
        "type": "multiple_choice",
        "question": "Which city is the capital of France?",
        "options": ["Berlin", "Paris", "Madrid"],
        "correct_answer": 1,
        "points": 1,
    },
    {
        "id": "q_enum",
        "type": "enumeration",
        "question": "Name a primary colour",
        "correct_answer": "red",
        "points": 1,
    },
    {
        "id": "q_ident",
        "type": "identification",
        "question": "Identify the process plants use to make food",
        "correct_answer": "Photosynthesis",
        "points": 1,
    },
    {
        "id": "q_tf",
        "type": "true_false",
        "question": "Water boils at 100C at sea level",
        "correct_answer": "true",
        "points": 1,
    },
]

CORRECT_ANSWERS = [
    {"question_id": "q_mc", "answer": "1", "answer_index": 1},
    {"question_id": "q_enum", "answer": "  Red  "},
    {"question_id": "q_ident", "answer": "photosynthesis"},
    {"question_id": "q_tf", "answer": "true"},
]

WRONG_ANSWERS = [
    {"question_id": "q_mc", "answer": "0", "answer_index": 0},
    {"question_id": "q_enum", "answer": "green"},
    {"question_id": "q_ident", "answer": "respiration"},
    {"question_id": "q_tf", "answer": "false"},
]


def _create_course(client, headers):
    response = client.post(
        "/api/v1/courses/",
        headers=headers,
        json={
            "title": f"Quiz Course {uuid.uuid4().hex[:6]}",
            "short_description": "Quiz test course",
            "description": "Created by the automated suite",
            "level": "beginner",
            "price_cents": 0,
        },
    )
    assert response.status_code == 201, response.text
    course = response.json()
    client.put(
        f"/api/v1/courses/{course['id']}", headers=headers, json={"status": "published"}
    )
    return course


def _create_lesson(client, headers, course_id):
    response = client.post(
        "/api/v1/courses/lessons",
        headers=headers,
        json={"course_id": course_id, "title": "Quiz Lesson", "position": 0},
    )
    assert response.status_code == 201, response.text
    return response.json()


def _create_quiz(client, headers, lesson_id, questions, quiz_type="multiple_choice", **extra):
    payload = {
        "lesson_id": lesson_id,
        "title": f"Quiz {uuid.uuid4().hex[:6]}",
        "questions": questions,
        "quiz_type": quiz_type,
        "passing_grade": 50,
    }
    payload.update(extra)
    response = client.post(f"{QUIZES}", headers=headers, json=payload)
    assert response.status_code == 201, response.text
    return response.json()


def _enroll(client, headers, course_id):
    response = client.post(
        "/api/v1/enrollments/", headers=headers, json={"course_id": course_id}
    )
    assert response.status_code in (200, 201), response.text


def _submit(client, headers, quiz_id, answers):
    start = client.post(f"{QUIZES}/{quiz_id}/start", headers=headers, json={})
    assert start.status_code == 200, start.text
    attempt_id = start.json()["attempt_id"]
    response = client.post(
        f"{QUIZES}/{quiz_id}/attempt",
        headers=headers,
        json={"attempt_id": attempt_id, "answers": answers},
    )
    return response


def _clear_quiz_settings(quiz_id):
    """Simulate a legacy row that predates the quiz settings columns.

    The constraints are dropped for the test database so the row can hold the
    NULLs an un-migrated database would still contain.
    """
    columns = (
        "max_attempts",
        "passing_grade",
        "randomize_questions",
        "show_results",
        "allow_retry",
        "quiz_type",
    )
    engine = sa.create_engine(os.environ["ALEMBIC_DATABASE_URL"])
    with engine.begin() as conn:
        for column in columns:
            conn.execute(
                sa.text(f"ALTER TABLE quizzes ALTER COLUMN {column} DROP NOT NULL")
            )
        conn.execute(
            sa.text(
                "UPDATE quizzes SET max_attempts = NULL, passing_grade = NULL, "
                "randomize_questions = NULL, show_results = NULL, allow_retry = NULL, "
                "quiz_type = NULL WHERE id = :id"
            ),
            {"id": quiz_id},
        )
    engine.dispose()


def test_quiz_type_is_persisted_and_updatable(client, auth_headers):
    course = _create_course(client, auth_headers["instructor"])
    lesson = _create_lesson(client, auth_headers["instructor"], course["id"])

    quiz = _create_quiz(
        client, auth_headers["instructor"], lesson["id"], AUTO_QUESTIONS, quiz_type="essay"
    )
    assert quiz["quiz_type"] == "essay"

    fetched = client.get(f"{QUIZES}/{quiz['id']}", headers=auth_headers["instructor"]).json()
    assert fetched["quiz_type"] == "essay"

    updated = client.put(
        f"{QUIZES}/{quiz['id']}",
        headers=auth_headers["instructor"],
        json={"quiz_type": "enumeration"},
    )
    assert updated.status_code == 200, updated.text
    assert updated.json()["quiz_type"] == "enumeration"

    fetched = client.get(f"{QUIZES}/{quiz['id']}", headers=auth_headers["instructor"]).json()
    assert fetched["quiz_type"] == "enumeration"


def test_quiz_settings_can_be_updated_and_cleared(client, auth_headers):
    course = _create_course(client, auth_headers["instructor"])
    lesson = _create_lesson(client, auth_headers["instructor"], course["id"])
    quiz = _create_quiz(
        client,
        auth_headers["instructor"],
        lesson["id"],
        AUTO_QUESTIONS,
        time_limit_seconds=600,
    )
    assert quiz["time_limit_seconds"] == 600

    updated = client.put(
        f"{QUIZES}/{quiz['id']}",
        headers=auth_headers["instructor"],
        json={"time_limit_seconds": None, "show_results": False},
    )
    assert updated.status_code == 200, updated.text
    body = updated.json()
    assert body["time_limit_seconds"] is None
    assert body["show_results"] is False


def test_unsupported_quiz_type_is_rejected(client, auth_headers):
    course = _create_course(client, auth_headers["instructor"])
    lesson = _create_lesson(client, auth_headers["instructor"], course["id"])

    response = client.post(
        f"{QUIZES}",
        headers=auth_headers["instructor"],
        json={
            "lesson_id": lesson["id"],
            "title": "Bad type quiz",
            "questions": AUTO_QUESTIONS,
            "quiz_type": "fill_in_the_blank",
        },
    )
    assert response.status_code == 422, response.text


def test_answer_key_is_not_exposed_to_students(client, auth_headers):
    course = _create_course(client, auth_headers["instructor"])
    lesson = _create_lesson(client, auth_headers["instructor"], course["id"])
    quiz = _create_quiz(client, auth_headers["instructor"], lesson["id"], AUTO_QUESTIONS)
    _enroll(client, auth_headers["student"], course["id"])

    student_view = client.get(f"{QUIZES}/{quiz['id']}", headers=auth_headers["student"])
    assert student_view.status_code == 200, student_view.text
    for question in student_view.json()["questions"]:
        assert "correct_answer" not in question

    instructor_view = client.get(
        f"{QUIZES}/{quiz['id']}", headers=auth_headers["instructor"]
    ).json()
    assert instructor_view["questions"][0]["correct_answer"] == 1


def test_auto_graded_questions_score_correctly(client, auth_headers):
    course = _create_course(client, auth_headers["instructor"])
    lesson = _create_lesson(client, auth_headers["instructor"], course["id"])
    quiz = _create_quiz(client, auth_headers["instructor"], lesson["id"], AUTO_QUESTIONS)
    _enroll(client, auth_headers["student"], course["id"])

    response = _submit(client, auth_headers["student"], quiz["id"], CORRECT_ANSWERS)
    assert response.status_code == 200, response.text
    result = response.json()
    assert result["score"] == 100.0
    assert result["earned_points"] == 4
    assert result["total_points"] == 4
    assert result["passed"] is True
    assert result["needs_review"] is False

    # A second attempt with wrong answers scores zero
    response = _submit(client, auth_headers["student"], quiz["id"], WRONG_ANSWERS)
    assert response.status_code == 200, response.text
    result = response.json()
    assert result["score"] == 0.0
    assert result["passed"] is False


def test_enumeration_accepts_multiple_answers(client, auth_headers):
    course = _create_course(client, auth_headers["instructor"])
    lesson = _create_lesson(client, auth_headers["instructor"], course["id"])
    questions = [
        {
            "id": "q_alt",
            "type": "enumeration",
            "question": "Name the capital of France",
            "correct_answer": "Paris | Paris, France",
            "points": 5,
        }
    ]
    quiz = _create_quiz(client, auth_headers["instructor"], lesson["id"], questions)
    _enroll(client, auth_headers["student"], course["id"])

    response = _submit(
        client,
        auth_headers["student"],
        quiz["id"],
        [{"question_id": "q_alt", "answer": "paris, france"}],
    )
    assert response.status_code == 200, response.text
    assert response.json()["score"] == 100.0


def test_enumeration_accepts_the_listed_items_in_any_separator(client, auth_headers):
    """An enumeration key may list the items the student has to produce.

    The student writes the list with whichever separator they reach for, so
    the grader has to compare the items, not the raw string.
    """
    course = _create_course(client, auth_headers["instructor"])
    lesson = _create_lesson(client, auth_headers["instructor"], course["id"])
    questions = [
        {
            "id": "q_list",
            "type": "enumeration",
            "question": "List the first three prime numbers",
            "correct_answer": "2|3|5",
            "points": 5,
        }
    ]
    quiz = _create_quiz(
        client,
        auth_headers["instructor"],
        lesson["id"],
        questions,
        max_attempts=20,
        allow_retry=True,
    )
    _enroll(client, auth_headers["student"], course["id"])

    for answer in ("2, 3, 5", "2|3|5", "2;3;5", " 2 , 3 , 5 "):
        response = _submit(
            client,
            auth_headers["student"],
            quiz["id"],
            [{"question_id": "q_list", "answer": answer}],
        )
        assert response.status_code == 200, response.text
        assert response.json()["score"] == 100.0, f"answer {answer!r} was graded wrong"

    # A wrong list, a missing item and the wrong order are still wrong.
    for answer in ("2, 3", "2, 5, 3", "4, 6, 8"):
        response = _submit(
            client,
            auth_headers["student"],
            quiz["id"],
            [{"question_id": "q_list", "answer": answer}],
        )
        assert response.status_code == 200, response.text
        assert response.json()["score"] == 0.0, f"answer {answer!r} was graded correct"


def test_essay_attempt_awaits_instructor_review(client, auth_headers):
    course = _create_course(client, auth_headers["instructor"])
    lesson = _create_lesson(client, auth_headers["instructor"], course["id"])
    questions = [
        {
            "id": "q_essay",
            "type": "essay",
            "question": "Explain why the sky is blue",
            "points": 10,
        }
    ]
    quiz = _create_quiz(
        client, auth_headers["instructor"], lesson["id"], questions, quiz_type="essay"
    )
    _enroll(client, auth_headers["student"], course["id"])

    response = _submit(
        client,
        auth_headers["student"],
        quiz["id"],
        [{"question_id": "q_essay", "answer": "Rayleigh scattering"}],
    )
    assert response.status_code == 200, response.text
    result = response.json()
    assert result["needs_review"] is True
    assert result["score"] is None
    assert result["passed"] is False

    # The instructor sees the attempt and the student's answer
    attempts = client.get(f"{QUIZES}/{quiz['id']}/attempts", headers=auth_headers["instructor"])
    assert attempts.status_code == 200, attempts.text
    attempt = attempts.json()[0]
    assert attempt["needs_review"] is True
    assert attempt["answers"][0]["answer"] == "Rayleigh scattering"

    # Students cannot grade
    forbidden = client.put(
        f"{QUIZES}/attempts/{attempt['id']}/grade",
        headers=auth_headers["student"],
        json={"points": 10},
    )
    assert forbidden.status_code == 403, forbidden.text

    # The instructor awards points for the written question
    graded = client.put(
        f"{QUIZES}/attempts/{attempt['id']}/grade",
        headers=auth_headers["instructor"],
        json={"points": 8, "feedback": "Good explanation"},
    )
    assert graded.status_code == 200, graded.text
    body = graded.json()
    assert body["score"] == 80.0
    assert body["passed"] is True
    assert body["needs_review"] is False
    assert body["feedback"] == "Good explanation"
    assert body["graded_by"] is not None

    # The student now sees the final score
    student_attempts = client.get(
        f"{QUIZES}/{quiz['id']}/attempts", headers=auth_headers["student"]
    ).json()
    assert student_attempts[0]["score"] == 80.0
    assert student_attempts[0]["needs_review"] is False


def test_hidden_results_are_not_revealed_to_students(client, auth_headers):
    course = _create_course(client, auth_headers["instructor"])
    lesson = _create_lesson(client, auth_headers["instructor"], course["id"])
    quiz = _create_quiz(
        client,
        auth_headers["instructor"],
        lesson["id"],
        AUTO_QUESTIONS,
        show_results=False,
    )
    _enroll(client, auth_headers["student"], course["id"])

    response = _submit(client, auth_headers["student"], quiz["id"], CORRECT_ANSWERS)
    assert response.status_code == 200, response.text
    result = response.json()
    assert result["results_hidden"] is True
    assert result["score"] is None

    student_attempts = client.get(
        f"{QUIZES}/{quiz['id']}/attempts", headers=auth_headers["student"]
    ).json()
    assert student_attempts[0]["score"] is None
    assert student_attempts[0]["grade"] is None

    # Staff still see the real result
    staff_attempts = client.get(
        f"{QUIZES}/{quiz['id']}/attempts", headers=auth_headers["instructor"]
    ).json()
    assert staff_attempts[0]["score"] == 100.0


def test_student_cannot_take_quiz_without_enrollment(client, auth_headers):
    course = _create_course(client, auth_headers["instructor"])
    lesson = _create_lesson(client, auth_headers["instructor"], course["id"])
    quiz = _create_quiz(client, auth_headers["instructor"], lesson["id"], AUTO_QUESTIONS)

    response = client.post(f"{QUIZES}/{quiz['id']}/start", headers=auth_headers["student"], json={})
    assert response.status_code == 403, response.text


def test_start_reports_the_attempt_in_use(client, auth_headers):
    course = _create_course(client, auth_headers["instructor"])
    lesson = _create_lesson(client, auth_headers["instructor"], course["id"])
    quiz = _create_quiz(client, auth_headers["instructor"], lesson["id"], AUTO_QUESTIONS)
    _enroll(client, auth_headers["student"], course["id"])

    response = client.post(
        f"{QUIZES}/{quiz['id']}/start", headers=auth_headers["student"], json={}
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["attempts_used"] == 1
    assert body["attempt_number"] == 1

    # Resuming the same attempt must not consume another one
    again = client.post(
        f"{QUIZES}/{quiz['id']}/start", headers=auth_headers["student"], json={}
    )
    assert again.status_code == 200, again.text
    assert again.json()["attempts_used"] == 1
    assert again.json()["attempt_id"] == body["attempt_id"]


def test_legacy_quiz_rows_without_settings_still_work(client, auth_headers):
    course = _create_course(client, auth_headers["instructor"])
    lesson = _create_lesson(client, auth_headers["instructor"], course["id"])
    quiz = _create_quiz(client, auth_headers["instructor"], lesson["id"], AUTO_QUESTIONS)
    _enroll(client, auth_headers["student"], course["id"])

    _clear_quiz_settings(quiz["id"])

    detail = client.get(f"{QUIZES}/{quiz['id']}", headers=auth_headers["instructor"])
    assert detail.status_code == 200, detail.text
    body = detail.json()
    assert body["max_attempts"] == 3
    assert body["passing_grade"] == 70.0
    assert body["show_results"] is True
    assert body["allow_retry"] is True
    assert body["quiz_type"] == "multiple_choice"

    # Starting and submitting must not blow up on the missing settings
    result = _submit(client, auth_headers["student"], quiz["id"], CORRECT_ANSWERS)
    assert result.status_code == 200, result.text
    assert result.json()["score"] == 100.0
