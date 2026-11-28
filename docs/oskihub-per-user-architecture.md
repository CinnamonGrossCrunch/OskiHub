# OskiHub v2: Per-User Architecture Plan

> **POST-COMMIT REVIEW — This is a repository copy of Matt's supplied
> `oskihub-per-user-architecture (4).md`. Added or corrected plan text and
> new log entries are bold and labeled below. Historical log entries are
> preserved. This implementation slice closes the reviewed guard and
> dashboard-state defects; it does not claim the Phase 1 foundation gate.**

Drafted Nov 24, 2026. Updated Nov 24, 2026: v2.oski.app dev address and
cutover steps added (Section 8, Phase 1, Phase 4). Updated Nov 24, 2026
(late): Copilot review corrections folded in, Canvas API recorded as
nonnegotiable with server-side syllabus storage, and course-catalog
sourcing added (Sections 3, 4, 5, 6b, 6d, 8, 9, 10, 11). Updated Nov 28,
2026: progress section below records what has shipped since the plan was
drafted.

## Progress as of Nov 28, 2026

Shipped:

- **Phase 0 complete.** PR #2 merged Nov 24, 2026 as `4d0f67d` (gate flag,
  CSP Supabase origin, privacy/terms/logo, Before User Created hook
  endpoint). Google consent screen published Nov 25; Search Console
  ownership verified; brand verification passed and branding published
  Nov 25. Gate flipped on Nov 25 (`AUTH_GATE_ENABLED=true`, deploy
  `a23066a`): signed-out visits redirect to `/login`, public paths (login,
  privacy, terms, ICS feeds, APIs) stay public, production sign-in as
  mattgross@berkeley.edu verified. Hook secret verified in Vercel and live.
- **Test subdomains live Nov 28.** `v2.oski.app` is a separate Vercel
  project (`oskihub-v2`, branch `v2`) with the gate on and a fresh test
  Supabase project (`nwtutdyibuejwsmgcrlg`) for blank-slate sign-up
  testing; the sign-in flow was verified to the Google chooser (shows
  OskiHub) without consuming Matt's test sign-up. `legacy.oski.app` serves
  the pre-auth branch (`legacy`, `2f66ffa`) behind Vercel Authentication
  Standard Protection; the old dashboard was verified loading with Vercel
  access. Production `www.oski.app` is unchanged by the subdomain setup.
- **Course-data pipeline healthy.** Manual auto-push retries on Nov 25 and
  Nov 27 ran clean (no ICS changes); scheduled runs on Nov 26 morning
  succeeded, with one security-block failure at 17:05 that Matt approved
  re-processing.

Update log (newest first; every OskiHub update gets a timestamped entry
here noting where it was committed, pushed, or deployed):

- **POST-COMMIT REVIEW — Nov 28, 2026, 04:02 PT: Implemented the next
  foundation repair slice on review branch
  `codex/phase1-guard-and-dashboard`, based on `ba386e4`. Commit location:
  this code-and-plan commit in the local OskiHub checkout; not deployed,
  and no hosted migration applied. Changes: missing/invalid/mismatched
  reviewed guards now withhold deadline transformations with conflicts;
  stale specific exceptions cannot fall through to general shifts;
  assignment-specific shifts stay scoped; `/me` separates loading, 401,
  unavailable, valid-empty, and ready states and displays conflicts and
  explanations. Added a forward guard migration, resolver/UI regression
  checks (`npm run test:foundation`), and a rollback-only ordinary-role
  database suite. Verification: regression checks passed, type-check
  passed, production build passed (existing unrelated lint warnings), and
  PGlite 0.3.14 passed the SQL suite plus existing-invalid-rule migration
  rollback. Local DB roles, `auth.uid()`, and grants were synthetic; these
  results do not prove the hosted Supabase configuration. Gate remains
  open pending hosted migration/ordinary-user tests and the full deployed
  two-user scenario, plus the other unfinished Phase 1 event-model work.**
- **POST-COMMIT REVIEW — Correction to the 03:45 entry below: `ba386e4`
  added optional guards and API conflict fields; it did not require a
  guard for every deadline transformation or show those states on `/me`.
  The historical entry is retained as recorded; the repair above closes
  those specific defects.**

- **Nov 28, 2026, 03:45 PT:** Second foundation review fixes deployed to
  v2. Committed locally as `f022e34`, pushed to GitHub branch `v2` as
  `ba386e4`, deployed by Vercel to `v2.oski.app`. Fixes: database load
  failures now return 503 unavailable instead of empty, resolution
  rules are scoped public vs owner-private in schema, loader, and
  resolver, and deadline shifts require expected value/revision guards
  with conflicts surfaced when inputs change. Verification: expanded
  acceptance passed, type-check passed, production build passed after
  clearing a full /tmp build cache, deployed `/api/me/calendar` still
  returns 401 signed out. Gate remains open pending ordinary-user
  database tests and the full deployed two-user scenario.
