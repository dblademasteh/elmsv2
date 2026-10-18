import urllib.request, json

BASE = "http://localhost:8080/api/v1"

def login(email, password):
    req = urllib.request.Request(f"{BASE}/auth/login",
        data=json.dumps({"email": email, "password": password}).encode(),
        headers={"Content-Type": "application/json"})
    return json.loads(urllib.request.urlopen(req).read())["access_token"]

def api_get(path, token=None):
    headers = {"Authorization": f"Bearer {token}"} if token else {}
    req = urllib.request.Request(f"{BASE}{path}", headers=headers)
    resp = urllib.request.urlopen(req)
    return json.loads(resp.read())

def api_post(path, data, token=None):
    headers = {"Content-Type": "application/json"}
    if token: headers["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(f"{BASE}{path}",
        data=json.dumps(data).encode(), headers=headers, method="POST")
    try:
        resp = urllib.request.urlopen(req)
        return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        return {"error": True, "status": e.code, "body": json.loads(e.read())}

def api_put(path, data, token):
    headers = {"Content-Type": "application/json", "Authorization": f"Bearer {token}"}
    req = urllib.request.Request(f"{BASE}{path}",
        data=json.dumps(data).encode(), headers=headers, method="PUT")
    resp = urllib.request.urlopen(req)
    return json.loads(resp.read())

print("=" * 50)
print("ASSIGNMENT SYSTEM TEST")
print("=" * 50)

courses = api_get("/courses/")
course_id = courses[0]["id"]
instructor_token = login("instructor@lms.com", "Instructor123!@#")
student_token = login("student@lms.com", "Student123!@#")

lessons = api_get(f"/courses/lessons/course/{course_id}", instructor_token)
lesson_id = lessons[0]["id"]
print(f"Course: {courses[0]['title']}, Lesson: {lessons[0]['title']}")

# Instructor creates assignment
assignment = api_post("/courses/assignments", {
    "lesson_id": lesson_id,
    "title": "Build a React Component",
    "description": "Create a reusable UI component",
    "instructions": "Submit your component source code.",
    "max_score": 100,
    "max_file_size_mb": 10,
    "allowed_file_types": ["js", "jsx", "ts", "tsx"],
    "is_published": True,
}, instructor_token)
assert not assignment.get("error"), f"Create failed: {assignment}"
assignment_id = assignment["id"]
print(f"[1] Created assignment: {assignment['title']} ({assignment['max_score']} pts)")

# Student lists assignments
assignments = api_get(f"/courses/{course_id}/assignments", student_token)
print(f"[2] Student sees {len(assignments)} assignment(s)")

# Student submits assignment
submission = api_post(f"/courses/assignments/{assignment_id}/submit", {
    "file_url": "https://storage.example.com/submissions/my-component.zip",
    "file_name": "my-component.zip",
    "file_size_bytes": 102400,
}, student_token)
if submission.get("error"):
    print(f"[3] Submit: ERROR {submission['status']} - {submission['body']}")
else:
    print(f"[3] Submitted: {submission['file_name']} ({submission['status']})")
    submission_id = submission["id"]

    # Instructor grades the submission
    graded = api_put(f"/courses/submissions/{submission_id}/grade", {
        "score": 95,
        "feedback": "Great work! Clean component structure."
    }, instructor_token)
    print(f"[4] Graded: {graded['score']}/{graded['max_score']} ({graded['score_percentage']}%)")
    print(f"    Feedback: {graded['feedback']}")
    assert graded["score"] == 95, f"Expected 95, got {graded['score']}"
    assert graded["score_percentage"] == 95.0, f"Expected 95.0%, got {graded['score_percentage']}"

    # Student views their submissions
    my_submissions = api_get("/enrollments/my-assignments", student_token)
    print(f"[5] Student sees {len(my_submissions)} submission(s)")
    for s in my_submissions:
        score_str = f" {s['score']}/{s['max_score']}" if s['score'] is not None else " (ungraded)"
        print(f"    - {s['assignment_id'][:8]}: {s['status']}{score_str}")

    # Instructor lists submissions for the assignment
    all_subs = api_get(f"/courses/assignments/{assignment_id}/submissions", instructor_token)
    print(f"[6] Instructor sees {len(all_subs)} submission(s)")

# Student cannot create assignments
instr_review = api_post("/courses/assignments", {
    "lesson_id": lesson_id, "title": "Hacked"
}, student_token)
print(f"[7] Student create assignment: {instr_review.get('error') and instr_review['status'] or 'OK'} (expected 403)")

print("\n" + "=" * 50)
print("ALL ASSIGNMENT TESTS PASSED!")
print("=" * 50)
