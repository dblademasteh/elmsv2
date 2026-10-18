'use client'

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { useAuthStore } from "@/store/auth"
import { quizApi, lessonApi } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { Plus, Trash2, Save, HelpCircle, AlertCircle } from "lucide-react"
import type { ComponentType } from "react"

type QuestionType = "multiple_choice" | "true_false" | "short_answer"

interface Question {
  id: string
  type: QuestionType
  question: string
  options?: string[]
  correct_answer?: string | number
  points: number
}

interface Quiz {
  id: string
  lesson_id: string
  title: string
  description: string | null
  questions: Question[]
  time_limit_seconds: number | null
  max_attempts: number
  passing_grade: number
  randomize_questions: boolean
  show_results: boolean
  allow_retry: boolean
  created_at: string
}

interface Lesson {
  id: string
  title: string
  position: number
}

const QUESTION_TYPES: { value: QuestionType; label: string; icon: ComponentType<any> }[] = [
  { value: "multiple_choice", label: "Multiple Choice", icon: HelpCircle },
  { value: "true_false", label: "True / False", icon: HelpCircle },
  { value: "short_answer", label: "Short Answer", icon: HelpCircle },
]

export default function QuizManagementPage() {
  const params = useParams()
  const courseId = typeof params?.courseId === "string" ? params.courseId : ""
  const { user, isAuthenticated } = useAuthStore()
  const role = user?.role

  const [lessons, setLessons] = useState<Lesson[]>([])
  const [quizzes, setQuizzes] = useState<Quiz[]>([])
  const [loading, setLoading] = useState(true)
  const [editingQuiz, setEditingQuiz] = useState<Quiz | null>(null)
  const [savingQuiz, setSavingQuiz] = useState<string | null>(null)
  const [deletingQuiz, setDeletingQuiz] = useState<string | null>(null)

  useEffect(() => {
    if (courseId) {
      loadData()
    }
  }, [courseId])

  async function loadData() {
    setLoading(true)
    try {
      const lessonsResp = await lessonApi.listByCourse(courseId)
      if (lessonsResp.data) {
        setLessons(lessonsResp.data.sort((a, b) => a.position - b.position))
      }
      const quizzesResp = await quizApi.getByCourse(courseId)
      if (quizzesResp.data) {
        setQuizzes(quizzesResp.data as unknown as Quiz[])
      }
    } finally {
      setLoading(false)
    }
  }

  const quizzesByLesson = lessons.reduce((acc, lesson) => {
    acc[lesson.id] = quizzes.filter(q => q.lesson_id === lesson.id)
    return acc
  }, {} as Record<string, Quiz[]>)

  function handleCreateQuiz(lessonId: string) {
    const newQuiz: Quiz = {
      id: `new-${lessonId}-${Date.now()}`,
      lesson_id: lessonId,
      title: "",
      description: "",
      questions: [],
      time_limit_seconds: null,
      max_attempts: 3,
      passing_grade: 70,
      randomize_questions: false,
      show_results: true,
      allow_retry: true,
      created_at: new Date().toISOString(),
    }
    setEditingQuiz(newQuiz)
  }

  function handleEditQuiz(quiz: Quiz) {
    setEditingQuiz({ ...quiz })
  }

  async function handleDeleteQuiz(quiz: Quiz) {
    if (!confirm(`Delete quiz "${quiz.title}"?`)) return
    setDeletingQuiz(quiz.id)
    await quizApi.delete(quiz.id)
    setQuizzes(quizzes.filter(q => q.id !== quiz.id))
    setDeletingQuiz(null)
  }

  function addQuestion() {
    if (!editingQuiz) return
    const newQuestion: Question = {
      id: `q-${Date.now()}`,
      type: "multiple_choice",
      question: "",
      options: ["", ""],
      correct_answer: 0,
      points: 1,
    }
    setEditingQuiz({
      ...editingQuiz,
      questions: [...editingQuiz.questions, newQuestion],
    })
  }

  function updateQuestion(qIdx: number, updates: Partial<Question>) {
    if (!editingQuiz) return
    const newQuestions = [...editingQuiz.questions]
    newQuestions[qIdx] = { ...newQuestions[qIdx], ...updates }
    setEditingQuiz({ ...editingQuiz, questions: newQuestions })
  }

  function removeQuestion(qIdx: number) {
    if (!editingQuiz) return
    setEditingQuiz({
      ...editingQuiz,
      questions: editingQuiz.questions.filter((_, i) => i !== qIdx),
    })
  }

  async function saveQuiz() {
    if (!editingQuiz) return
    if (!editingQuiz.title.trim()) {
      alert("Quiz title is required")
      return
    }
    if (editingQuiz.questions.length === 0) {
      alert("Add at least one question")
      return
    }

    setSavingQuiz(editingQuiz.id)
    try {
      if (editingQuiz.id.startsWith("new-")) {
        const resp = await quizApi.create({
          lesson_id: editingQuiz.lesson_id,
          title: editingQuiz.title,
          questions: editingQuiz.questions as unknown as Array<Record<string, unknown>>,
          time_limit_seconds: editingQuiz.time_limit_seconds ?? undefined,
          max_attempts: editingQuiz.max_attempts,
          passing_grade: editingQuiz.passing_grade,
        })
        if (resp.data) {
          setQuizzes([...quizzes, resp.data as unknown as Quiz])
        } else if (resp.error) {
          throw new Error(resp.error)
        }
      } else {
        const resp = await quizApi.update(editingQuiz.id, {
          title: editingQuiz.title,
          description: editingQuiz.description,
          questions: editingQuiz.questions as unknown as Array<Record<string, unknown>>,
          time_limit_seconds: editingQuiz.time_limit_seconds,
          max_attempts: editingQuiz.max_attempts,
          passing_grade: editingQuiz.passing_grade,
          randomize_questions: editingQuiz.randomize_questions,
          show_results: editingQuiz.show_results,
          allow_retry: editingQuiz.allow_retry,
        })
        if (resp.data) {
          setQuizzes(quizzes.map(q => q.id === editingQuiz.id ? (resp.data as unknown as Quiz) : q))
        } else if (resp.error) {
          throw new Error(resp.error)
        }
      }
      setEditingQuiz(null)
    } catch (err) {
      alert(`Failed to save quiz: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setSavingQuiz(null)
    }
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="max-w-7xl mx-auto p-6">
          <div className="h-20 rounded-xl border border-border bg-card animate-pulse mb-6" />
          <div className="grid gap-6 lg:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-48 rounded-xl border border-border bg-card animate-pulse" />
            ))}
          </div>
        </div>
      </DashboardLayout>
    )
  }

  if (!isAuthenticated() || (role !== "admin" && role !== "instructor")) {
    return (
      <DashboardLayout>
        <div className="max-w-4xl mx-auto p-6">
          <Card>
            <CardContent className="pt-6">
              <AlertCircle className="mx-auto h-8 w-8 text-destructive mb-3" />
              <p className="text-center">Only instructors and admins can manage quizzes.</p>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold">Quiz Manager</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Manage quizzes for course lessons
            </p>
          </div>
        </div>

        {lessons.length === 0 ? (
          <Card>
            <CardContent className="pt-6 text-center text-muted-foreground">
              <p>No lessons found for this course. Create lessons first.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {lessons.map((lesson) => {
              const lessonQuizzes = quizzesByLesson[lesson.id] || []
              return (
                <Card key={lesson.id}>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center justify-between">
                      <span>{lesson.title} (Position {lesson.position})</span>
                      <Button size="sm" variant="outline" onClick={() => handleCreateQuiz(lesson.id)}>
                        <Plus className="h-4 w-4 mr-1" /> Add Quiz
                      </Button>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {lessonQuizzes.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No quizzes for this lesson yet.</p>
                    ) : (
                      <div className="space-y-3">
                        {lessonQuizzes.map((quiz) => (
                          <div key={quiz.id} className="flex items-center justify-between p-3 border rounded-lg">
                            <div>
                              <p className="font-medium">{quiz.title}</p>
                              <p className="text-sm text-muted-foreground">
                                {quiz.questions?.length || 0} questions
                                {quiz.time_limit_seconds && ` • ${Math.floor(quiz.time_limit_seconds / 60)} min limit`}
                                {` • Passing: ${quiz.passing_grade}%`}
                              </p>
                            </div>
                            <div className="flex gap-2">
                              <Button size="sm" variant="ghost" onClick={() => handleEditQuiz(quiz)}>
                                Edit
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                disabled={deletingQuiz === quiz.id}
                                onClick={() => handleDeleteQuiz(quiz)}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}

        {/* Quiz Editor Modal */}
        {editingQuiz && (
          <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-card border border-border rounded-xl shadow-xl w-full max-w-5xl max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-border flex items-center justify-between">
                <h2 className="text-xl font-semibold">
                  {editingQuiz.id.startsWith("new-") ? "Create Quiz" : "Edit Quiz"}
                </h2>
                <Button size="sm" variant="ghost" onClick={() => setEditingQuiz(null)}>
                  ×
                </Button>
              </div>

              <div className="p-6 space-y-4">
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium mb-1">Title *</label>
                    <input
                      type="text"
                      value={editingQuiz.title}
                      onChange={(e) => setEditingQuiz({ ...editingQuiz, title: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-border rounded-md bg-background"
                      placeholder="Quiz title"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Description</label>
                    <textarea
                      value={editingQuiz.description || ""}
                      onChange={(e) => setEditingQuiz({ ...editingQuiz, description: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-border rounded-md bg-background"
                      placeholder="Optional description"
                      rows={2}
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">Time Limit (seconds)</label>
                      <input
                        type="number"
                        value={editingQuiz.time_limit_seconds || ""}
                        onChange={(e) => setEditingQuiz({ ...editingQuiz, time_limit_seconds: e.target.value ? parseInt(e.target.value) : null })}
                        className="w-full px-3 py-2 text-sm border border-border rounded-md bg-background"
                        placeholder="No limit"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Passing Grade</label>
                      <input
                        type="number"
                        value={editingQuiz.passing_grade}
                        onChange={(e) => setEditingQuiz({ ...editingQuiz, passing_grade: parseFloat(e.target.value) || 0 })}
                        className="w-full px-3 py-2 text-sm border border-border rounded-md bg-background"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Max Attempts</label>
                      <input
                        type="number"
                        min="1"
                        value={editingQuiz.max_attempts}
                        onChange={(e) => setEditingQuiz({ ...editingQuiz, max_attempts: parseInt(e.target.value) || 3 })}
                        className="w-full px-3 py-2 text-sm border border-border rounded-md bg-background"
                      />
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={editingQuiz.randomize_questions}
                        onChange={(e) => setEditingQuiz({ ...editingQuiz, randomize_questions: e.target.checked })}
                      />
                      Randomize questions
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={editingQuiz.show_results}
                        onChange={(e) => setEditingQuiz({ ...editingQuiz, show_results: e.target.checked })}
                      />
                      Show results
                    </label>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium">Questions</h3>
                    <Button size="sm" variant="outline" onClick={addQuestion}>
                      <Plus className="h-4 w-4 mr-1" /> Add Question
                    </Button>
                  </div>

                  {editingQuiz.questions.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No questions added yet.
                    </p>
                  ) : (
                    editingQuiz.questions.map((q, qIdx) => (
                      <div key={q.id} className="border border-border rounded-lg p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">Question {qIdx + 1}</span>
                          <Button size="sm" variant="ghost" onClick={() => removeQuestion(qIdx)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>

                        <select
                          value={q.type}
                          onChange={(e) => updateQuestion(qIdx, { type: e.target.value as QuestionType })}
                          className="w-full px-3 py-2 text-sm border border-border rounded-md bg-background"
                        >
                          {QUESTION_TYPES.map((t) => (
                            <option key={t.value} value={t.value}>{t.label}</option>
                          ))}
                        </select>

                        <input
                          type="text"
                          value={q.question}
                          onChange={(e) => updateQuestion(qIdx, { question: e.target.value })}
                          className="w-full px-3 py-2 text-sm border border-border rounded-md bg-background"
                          placeholder="Enter your question"
                        />

                        {q.type === "multiple_choice" && (
                          <div className="space-y-2">
                            {(q.options || ["", ""]).map((opt, optIdx) => (
                              <div key={optIdx} className="flex items-center gap-2">
                                <input
                                  type="radio"
                                  name={`q-${q.id}-correct`}
                                  checked={q.correct_answer === optIdx}
                                  onChange={() => updateQuestion(qIdx, { correct_answer: optIdx })}
                                />
                                <input
                                  type="text"
                                  value={opt}
                                  onChange={(e) => {
                                    const newOpts = [...(q.options || ["", ""])]
                                    newOpts[optIdx] = e.target.value
                                    updateQuestion(qIdx, { options: newOpts })
                                  }}
                                  className="flex-1 px-3 py-2 text-sm border border-border rounded-md bg-background"
                                  placeholder={`Option ${optIdx + 1}`}
                                />
                              </div>
                            ))}
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() =>
                                updateQuestion(qIdx, {
                                  options: [...(q.options || []), ""],
                                })
                              }
                            >
                              <Plus className="h-4 w-4 mr-1" /> Add Option
                            </Button>
                          </div>
                        )}

                        {q.type === "true_false" && (
                          <div className="flex gap-4">
                            <label className="flex items-center gap-2">
                              <input
                                type="radio"
                                name={`q-${q.id}-tf`}
                                checked={q.correct_answer === "true"}
                                onChange={() => updateQuestion(qIdx, { correct_answer: "true" })}
                              />
                              True
                            </label>
                            <label className="flex items-center gap-2">
                              <input
                                type="radio"
                                name={`q-${q.id}-tf`}
                                checked={q.correct_answer === "false"}
                                onChange={() => updateQuestion(qIdx, { correct_answer: "false" })}
                              />
                              False
                            </label>
                          </div>
                        )}

                        {q.type === "short_answer" && (
                          <input
                            type="text"
                            value={q.correct_answer || ""}
                            onChange={(e) => updateQuestion(qIdx, { correct_answer: e.target.value })}
                            className="w-full px-3 py-2 text-sm border border-border rounded-md bg-background"
                            placeholder="Enter the correct answer"
                          />
                        )}

                        <div>
                          <label className="block text-sm font-medium mb-1">Points</label>
                          <input
                            type="number"
                            min="1"
                            value={q.points}
                            onChange={(e) => updateQuestion(qIdx, { points: parseInt(e.target.value) || 1 })}
                            className="w-20 px-3 py-2 text-sm border border-border rounded-md bg-background"
                          />
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="p-6 border-t border-border flex justify-end gap-3">
                <Button variant="outline" onClick={() => setEditingQuiz(null)}>
                  Cancel
                </Button>
                <Button
                  disabled={savingQuiz === editingQuiz.id}
                  onClick={saveQuiz}
                >
                  {savingQuiz === editingQuiz.id ? "Saving..." : <>
                    <Save className="h-4 w-4 mr-1" /> Save Quiz
                  </>}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
