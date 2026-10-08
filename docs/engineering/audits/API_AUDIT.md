# Account 4 — API Security Audit

**Repository:** iSkool_schools  
**Branch audited:** `dev`  
**Auditor:** Account 4 — API  
**Audit type:** Source-code security and correctness audit  
**Application changes:** None  
**Runtime testing:** Unavailable

## Overall verdict

**NEEDS REMEDIATION**

The current `dev` branch has substantially improved security controls following the Sentinel P0 remediation. No new P0 issue was identified during source inspection.

Remaining authorization weaknesses require remediation, particularly around quiz integrity-report access and the teacher-to-class authorization model.

## Findings

### API-001 — Teacher can access another teacher's quiz integrity report

**Severity:** P1  
**Status:** CONFIRMED  
**Operation:** READ  
**Endpoint:** `fetch_integrity_report.php`

The endpoint verifies that the caller is authenticated as a teacher but does not verify that the authenticated teacher owns or is otherwise authorized for the supplied `quiz_id`.

The endpoint accepts a client-controlled quiz ID and queries integrity information using that ID.

**Exploitation scenario:** Teacher A supplies a quiz ID belonging to Teacher B and may receive learner integrity information for Teacher B's quiz.

**Expected behavior:** Verify the authenticated teacher's authorization for the quiz before returning integrity data.

**Impact:** Unauthorized disclosure of learner quiz-integrity information.

**Runtime verification:** Not performed.

---

### API-002 — Teacher-to-class authorization is inconsistent on class-scoped write APIs

**Severity:** P1 if assigned-class-only is the intended product rule; otherwise P2/P3  
**Status:** POTENTIAL / NEEDS VERIFICATION  
**Operation:** CREATE / UPDATE

**Affected examples:**
- `api/teacher/create_assignment.php`
- `api/teacher/create_announcement.php`
- `api/teacher/create_evaluation.php`
- `api/teacher/add_manual_quiz.php`
- `api/teacher/save_academic_event.php`
- `api/teacher/save_sbo.php`
- `api/teacher/save_subject.php`
- `api/teacher/save_teacher_subject.php`
- `api/teacher/upload_resource.php`

Several endpoints verify that a supplied `class_id` exists but do not consistently prove that the authenticated teacher is authorized for that class.

For example, `save_teacher_subject.php` accepts a client-controlled `class_id`, checks only that the class exists, and can then create/update the teacher-to-class row.

This is not classified as a confirmed privilege escalation because the intended product rule is not sufficiently explicit. The application may intentionally allow teachers to select any class in their school.

**Required product decision:** Are teachers authorized for every school class, or only explicitly assigned/linked classes?

If assigned-class-only is intended, every class-scoped teacher read/write operation must enforce the relationship server-side.

---

### API-003 — `save_teacher_subject.php` lacks CSRF validation

**Severity:** P2  
**Status:** CONFIRMED  
**Operation:** CREATE / UPDATE  
**Endpoint:** `api/teacher/save_teacher_subject.php`

The endpoint uses the centralized session guard but does not load/call the existing CSRF helper.

It performs state-changing operations against `teacher_subjects`.

**Expected behavior:** Use the existing centralized CSRF validation mechanism consistently with other browser state-changing endpoints.

Existing SameSite session protections reduce traditional cross-site CSRF exposure, so this is not rated P1.

---

### API-004 — Learner evaluation submission is not clearly scoped to the learner's class

**Severity:** P2  
**Status:** POTENTIAL / NEEDS VERIFICATION  
**Operation:** CREATE  
**Endpoint:** `api/learner/submit_evaluation.php`

The endpoint derives the learner's current class from authenticated session identity, but accepts `eval_id` from the client without clearly verifying that the evaluation belongs to that learner's class.

A learner could potentially submit a response against an evaluation belonging to another class.

**Expected behavior:** Verify that the supplied evaluation is available to the authenticated learner's class before accepting the response.

**Runtime verification:** Not performed.

---

### API-005 — Authorization failures frequently return HTTP 200

**Severity:** P2  
**Status:** CONFIRMED  
**Operation:** API contract / error handling

