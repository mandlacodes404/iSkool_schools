# iSkool Security Audit

## Executive Summary

**Audit branch:** `security/sentinel-audit`  
**Baseline audited:** `dev`  
**Audit type:** Security / authentication / authorization / session / CSRF / file-upload review  
**Audit status:** Initial audit complete; remediation intentionally deferred.

### Overall security posture

**Needs remediation before the security baseline should be considered strong.**

The current codebase contains several good security controls, including password hashing with PHP's password API, session ID regeneration after normal login, database-backed authentication throttling, CSRF protection on most current state-changing endpoints, prepared statements in the reviewed security-sensitive code, and ownership checks in many newer teacher APIs.

However, the audit confirmed multiple object-level authorization weaknesses that can affect academic integrity and student privacy. The most serious are:

- A teacher can modify quiz marks through `edit_marks.php` without the server verifying that the teacher owns the referenced quiz.
- `get_quiz_review.php` restricts result ownership only for learners; authenticated non-learners can request arbitrary result IDs and receive sensitive quiz/result information.
- `link_parent.php` verifies that the parent belongs to the supplied class, but does not verify that the logged-in learner belongs to that class before creating the parent-child link.
- The super-admin panel uses a separate password gate without brute-force throttling, session ID regeneration, or CSRF protection on the high-impact school-creation action.
- Session security is inconsistent because several entry points call plain `session_start()` instead of the centralized `auth/session_guard.php`, bypassing the centralized cookie configuration and idle-time enforcement.
- User-uploaded files are still stored in web-accessible locations, and several file types are exposed through direct URLs without an application authorization check at download time.

The repository's existing `SECURITY.md` was useful as historical context, but several statements in it no longer match the current implementation. This audit therefore treats observed code behavior as authoritative.

## Findings Summary

| ID | Severity | Category | Status |
|---|---|---|---|
| SEC-001 | HIGH | Authorization / IDOR | OPEN |
| SEC-002 | HIGH | Authorization / Sensitive Data Exposure | OPEN |
| SEC-003 | HIGH | Authorization / Parent-Learner Boundary | OPEN |
| SEC-004 | HIGH | Super-Admin Authentication / CSRF | OPEN |
| SEC-005 | MEDIUM | Session Security | OPEN |
| SEC-006 | MEDIUM | File Access / Upload Security | OPEN |
| SEC-007 | MEDIUM | Authorization / Teacher Class Scope | OPEN |
| SEC-008 | LOW | Error Information Exposure | OPEN |

**Critical findings:** 0 confirmed  
**High findings:** 4  
**Medium findings:** 3  
**Low findings:** 1

No finding was marked CRITICAL because the reviewed code did not provide enough evidence to establish a critical compromise path with the required confidence. The HIGH findings are nevertheless serious and should be prioritized.

---

## Scope

Reviewed the security-sensitive portions of the current `dev` branch, including:

- Authentication and login
- Session management
- Remember-me authentication
- Password reset/change
- CSRF implementation
- Teacher authorization
- Learner authorization
- Parent/learner linking
- Quiz result access
- Grade modification
- School-admin APIs
- Super-admin access
- File uploads and direct file storage
- Sensitive response/error handling
- Representative learner/teacher/school APIs

Excluded generated/vendor libraries from application-level review.

The repository's `config.php` is not tracked in the inspected tree, so database connection configuration and server-side environment configuration could not be independently audited from Git contents.

No production changes were made.

---

## Methodology

The audit followed the engineering instructions:

1. Read the engineering delegation, architecture standards, and Account 2 brief.
2. Created the dedicated branch before application changes.
3. Inspected authentication/session/CSRF code.
4. Inspected representative high-risk endpoints.
5. Followed user-controlled object IDs through authorization checks.
6. Reviewed role boundaries and teacher/parent/learner relationships.
7. Reviewed file upload validation and storage.
8. Distinguished confirmed vulnerabilities from potential weaknesses.
9. Did not modify application code during the audit.

The central test was:

