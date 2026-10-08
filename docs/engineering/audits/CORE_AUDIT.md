# Core Architecture & Data Access Audit

## Executive Summary

Independent audit of the iSkool core application architecture, business logic, and data-access layer on main, using repository source plus the supplied sandbox database dump.

The strongest confirmed risks are concentrated around academic-year identity, quiz-result identity, assignment lifecycle enforcement, and database invariants that are currently implemented only through application check-then-write sequences.

The audit identified 12 findings:
- 5 HIGH
- 6 MEDIUM
- 1 LOW
- 0 CRITICAL

The most important findings are:
1. Quiz submissions store the active academic year rather than the quiz's academic year.
2. Manual teacher mark saving targets quiz + learner rather than attempt, so multiple attempts can be overwritten.
3. Assignment deadline enforcement uses a hard-coded August 2025 timestamp.
4. The supplied assignments schema requires teacher_id, while assignment creation does not write it.
5. The database does not enforce exactly one current academic year.
6. Enrolments, assignment submissions, and quiz attempts rely on check-then-insert logic without corresponding uniqueness invariants.

The repository does have good foundations: prepared statements are common, quiz submission and open-ended grading use transactions, quiz_results has attempt-level uniqueness, and several newer tables use foreign keys.

The requested docs/engineering/MASTER_DELEGATION.md and docs/engineering/ARCHITECTURE_STANDARDS.md files were not present on main. The root AGENTS.md and ARCHITECTURE.md were therefore used as the available engineering guidance. No existing engineering audit directory was found.

## Scope & Methodology

Reviewed:
- business rules and invariants;
- PHP API/page application logic;
- SQL queries and data access;
- transaction boundaries;
- academic-year handling;
- classes and enrolment;
- quiz attempts, results, grading and publication;
- assignments and submissions;
- relevant schema constraints;
- systemic patterns across representative core paths.

Representative paths included:
- submit_quiz.php
- take_quiz.php
- create_quiz.php
- api/teacher/save_marks.php
- api/teacher/grade_open_ended.php
- api/teacher/toggle_publish_marks.php
- submit_assignment.php
- api/teacher/create_assignment.php
- api/learner/join_class.php
- api/school/create_class.php
- api/teacher/save_teacher_subject.php
- api/learner/get_grades.php
- api/teacher/get_quiz_results.php

No application code was modified or executed.

## Critical Findings

None.

## High Findings

### CORE-001 — Quiz results can be assigned to the wrong academic year

**Severity:** HIGH
**Category:** Data integrity / academic-year correctness
**Location:** submit_quiz.php

**What is wrong:**
The submission flow loads the quiz's academic_year_id and correctly uses it for membership validation, but inserts current_academic_year_id into quiz_results.

**Evidence:**
submit_quiz.php:21 loads the active year.
submit_quiz.php:31 loads the quiz metadata including academic_year_id.
submit_quiz.php:64-72 validates membership using the quiz year.
submit_quiz.php:332-335 inserts current_academic_year_id into quiz_results.

api/learner/get_grades.php also filters results by the current academic year.

**Why it matters:**
A historical quiz result must retain the academic year belonging to that quiz. The current school year is not the identity of an historical result.

**Potential production impact:**
Results can move into the wrong reporting year, disappear from historical year views, or be included/excluded incorrectly in progress calculations after a year transition.

**Confidence:** High

**Recommendation:**
Make the quiz's persisted academic year authoritative throughout the submission transaction.

### CORE-002 — Manual mark saving can overwrite multiple attempts and create detached results

**Severity:** HIGH
**Category:** Grade integrity
**Location:** api/teacher/save_marks.php

**What is wrong:**
The endpoint checks and updates quiz_results using quiz_id + user_email. The schema allows multiple attempts and uniquely identifies a result by attempt_id.

The fallback INSERT also does not provide attempt_id or academic_year_id.

**Evidence:**
api/teacher/save_marks.php:37-52 checks and updates WHERE quiz_id = ? AND user_email = ?.
The supplied schema makes quiz_results.attempt_id unique but does not make quiz_id + user_email unique.

**Why it matters:**
A teacher editing one attempt can modify historical attempts for the same learner and quiz.

