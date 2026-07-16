# iSkool Changelog

## [Unreleased]
### Changed
- Teacher Grades: Renamed "quiz" to "assessment" throughout the learner-facing labels (sidebar header, empty states, "Add Quiz Manually" modal, form labels, buttons, and error/result messages) since marks can come from assignments as well as quizzes; internal code (function/variable names, element IDs, API endpoints) left unchanged (`grades.js`).
- Login: Replaced the "Logging in…" / "Redirecting…" text states on the login button with a dimmed button and a circular pill-dot spinner (matching the label until success/error), including a reduced-motion fallback (`index.php`, `index.css`). Spinner later adjusted so the ring of pills physically rotates (clock-hand sweep) instead of only fading in place, and the fade was removed entirely so all pills stay solid while spinning.
- Login: Extracted the pill spinner into a standalone, reusable stylesheet (`assets/css/pill-loader.css`) so any button or element elsewhere in the app can show the same loading state via a `.btn-loadable` wrapper, independent of the login button markup.
- Teacher Dashboard: First visit to Home (the manual/snapshot view) now caches instantly on repeat visits within a session, matching the learner side's behaviour; fixed a bug where an unconditional loader-hide at the end of the page's `DOMContentLoaded` handler was hiding the loading spinner before Home's own fetch had actually resolved (`dashboard.js`).
- Teacher Dashboard: Removed the full-page loading spinner from section navigation — Analytics, Announcements, Assignments, Evaluations, Grades, Quizzes, Resources, Syllabus, and Calendar now swap their content in directly once data arrives, the same instant-feeling behaviour as the learner side, instead of covering the screen with a spinner on every first visit (`analytics.js`, `announcements.js`, `assignments.js`, `evaluations.js`, `grades.js`, `quizzes.js`, `resources.js`, `sbo.js`, `teacher_calendar.js`).
- Teacher Dashboard: Introduced a small, in-panel loading spinner (as opposed to the old full-page one) for quick, everyday actions reachable on both mobile and desktop — saving edited marks, publishing/unpublishing marks, opening/closing a quiz, loading and saving the quiz edit form, and confirming quiz or resource deletion (`grades.js`, `quizzes.js`, `resources.js`).
- Teacher Dashboard: Restyled the full-page loading spinner itself from the old four-dot orbiting animation to a pill-style spinning ring, matching the login page's spinner design, for the remaining cases that still use it (desktop-only "create new" forms and the subject-rename dialog) (`teacher_dashboard.css`).
- Teacher Dashboard: Added the same in-panel loading spinner to the "+ New" buttons on Announcements, Evaluations, and Resources while their form's class list loads, matching the existing behaviour on Quizzes, Assignments, and Syllabus (`announcements.js`, `evaluations.js`, `resources.js`).
- Teacher Dashboard: Added silent background prefetching for every sidebar section — after Home finishes loading, each section's data is quietly fetched and cached in four staggered waves so the first real click into a section feels instant instead of waiting on a fresh request, mirroring the learner side's existing prefetch behaviour (`dashboard.js`, and a new `prefetchTeacherX()` function added to `analytics.js`, `announcements.js`, `assignments.js`, `evaluations.js`, `grades.js`, `quizzes.js`, `resources.js`, `sbo.js`, `teacher_calendar.js`).
- Teacher Dashboard: Left sidebar class groups are now collapsible (click a class label to expand/collapse its items), defaulting to expanded; added a shared, reusable toggle helper in `dashboard.js` so the behavior is consistent across Quizzes, Grades, Resources, Announcements, and Assignments; Assignments' sidebar is now also grouped by class instead of a flat list (`dashboard.js`, `quizzes.js`, `grades.js`, `resources.js`, `announcements.js`, `assignments.js`). Desktop only.
- Teacher Dashboard: Simplified sidebar create buttons to a consistent "+ New" label across Evaluations, Quizzes (Grades), Resources, Announcements, and Assignments, and dropped the "All" prefix from sidebar titles (Evaluations, Quizzes, Resources, Assignments) for a cleaner look; Syllabus sidebar title kept as "All Syllabus" (`evaluations.js`, `grades.js`, `resources.js`, `announcements.js`, `assignments.js`).
- Teacher Dashboard: Consolidated the separate top page title/create button into the left sidebar header — the section title and its create action now sit together in the sidebar, matching the Quizzes layout (`evaluations.js`, `grades.js`, `resources.js`, `sbo.js`, `announcements.js`, `assignments.js`).
- Learner Discussions:
  - Chat/thread background now matches the discussion list's card colour instead of falling back to black when a thread is open (`discussions.js`, `quiz.css`). Mobile only.
  - Message bubbles now use the same background colour as the discussion list cards (`discussions.js`). Mobile only.
  - Removed the border on message bubbles unless the message is your own, which keeps its teal border (`discussions.js`). Mobile only.
  - Replaced the per-message Reply/Report buttons with a long-press action popup on the chat bubble, dimmed and styled to match the existing reply-composer sheet (`discussions.js`). Mobile only.
  - Fixed the native iOS text-selection callout (Copy/Look Up/Translate) appearing over the long-press popup (`discussions.js`). Mobile only.
  - Learner avatar colours are now a softer, less saturated tint instead of solid strong colours (`discussions.js`). Mobile only.
