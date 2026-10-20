'use client'

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { MessagesSquare, Loader2, Plus, Trash2, ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { discussionApi, type DiscussionThreadRow, type DiscussionThreadDetail } from "@/lib/api"
import { useAuthStore } from "@/store/auth"
import { confirmAction } from "@/store/confirm"
import { toast } from "@/components/ui/use-toast"

function timeAgo(iso: string | null): string {
  if (!iso) return ""
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (seconds < 60) return "just now"
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

export function CourseDiscussions({ courseId }: { courseId: string }) {
  const { user } = useAuthStore()
  const isModerator = user?.role === "admin" || user?.role === "instructor"

  const [denied, setDenied] = useState(false)
  const [loading, setLoading] = useState(true)
  const [threads, setThreads] = useState<DiscussionThreadRow[]>([])
  const [selected, setSelected] = useState<DiscussionThreadDetail | null>(null)
  const [loadingThread, setLoadingThread] = useState(false)

  const [newTitle, setNewTitle] = useState("")
  const [newBody, setNewBody] = useState("")
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [replyBody, setReplyBody] = useState("")
  const [replying, setReplying] = useState(false)

  const loadThreads = useCallback(async () => {
    setLoading(true)
    setDenied(false)
    try {
      const response = await discussionApi.list(courseId)
      if (response.data) {
        setThreads(response.data)
      } else {
        setDenied(response.error === "Enroll in this course to join the discussion")
      }
    } catch {
      setDenied(true)
    } finally {
      setLoading(false)
    }
  }, [courseId])

  useEffect(() => {
    loadThreads()
  }, [loadThreads])

  async function openThread(threadId: string) {
    setLoadingThread(true)
    try {
      const response = await discussionApi.get(threadId)
      if (response.data) setSelected(response.data)
    } finally {
      setLoadingThread(false)
    }
  }

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (newTitle.trim().length < 3 || !newBody.trim()) {
      setCreateError("Title needs 3+ characters and a message is required.")
      return
    }
    setCreating(true)
    setCreateError(null)
    const response = await discussionApi.create(courseId, {
      title: newTitle.trim(),
      body: newBody.trim(),
    })
    setCreating(false)
    if (response.error) {
      setCreateError(response.error)
      return
    }
    setNewTitle("")
    setNewBody("")
    loadThreads()
  }

  async function handleReply(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selected || !replyBody.trim()) return
    setReplying(true)
    const response = await discussionApi.reply(selected.id, replyBody.trim())
    setReplying(false)
    if (response.error) return
    setReplyBody("")
    await openThread(selected.id)
    const listResponse = await discussionApi.list(courseId)
    if (listResponse.data) setThreads(listResponse.data)
  }

  async function handleDeleteThread(threadId: string) {
    const confirmed = await confirmAction({
      title: "Delete this thread?",
      description: "The thread and all of its replies will be removed.",
      confirmLabel: "Delete",
      destructive: true,
    })
    if (!confirmed) return
    const response = await discussionApi.removeThread(threadId)
    if (response.error) {
      toast({ title: "Could not delete thread", description: response.error })
      return
    }
    if (selected?.id === threadId) setSelected(null)
    setThreads((prev) => prev.filter((t) => t.id !== threadId))
  }

  async function handleDeletePost(postId: string) {
    const confirmed = await confirmAction({
      title: "Delete this reply?",
      confirmLabel: "Delete",
      destructive: true,
    })
    if (!confirmed) return
    const response = await discussionApi.removePost(postId)
    if (response.error) {
      toast({ title: "Could not delete reply", description: response.error })
      return
    }
    if (selected) await openThread(selected.id)
  }

  if (denied) {
    return (
      <div className="mt-8">
        <h2 className="text-2xl font-semibold mb-4">Discussions</h2>
        <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center">
          <MessagesSquare className="mx-auto h-10 w-10 text-muted-foreground/50" aria-hidden="true" />
          <p className="mt-4 font-medium">Enroll to join the discussion</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Ask questions and share tips with other learners in this course.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="mt-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-semibold">Discussions</h2>
        {selected && (
          <Button size="sm" variant="outline" onClick={() => setSelected(null)}>
            <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
            All threads
          </Button>
        )}
      </div>

      {selected ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{selected.title}</CardTitle>
            <p className="text-xs text-muted-foreground">
              {selected.posts.length} repl{selected.posts.length === 1 ? "y" : "ies"}
              {selected.is_locked && " · locked"}
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {loadingThread ? (
              <div className="flex h-32 items-center justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-primary" aria-hidden="true" />
              </div>
            ) : (
              <>
                <div className="space-y-3">
                  {selected.posts.map((post) => (
                    <div key={post.id} className="rounded-lg border border-border bg-background/50 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground">
                            {post.author_name}
                            {post.author_role !== "student" && (
                              <span className="ml-2 rounded bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary">
                                {post.author_role}
                              </span>
                            )}
                          </p>
                          <p className="mt-1 text-sm leading-6 text-muted-foreground whitespace-pre-wrap">
                            {post.body}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">{timeAgo(post.created_at)}</p>
                        </div>
                        {(isModerator || post.author_id === user?.id) && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="shrink-0 text-muted-foreground hover:text-destructive"
                            onClick={() => handleDeletePost(post.id)}
                            aria-label="Delete reply"
                          >
                            <Trash2 className="h-4 w-4" aria-hidden="true" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {!selected.is_locked && (
                  <form onSubmit={handleReply} className="space-y-3 border-t border-border pt-4">
                    <Label htmlFor="reply-body" className="text-sm font-medium">
                      Your reply
                    </Label>
                    <textarea
                      id="reply-body"
                      value={replyBody}
                      onChange={(e) => setReplyBody(e.target.value)}
                      rows={3}
                      className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                      placeholder="Share your thoughts..."
                    />
                    <Button type="submit" size="sm" disabled={replying || !replyBody.trim()}>
                      {replying && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
                      Reply
                    </Button>
                  </form>
                )}
              </>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          <form
            onSubmit={handleCreate}
            className="mb-6 rounded-xl border border-border bg-card p-5 space-y-3"
          >
            <div className="space-y-1.5">
              <Label htmlFor="thread-title" className="text-sm font-medium">
                Start a new discussion
              </Label>
              <Input
                id="thread-title"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Ask a question or start a topic..."
              />
            </div>
            <textarea
              aria-label="Thread message"
              value={newBody}
              onChange={(e) => setNewBody(e.target.value)}
              rows={2}
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="Add details..."
            />
            {createError && (
              <p className="text-sm text-destructive" role="alert">
                {createError}
              </p>
            )}
            <Button type="submit" size="sm" disabled={creating}>
              {creating ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
              )}
              Post thread
            </Button>
          </form>

          {threads.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center">
              <MessagesSquare className="mx-auto h-10 w-10 text-muted-foreground/50" aria-hidden="true" />
              <p className="mt-4 font-medium">No discussions yet</p>
              <p className="mt-1 text-sm text-muted-foreground">Be the first to start one.</p>
            </div>
          ) : (
            <ul className="space-y-2">
              {threads.map((thread) => (
                <li
                  key={thread.id}
                  className="group rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/40"
                >
                  <div className="flex items-start justify-between gap-3">
                    <button
                      onClick={() => openThread(thread.id)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <p className="font-medium text-foreground group-hover:text-primary transition-colors">
                        {thread.is_pinned && (
                          <span className="mr-2 rounded bg-primary/10 px-1.5 py-0.5 text-xs font-semibold text-primary">
                            Pinned
                          </span>
                        )}
                        {thread.title}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {thread.author_name} · {timeAgo(thread.created_at)} ·{" "}
                        {thread.reply_count} repl{thread.reply_count === 1 ? "y" : "ies"}
                      </p>
                    </button>
                    <div className="flex shrink-0 items-center gap-1.5">
                      {(isModerator || thread.author_id === user?.id) && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="text-muted-foreground hover:text-destructive"
                          onClick={() => handleDeleteThread(thread.id)}
                          aria-label={`Delete thread: ${thread.title}`}
                        >
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => openThread(thread.id)}>
                        Open
                      </Button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  )
}