> Does the server verify that the authenticated user is authorized to access or modify the specific object identified by the request?

This follows the project's own authorization direction and standard object-level authorization practice.

---

# Findings

## SEC-001 — Teacher can modify marks for a quiz they do not own

**Severity:** HIGH

**Category:** Authorization / IDOR / Academic Integrity

**Location:**
- `edit_marks.php:6`
- `edit_marks.php:11-17`
- `edit_marks.php:29-40`
- `edit_marks.php:51-69`

**Status:** REMEDIATED

**Description:**

`edit_marks.php` verifies only that the requester has the `teacher` role.

The endpoint accepts both `quiz_id` and `user_email` from the request, then directly reads and writes the corresponding `quiz_results` row.

The code does not verify that:

- the referenced quiz was created by the authenticated teacher;
- the learner belongs to the quiz's class;
- the teacher has authorization over the quiz/class.

This is an object-level authorization failure.

**Potential exploitation scenario:**

A teacher who knows or can obtain another quiz's ID can submit:

`quiz_id=<another teacher's quiz>`

together with a learner email and a new score.

The server then updates or creates the corresponding `quiz_results` record.

**Impact:**

- Unauthorized modification of learner grades.
- Academic-integrity compromise.
- Potential cross-teacher data modification.
- Potential creation of fabricated results for arbitrary learner emails in the same database.

**Confidence:** CONFIRMED from source inspection.

**Recommended fix:**

Before reading or writing the result, require the quiz to belong to the authenticated teacher, e.g. scope the lookup/update through `quizzes.created_by = $_SESSION['email']`.

Also verify that the target learner is an eligible learner for the quiz's class and academic year.

**Test required:** Yes.

Minimum regression cases:

- Teacher A → own quiz + own-class learner = allowed.
- Teacher A → Teacher B's quiz = denied.
- Teacher A → own quiz + learner outside the quiz class = denied.

---

## SEC-002 — Quiz review endpoint exposes arbitrary learner results to non-learners

**Severity:** HIGH

**Category:** Authorization / Sensitive Data Exposure / IDOR

**Location:**
- `get_quiz_review.php:15-34`
- `get_quiz_review.php:38-60`
- `get_quiz_review.php:247-266`

**Status:** REMEDIATED

**Description:**

The endpoint requires an authenticated session and reads `result_id` from the request.

The result query retrieves the referenced quiz result without initially scoping it to the current user or role.

The later access-control block applies a result-owner check only when:

`$userRole === 'learner'`

For authenticated non-learners, there is no equivalent ownership or authorization check.

The response can contain:

- learner result score;
- quiz information;
- question text;
- answer choices;
- correct-answer indicators;
- learner answers;
- open-ended grades;
- grader identity;
- feedback.

**Potential exploitation scenario:**

An authenticated teacher, parent, or other non-learner account supplies another valid `result_id` and receives the review data even when that result is outside the account's legitimate relationship.

**Impact:**

- Student grade disclosure.
- Disclosure of quiz answers/correct answers.
- Disclosure of open-ended feedback.
- Potential cross-class privacy breach.
- Potential cross-role information disclosure.

**Confidence:** CONFIRMED from source inspection.

**Recommended fix:**

Define explicit access rules for each role and enforce them against the referenced result:

- Learner → own result only.
- Teacher → results for quizzes/classes they are authorized to manage.
- Parent → results belonging to explicitly linked children.
- School admin → school-authorized results.
- Super-admin → only where explicitly required.

Do not treat "authenticated" as sufficient authorization.

**Test required:** Yes.

---

## SEC-003 — Learner can create a parent link without proving membership in the submitted class

**Severity:** HIGH

**Category:** Authorization / Parent-Learner Boundary

**Location:**
- `link_parent.php:15-17`
- `link_parent.php:24-35`
- `link_parent.php:38-44`

**Status:** REMEDIATED

**Description:**

The endpoint correctly requires the requester to be a learner and requires CSRF protection.

