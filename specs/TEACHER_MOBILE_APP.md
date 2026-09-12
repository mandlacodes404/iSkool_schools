# Teacher Mobile App — "Detail Page" Project Notes

> Living handoff doc. Any Claude picking this up should read this whole file
> before touching code. Update it as decisions get made or facts change.
> Last updated: 2026-09-12.

## 1. The goal (in the user's words, cleaned up)

The teacher mobile app should work like the learner mobile app:

- **Learner side**: content lists are grouped by **teacher**. Tapping an item
  navigates to a **detail page** (header changes, back button appears,
  content is replaced) — NOT an inline expand/accordion/drawer.
- **Teacher side**: content lists should be grouped by **class** instead of
  teacher, but use the *same* "tap → go to detail page" pattern.
- We are rebuilding teacher pages **one at a time**, starting with
  **Assignments**, and reusing the learner pattern as the reference
  implementation — not copying files blindly, since the two codebases have
  diverged in naming and the teacher header markup is structurally different
  (see §4).
- The user wants a **shared place** for the teacher-side "detail mode"
  mechanism (header swap + back button dispatch), analogous to how the
  learner side's `configureHeader` / `handleHeaderBack` live centrally in
  `learner_dashboard.php` and get reused by every learner page. Where exactly
  this shared logic should live on the teacher side is an open decision —
  see §6.

## 2. Files seen so far

| File | Role | Notes |
|---|---|---|
| `assignments.css` | Learner assignments styling | Prefix: `.las-*` (Learner ASsignments) |
| `assignments.js` | Learner assignments list + detail logic | Reference implementation, see §3 |
| `manual.js` | Learner "Home" page script | Only has one `configureHeader({mode:'standard'})` call, nothing structural |
| `learner_dashboard.php` | Learner app shell | **`configureHeader` and `handleHeaderBack` are defined here** (~line 2907 and ~3046), plus the header markup itself (`.main-header`, `#headerTitle`, `#headerBackBtn`, etc.) |
| `dashboard.js` | Teacher app shell script | Shared teacher helpers: loader button states, collapsible sidebar class-groups (`buildCollapsibleClassGroup`), `teacherSectionState` (sessionStorage-backed selection/scroll/collapsed state), `setTeacherActive`. **No `configureHeader` equivalent, no detail-mode, no back button logic anywhere.** |
| `teacher_dashboard.php` | Teacher app shell markup | Header is `.top-nav-wrapper` / `.top-nav-row1` — structurally different from learner's `.main-header`. No `headerTitle`/`headerBackBtn` ids exist yet. References `fetchTeacherAssignments()` (mobile bottom nav + top-level command palette) but **that function is not defined in any uploaded file yet** — it must live in a not-yet-uploaded `teacher/assignments.js`. |

### Teacher assignments.js / assignments.css — CONFIRMED (uploaded, read in full)

CSS prefix in use: **`as-*`** (Assignments) — not `tas-*` as originally
guessed in an earlier draft of this doc. Correcting that now that we have
the real file. `as-*` already mixes in shared `tchr-*` classes where it
extends shared helpers (e.g.
`.as-sidebar-class-label.tchr-sidebar-class-label--toggle`), confirming the
desktop sidebar already uses the shared `buildCollapsibleClassGroup` helper
from `dashboard.js` (see call at assignments.js ~line 112).

**Desktop (working, not being touched):**
- `renderTeacherAssignments(data)` groups the flat `data` array by
  `class_name` into a `Map`, keeping each item's original index into
  `window._allAssignmentsFlat` so `selectDesktopAssignment(index)` keeps
  working. Each group is rendered via
  `window.buildCollapsibleClassGroup(classGroupId, 'as-sidebar-class-label', className, itemsHtml)`
  — i.e. teacher's desktop assignments sidebar is ALREADY grouped by class
  and ALREADY reuses the shared collapsible helper. This is the pattern
  mobile should visually match, just adapted to a full-width mobile list
  with folders instead of a persistent sidebar.
