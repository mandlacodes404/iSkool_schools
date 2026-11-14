# iSkool Schools — AI Development Guide

> **Writing or changing documentation?** Follow `docs/DOCUMENTATION_PLAYBOOK.md`. It sets the rules, templates and work plan.

This file holds the working rules for AI agents. Each kind of fact has one home, so look it up there instead of copying it here:

| You need | Read |
|----------|------|
| What the folders and files are, how to set up and deploy | `README.md` |
| How the system works (requests, auth, database, API, frontend) | `ARCHITECTURE.md` |
| How documentation is written and kept current | `docs/DOCUMENTATION_PLAYBOOK.md` |
| Every document in the repository | `docs/README.md` |

Verify any fact against the code before relying on it. Documents here have drifted before.

---

## Project Overview

iSkool is a **multi-tenant school management platform** built in PHP. Each school gets its own
database. Subdomain routing (`sandtonhigh.iskool.xyz`) determines which database to connect to.
Roles: `learner`, `teacher`, `admin` (school admin), `superadmin`, and `parent` (the parent app).

---

## How to Run and Test

- Unverified: whether a local environment exists. This file used to say there is none and that
  development and testing happen on the dev server, while `README.md` describes a local setup. Do not
  assume either; this is open question 1 in the playbook.
- `dev` deploys to the sandbox when pushed; `main` deploys to production when pushed. No build step.
- Install PHP dependencies: `composer install`
- Run all tests: `php vendor/bin/phpunit tests/`
- Run one test file: `php vendor/bin/phpunit tests/BottomNavTest.php`
- Most tests read page, script and style source files and check them for specific content (for
  example `?v=` cache numbers). A change to a page, script or style can therefore break a test:
  run the suite before you push, and update the test when you change what it checks.

---

## API and Auth Rules

- Every API endpoint starts by requiring `auth/session_guard.php` (session, timeout, CSRF token) and
  `config.php` (provides `$conn`), then checks `$_SESSION['email']` and `$_SESSION['role']`.
- Endpoints that change data also require `auth/csrf_helper.php` and call `verify_csrf_token()`
  (see `api/teacher/create_assignment.php`).
- Use **MySQLi prepared statements** for all queries — never concatenate user input into SQL.
- Return JSON with `header('Content-Type: application/json')`.
- Response shapes vary across older endpoints. Follow the newest ones, for example
  `api/learner/create_parent_invite.php`: an HTTP status code plus `{"success": false, "error": "..."}`.
- Put a header comment at the top of every endpoint you touch (template in the playbook, section 6.1).
- File-based routing — no framework router (e.g. `api/learner/get_quizzes.php`).

---

## Multi-Tenant Database

- Each school has its own database (`iskowdbw_<school>`), chosen from the subdomain by `config.php`.
  Unverified: `config.php` is listed in `.gitignore` and is not in the repository.
- The active database name is stored in `$_SESSION['current_school_db']`.
- Schema reference: `superadmin/iskool_new_school_template.sql`. It does not fully match the live
  database (see `ARCHITECTURE.md`), so check how the code uses a column before trusting the template.
- There are no `learners` or `teachers` tables; people are stored in `users`. Table names are listed
  in `ARCHITECTURE.md` and in the template.

---

## Code Style Conventions

- **Language:** PHP 8.2+ — no TypeScript, no framework
- **Frontend:** Vanilla JavaScript with `fetch()` — no React or Vue
- **Indentation:** 4 spaces
- **Naming:**
  - Files: `snake_case` (e.g. `get_quiz_stats.php`)
  - Functions: `snake_case` preferred (e.g. `redirect_to()`)
  - Variables: `snake_case` (e.g. `$learner_email`, `$school_name`)
  - Database tables: `snake_case` (e.g. `academic_years`, `class_students`)
- **SQL:** Always use MySQLi prepared statements — never concatenate user input into queries
- **No linter/formatter configured** — be consistent with the surrounding code style in each file

---

## Off-Limits — Do Not Edit

| Path | Reason |
|------|--------|
| `/old_files/` | Legacy/archived code from before refactoring |
| `/_archive/` | Old utilities and logs |
| `/react_test_manual/` | Abandoned experimental folder |
| `/vendor/` | Composer packages: run `composer install` instead. Listed in `.gitignore` but currently tracked in git |
| `.git/` | Version control metadata |
| `php_errors.log` | Runtime error log — do not modify |

---

## Security — Known Issues (Do Not Make Worse)

> These are existing problems in the codebase. Do not replicate these patterns in new code.

- Keep `.env` out of version control (it is in `.gitignore`) and use `.env.example` as the template for its keys. Unverified: that `config.php` reads them.
- `php_errors.log` may contain sensitive stack traces — never expose it publicly
- `$_SERVER['HTTP_HOST']` is used directly for base URL detection — can be spoofed behind proxies
- Unverified: timezone is hardcoded to `Africa/Johannesburg` in `config.php`

When writing new code: validate and sanitise all user input, use prepared statements, and never
echo raw `$_GET` or `$_POST` values directly into HTML or SQL.

---

## Fragile Areas — Be Careful

- **Schema changes are manual.** `migrations/` holds dated SQL files, but nothing in the repository applies them; they are run by hand on every school database.
- **No ORM** — raw MySQLi queries everywhere; a mistake affects real school data
- **The codebase is large.** Recount application PHP files (about 220 when this was written, excluding vendored and archived code) with `git ls-files | grep -Ev '^(vendor|_archive|old_files|react_test_manual|superadmin/phpmailer)/' | grep -c '\.php$'`. Check that similar functionality doesn't already exist before creating something new
- **Tests check source content, not behaviour.** API and database logic is largely untested: test changes by hand on dev after edits
- **Mixed concerns** — some files combine database logic and HTML output in the same file; try not to deepen this pattern in new files

---

## Additional Features to Be Aware Of

- **PWA:** `service-worker.js` and `manifest.php` are active — changes to caching behaviour need care
- **Push notifications:** via `minishlink/web-push` — endpoint: `subscribe_push.php`
- **Email:** via PHPMailer — used for registration and password reset flows
- **File uploads:** stored in `uploads/` and in the top-level upload folders listed in `README.md` ("Where things live")
- **Remember-me:** custom cookie implementation in `auth/check_remember_me.php`

---

## Deployment Workflow

- `dev` branch → **staging/preview** — always work and test here first
- `main` branch → **live production** — only receives code merged from `dev`
- Never commit directly to `main`

```
your changes → dev branch → test & review → merge dev into main → auto-deploys to production
```

The two deploy workflows are `.github/workflows/deploy-main.yml` and `.github/workflows/deploy-sandbox.yml`.
What each one skips is listed in its `exclude:` block; read the file rather than relying on a copy here.

> Always test on `dev` server first. Only merge to `main` once you are happy with how it looks on dev.
