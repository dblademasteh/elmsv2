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
| **Deploy footprint** | 3 containers (db/redis/api) + Node | 1 web server + DB | 6–8 services | 20+ containers | 1 web + DB |

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
| **Course authoring UI** | ❌ (API exists, no page) | ✅ | ✅ | ✅ (studio) | ✅ |
| **Course structure (modules/sections)** | ❌ flat lesson list | ✅ | ✅ | ✅ | ✅ |
| **Prerequisites / conditional release** | ❌ (free-text field only) | ✅ | ✅ | ✅ | ✅ |
| **Lessons w/ mixed content types** | ✅ video/text/quiz/assignment/download | ✅ | ✅ | ✅ | ✅ |
| **Rich content editor** | ❌ `content_json` unused | ✅ Atto/TinyMCE | ✅ RCE | ✅ | ✅ |
| **Video hosting/streaming** | ❌ external `video_url` | ⚠️ plugin/external | ✅ Studio | ✅ | ⚠️ external |
| **Quizzes & auto-grading** | ✅ MC/TF/short-answer | ✅ 15+ question types | ✅ | ✅ | ✅ |
| **Question bank / pools** | ❌ (questions embedded in quiz JSONB) | ✅ | ✅ | ✅ | ✅ |
| **Time-limit enforcement** | ⚠️ stored, never enforced | ✅ | ✅ | ✅ | ✅ |
| **Question randomization** | ⚠️ flag stored, not applied | ✅ | ✅ | ✅ | ✅ |
| **Academic integrity (lockdown/proctoring)** | ❌ | ⚠️ plugins | ⚠️ plugins | ⚠️ | ❌ |
| **Plagiarism detection** | ❌ | ✅ plugin (Turnitin etc.) | ✅ | ❌ | ⚠️ |
| **Assignments (create/submit/grade)** | ✅ with rubric field + feedback | ✅ | ✅ | ✅ | ✅ |
| **File upload / storage** | ❌ submission is a `file_url` string | ✅ | ✅ | ✅ | ✅ |
| **Rubrics used in grading** | ⚠️ stored, never rendered | ✅ | ✅ | ✅ | ✅ |
| **Late submission detection** | ❌ column exists, never computed | ✅ | ✅ | ✅ | ✅ |
| **Gradebook / grade calc / export** | ❌ (per-item scores only) | ✅ | ✅ | ✅ | ✅ |
| **Progress tracking & persistence** | ❌ crud exists, **no endpoint**; UI is client-local | ✅ | ✅ | ✅ | ✅ |
| **Certificates** | ❌ columns only | ✅ plugin | ✅ | ✅ | ✅ |
| **Discussions / forums** | ❌ (tables in SQL migration only) | ✅ | ✅ | ✅ | ✅ |
| **Announcements** | ❌ | ✅ | ✅ | ✅ | ✅ |
| **Messaging / notifications / email** | ❌ | ✅ | ✅ | ✅ | ✅ |
| **Calendar / due dates view** | ❌ (`due_date` never surfaced) | ✅ | ✅ | ✅ | ✅ |
| **Analytics & reporting** | ❌ fake dashboard numbers | ✅ logs, completion, report builder | ✅ Analytics 2 / Canvas Data | ✅ (strongest: Insights) | ✅ |
| **Course reviews & ratings** | ✅ 3-criterion + distribution | ⚠️ plugin | ❌ | ❌ | ❌ |
| **Self-enrollment** | ✅ (published, non-private) | ✅ | ✅ | ✅ | ✅ |
| **Enrollment approval workflow** | ⚠️ fake UI page | ✅ | ✅ | ✅ | ✅ |
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
| Courses & catalog | ~70% | API complete, **zero authoring UI**; no categories/search backend. |
| Lessons/content | ~75% | Flat structure; no modules, no editor. |
| Quizzes | ~75% | Works end-to-end but weakest vs. any competitor's question bank. |
| Assignments & grading | ~80% | Strongest module; blocked by URL-only submissions. |
| Enrollments & progress | ~50% | Progress is **non-functional** — the #1 LMS metric. |
| Reviews/ratings | ~85% | Genuine differentiator; Moodle needs a plugin, Canvas has none. |
| Frontend overall | ~55% | 6 of 18 dashboard pages are hardcoded stubs. |
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
| 3 | **Gradebook** — aggregate quiz + assignment scores per enrollment, student + instructor view, CSV export ([#1](https://github.com/dblademasteh/elmsv2/issues/1)) | Core expectation; score data already exists | M |
| 4 | ◐ **Half done** — real `GET /dashboard/stats` aggregation (role-aware) wired into the main dashboard's stat cards; stub pages (analytics, content, enrollments) still to fix or remove ([#2](https://github.com/dblademasteh/elmsv2/issues/2)) | Fake UI is a credibility tax in any comparison | M |
| 5 | **Course authoring UI** (create/edit/publish) — API methods already in `lib/api.ts`, uncalled ([#3](https://github.com/dblademasteh/elmsv2/issues/3)) | Blocks instructors from actually using the product | M |
| 6 | **Notifications + announcements** (even in-app only, no SMTP) ([#4](https://github.com/dblademasteh/elmsv2/issues/4)) | Table-less; communication is table stakes | M |
| 7 | **Discussions** — tables already in `migrations/000001` ([#5](https://github.com/dblademasteh/elmsv2/issues/5)) | Schema is ahead of implementation | M |
| 8 | ◐ **Half done** — `POST /auth/refresh` exchange (silent auto-refresh in the API client) + `POST /auth/logout` shipped; password reset and lockout still open ([#6](https://github.com/dblademasteh/elmsv2/issues/6)) | Security baseline | S–M |
| 9 | ✅ **DONE** **Quiz enforcement** — `POST /courses/quizzes/{id}/start` attempt flow with server-side time-limit enforcement (+15s grace), server-side question randomization, ownership checks on create/delete | Flags exist but were lies before | S |
| 10 | **Modules/sections** for course structure + categories/search ([#7](https://github.com/dblademasteh/elmsv2/issues/7)) | Catalog scalability | M |
| 11 | **Migrations (alembic) + tests + CI** ([#8](https://github.com/dblademasteh/elmsv2/issues/8)) | Required before any production claim | M |
| 12 | **LTI 1.3 + SCORM import** ([#9](https://github.com/dblademasteh/elmsv2/issues/9)) | Only path to interop parity | L |
| 13 | **i18n (next-intl) + accessibility audit** ([#10](https://github.com/dblademasteh/elmsv2/issues/10)) | Parity with all four competitors | L |
| 14 | **Mobile/PWA** ([#11](https://github.com/dblademasteh/elmsv2/issues/11)) | Moodle's offline app is a documented differentiator | L |

**Deliberately out of scope for a small project:** proctoring, multi-tenancy, plugin marketplace, 20+ microservices parity with Open edX. Compete on simplicity, not breadth.

> **Verification of the ✅/◐ items:** 21-test smoke suite run against a live `docker compose up` stack (all pass) covering refresh/logout, role-aware stats, persisted lesson progress incl. 100% auto-completion, multipart upload + served file + blocked extensions, and quiz start/time-limit/randomization/ownership flows. Frontend: `tsc --noEmit` clean and a clean `next build` (19/19 pages).

---

## 6. Competitive Positioning Statement

> eLMS is a **modern, lightweight cohort-based teaching tool** — the equivalent of a focused alternative to Moodle for a single instructor or small institution that values a clean Next.js/FastAPI codebase over 20 years of plugin legacy. It is **not** yet a drop-in replacement for Moodle/Canvas/Open edX: file storage, progress persistence, gradebook, communication, and reporting are the five gaps that must close before the comparison is defensible.

---

### Sources
- eLMS: direct code inventory of `app/` (8 endpoint modules, 10 models) and `packages/web/src/app/` (18 routes), 2026-10-18.
- OpenEduCat, "Open Source LMS Comparison 2026" (Moodle vs Open edX vs Canvas vs ILIAS vs Sakai vs Chamilo).
- Open edX blog, "Moodle versus the Open edX Platform: 9 Key Differences".
- MooDIY, "Moodle vs Canvas vs Blackboard in 2026" (mobile, analytics, cost tables).
- Gartner Peer Insights LMS comparisons (Moodle 4.1/76 reviews, Canvas 4.6/85, Open edX 4.5/11).
