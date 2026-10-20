# Frontend Component Audit — `packages/web`

**Date:** 2026-10-20 · **Stack:** Next.js 14 (App Router) + React 18 + Tailwind + Radix · **Scope:** all 51 `.tsx` / 7 `.ts` files under `src/`
**Method:** 4 parallel deep-read audits (quiz/exam area, public pages + data layer, dashboard pages, UI primitives + app shell), each finding independently re-verified against the source and the FastAPI backend before inclusion. ESLint run via Docker (`node` is not installed on the host).

**Totals: 4 Critical · 13 High · 25 Medium · 22 Low · 7 lint warnings (64 findings)**

## Status

| ID | Finding | Status |
|----|---------|--------|
| C1 | `Toaster` renders no toasts | **Fixed** — `components/ui/toaster.tsx`, `components/ui/use-toast.ts`, `app/dashboard/exams/page.tsx` |
| C2 | Students can never submit an assignment | **Fixed** — `app/dashboard/assignments/page.tsx` |
| C3 | `Select` never shows the selected value | **Fixed** — `components/ui/select.tsx` |
| C4 | Admin's own draft courses are invisible | **Fixed** — `app/api/v1/endpoints/courses.py`, `app/crud/course.py` (+ regression test) |
| H1–H13, P2, P3 | everything else | Open |

Verification of the four fixes: ESLint unchanged (8 output lines = the 7 pre-existing warnings, 0 errors), `next build` compiles clean, backend suite `33 passed` (new test `test_admin_mine_list_includes_own_drafts` fails without the C4 fix), and the Select/Toaster fixes were exercised with throwaway SSR and jsdom harnesses (selected label rendered, placeholder only when empty, no duplicate `id`, toast title/description in the DOM, toasts fired before the Toaster mounts are queued and flushed). The frontend still has no unit-test runner — `npm test` has no Jest config, `jest-environment-jsdom` or testing-library in `devDependencies`.

---

## Executive summary

Three independent problems dominate the list, and all three are *silent* — the UI looks alive but does nothing:

1. **The toast system never renders.** `Toaster` mounts a Radix `ToastProvider` + empty `ToastViewport` and never maps the queue to `<Toast>` elements. Every `toast()` call in the app is invisible. This is also the root cause of the `alert()`/`confirm()` sprawl (12 call sites) — the codebase fell back to native dialogs because toasts don't work.
2. **Students can never submit an assignment.** The submit button is gated on `submission.status === "draft" | "graded"`, but the API only ever creates `status="submitted"` rows and no draft is ever created, so a never-submitted assignment renders **no submit button at all**.
3. **The shared `Select` primitive never shows the selected value.** `SelectValue` renders only the placeholder. The three dropdowns in the exam-creation dialog stay showing "Select a course…" after you pick one.

Nothing in this document requires a backend redesign; 3 of the 4 Criticals are pure frontend wiring bugs.

---

## P0 — Critical

### C1 · `Toaster` renders no toasts — all app feedback is invisible
**`src/components/ui/toaster.tsx:1-10`** (mounted at `src/app/layout.tsx:21`)

```tsx
export function Toaster() {
  return (
    <ToastProvider>
      <ToastViewport />      // ← never renders a single <Toast>
    </ToastProvider>
  )
}
```

`use-toast.ts` keeps a real queue (`toasts`, `ADD_TOAST`, `DISMISS_TOAST`, `TOAST_LIMIT`) and `toast()` dispatches into it, but no component ever reads `useToast().toasts`. The queue is populated and dropped on the floor.

**Impact:** every one of the 7 `toast()` call sites (all in `src/app/dashboard/exams/page.tsx`) is a no-op — "Failed to load courses", "Exam created successfully", "Quiz deleted" never appear. Because nothing was visible, the rest of the codebase substituted native `alert()`/`confirm()` (12 sites across 8 files) — see [H13].

**Fix:** render the queue (shadcn pattern):
```tsx
export function Toaster() {
  const { toasts } = useToast()
  return (
    <ToastProvider>
      {toasts.map(({ id, title, description, action, ...props }) => (
        <Toast key={id} {...props}>
          <div className="grid gap-1">
            {title && <ToastTitle>{title}</ToastTitle>}
            {description && <ToastDescription>{description}</ToastDescription>}
          </div>
          {action}
          <ToastClose />
        </Toast>
      ))}
      <ToastViewport />
    </ToastProvider>
  )
}
```

