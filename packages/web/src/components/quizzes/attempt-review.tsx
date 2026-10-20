'use client'

import { useEffect, useMemo, useState } from "react"
import { quizApi, type QuizAttempt } from "@/lib/api"
import { normalizeQuestionType, questionTypeLabel } from "@/lib/quiz-types"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, RefreshCw, X } from "lucide-react"

interface Question {
  id: string
  type: string
  question: string
  points: number
}

interface AttemptReviewProps {
  quizId: string
  quizTitle: string
  questions: Question[]
  onClose: () => void
}

export function AttemptReview({ quizId, quizTitle, questions, onClose }: AttemptReviewProps) {
  const [attempts, setAttempts] = useState<QuizAttempt[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [savingAttempt, setSavingAttempt] = useState<string | null>(null)
  const [awards, setAwards] = useState<Record<string, string>>({})
  const [feedbacks, setFeedbacks] = useState<Record<string, string>>({})

  const manualQuestions = useMemo(
    () => questions.filter((q) => normalizeQuestionType(q.type) === "essay"),
    [questions]
  )
  const manualPoints = useMemo(
    () => manualQuestions.reduce((sum, q) => sum + (q.points || 0), 0),
    [manualQuestions]
  )

  async function loadAttempts() {
    setLoading(true)
    setError(null)
    try {
      const resp = await quizApi.getMyAttempts(quizId)
      if (resp.data) {
        setAttempts(resp.data)
      } else {
        setError(resp.error || "Failed to load attempts")
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAttempts()
  }, [quizId])

  function answerText(attempt: QuizAttempt, questionId: string): string {
    const rows = attempt.answers || []
    const row = rows.find((r) => String(r.question_id) === questionId)
    if (!row) return ""
    const value = row.answer ?? row.answer_index
    return value === null || value === undefined ? "" : String(value)
  }

  async function saveGrade(attempt: QuizAttempt) {
    const raw = awards[attempt.id]
    const points = raw === undefined ? 0 : Number(raw)
    if (Number.isNaN(points)) {
      setError("Enter a valid number of points")
      return
    }
    if (points < 0 || points > manualPoints) {
      setError(`Points must be between 0 and ${manualPoints}`)
      return
    }

    setSavingAttempt(attempt.id)
    setError(null)
    try {
      const resp = await quizApi.gradeAttempt(
        attempt.id,
        points,
        feedbacks[attempt.id]?.trim() || undefined
      )
      const graded = resp.data
      if (graded) {
        setAttempts((current) => current.map((a) => (a.id === attempt.id ? graded : a)))
      } else {
        setError(resp.error || "Failed to save grade")
      }
    } finally {
      setSavingAttempt(null)
    }
  }

  const pendingCount = attempts.filter((a) => a.needs_review).length

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-start justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-card border border-border rounded-xl shadow-xl w-full max-w-3xl my-8">
        <div className="p-6 border-b border-border flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">Attempts: {quizTitle}</h2>
            <p className="text-sm text-muted-foreground mt-1">
              {pendingCount > 0
                ? `${pendingCount} attempt${pendingCount === 1 ? "" : "s"} awaiting review`
                : "No attempts awaiting review"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" onClick={loadAttempts} aria-label="Refresh">
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="ghost" onClick={onClose} aria-label="Close">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="p-6 space-y-4">
          {error && <p className="text-sm text-destructive">{error}</p>}

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : attempts.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              No attempts have been submitted yet.
            </p>
          ) : (
            attempts.map((attempt) => (
              <Card key={attempt.id}>
                <CardHeader>
                  <CardTitle className="text-base flex items-center justify-between">
                    <span>
                      {attempt.user_full_name || "Student"} • Attempt {attempt.attempt_number}
                    </span>
                    <span className="text-sm font-normal">
                      {attempt.needs_review ? (
                        <span className="text-amber-600 font-medium">Awaiting review</span>
                      ) : attempt.score !== null ? (
                        <span className={attempt.passed ? "text-green-600" : "text-destructive"}>
                          {attempt.score}%
                        </span>
                      ) : (
                        <span className="text-muted-foreground">Not graded</span>
                      )}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {manualQuestions.length > 0 && (
                    <div className="space-y-2">
                      {manualQuestions.map((question) => (
                        <div key={question.id} className="rounded-lg border border-border p-3">
                          <p className="text-xs text-muted-foreground">
                            {questionTypeLabel(question.type)} • {question.points} pts
                          </p>
                          <p className="text-sm font-medium mt-1">{question.question}</p>
                          <p className="text-sm mt-2 whitespace-pre-wrap">
                            {answerText(attempt, question.id) || (
                              <span className="text-muted-foreground italic">No answer</span>
                            )}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}

                  {attempt.feedback && (
                    <p className="text-sm text-muted-foreground">Feedback: {attempt.feedback}</p>
                  )}

                  {attempt.needs_review && manualPoints > 0 && (
                    <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
                      <div className="w-full sm:w-32">
                        <label className="block text-sm font-medium mb-1">
                          Points (max {manualPoints})
                        </label>
                        <input
                          type="number"
                          min={0}
                          max={manualPoints}
                          value={awards[attempt.id] ?? ""}
                          onChange={(e) =>
                            setAwards({ ...awards, [attempt.id]: e.target.value })
                          }
                          className="w-full px-3 py-2 text-sm border border-border rounded-md bg-background"
                        />
                      </div>
                      <div className="flex-1">
                        <label className="block text-sm font-medium mb-1">Feedback</label>
                        <input
                          type="text"
                          value={feedbacks[attempt.id] ?? ""}
                          onChange={(e) =>
                            setFeedbacks({ ...feedbacks, [attempt.id]: e.target.value })
                          }
                          className="w-full px-3 py-2 text-sm border border-border rounded-md bg-background"
                          placeholder="Optional feedback for the student"
                        />
                      </div>
                      <Button
                        onClick={() => saveGrade(attempt)}
                        disabled={savingAttempt === attempt.id}
                      >
                        {savingAttempt === attempt.id ? "Saving..." : "Save grade"}
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
