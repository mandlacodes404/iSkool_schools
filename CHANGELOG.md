# iSkool Changelog

## [Unreleased]
### Changed
- UI: Removed borders from all SVG icon boxes on the mobile home page (`manual.js`, `manual.css`) — section-title icons (To Do, Recent, Upcoming Events), My Class icon, list row icons, and empty-state icons — for a flatter, cleaner look on mobile. Background colors kept.
- UI: Removed borders from mobile list-row icon boxes in Assignments, Quiz, Resources, and Announcements (`assignments.js`, `quiz.js`, `resources.js`, `announcements.js`), including the Announcements "school" card variant. Background colors kept.
- UI: Removed borders from icon boxes in Grades (`grades.js`) — mobile quiz-row icons (including the unpublished-quiz state) and the printable Progress Report's subject icons (including the performance-colored variant). Background colors kept.

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