---

### C2 · Students can never submit an assignment for the first time
**`src/app/dashboard/assignments/page.tsx:297-302`**

```tsx
{(a.submission?.status === "draft" || a.submission?.status === "graded") && a.isPublished && (
  <Button size="sm" onClick={() => handleSubmit(a)}>…</Button>
)}
```

Verified end-to-end:
- `app/crud/assignment.py:204,216` — `create_submission` always writes `status="submitted"` (both the insert and the update branch). **No code path ever creates a `"draft"` row.**
- `app/api/v1/endpoints/enrollments.py:101-113` — `GET /enrollments/my-assignments` returns only existing submission rows.
- `packages/web/src/app/dashboard/assignments/page.tsx:104` — `submission: submissionsMap.get(a.id) || null`.

So for an assignment the student has never attempted: `submission === null` → the condition is false → **no submit button exists on the card**. The "Not Submitted" badge renders, the card offers no action, and the assignment can never be submitted from the UI. Only a re-submit after grading works (`status === "graded"`).

**Fix:** render the button whenever there is no submission or the submission is not yet submitted:
```tsx
{(!a.submission || a.submission.status === "graded") && a.isPublished && ( … )}
```
and drop the unreachable `"draft"` branch (or make the API create a draft row and return it).

---

### C3 · `Select` never displays the selected value
**`src/components/ui/select.tsx:67-69`**

```tsx
const SelectValue = ({ placeholder }: { placeholder?: string }) => (
  <span className="block truncate">{placeholder || ""}</span>
)
```

`SelectValue` has no access to the selected value — it only prints the placeholder. An SSR probe with `value="course-1"` rendered the placeholder text, never the value.

**Impact:** all three dropdowns in the "New Exam" dialog (`src/app/dashboard/exams/page.tsx:409` course, `:439` lesson, `:465` exam type) keep showing *"Select a course…"* after a selection. The lesson dropdown then populates while still displaying "Select a lesson…", so the form reads as unresponsive. The native `<select>` underneath is `opacity-0`, so the mismatch is permanent.

The primitive is also not a Radix Select: no `combobox`/`listbox` roles, no focus management, no portal, `SelectTrigger` is an inert `<button>`, and `SelectContent`/`SelectItem` are hand-rolled (`<option>` with `display:block`, which is invalid).

**Fix (preferred):** replace with `@radix-ui/react-select` following the shadcn pattern (Trigger / Value / Icon / Content / Viewport / Item / ItemIndicator). It is a one-file, drop-in replacement — the call sites already use the Radix-shaped API.
**Fix (minimal):** thread the selected value into `SelectValue` (e.g. `Select` clones the trigger with the matched `SelectItem` label) and add `role="combobox"`, `aria-expanded`, and `aria-activedescendant`.

---

### C4 · An admin's own courses are invisible — a newly created course vanishes
**`src/app/dashboard/courses/page.tsx:93-95`** (same pattern at `src/app/dashboard/content/page.tsx:43-45`)

```tsx
const response = await courseApi.list(isManager ? { mine: true, limit: 50 } : { limit: 50 })
```

Backend (`app/api/v1/endpoints/courses.py:48-59`): with `mine=true` the instructor filter is applied **only for `role == "instructor"`**; for an admin `instructor_id` stays `None`, so `app/crud/course.py:56-59` applies `Course.status == "published"`. New courses are always created as `draft` (`app/crud/course.py:127`).

**Impact:** an admin creates a course → it is saved → `load()` re-fetches → the admin's list contains every *published* course on the platform and **none of their own drafts**. The course they just created disappears, and the empty state then claims *"You haven't created any courses yet."* (`:301-312`).

**Fix:** don't send `mine: true` for admins, or add an explicit `status`/`include_drafts` filter the API honours for admins (instructor-owned drafts must stay listable). Note `get_courses` also filters `Course.is_private.is_(False)` (`app/crud/course.py:54`), so private courses are invisible on every list endpoint — that filter needs the same treatment.

---

## P1 — High