**Potential production impact:**
Incorrect historical marks, ambiguous result identity, and result rows not tied to any quiz attempt or academic year.

**Confidence:** High

**Recommendation:**
Use attempt/result identity as the authoritative write target. Do not create detached results unless a separate, explicitly defined business operation supports them.

### CORE-003 — Assignment submission deadline enforcement is hard-coded to 2025

**Severity:** HIGH
**Category:** Business-rule correctness
**Location:** submit_assignment.php

**What is wrong:**
The code uses a fixed timestamp rather than actual server time.

**Evidence:**
submit_assignment.php:63-66 sets now to 2025-08-19 18:01:00 and derives past_due from that value.

**Why it matters:**
Deadline enforcement is a core business rule and must use real request time.

**Potential production impact:**
Assignments can remain submit-able after their real deadline or become incorrectly unavailable. The allow_late field is also not part of this gate.

**Confidence:** High

**Recommendation:**
Centralise deadline evaluation around real server time and explicitly model late-submission policy.

### CORE-004 — Assignment creation does not satisfy the supplied assignments schema

**Severity:** HIGH
**Category:** Data-access/schema integrity
**Location:** api/teacher/create_assignment.php; supplied database schema

**What is wrong:**
The supplied assignments table defines teacher_id as NOT NULL. The INSERT in create_assignment.php does not provide teacher_id.

**Evidence:**
Schema lines 253-266 define assignments.teacher_id as NOT NULL.
api/teacher/create_assignment.php:141-149 inserts title, description, due_date, class_id, created_by, file_url, academic_year_id and term_number only.

**Why it matters:**
Application and database disagree on a required persistence field.

**Potential production impact:**
Strict MySQL configuration can reject assignment creation. Permissive configuration can result in an invalid coerced value, producing silent bad data.

**Confidence:** High, assuming the supplied dump reflects the running schema.

**Recommendation:**
Reconcile the live schema and application model before further assignment work. Establish one authoritative teacher identity representation.

### CORE-005 — Mark publication has a race window around open-ended grading

**Severity:** HIGH
**Category:** Transactional consistency
**Location:** api/teacher/toggle_publish_marks.php; api/teacher/grade_open_ended.php

**What is wrong:**
Publication first checks for ungraded responses and then separately updates publish_marks. The validation and state transition are not atomic.

**Evidence:**
toggle_publish_marks.php:36-67 performs the ungraded check.
toggle_publish_marks.php:76-78 performs the update outside a transaction.
grade_open_ended.php:26 starts its own grading transaction.

**Why it matters:**
The validation result can become stale before publication.

**Potential production impact:**
Marks can become published while a concurrent grading operation leaves the dataset in a state different from the one that was validated.

**Confidence:** Medium

**Recommendation:**
Make publication validation and state transition one concurrency-safe operation.

## Medium Findings

### CORE-006 — Learner enrolment is vulnerable to duplicate rows

**Severity:** MEDIUM
**Category:** Data integrity / concurrency
**Location:** api/learner/join_class.php; class_students

**What is wrong:**
join_class.php checks membership and then inserts. The supplied schema has no unique constraint on student_email + class_id + academic_year_id.

**Evidence:**
join_class.php:24-47 performs check then insert.
Schema class_students has indexes but no corresponding UNIQUE key.

**Potential production impact:**
Concurrent requests can create duplicate enrolments, affecting counts and any query that does not deduplicate.

**Confidence:** High

**Recommendation:**
Make enrolment identity a database-enforced invariant and make joining idempotent.

### CORE-007 — Quiz attempt limits use a non-atomic check-then-insert

**Severity:** MEDIUM
**Category:** Concurrency / quiz state
**Location:** take_quiz.php; quiz_attempts

**What is wrong:**
take_quiz.php checks for an active attempt, counts submitted attempts, checks attempt_limit, then inserts an in-progress attempt without an enclosing transaction or active-attempt uniqueness invariant.

**Evidence:**
take_quiz.php:106-135 performs the complete check sequence.
The supplied quiz_attempts schema has only a primary key and user/quiz index.

**Potential production impact:**
Concurrent browser requests can create competing in-progress attempts and confusing resume behaviour.

**Confidence:** High