However, it accepts `class_id` from the client and checks only that the supplied parent belongs to that class.

It does **not** verify that the logged-in learner belongs to the supplied class.

The endpoint then inserts:

`(learner_email = current session, parent_email = supplied parent, class_id = supplied class)`

into `parent_links`.

**Potential exploitation scenario:**

A learner supplies a class ID they do not belong to together with a parent account associated with that class.

If that parent later uses parent-facing functionality based on `parent_links`, the learner may be able to establish an unauthorized parent-child relationship.

**Impact:**

- Unauthorized parent access to learner information.
- Cross-class relationship manipulation.
- Potential exposure of grades and other learner data through parent workflows.

**Confidence:** CONFIRMED for the missing authorization check. The exact downstream impact depends on all consumers of `parent_links`.

**Recommended fix:**

Before inserting the relationship, verify:

`class_students.student_email = $_SESSION['email'] AND class_students.class_id = supplied class_id`

for the appropriate academic year.

Also ensure the parent-child relationship is consistent with the product's intended enrollment model.

**Test required:** Yes.

---

## SEC-004 — Super-admin authentication and high-impact actions lack security hardening

**Severity:** HIGH

**Category:** Authentication / CSRF / Privileged Access

**Location:**
- `superadmin/index.php:24`
- `superadmin/index.php:30-36`
- `superadmin/index.php:556-568`
- `superadmin/index.php:574-596`
- `superadmin/index.php:817-866`

**Status:** REMEDIATED

**Description:**

The super-admin panel uses a single environment-supplied password and a session flag:

`$_SESSION['sa_auth'] = true`

The reviewed implementation has no visible:

- brute-force/rate limiting for the super-admin password;
- MFA;
- session ID regeneration after successful super-admin authentication;
- CSRF token validation for the `create_school` action.

The create-school action can create a database, configure a subdomain, provision a school, and send credentials.

This is a much higher-value authentication boundary than an ordinary application page.

**Potential exploitation scenario:**

An attacker repeatedly guesses the super-admin password without an application-level throttle.

Separately, if a super-admin is authenticated in a browser, the high-impact school-creation POST lacks CSRF validation.

**Impact:**

- Potential compromise of the school-provisioning control plane if the super-admin password is guessed or compromised.
- Unauthorized school provisioning or operational abuse through CSRF.
- Session fixation risk is increased by not regenerating the session ID at privilege establishment.

**Confidence:** CONFIRMED missing controls. Exploitability depends on the strength/secrecy of the environment password and deployment controls.

**Recommended fix:**

- Apply the centralized secure session configuration.
- Regenerate the session ID immediately after successful super-admin authentication.
- Add strong login throttling keyed by account and source.
- Add CSRF protection to all authenticated state-changing super-admin actions.
- Consider MFA for the super-admin boundary.
- Keep the super-admin surface isolated from ordinary user authentication.

**Test required:** Yes.

---

## SEC-005 — Session security is inconsistent across entry points

**Severity:** MEDIUM

**Category:** Session Management

**Location examples:**
- `auth/session_guard.php:1-24`
- `reports.php:2-5`
- `fetch_comments.php:2-8`
- `get_quiz_review.php:15-20`
- `get_quiz_stats.php:2-5`
- `parent_grades.php:2-5`
- `superadmin/index.php:24`
- `logout.php:2`

**Status:** OPEN

**Description:**

The centralized `auth/session_guard.php` correctly configures:

- Secure;
- HttpOnly;
- SameSite=Strict;

and applies idle-session enforcement.

However, multiple application entry points still call plain `session_start()`.

This creates two problems:

1. Those endpoints can establish sessions without the centralized cookie configuration.
2. Those endpoints do not consistently enforce the centralized idle timeout.

A particularly important architectural concern is that `session_guard.php` only applies its cookie parameters when the PHP session is not already active. A request that initializes a session through a legacy entry point can therefore reach later code with an already-started session.

**Impact:**

