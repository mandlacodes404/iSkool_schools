# iSkool Schools — Security Document

> This document defines the security rules, known vulnerabilities, and required patterns
> for the iSkool platform. Every developer and AI agent must read this before touching
> authentication, file uploads, database queries, user input, or credentials.
>
> This platform handles real data belonging to school children. Security is not optional.

---

## Table of Contents

- [Critical Issues — Fix These First](#critical-issues--fix-these-first)
- [Authentication Security](#authentication-security)
- [Authorisation & Role Enforcement](#authorisation--role-enforcement)
- [SQL & Database Security](#sql--database-security)
- [File Upload Security](#file-upload-security)
- [Input Validation & XSS](#input-validation--xss)
- [Credentials & Secrets](#credentials--secrets)
- [Session & Cookie Security](#session--cookie-security)
- [API Security](#api-security)
- [File & Path Security](#file--path-security)
- [Good Patterns — Preserve These](#good-patterns--preserve-these)

---

## Critical Issues — Fix These First

These three issues represent the highest risk to the platform right now.
Do not add major new features until these are addressed.

### 1. Hardcoded credentials in source code
Production database passwords, SMTP credentials, VAPID keys, and cPanel tokens
are hardcoded across many PHP files. If the repository is ever exposed, an attacker
has immediate access to every school database, email sending, push notifications,
and school provisioning.

**Files confirmed to contain hardcoded secrets:**
- `config.php` — DB user, DB password, DB prefix
- `auth/register_ajax.php` — SMTP credentials
- `auth/password/send_reset_link.php` — SMTP credentials
- `login_register.php` — SMTP credentials
- `affiliate_apply.php` — SMTP credentials
- `create_quiz.php` — SMTP credentials
- `message_teacher.php` — Gmail address and app password
- `push_functions.php` — VAPID public and private keys
- `api/teacher/create_assignment.php` — SMTP credentials
- `api/teacher/create_announcement.php` — SMTP credentials
- `api/teacher/create_evaluation.php` — SMTP credentials
- `api/teacher/upload_resource.php` — SMTP credentials
- `api/learner/create_discussion.php` — SMTP credentials
- `superadmin/index.php` — DB password, cPanel credentials, SMTP credentials
- `tools/email-preview/*` — SMTP credentials and test password

**Required environment variables to replace them:**
```
DB_HOST
DB_USER
DB_PASSWORD
DB_PREFIX
SMTP_HOST
SMTP_USER
SMTP_PASSWORD
SMTP_PORT
SMTP_FROM
VAPID_PUBLIC_KEY
VAPID_PRIVATE_KEY
SUPERADMIN_PASSWORD
CPANEL_USER
CPANEL_TOKEN
```

### 2. Upload directories are web-accessible with weak validation
Files uploaded by users are stored inside the web root and can be accessed
directly by URL. `submit_assignment.php` accepts any file type with no
extension or MIME validation. `upload_logo.php` allows SVG uploads, which
can contain executable JavaScript.

### 3. No CSRF protection
All state-changing POST endpoints rely on session cookies alone. There are
no CSRF tokens. This means a malicious website could trick a logged-in user
into submitting forms to iSkool endpoints without their knowledge.
`subscribe_push.php` has no auth check at all and trusts the email supplied
in the request body.

---

## Authentication Security

### What is done correctly
- Passwords are stored with `password_hash(..., PASSWORD_DEFAULT)` — correct
- Login verifies with `password_verify()` — correct
- Session ID is regenerated after login with `session_regenerate_id(true)` — correct
- Session ID is also regenerated after remember-me restore — correct

### Session cookie settings
Secure cookie settings (`Secure`, `HttpOnly`, `SameSite: Strict`) are only
applied in `auth/login_ajax.php` and `login_register.php`. Most other entry
points call plain `session_start()` with no cookie configuration.

**Rule: every file that calls `session_start()` must use secure cookie params,
or better — centralise this into one shared auth guard file.**

### Session timeout
`$_SESSION['last_active']` is set on login, but there is no consistently
included timeout guard enforcing idle session expiry across the codebase.
A 45-minute idle timeout should be enforced on every protected page.

### Remember-me
The selector/validator pattern in `auth/remember_me_functions.php` is good:
- Random selector + random validator
- Stores `hash('sha256', $validator)` in `user_tokens` — not the raw token
- Cookie set with `HttpOnly`, `Secure`, `SameSite: Strict`

**Known gaps in the remember-me implementation:**
- Token is not rotated after use — should generate a new token on each use
- No device-level token cleanup
- Tokens are not invalidated when the user changes their password

### Known auth gaps
| File | Issue |
|------|-------|
| `subscribe_push.php` | Trusts email from JSON body instead of session — no real auth |
| `teacher_settings.php` | Checks logged-in email but not role |
| `learner_settings.php` | Checks logged-in email but not role |
| `upload_profile.php` | Allows any logged-in user regardless of role |
| `upload_teacher_profile.php` | Uses legacy `$_SESSION['teacher']` flag, not `$_SESSION['role']` |
| `upload_logo.php` | Uses legacy `$_SESSION['school_admin']` flag |
| `reports.php` | Uses legacy session flags |
| `find_learners.php` | Uses legacy session flags |

**Rule: always use `$_SESSION['role']` for role checks. Never use legacy flags
like `$_SESSION['teacher']` or `$_SESSION['school_admin']` — these may not be set.**

---

## Authorisation & Role Enforcement

### How role enforcement works
Role checks are direct session comparisons on every protected file. There is
no shared middleware. This means role logic is duplicated everywhere.

```php
// Correct pattern — use this in every protected file
if (!isset($_SESSION['email']) || $_SESSION['role'] !== 'teacher') {
    echo json_encode(['error' => 'Unauthorized']);
    exit;
}

// For school admin — correct pattern
if (!isset($_SESSION['email']) || !in_array($_SESSION['role'], ['school_admin', 'admin'])) {
    echo json_encode(['error' => 'Unauthorized']);
    exit;
}
```

### Role boundaries
| Role | Can access |
|------|-----------|
| `learner` | `api/learner/*`, `learner_dashboard.php` |
| `teacher` | `api/teacher/*`, `teacher_dashboard.php` |
| `school_admin` / `admin` | `api/school/*`, `school_admin_dashboard.php` |
| `superadmin` | `superadmin/*` |

A learner cannot access teacher endpoints because files like
`api/teacher/create_assignment.php`, `api/teacher/save_marks.php`, and
`api/teacher/toggle_quiz_status.php` check `$_SESSION['role'] !== 'teacher'`.

### Rule for every new endpoint
Every new API file must:
1. Call `session_start()` with secure cookie params
2. Include `config.php`
3. Set `Content-Type: application/json`
4. Check `$_SESSION['email']` and `$_SESSION['role']` before doing anything else
5. Return `json_encode(['error' => 'Unauthorized'])` and `exit` on failure

---

## SQL & Database Security

### Rule: always use prepared statements
Every database query that includes any variable — from any source — must use
a MySQLi prepared statement. No exceptions.

```php
// CORRECT
$stmt = $conn->prepare("SELECT * FROM users WHERE email = ?");
$stmt->bind_param("s", $email);
$stmt->execute();

// WRONG — never do this, even with real_escape_string
$result = $conn->query("SELECT * FROM users WHERE email = '$email'");
```

### Files confirmed using safe prepared statements
`auth/login_ajax.php`, `auth/register_ajax.php`, `auth/password/send_reset_link.php`,
`auth/password/reset_password.php`, `api/teacher/upload_resource.php`,
`api/teacher/save_marks.php`, `api/school/create_class.php`,
`api/school/delete_learner.php`, `api/learner/join_class.php`,
`submit_quiz.php`, `submit_assignment.php`, `take_quiz.php`

### Files with unsafe SQL interpolation — fix these
| File | Risk level |
|------|-----------|
| `api/learner/create_discussion.php` | High |
| `api/learner/submit_reply.php` | High |
| `api/learner/get_discussion_thread.php` | High |
| `api/learner/get_new_replies.php` | High |
| `api/learner/get_evaluations.php` | Medium |
| `api/school/get_teacher_profile.php` | High |
| `api/school/get_teacher_analytics.php` | High |
| `api/school/get_teacher_analytics_data.php` | High |
| `api/school/save_settings.php` | Medium |
| `admin_year_helper.php` | Medium |
| `learner_dashboard.php` | Medium |
| `parent_dashboard.php` | Medium |
| `superadmin/index.php` | High |

> When refactoring any of these files, convert all queries to prepared statements
> before making any other change.

---

## File Upload Security

### Required validation for every upload endpoint
Every file upload must check all four of the following before saving:

```php
// 1. File size
if ($_FILES['file']['size'] > 10 * 1024 * 1024) { // 10MB max
    echo json_encode(['error' => 'File too large']); exit;
}

// 2. Extension allow-list
$allowed_extensions = ['pdf', 'doc', 'docx', 'jpg', 'jpeg', 'png'];
$ext = strtolower(pathinfo($_FILES['file']['name'], PATHINFO_EXTENSION));
if (!in_array($ext, $allowed_extensions)) {
    echo json_encode(['error' => 'File type not allowed']); exit;
}

// 3. MIME type verification
$finfo = new finfo(FILEINFO_MIME_TYPE);
$mime = $finfo->file($_FILES['file']['tmp_name']);
// Verify mime matches expected types for this extension

// 4. Sanitize filename before storing
$safe_name = preg_replace('/[^a-zA-Z0-9._-]/', '_', basename($_FILES['file']['name']));
```

### Current validation status by endpoint

| Endpoint | Size limit | Extension check | MIME check | Status |
|----------|-----------|----------------|------------|--------|
| `api/teacher/upload_resource.php` | 10MB | Yes | No | Acceptable |
| `api/school/save_settings.php` | — | Yes | Yes (finfo) | Good |
| `api/learner/create_discussion.php` | 5MB | Yes | No | Acceptable |
| `upload_profile.php` | None | Yes | No | Weak |
| `upload_teacher_profile.php` | None | Yes | No | Weak |
| `upload_logo.php` | None | Yes (allows SVG) | No | **Dangerous** |
| `submit_assignment.php` | None | **None** | **None** | **Critical** |
| `create_quiz.php` (images) | None | Weak | No | **Weak** |

### Blocked file types — never allow these
```
php, phtml, phar, php3, php4, php5, php7
cgi, pl, py, rb, sh
asp, aspx, jsp
html, htm (in upload directories)
svg (unless sanitized — currently dangerous in upload_logo.php)
```

### Double extension attacks
Always check only the final extension and reject files with multiple extensions:
```
malicious.php.jpg  →  reject
shell.pHp          →  reject (always lowercase before checking)
```

### Upload directory protection
All upload directories (`uploads/`, `resources/`, `assignment_submissions/`,
`assignment_Uploads/`, `quiz_images/`, `post_uploads/`) must have an `.htaccess`
file that prevents direct execution:

```apache
# Add this .htaccess to every upload directory
Options -Indexes
php_flag engine off
AddType text/plain .php .phtml .phar .html .htm .svg
```

---

## Input Validation & XSS

### Output escaping rule
Any value that came from a user or a database and is being rendered into HTML
must be escaped with `htmlspecialchars()`:

```php
// CORRECT
echo htmlspecialchars($user_name, ENT_QUOTES, 'UTF-8');

// WRONG
echo $user_name;
echo $_GET['name'];
```

### JavaScript embedding rule
When embedding server-side values into JavaScript, always use `json_encode()`,
not `addslashes()`:

```php
// CORRECT
$safe = json_encode($value);
echo "<script>var name = $safe;</script>";

// WRONG — weaker, can be bypassed
echo "<script>var name = '" . addslashes($value) . "';</script>";
```

### Known XSS risks
- `upload_logo.php` — SVG files can contain `<script>` tags
- Any API that returns stored user content as JSON where the frontend
  renders it with `innerHTML` without escaping
- `learner_dashboard.php` — uses `addslashes()` instead of `json_encode()`
  for embedding session values in JavaScript

---

## Credentials & Secrets

### The rule: nothing secret belongs in PHP files
No password, API key, token, or credential of any kind should exist in any
PHP file. All secrets must come from environment variables.

```php
// CORRECT
$db_password = getenv('DB_PASSWORD');
$smtp_password = getenv('SMTP_PASSWORD');
$vapid_private = getenv('VAPID_PRIVATE_KEY');

// WRONG — what the codebase currently does in many files
$db_password = 'ogeQkRitRfdy';
```

### Migration path
1. Create a `.env` file at the project root (already in `.gitignore` — good)
2. Add all secrets to `.env`
3. Load `.env` at the top of `config.php` using a simple parser or a library
4. Replace every hardcoded credential with `getenv('VAR_NAME')`
5. Create `.env.example` with all variable names but no values — commit this to git

### .env.example template
```
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

---

## Session & Cookie Security

### Required session configuration
This must be applied before `session_start()` on every protected entry point:

```php
session_set_cookie_params([
    'lifetime' => 0,
    'path'     => '/',
    'secure'   => true,
    'httponly' => true,
    'samesite' => 'Strict'
]);
session_start();
```

### Session timeout enforcement
Every protected page must check idle time:

```php
$timeout = 45 * 60; // 45 minutes
if (isset($_SESSION['last_active']) && (time() - $_SESSION['last_active']) > $timeout) {
    session_unset();
    session_destroy();
    header('Location: index.php?session=expired');
    exit;
}
$_SESSION['last_active'] = time();
```

### CSRF — currently missing, must be added
State-changing endpoints (POST requests that write to the database) must
require a CSRF token:

```php
// Generate token on page load (store in session)
$_SESSION['csrf_token'] = bin2hex(random_bytes(32));

// Validate on every POST
if (!isset($_POST['csrf_token']) || $_POST['csrf_token'] !== $_SESSION['csrf_token']) {
    echo json_encode(['error' => 'Invalid request']);
    exit;
}
```

---

## API Security

### Every API endpoint must
- [ ] Start with secure `session_set_cookie_params()` + `session_start()`
- [ ] Include `config.php`
- [ ] Set `Content-Type: application/json`
- [ ] Check `$_SESSION['email']` and `$_SESSION['role']` before anything else
- [ ] Use prepared statements for all queries
- [ ] Validate and sanitize all input
- [ ] Never expose stack traces or error details in the response

### Rate limiting — currently missing
There is no rate limiting on login, registration, password reset, or any API
endpoint. At minimum, login and password reset should be rate limited to
prevent brute force attacks. This should be added before the platform scales.

### CORS — currently inconsistent
| File | CORS setting |
|------|-------------|
| `api/learner/get_quizzes.php` | `Access-Control-Allow-Origin: *` |
| `api/learner/get_assignments.php` | Reflects `HTTP_ORIGIN` |
| `api/learner/get_learner_profile.php` | Allows `http://localhost:3000` |
| Most other endpoints | No CORS header |

**Rule: do not add `Access-Control-Allow-Origin: *` to any endpoint that
reads or writes user data. CORS wildcard on authenticated endpoints is a
security misconfiguration.**

### subscribe_push.php — fix immediately
This endpoint has no authentication check and trusts the email supplied
in the request body. Any caller can update any user's push subscription.
Add a session check and use `$_SESSION['email']` instead of the
request-supplied email.

---

## File & Path Security

### Path traversal
Newer upload code uses `school_upload_helper.php` which sanitizes school
slugs — this is good. Older code uses `basename()` on filenames, which
prevents directory traversal but is not a complete security policy.

**Rule: always sanitize filenames before saving:**
```php
$safe_name = preg_replace('/[^a-zA-Z0-9._-]/', '_', basename($filename));
```

### Upload directories must not be web-executable
Currently no `.htaccess` files exist protecting the main upload directories.
Add the following `.htaccess` to every upload folder:

```apache
Options -Indexes
php_flag engine off
```

### Directory listing
No global `Options -Indexes` rule was found in the repository. Apache may
be exposing directory contents of upload folders. Confirm this is disabled
at the server level or add `.htaccess` files to all upload directories.

---

## Good Patterns — Preserve These

These are the things the codebase gets right. Do not change these patterns.

| Pattern | Where it's used |
|---------|----------------|
| `password_hash()` / `password_verify()` | All auth files |
| `session_regenerate_id(true)` after login | `auth/login_ajax.php`, `login_register.php` |
| `session_regenerate_id(true)` after remember-me restore | `auth/check_remember_me.php` |
| Selector/validator remember-me design | `auth/remember_me_functions.php` |
| Prepared statements in core auth | All auth files |
| School-scoped upload directories | `school_upload_helper.php` |
| `HttpOnly` + `Secure` + `SameSite: Strict` on remember-me cookie | `auth/remember_me_functions.php` |
| Extension allow-list on resource uploads | `api/teacher/upload_resource.php` |
| MIME verification with `finfo` | `api/school/save_settings.php` |

---

*Last updated: May 2026 — based on full codebase security audit*
*Review this document whenever authentication, uploads, or database access patterns change*
*Security issues should be reported to: security@iskool.xyz — never open a public GitHub issue for a security vulnerability*
