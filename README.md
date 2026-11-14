# iSkool Schools — Learning Management System

> A cloud-based, multi-tenant Learning Management System built for African schools. Teachers create content, learners complete work and track progress, parents stay informed, and administrators oversee everything — all from any device, any browser.

**Live:** https://iskool.xyz *(Unverified: confirm the current public domains)* | **Version:** see [CHANGELOG.md](CHANGELOG.md) | **License:** Proprietary © 2026 iSkool EdTech

---

## Table of Contents

- [Overview](#overview)
- [User Roles & Features](#user-roles--features)
- [Tech Stack](#tech-stack)
- [Where things live](#where-things-live)
- [Getting Started](#getting-started)
- [Database](#database)
- [Deployment](#deployment)
- [Development Guidelines](#development-guidelines)
- [Known Issues](#known-issues)
- [Roadmap](#roadmap)
- [Support](#support)

---

## Overview

iSkool is built on a **multi-tenant architecture** — each school gets its own isolated database. Schools access the platform via branded subdomains (e.g., `sandtonhigh.iskool.xyz`). A superadmin panel can provision an entirely new school in ~30 seconds.

**Highlights:**
- No installation required for end users — fully browser-based
- Progressive Web App (PWA) — installable, works offline, push notifications
- Fully responsive — desktop, tablet, and mobile
- Each school has its own branding (logo, name)
- New schools are onboarded automatically via the superadmin panel

How the system works inside is described in [ARCHITECTURE.md](ARCHITECTURE.md). The index of all documentation is [docs/README.md](docs/README.md).

---

## User Roles & Features

### Learner
- View and take quizzes, review results
- Submit assignments with file uploads
- View grades and progress reports by subject and term
- Read announcements and participate in class discussions
- Download learning resources shared by teachers
- View written evaluations and teacher feedback
- Link a parent account for progress monitoring
- Academic calendar (holidays, exam dates, events)

### Teacher
- Create and manage quizzes (multiple question types, image support)
- Create assignments with due dates
- Grade submissions and provide written feedback
- Publish/unpublish marks — control when learners see results
- Class performance analytics and dashboards
- Export quiz results as CSV
- Post announcements and upload learning resources
- Write behavioral and academic evaluations for learners

### School Admin
- Manage all learner and teacher accounts
- Create and manage classes and enrollments
- School-wide performance analytics across all classes
- Post school-wide announcements
- Upload school logo and configure branding
- View all evaluations across the school
- Manage academic years, terms, and calendar events
- Monitor system integrity and data health

### Superadmin (Platform Owner)
- Onboard new schools in ~30 seconds (auto-provisions database, subdomain, welcome email)
- Manage the master database across all schools
- Generate registration access codes
- Control subdomain provisioning via cPanel API
- Manage SMTP, FTP, and API credentials

### Parent
- Home overview and progress report for each linked child (`api/parent/get_home.php`, `get_report.php`)
- Read the child's syllabus, school news and events (`get_syllabus.php`, `get_news.php`, `get_events.php`)
- Link a child through an invite link the learner creates (`api/learner/create_parent_invite.php`, `api/parent/redeem_parent_invite.php`)
- Unverified: notifications to parents on quiz results and teacher feedback

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | PHP 8.2+ (no framework — vanilla PHP) |
| Database | MySQL / MariaDB — multi-tenant (one DB per school) |
| Frontend | Vanilla JavaScript ES6+, Vanilla CSS3 |
| Icons & Fonts | Font Awesome 6.5.0, Google Fonts (CDN) |
| Email | PHPMailer 6.10+ via SMTP |
| Push Notifications | minishlink/web-push 9.0+ |
| Testing | PHPUnit |
| PWA | Service Worker + Web Manifest |
| DNS | cPanel API (subdomain auto-provisioning) |
| CI/CD | GitHub Actions + FTP deploy |

---

## Where things live

| Path | What it holds |
|------|---------------|
| `index.php`, `dashboard.php` | The login and registration page, and the router that sends each role to its dashboard |
| `learner_dashboard.php`, `teacher_dashboard.php`, `school_admin_dashboard.php`, `parent_dashboard.php` | The page shell for each role |
| `api/` | JSON endpoints, one folder per role (`learner/`, `teacher/`, `school/`, `parent/`) plus two shared typing endpoints |
| `auth/` | Login, registration, password reset, remember-me, the shared session guard, the CSRF check, rate limiting and parent invites |
| `assets/` | CSS and JavaScript; the JavaScript is split into `js/learner/`, `js/teacher/`, `js/school/`, `js/parent/` and `js/shared/` |
| `includes/` | Shared PHP: app version, theme heads, marks guard, multiple-answer scoring, global file viewer |
| `uploads/`, `assignment_uploads/`, `assignment_submissions/`, `post_uploads/`, `question_uploads/`, `quiz_images/`, `resources/` | User-uploaded files |
| `superadmin/` | The multi-school management panel, its own README and the new-school SQL template |
| `migrations/` | Dated SQL files for schema changes (applied by hand; see [Known Issues](#known-issues)) |
| `tests/` | PHPUnit tests |
| `docs/`, `specs/` | Documentation and design proposals; start at [docs/README.md](docs/README.md) |
| `tools/` | Email preview |
| `service-worker.js`, `manifest.php` | PWA offline support and web manifest |
| `.github/workflows/` | `deploy-main.yml` (production) and `deploy-sandbox.yml` (sandbox) |
| `vendor/` | Composer packages. Listed in `.gitignore` but currently tracked in git; the deploy workflows skip it |
| `old_files/`, `_archive/`, `react_test_manual/` | Do not edit: legacy code, old utilities and logs, an abandoned experiment |

`config.php` (database connection and environment detection) is listed in `.gitignore` and is not in the repository.

Unverified: what the marketing and demo folders (`website/`, `enthropy/`, `laura/`, `demo/`, `animations/`, `iskool_pdf/`) and the public `*.html` pages in the root are for.

---

## Getting Started

Unverified: whether a full local environment is in use. `AGENTS.md` has said that development and testing happen on the dev server, which deploys whenever `dev` is pushed, while this section describes a local setup. Until the owner confirms (open question 1 in [docs/DOCUMENTATION_PLAYBOOK.md](docs/DOCUMENTATION_PLAYBOOK.md)), treat the steps below as the intended local setup, not a tested one.

### Prerequisites
- PHP 8.2+ and MySQL / MariaDB
- Git
- Composer
- Local web server for localhost testing, or a hosting server for production

### First-time Setup

**1. Clone the repository**
```bash
git clone https://github.com/mandlacodes404/iskool_schools.git
cd iskool_schools
git checkout dev
```

**2. Install PHP dependencies**
```bash
composer install
```

**3. Configure the environment**
Copy `.env.example` to `.env` and fill in the keys it lists (database, SMTP, push keys, superadmin password, cPanel access).

`config.php` is listed in `.gitignore` and is not in the repository, so a fresh clone does not have it. Unverified: how to create it, and whether it reads the `.env` keys (`AGENTS.md` says it does). This is open question 1 in the playbook.

**4. Set up a school database**

Import the new-school template into an empty database:
```bash
mysql -u [user] -p [new_database_name] < superadmin/iskool_new_school_template.sql
```

The template does not fully match the live schema (see [ARCHITECTURE.md](ARCHITECTURE.md#database-architecture)). Or use the Superadmin panel to auto-provision a new school.

**5. Run tests**
```bash
php vendor/bin/phpunit tests/
```
In a fresh clone `vendor/bin/phpunit` may not be executable; running it through `php` avoids that.

---

## Database

### Architecture
Multi-tenant — each school has its own isolated database:
- **Pattern:** `iskowdbw_[schoolname]` (e.g. `iskowdbw_sandtonhigh`)
- **Master database:** `iskowdbw_master` (tracks all schools)
- **Charset:** `utf8mb4`
- **Connection:** MySQLi with prepared statements

### How Routing Works
The subdomain determines the database:
```
sandtonhigh.iskool.xyz → connects to iskowdbw_sandtonhigh
landulwazi.iskool.xyz  → connects to iskowdbw_landulwazi
```
The active database is stored in `$_SESSION['current_school_db']`.

Unverified: the routing code is in `config.php`, which is not in the repository. This description comes from ARCHITECTURE.md (May 2026). `$_SESSION['current_school_db']` is used in `index.php` and `teacher_dashboard.php`.

### Schema Reference
- New school template: `/superadmin/iskool_new_school_template.sql`
- Key tables: `users`, `classes`, `class_students`, `quizzes`, `quizquestions`, `questions`, `choices`, `quiz_results`, `assignments`, `submissions`, `announcements`, `class_discussions`, `teacher_evaluations`, `resources`, `academic_years`, `parent_links`, `parent_invites`
- All tables by area: [ARCHITECTURE.md](ARCHITECTURE.md#database-architecture)

### Adding a New School
- **Automated (recommended):** Use the Superadmin panel — provisions database, subdomain, and welcome email in ~30 seconds
- **Manual:** Create a new database and import `iskool_new_school_template.sql`

---

## Deployment

### Branch Strategy

| Branch | Environment | How it deploys |
|--------|------------|----------------|
| `dev` | Sandbox (`sandbox.iskool.online/` on the host) | A push to `dev` runs `deploy-sandbox.yml` (FTP) |
| `main` | Production (`public_html/` on the host) | A push to `main` runs `deploy-main.yml` (FTP) |

What each deploy skips is listed in the `exclude:` block of its workflow file in `.github/workflows/`.

**Rule: Never commit directly to `main`.** All work goes through `dev` first.

### Workflow
```
1. Work on dev branch
2. Push to dev → test on staging server
3. Once happy → merge dev into main
4. GitHub Actions auto-deploys to production in ~2-5 minutes
```

### Manual merge to production
```bash
git checkout main
git merge dev
git push origin main
# GitHub Actions takes it from here
```

### Rollback
```bash
git log --oneline        # find the commit to revert to
git revert <commit-hash>
git push origin main     # auto-deploys the revert
```

### Required GitHub Secrets
Set under: Repo → Settings → Secrets → Actions
```
FTP_SERVER    → your hosting server address
FTP_USERNAME  → FTP username
FTP_PASSWORD  → FTP password
```

---

## Development Guidelines

### Naming Conventions
- **Files:** `snake_case` → `get_quiz_stats.php`
- **Functions:** `snake_case` → `get_quiz_by_id()`
- **Variables:** `snake_case` → `$learner_email`
- **Database tables:** `snake_case` → `academic_years`

### API Endpoint Pattern
Every file in `/api/` follows one pattern: start with the shared session guard and `config.php`, check the role, call `verify_csrf_token()` when the endpoint changes data, use prepared statements, and return JSON. The current pattern, with real examples, is in [ARCHITECTURE.md](ARCHITECTURE.md#standard-endpoint-pattern).

### Security Checklist (before every commit)
- [ ] All DB queries use prepared statements — no string concatenation with user input
- [ ] User input is validated with `isset()`, `trim()`, `strlen()`
- [ ] Auth check at the top of every protected file
- [ ] No hardcoded passwords, API keys, or credentials
- [ ] No debug code left behind (`var_dump`, `console.log`, `echo $debug`)
- [ ] HTML output is escaped to prevent XSS

### Commit Message Format
```
feature: add quiz timer reset on reopen
fix: mobile sidebar overlap on small screens
refactor: move grade calculation to helper function
```

---

## Known Issues

### Critical
- Unverified: where database credentials are kept. `config.php` is not in the repository, so this document cannot confirm it (earlier notes said it holds plaintext credentials; `AGENTS.md` says it loads them from `.env`)
- Test coverage of API and database behaviour is thin. `tests/` has many files, but most of them read page, script and style source files and check them for specific content: of the 43 files, 39 use `file_get_contents` and only 2 mention `mysqli`, `curl` or a URL (checked 2026-11-14)

### Medium Priority
- No linter or code formatter configured (inconsistent style across files)
- No tool applies the SQL files in `migrations/`: they are dated files run by hand on each school database. Unverified: the exact procedure
- No centralised error logging — currently writes to `php_errors.log`
- No API documentation (no Swagger/OpenAPI spec); a generated reference is planned in `docs/DOCUMENTATION_PLAYBOOK.md`

### Known Bugs
- Quiz timer does not always reset if a learner reopens a quiz (workaround: refresh before submitting)
- Mobile sidebar occasionally overlaps content on very small screens
- Push notifications not supported on older browsers (IE11, old Safari) — expected behaviour

### Known Limitations
- Unverified: timezone hardcoded to `Africa/Johannesburg` in `config.php` (the file is not in the repository)
- Session-based auth (not JWT) — adequate for current scale
- No ORM — raw MySQLi queries throughout
- Base URL detection uses `$_SERVER['HTTP_HOST']` directly — can behave unexpectedly behind proxies

---

## Roadmap

**Near term:**
- Migrate database credentials from `config.php` to `.env` *(Unverified: may already be done)*
- Add PHPCodeSniffer for consistent code style
- Expand test suite with basic API and auth tests
- Add centralised error logging (Sentry or similar)

**Medium term:**
- Database migration system
- API documentation (Swagger/OpenAPI)
- JWT authentication (groundwork for future mobile apps)
- Timezone configurable per school

**Longer term:**
- Native mobile apps
- Real-time collaboration features
- Attendance tracking module
- WCAG 2.1 accessibility compliance

---

## Support

| Resource | Location |
|----------|----------|
| Installation guide | `install_guide.html` |
| Changelog | `CHANGELOG.md` |
| Superadmin setup | `/superadmin/README.md` |
| Privacy policy | `privacy-policy.html` |
| Terms of service | `terms-of-service.html` |

**Email:** mandlasimphiwe99@gmail.com
**Support:** support@iskool.xyz
**Security issues:** security@iskool.xyz *(do not open public GitHub issues for security bugs)*

---

© 2026 iSkool EdTech. All rights reserved. Unauthorised use prohibited.