- `selectDesktopAssignment(index)` fills `#as-main-panel` with assignment
  detail + a full submissions `<table>` (learner name, status badge,
  submission type, submission content/link). This is teacher-only content
  learner's assignment detail doesn't have (teachers see every learner's
  submission status, learners only see their own).
- Data shape per assignment (confirmed from real code):
  `{ id, title, class_name, due_date, description, file_url, total_learners,
  submitted_count, submissions: [{ name, submitted, submitted_at,
  submission_type: 'file'|'text'|'audio', file_url, text_answer, audio_url }] }`.
  **Note**: unlike learner's grouped-by-teacher object shape
  (`{teacherName: [...]}`), teacher's API (`api/teacher/get_assignments.php`)
  returns a **flat array** — grouping by class happens client-side in
  `renderTeacherAssignments`, not server-side. Mobile rebuild should do the
  same (group client-side from the flat array), consistent with desktop.

**Mobile (THIS is what needs to be replaced) — confirmed drawer/chevron pattern:**
- Explicitly marked in the source itself:
  `<!-- ═══ MOBILE LIST (unchanged) ═══ -->` inside `renderTeacherAssignments`
  (~line 175) — i.e. this is known-legacy code the team already flagged as
  not yet updated.
- Every assignment (NOT grouped by class on mobile at all — flat list, no
  folders) renders as a `.teacher-assignment-card` containing:
  - a clickable `.teacher-assignment-main` header row (icon, title, class +
    due date meta, a submission progress bar, and a chevron
    `#achevron-{index}`)
  - an inline, hidden-by-default `.teacher-assignment-submissions
    .as-submissions-collapsible` div (`#asubs-{index}`) containing the full
    description AND the full submissions `<table>` — the entire desktop
    panel's content, baked into every single card up front, just hidden.
  - Tapping the header row calls `window.toggleAssignmentSubmissions(index)`
    (~line 456), which does nothing but toggle that one card's hidden div
    `display: none` ↔ `block` and rotate the chevron 90°. **No navigation,
    no header change, no `configureHeader`-equivalent call at all.** This
    is the exact "drawer/chevron mode" the user wants removed and replaced
    with a real detail-page navigation, matching learner's
    `openMobileLearnerAssignment` pattern.
- Consequence for the rebuild: because every card's full submissions table
  is pre-rendered into the DOM (just hidden), the current mobile page is
  much heavier than it needs to be — the new detail-page approach (only
  rendering one assignment's detail at a time, on demand, like learner
  does) is also a real performance win, not just a UX change.

**Not part of this task (do not touch):** `openCreateAssignment`,
`confirmDeleteAssignment`/`closeDeleteAssignmentModal`/`executeDeleteAssignment`,
`downloadSubmissions` — these are the create/delete assignment flows and
are unrelated to list/detail navigation. Leave them exactly as-is.

## 3. How the learner reference pattern works (assignments.js + learner_dashboard.php)

1. **Data shape**: API returns assignments pre-grouped by teacher:
   `{ "Teacher Name": [task, task, ...], ... }`.
2. **`renderAssignmentCards(groupedData)`** (assignments.js):
   - Sorts groups by most recent activity (`getSortedLearnerAssignmentEntries`).
   - Builds `window._allLearnerAssignmentsFlat` — a **flattened array** of all
     tasks across all groups, in render order. This flat array + index is
     the thing every click handler references (`openMobileLearnerAssignment(flatIdx)`,
     `selectDesktopLearnerAssignment(flatIdx)`), not the task id directly.
   - Renders TWO parallel UIs from the same data in the same HTML blob:
     - **Desktop**: sidebar (`.las-desktop-teacher-group`, collapsible) + a
       main panel (`#las-main-panel`) that gets filled in by
       `selectDesktopLearnerAssignment(flatIdx)` on click. This is a
       split-view, not a page navigation — desktop never uses "detail mode".
     - **Mobile**: collapsible folders per teacher
       (`.las-mobile-folder-header` / `.las-mobile-folder-body`, chevron
       toggle via `toggleLasMobileFolder`), each containing rows
       (`.las-mobile-row`) with a title, due-date meta, and a chevron icon
       (the chevron on the row is just a visual affordance — clicking it
       does NOT expand a drawer; it navigates to a detail page).