- **Nov 28, 2026, 03:27 PT:** Foundation review fixes deployed to v2.
  Committed locally as `2a3e6f5`, pushed to GitHub branch `v2` as
  `c6cb1c4`, deployed by Vercel to `v2.oski.app`. Fixes: section shift
  rules scoped through the assignment offering, source authority before
  revision in observation selection, fixture email-to-UUID mapping
  removed in favor of the verified Auth UUID, database-backed personal
  API loading, same-owner migration constraints and write policies,
  valid fixture UUIDs, expanded acceptance coverage, and a visible
  `/me` personal dashboard page. Verification: expanded acceptance
  passed, type-check passed, production build passed, deployed
  `/api/me/calendar` returns 401 signed out, and `/me` redirects to
  `/login`. Still open before the foundation gate can be claimed:
  apply and test the migration under ordinary user credentials and
  complete the full deployed two-user scenario.
- **Nov 28, 2026, 02:37 PT:** Initial Phase 1 foundation implementation
  deployed to v2; this was not a passed foundation gate. Committed
  locally as `d9c2483`, pushed to GitHub branch `v2` as `de4b031`,
  deployed by Vercel to `v2.oski.app`. Changes: split foundation
  identities and fixture data, resolver with separate
  observations/rules/overrides and guarded deadline shifts, explicit
  `/api/me/calendar` and `/api/me/dashboard` private routes, initial
  Supabase migration with owner-scoped RLS, and a fixture acceptance
  check. Verification at that time: seven-assertion acceptance script
  passed, type-check passed, production build passed, deployed
  `/api/me/calendar` returned 401 with
  `Cache-Control: private, no-store` for an unauthenticated request,
  and v2 root still redirected to `/login`.
- **Nov 28, 2026, 02:33 PT:** Assessed the Phase 1 foundation
  specification: it is sufficient to build and prove the personal-data
  path for two students with synthetic/public inputs, including
  identities, ownership, resolver rules, private APIs, and event/time
  semantics. It does not by itself deliver live APR coverage, catalog
  ingestion, Canvas OAuth, subscription delivery, or a multi-user
  launch.
- **Nov 28, 2026, 02:08 PT:** Assessed a Matt-only personal build before
  other users: feasible as the Phase 1 slice using the split records,
  private serving, Canvas feed, and Matt's existing single-user watcher
  data. Multi-user Canvas access still requires OAuth and a sponsor;
  the personal build should keep RLS and user-scoped records so it does
  not become a throwaway fork.
- **Nov 28, 2026, 02:07 PT:** Propagated the foundation contracts through
  the plan: Section 5 now splits courses, offerings, sections,
  enrollments, assignments/events, source observations, resolution
  rules, overrides, and resolved personal events; Phase 1 now carries
  the two-user proof and personal API wiring; Section 7 now says reused
  and adapted, with explicit no-fallback private auth; repo, feed, and
  parser passages now match the settled decisions.
- **Nov 28, 2026, 02:06 PT:** Assessed a consistency critique of this
  plan: correct. Section 5 still describes compressed `user_courses`,
  Section 9 still leaves `getUserEvents` wiring in Phase 3, Section 7
  still says components stay exactly, and older private-repo, feed, and
  parser passages need reconciliation with the settled decisions.
- **Nov 28, 2026, 02:04 PT:** Folded the agreed foundation contracts into
  Section 7: imported facts, resolution rules, and user overrides stay
  separate; effective values retain their selection reason; personal APIs
  require explicit API-route authentication and private per-user cache
  boundaries. Deployment isolation, scheduler choice, and browser-side
  APR parsing are treated as settled implementation choices.
- **Nov 28, 2026, 02:01 PT:** Reviewed an external critique of this plan:
  substantially right. Verified against code that middleware excludes API
  routes while Section 7 assumes middleware auth for personal APIs, and
  the dashboard route uses shared/public caching. The critique's core
  contracts stand: split course/offering/enrollment/event records,
  field-level reconciliation with provenance, private serving and cache
  boundaries, and an earlier two-user proof milestone. Less blocking:
  separate Vercel project already exists without a private repo, and
  polling can use Supabase scheduling if Vercel Cron limits bind.
- **Nov 28, 2026, 01:58 PT:** Checked whether the course-data foundation
  would be a quick fix for legacy: no. The `legacy` branch has no
  course-data reader or generated course files, so it would require a
  port plus bundling and parity validation, not a small patch.
- **Nov 28, 2026, 01:55 PT:** Reviewed an external assessment of the
  Sep 23 course-data foundation: substantially correct. The branch
  (`rebuild/course-data-foundation`) has real types, ingest, merge,
  parity, reader, and generated data, with EW204 the only wired
  migration. Two production failures are compressed in that assessment:
  `5e8007e` referenced a missing reader module, and the later rebuild
  deployment failed because generated JSON was not bundled for Vercel.
  The Canvas-wins rule needs explicit exceptions, as EW209 syllabus
  cohort rules later showed.
