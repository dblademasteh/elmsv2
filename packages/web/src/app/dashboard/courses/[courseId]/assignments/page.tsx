'use client'

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { useAuthStore } from "@/store/auth"
import { assignmentApi, lessonApi, courseApi } from "@/lib/api"
import { safeExternalUrl } from "@/lib/urls"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { Plus, Trash2, Save, AlertCircle, Calendar, Upload, FileText, CheckCircle, Clock } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { toast } from "@/components/ui/use-toast"

interface GradingFormProps {
  submission: Submission
  onGrade: (score: number, feedback?: string) => Promise<void>
  grading: boolean
}

function GradingForm({ submission, onGrade, grading }: GradingFormProps) {
  const [score, setScore] = useState<string>("")

  return (
    <div className="mt-3 pt-3 border-t space-y-2">
      <div className="flex gap-2">
        <input
          type="number"
          min="0"
          max={submission.max_score}
          value={score}
          onChange={(e) => setScore(e.target.value)}
          className="w-24 px-2 py-1 text-sm border border-border rounded-md bg-background"
          placeholder={`Max ${submission.max_score}`}
        />
        <Button
          size="sm"
          disabled={grading || !score}
          onClick={async () => {
            const s = parseFloat(score)
            if (!isNaN(s) && s >= 0) {
              await onGrade(s)
              setScore("")
            }
          }}
        >
          {grading ? "Grading..." : "Grade"}
        </Button>
      </div>
    </div>
  )
}


interface Lesson {
  id: string
  title: string
  position: number
}

/**
 * The link to a student's submitted file.
 *
 * `file_url` is student-controlled, so it is normalised before it reaches an
 * `href`; a URL that is not a plain http(s) link is shown as plain text
 * instead of being turned into a clickable target.
 */
function SubmissionFileLink({ submission }: { submission: Submission }) {
  const url = safeExternalUrl(submission.file_url)
  const label = (
    <>
      <FileText className="h-4 w-4" />
      {submission.file_name} ({(submission.file_size_bytes / 1024).toFixed(1)} KB)
    </>
  )

  if (!url) {
    return (
      <span
        className="text-sm text-muted-foreground flex items-center gap-1"
        title="This URL cannot be opened as a link"
      >
        {label}
      </span>
    )
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="text-sm text-blue-500 hover:underline flex items-center gap-1"
    >
      {label}
    </a>
  )
}

interface Assignment {
  id: string
  lesson_id: string
  title: string
  description?: string | null
  instructions?: string | null
  due_date: string | null
  max_score: number
  max_file_size_mb: number
  allowed_file_types: string[]
  rubric_json?: Array<Record<string, any>> | null
  is_required: boolean
  is_published: boolean
  created_at: string
  submission_count: number
  graded_count: number
}

interface Submission {
  id: string
  assignment_id: string
  user_id: string
  user_full_name: string
  file_url: string | null
  file_name: string | null
  file_size_bytes: number
  submitted_at: string | null
  is_late: boolean
  score: number | null
  feedback: string | null
  grader_name: string | null
  graded_at: string | null
  status: string
  max_score: number
  score_percentage: number | null
}