3. **`openMobileLearnerAssignment(flatIdx)`** — this is the "go to detail
   page" logic the user is talking about:
   - Only runs on mobile widths (`window.innerWidth > 899` bails out).
   - Replaces the entire `#api-content-area` innerHTML with a detail
     `<article>` (author row, status, title, due date, description,
     attachment links, submit button/form).
   - Calls `window.configureHeader({ title: 'Submission', mode: 'detail' })`
     — this is what actually flips the app chrome into "detail mode".
   - Calls `showLearnerAssignmentMobileBottomNav()` (a no-op guard, real
     hiding happens inside `configureHeader`).
4. **`configureHeader(config)`** (learner_dashboard.php, ~line 2907) — the
   shared header controller, used by every learner page, not just
   assignments:
   - `mode: 'standard'` → shows hamburger/logo, shows bottom nav, hides back
     button. This is the normal list/browsing state.
   - `mode: 'detail'` → hides hamburger + bottom nav, shows `#headerBackBtn`,
     shows the title text large in the body (mobile) and adds
     `.mobile-detail-mode` (+ `.detail-title-collapsed` on scroll) to
     `.main-header`.
   - Stores `window.learnerHeaderDetailType` and optionally
     `window.learnerHeaderBackAction` (a custom back callback) on the window,
     so the back button knows how to return without re-deriving it from
     whatever title text happens to be visible.
5. **`handleHeaderBack(event)`** (learner_dashboard.php, ~line 3046) — the
   shared back-button handler, wired to `#headerBackBtn`'s click:
   - If a `backAction` callback was set via `configureHeader`, just calls it
     and returns — highest priority, page-specific override.
   - Otherwise it's a big if/else dispatch keyed on
     `learnerHeaderDetailType` (or the current header title text as
     fallback): `'Submission'` → `fetchAssignments()`, `'Instructions'` →
     `fetchQuizzes()`, `'Discussion'` → `fetchDiscussions()`,
     `'Announcement'` → `fetchAnnouncements()`, `'Evaluation'` →
     `fetchEvaluations()`, `'Calendar'` → `returnToLearnerHome()`,
     `'Review'` → `fetchGrades()`, `'Personal Information'` →
     `loadLearnerSettings()`, else → `returnToLearnerHome()` (fallback to
     Home/manual).
   - **This is the dispatch table the user wants a teacher-side
     equivalent of** — each teacher list page that gets a detail mode will
     need one more `if (detailType === 'X') { fetchTeacherX(); return; }`
     branch here (or in its teacher-side equivalent).
6. **State persistence**: `saveAssignmentPageState()` /
   `restoreAssignmentPageState()` persist scroll position, which
   folders/groups are open, search term, and selected item — keyed through
   `window.learnerPageState` (a generic sessionStorage helper defined in
   `manual.js`, get/set/update/queueSave by page key) with a
   `sessionStorage` direct fallback if that helper isn't loaded yet.

## 4. Key structural gap: teacher has none of this yet

Confirmed by direct search of both uploaded teacher files — **zero
occurrences** of `configureHeader`, `handleHeaderBack`, `mode: 'detail'`,
`headerBackBtn`, or any back-navigation concept in `dashboard.js` or
`teacher_dashboard.php`.

What teacher DOES already have (confirmed in `dashboard.js`):

- **`window.teacherSectionState`** — sessionStorage-backed state object
  (`selection`, `scrollTop`, `collapsedGroups`) already generalized across
  "any teacher page with a left sidebar grouped by class" (quizzes, grades,
  resources, announcements, assignments per the comment at line ~78). This
  is the teacher-side equivalent of `learnerPageState`, already shared.