Multiple endpoints return JSON such as `Unauthorized` without setting an appropriate HTTP status.

The API standards distinguish:
- 401 — unauthenticated
- 403 — authenticated but forbidden
- 400/422 — invalid input
- 404 — missing resource
- 500 — unexpected server failure

Returning HTTP 200 for authorization failures makes API behavior ambiguous and complicates clients, monitoring, testing, and security controls.

**Expected behavior:** Return appropriate HTTP status codes consistently.

---

### API-006 — Input/business validation is inconsistent

**Severity:** P2/P3 depending on endpoint  
**Status:** CONFIRMED PATTERN

Many endpoints correctly cast IDs and use prepared statements, but integer/type validation does not necessarily establish that the requested relationship is valid or authorized.

Examples include client-supplied `class_id`, `quiz_id`, and `eval_id`.

Prepared statements prevent SQL injection but do not establish authorization or business-rule validity.

**Expected behavior:** Validate syntax/type, then validate resource existence, relationship, authorization, and business state as applicable.

## Positive controls verified

### Authentication
- Password hashing uses `PASSWORD_DEFAULT`.
- Login uses `password_verify()`.
- Session IDs are regenerated after normal login.
- Login throttling exists.
- Password reset tokens use high-entropy generation and hashed storage.
- Password reset tokens expire and are invalidated after use.

### CSRF
The centralized CSRF helper supports POST form tokens, JSON-body tokens, and `X-CSRF-Token` headers. Most reviewed modern state-changing endpoints use the helper.

### Authorization
The following newer teacher endpoints demonstrate good resource-level ownership patterns:
- `api/teacher/get_quiz_results.php`
- `api/teacher/get_quiz_grades.php`
- `api/teacher/get_quiz_review.php`
- `api/teacher/delete_assignment.php`
- `api/teacher/delete_resource.php`
- `api/teacher/delete_quiz.php`
- `api/teacher/edit_quiz.php`
- `api/teacher/grade_open_ended.php`

These should be treated as patterns for remediation of weaker endpoints.

### Sentinel P0 remediation
The current `dev` branch contains the PR #4 Sentinel remediation. From source inspection, the major P0 authorization issues addressed by that remediation appear remediated. Runtime verification remains outstanding.

## Areas audited with no significant new findings

- Learner announcements
- Learner assignments
- Learner calendar
- Learner dashboard
- Learner discussions
- Learner discussion threads
- Learner grades
- Learner quizzes
- Learner resources
- Learner class membership
- Teacher quiz result ownership
- Teacher quiz review ownership
- Teacher assignment deletion ownership
- Teacher resource deletion ownership
- Teacher quiz deletion ownership
- Teacher quiz editing ownership
- Teacher open-ended grading ownership
- Quiz submission authorization
- Assignment submission class membership

## Recommended remediation order

1. Resolve the product/security policy for teacher-to-class authorization.
2. Add quiz ownership/resource authorization to `fetch_integrity_report.php`.
3. Complete CSRF coverage for remaining state-changing browser APIs, beginning with `save_teacher_subject.php`.
4. Scope evaluation submission to the learner's authorized evaluation/class.
5. Normalize API HTTP status codes incrementally.
6. Add runtime authorization tests covering cross-user and cross-class access attempts.

## Cross-account ownership

| Area | Recommended owner |
|---|---|
| Quiz integrity authorization | Account 4 + Account 2 |
| Teacher-to-class policy | Account 1 + Account 3 + Account 4 |
| Tenant/school context | Account 3 |
| Session bootstrap consistency | Account 2 + Account 7 |
| Global error handling | Account 7 with Account 4 API input |
| Runtime security tests | Account 6 |
| Service/repository authorization architecture | Account 5 + Account 1 |
| API status-code migration | Account 4 |

## Limitations

This was a source-code audit only.

Runtime testing was unavailable, so the audit did not independently verify live HTTP exploitation, real authenticated cross-user requests, production database behavior, browser cookie behavior, seeded integration tests, or deployment-specific configuration.

No finding should be considered runtime-verified unless separately tested.

## Audit conclusion

**Account 4 audit complete.**

No application remediation was performed as part of this audit.

Account 1 review is required before remediation is authorized.