### H1 · A failed quiz submission replaces the form with a dead-end error card
**`src/app/dashboard/quizzes/[quizId]/take/page.tsx`** — render order is `loading → error → result → quiz` (`:174, :187, :205, :271`). `handleSubmit` sets `error` on failure (`:146-151`), so the error branch wins and the quiz form is replaced by a card whose only action is `router.back()`. The student cannot retry from the page and their answers are unreachable.
**Fix:** split `loadError` (blocking) from `submitError` (inline banner over the form); keep the form mounted so the student can retry (the `submittingRef` double-submit guard already exists).

### H2 · The forgot-password flow cannot be completed in production
**`src/app/forgot-password/page.tsx:39-42, :133-137`** — after requesting a reset the UI *always* advances to the reset step and asks the user to "Paste the token from your email". The backend only returns `reset_token` inline in development (`DEBUG_RESET_TOKEN`); there is no mail service, so in production the token is never delivered and never arrives. The page also never reads a token from the URL.
**Fix:** in production, stay on an "check your email" confirmation step; add `/forgot-password/reset` that reads `reset_token` from `useSearchParams` and pre-fills the field; gate the dev prefill behind `ENVIRONMENT === development`.

### H3 · The login page ships rotated seed credentials in the client bundle
**`src/app/login/page.tsx:23-27`** — the "Quick access" panel hard-codes `admin@lms.com / Admin123!@#`, `instructor@lms.com / Instructor123!@#`, `student@lms.com / Student123!@#`. Those passwords were rotated (`Admin123!@#` → `LmsAdmin#2026`, etc.), so clicking a role button fills a password that now **always fails with 401**, and the credentials are readable in the shipped JavaScript.
**Fix:** delete the panel from the production bundle (gate on `NEXT_PUBLIC_ENV !== "production"`), and rotate the seed accounts per AGENTS.md before any deployment.

### H4 · The profile password form never verifies the current password
**`src/app/profile/page.tsx:77` (validation), `:92-94` (request), `:275` (input)** — the "Current password" field is required by the form but is never sent. `authApi.updateProfile({ password })` → `PUT /users/me` → `app/schemas/user.py:14-21` has no current-password field and `app/api/v1/endpoints/users.py:71-73` hashes the new password directly. Anyone holding a valid JWT can rotate the account password without knowing the current one; the field is decorative.
**Fix:** add `current_password` to the request, verify it server-side before applying the change, and surface the real error.

### H5 · The student "Search courses" box does nothing
**`src/app/dashboard/courses/page.tsx:195-241`** — the student branch (`if (!isManager)`) computes `filtered` (`:190`) but renders `courses.map(...)` (`:241`). A search that matches nothing shows *"No courses available."* **above the full unfiltered list**. The manager branch (`:327`) correctly uses `filtered.map`.
**Fix:** render `filtered.map(...)`, and distinguish "no courses exist" from "no results for “x”" (with a Clear-filters action).

### H6 · A student-controlled URL is rendered as a trusted link for instructors
**`src/app/dashboard/assignments/page.tsx:181-183` → `src/app/dashboard/courses/[courseId]/assignments/page.tsx:318-327`**
`url = externalUrl.trim()` is stored verbatim (`app/schemas/assignment.py:75-78`: `file_url: str`, no validator) and later rendered as `<a href={s.file_url} target="_blank">` in the staff submissions view. Any scheme a student types (`data:`, `file:`, an internal host) reaches staff as a legitimate-looking attachment link.
**Fix:** allow-list `http(s)` only — validate client-side *and* server-side, and normalise with `new URL()` before rendering the anchor.

### H7 · `/dashboard/users` admits instructors, but the API is admin-only
**`src/app/dashboard/users/page.tsx:117`** allows `admin` **or** `instructor`; `app/api/v1/endpoints/users.py:104-111` returns 403 for non-admins, and `PUT /users/{id}` is admin-only too. Instructors get the full table UI, a permanent 403 and an error banner; `src/components/layout/sidebar.tsx:56` still links "Users" to instructors.
**Fix:** restrict the page to `role === "admin"` and drop `instructor` from the sidebar item's `roles`.

### H8 · Editing a course silently publishes it
**`src/app/dashboard/courses/page.tsx:129, :154`** — `openEdit` hard-codes `is_private: false` and the save payload always sends `is_private`. `app/crud/course.py:184-185` applies any non-`None` value, so every save of a private course flips it to public. The list response never includes `is_private` (`app/schemas/course.py:36-53`), so the client cannot hydrate the real value.
**Fix:** omit `is_private` from the payload unless the user toggles it, and add the field to `CourseListResponse`. (Blast radius today is limited because `get_courses` filters private courses out of every list endpoint — see C4.)

