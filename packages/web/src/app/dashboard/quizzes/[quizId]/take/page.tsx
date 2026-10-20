'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { useAuthStore } from "@/store/auth"
import { quizApi } from "@/lib/api"
import { normalizeQuestionType, questionTypeLabel } from "@/lib/quiz-types"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, Clock, AlertCircle } from "lucide-react"

interface Question {
  id: string
  type: string
  question: string
  options?: string[]
  correct_answer?: string | number
  points: number
}

interface Quiz {
  id: string
  title: string
  description: string | null
  questions: Question[]
  time_limit_seconds: number | null
  max_attempts: number
  passing_grade: number
  randomize_questions: boolean
  show_results: boolean
  quiz_type: string
}

interface QuizResult {
  attempt_id: string
  score: number | null
  grade: number | null
  passed: boolean
  passing_grade: number
  total_points: number
  earned_points: number
  feedback: string | null
  needs_review: boolean
  results_hidden: boolean
}

export default function TakeQuizPage() {
  const params = useParams()
  const router = useRouter()
  const quizId = typeof params?.quizId === "string" ? params.quizId : ""
  const { token } = useAuthStore()

  const [quiz, setQuiz] = useState<Quiz | null>(null)
  const [loading, setLoading] = useState(true)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<QuizResult | null>(null)
  const [timeLeft, setTimeLeft] = useState<number | null>(null)
  const [attemptId, setAttemptId] = useState<string | null>(null)

  // Guards against a second submission while one is already in flight
  const submittingRef = useRef(false)
  // Always points at the latest submit handler so the timer never uses stale state
  const submitRef = useRef<() => void>(() => {})

  const displayQuestions = useMemo(() => quiz?.questions || [], [quiz])

  // A different exam means a clean slate
  useEffect(() => {
    setQuiz(null)
    setAnswers({})
    setSubmitting(false)
    setError(null)
    setResult(null)
    setTimeLeft(null)
    setAttemptId(null)
    setLoading(true)
    submittingRef.current = false
  }, [quizId])

  const loadQuiz = useCallback(async () => {
    if (!quizId) return
    try {
      const resp = await quizApi.getById(quizId)
      if (!resp.data) {
        setError(resp.error || "Failed to load quiz")
        return
      }
      setQuiz(resp.data as unknown as Quiz)

      // Start (or resume) the attempt so the server can enforce the time limit
      const startResp = await quizApi.startAttempt(quizId)
      if (!startResp.data) {
        setError(startResp.error || "Unable to start this exam")
        return
      }
      setAttemptId(startResp.data.attempt_id)

      const limit = resp.data.time_limit_seconds
      if (limit && limit > 0) {
        const remaining = startResp.data.remaining_seconds
        setTimeLeft(remaining !== null && remaining !== undefined ? remaining : limit)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load quiz")
    } finally {
      setLoading(false)
    }
  }, [quizId])

  useEffect(() => {
    if (!token) {
      router.push("/login")
      return
    }
    loadQuiz()
  }, [token, loadQuiz, router])

  const handleSubmit = useCallback(async () => {
    if (!quiz || !quizId || submittingRef.current || result) return
    submittingRef.current = true
    setSubmitting(true)

    try {
      const answerList = displayQuestions.map((q) => {
        const type = normalizeQuestionType(q.type)
        const value = answers[q.id]
        const isAnswered = value !== undefined && value !== ""
        return {
          question_id: q.id,
          answer: isAnswered ? value : null,
          answer_index:
            type === "multiple_choice" && isAnswered ? parseInt(value, 10) : undefined,
        }
      })

      const resp = await quizApi.submitAttempt(quizId, answerList, attemptId)
      if (resp.data) {
        setResult(resp.data as unknown as QuizResult)
        setTimeLeft(null)
      } else {
        setError(resp.error || "Failed to submit quiz")
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit quiz")
    } finally {
      submittingRef.current = false
      setSubmitting(false)
    }
  }, [quiz, quizId, answers, attemptId, displayQuestions, result])

  submitRef.current = () => {
    void handleSubmit()
  }

  // Countdown - independent of the answers so typing never delays the tick
  useEffect(() => {
    if (timeLeft === null || timeLeft <= 0 || result) return
    const timer = setTimeout(() => {
      setTimeLeft(timeLeft - 1)
      if (timeLeft === 1) {
        submitRef.current()
      }
    }, 1000)
    return () => clearTimeout(timer)
  }, [timeLeft, result])

  function handleAnswer(questionId: string, value: string) {
    setAnswers((prev) => ({ ...prev, [questionId]: value }))
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
            <p className="text-muted-foreground">Loading quiz...</p>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  if (error) {
    return (
      <DashboardLayout>
        <div className="max-w-2xl mx-auto p-6">
          <Card>
            <CardContent className="pt-6">
              <AlertCircle className="h-8 w-8 text-destructive mx-auto mb-3" />
              <p className="text-center text-destructive">{error}</p>
              <div className="flex justify-center mt-4">
                <Button onClick={() => router.back()}>Go Back</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    )
  }

  if (result) {
    const resultsHidden = result.results_hidden
    const pendingReview = result.needs_review

    return (
      <DashboardLayout>
        <div className="max-w-2xl mx-auto p-6">
          <Card>
            <CardHeader>
              <CardTitle>Quiz Results</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {resultsHidden ? (
                <div className="text-center py-4">
                  <p className="text-lg font-medium">Submission received</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Results for this quiz are not published by the instructor.
                  </p>
                </div>
              ) : pendingReview ? (
                <div className="text-center py-4">
                  <p className="text-lg font-medium">Awaiting review</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Your answers were submitted. An instructor will review the written
                    questions and publish your final score.
                  </p>
                </div>
              ) : (
                <div className="text-center py-4">
                  <div className={`text-4xl font-bold mb-2 ${result.passed ? "text-green-500" : "text-red-500"}`}>
                    {result.score}%
                  </div>
                  <p className="text-muted-foreground">
                    {result.passed ? "Passed!" : "Not passed yet"}
                  </p>
                </div>
              )}

              {!resultsHidden && !pendingReview && (
                <>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Earned Points:</span>
                    <span className="font-medium">{result.earned_points} / {result.total_points}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Passing Grade:</span>
                    <span className="font-medium">{result.passing_grade}%</span>
                  </div>
                </>
              )}

              {result.feedback && (
                <p className="text-center text-sm text-muted-foreground pt-2 border-t">
                  {result.feedback}
                </p>
              )}
            </CardContent>
          </Card>
          <div className="mt-6 text-center">
            <Button onClick={() => router.push("/dashboard/learning")}>Back to My Learning</Button>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  if (!quiz) {
    return (
      <DashboardLayout>
        <div className="max-w-2xl mx-auto p-6">
          <Card>
            <CardContent className="pt-6 text-center">
              <p className="text-muted-foreground">Quiz not found or not available.</p>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-semibold">{quiz.title}</h1>
          {timeLeft !== null && timeLeft > 0 && (
            <div className="flex items-center gap-2 text-lg font-medium text-primary">
              <Clock className="h-5 w-5" />
              {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, "0")}
            </div>
          )}
        </div>

        {quiz.description && (
          <p className="text-muted-foreground mb-6">{quiz.description}</p>
        )}

        <form onSubmit={(e) => { e.preventDefault(); void handleSubmit() }} className="space-y-6">
          {displayQuestions.map((q, qIdx) => {
            const qType = normalizeQuestionType(q.type)
            return (
              <Card key={q.id}>
                <CardHeader>
                  <CardTitle className="text-base">
                    Question {qIdx + 1}
                    <span className="ml-2 text-sm font-normal text-muted-foreground">
                      {questionTypeLabel(qType)} • {q.points} pts
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="mb-4">{q.question}</p>

                  {qType === "multiple_choice" && q.options && (
                    <div className="space-y-2">
                      {q.options.map((opt, optIdx) => (
                        <label
                          key={optIdx}
                          className="flex items-center gap-3 p-2 rounded-lg border border-border hover:bg-accent cursor-pointer"
                        >
                          <input
                            type="radio"
                            name={q.id}
                            value={optIdx}
                            checked={answers[q.id] === String(optIdx)}
                            onChange={(e) => handleAnswer(q.id, e.target.value)}
                            className="h-4 w-4"
                          />
                          <span className="text-sm">{opt}</span>
                        </label>
                      ))}
                    </div>
                  )}

                  {qType === "true_false" && (
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          name={q.id}
                          value="true"
                          checked={answers[q.id] === "true"}
                          onChange={(e) => handleAnswer(q.id, e.target.value)}
                        />
                        True
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          name={q.id}
                          value="false"
                          checked={answers[q.id] === "false"}
                          onChange={(e) => handleAnswer(q.id, e.target.value)}
                        />
                        False
                      </label>
                    </div>
                  )}

                  {(qType === "enumeration" || qType === "identification") && (
                    <input
                      type="text"
                      value={answers[q.id] || ""}
                      onChange={(e) => handleAnswer(q.id, e.target.value)}
                      className="w-full px-3 py-2 border border-border rounded-md"
                      placeholder={
                        qType === "enumeration"
                          ? "List the items in order (separate them with , or |)"
                          : "Enter the term"
                      }
                    />
                  )}

                  {qType === "essay" && (
                    <textarea
                      value={answers[q.id] || ""}
                      onChange={(e) => handleAnswer(q.id, e.target.value)}
                      rows={6}
                      className="w-full px-3 py-2 border border-border rounded-md"
                      placeholder="Write your answer"
                    />
                  )}
                </CardContent>
              </Card>
            )
          })}

          <div className="flex justify-end pt-4">
            <Button type="submit" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Submitting...
                </>
              ) : (
                "Submit Quiz"
              )}
            </Button>
          </div>
        </form>
      </div>
    </DashboardLayout>
  )
}