- **`window.buildCollapsibleClassGroup(groupId, labelClass, labelInnerHtml, itemsHtml)`**
  — shared helper that already builds a collapsible **class**-grouped
  section (chevron + label + body), used for the **desktop sidebar**. CSS
  prefix already established: `tchr-sidebar-class-*` (e.g.
  `tchr-sidebar-class-chevron`, `tchr-sidebar-class-group`,
  `tchr-sidebar-class-label--toggle`). This is good evidence for what prefix
  convention to extend into mobile-detail work: **`tchr-` for shared/generic
  teacher chrome**, page-specific prefixes for page-specific stuff (see §5).
- **`window.buildInfoRail` / `window.updateInfoRail`** — shared right-hand
  desktop info rail, not relevant to mobile detail mode but good context.
- **`injectSharedTeacherDesktopLayoutStyles()`** — now an intentional no-op;
  the shared flat desktop layout CSS (`.tchr-flat-layout`, `.tchr-flat-sidebar`,
  `.tchr-flat-panel`) has already been moved into `dashboard.css` (not yet
  uploaded) and is loaded once in `<head>`.
- Teacher header markup is `.top-nav-wrapper` → `.top-nav-row1` with a
  hamburger (`#mobileToggle` mobile / `#desktopMenuToggle` desktop), a
  center brand block, and a search+avatar block on the right. There is a
  separate **`.top-nav-tab` row** (Syllabus/Evaluations/Analytics/Calendar/
  Settings — a GitHub-style secondary tab bar) controlled by
  `setTopNavTab(tabId)`, called from `setTeacherActive(page)`.
- Teacher mobile bottom nav (`#mobileBottomNav`) already exists in
  `teacher_dashboard.php`, separate from the top nav, mirroring learner's.

**What's missing and must be built new** (this is the core of the work):
1. Header ids/elements equivalent to learner's `#headerTitle`,
   `#headerBackBtn`, `#headerBackLabel`, `#headerRight`, `#headerLogo` — to
   be added to `.top-nav-wrapper` in `teacher_dashboard.php`.
2. A `window.configureTeacherHeader(config)` function (name TBD, see §6)
   mirroring `configureHeader`'s standard/detail mode switching, adapted to
   teacher's actual header markup (which also has to coexist with the
   `.top-nav-tab` row — unclear yet whether that row hides in detail mode
   too; **needs a decision**, see §7).
3. A `window.handleTeacherHeaderBack(event)` dispatch table mirroring
   `handleHeaderBack`, starting with one branch for Assignments
   (`fetchTeacherAssignments()`) and growing as more pages get detail mode.
4. Per-page: a flat-array + `openMobileTeacherAssignment(flatIdx)`-style
   function per list page, following the learner pattern, but grouping by
   **class** (reusing/extending `buildCollapsibleClassGroup` where sensible
   for mobile, or a mobile-specific variant of it — TBD, see §7).

## 5. CSS naming convention — CONFIRMED from real file (corrected)

**Correction:** an earlier draft of this doc guessed `tas-*` before the real
teacher assignments files were uploaded. That was wrong — the actual,
already-live prefix is **`as-*`** (Assignments), confirmed directly from
`assignments.css`/`assignments.js` (e.g. `.as-sidebar-item`,
`.as-panel-title`, `.as-desktop-layout`). All new mobile markup for
assignments continues under **`as-mobile-*`** to match what's already
there, not a new prefix — e.g. `as-mobile-folder-header`, `as-mobile-row`,
`as-mobile-detail`. This mirrors learner's own convention
(`las-mobile-folder-*`, `las-mobile-row-*`, `las-mobile-detail-*`) one-to-one,
just under the prefix this file already uses.

Shared/generic chrome (`tchr-*`) stays reserved for things actually shared
across multiple teacher pages (sidebar class-groups, info rail, flat
layout) — confirmed still true, `as-*` already leans on `tchr-*` only where
genuinely shared (e.g. `.as-sidebar-class-label.tchr-sidebar-class-label--toggle`).
Page-specific list/row/detail markup stays under the page's own prefix,
same as learner does. No further decision needed here — just executing
against the confirmed real convention now.

