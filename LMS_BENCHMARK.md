# eLMS Capability Benchmark vs. Other Open-Source LMS Web Apps

**Date:** 2026-10-18
**Subject:** eLMS (this repo) compared feature-by-feature against Moodle, Canvas LMS (open source), Open edX, and Chamilo.
**Method:** Feature inventory extracted directly from code (`app/`, `packages/web/`); competitor capabilities from public 2026 documentation/comparisons.

---

## 1. Executive Summary

| | eLMS | Moodle | Canvas (OSS) | Open edX | Chamilo |
|---|---|---|---|---|---|
| **Overall capability** | ~15% of a production LMS | Full | Full (open core) | Full | Full |
| **Best for** | Small cohort courses, MVP/portfolio | K-12, higher ed, any scale | Higher ed wanting modern UX | MOOCs, corporate training | Lightweight institutional use |
| **Stack** | FastAPI + Next.js 14 + Postgres | PHP + MySQL/Postgres | Ruby + React + PG/Redis/ES | Django Python microservices | PHP + MySQL |
| **Maturity of *implemented* code** | Alpha (~55% frontend, ~60% backend of its own scope) | 20+ yrs | 10+ yrs | 12+ yrs | 15+ yrs |
| **Deploy footprint** | 3 containers (db/redis/api) + Node; also runs natively (Postgres + uvicorn + Node) | 1 web server + DB | 6–8 services | 20+ containers | 1 web + DB |

**Headline finding:** eLMS has a *credible core loop* — author course → publish → enroll → lesson → quiz (auto-graded) → assignment (submit → grade) → review. That loop actually works end-to-end. Everything surrounding it (progress persistence, gradebook, file storage, communication, reporting, standards, mobile, i18n) is either absent or UI-stubbed.

---

## 2. Feature Matrix

Legend: ✅ full · ⚠️ partial/stub · ❌ absent