- Inconsistent session-cookie security.
- Inconsistent idle-session expiration.
- Increased session hijacking exposure if a session is created through an insecure entry point.
- Security behavior differs depending on which URL the user reaches first.

**Confidence:** CONFIRMED architectural inconsistency; exact browser-level exploitability depends on PHP/session server configuration.

**Recommended fix:**

Make `auth/session_guard.php` the single session bootstrap path for protected application requests.

Migrate remaining direct `session_start()` calls to the guard, without changing application behavior unnecessarily.

**Test required:** Yes.

---

## SEC-006 — Sensitive uploaded files are stored under web-accessible paths without object-level download authorization

**Severity:** MEDIUM

**Category:** File Upload / Sensitive Data Exposure

**Location examples:**
- `submit_assignment.php:93-132`
- `api/teacher/create_assignment.php:122-133`
- `api/teacher/upload_resource.php:276-285`
- `upload_profile.php`
- `upload_teacher_profile.php`

**Status:** OPEN

**Description:**

Several upload workflows store files beneath the application webroot and expose relative file paths directly.

For example, learner assignment submissions are stored under:

`assignment_submissions/`

and the application returns/stores direct file URLs.

Teacher resources and assignment attachments are also stored under web-accessible directories.

The upload validation in the reviewed newer endpoints is substantially better than the historical security document suggests: extension allow-lists, MIME checks, size limits, filename sanitization, and CSRF checks exist in several places.

The remaining problem is the **retrieval boundary**.

A direct file URL does not necessarily pass through the application authorization that should answer:

> Is this requester allowed to read this particular file?

**Potential exploitation scenario:**

A user who obtains or guesses another uploaded file's URL can request the file directly without passing through the application's role/class/relationship authorization.

This is especially sensitive for learner assignment submissions.

**Impact:**

- Disclosure of learner-submitted documents.
- Disclosure of teacher resources outside intended class boundaries.
- Potential privacy breach even when database APIs correctly enforce access.

**Confidence:** HIGH confidence that direct web retrieval bypasses application-level authorization; exact discoverability of individual filenames varies by endpoint.

**Recommended fix:**

Prefer storing sensitive uploads outside the webroot and serving them through an authenticated download handler that verifies object ownership/relationship before streaming the file.

If files must remain web-accessible, enforce server-level access restrictions and use non-guessable filenames as defense in depth.

**Test required:** Yes.

---

## SEC-007 — Teacher write endpoints accept client-controlled class IDs without a clear teacher-class authorization check

**Severity:** MEDIUM

**Category:** Authorization / Object-Level Access

**Location examples:**
- `api/teacher/create_assignment.php:60`
- `api/teacher/upload_resource.php:149`
- `api/teacher/save_subject.php:20`
- `api/teacher/save_teacher_subject.php:20-31`
- `api/teacher/get_classes.php`

**Status:** OPEN

**Description:**

Teacher endpoints accept `class_id` from the client and generally verify that the teacher is authenticated, but the reviewed create/upload paths do not consistently prove that the teacher is authorized for the selected class before creating class-scoped content.

The current product appears to intentionally allow teachers to link themselves to classes through `teacher_subjects`, so this finding is **not classified as a confirmed privilege escalation**.

The security question that needs an explicit product decision is:

> Is every teacher allowed to choose any school class, or only classes explicitly assigned/linked to them?

**Potential impact if the intended rule is assigned-class-only:**

- Teacher could publish assignments/resources to another teacher's class.
- Learners in that class could receive unauthorized content/notifications.
- Teacher could alter subject metadata for classes outside their intended scope.

**Confidence:** POTENTIAL WEAKNESS — requires confirmation of intended teacher/class authorization semantics.

**Recommended fix:**

Account 1 + Account 3 should define the authoritative teacher-to-class relationship.

Once defined, every class-scoped teacher write should enforce it server-side.

**Test required:** Yes, after policy is confirmed.

---

## SEC-008 — Several error paths expose internal database errors

**Severity:** LOW

**Category:** Sensitive Information Exposure / Error Handling