## 6. DECIDED: where shared teacher "detail mode" logic lives

**Resolved.** Split by what each piece actually is:

- **`dashboard.js`** — `window.configureTeacherHeader(config)` and
  `window.handleTeacherHeaderBack(event)` live here, alongside the other
  shared cross-page teacher helpers (`teacherSectionState`,
  `buildCollapsibleClassGroup`, `buildInfoRail`, `setTeacherActive`, etc.).
  Rationale: `dashboard.js` is already the established home for "more than
  one teacher page needs this" logic — that's its whole existing job (see
  §4). Assignments needs detail-mode today; Quizzes/Announcements/Grades/etc.
  will all need the same mechanism next, so it belongs centrally from the
  start, not bolted onto one page.
- **`teacher_dashboard.php`** — only the **markup** that doesn't exist yet:
  header elements equivalent to learner's `#headerTitle`, `#headerBackBtn`,
  `#headerBackLabel`, `#headerRight`, `#headerLogo`, added to the existing
  `.top-nav-wrapper` / `.top-nav-row1` structure. This is not a choice, it's
  just where the physical elements have to live for `dashboard.js` to
  control them. `#headerBackBtn`'s click wires to
  `window.handleTeacherHeaderBack`.

This intentionally diverges from the learner precedent (which inlines
`configureHeader`/`handleHeaderBack` in `learner_dashboard.php` itself) —
that learner choice looks historical rather than deliberate, and teacher's
own codebase already established a better precedent (centralizing shared
logic in `dashboard.js`) that this should follow instead.

Nothing is being migrated from an existing teacher mobile-detail system —
none existed. This is new code, written directly into this structure.

## 7. Other open questions to resolve before/while building

1. Does the `.top-nav-tab` secondary row (Syllabus/Evaluations/Analytics/
   Calendar/Settings) need to hide in "detail mode" on mobile, same as the
   bottom nav does? Still open — needs confirmation once we see it
   rendered, or can default to "yes, hide it" for consistency with
   `#mobileBottomNav` and adjust if wrong.
2. **Resolved by reading the real file**: teacher's mobile assignment list
   should groups by class the same way desktop already does (via
   `buildCollapsibleClassGroup`), rather than staying flat like the current
   legacy mobile cards. The rebuild will reuse
   `window.buildCollapsibleClassGroup` for the mobile folder headers too if
   its markup/behavior fits (chevron + collapse), since it already exists,
   is already shared, and desktop already proves the grouping-by-class
   approach works with real data. Will confirm during implementation
   whether its current CSS (`tchr-sidebar-class-*`) needs a mobile-width
   variant or works as-is at mobile widths — check `dashboard.css` (not yet
   uploaded) once needed.
3. ~~Need the actual current teacher assignments JS/CSS~~ — **done**,
   uploaded and read in full, see §3.5 above. Confirmed data shape, confirmed
   the exact drawer/chevron mobile pattern to replace
   (`toggleAssignmentSubmissions`), confirmed desktop is untouched by this
   work.
4. Still need: teacher header markup insertion point details in
   `teacher_dashboard.php` (`.top-nav-wrapper`/`.top-nav-row1`) — have seen
   the surrounding structure (§4) but need to write the actual new
   `#headerTitle`/`#headerBackBtn`/etc. elements into it next.
5. ~~Still need: `dashboard.css`~~ — **done**, uploaded and read.
   **Resolved**: `.tchr-sidebar-class-label--toggle` / `.tchr-sidebar-class-chevron`
   / `.tchr-sidebar-class-group` carry **no `@media` width restriction** —
   they're written generically (collapse via `max-height` transition, not
   tied to desktop). So `window.buildCollapsibleClassGroup()` is safe to
   reuse as-is for mobile folder headers; it was just never called from a
   mobile code path before now, not actually desktop-only by design.
   **Caution**: `.tchr-flat-sidebar` (a *different*, sibling class also in
   this file) forces `background:transparent`, a right-side border divider,
   and `height:100% !important` — these are desktop split-view container
   styles. `buildCollapsibleClassGroup`'s output must NOT be placed inside
   an element with `.tchr-flat-sidebar` for the mobile rebuild — only reuse
   the class-group/chevron/toggle classes themselves, inside `.as-mobile-list`
   (or a new mobile-specific wrapper), same as everywhere else mobile markup
   already lives separately from `.as-desktop-layout`.