- **Nov 28, 2026, 01:54 PT:** Assessed the Sep 24 rebuild features against
  v2: the course-data reader failure is fixable (bundle generated data,
  loud failure with fallback), but v2 supersedes that reader with the
  canonical course registry, layer-agnostic event model, and Canvas as
  source of truth. The durable requirements carry into v2; reviving the
  Sep 24 reader as-is would be throwaway work.
- **Nov 28, 2026, 01:52 PT:** Reviewed commit `92aebce` (Sep 24, 2026,
  GitHub main history) against the Sep 24 chat: it was a conscious
  emergency forward-fix, not an accident and not a completed
  implementation. Matt reported no Operations classes and cohorts
  populating together, then ordered the old version redeployed live while
  the improved Canvas-native version was fixed. The rollback target
  `5e8007e` could not build because it wired EW204 to a course-data reader
  module missing from its tree, so production stayed on the broken rebuild
  until `92aebce` removed that wiring, restored the legacy EW204 ICS path,
  and pointed the academic calendar loader back to the Spring 2026 file.
  Operations events were verified restored on production after the
  `92aebce` deployment.
- **Nov 28, 2026, 01:33 PT:** Legacy security fix, two routes only per
  Matt's call: `trigger-deploy` and `openai-test` disabled (handlers now
  return 404). Committed locally as `1592127`, pushed to GitHub branch
  `legacy` as `8b0cd11`, deployed by Vercel to `legacy.oski.app` (preview
  branch deployment). Legacy root still redirects signed-out visits to
  Vercel SSO. Travel-time route, admin page, and warm-cache secret
  logging left unchanged.
- **Nov 28, 2026, 01:29 PT:** Plan converted to plan plus log at Matt's
  direction; progress section added above.

**POST-COMMIT REVIEW — Current status correction: v2 has a partial Phase 1
foundation: split identities, a deadline resolver, database-backed private
personal APIs, and `/me`. It is beyond auth-only, but the foundation gate
is open. The full event/time model, ordinary-user hosted database proof,
and deployed two-user scenario are unfinished. Onboarding, APR/manual
imports, catalog ingestion, Canvas connections, and outbound personal
feeds are not delivered by this slice. The sponsor search remains on the
critical path; existing v1 operations remain separate.**

## 1. The shift

Today OskiHub is generic: a fixed set of cohort calendars (Blue/Gold ICS
files) served to anyone who can reach the site. The new OAuth system changes
that foundation. With Supabase Auth identifying each user by their
@berkeley.edu account, the site can become per-user: each person brings their
own courses and gets their own feeds, built from their unique enrollment,
progress, and preferences.

What does not change: the ICS parsing, dedup rules, timezone handling, and
dashboard widgets carry over as the shared base layer. What DOES change,
and the review caught the plan claiming otherwise: the display layer
today knows exactly where an event came from. `CalendarEvent.source` is
the ICS filename, and components branch on substrings of it for colors,
labels, and course links. So the overhaul includes a canonical course
registry and a layer-agnostic event model, which is the real Phase 1.
The display layer not knowing the source is the target state, not the
starting state.

## 2. Where v1 stands (the base v2 builds on)