**Location examples:**
- `submit_assignment.php:21-24`
- `submit_assignment.php:70-73`
- `submit_assignment.php:141-144`
- `submit_assignment.php:151-154`
- `submit_assignment.php:169`
- `edit_marks.php` database failure paths

**Status:** OPEN

**Description:**

Some endpoints return raw database errors such as:

`Prepare failed: {database error}`

to the client.

Other newer endpoints correctly log internal details and return safe messages.

**Impact:**

- Database/table/query details may be disclosed.
- Internal implementation information can help attackers map the application.

**Confidence:** CONFIRMED.

**Recommended fix:**

Return stable safe error messages to users and log detailed database exceptions server-side.

Coordinate broader error-handling normalization with Account 7.

**Test required:** Yes.

---

# Positive Security Controls Verified

The current codebase has several controls that should be preserved:

### Authentication

- `password_hash(..., PASSWORD_DEFAULT)` is used for password storage in reviewed auth flows.
- `password_verify()` is used during login.
- Normal login calls `session_regenerate_id(true)`.
- Remember-me restoration also regenerates the session ID.
- Login throttling exists through `auth/rate_limit_functions.php`.
- Password reset requests are rate limited by account and IP.
- Reset tokens are generated with `random_bytes()`, stored hashed, expire, and are invalidated after use.
- Password changes invalidate remembered-device tokens and reset links.

### CSRF

The current implementation has a real CSRF helper supporting:

- POST form tokens;
- JSON-body tokens;
- `X-CSRF-Token` headers.

Most reviewed state-changing endpoints call `verify_csrf_token()`.

This means the older statement in `SECURITY.md` that CSRF is completely absent is no longer accurate.

### Authorization

Many newer teacher endpoints correctly scope objects to the authenticated teacher, including:

- `api/teacher/get_quiz_results.php`
- `api/teacher/get_quiz_grades.php`
- `api/teacher/get_quiz_review.php`
- `api/teacher/delete_assignment.php`
- `api/teacher/delete_resource.php`
- `api/teacher/delete_quiz.php`
- `api/teacher/edit_quiz.php`
- `api/teacher/grade_open_ended.php`

This pattern should be used to remediate the remaining weak endpoints.

### File validation

Several newer upload endpoints implement:

- extension allow-lists;
- MIME verification with `finfo`;
- file size limits;
- filename sanitization;
- blocked executable extensions;
- CSRF checks.

The main remaining concern is the retrieval/storage boundary rather than only upload validation.

---

# Authentication Assessment

## Login

**Assessment:** Generally strong for the reviewed path.

Positive controls:

- Prepared user lookup.
- `password_verify()`.
- Generic login error.
- Account/IP throttling.
- Session ID regeneration.
- Role stored from server-side database value.

Remaining concerns:

- Super-admin authentication is separate and weaker.
- Session initialization is not centralized across all entry points.
- MFA is not present for high-value administrative accounts.

## Logout

**Assessment:** Functional but inconsistent.

`logout.php` clears remember-me tokens and destroys the session, but it calls plain `session_start()` rather than the centralized session guard.

## Remember-me

**Assessment:** Good foundation, with a rotation gap.

The selector/validator design is appropriate and the validator is stored hashed.

Potential improvement:

- Rotate the remember-me token after successful restoration to reduce replay exposure.
- Review device/session management as part of future authentication hardening.

## Password reset

**Assessment:** Generally strong.

Verified:

- Generic reset response.
- Rate limiting.
- High-entropy reset token.
- Hashed token storage.
- One-hour expiry.
- Transaction/row lock on token use.
- Invalidation of all reset tokens and remembered devices after password change.

---

# CSRF Assessment

**Assessment:** Significantly improved from the historical security document.

The current application has centralized token generation and validation and uses the token in many reviewed state-changing endpoints.

Remaining issue:

- Super-admin state-changing actions do not use the same CSRF protection.
- Because legacy endpoints exist, CSRF coverage should be systematically verified across all state-changing routes rather than inferred from newer patterns.