### H9 · Notifications are not navigable
**`src/app/dashboard/notifications/page.tsx:234-261`** — the API returns `link_url` for every notification (`app/api/v1/endpoints/notifications.py:48`) and the app bar navigates to it (`src/components/layout/appbar.tsx:164`), but the notifications page only marks the item read. The user must hunt for the target manually.
**Fix:** on click, `markRead(n)` **and** `router.push(n.link_url ?? "/dashboard/notifications")`.

### H10 · Mutations are applied locally even when the API rejects them
- `src/app/dashboard/courses/[courseId]/assignments/page.tsx:162-168` — `await assignmentApi.delete(a.id)` result never inspected, then the row is removed from state. `src/lib/api.ts` resolves to `{ error }` instead of throwing, so a 403 ("You don't own this assignment") silently removes the item.
- `src/app/dashboard/notifications/page.tsx:157-161` — same for announcements; `.catch(() => {})` never fires because the client does not reject.
- `src/app/dashboard/courses/[courseId]/quizzes/page.tsx:118-123` — same for quiz deletion.
- `src/app/dashboard/users/page.tsx:97-106` — a single `updating` id is clobbered when two updates overlap.
**Fix:** inspect `resp.error` before mutating local state; revert optimistic updates on failure and surface a toast (once C1 is fixed).

### H11 · Due dates are shifted by the UTC/local mismatch
**`src/app/dashboard/courses/[courseId]/assignments/page.tsx:504-509`** — `new Date(due_date).toISOString().slice(0,16)` formats **UTC** into a `<input type="datetime-local">`, which expects **local** time. In Asia/Manila (UTC+8) an 08:00 due date displays as 00:00; on save the naive local string is posted verbatim and stored as UTC, shifting it again.
**Fix:** format with `getFullYear/getMonth/getDate/getHours/getMinutes`; convert back with `new Date(value).toISOString()`.

### H12 · API client: no timeout, no abort, and 307 redirects on every collection call
**`src/lib/api.ts:57, :73-75, :126, :134-139`** — `fetch` is issued with no `AbortController` and no timeout (a stalled backend hangs the request forever); endpoints are built without trailing-slash normalisation while the backend redirects `/courses` → `/courses/` (307), costing an extra round trip per list call and risking header/credential semantics.
**Fix:** add a default `AbortController` timeout to `request()`/`upload()` (return `{ error: "Request timed out" }` on `AbortError`), normalise collection URLs, and expose an abort handle for components.

### H13 · Native `alert()` / `confirm()` instead of the toast system
12 call sites across 8 files: `src/app/dashboard/courses/[courseId]/quizzes/page.tsx:118,198,244`; `src/app/dashboard/assignments/page.tsx:210`; `src/app/dashboard/notifications/page.tsx:158`; `src/app/dashboard/courses/page.tsx:179`; `src/app/dashboard/courses/[courseId]/assignments/page.tsx:163,189,236`; `src/app/components/discussions/course-discussions.tsx:108,116`; `src/app/courses/[id]/page.tsx:438`; `src/app/courses/[id]/learn/page.tsx:226`. They block the main thread, ignore the theme, and are inconsistent with the `role="alert"` / `setFormError` pattern already used in `courses/page.tsx:485-489`.
**Fix:** land C1 first, then convert every call to `toast()` + inline field errors.

---

## P2 — Medium

**Accessibility**
- **Unlabelled controls:** `src/app/dashboard/courses/[courseId]/assignments/page.tsx:469-519` (title, file, URL, due date, max score), `src/app/dashboard/assignments/page.tsx:329-357`, `src/app/courses/[id]/page.tsx:371-372` (review form labels have no `htmlFor`/`id`), and the grading score input at `.../[courseId]/assignments/page.tsx:25-33` (announced as "edit, spin button").
- **Icon-only buttons with no accessible name:** `.../[courseId]/assignments/page.tsx:426-441` (compare `src/app/dashboard/courses/page.tsx:362,392`, which set `aria-label`).
- **`aria-selected` on `role="button"`:** `src/app/profile/page.tsx:147,160` (also flagged by ESLint).
- **Hand-rolled switch without a focus ring:** `src/app/dashboard/users/page.tsx:291-310` — the real input is `sr-only` and no `peer-focus-visible` styling exists, so keyboard users get no focus indicator; `src/components/ui/switch.tsx` already exists.
- **Tabs without a tabpanel/arrow keys:** `src/app/dashboard/notifications/page.tsx:192-213`; the unread dot uses `aria-label` on a role-less `<span>` (`:254`, mirrored in `appbar.tsx:240-243`).

