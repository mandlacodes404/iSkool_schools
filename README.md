# iSkool Schools — Learning Management System

> A cloud-based, multi-tenant Learning Management System built for African schools. Teachers create content, learners complete work and track progress, parents stay informed, and administrators oversee everything — all from any device, any browser.

**Live:** https://iskool.online | **Version:** 1.1.2 | **License:** Proprietary © 2026 iSkool EdTech

---

## Table of Contents

- [Overview](#overview)
- [User Roles & Features](#user-roles--features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Database](#database)
- [Deployment](#deployment)
- [Development Guidelines](#development-guidelines)
- [Known Issues](#known-issues)
- [Roadmap](#roadmap)
- [Support](#support)

---

## Overview

iSkool is built on a **multi-tenant architecture** — each school gets its own isolated database. Schools access the platform via branded subdomains (e.g., `sandtonhigh.iskool.online`). A superadmin panel can provision an entirely new school in ~30 seconds.

**Highlights:**
- No installation required for end users — fully browser-based
- Progressive Web App (PWA) — installable, works offline, push notifications
- Fully responsive — desktop, tablet, and mobile
- Each school has its own branding (logo, name)
- New schools are onboarded automatically via the superadmin panel

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
- View child's grades and progress reports
- Read school announcements
- Receive notifications on quiz results and teacher feedback

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

## Project Structure

```
iskool_schools/
│
├── config.php                    # Database connection + environment detection
├── index.php                     # Entry point — login/register page
├── dashboard.php                 # Routes users to role-specific dashboard
├── learner_dashboard.php         # Learner interface
├── teacher_dashboard.php         # Teacher interface
├── school_admin_dashboard.php    # School admin dashboard
├── parent_dashboard.php          # Parent monitoring interface
│
├── /api/                         # 76 REST endpoints (return JSON)
│   ├── /learner/                 # 20+ learner endpoints
│   ├── /teacher/                 # 25+ teacher endpoints
│   └── /school/                  # 19+ school admin endpoints
│
├── /auth/                        # Login, register, password reset
│   ├── login_ajax.php
│   ├── register_ajax.php
│   ├── check_remember_me.php
│   └── /password/
│
├── /assets/                      # Frontend — CSS and JS organised by role
│   ├── /css/
│   └── /js/
│       ├── /learner/
│       ├── /teacher/
│       └── /school/
│
├── /uploads/                     # User-generated files
│   ├── /assignment_submissions/
│   ├── /assignment_uploads/
│   ├── /quiz_images/
│   ├── /question_uploads/
│   └── /post_uploads/
│
├── /superadmin/                  # Multi-school management panel
│   └── iskool_new_school_template.sql
│
├── /includes/                    # Shared UI components
├── /tests/                       # PHPUnit tests (add new tests here)
├── /migrations/                  # Empty — no migration system yet
│
├── /old_files/                   # DO NOT EDIT — archived legacy code
├── /_archive/                    # DO NOT EDIT — database dumps and backups
│   └── /db_dumps/iskowdbw_sandbox.sql
│
├── service-worker.js             # PWA offline support
├── manifest.php                  # PWA web manifest
├── composer.json                 # PHP dependencies
└── .github/workflows/            # GitHub Actions CI/CD
    ├── deploy-main.yml           # Production auto-deploy on main push
    └── deploy-sandbox.yml        # Dev/sandbox deploy
```

---

## Getting Started

The project supports both local development and live hosting. Use a PHP+MySQL stack locally (XAMPP/MAMP/WAMP or equivalent), then configure the environment from `.env`.

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
Copy `.env.example` to `.env` and set your values:
```env
DB_HOST=
DB_USER=
DB_PASSWORD=
DB_PREFIX=iskowdbw_
SMTP_HOST=
SMTP_USER=
SMTP_PASSWORD=
SMTP_PORT=465
SMTP_FROM=
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
SUPERADMIN_PASSWORD=
CPANEL_USER=
CPANEL_TOKEN=
```

`config.php` loads these values automatically at runtime.

For local testing, use `localhost`, `127.0.0.1`, or `iskool.test`. For live hosting, the school database name is built from `DB_PREFIX` plus the subdomain.

**4. Set up a school database**

Use the schema template:
```bash
mysql -u [user] -p [new_database_name] < _archive/db_dumps/iskowdbw_sandbox.sql
```

Or use the Superadmin panel to auto-provision a new school.

**5. Run tests**
```bash
vendor/bin/phpunit tests/
```

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
sandtonhigh.iskool.online → connects to iskowdbw_sandtonhigh
landulwazi.iskool.online  → connects to iskowdbw_landulwazi
```
The active database is stored in `$_SESSION['current_school_db']`.

### Schema Reference
- Full schema: `_archive/db_dumps/iskowdbw_sandbox.sql`
- New school template: `/superadmin/iskool_new_school_template.sql`
- Key tables: `users`, `classes`, `quizzes`, `quiz_questions`, `assignments`, `grades`, `evaluations`, `announcements`, `discussions`, `resources`, `academic_years`

### Adding a New School
- **Automated (recommended):** Use the Superadmin panel — provisions database, subdomain, and welcome email in ~30 seconds
- **Manual:** Create a new database and import `iskool_new_school_template.sql`

---

## Deployment

### Branch Strategy

| Branch | Environment | How it deploys |
|--------|------------|----------------|
| `dev` | Staging server | Push to dev branch |
| `main` | Production (live users) | GitHub Actions auto-deploys via FTP |

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
Every file in `/api/` must follow this structure:
```php
<?php
session_start();
header("Content-Type: application/json");

// 1. Auth check — always first
if (!isset($_SESSION['email']) || $_SESSION['role'] !== 'learner') {
    echo json_encode(['error' => 'Unauthorized']);
    exit;
}

// 2. Get DB connection
require_once '../config.php';

// 3. Use prepared statements — always
$stmt = $conn->prepare("SELECT * FROM quizzes WHERE class_id = ?");
$stmt->bind_param("i", $class_id);
$stmt->execute();
$result = $stmt->get_result();

// 4. Return JSON
echo json_encode(['success' => true, 'data' => $rows]);
```

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
- `config.php` contains plaintext database credentials — should be migrated to `.env` variables
- Test coverage is under 5% — only 1 basic sanity-check test exists

### Medium Priority
- No linter or code formatter configured (inconsistent style across files)
- No database migration system — schema changes are done manually
- No centralised error logging — currently writes to `php_errors.log`
- No API documentation (no Swagger/OpenAPI spec)

### Known Bugs
- Quiz timer does not always reset if a learner reopens a quiz (workaround: refresh before submitting)
- Mobile sidebar occasionally overlaps content on very small screens
- Push notifications not supported on older browsers (IE11, old Safari) — expected behaviour

### Known Limitations
- Timezone hardcoded to `Africa/Johannesburg` in `config.php`
- Session-based auth (not JWT) — adequate for current scale
- No ORM — raw MySQLi queries throughout
- Base URL detection uses `$_SERVER['HTTP_HOST']` directly — can behave unexpectedly behind proxies

---

## Roadmap

**Near term:**
- Migrate database credentials from `config.php` to `.env`
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
**Support:** support@iskool.online
**Security issues:** security@iskool.online *(do not open public GitHub issues for security bugs)*

---

© 2026 iSkool EdTech. All rights reserved. Unauthorised use prohibited.