- Learner Dashboard (Mobile): Reworked Announcements, Assignments, Quiz, Resources, and Grades list pages from a boxed-card style into flat, edge-to-edge rows with thin divider lines (Canvas-style), removing the card wrapper background/border/radius around each list; folder/subject headers restyled to match. Content now bleeds to the screen edges instead of sitting inset inside the page padding, fixing a truncated/cramped look on the sides. Desktop split-layout views untouched (`announcements.js`, `assignments.js`, `quiz.js`, `resources.js`, `grades.js`).
- Learner Dashboard (Mobile): Applied the same flat, borderless treatment to the Discussions list — each thread card lost its border and moved to the new flat surface colour, with a softer background-tint hover/tap state in place of the old border-colour change (`discussions.js`). Desktop sidebar list untouched.
- Learner Dashboard (Mobile): Reworked the app's dark surface colour palette to match Claude's mobile app more closely — page background, sidebar, splash screen, and PWA manifest colours moved from near-black (`#000000`/`#1a1919`) to `#20201f`, including the dynamic browser-bar (`theme-color`) logic that tracks scroll position and per-page accent colours (`quiz.css`, `learner_dashboard.css`, `index.css`, `index.php`, `learner_dashboard.php`, `manifest.php`). Desktop backgrounds untouched.
- Learner Dashboard (Mobile): Top nav now holds a solid background at rest instead of transparent, closing a visible gap/seam beneath the fixed header; top and bottom nav borders unified to the same colour when scrolled (top nav at 0.5px, bottom nav at 1px) (`learner_dashboard.css`, `learner_dashboard.php`).
- Learner Dashboard (Mobile): Home page boxes (My Class, To-Do, Recent), Syllabus subject-brief cards, and Discussion list cards now use a lighter flat surface colour (`#272726`, matched from the mobile sidebar menu's link background) with their borders removed, for a cleaner, more consistent card style across the app (`manual.css`, `syllabus.js`, `discussions.js`). Desktop untouched.
- Learner Dashboard (Mobile): Announcement and Assignment detail views now open with a Canvas-style author header — avatar circle with teacher initials, name, an "Author | Teacher" role line, and a "Posted [date]" line — replacing the previous inline sender/date meta line; Assignments keeps its existing status pill (Locked/Submitted/Not Submitted) directly below the new header. Colours match each page's existing accent (`announcements.js`, `assignments.js`).
- Teacher display names across Announcements and Assignments now build from a teacher's first name, second name, and surname (e.g. "Mr SK.Mahlangu", or "Mr S.Mahlangu" with no second name) instead of title + surname only, and avatar initials are always the first-name and surname initials (e.g. "SM") regardless of a second name; computed server-side from `users.name`/`second_name`/`surname` (`get_announcements.php`, `get_assignments.php`).
- Learner Dashboard (Desktop): Reworked the sidebar + main-panel split layout on Quiz, Announcements, Assignments, Resources, Syllabus, Evaluations, and Grades from a boxed-card style into a flat, GitHub/VS Code–style layout — removed the outer card border, corner radius, and solid panel backgrounds, keeping a single 1px divider between the sidebar and main panel. A shared, reusable style injector (`injectSharedDesktopLayoutStyles()` in `manual.js`) now owns this styling so all seven pages stay consistent instead of duplicating the same CSS (`manual.js`, `quiz.js`, `announcements.js`, `assignments.js`, `resources.js`, `syllabus.js`, `evaluations.js`, `grades.js`). Mobile untouched.
  - Removed `#api-content-area`'s desktop padding so the sidebar/panel divider now runs flush from the header's bottom border all the way to the bottom of the viewport, instead of stopping short inside the old page padding.
  - Replaced a hardcoded `calc(100vh - 140px)` height guess on each page's layout with a flex-based `height: 100%` that fills the real space below the header; fixes the divider not reaching the true bottom of the screen and the sidebar showing a scrollbar before its content actually filled the available height.
  - Top header (`.main-header`) background and blur removed in favour of a flat, transparent header with just its bottom border line, matching the new flat divider style; also fixed a missing `--border-color` CSS variable so that border line actually renders (`learner_dashboard.css`).

### Fixed
- Learner Dashboard (Mobile): Fixed the mobile bottom nav sometimes loading a blank page when tapped mid-scroll — momentum scrolling is now stopped and the content scroll position reset before the next page loads, with the header/bottom nav state refreshed on the next animation frame; also fixed the bottom nav active-state keys for Assignments (`assignment_list.php`) and Resources (`resource_list.php`) (`learner_dashboard.php`).
- Learner Calendar: Fixed the mobile layout so the calendar panel stretches to fill the full width of the screen instead of being cramped on the left with empty space on the right (`learner_calendar.js`).

## [v1.1.3] - 2026-07-09
### Added
- Teacher Analytics: Added a score distribution histogram with contiguous score-range bins, learner-count axis, clear legend, and an optional normal distribution curve overlay for cleaner visual analysis (`analytics.js`, `get_analytics_data.php`).
- Teacher Analytics: Added a median score alongside the class average, a term-over-term delta on the Class Performance by Term chart, and an automatic hardest/easiest quiz callout on the Quiz Average chart (`analytics.js`, `get_analytics_data.php`).
- Teacher Quizzes: Added live learner previews to the create quiz flow, including per-question previews and a full quiz preview before submission.

### Changed
- Release: Centralised the visible app version in `includes/app_version.php` and updated login, learner, and teacher surfaces to show `iSkool v1.1.3` from that shared helper (`index.php`, `learner_dashboard.php`, `teacher_dashboard.php`).
- Teacher Analytics: Restored the analytics class/term list endpoint after the histogram work exposed a routing mix-up, improved frontend error handling so API errors no longer appear as an empty "no assessments" state, and cache-busted the analytics script (`get_analytics.php`, `analytics.js`, `teacher_dashboard.php`).
- Teacher Analytics: Visual and consistency pass on the analytics dashboard (`analytics.js`) — unified KPI card value sizing across all four cards, fixed a colour clash between the girls' data series and the existing fail/error red by moving girls to purple, removed a redundant duplicate status dot in the class list (the average badge already carries the same signal), and moved the colour palette into CSS custom properties so the whole dashboard themes from one place.
- Teacher Analytics: Added hover lift and shadow to KPI cards, fade-in transitions when switching class or term, and visible keyboard focus states on class items and term tabs; error and empty states now show a retry action instead of plain text, and motion respects reduced-motion settings.
- Teacher Quizzes: Reworked the create quiz form into clearer beginner-friendly steps, added visible attempt-limit setup, and reordered question creation so teachers choose the question type before writing the question.
- Learner: Sorted teacher folders by each teacher's latest uploaded content across Grades, Assignments, Quizzes, Resources, and Announcements on both mobile and desktop. Quiz mobile folders now match desktop by grouping under teacher names.
- UI: Removed borders from all SVG icon boxes on the mobile home page (`manual.js`, `manual.css`) — section-title icons (To Do, Recent, Upcoming Events), My Class icon, list row icons, and empty-state icons — for a flatter, cleaner look on mobile. Background colors kept.
- UI: Removed borders from mobile list-row icon boxes in Assignments, Quiz, Resources, and Announcements (`assignments.js`, `quiz.js`, `resources.js`, `announcements.js`), including the Announcements "school" card variant. Background colors kept.
- UI: Removed borders from icon boxes in Grades (`grades.js`) — mobile quiz-row icons (including the unpublished-quiz state) and the printable Progress Report's subject icons (including the performance-colored variant). Background colors kept.

### Removed
- Teacher Dashboard: Removed the iSkool version footer from the teacher sidebar/mobile overlay area (`teacher_dashboard.php`).

## [v1.1.2] - 2026-06-21
### Changed
- UI: Added Nunito font across the platform (78cc3f8).
- Grades: Performance overview card (d458cf7) and grade title color set to white (380d903).
- Left layout: added desktop search (fa36864); collapsible left layout (c12ebb7); default desktop initial state uncollapsed (fda54be).
- Discussions: updated discussion type pill/background/placement and discussion box enhancements (7116f7c, cff6fe5, bff3cbf, 9a1d978); mobile discussion list box styles (f44bf36).

### Removed
- Discussions: removed teacher-specific logic and fixed related bugs (2568d40, 9e98658).

### Database
- Updated DB dump (38fa34c).

## [v1.1.0] - 2025-12-15
### Added
- **Branded Progress Reports** — Now include school logo, school name, learner full name, class, and current date
- **Professional report layout** — Clean, printable design with performance-based progress bar colors
- **Smart quiz grouping** — Quizzes now group by teacher-defined subject (with fallback to teacher name like "Ms Ntuli")
- **Term mark breakdowns** — Detailed view showing weighted summative assessments, earned points, and total percentage
- **CSV export for quiz results** — Teachers can now download full results with percentages
- **Improved teacher quiz management** — Toggle publish marks and quiz status with confirmation modals
- **Enhanced learner quiz list** — Better status handling, countdowns, and responsive design
- **Professional code headers** — All files now have industry-standard PHPDoc comments

### Improved
- Consistent branding across login, dashboard, and reports
- Better mobile responsiveness on dashboards and quiz lists
- More accurate academic year and term detection
- Cleaner, more maintainable code structure

### Fixed
- Minor UI inconsistencies in loaders and modals
- Improved security checks across teacher and learner pages