**Design-system drift**
- **Hand-rolled modals** (no `role="dialog"`, no focus trap, no ESC, no backdrop dismiss) instead of the shipped Radix `Dialog`: `src/app/dashboard/assignments/page.tsx:317-390`, `src/app/dashboard/courses/[courseId]/assignments/page.tsx:455-465`, `src/app/dashboard/courses/[courseId]/quizzes/page.tsx:357-609`, `src/components/quizzes/attempt-review.tsx:106-226`.
- **Hand-rolled form controls** where `Input`/`Label`/`Select`/`Switch`/`Progress`/`Badge` exist: `.../[courseId]/quizzes/page.tsx:373-587`, `src/app/dashboard/content/page.tsx:150-171`, `src/app/dashboard/users/page.tsx:166-200`, `src/app/dashboard/students/page.tsx:189-231`, `src/app/dashboard/exams/page.tsx:493-500` (textarea), `src/app/dashboard/content/page.tsx:178-186`.
- **Six duplicated status-badge implementations** (two of them byte-identical): `courses/page.tsx:58-71`, `content/page.tsx:178-186`, `enrollments/page.tsx:19-24`, `gradebook/page.tsx:14-19`, `students/page.tsx:27-32`, `users/page.tsx:37-41`.
- **Hand-rolled progress bars** (no `role="progressbar"`/`aria-valuenow`): `analytics/page.tsx:169-176`, `enrollments/page.tsx:128-133,173-178`, `gradebook/page.tsx:159-164`, `students/page.tsx:343-348`, `learning/page.tsx:140-146`.
- **Hardcoded palette colours** bypass the `globals.css` tokens and break dark mode: `courses/page.tsx:64-65`, `content/page.tsx:181-182`, `enrollments/page.tsx:20-23`, `gradebook/page.tsx:16-18`, `students/page.tsx:29-31`, `users/page.tsx:38-40`, `assignments/page.tsx:244,258,340`, `courses/[id]/page.tsx:343,354,481-482` (`#eab308`, `#ddd` star colours), `courses/[id]/learn/page.tsx:385-386,501-502`.
- **`formatCurrency`/`formatDate` duplicated** instead of `src/lib/format.ts`: `dashboard/page.tsx:155-160`, `analytics/page.tsx:102-106`, `courses/page.tsx:346-349`, `students/page.tsx:40-48`, `users/page.tsx:61-68`; the landing page's local `formatPrice` shows "Free" where the shared helper shows "₱0.00" (`src/app/page.tsx:120-126` vs `src/lib/format.ts:4-9`).

