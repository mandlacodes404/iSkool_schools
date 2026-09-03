# iSkool Schools — Architecture Document

> This document explains how the iSkool platform is structured, how it works internally,
> and where the known weaknesses are. It is written for developers and AI agents working
> in this codebase. Read this before making any significant change.

---

## Table of Contents

- [System Overview](#system-overview)
- [Major Systems](#major-systems)
- [Request Flow](#request-flow)
- [Authentication Flow](#authentication-flow)
- [Database Architecture](#database-architecture)
- [API Layer](#api-layer)
- [Frontend Architecture](#frontend-architecture)
- [File Upload System](#file-upload-system)
- [Notifications & Email](#notifications--email)
- [Deployment Architecture](#deployment-architecture)
- [Known Weaknesses](#known-weaknesses)

---

## System Overview

iSkool is a **multi-tenant PHP/MySQL Learning Management System**. Each school runs against
its own isolated database, selected at runtime by `config.php` based on the current subdomain.

This is **not an MVC framework application**. It is a procedural PHP application with
role-based organisation. There are no formal controllers, models, or service layers.
SQL queries, authentication checks, business logic, and HTML rendering often live together
in the same PHP file.

**The architecture is workable at its current scale, but is approaching the point where
shared helpers, a consistent auth guard, and schema discipline become necessary.**

---

## Major Systems

| System | Key Files |
|--------|-----------|
| Authentication | `index.php`, `auth/login_ajax.php`, `auth/register_ajax.php`, `auth/check_remember_me.php`, `auth/remember_me_functions.php` |
| Role Dashboards | `dashboard.php`, `learner_dashboard.php`, `teacher_dashboard.php`, `school_admin_dashboard.php`, `parent_dashboard.php` |
| Quizzes & Grading | `create_quiz.php`, `take_quiz.php`, `submit_quiz.php`, `review_quiz.php`, `api/learner/get_quizzes.php`, `api/teacher/get_quizzes.php` |
| Assignments | `submit_assignment.php`, `download_submissions.php`, `api/teacher/create_assignment.php`, `api/learner/get_assignments.php` |
| Resources | `api/teacher/upload_resource.php`, `api/learner/get_resources.php` |
| Announcements | `api/teacher/create_announcement.php`, `api/school/create_announcement.php`, `api/learner/get_announcements.php` |
| Discussions | `api/learner/create_discussion.php`, `api/learner/submit_reply.php`, `api/set_typing.php`, `api/get_typing.php` |
| Evaluations | `api/teacher/create_evaluation.php`, `api/learner/submit_evaluation.php` |
| Push Notifications | `push_functions.php`, `subscribe_push.php`, `service-worker.js` |
| Email | PHPMailer — called inside assignment, resource, announcement, registration, and reset flows |
| Superadmin Onboarding | `superadmin/index.php`, `superadmin/iskool_new_school_template.sql` |
| Deployment | `.github/workflows/deploy-main.yml`, `.github/workflows/deploy-sandbox.yml` |

---

## Request Flow

### What happens when a user opens the app

```
1. Browser requests index.php
2. index.php starts the session and includes config.php
3. config.php detects the environment:
   - localhost → connects to hardcoded iskowdbw_sandtonhigh
   - live server → extracts subdomain from HTTP_HOST
                   sandtonhigh.iskool.xyz → iskowdbw_sandtonhigh
4. index.php includes check_remember_me.php
5. Login form submits via fetch() to auth/login_ajax.php
6. On success, frontend redirects to dashboard.php
7. dashboard.php reads $_SESSION['role'] and loads the correct dashboard
```

### What happens during a normal API call

```
Browser JS (e.g. assets/js/learner/quiz.js)
  → fetch('api/learner/get_quizzes.php')
  → PHP: session_start() + config.php + role check
  → MySQL query via $conn (prepared statement)
  → json_encode() response
  → JS renders HTML directly into #api-content-area
```

### Real example — learner submitting a quiz

```
1. Learner selects quiz from UI (assets/js/learner/quiz.js)
2. fetch() → api/learner/get_quiz_instructions.php
3. Quiz opens: take_quiz.php?quiz_id=...
4. take_quiz.php:
   - Checks learner auth
   - Verifies learner belongs to quiz class via class_students
   - Creates or resumes a quiz_attempts row
   - Loads questions from quizquestions + choices
   - Loads any saved answers from user_answers
5. Learner submits → POST to submit_quiz.php
6. submit_quiz.php:
   - Prevents duplicate rows in quiz_results
   - Fetches correct answers (quizquestions JOIN choices)
   - Calculates score
   - Inserts into quiz_results
   - Upserts user_answers
   - Sets quiz_attempts.status = 'submitted'
7. Returns HTML result page (not JSON)
   - Calls window.parent.fetchGrades() when embedded in iframe
```

---

## Authentication Flow

### Login

```
1. index.php renders login form
2. JS posts credentials to auth/login_ajax.php
3. login_ajax.php:
   - Accepts POST only
   - Starts secure session cookie
   - Queries users table by email
   - Checks users.is_deleted
   - Verifies password with password_verify()
   - Calls session_regenerate_id(true)
   - Stores in session:
     $_SESSION['name']
     $_SESSION['email']
     $_SESSION['profile_pic']
     $_SESSION['role']
     $_SESSION['last_active']
4. Returns JSON: { redirect: "dashboard" }
```

### How identity is maintained per request

Every protected page and API endpoint checks the session directly:
```php
// Learner pages
if (!isset($_SESSION['email']) || $_SESSION['role'] !== 'learner') { exit; }

// Teacher pages
if (!isset($_SESSION['email']) || $_SESSION['role'] !== 'teacher') { exit; }

// School admin pages
if (!isset($_SESSION['email']) || !in_array($_SESSION['role'], ['school_admin', 'admin'])) { exit; }
```

There is no shared auth middleware. These checks are duplicated in nearly every file.
This is a known weakness — see [Known Weaknesses](#known-weaknesses).

### Remember-me

```
Login with remember-me:
1. auth/remember_me_functions.php generates a selector and validator
2. Stores hashed validator in user_tokens table
3. Sets HTTP-only secure cookie: selector:validator

On next visit (no active session):
1. check_remember_me.php runs (included by index.php)
2. Reads cookie → looks up user_tokens.selector
3. Compares validator hash
4. Fetches user from users table
5. Calls session_regenerate_id() and restores session

Logout:
1. logout.php deletes the token by selector
2. Expires the cookie
```

> ⚠️ **Schema mismatch:** `superadmin/iskool_new_school_template.sql` defines
> `user_tokens.hashed_token` and `expires_at`, but live PHP code uses
> `hashed_validator` and `expiry`. The SQL template is stale and does not match
> the real running database. Do not use the template as the source of truth for
> this table.

---

## Database Architecture

### Multi-tenancy model

Each school has its own completely isolated database:

```
sandtonhigh.iskool.xyz  →  iskowdbw_sandtonhigh
landulwazi.iskool.xyz   →  iskowdbw_landulwazi
```

`config.php` handles this routing. The active database name is stored in
`$_SESSION['current_school_db']`.

A master database (`iskowdbw_master`) tracks all schools at the platform level.
The superadmin panel (`superadmin/index.php`) creates new school databases via
cPanel API and runs `iskool_new_school_template.sql` to provision the schema.

### Key tables

| Category | Tables |
|----------|--------|
| Identity & settings | `users`, `school_name`, `platform_settings`, `access_keys` |
| Classes & enrolment | `classes`, `class_students`, `teacher_subjects`, `parent_classes`, `parent_links` |
| Quizzes | `quizzes`, `questions`, `choices`, `quizquestions`, `quiz_attempts`, `quiz_results`, `user_answers` |
| Assignments | `assignments`, `submissions` |
| Resources | `resources`, `subject_briefs` |
| Communication | `announcements`, `class_discussions`, `discussion_replies`, `messages` |
| Evaluations | `teacher_evaluations`, `evaluation_statements`, `evaluation_responses`, `evaluation_answers` |
| Auth | `user_tokens`, `password_resets`, `user_subscriptions` |
| Academic calendar | `academic_years`, `academic_terms`, `academic_events` |

### Relationship pattern

Relationships are **mostly email-based, not ID-based**. Most joins use `users.email`
as the linking key:

```
class_students.student_email
quizzes.created_by  (email)
assignments.created_by  (email)
resources.uploaded_by  (email)
user_tokens.user_email
```

Foreign key constraints exist for some tables (discussions, evaluations, events,
user_tokens) but core tables like `quizzes.class_id`, `quiz_results.quiz_id`,
`class_students.class_id`, and `assignments.class_id` are not consistently
FK-constrained.

> ⚠️ **Schema drift is serious.** The live running database does not fully match
> `superadmin/iskool_new_school_template.sql`. Known mismatches include:
>
> | Template column | Live PHP code uses |
> |----------------|-------------------|
> | `user_tokens.hashed_token` | `hashed_validator` |
> | `user_tokens.expires_at` | `expiry` |
> | `quizzes.duration_minutes` | `duration` |
> | `quizzes.marks_published` | `publish_marks` |
> | `assignments.file_path` | `file_url` |
> | `submissions.comment` | `text_answer` |
> | `users.profile_picture` | `profile_pic` |
>
> **Do not use the SQL template as the single source of truth.**
> The real schema lives in the live database. If you need to make schema changes,
> check the live database first, then update the template to match.

---

## API Layer

### Organisation

```
/api/learner/    →  20+ endpoints for learner actions
/api/teacher/    →  25+ endpoints for teacher actions
/api/school/     →  19+ endpoints for school admin actions
/api/            →  shared endpoints (set_typing.php, get_typing.php)
```

### Standard endpoint pattern

Every API file should follow this structure:
```php
<?php
session_start();
require_once '../config.php';
header('Content-Type: application/json');

// 1. Role check — always first
if (!isset($_SESSION['email']) || $_SESSION['role'] !== 'teacher') {
    echo json_encode(['error' => 'Unauthorized']);
    exit;
}

// 2. Read input
$class_id = isset($_POST['class_id']) ? intval($_POST['class_id']) : 0;

// 3. Prepared statement — always
$stmt = $conn->prepare("SELECT * FROM assignments WHERE class_id = ?");
$stmt->bind_param("i", $class_id);
$stmt->execute();
$result = $stmt->get_result();

// 4. Return JSON
echo json_encode(['success' => true, 'data' => $rows]);
```

### Known inconsistencies in the API layer

- `submit_quiz.php` and `submit_assignment.php` return **HTML**, not JSON — inconsistent
  with the rest of the API layer
- Some endpoints (e.g. `api/learner/get_quizzes.php`) set `Access-Control-Allow-Origin: *`
  while most do not — inconsistent CORS handling
- Some files still build SQL with interpolated strings instead of prepared statements
  (e.g. `api/school/get_teacher_profile.php`) — this is a security issue
- Response shapes are inconsistent: some return `{success: true}`, others return arrays,
  others return full HTML fragments

---

## Frontend Architecture

### Overview

The frontend is **server-rendered PHP dashboards with vanilla JavaScript** for dynamic
content. There is no frontend framework (no React, Vue, or Angular).

Each role dashboard provides:
- Layout and navigation
- Container elements (`#api-content-area`, `#mainFrame`)
- Initial server-side data

JavaScript files then fetch JSON from the API and inject HTML strings into these containers.

### JavaScript file organisation

```
assets/js/learner/
  main.js, quiz.js, assignments.js, resources.js,
  announcements.js, grades.js, evaluations.js,
  discussions.js, learner_calendar.js

assets/js/teacher/
  quizzes.js, assignments.js, ...

assets/js/school/
  ...
```

### State management

There is no framework-level state management. State lives in:
- Global variables on `window` (e.g. `window.learnerQuizCache`, `window.quizInstructionsCache`)
- `sessionStorage` (e.g. quiz page state)
- DOM classes and element state
- PHP session (server side)

> ⚠️ Because multiple JS files share `#api-content-area` and `#mainFrame`,
> feature interactions can break when one script modifies these shared containers
> unexpectedly. Be careful when adding new JS features that touch these elements.

### Mobile vs desktop

- CSS media queries switch layouts at ~899px
- Desktop: sidebar navigation + split panel views
- Mobile: bottom navigation bar + card-based views
- `take_quiz.php` detects mobile via user agent or `?mobile=true` parameter

---

## File Upload System

### Where files are stored

| Upload type | Storage path |
|-------------|-------------|
| Quiz question images | `quiz_images/` |
| Assignment attachments | `assignment_Uploads/{school_slug}/` |
| Assignment submissions | `assignment_submissions/` |
| Learning resources | `resources/{school_slug}/` |
| Learner profile pictures | `uploads/learners/{school_slug}/` |
| Discussion attachments | `uploads/discussions/` |
| School logos | handled by `upload_logo.php` + `school_upload_helper.php` |

Newer upload code uses `school_upload_helper.php` to derive a safe folder slug from
`school_name` and create school-scoped directories. Older code still writes to shared
folders — these have not been migrated.

### Upload validation — inconsistent

| File | Max size | Allowed types | Validated? |
|------|----------|---------------|------------|
| `api/teacher/upload_resource.php` | 10MB | pdf, doc, docx, ppt, pptx, jpg, jpeg, png, zip | Yes |
| `api/learner/create_discussion.php` | 5MB | pdf, jpg, jpeg, png, webp | Yes |
| `upload_profile.php` | — | jpg, jpeg, png, gif | Partial |
| `submit_assignment.php` | — | — | **No validation** |
| `create_quiz.php` (question images) | — | — | **Weak** |

> ⚠️ `submit_assignment.php` has no visible file extension or size validation.
> This should be treated as a priority security fix.

---

## Notifications & Email

### Push notification flow

```
1. Browser registers service-worker.js
2. Dashboard JS gets a Push API subscription object
3. JS posts subscription to subscribe_push.php
4. subscribe_push.php stores:
   user_email, endpoint, p256dh, auth → user_subscriptions table
5. Server calls sendPushToUser() from push_functions.php
6. push_functions.php uses minishlink/web-push + VAPID keys
7. Payload: title, body, icon, deep link URL
8. service-worker.js displays the notification
9. On click → navigates to the deep link
```

### Email flow

PHPMailer connects via SMTP to `iskool.xyz` on port 465.

Emails are triggered by:
- New user registration (`auth/register_ajax.php`)
- Password reset (`auth/password/send_reset_link.php`)
- New assignment created (`api/teacher/create_assignment.php`)
- New resource uploaded (`api/teacher/upload_resource.php`)
- New announcement (`api/teacher/create_announcement.php`)
- Discussion with tagged teacher (`api/learner/create_discussion.php`)

### Notification decision pattern

Most notification-triggering files follow this logic:
```
Try push notification first
→ If no subscription or push fails → send email
→ If force_email is posted → send email regardless
```

> ⚠️ This notification/email logic is **duplicated** across every feature file
> (assignments, resources, announcements, discussions). A shared notification
> helper function would significantly reduce this duplication.

---

## Deployment Architecture

### How it works

| Branch | Environment | Trigger | Destination |
|--------|------------|---------|-------------|
| `main` | Production | push to main | `public_html/` |
| `dev` | Sandbox/staging | push to dev | `sandbox.iskool.xyz/` |

Both use `SamKirkland/FTP-Deploy-Action@v4.3.4` to sync files via FTP.

### What gets excluded from deployment

```
.git, .github, vendor/, node_modules/, .env,
composer.lock, .gitignore, tests/ (dev only),
sandbox folder (main only)
```

### The deployment workflow does NOT:
- Run `composer install`
- Run database migrations
- Run tests
- Perform any health checks

> ⚠️ `vendor/` is excluded from deployment but production depends on Composer
> packages being present. This only works because `vendor/` is already on the
> server from a previous manual install. If the server is ever reprovisioned or
> `vendor/` is deleted, the live site will break immediately.
>
> The safe fix: either commit `vendor/` (not recommended) or add
> `composer install --no-dev` as a step in the GitHub Actions workflow.

---

## Known Weaknesses

These are existing architectural problems. Do not replicate these patterns in new code.
They are documented here so agents and developers are aware before making changes.

### Critical

| Issue | Location | Risk |
|-------|----------|------|
| Credentials in source code | `config.php`, `push_functions.php`, `superadmin/index.php` | Anyone with repo access has DB + API access |
| Schema drift | `superadmin/iskool_new_school_template.sql` vs live DB | Template cannot be trusted as accurate |
| No upload validation on submissions | `submit_assignment.php` | Any file type can be uploaded |
| SQL interpolation in some endpoints | `api/school/get_teacher_profile.php` + others | SQL injection risk |

### High Priority

| Issue | Impact |
|-------|--------|
| Auth checks duplicated in every file | Hard to change auth logic, easy to miss a file |
| No shared notification helper | Same push/email logic copy-pasted across 6+ files |
| Stale SQL template | New school provisioning may differ from live schema |
| No migration system | Schema changes cannot be tracked or rolled back |

### Medium Priority

| Issue | Impact |
|-------|--------|
| Inconsistent API response shapes | Frontend code is harder to maintain predictably |
| Mixed HTML/JSON responses | Some endpoints return HTML, others JSON — no consistent contract |
| Email-based joins instead of ID-based | Harder to enforce data integrity, slower joins at scale |
| Shared DOM containers across JS files | Feature interactions can silently break each other |
| Older upload code uses shared folders | Not school-scoped, mixing school data |

### The most important next step

Before adding major new features, the highest-value engineering task is:

1. Reconcile `iskool_new_school_template.sql` with the real live database
2. Move all credentials out of source code into environment variables
3. Extract a shared auth guard function used by all protected files
4. Add file validation to `submit_assignment.php`
5. Add `composer install` to the GitHub Actions deployment workflow

---

*Last updated: May 2026 — based on full codebase analysis*
*This document should be updated whenever the architecture changes significantly*