**Recommendation:**
Make attempt creation an atomic state transition and define the allowed number of simultaneous in-progress attempts.

### CORE-008 — Assignment submissions lack a database uniqueness invariant

**Severity:** MEDIUM
**Category:** Data integrity / concurrency
**Location:** submit_assignment.php; submissions

**What is wrong:**
The code checks whether a submission exists and then chooses UPDATE or INSERT. The supplied submissions table has no unique assignment_id + student_email constraint.

**Evidence:**
submit_assignment.php:69-72 performs the existence check.
submit_assignment.php:137-151 performs the subsequent update/insert.
Schema submissions has only a primary key.

**Potential production impact:**
Concurrent submissions can create duplicate records for one learner and assignment.

**Confidence:** High

**Recommendation:**
Define the intended submission cardinality and enforce it at the database boundary.

### CORE-009 — Current academic year is not database-enforced as a singleton

**Severity:** MEDIUM
**Category:** Data consistency
**Location:** academic_years and repeated current-year queries

**What is wrong:**
Many code paths assume exactly one row has is_current = 1 and use LIMIT 1. The schema does not enforce one current year per school.

**Evidence:**
Schema lines 63-71 contain is_current.
Schema lines 5805-5808 show uniqueness only for school_id + name.
Representative code in submit_quiz.php, take_quiz.php, create_quiz.php and multiple APIs uses WHERE is_current = 1 LIMIT 1.

**Potential production impact:**
If two years become current, different operations may silently select an arbitrary row and assign academic data inconsistently.

**Confidence:** High

**Recommendation:**
Define and enforce one-current-year-per-school as a real invariant and fail loudly if violated.

### CORE-010 — Quiz creation can leave orphaned images after transaction rollback

**Severity:** MEDIUM
**Category:** Atomicity / filesystem-data consistency
**Location:** create_quiz.php

**What is wrong:**
Database transaction rollback does not roll back physical image moves.

**Evidence:**
create_quiz.php:277 starts the DB transaction.
Question image files are moved during the transaction.
create_quiz.php:405 commits and :407 rolls back on failure.

**Potential production impact:**
Failed quiz creation can leave orphaned files and storage growth.

**Confidence:** High

**Recommendation:**
Align file publication/cleanup with the database transaction outcome.

### CORE-011 — Parent announcement path is inconsistent with the supplied parent_classes schema

**Severity:** MEDIUM
**Category:** Data-access correctness
**Location:** api/teacher/create_announcement.php; parent_classes

**What is wrong:**
The parent recipient query filters parent_classes by academic_year_id, but the supplied parent_classes table has only parent_email and class_id.

**Evidence:**
api/teacher/create_announcement.php:82-86 references pc.academic_year_id.
Schema lines 1662-1665 define parent_classes with no academic_year_id.

**Potential production impact:**
Teacher announcements targeted to parents can fail at the SQL layer if the supplied schema is the running schema.

**Confidence:** High, assuming supplied dump reflects the running schema.

**Recommendation:**
Reconcile the parent-class relationship model and its year semantics before relying on parent-targeted announcements.

### CORE-012 — Core business rules are duplicated across procedural endpoints

