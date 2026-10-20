"""Canonical quiz/question types and shared normalization helpers.

A single taxonomy is used by the API, the grading engine and the web client so
authoring, delivery and grading never disagree about what a question type
means.
"""
from typing import Any, Dict, Iterable, List, Optional, Sequence
import re

MULTIPLE_CHOICE = "multiple_choice"
ENUMERATION = "enumeration"
IDENTIFICATION = "identification"
TRUE_FALSE = "true_false"
ESSAY = "essay"

QUIZ_TYPES: Sequence[str] = (
    MULTIPLE_CHOICE,
    ENUMERATION,
    IDENTIFICATION,
    TRUE_FALSE,
    ESSAY,
)

# Type used by quizzes authored before the taxonomy was introduced.
LEGACY_SHORT_ANSWER = "short_answer"

# Types that always require a human grader.
MANUAL_GRADING_TYPES = frozenset({ESSAY})

TRUE_FALSE_ALIASES = {
    "true": "true",
    "t": "true",
    "yes": "true",
    "y": "true",
    "1": "true",
    "false": "false",
    "f": "false",
    "no": "false",
    "n": "false",
    "0": "false",
}


def normalize_question_type(qtype: Optional[str]) -> str:
    """Map a stored question type onto the canonical taxonomy."""
    if not qtype:
        return MULTIPLE_CHOICE
    value = str(qtype).strip().lower()
    if value == LEGACY_SHORT_ANSWER:
        return ENUMERATION
    return value


def is_valid_quiz_type(qtype: Optional[str]) -> bool:
    """Whether a value is one of the supported quiz/exam types."""
    return bool(qtype) and str(qtype).strip().lower() in QUIZ_TYPES


def normalize_text(value: Any) -> str:
    """Normalize a free-text answer: trimmed, whitespace-collapsed, lowercased."""
    if value is None:
        return ""
    return " ".join(str(value).split()).lower()


def normalize_bool(value: Any) -> str:
    """Normalize a true/false answer to 'true' or 'false'."""
    text = normalize_text(value)
    return TRUE_FALSE_ALIASES.get(text, text)


def normalize_points(points: Any) -> int:
    """Coerce a question's point value to a non-negative integer."""
    try:
        value = int(float(points))
    except (TypeError, ValueError):
        return 1
    return max(value, 0)


def accepted_answers(correct: Any) -> List[str]:
    """Accepted answers for a free-text question.

    A question may list several acceptable answers, either as a list or as a
    single string using '|' as the separator.
    """
    if correct is None:
        return []
    raw = list(correct) if isinstance(correct, (list, tuple, set)) else [correct]
    accepted: List[str] = []
    for item in raw:
        for part in str(item).split("|"):
            normalized = normalize_text(part)
            if normalized and normalized not in accepted:
                accepted.append(normalized)
    return accepted


def split_answer_items(value: Any) -> List[str]:
    """Split a free-text answer into the items it lists.

    Students separate the items of an enumeration answer with whatever
    separator they reach for first (',', ';', '|' or a newline), so the
    comparison has to be independent of the separator used.
    """
    if value is None:
        return []
    if isinstance(value, (list, tuple, set)):
        raw_items = [str(item) for item in value]
    else:
        raw_items = re.split(r"[|;,\n\r]+", str(value))
    items: List[str] = []
    for item in raw_items:
        normalized = normalize_text(item)
        if normalized and normalized not in items:
            items.append(normalized)
    return items


def normalize_questions(questions: Optional[Iterable[Any]]) -> List[Dict[str, Any]]:
    """Normalize authored/stored questions into a consistent structure.

    Guarantees every question has a unique id, a canonical type and a
    non-negative integer point value, so grading can rely on the shape.
    """
    normalized: List[Dict[str, Any]] = []
    used_ids = set()

    for raw in questions or []:
        if not isinstance(raw, dict):
            continue

        question = dict(raw)
        qid = str(question.get("id") or "").strip()
        if not qid or qid in used_ids:
            qid = f"q_{uuid4_hex()}"
        used_ids.add(qid)

        question["id"] = qid
        question["type"] = normalize_question_type(question.get("type"))
        question["points"] = normalize_points(question.get("points"))

        options = question.get("options")
        if isinstance(options, list) and question["type"] == MULTIPLE_CHOICE:
            question["options"] = [str(option) for option in options]
        else:
            # Only multiple choice questions carry options
            question["options"] = None

        correct = question.get("correct_answer")
        if question["type"] in MANUAL_GRADING_TYPES:
            # Written questions are graded by a human, there is no answer key
            correct = None
        elif isinstance(correct, bool):
            correct = str(correct).lower()
        elif isinstance(correct, (int, float)):
            correct = int(correct) if question["type"] == MULTIPLE_CHOICE else str(correct)
        elif isinstance(correct, (list, tuple)):
            correct = [str(item) for item in correct]
        elif correct is not None:
            correct = str(correct)
        question["correct_answer"] = correct

        normalized.append(question)

    return normalized


def uuid4_hex() -> str:
    """Short random identifier used for questions without an id."""
    import uuid

    return uuid.uuid4().hex[:8]