**Correctness / data**
- **Numeric inputs coerce to magic defaults** and silently corrupt values: `.../[courseId]/quizzes/page.tsx:411` (`NaN → null`), `:421` (`|| 0` — a cleared passing grade becomes 0, i.e. "everything passes"), `:431` (`|| 3`), `:584` (`|| 1`), `.../[courseId]/assignments/page.tsx:513-518` (`|| 100`), `:543-548` (`|| 0`), `courses/page.tsx:140-144` (`parseFloat("12abc") === 12`).
- **Stale list under a new heading:** `.../[courseId]/assignments/page.tsx:170-174` — `submissions` is never cleared and there is no request-id guard, so a previous assignment's submissions appear under the next heading (and stay there if the fetch fails).
- **Clearing a description never persists:** `courses/page.tsx:149-150` sends `undefined`, which `JSON.stringify` drops, and `app/crud/course.py:164-167` skips `None` → the old text survives.
- **Stale-closure mutation:** `.../[courseId]/assignments/page.tsx:166` and the notification/quiz deletes capture the array instead of using a functional update.
- **Missing error states:** `src/app/dashboard/page.tsx:249-251` (a failed stats call renders an empty grid — indistinguishable from zero), `src/app/dashboard/assignments/page.tsx:72-115` (a failed load shows "No assignments found"), `src/app/dashboard/learning/page.tsx:59-70` (no retry), `src/app/courses/[id]/learn/page.tsx:180-184` (a swallowed error shows "Course not found or not enrolled").
- **Silent pagination truncation:** `enrollments/page.tsx:36`, `students/page.tsx:96`, `users/page.tsx:88`, `courses/page.tsx:93-95`, `content/page.tsx:44`, `analytics/page.tsx:55` cap at 50–100 rows and then report the *fetched* count as the total (`:79`, `:165`, `:143`).
- **Client-side filtering over data the API can filter:** `users/page.tsx:108-115`, `students/page.tsx:117-127`, `gradebook/page.tsx:65-68`.
- **N+1 fan-out with silent drops:** `content/page.tsx:43-53` — 50 parallel lesson requests; a failed course yields `data === undefined → ?? []`, so that course's lessons disappear with no indication.
- **`useAuthStore()` without a selector** in 24 places (`analytics/page.tsx:42`, `content/page.tsx:29`, `courses/page.tsx:74`, `enrollments/page.tsx:27`, `gradebook/page.tsx:28`, `notifications/page.tsx:48`, `.../[courseId]/assignments/page.tsx:99`, …) — every store write re-renders the page.
- **Tokens in `localStorage`:** `src/store/auth.ts:52-54` persists `user`, `token` **and** `refreshToken`; any XSS yields a full account takeover. Prefer memory-only access tokens + an HttpOnly refresh cookie.
- **No hydration guard on auth-dependent rendering:** `isAuthenticated` flips after `persist` rehydrates (`src/store/auth.ts:46-49`), while `src/app/page.tsx:130`, `src/components/layout/landing-appbar.tsx:18-24` and `src/app/courses/[id]/page.tsx:36,175` branch on it during the first render.
- **Radix theme not synced with `next-themes`:** `src/components/theme-provider.tsx:36-42` renders `<RadixTheme>` without `appearance`; the `RadixThemeProvider` helper that reads `useTheme()` (`:9-26`) is never used.
- **Full page reloads instead of client navigation:** `src/app/courses/[id]/page.tsx:176,185` (`window.location.href`), `src/app/courses/[id]/learn/page.tsx:376` (`window.open` → popup blocker).
- **Dead feedback parameter:** `.../[courseId]/assignments/page.tsx:13-19,37-43` — `GradingForm.onGrade(score, feedback)` never passes `feedback`, and the form has no feedback control, although the API supports it (`app/api/v1/endpoints/assignments.py:392-398`).

---

## P3 — Low