**Severity:** MEDIUM
**Category:** Architecture / maintainability
**Location:** multiple root PHP and api/* paths

**What is wrong:**
Academic-year resolution, membership checks, result identity, deadline checks and notification behaviour are implemented directly in multiple HTTP handlers.

**Why it matters:**
The CORE-001, CORE-003 and CORE-005 findings show that duplicated rules are already capable of diverging.

**Potential production impact:**
Future changes can fix one endpoint while leaving another with old semantics.

**Confidence:** High

**Recommendation:**
Do not perform a broad framework rewrite. Extract only high-value domain invariants after the immediate correctness problems are resolved.

## Low Findings

### CORE-013 — Teacher identity has competing representations in the data model

**Severity:** LOW
**Category:** Domain modelling
**Location:** assignments, quizzes, teacher_subjects

**What is wrong:**
Teacher identity is represented through email in many tables while assignments also contain teacher_id.

**Potential production impact:**
Future features can accidentally update one identity representation without the other.

**Confidence:** High

**Recommendation:**
Choose and document an authoritative teacher relationship during a deliberate data-model cleanup.

## Systemic Patterns

### Application invariants are stronger than database invariants

The system frequently relies on SELECT/check followed by INSERT/UPDATE for enrolment, submissions, attempts and other state changes. The database often lacks the matching unique invariant.

### Academic year is a cross-cutting domain dimension

Academic year appears in membership, quizzes, results, assignments, announcements, resources and evaluations. The code does not always use one authoritative source for the year.

### Result identity is attempt-based in the schema but not everywhere in application logic

quiz_results correctly has a unique attempt_id, but save_marks.php still treats quiz + learner as sufficient identity.

### Transactions are improving but uneven

Quiz submission, grading, creation and deletion have transaction coverage. Enrolment, assignment submission, attempt creation and mark publication still have important non-atomic state transitions.

### Schema drift is material

The repository architecture documentation already warns about schema drift, and the supplied dump confirms live-code/schema disagreements around assignment ownership and parent-class year data.

## Areas That Are Already Good

- MySQLi prepared statements are common in the audited core paths.
- submit_quiz.php verifies availability and membership, locks the attempt and uses a transaction.
- grade_open_ended.php validates teacher ownership, score bounds and updates the aggregate result transactionally.
- quiz_results has a unique attempt_id constraint.
- Several newer child tables use foreign keys and cascading deletes.
- Quiz deletion is transaction-protected and checks for existing attempts/results before deletion.
- The codebase is already moving toward stronger relational integrity rather than being purely unstructured persistence.

## Findings That Need Further Investigation

1. Verify the supplied sandbox schema against the live dev/production assignments table before remediation of CORE-004.
2. Audit the complete academic-year management workflow for atomic switching of is_current.
3. Audit the full quiz attempt lifecycle, including timed_out handling and abandoned attempts.
4. Confirm intended assignment submission cardinality and resubmission semantics.
5. Determine intended notification failure semantics for assignment/announcement creation.
6. Inventory duplicate legacy/root-level mutation paths against current api/* paths.

## Overall Assessment

The core is functional but not yet strongly invariant-driven.

The primary engineering risk is not the absence of a framework or service layer. It is that important academic invariants are distributed across procedural PHP and only partially represented in the database.

The highest-value work is therefore not a wholesale rewrite. It is to make academic-year identity, quiz-result identity, submission identity, enrolment identity and current-year state explicit and enforceable.

## Recommended Priorities

1. Protect academic result identity — CORE-001 and CORE-002.
2. Fix assignment lifecycle correctness — CORE-003 and CORE-004.
3. Enforce database-backed uniqueness — CORE-006, CORE-007 and CORE-008.
4. Make academic-year state explicit — CORE-009.
5. Tighten transaction boundaries selectively — CORE-005 and CORE-010.
6. Gradually consolidate duplicated high-value business rules — CORE-012.

## Audit Limitations

- Requested engineering standards files were absent from main.
- Database analysis uses the supplied sandbox dump, not a direct live DB connection.
- No application code was modified.
- No production or staging mutation was performed.
- The repository contains more than 3,000 tracked blobs; this was a systemic core audit, not a claim of line-by-line review of every file.

## Final Handoff

**TASK COMPLETED**
**Agent:** Account 5 — CORE
**Task:** Core architecture, business logic, and data-access audit
**Branch:** audit/account-5-core
**SUMMARY:** Independent audit completed; 13 findings identified, with the highest risks involving academic-year result identity, manual grade writes, assignment deadlines, schema/code mismatch and missing database invariants.
**FILES CHANGED:** None
**FILES ADDED:** docs/engineering/audits/CORE_AUDIT.md
**FILES REMOVED:** None
**TESTS:** Not run; audit-only task.
**SECURITY IMPACT:** Medium
**ARCHITECTURAL IMPACT:** High
**KNOWN ISSUES:** Requested standards files absent; supplied schema should be verified against live DB.
**FOLLOW-UP REQUIRED:** Yes.
**ACCOUNT 1 REVIEW REQUIRED:** Yes

**CORE AUDIT COMPLETE — NO IMPLEMENTATION PERFORMED — AWAITING ACCOUNT 1 REVIEW**