- **Identity (built, not live: PR #2 open, unmerged):** Supabase Auth,
  Google provider, `hd: berkeley.edu`, server-side @berkeley.edu check
  in middleware and `/auth/callback`. No per-user data yet; Supabase
  Postgres is unused. The sign-in gate is not live on www.oski.app.
  Merging has a lockout trap (see Phase 0): the consent screen cannot
  be published until /privacy and /terms are live on www.oski.app,
  which only happens on merge, so in between, everyone except the two
  test users is locked out. Fix: ship the gate behind an
  `AUTH_GATE_ENABLED` env flag, off by default.
- **Course data:** static ICS files in `public/course_ICS_files/`,
  generated by scripts from OLR / Canvas / the program-office calendar.
  `lib/icsUtils.ts` parses them with node-ical into `CalendarEvent`,
  dedups by UID with source priority, filters by date range, memoizes
  15 minutes. Cohort = a file list (Blue vs Gold).
- **Serving:** `/api/calendar` (public, cached) and
  `/api/unified-dashboard` (newsletter + My Week AI + cohort events).
- **Canvas (Matt-only):** `scripts/bcourses-watch/watch.py` polls the
  Canvas API with Matt's personal token via the Canvas CLI, snapshots
  assignments/modules/files/announcements, diffs them. Read-only.
- **Newsletters:** Gmail dispatcher feeds the site API; Blue Crew Review
  and EW Wire are shared feeds.

## 3. What the scheduler app actually does (recon, Nov 24)

Ellie Bleiberg's Haas MBA Course Scheduler was inspected from its public
landing page and client bundle (no sign-in). Its whole "bring your own
data" story is one feature, and it is worth copying closely:

- **APR import, in the Planner.** "Import your Academic Progress Report"
  fills in class, program, and every course taken or taking. Two methods,
  no CalCentral login: **upload the APR PDF** (parsed in the browser with
  pdf.js, "read in your browser and never uploaded") or **paste the page**
  (CalCentral → My Academics → Academic Progress Report, select all,
  copy, paste; "nothing is uploaded"). Parsed results are saved to
  Supabase; the file and pasted text never leave the device.
- The parser understands CalCentral statuses (EN/IP) and degree rules
  (incompletes don't count; D+ and below don't count), and it badges
  imported courses with an "APR" chip.
- **No Canvas/bCourses connection at all** in that app, and no ICS
  import. The only other intake is manual course entry ("Add manual
  class": code, name, units, dates, days, times, room) and
  catalog/wishlist selection.
- **Per-user storage:** one row per user in Supabase `user_schedules`
  (`user_id`, `scheduled_courses`, `manual_courses`, `view_mode`,
  `selected_week_start`, `ui_state`, `updated_at`), mirrored in
  localStorage so it works signed-out and syncs after sign-in. Shared
  catalog tables are separate.
- **Outbound:** a per-user live ICS subscribe feed, minted by a Supabase
  edge function from the user's access token, with the warning "Treat the
  link like a password. Anyone who has it can read your schedule."

OskiHub's v2 takes the APR import and the per-user-row model from this,
and adds the piece the scheduler lacks: the Canvas/bCourses backend.

Update Nov 24 (late), signed-in inspection + bundle deep-dive: the app
is a narrow scheduler, not a hub. No Canvas, no assignments, no live
enrollment ("Hide full classes" runs off past bidding, not live seats),
no newsletters, events, clubs, or Haas resources. Hub is only
schedule-sharing with classmates; Marketplace is only bid-point course
swaps. The catalog is a curated snapshot, not a live feed: 6,361 courses
across all Berkeley departments, versioned in the client (cache key
`fall25-fall26-spring26-spring27-mba-ewmba-v18`), with no source
attribution and no last-updated stamp in the UI. Backend is Supabase
only (project `vtjelpsxjjtdfaycndfg`), tables `user_schedules` (one row
per user, optimistic concurrency on `updated_at`, localStorage mirror),
`wishlist_items`, `swap_listings` / `swap_offers` / `swap_profiles`,
`hub_follows`, `shared_plans`, `courses`, `berkeley_classes`,
`course_evaluations`, `course_comments`, `course_comment_digests`,
`bug_reports`, plus two edge functions (`ics-feed`, `mcp` with
per-user OAuth). No Realtime, no analytics in the bundle. The APR PDF
is parsed client-side with pdf.js and the file never uploads (confirmed
in code). Its tables are gated behind a signed-in berkeley.edu session:
anonymous reads return empty / permission-denied, so the catalog cannot
be pulled with the anon key alone.

## 4. Architecture: layers

```
Identity (built, not live) Supabase Auth, @berkeley.edu gate, user_id
Shared base layer        Cohort ICS files + academic calendar + CMG +
                         registration + parking (today's icsUtils engine)
Per-user layer (new)     APR import + Canvas sync + manual entry
                         -> split course/enrollment/event records,
                            source observations, rules, and overrides
                            in Postgres (RLS)
Display (adapted)        Resolved personal events, dedup, date filter,
                         dashboard widgets, My Week analyzer
Outbound (new)           Per-user ICS subscribe feed (signed, revocable)
```

The key design rule: **the display layer must not learn where an event
came from.** That is the target, not the current state: today
`CalendarEvent.source` is the ICS filename and components branch on it.
Phase 1 builds the canonical course registry and a layer-agnostic event
model (course id + kind + source metadata carried separately from the
display fields), and everything upstream -- cohort files, APR, Canvas,
manual entry -- converts into that shape. The dashboard, calendar API,
and My Week analyzer then consume it exactly as they do today.

## 5. Data model (Supabase Postgres, Row Level Security)

All per-user tables keyed by `auth.uid()`, RLS policy "user can only read
and write their own rows". The service_role key IS needed in later
phases (the sync job, feed-token lookups, account deletion) -- server-side
only, never in the client and never in the repo. RLS "own rows" cannot
keep a token from its owner, so tokens live in a non-exposed schema or
Vault, not in a table the user can read.

- `profiles` -- user_id PK, berkeley_email, display_name, cohort
  (blue/gold), program (EWMBA/FTMBA), created_at. Created on first sign-in.
- `courses` -- course identity independent of term (canonical course key,
  code family, title, units where stable).
- `course_offerings` -- a course in a term (term, class number, catalog
  source ids, term-level metadata).
- `course_sections` -- an offering's sections and meeting patterns
  (section code, days, start/end, location, instructor, cohort/section
  relationships where known).
- `user_enrollments` -- the user's relationship to an offering/section:
  user_id, offering_id, section_id (nullable until resolved), status
  (enrolled / completed / planned / manually added), source, first_seen_at,
  last_seen_at, updated_at. APR re-import updates observations; it does
  not erase manual plans by default.
- `assignments` -- durable assignment identity per offering, with source
  mappings across Canvas, feed, curated ICS, and catalog records. The
  exported calendar UID stays stable when the winning source changes.
- `course_events` -- meetings, deadlines, exams, and other occurrences.
  Each event has an explicit kind and time semantics: instant deadline,
  start/end meeting, all-day date/span, recurring meeting with
  exceptions, or unknown/unavailable value. No invented duration.
- `source_observations` -- imported facts exactly as received: source,
  source record id, user scope where applicable, field, value, fetched_at,
  parser/source version, and raw-source reference where retention is
  allowed. Canvas values returned for one student stay scoped to that
  student.
- `resolution_rules` -- field-level rules and exceptions (catalog
  correction, syllabus rule, cohort adjustment, holiday exception,
  manual-source precedence), each with scope, effective dates, reason,
  and version.
  **POST-COMMIT REVIEW — Guard enforcement clarification: a deadline
  transformation or suppression requires at least one meaningful reviewed
  source-value OR positive source-revision guard. Every supplied guard
  must be valid and match; absent, invalid, or stale guards preserve the
  source deadline and expose a review conflict. A stale specific exception
  does not fall through to a general shift. Assignment-specific shifts
  remain scoped to their declared assignment. The runtime rejects old
  malformed inputs; a new forward migration enforces nonblank/positive
  guards in storage without rewriting existing rules.**
- `user_overrides` -- deliberate user changes, stored separately from
  imported facts and rules.
- `resolved_user_events` -- the effective personal events the dashboard
  reads, materialized or computed from enrollments, events,
  observations, rules, and overrides. Each resolved field retains the
  selected value, winning source/rule/override, and explanation.
- `user_progress` -- APR-derived snapshot. user_id, program, cohort_year,
  completed_courses (jsonb), requirements_satisfied (jsonb),
  imported_at. The PDF itself and any pasted text are never stored.
- `user_feeds` -- which shared feeds the user wants (newsletter, CMG,
  parking, Launch, etc.) and digest preferences.
- `canvas_connections` -- per-user Canvas OAuth connection: encrypted
  refresh token (non-exposed schema or Vault, never in a user-readable
  table), granted scopes, last_sync_at, sync_status. Revocable from
  settings; never logged, never returned to the client. No per-user
  personal access tokens are collected: asking users to paste a token
  into a multi-user app violates Canvas API policy (see 6b).
- `canvas_syllabi` -- per-user syllabus store. user_id,
  canvas_course_id, syllabus_html (sanitized), syllabus_file_path
  (Supabase Storage), content_hash, fetched_at, canvas_updated_at. RLS
  per-user only: one user's Canvas data is never visible to another
  user. The syllabus is that student's own enrolled-course data,
  fetched with their OAuth consent; it is stored for their use only,
  never shared across users.

The shared catalog stays public. It is the menu the user picks from;
`user_enrollments` plus resolved personal events are what they actually
ordered.

## 6. Ingestion and the catalog: three ways in, one shape out

### 6a. APR import -- the streamlined one-click flow

Honest constraint first: **no server can download the APR from
CalCentral.** It requires the user's own CalNet session, and OskiHub must
never ask for CalNet credentials. So "one click" cannot mean the server
fetching it. The closest real flow, copied from the scheduler and
tightened:

1. User clicks **"Import your Academic Progress Report"** on a Planner
   page.
2. OskiHub opens the CalCentral APR page in a new tab (deep link to
   My Academics → Academic Progress Report) and shows the two-line
   instruction: download the PDF, drop it back here (or paste the page
   with ⌘A ⌘C ⌘V as the fallback).
3. The PDF is parsed **in the browser** with pdf.js. The file and any
   pasted text never leave the device -- same privacy promise as the
   scheduler. Accurate version of the claim: the file never uploads, but
   the parsed structure IS the student record, and it is saved to
   Supabase (`user_progress`, `user_enrollments`, and
   `source_observations`). Do not claim no student record touches the
   server.
4. OskiHub shows the import summary ("Imported N courses across M terms,
   cohort Fall YYYY, program EWMBA, K requirements satisfied") and saves
   only the parsed structure plus parser-version metadata. Re-import
   updates observations and enrollments; Remove deletes the import's
   records. Manual plans survive re-import unless the user removes them.

Browser-side parsing remains the default. Parser fixes deploy centrally
with the app; the tradeoff is reprocessing: without the raw PDF, an old
import may need re-import after a parser change. Server-side parsing
would ease reprocessing but puts the PDF on our server.

### 6b. Canvas / bCourses -- nonnegotiable, feed first, OAuth as the destination

DECIDED Nov 24, 2026 (Matt): the Canvas API is a nonnegotiable layer.
Live Canvas data is the source of truth for calendaring: current
enrollments, assignment due dates, and syllabi, updating as course
details change. The scheduler app has no Canvas at all, and that is the
gap v2 exists to close.

- **Option A -- per-user personal access tokens: DEAD.** Instructure's
  own docs: asking users to manually generate a token and enter it into
  a multi-user app "is a violation of Canvas' API Policy. Applications
  in use by multiple users MUST use OAuth to obtain tokens." The
  single-user case (Matt's own watcher, his own token, his own machine)
  is the exception; collecting tokens from other users is not. Do not
  build it.
- **The sanctioned side door -- the Canvas calendar feed (ship first).**
  Each user pastes their personal Canvas calendar feed URL (Canvas
  Calendar settings). It is read-only, calendar-only, needs no token
  and no sponsor, and parses through the existing node-ical pipeline.
  It proves the merge of Canvas events with the cohort catalog. Its
  limits: it carries events only (no assignment detail, no syllabus),
  and it is not a complete enrollment or history source. OskiHub fetches
  this incoming feed on its own schedule; another calendar app's refresh
  interval does not govern OskiHub. The incoming Canvas feed never
  becomes OskiHub's outgoing merged feed.
- **Option B -- Canvas OAuth developer key (the destination).** OskiHub
  becomes a Canvas OAuth client; the user clicks "Connect bCourses" and
  authorizes through CalNet. Requires a developer key from Berkeley
  Canvas admins. Confirmed Nov 24, 2026 in Berkeley's own CDSS docs
  (https://berkeley-cdss.github.io/docs/canvas/dev-keys/): production
  keys must be scoped, and "a staff or faculty member (not a
  student/student employee) should fill out this form which will open a
  ticket with the bCourses team." So Option B hinges on finding a
  faculty or staff sponsor to file the request; Matt cannot file it
  himself as a student. The sponsor search is now on the critical path
  and starts immediately, in parallel with the feed-based build; do not
  block v2 on it, but do not treat it as a background nice-to-have
  either. Development can proceed without one: dev keys work in the
  Canvas Sandbox, and the docs recommend determining a minimal set of
  scopes there first (dev keys may be shared within a development
  group).

**What "real-time" means.** Canvas does not push changes to a student
app. True push (Live Events / webhooks) needs a Canvas admin to
configure it, which is an institutional ask, not something the app gets
on its own. What v2 can build is polling: a sync job that fetches each
connected user's courses, assignments, calendar, and syllabus on a
schedule (every 15-60 minutes), plus an instant refresh when they open
the app. Changes land within the poll interval. The calendar feed is
slower than that by design. The API plus polling is the ceiling for a
student app.

**Syllabi, stored server-side.** The syllabus is the `syllabus_body`
field on the Canvas course (HTML), plus often a syllabus file attached
to the course. The sync job pulls it, stores sanitized HTML in
`canvas_syllabi` and the file in Supabase Storage, with a content hash
and fetched_at so changes are detectable. Per-user only, RLS enforced,
never shared across users (see Section 5).

The sync job generalizes the watcher: per-user, failure-isolated (one
user's revoked connection never blocks anyone else), rate-limit aware,
and scheduled (Vercel cron or Supabase Edge Function + pg_cron). Canvas
becomes the source for current enrollments, assignment due dates, and
syllabi; the APR is the source for history and degree progress.

### 6c. Manual entry + catalog

- **Manual course entry**, same fields as the scheduler: code, name,
  units, dates, days, times, room, "async / no set meeting time"
  checkbox. Covers field studies, independent studies, anything the
  catalog lacks.
- **Catalog pick:** the existing cohort ICS files are the shared catalog.
  The user picks sections; picks land in `user_enrollments` with
  source=catalog. This is how a new student with no APR and no Canvas
  token still gets a working schedule on day one.

### 6d. The course catalog -- sourcing, and the registry

The catalog is two layers, and they come from different sources:

- **Campus-wide schedule core (one source).** Days, times, room,
  instructor, class size (enrolled / max), units, waitlist, and grades
  for all ~6,361 Berkeley courses come from one place: Berkeley's
  Student Information System data. Three ways to read it: (1)
  BerkeleyTime's public GraphQL API (`berkeleytime.com/api/graphql`,
  no auth for reads) -- fastest, but a third-party student service,
  persisted operations only, page size capped at 100; (2) the official
  SIS Courses / Classes / Terms APIs via UC Berkeley API Central (app
  ID + key) -- the durable, sanctioned route, credentials to be applied
  for in parallel; (3) a scrape of the public `classes.berkeley.edu`
  schedule (precedent: the open-source `berkeley-classes-cli`, which
  mirrors the full schedule into SQLite with no key and no login). OLR
  is NOT the source here: it is EWMBA-only.
- **Haas-only enrichment (no public source).** Syllabus links, Haas
  course evaluations, bid-out history, and certificate rules exist
  nowhere public. The scheduler app's versions are hand-curated
  (syllabus links are Google Docs collected by hand; evaluations are
  averaged from Haas's published course evaluations; the catalog itself
  is a versioned snapshot, currently v18, with no last-updated stamp).
  For OskiHub: syllabus comes from Canvas (6b), evaluations and
  bid-out from Haas-published sources and OLR, and the catalog is a
  versioned snapshot WITH a visible last-updated stamp -- fixing the
  scheduler's biggest weakness.

The shared catalog lands in Supabase tables mirroring the scheduler's
shape (`courses`, `berkeley_classes`, `course_evaluations`), because
that shape already works. On top of it sits the canonical course
registry from Phase 1: one stable identity per course (code family +
section + class number), so the display layer stops keying off ICS
filenames.

## 7. Display: what stays, what changes

**Reused and adapted:** ICS parsing, UID handling, timezone handling
(including the raw-digit all-day fix), the date-range filter, dashboard
widgets, My Week presentation, and the newsletter pipeline. Their
behavior is preserved where it is still correct, but their assumptions
about identity, source, dates, ownership, and caching are revised.
`CalendarEvent` does NOT stay as-is: Phase 1 rebuilds it on the
canonical registry (Section 4), because today its `source` is the ICS
filename and components branch on substrings of it. The My Week
analyzer consumes resolved personal events for one user; it must not
merge cohorts or users to produce a personal result.

**Changes:** one new function alongside `getCohortEvents()` --
`getUserEvents(userId)` -- which resolves each displayed value from
separate layers: imported facts (what a source returned, for whom, and
when), resolution rules (catalog, syllabus, cohort, and exception rules),
and deliberate user overrides. The effective value keeps the reason it
was selected, so a result can be explained and recomputed when a source
changes without losing the original evidence. Shared feeds the user
opted into (academic calendar, registration deadlines, CMG, parking,
newsletters) merge only after personal course values resolve.

`/api/calendar` and `/api/unified-dashboard` gain a user-aware path with
explicit API-route authentication and private, per-user cache boundaries.
Current middleware excludes API routes and the current dashboard route
uses shared/public caching, so neither can carry personal responses
unchanged. The server derives the requesting user from the verified
session, never from a client-supplied user id. A request for private
data with missing or invalid authentication fails explicitly; it never
silently falls back to cohort data. Public cohort endpoints keep today's
public behavior only for public cohort requests, so existing calendar
subscriptions and the public site never break during the transition.

**POST-COMMIT REVIEW — Visible personal states: `/me` distinguishes
loading, sign-in required (401), unavailable (503/network/invalid response),
successful empty, and ready. Only a successful empty response displays
"No personal events yet." Returned conflicts are visible beside the
deadline, with a selection explanation. This page proves this narrow
presentation path; it does not yet replace the full dashboard or My Week.**

**Outbound:** a per-user ICS subscribe feed, minted like the scheduler's
(`POST` the session to an edge function, get a feed URL + webcal URL),
with a per-user secret that can be revoked and reissued. Same warning as
the scheduler's: treat the link like a password.

## 8. Deployment isolation (settled)

Deployment isolation is settled: v2 has its own Vercel project
(`oskihub-v2`) using branch `v2` in the same repository, with its own
test Supabase backend. Repository separation is not on the critical
path. A private repository would address source confidentiality only;
it is not required for v2 to have its own production deployment or
scheduler environment. The course-data auto-push cron keeps shipping
ICS to v1 main until cutover, and v2 work must not take down the live
site.

### Dev address while v2 is built: v2.oski.app

While v2 is in progress it lives at `v2.oski.app`, and v1 keeps serving
`www.oski.app` untouched. No new domain to buy: `v2.oski.app` is a
subdomain of the oski.app Matt already owns, so it is just a DNS record
(a CNAME to Vercel) plus adding the domain in Vercel assigned to the v2
branch (same-project branch domain) or to the v2 project's production
deployment (if separate repo). Vercel issues the SSL certificate automatically.
Every push to the v2 branch/fork redeploys it, and the address always
serves the latest build. Only pushes to main deploy to www.oski.app, so
v2 work can never take down the live site. The v2 dev site sits behind
the same @berkeley.edu gate, so only test users can sign in while the
consent screen is in Testing mode.

## 9. Phased plan

- **Phase 0 (now, before v2):** ship the auth gate behind an
  `AUTH_GATE_ENABLED` env flag (off by default) on PR #2; merge with
  the gate off; publish the consent screen (set the branding URLs,
  upload the logo, submit Google brand verification); flip the flag on;
  verify production sign-in with mattgross@berkeley.edu. v1 keeps
  running. Also in Phase 0: add the Supabase origin to the CSP (the
  gate breaks browser-side Supabase calls without it), add the Supabase
  Before User Created hook, and set up separate Upstash/Supabase
  instances for v2 so v2 work cannot touch v1 data.
- **Phase 1 -- foundation proof:** canonical course registry +
  layer-agnostic event model (the display layer stops keying off ICS
  filenames); split Supabase tables + RLS for courses, offerings,
  sections, enrollments, assignments/events, source observations,
  resolution rules, overrides, and resolved personal events; `profiles`
  on first sign-in; `getUserEvents` wired into the personal calendar
  and dashboard paths with explicit API auth and private caching.
  Acceptance proof: two users with overlapping courses, different
  sections, a cohort adjustment, an exception, and one individualized
  deadline each see the correct dashboard; each changed value has an
  explainable source; a later source update changes the appropriate
  result while preserving stable event identities; neither user can
  retrieve the other's private information. Planner APR import
  (client-side parse, PDF + paste) and manual entry build on that proof.
  Course-catalog sync starts here (Section 6d): BerkeleyTime GraphQL or
  the public-schedule scrape first, SIS API credentials applied for in
  parallel.
  **POST-COMMIT REVIEW — Immediate gate work: close the reviewed guard
  and visible-state defects with regression coverage; run the forward
  migration and rollback-only SQL checks in the isolated test database
  using ordinary roles; then prove the deployed two-user scenario using
  verified Auth identities. Local synthetic Postgres checks do not count
  as hosted credentials, grants, API/cache, or browser proof. Keep the
  broader Phase 1 requirements open until their acceptance evidence exists.**
- **Phase 2 -- Canvas:** calendar-feed connection first (user pastes
  their Canvas feed URL; proves the merge of Canvas events with the
  cohort catalog); then Canvas OAuth ("Connect bCourses") once the
  sponsor files the developer-key request -- the sponsor search is on
  the critical path from Phase 0, not a background track; sync job
  generalizing the watcher (polling every 15-60 minutes + refresh on
  open); enrollments, assignment due dates, and syllabi flow into
  enrollments, source observations, assignments/events, and
  `canvas_syllabi`, then resolve into the dashboard. The incoming Canvas
  feed remains an import source only.
- **Phase 3 -- feeds + outbound:** `user_feeds` preferences; per-user
  ICS subscribe feed exporting the merged personal schedule (extend the
  existing `export.ics` rather than building a second feed).
- **Phase 4 -- cutover (v2 becomes www.oski.app):** freeze v1 content
  changes; promote v2 to production by pointing www.oski.app at the v2
  Vercel project and merging the v2 branch into main as appropriate;
  verify production sign-in with mattgross@berkeley.edu, the ICS feeds,
  and the cron jobs on www.oski.app; repoint the course-data auto-push
  cron at v2 main; keep `v2.oski.app` as the staging address for future
  work (or retire it once cutover is verified); archive v1.

## 10. Open decisions (Matt's call)

DECIDED Nov 24, 2026: **Canvas API is nonnegotiable** (Section 6b).
Feed first, OAuth as the destination, sponsor search on the critical
path. **Launch scope: open to all @berkeley.edu by default** -- no
EWMBA allowlist as a gate. An allowlist is a launch-control option
only, to be used if there is evidence of abuse, not a prerequisite;
defaulting to a roster lock works against the benefit-of-all goal.

1. **APR parse:** settled client-side. Parser fixes deploy with the
   app; retain parser-version metadata and ask for re-import when an
   old import needs reprocessing.
2. **Repository separation:** settled out of the critical path. V2 has
   its own Vercel project and branch; a private repo is optional source
   confidentiality only.
3. **Catalog source for the first sync: BerkeleyTime GraphQL,
   public-schedule scrape, or wait for SIS API credentials?**
   Recommendation: BerkeleyTime or the scrape first (both work today),
   SIS application in parallel.
4. **Free-tier watch:** Supabase Free covers this to start, but per-user
   sync jobs and edge-function use are the things that push toward Pro
   ($25/mo) first. No action now; note it when Phase 2 lands.

## 11. Risks and notes

- Canvas OAuth refresh tokens are credentials. Encrypted at rest, never
  logged, never sent to the client, revocable. If a token leaks in a log,
  rotate and tell the user.
- The APR deep link and CalCentral's page structure can change; the
  paste fallback is the resilience (it works as long as the page text
  is selectable).
- The APR parser needs the same care as the ICS audit: CalCentral's
  requirement blocks vary by program, so the parser should report what
  it could not understand rather than guessing.
- The course-data auto-push cron must keep targeting v1 main until
  cutover, or the live site goes stale while v2 is built.
- **Open security items from the Nov 24 review (decision pending, not
  yet approved):** `POST /api/trigger-deploy` has no auth (it fires the
  production deploy hook); `POST /api/openai-test` has no auth and runs
  the OpenAI organizer on arbitrary input; `/api/travel-time` uses a
  paid Google Routes key with no auth guard; the admin page password is
  hard-coded client-side (`'beta'`, visible in the bundle). Proposed:
  auth on the three endpoints (or delete openai-test) and server-side
  admin auth. These are live production issues independent of v2.
- Canvas OAuth refresh tokens and feed secrets live in a non-exposed
  schema or Vault, never in a user-readable table: RLS "own rows"
  cannot keep a token from its owner.
- Syllabi are stored per-user only, never shared across users. The
  syllabus is the student's own enrolled-course data; a shared syllabus
  library would be a different product with different risk.
- No EWMBA allowlist as a launch gate (Section 10).