## 8. Implementation plan for Assignments (executing now)

1. **`teacher_dashboard.php`** — add header elements to `.top-nav-wrapper`/
   `.top-nav-row1`: a back button + label, and make the existing brand/title
   area swappable for a detail title. Wire the back button's click to
   `window.handleTeacherHeaderBack`.
2. **`dashboard.js`** — add `window.configureTeacherHeader(config)` and
   `window.handleTeacherHeaderBack(event)`, next to the other shared
   teacher helpers (`teacherSectionState`, `buildCollapsibleClassGroup`,
   etc). `mode: 'detail'` hides bottom nav + top-nav-tab row + hamburger,
   shows back button; `mode: 'standard'` reverses it. Include one dispatch
   branch for Assignments (`detailType === 'Assignment'` →
   `fetchTeacherAssignments()`), matching learner's per-type dispatch
   pattern, ready for more branches as other pages get this treatment.
3. **`assignments.js`** — rebuild the mobile section of
   `renderTeacherAssignments()`:
   - Group the flat `data` array by `class_name` (same grouping logic
     already used for desktop, sorted by most recent activity like learner
     does).
   - Build `window._allAssignmentsFlat` in render order (already exists,
     keep it) — mobile rows reference `flatIdx` same as desktop `index`
     (they're already the same array/indexing, so no separate mobile flat
     array needed, unlike learner which has a separate
     `_allLearnerAssignmentsFlat`. Confirm they can stay unified since
     desktop and mobile render from the same `data` array here.)
   - Render each class group via `window.buildCollapsibleClassGroup(...)`
     with `as-mobile-folder-*`-prefixed label/rows content, folders default
     collapsed.
   - Each row (`as-mobile-row`) shows icon, title, due date, and a
     progress/status indicator (submitted count), chevron affordance.
     Tapping calls a new `window.openMobileTeacherAssignment(index)`.
   - `openMobileTeacherAssignment(index)` replaces `#api-content-area` with
     a detail article: title, class, due date, description, attachment
     link, download-all button, and the full submissions table (same
     content `selectDesktopAssignment` already builds for desktop — can
     factor the submissions-table-building into one shared local function
     used by both, avoiding duplicating that HTML-building logic twice).
     Calls `window.configureTeacherHeader({ title: 'Assignment', mode: 'detail' })`.
   - Remove `toggleAssignmentSubmissions` usage from the mobile card markup
     (function itself can stay defined harmlessly, or be removed if nothing
     else calls it — confirm nothing else references it before deleting).
   - Add mobile state persistence (open folders, scroll, selected item) —
     reuse `window.teacherSectionState` (already exists) rather than
     inventing a new persistence mechanism, extending it with a
     `collapsedGroups`-style entry for mobile folder ids if not already
     covered (it already is, `collapsedGroups` is shared/global by group id
     per the comment in dashboard.js — confirm mobile folder ids don't
     collide with desktop's `as-class-group-N` ids; give mobile folders
     their own id namespace, e.g. `as-mobile-class-group-N`, to avoid
     accidentally sharing collapse-state or DOM ids with desktop groups
     that happen to render at the same time on a resize).
4. **`assignments.css`** — add `.as-mobile-folder-*` / `.as-mobile-row-*` /
   `.as-mobile-detail-*` rules, matching `.las-mobile-*` visually/structurally
   but under the `as-` prefix already in use in this file.

Desktop code (`selectDesktopAssignment`, sidebar rendering, create/delete
flows) is not being modified — only added to (extracting the shared
submissions-table builder) where doing so avoids duplicating markup-building
logic between desktop and the new mobile detail view.

