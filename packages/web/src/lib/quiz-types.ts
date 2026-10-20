export type QuestionType =
  | "multiple_choice"
  | "enumeration"
  | "identification"
  | "true_false"
  | "essay"

export type QuizType = QuestionType

export const QUIZ_TYPES: { value: QuizType; label: string }[] = [
  { value: "multiple_choice", label: "Multiple Choice" },
  { value: "enumeration", label: "Enumeration" },
  { value: "identification", label: "Identification" },
  { value: "true_false", label: "True / False" },
  { value: "essay", label: "Essay" },
]

/** Types whose answers are compared against an answer key automatically. */
export const AUTO_GRADED_TYPES: QuestionType[] = [
  "multiple_choice",
  "enumeration",
  "identification",
  "true_false",
]

/** Types an instructor has to review and award points for. */
export const MANUAL_GRADED_TYPES: QuestionType[] = ["essay"]

export const QUESTION_TYPE_LABELS: Record<string, string> = {
  multiple_choice: "Multiple Choice",
  enumeration: "Enumeration",
  identification: "Identification",
  true_false: "True / False",
  essay: "Essay",
  short_answer: "Short Answer",
}

/** Questions authored before the taxonomy existed are stored as short answers. */
export function normalizeQuestionType(type?: string): QuestionType {
  if (!type) return "multiple_choice"
  if (type === "short_answer") return "enumeration"
  if (type in QUESTION_TYPE_LABELS) return type as QuestionType
  return "multiple_choice"
}

export function questionTypeLabel(type?: string): string {
  return QUESTION_TYPE_LABELS[type || ""] || "Question"
}
