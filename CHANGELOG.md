# iSkool Changelog

## [Unreleased]
### Changed
- Login: Replaced the "Logging in…" / "Redirecting…" text states on the login button with a dimmed button and a circular pill-dot spinner (matching the label until success/error), including a reduced-motion fallback (`index.php`, `index.css`).
- Teacher Dashboard: Left sidebar class groups are now collapsible (click a class label to expand/collapse its items), defaulting to expanded; added a shared, reusable toggle helper in `dashboard.js` so the behavior is consistent across Quizzes, Grades, Resources, Announcements, and Assignments; Assignments' sidebar is now also grouped by class instead of a flat list (`dashboard.js`, `quizzes.js`, `grades.js`, `resources.js`, `announcements.js`, `assignments.js`). Desktop only.
- Teacher Dashboard: Simplified sidebar create buttons to a consistent "+ New" label across Evaluations, Quizzes (Grades), Resources, Announcements, and Assignments, and dropped the "All" prefix from sidebar titles (Evaluations, Quizzes, Resources, Assignments) for a cleaner look; Syllabus sidebar title kept as "All Syllabus" (`evaluations.js`, `grades.js`, `resources.js`, `announcements.js`, `assignments.js`).
- Teacher Dashboard: Consolidated the separate top page title/create button into the left sidebar header — the section title and its create action now sit together in the sidebar, matching the Quizzes layout (`evaluations.js`, `grades.js`, `resources.js`, `sbo.js`, `announcements.js`, `assignments.js`).

### Fixed
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