## 9. BUILT — Assignments mobile detail mode (first pass, done)

All four files edited, copies in `/mnt/user-data/outputs/`. Working copies
kept in `/home/claude/work/` for any follow-up edits in this session.

**`teacher_dashboard.php`** — added to `.top-nav-row1` inside `.top-nav-left`:
`#teacherHeaderBackBtn` (hidden by default) with `#teacherHeaderBackLabel`,
wired to `onclick="window.handleTeacherHeaderBack(event)"`. Added
`#teacherHeaderBrand` id to the existing logo/school-name block, plus a new
sibling `#teacherHeaderDetailTitle` (hidden by default, holds
`#teacherHeaderTitle`) shown only in detail mode. Tagged the existing
search+avatar wrapper div with `#teacherHeaderRight` so it can be hidden in
detail mode. Confirmed via before/after `<div>` count diff that exactly one
open+close pair was added (the new detail-title div) — no structural
imbalance introduced. `#topNavRow2` (the tab bar) was NOT touched — it's
already "desktop only" by its own CSS per the code comment, confirmed no JS
anywhere shows/hides it, so nothing to do there.

**`dashboard.js`** — added `window.configureTeacherHeader(config)` and
`window.handleTeacherHeaderBack(event)` right after
`buildCollapsibleClassGroup`, before the `teacherSectionState` block.
`configureTeacherHeader`'s `mode:'detail'` only acts on mobile widths
(`window.innerWidth <= 768`); desktop is an intentional no-op since desktop
teacher pages use the sidebar+panel split, never a page navigation.
`handleTeacherHeaderBack` dispatches on `window.teacherHeaderDetailType`,
currently with one branch: `'Assignment'` → `fetchTeacherAssignments()`.
Falls back to `loadTeacherManual()` (Home) if nothing matches, same
fallback shape as learner's `handleHeaderBack`. Both syntax-checked with
Node (`new Function(code)`) — no errors.

**`assignments.js`** —
- Extracted `groupTeacherAssignmentsByClass(data)` (the `Map`-building
  logic that used to live inline only in the desktop sidebar build) and
  `getTeacherAssignmentProgress(assignment)` (percent + traffic-light
  color, previously duplicated 3x: desktop sidebar dot, old mobile card,
  desktop panel). Both now used by desktop AND the new mobile build so the
  two stay in sync automatically.
- Extracted `buildTeacherSubmissionsTableRows(submissions, audioClass)`
  from inside `selectDesktopAssignment` — now shared with the new mobile
  detail view instead of being duplicated a third time.
- Added `escapeTeacherAssignmentHtml()` — this codebase had no HTML-escape
  helper anywhere before this change (confirmed by search); added one and
  used it only in the new mobile markup this task added. Did NOT retroactively
  escape the existing desktop rendering paths — that's a separate, larger
  cleanup outside this task's scope, noting it here so it isn't mistaken
  for an oversight.
- Replaced the entire `<!-- MOBILE LIST (unchanged) -->` block: gone are
  `.teacher-assignment-card`, `.teacher-assignment-main`,
  `.teacher-assignment-submissions`/`.as-submissions-collapsible`, and the
  `toggleAssignmentSubmissions` drawer-toggle function. In their place:
  mobile list is now grouped by class via
  `window.buildCollapsibleClassGroup` (folder id namespace
  `as-mobile-class-group-N`, deliberately separate from desktop's
  `as-class-group-N` so collapse-state and DOM ids never collide), each
  row is `.as-mobile-row`, tapping calls the new
  `window.openMobileTeacherAssignment(index)`.