| Capability | eLMS | Moodle | Canvas (OSS) | Open edX | Chamilo |
|---|---|---|---|---|---|
| **User auth (login/register/JWT)** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Password reset / email verify** | ❌ | ✅ | ✅ | ✅ | ✅ |
| **SSO / OAuth / LTI 1.3 login** | ❌ | ✅ | ✅ | ✅ | ✅ |
| **Two-factor auth** | ❌ | ✅ | ✅ | ✅ | ✅ |
| **Roles & permissions** | ⚠️ 3 fixed roles, inline checks | ✅ granular (site/course/activity) | ✅ roles + sub-accounts | ✅ complex roles | ✅ |
| **Course CRUD** | ✅ API | ✅ | ✅ | ✅ | ✅ |
| **Course authoring UI** | ✅ create/edit/publish/archive on `/dashboard/courses` | ✅ | ✅ | ✅ (studio) | ✅ |
| **Course structure (modules/sections)** | ❌ flat lesson list | ✅ | ✅ | ✅ | ✅ |
| **Prerequisites / conditional release** | ❌ (free-text field only) | ✅ | ✅ | ✅ | ✅ |
| **Lessons w/ mixed content types** | ✅ video/text/quiz/assignment/download | ✅ | ✅ | ✅ | ✅ |
| **Rich content editor** | ❌ `content_json` unused | ✅ Atto/TinyMCE | ✅ RCE | ✅ | ✅ |
| **Video hosting/streaming** | ❌ external `video_url` | ⚠️ plugin/external | ✅ Studio | ✅ | ⚠️ external |
| **Quizzes & auto-grading** | ✅ MC/TF/short-answer | ✅ 15+ question types | ✅ | ✅ | ✅ |
| **Question bank / pools** | ❌ (questions embedded in quiz JSONB) | ✅ | ✅ | ✅ | ✅ |
| **Time-limit enforcement** | ✅ server-side (+15s grace) | ✅ | ✅ | ✅ | ✅ |
| **Question randomization** | ✅ server-side shuffle | ✅ | ✅ | ✅ | ✅ |
| **Academic integrity (lockdown/proctoring)** | ❌ | ⚠️ plugins | ⚠️ plugins | ⚠️ | ❌ |
| **Plagiarism detection** | ❌ | ✅ plugin (Turnitin etc.) | ✅ | ❌ | ⚠️ |
| **Assignments (create/submit/grade)** | ✅ with rubric field + feedback | ✅ | ✅ | ✅ | ✅ |
| **File upload / storage** | ⚠️ disk-backed `POST /files/upload`, served at `/uploads`; no cloud storage/AV | ✅ | ✅ | ✅ | ✅ |
| **Rubrics used in grading** | ⚠️ stored, never rendered | ✅ | ✅ | ✅ | ✅ |
| **Late submission detection** | ❌ column exists, never computed | ✅ | ✅ | ✅ | ✅ |
| **Gradebook / grade calc / export** | ⚠️ per-enrollment quiz+assignment aggregation, instructor/student views, CSV export; no categories/weightings | ✅ | ✅ | ✅ | ✅ |
| **Progress tracking & persistence** | ✅ `lesson_progress` table + endpoints, live in learn UI (manual completion) | ✅ | ✅ | ✅ | ✅ |
| **Certificates** | ❌ columns only | ✅ plugin | ✅ | ✅ | ✅ |
| **Discussions / forums** | ❌ (tables in SQL migration only) | ✅ | ✅ | ✅ | ✅ |
| **Announcements** | ❌ | ✅ | ✅ | ✅ | ✅ |
| **Messaging / notifications / email** | ❌ | ✅ | ✅ | ✅ | ✅ |
| **Calendar / due dates view** | ❌ (`due_date` never surfaced) | ✅ | ✅ | ✅ | ✅ |
| **Analytics & reporting** | ⚠️ real role-aware stats + per-course enrollment analytics; no logs/report builder | ✅ logs, completion, report builder | ✅ Analytics 2 / Canvas Data | ✅ (strongest: Insights) | ✅ |
| **Course reviews & ratings** | ✅ 3-criterion + distribution | ⚠️ plugin | ❌ | ❌ | ❌ |
| **Self-enrollment** | ✅ (published, non-private) | ✅ | ✅ | ✅ | ✅ |
| **Enrollment approval workflow** | ❌ instant self-enrollment only (fake approval UI removed) | ✅ | ✅ | ✅ | ✅ |
| **Cohorts / groups** | ❌ | ✅ | ✅ | ✅ | ✅ |
| **Multi-tenancy / institutions** | ❌ | ⚠️ | ✅ sub-accounts | ✅ | ⚠️ |
| **SCORM / xAPI / LTI** | ❌ | ✅ | ✅ | ✅ (LTI + XBlock) | ✅ |
| **i18n / localization** | ❌ hardcoded English | ✅ 100+ languages | ✅ | ✅ | ✅ |
| **Accessibility (WCAG)** | ❌ not audited | ✅ strong | ✅ strong | ✅ built-in checker | ⚠️ |
| **Mobile app / offline** | ❌ responsive web only | ✅ official app, offline sync | ✅ native apps | ✅ | ✅ |
| **Payments / e-commerce** | ❌ price fields only | ⚠️ plugins | ❌ OSS | ✅ commerce (paid certs) | ⚠️ |
| **Gamification** | ❌ | ✅ plugin | ⚠️ | ✅ | ⚠️ |
| **Plugin/extension system** | ❌ none | ✅ (biggest differentiator) | ⚠️ LTI + API | ✅ XBlocks | ⚠️ |
| **REST API coverage** | ✅ modern, small surface | ✅ extensive + webhooks | ✅ | ✅ + GraphQL | ✅ |
| **Dark mode / modern UI** | ✅ Tailwind + shadcn | ⚠️ themes | ✅ | ✅ | ⚠️ |

---

## 3. eLMS Scorecard by Area