export default function AssignmentManagementPage() {
  const params = useParams()
  const courseId = typeof params?.courseId === "string" ? params.courseId : ""
  const { user, isAuthenticated } = useAuthStore()
  const role = user?.role

  const [lessons, setLessons] = useState<Lesson[]>([])
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [loading, setLoading] = useState(true)
  const [editingAssignment, setEditingAssignment] = useState<Assignment | null>(null)
  const [savingAssignment, setSavingAssignment] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [viewingSubmissions, setViewingSubmissions] = useState<Assignment | null>(null)
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [gradingSubmission, setGradingSubmission] = useState<string | null>(null)

  useEffect(() => {
    if (courseId) loadData()
  }, [courseId])

  async function loadData() {
    setLoading(true)
    try {
      const lessonsResp = await lessonApi.listByCourse(courseId)
      if (lessonsResp.data) {
        setLessons(lessonsResp.data.sort((a, b) => a.position - b.position))
      }
      const assignmentsResp = await assignmentApi.getByCourse(courseId)
      if (assignmentsResp.data) {
        setAssignments(assignmentsResp.data)
      }
    } finally {
      setLoading(false)
    }
  }

  const assignmentsByLesson = lessons.reduce((acc, lesson) => {
    acc[lesson.id] = assignments.filter(a => a.lesson_id === lesson.id)
    return acc
  }, {} as Record<string, Assignment[]>)

  function handleCreateAssignment(lessonId: string) {
    const newAssignment: Assignment = {
      id: `new-${lessonId}-${Date.now()}`,
      lesson_id: lessonId,
      title: "",
      description: null,
      instructions: null,
      due_date: null,
      max_score: 100,
      max_file_size_mb: 10,
      allowed_file_types: ["pdf", "doc", "docx", "zip"],
      rubric_json: [],
      is_required: true,
      is_published: false,
      created_at: new Date().toISOString(),
      submission_count: 0,
      graded_count: 0,
    }
    setEditingAssignment(newAssignment)
  }

  function handleEditAssignment(a: Assignment) {
    setEditingAssignment({ ...a })
  }

  async function handleDeleteAssignment(a: Assignment) {
    if (!confirm(`Delete assignment "${a.title}"?`)) return
    setDeletingId(a.id)
    const resp = await assignmentApi.delete(a.id)
    setDeletingId(null)
    if (resp.error) {
      toast({ title: "Could not delete assignment", description: resp.error })
      return
    }
    setAssignments((prev) => prev.filter(x => x.id !== a.id))
  }

  async function handleViewSubmissions(a: Assignment) {
    setViewingSubmissions(a)
    const resp = await assignmentApi.listSubmissions(a.id)
    if (resp.data) setSubmissions(resp.data)
  }

  async function handleGradeSubmission(submission: Submission, score: number, feedback?: string) {
    setGradingSubmission(submission.id)
    await assignmentApi.gradeSubmission(submission.id, score, feedback)
    setGradingSubmission(null)
    if (viewingSubmissions) {
      const resp = await assignmentApi.listSubmissions(viewingSubmissions.id)
      if (resp.data) setSubmissions(resp.data)
    }
  }

  async function saveAssignment() {
    if (!editingAssignment) return
    if (!editingAssignment.title.trim()) {
      alert("Assignment title is required")
      return
    }

    setSavingAssignment(editingAssignment.id)
    try {
      if (editingAssignment.id.startsWith("new-")) {
        const resp = await assignmentApi.create({
          lesson_id: editingAssignment.lesson_id,
          title: editingAssignment.title,
          description: editingAssignment.description || undefined,
          instructions: editingAssignment.instructions || undefined,
          due_date: editingAssignment.due_date || undefined,
          max_score: editingAssignment.max_score,
          max_file_size_mb: editingAssignment.max_file_size_mb,
          allowed_file_types: editingAssignment.allowed_file_types,
          rubric_json: editingAssignment.rubric_json as any,
          is_required: editingAssignment.is_required,
          is_published: editingAssignment.is_published,
        })
        if (resp.data) {
          setAssignments([...assignments, resp.data as unknown as Assignment])
          setEditingAssignment(null)
        } else if (resp.error) {
          throw new Error(resp.error)
        }
      } else {
        const resp = await assignmentApi.update(editingAssignment.id, {
          title: editingAssignment.title,
          description: editingAssignment.description || null,
          instructions: editingAssignment.instructions || null,
          due_date: editingAssignment.due_date || null,
          max_score: editingAssignment.max_score,
          max_file_size_mb: editingAssignment.max_file_size_mb,
          allowed_file_types: editingAssignment.allowed_file_types,
          rubric_json: editingAssignment.rubric_json as any,
          is_required: editingAssignment.is_required,
          is_published: editingAssignment.is_published,
        })
        if (resp.data) {
          setAssignments(assignments.map(a => a.id === editingAssignment.id ? (resp.data as unknown as Assignment) : a))
          setEditingAssignment(null)
        } else if (resp.error) {
          throw new Error(resp.error)
        }
      }
    } catch (err) {
      alert(`Failed to save: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setSavingAssignment(null)
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
              <p className="text-center">Only instructors and admins can manage assignments.</p>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    )
  }

  // Submissions modal
  if (viewingSubmissions) {
    return (
      <DashboardLayout>
        <div className="max-w-7xl mx-auto p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-semibold">Submissions: {viewingSubmissions.title}</h1>
              <p className="text-sm text-muted-foreground mt-1">
                {submissions.length} submission{submissions.length !== 1 ? "s" : ""}
              </p>
            </div>
            <Button variant="outline" onClick={() => { setViewingSubmissions(null); setSubmissions([]) }}>
              ← Back to Assignments
            </Button>
          </div>

          {submissions.length === 0 ? (
            <Card>
              <CardContent className="pt-6 text-center text-muted-foreground">
                <p>No submissions yet.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {submissions.map((s) => (
                <Card key={s.id}>
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between">
                      <div className="space-y-2 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{s.user_full_name}</span>
                          <Badge
                            variant={
                              s.status === "graded" ? "default" :
                              s.status === "submitted" ? "secondary" :
                              s.status === "late" ? "destructive" : "outline"
                            }
                          >
                            {s.status}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Submitted: {s.submitted_at ? new Date(s.submitted_at).toLocaleString() : "Not yet"}
                          {s.is_late && <span className="text-red-500 ml-2">(Late)</span>}
                        </p>
                        {s.file_url && <SubmissionFileLink submission={s} />}
                      </div>
                      <div className="ml-4 text-right min-w-[120px]">
                        {s.score !== null ? (
                          <div>
                            <span className="text-2xl font-bold">{s.score}/{s.max_score}</span>
                            <p className="text-sm text-muted-foreground">{s.score_percentage}%</p>
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">Not graded</span>
                        )}
                      </div>
                    </div>

                    {s.feedback && (
                      <div className="mt-3 p-3 bg-muted rounded-md">
                        <p className="text-sm font-medium mb-1">Instructor Feedback:</p>
                        <p className="text-sm">{s.feedback}</p>
                      </div>
                    )}

                    {s.status !== "graded" && (
                      <GradingForm
                        submission={s}
                        onGrade={(score, feedback) => handleGradeSubmission(s, score, feedback)}
                        grading={gradingSubmission === s.id}
                      />
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold">Assignment Manager</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Manage assignments for course lessons
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
              const lessonAssignments = assignmentsByLesson[lesson.id] || []
              return (
                <Card key={lesson.id}>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center justify-between">
                      <div>
                        {lesson.title} <span className="text-muted-foreground font-normal">(Position {lesson.position})</span>
                      </div>
                      <Button size="sm" variant="outline" onClick={() => handleCreateAssignment(lesson.id)}>
                        <Plus className="h-4 w-4 mr-1" /> Add Assignment
                      </Button>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {lessonAssignments.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No assignments for this lesson yet.</p>
                    ) : (
                      <div className="space-y-3">
                        {lessonAssignments.map((a) => (
                          <div key={a.id} className="flex items-center justify-between p-3 border rounded-lg">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <p className="font-medium">{a.title}</p>
                                <Badge variant={a.is_published ? "default" : "outline"}>
                                  {a.is_published ? "Published" : "Draft"}
                                </Badge>
                                {a.due_date && (
                                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                                    <Calendar className="h-3 w-3" />
                                    {new Date(a.due_date).toLocaleDateString()}
                                  </span>
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground mt-1">
                                Max {a.max_score} pts • {a.submission_count} submission{a.submission_count !== 1 ? "s" : ""}
                                {a.graded_count > 0 && ` • ${a.graded_count} graded`}
                              </p>
                            </div>
                            <div className="flex gap-2">
                              {a.submission_count > 0 && (
                                <Button size="sm" variant="ghost" onClick={() => handleViewSubmissions(a)}>
                                  <CheckCircle className="h-4 w-4" />
                                </Button>
                              )}
                              <Button size="sm" variant="ghost" onClick={() => handleEditAssignment(a)}>
                                Edit
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                disabled={deletingId === a.id}
                                onClick={() => handleDeleteAssignment(a)}
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

        {/* Assignment Editor Modal */}
        {editingAssignment && (
          <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-card border border-border rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-border flex items-center justify-between">
                <h2 className="text-xl font-semibold">
                  {editingAssignment.id.startsWith("new-") ? "Create Assignment" : "Edit Assignment"}
                </h2>
                <Button size="sm" variant="ghost" onClick={() => setEditingAssignment(null)}>
                  ×
                </Button>
              </div>

              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Title *</label>
                  <input
                    type="text"
                    value={editingAssignment.title}
                    onChange={(e) => setEditingAssignment({ ...editingAssignment, title: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-border rounded-md bg-background"
                    placeholder="Assignment title"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Description</label>
                  <textarea
                    value={editingAssignment.description || ""}
                    onChange={(e) => setEditingAssignment({ ...editingAssignment, description: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-border rounded-md bg-background"
                    placeholder="What is this assignment about?"
                    rows={3}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Instructions</label>
                  <textarea
                    value={editingAssignment.instructions || ""}
                    onChange={(e) => setEditingAssignment({ ...editingAssignment, instructions: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-border rounded-md bg-background"
                    placeholder="Detailed instructions for students"
                    rows={4}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Due Date</label>
                    <input
                      type="datetime-local"
                      value={editingAssignment.due_date ? new Date(editingAssignment.due_date).toISOString().slice(0, 16) : ""}
                      onChange={(e) => setEditingAssignment({ ...editingAssignment, due_date: e.target.value ? e.target.value : null })}
                      className="w-full px-3 py-2 text-sm border border-border rounded-md bg-background"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Max Score</label>
                    <input
                      type="number"
                      min="1"
                      value={editingAssignment.max_score}
                      onChange={(e) => setEditingAssignment({ ...editingAssignment, max_score: parseFloat(e.target.value) || 100 })}
                      className="w-full px-3 py-2 text-sm border border-border rounded-md bg-background"
                    />
                  </div>
                </div>


                <div>
                  <label className="block text-sm font-medium mb-1">Grading Rubric (optional)</label>
                  <div className="space-y-2">
                    {(editingAssignment.rubric_json || []).map((item: any, idx: number) => (
                      <div key={idx} className="flex gap-2 items-center">
                        <input
                          type="text"
                          value={item.criterion || ""}
                          onChange={(e) => {
                            const rubric = [...(editingAssignment.rubric_json || [])]
                            rubric[idx] = { ...rubric[idx], criterion: e.target.value }
                            setEditingAssignment({ ...editingAssignment, rubric_json: rubric })
                          }}
                          className="flex-1 px-2 py-1 text-sm border border-border rounded-md bg-background"
                          placeholder="Criterion"
                        />
                        <input
                          type="number"
                          min="0"
                          value={item.points || 0}
                          onChange={(e) => {
                            const rubric = [...(editingAssignment.rubric_json || [])]
                            rubric[idx] = { ...rubric[idx], points: parseFloat(e.target.value) || 0 }
                            setEditingAssignment({ ...editingAssignment, rubric_json: rubric })
                          }}
                          className="w-20 px-2 py-1 text-sm border border-border rounded-md bg-background"
                          placeholder="Pts"
                        />
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            const rubric = [...(editingAssignment.rubric_json || [])]
                            rubric.splice(idx, 1)
                            setEditingAssignment({ ...editingAssignment, rubric_json: rubric })
                          }}
                        >
                          ×
                        </Button>
                      </div>
                    ))}
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        const rubric = [...(editingAssignment.rubric_json || [])]
                        rubric.push({ criterion: "", points: 0 })
                        setEditingAssignment({ ...editingAssignment, rubric_json: rubric })
                      }}
                    >
                      Add Criterion
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Total: {(editingAssignment.rubric_json || []).reduce((s: number, i: any) => s + (Number(i.points)||0), 0)} pts
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Allowed File Types</label>
                  <input
                    type="text"
                    value={editingAssignment.allowed_file_types.join(", ")}
                    onChange={(e) => setEditingAssignment({
                      ...editingAssignment,
                      allowed_file_types: e.target.value.split(",").map(s => s.trim()).filter(Boolean)
                    })}
                    className="w-full px-3 py-2 text-sm border border-border rounded-md bg-background"
                    placeholder="e.g. pdf, doc, docx, zip"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Max file size: {editingAssignment.max_file_size_mb} MB
                  </p>
                </div>

                <div className="flex gap-4">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={editingAssignment.is_required}
                      onChange={(e) => setEditingAssignment({ ...editingAssignment, is_required: e.target.checked })}
                    />
                    Required
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={editingAssignment.is_published}
                      onChange={(e) => setEditingAssignment({ ...editingAssignment, is_published: e.target.checked })}
                    />
                    Published
                  </label>
                </div>
              </div>

              <div className="p-6 border-t border-border flex justify-end gap-3">
                <Button variant="outline" onClick={() => setEditingAssignment(null)}>
                  Cancel
                </Button>
                <Button
                  disabled={savingAssignment === editingAssignment.id}
                  onClick={saveAssignment}
                >
                  {savingAssignment === editingAssignment.id ? "Saving..." : (
                    <>
                      <Save className="h-4 w-4 mr-1" /> Save
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