- `openMobileTeacherAssignment(index)` — mobile-only guard
  (`innerWidth > 899` bails), replaces `#api-content-area` with a detail
  `<article>` (title, class/due meta, progress bar, attachment/download/
  delete actions, description, full submissions table via the shared
  builder), calls
  `configureTeacherHeader({ title:'Assignment', mode:'detail', detailType:'Assignment', backLabel:'Assignments' })`.
  Also persists selection into the existing `teacherSectionState` (no new
  storage mechanism invented). Added `openMobileTeacherAssignmentById` as a
  by-id convenience wrapper, mirroring learner's equivalent, for future use
  (e.g. deep-linking from a notification).
- **Kept unchanged, confirmed still referenced correctly:**
  `selectDesktopAssignment`, sidebar build, `openCreateAssignment`,
  `confirmDeleteAssignment`/`closeDeleteAssignmentModal`/
  `executeDeleteAssignment`, `downloadSubmissions`.

**`assignments.css`** — added `.as-mobile-folder-*` (folder header sizing,
reusing the shared `tchr-sidebar-class-*` chevron/collapse behavior from
`dashboard.css` — not redefining it, just sizing the label for full mobile
width instead of a 280px sidebar column), `.as-mobile-row-*`,
`.as-mobile-empty*`, and `.as-mobile-detail-*` (the new detail-page
article). Also added `@media (max-width: 768px)` rules for
`#teacherHeaderBackBtn`/`#teacherHeaderBackLabel`/`.top-nav-brand--detail`
since no existing stylesheet had rules for these brand-new elements.
Old `.teacher-assignment-card`/`.as-chevron`/`.as-submissions-collapsible`
rules were left in place in the CSS (not deleted) since removing unused
CSS rules has no functional effect and there was no strong reason to churn
the diff further — flagging here in case a future cleanup pass wants to
remove them once confirmed nothing else references those classes.

### Gap discovered, NOT fixed (out of scope, flagging for the user)

**There is currently no way to reach "Create Assignment" on mobile at all**,
before or after this change. Confirmed: `openCreateAssignment()` is only
ever triggered by `#as-new-btn`, which lives inside `.as-sidebar-header` —
part of `.as-desktop-layout`, which is `display:none` on mobile (see
`assignments.css` `@media (max-width: 899px)` block at the top of the
file). This is a pre-existing gap, not something introduced by this
change — the user's ask was specifically about list→detail navigation, not
the create flow, so this was left alone. **Flag for the user**: teacher
mobile assignments currently has no "+ New" entry point; worth a follow-up
task (e.g. a floating action button on the mobile list, matching whatever
pattern other teacher mobile pages use for their own "create" flows, if
any do this already — worth checking Announcements/Quizzes/Resources for
precedent before inventing a new one).

### Not yet done — next steps

- User has not yet tested this in a real browser/device. Everything above
  was verified by static reading + Node syntax-check + div-balance diff
  only — not by rendering the actual page. Watch for real-world issues on
  first test (e.g. CSS specificity fights with existing rules, the
  `teacherSectionState.collapsedGroups` interaction with the new mobile
  folder ids, iOS Safari quirks with the detail-mode header transition).
- Once Assignments is confirmed working end-to-end, the same
  `configureTeacherHeader`/`handleTeacherHeaderBack` infrastructure is
  ready to extend to the next teacher page (Quizzes/Announcements/Grades/
  Resources/Evaluations) — each just needs its own
  `openMobileTeacherX(index)` function and one more `if` branch in
  `handleTeacherHeaderBack`, following the exact same shape used here for
  Assignments.

## 8. Working agreement / process notes

- User writes in a casual, run-on style — re-read messages carefully for
  the actual asks buried in them; confirm understanding before big chunks
  of work, as has been done so far in this conversation.
- User wants to move **one page at a time**, starting with Assignments.
  Don't jump ahead to Quizzes/Announcements/etc. until Assignments is done
  and confirmed working.
- Always verify claims against the actual uploaded files — this doc itself
  was written only after grep/view confirmation of every claim above, not
  from assumption. Keep that standard for any future edits to this file or
  to the code.
- Update this file's "Still needed from the user" and "Open decisions"
  sections as they get resolved, so the doc stays a reliable snapshot for
  whoever (human or Claude) picks this up next.