| Area | eLMS completion (of its own scope) | vs. competitors |
|---|---|---|
| Auth & users | ~65% | Basic. No reset/verify/SSO/2FA/lockout (columns dead). |
| Courses & catalog | ~85% | Authoring UI shipped (create/edit/publish/archive); no categories/search backend. |
| Lessons/content | ~75% | Flat structure; no modules, no editor. |
| Quizzes | ~75% | Works end-to-end but weakest vs. any competitor's question bank. |
| Assignments & grading | ~80% | Strongest module; blocked by URL-only submissions. |
| Enrollments & progress | ~65% | Progress persisted end-to-end in the learn UI; approval workflow still a fake UI page. |
| Reviews/ratings | ~85% | Genuine differentiator; Moodle needs a plugin, Canvas has none. |
| Frontend overall | ~75% | No stub routes remain; authoring UI shipped. |
| Infrastructure | ~45% | Redis unused, no alembic, no tests, no CI. |

**Aggregate:** eLMS ≈ **15–20%** of the capability surface of Moodle/Chamilo, and well under 10% of Canvas/Open edX (which add scale, standards, and analytics).

---

## 4. Where eLMS Wins or Parities

1. **Stack modernity** — FastAPI + Next.js 14 App Router + TypeScript + Tailwind/shadcn vs. Moodle's PHP or Canvas's Ruby. Far lower barrier for a web dev team in 2026.
2. **Operational simplicity** — 3 containers vs. Open edX's 20+; runs on a laptop via `docker compose up`.
3. **Codebase legibility** — ~4k LOC backend / ~5.5k LOC frontend for the whole core loop; Moodle has ~20 years of accumulated complexity (a top user complaint in Gartner reviews).
4. **Course reviews with 3-criterion ratings** — not built into Canvas or Open edX core.
5. **Clean API design** — consistent `/api/v1` REST, Pydantic schemas, JWT with roles; easier to extend than Moodle's web-services layer.
6. **Auto-graded quizzes + assignment grading loop** — parity with competitors on the *basic* path.

---

## 5. Priority Gap-Closure Roadmap (to reach parity on essentials)

Ordered by benchmark impact per unit of effort:

| # | Gap | Why it matters | Rough effort |
|---|---|---|---|
| 1 | ✅ **DONE** **Progress persistence** — new `lesson_progress` table + `POST /courses/lessons/{id}/complete` + `GET /courses/{id}/progress`, wired into the learn page (checkmarks + live progress bar) | The #1 LMS metric; was dead code | XS |
| 2 | ✅ **DONE** **File upload endpoint** — `POST /files/upload` (extension allowlist, size limit, chunked to disk), static `/uploads` serving, file picker in the assignment submit modal | Submissions as raw URLs disqualify against every competitor | S |
| 3 | ✅ **DONE** **Gradebook** — `GET /dashboard/gradebook` (role-aware: instructor sees own courses' students, student sees own grades; overall = mean of quiz-avg grade and assignment-avg percent) + `GET /dashboard/gradebook/export` CSV, wired into a new `/dashboard/gradebook` page with course filter | Core expectation; score data already exists | M |
| 4 | ✅ **DONE** **Stub pages replaced with real data** — analytics page (role-aware stat cards from `GET /dashboard/stats` + real per-course enrollment chart), content page (real lesson inventory via lessons API, `?mine=true` added to course list for instructors), enrollments page (real enrollment list; fake "approve" UI removed — a real approval workflow is still future work, see matrix) | Fake UI is a credibility tax in any comparison | M |
| 5 | ✅ **DONE** **Course authoring UI** — "My Courses" management page on `/dashboard/courses`: create dialog (title/short description/description/level/price, featured flag for admins), inline edit dialog, publish/unpublish toggle, archive with confirm; drafts visible to their instructor via `?mine=true` | Blocks instructors from actually using the product | M |
| 6 | **Notifications + announcements** (even in-app only, no SMTP) ([#4](https://github.com/dblademasteh/elmsv2/issues/4)) | Table-less; communication is table stakes | M |
| 7 | **Discussions** — tables already in `migrations/000001` ([#5](https://github.com/dblademasteh/elmsv2/issues/5)) | Schema is ahead of implementation | M |
| 8 | ◐ **Half done** — real `POST /auth/refresh` exchange (silent auto-refresh in the API client) + `POST /auth/logout` shipped; password reset and lockout still open ([#6](https://github.com/dblademasteh/elmsv2/issues/6)). Note: `lib/api.ts` already defines `verifyEmail` / `requestPasswordReset` / `resetPassword` client methods, but no backend endpoints exist — dead code until item ships | Security baseline | S–M |
| 9 | ✅ **DONE** **Quiz enforcement** — `POST /courses/quizzes/{id}/start` attempt flow with server-side time-limit enforcement (+15s grace), server-side question randomization, ownership checks on create/delete | Flags exist but were lies before | S |
| 10 | **Modules/sections** for course structure + categories/search ([#7](https://github.com/dblademasteh/elmsv2/issues/7)) | Catalog scalability | M |
| 11 | **Migrations (alembic) + tests + CI** ([#8](https://github.com/dblademasteh/elmsv2/issues/8)) | Required before any production claim | M |
| 12 | **LTI 1.3 + SCORM import** ([#9](https://github.com/dblademasteh/elmsv2/issues/9)) | Only path to interop parity | L |
| 13 | **i18n (next-intl) + accessibility audit** ([#10](https://github.com/dblademasteh/elmsv2/issues/10)) | Parity with all four competitors | L |
| 14 | **Mobile/PWA** ([#11](https://github.com/dblademasteh/elmsv2/issues/11)) | Moodle's offline app is a documented differentiator | L |

**Deliberately out of scope for a small project:** proctoring, multi-tenancy, plugin marketplace, 20+ microservices parity with Open edX. Compete on simplicity, not breadth.

> **Verification of the ✅/◐ items (re-checked in code, 2026-10-18):** progress endpoints + learn-page wiring (`app/api/v1/endpoints/lessons.py:235,260`, `learn/page.tsx:169,207`), upload endpoint + `/uploads` static serving (`app/main.py:71`), role-aware stats (`app/api/v1/endpoints/stats.py`), refresh/logout (`auth.py:66,100`), and quiz attempt flow with server-side time-limit enforcement + randomization (`quizzes.py:287,382,504`) are all present. Frontend: `tsc --noEmit` clean. Note: the previously referenced 21-test smoke suite is not committed to this repo — the only committed test is `test_assignments.py` (assignment-flow smoke script); CI/tests remain open ([#8](https://github.com/dblademasteh/elmsv2/issues/8)).

---

## 6. Competitive Positioning Statement

> eLMS is a **modern, lightweight cohort-based teaching tool** — the equivalent of a focused alternative to Moodle for a single instructor or small institution that values a clean Next.js/FastAPI codebase over 20 years of plugin legacy. It is **not** yet a drop-in replacement for Moodle/Canvas/Open edX: file storage, progress persistence, gradebook, communication, and reporting are the five gaps that must close before the comparison is defensible.

---

### Sources
- eLMS: direct code inventory of `app/` (10 endpoint modules, 8 models) and `packages/web/src/app/` (21 routes), 2026-10-18.
- OpenEduCat, "Open Source LMS Comparison 2026" (Moodle vs Open edX vs Canvas vs ILIAS vs Sakai vs Chamilo).
- Open edX blog, "Moodle versus the Open edX Platform: 9 Key Differences".
- MooDIY, "Moodle vs Canvas vs Blackboard in 2026" (mobile, analytics, cost tables).
- Gartner Peer Insights LMS comparisons (Moodle 4.1/76 reviews, Canvas 4.6/85, Open edX 4.5/11).