- `src/components/layout/auth-guard.tsx` — **never used anywhere** (and missing `'use client'`); dead code.
- `src/lib/api.ts:257` — `courseApi.get` typed with 3 of the real fields; `getDetail` is used instead.
- `src/lib/api.ts:722-728` — `reviewApi.create` returns `unknown`; the caller spreads it into an `any[]`.
- `src/app/login/page.tsx:35,194-202` — `rememberMe` is dead state (never read by the login call).
- `src/app/forgot-password/page.tsx:20,40-41` — `devToken` duplicates `resetToken`.
- `src/app/dashboard/page.tsx:66-83` — `TrendIndicator`'s `up`/`down` variants are dead (all 12 cards pass `"neutral"`); the "Recent Activity" section (`:539-567`) always renders "No activity to show yet" and can never be non-empty.
- `src/app/dashboard/settings/page.tsx:31-42` — three rows styled `cursor-pointer` with no `onClick`, no role and no destination ("Account" doesn't even link to `/profile`).
- `src/app/dashboard/notifications/page.tsx:296` — the delete button is granted by display name (`a.author_name === user?.full_name`), not by author id.
- `src/components/ui/card.tsx:31-33` — `CardTitle` is a `forwardRef<HTMLParagraphElement>` but renders an `<h3>`; same for `CardDescription`.
- `src/components/ui/badge.tsx` — no `cva`, no exported `badgeVariants` (inconsistent with `Button`).
- `src/components/ui/progress.tsx` — `aria-valuenow` can be `undefined`.
- `src/components/ui/dialog.tsx:68-86`, `sheet.tsx:68-87` — close buttons remove the outline (`focus-visible:outline-none`) without adding a focus ring.
- `src/components/ui/toast.tsx:115-143` — `ToastClose` has no focus ring; the viewport sits top on mobile while the animations slide from the bottom.
- `src/components/ui/switch.tsx` — props typed as `HTMLAttributes<HTMLLabelElement>`, no `role="switch"`/`aria-checked`.
- `src/components/layout/sidebar.tsx:149-153` and `appbar.tsx` — role/status colours are hardcoded and duplicated in two places.
- `src/app/next.config.js` — no `Content-Security-Policy`, `Referrer-Policy` or `Permissions-Policy` header; `X-XSS-Protection` is deprecated.
- Password rules duplicated and inconsistent: login `min(1)` (`login/page.tsx:16-19`), register `min(8)` (`register/page.tsx:15-19`), forgot-password inline `min(8)` (`forgot-password/page.tsx:53-60`); the forgot-password form has no email-format validation.
- Copy inconsistencies: "Enrollment Requests" (appbar) vs "Enrollments" (page); "Assignments" vs "My Assignments"; `src/app/dashboard/help/page.tsx:34` claims user management is available to instructors (it is admin-only).
- `useState<any[]>` / `any` in `src/app/courses/page.tsx:26`, `src/app/courses/[id]/page.tsx:18-23`; `as unknown as` casts around API payloads (`.../[courseId]/assignments/page.tsx:30,52`).
- Index-as-key lists: `src/app/dashboard/assignments/page.tsx:280-285`, `.../[courseId]/assignments/page.tsx:527-565`, `src/app/dashboard/quizzes/[quizId]/take/page.tsx:321`.
- `src/app/dashboard/courses/[courseId]/assignments/page.tsx:391-398` — a `<Button>` nested inside `CardTitle` (an `<h3>`).
- `src/app/dashboard/courses/[courseId]/assignments/page.tsx:121` — `lessonsResp.data.sort(...)` mutates the array owned by the API client.

---

## Appendix A — ESLint output (7 warnings, 0 errors)

```
src/app/courses/[id]/learn/page.tsx:193          missing deps: isAuthenticated, router (complex expression)
src/app/dashboard/courses/[courseId]/assignments/page.tsx:114   missing dep: loadData
src/app/dashboard/courses/[courseId]/quizzes/page.tsx:71        missing dep: loadData
src/app/dashboard/students/page.tsx:61          <img> instead of next/image
src/app/profile/page.tsx:147,160                aria-selected not supported on role="button"
src/components/quizzes/attempt-review.tsx:58    missing dep: loadAttempts
```

Reproduce (the host has no node/npm, so the lint runs in the image):
```bash
cd packages/web && tar --exclude='./node_modules' --exclude='./.next' -cf - . \
  | docker build -q -f .lint.Dockerfile -t elms-lint-check -
docker run --rm elms-lint-check sh -c "npm run lint"
```

The three `exhaustive-deps` findings are the same class of bug as H1/H10 (stale closures over async loaders) and should be fixed with the shared-loader refactor below, not suppressed.

---

## Appendix B — Structural recommendations (not per-file bugs)

1. **One data-loading hook.** Every page re-implements the `loading / error / rows` triple with slightly different semantics (some check `resp.data`, some `resp.error`, some neither). A shared `useApiResource<T>(fetcher, deps)` returning `{ data, loading, error, reload }` would fix H10, the missing error states, the missing abort, and the three `exhaustive-deps` warnings at once.
2. **Fix the primitives before the pages.** `Select` (C3), `Toaster` (C1), `Switch`, `Dialog` usage, `Badge`/`Progress` duplication and the token colours are the root cause of most of the P2 list; fixing the primitives removes the incentive to hand-roll.
3. **One design-system source of truth.** Move status/role tone maps, formatters (`formatCurrency`, `formatDate`) and initials into `src/lib/format.ts` + `src/lib/` helpers; replace raw Tailwind palette classes with the `globals.css` tokens.
4. **Unify feedback.** With C1 fixed, replace all `alert()`/`confirm()` with `toast()` + inline field errors, and replace hand-rolled overlays with the Radix `Dialog`.
5. **Server-side filters and pagination.** Push `role`/`is_active`/`course_id`/status filters to the API (they already exist) and add skip/limit controls so the header counters are real totals.

### Suggested fix order
`C1 → C2 → C3 → C4` (each is small and self-contained) → `H1, H2, H3, H4` (correctness/security) → `H5-H12` → shared loader + primitive cleanups → P3 sweep.