---

# Multi-Tenant Security Assessment

The repository documentation states that each school uses a separate database and that subdomain routing selects the database.

This audit did **not** redesign or challenge that architecture.

However, application-level authorization still matters inside each school database. Confirmed findings such as SEC-001, SEC-002, and SEC-003 demonstrate that separate databases do not replace object-level authorization.

Cross-school isolation should therefore be tested by Account 3 using the real database-selection configuration.

The tracked repository did not contain `config.php`, so the actual production database-selection implementation could not be independently verified during this audit.

---

# File Upload Assessment

Current upload validation is mixed.

### Stronger implementations observed

- `api/teacher/upload_resource.php`
- `api/teacher/create_assignment.php`
- `submit_assignment.php`
- `upload_profile.php`
- `api/school/save_settings.php`

These include various combinations of size, extension, MIME, filename, and CSRF controls.

### Remaining weaknesses

- Some profile upload paths lack strict size/MIME enforcement.
- Sensitive files remain web-accessible.
- Direct file retrieval does not consistently enforce object-level authorization.
- Upload-directory server configuration was not present in the repository, so execution/disclosure protections such as Apache configuration could not be confirmed.

---

# Recommended Remediation Order

## P0 — Completed

1. **SEC-001** — Remediated: `edit_marks.php` now scopes the quiz to the authenticated teacher and verifies the learner belongs to the quiz class.
2. **SEC-002** — Remediated: `get_quiz_review.php` now denies non-learner roles before fetching result data; learner ownership remains enforced by the existing check.
3. **SEC-003** — Remediated: `link_parent.php` now verifies the logged-in learner belongs to the submitted class before creating the link.
4. **SEC-004** — Remediated: the super-admin panel now uses CSRF protection, login throttling, and session ID regeneration on successful authentication.

No database schema changes were made. SEC-005 through SEC-008 were intentionally not modified.

## P1 — Deferred

5. **SEC-005** — Deferred.
6. **SEC-006** — Deferred.
7. **SEC-007** — Deferred pending authorization-policy confirmation.
8. **SEC-008** — Deferred.

# Coordination Required

### Account 1 — ARCHITECT

Required for:

- Authorization convention for object-level checks.
- Teacher/class relationship policy.
- Centralized session bootstrap.
- File-download architecture.
- Super-admin security boundary.

### Account 3 — TENANT

Required for:

- Cross-school isolation tests.
- Tenant-aware file access.
- Confirmation of school database selection.
- Teacher/class and school relationship boundaries where they overlap tenant context.

### Account 6 — FORGE

Required for:

- Authorization regression tests.
- IDOR tests.
- Parent/learner relationship tests.
- Session/CSRF tests.

### Account 7 — OPS

Required for:

- Production error exposure.
- Web-server upload directory protections.
- Security headers/session cookie deployment checks.
- Super-admin operational exposure.

---

# Audit Limitations

This is a source-code audit of the repository snapshot available on `dev`.

Not independently verified:

- Production PHP configuration.
- Production Apache/web-server configuration.
- Actual HTTPS enforcement/HSTS deployment.
- The untracked `config.php`.
- Live database contents.
- Production DNS/subdomain isolation.
- Production file permissions.
- Real-world exploitability against a running server.

Where these limitations materially affect confidence, findings are marked as potential or require deployment verification.

---

# Status

**Audit + P0 remediation completed.**

SEC-001, SEC-002, SEC-003, and SEC-004 were remediated on `security/sentinel-audit` using the smallest application-code changes consistent with the findings. Regression coverage was added in `tests/SentinelSecurityTest.php`.

SEC-005, SEC-006, SEC-007, and SEC-008 remain OPEN by explicit instruction and were not modified. No database schema changes were made.

Automated PHPUnit execution was not available through the GitHub connector environment; the added regression test file was reviewed for syntax/logic, but no claim of a passing runtime test suite is made here.

**Account 2 — SENTINEL**
