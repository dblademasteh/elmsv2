'use client'

import { useEffect, useState } from "react"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { assignmentApi, enrollmentApi } from "@/lib/api"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { AlertCircle, FileText, Calendar, Clock, Upload } from "lucide-react"

interface Enrollment {
  id: string
  course_id: string
  course_title: string
  course_cover_image_url: string | null
}

interface CourseAssignment {
  id: string
  title: string
  due_date: string | null
  max_score: number
  is_published: boolean
  allowed_file_types: string[]
  max_file_size_mb: number
  instructions: string | null
}

interface Submission {
  id: string
  assignment_id: string
  score: number | null
  max_score: number
  score_percentage: number | null
  status: string
  feedback: string | null
  is_late: boolean
  submitted_at: string | null
  file_url: string | null
  file_name: string | null
}

interface CombinedAssignment {
  assignmentId: string
  assignmentTitle: string
  courseTitle: string
  courseId: string
  dueDate: string | null
  maxScore: number
  instructions: string | null
  isPublished: boolean
  allowedFileTypes: string[]
  maxFileSizeMb: number
  submission: Submission | null
}

export default function StudentAssignmentsPage() {
  const [assignments, setAssignments] = useState<CombinedAssignment[]>([])
  const [loading, setLoading] = useState(true)
  const [submittingId, setSubmittingId] = useState<string | null>(null)
  const [showSubmitModal, setShowSubmitModal] = useState<CombinedAssignment | null>(null)
  const [fileUrl, setFileUrl] = useState("")
  const [fileName, setFileName] = useState("")
  const [fileSize, setFileSize] = useState(0)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    try {
      // Get enrollments (student's courses)
      const enrollResp = await enrollmentApi.getMyEnrollments()
      const enrollments = (enrollResp.data || []) as unknown as Enrollment[]

      // Get all student submissions
      const subsResp = await assignmentApi.getMySubmissions()
      const submissions = (subsResp.data || []) as unknown as Submission[]
      const submissionsMap = new Map(submissions.map(s => [s.assignment_id, s]))

      // For each enrollment, get assignments for that course
      const combined: CombinedAssignment[] = []
      for (const e of enrollments) {
        try {
          const assignResp = await assignmentApi.getByCourse(e.course_id)
          const courseAssignments = (assignResp.data || []) as unknown as CourseAssignment[]
          for (const a of courseAssignments) {
            combined.push({
              assignmentId: a.id,
              assignmentTitle: a.title,
              courseTitle: e.course_title,
              courseId: e.course_id,
              dueDate: a.due_date,
              maxScore: a.max_score,
              instructions: a.instructions,
              isPublished: a.is_published,
              allowedFileTypes: a.allowed_file_types || [],
              maxFileSizeMb: a.max_file_size_mb,
              submission: submissionsMap.get(a.id) || null,
            })
          }
        } catch {
          // Skip courses we can't access
        }
      }

      setAssignments(combined)
    } finally {
      setLoading(false)
    }
  }

  function formatDueDate(dueDate: string | null): string {
    if (!dueDate) return "No due date"
    const d = new Date(dueDate)
    const now = new Date()
    if (d < now) return `Overdue: ${d.toLocaleDateString()}`
    return `Due: ${d.toLocaleDateString()}`
  }

  function getStatusBadge(a: CombinedAssignment) {
    const sub = a.submission
    if (sub && sub.score !== null) {
      return <Badge variant="default">Graded</Badge>
    }
    if (sub && sub.status === "submitted") {
      return <Badge variant="secondary">Submitted</Badge>
    }
    return <Badge variant="outline">Not Submitted</Badge>
  }

  function isOverdue(a: CombinedAssignment): boolean {
    if (!a.dueDate) return false
    return new Date(a.dueDate) < new Date() && (!a.submission || a.submission.status === "draft")
  }

  async function handleSubmit(a: CombinedAssignment) {
    setShowSubmitModal(a)
    setFileUrl("")
    setFileName("")
    setFileSize(0)
  }

  async function confirmSubmit() {
    if (!showSubmitModal) return
    if (!fileUrl.trim()) {
      alert("Please enter a file URL")
      return
    }

    setSubmittingId(showSubmitModal.assignmentId)
    try {
      await assignmentApi.submit(showSubmitModal.assignmentId, fileUrl, fileName, fileSize)
      setShowSubmitModal(null)
      await loadData()
    } catch (err) {
      alert(`Submission failed: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setSubmittingId(null)
    }
  }

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold">My Assignments</h1>
            <p className="text-sm text-muted-foreground mt-1">
              View and submit your course assignments
            </p>
          </div>
        </div>

        {loading ? (
          <div className="grid gap-6 lg:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-48 rounded-xl border border-border bg-card animate-pulse" />
            ))}
          </div>
        ) : assignments.length === 0 ? (
          <Card>
            <CardContent className="pt-6 text-center text-muted-foreground">
              <FileText className="mx-auto h-8 w-8 mb-3 opacity-50" />
              <p>No assignments found. Assignments from your courses will appear here.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {assignments.map((a) => (
              <Card key={a.assignmentId} className={isOverdue(a) ? "border-red-500/30" : ""}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">{a.assignmentTitle}</CardTitle>
                      <p className="text-sm text-muted-foreground mt-1">{a.courseTitle}</p>
                    </div>
                    {getStatusBadge(a)}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-4 text-sm">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span className={isOverdue(a) ? "text-red-500" : ""}>{formatDueDate(a.dueDate)}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <span>Max {a.maxScore} points</span>
                    </div>
                    {a.submission && a.submission.status === "submitted" && (
                      <div className="flex items-center gap-1">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span>Awaiting review</span>
                      </div>
                    )}
                  </div>

                  {a.instructions && (
                    <p className="text-sm text-muted-foreground">{a.instructions}</p>
                  )}

                  {a.submission && a.submission.feedback && (
                    <div className="p-3 bg-muted rounded-md">
                      <p className="text-sm font-medium mb-1">Instructor Feedback:</p>
                      <p className="text-sm">{a.submission.feedback}</p>
                    </div>
                  )}

                  {(a.submission?.status === "draft" || a.submission?.status === "graded") && a.isPublished && (
                    <Button size="sm" onClick={() => handleSubmit(a)}>
                      <Upload className="h-4 w-4 mr-1" />
                      {a.submission?.status === "graded" ? "Resubmit" : "Submit Assignment"}
                    </Button>
                  )}

                  {a.submission?.status === "submitted" && (
                    <p className="text-sm text-muted-foreground">
                      Your submission is pending review by the instructor.
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Submit Modal */}
      {showSubmitModal && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-card border border-border rounded-xl shadow-xl w-full max-w-lg">
            <div className="p-6 border-b border-border flex items-center justify-between">
              <h2 className="text-xl font-semibold">Submit: {showSubmitModal.assignmentTitle}</h2>
              <Button size="sm" variant="ghost" onClick={() => setShowSubmitModal(null)}>
                ×
              </Button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">File URL *</label>
                <input
                  type="url"
                  value={fileUrl}
                  onChange={(e) => setFileUrl(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-border rounded-md bg-background"
                  placeholder="Enter the URL where your file is hosted"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Allowed types: {showSubmitModal.allowedFileTypes.join(", ")}
                  &nbsp;|&nbsp; Max size: {showSubmitModal.maxFileSizeMb} MB
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">File Name</label>
                <input
                  type="text"
                  value={fileName}
                  onChange={(e) => setFileName(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-border rounded-md bg-background"
                  placeholder="e.g. my-assignment.pdf"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">File Size (bytes)</label>
                <input
                  type="number"
                  min="0"
                  value={fileSize || ""}
                  onChange={(e) => setFileSize(parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 text-sm border border-border rounded-md bg-background"
                  placeholder="0"
                />
              </div>

              {showSubmitModal.instructions && (
                <div className="p-3 bg-muted rounded-md">
                  <p className="text-sm font-medium mb-1">Instructions:</p>
                  <p className="text-sm">{showSubmitModal.instructions}</p>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-border flex justify-end gap-3">
              <Button variant="outline" onClick={() => setShowSubmitModal(null)}>
                Cancel
              </Button>
              <Button
                disabled={submittingId === showSubmitModal.assignmentId}
                onClick={confirmSubmit}
              >
                {submittingId === showSubmitModal.assignmentId ? "Submitting..." : (
                  <>
                    <Upload className="h-4 w-4 mr-1" />
                    Submit
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  )
}
