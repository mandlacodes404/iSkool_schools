# Independent Core Architecture & Data Access Audit

## Executive Summary

Independent source/schema audit only; no prior Core audit was consulted. I found **11 findings: 0 Critical, 6 High, 4 Medium, 1 Low**. The most important confirmed defects can write wrong marks, admit/deny assignment work at the wrong time, make class identity ambiguous, and permit incomplete or misattributed evaluation data.

The code has useful prepared statements and the normal quiz submission flow is transactional. Its key weakness is that core rules are implemented independently in pages and endpoints, while several assumed identities are not protected by schema constraints.

## Audit Methodology

- Read `docs/engineering/MASTER_DELEGATION.md` and `docs/engineering/ARCHITECTURE_STANDARDS.md`.
- Traced authentication/session context, academic years, enrolment, quiz creation/attempt/result/marking, assignments/submissions, evaluations/responses, grade views, and analytics.
- Compared the PHP data-access paths with the supplied `iskowdbw_sandbox (1).sql` schema.
- Assessed write predicates, uniqueness, transactions, retries, and concurrent requests.
- Did not execute writes, modify application code, inspect another Core audit, create a branch, or alter the database.

## System Understanding

Each school uses a separate database selected by `config.php`; session email and role identify the acting user. `academic_years.is_current` establishes the working year. `class_students(student_email, class_id, academic_year_id)` represents enrolment. Quiz records flow through `quizzes`, questions/choices, `quiz_attempts`, `user_answers`, `quiz_results`, and `open_ended_grades`. Assignments and submissions use `assignments`/`submissions`; evaluations use `teacher_evaluations`, statements, responses, and answers.

The supplied schema protects a normal quiz result per attempt (`quiz_results.attempt_id`), one answer per attempt/question, and one open-ended grade per attempt/question. It does not protect several other assumed identities, including unique learner enrolment and unique assignment submission.

## Critical Findings

No Critical findings were confirmed from the inspected source and supplied schema.

## High Findings

### CORE-001 — Open-ended grading drops multiple-answer points from the stored result

Severity: HIGH
Category: Academic correctness / grade recalculation
Location: `api/teacher/grade_open_ended.php:83-166`; `submit_quiz.php:290-325`

What is wrong:

Grading an open-ended question recomputes the stored result from MCQ, fill-in-the-blank, and open-ended scores only. It omits multiple-answer scores, although normal submission calculates them.

Evidence:

- `submit_quiz.php:290-325` scores multiple-answer questions.
- `grade_open_ended.php:83-162` calculates MCQ, FITB, and open scores only; lines 164-166 write their sum to `quiz_results.score`.

Why it matters:

This is a direct incorrect-mark defect: marking one response can lower the stored grade of any quiz that also has multiple-answer questions.

Potential production impact:

Published marks, summative calculations, and reports can understate a learner's result.

Confidence: Confirmed.

Recommended direction:

Use one authoritative score-recalculation use case for all supported question types, with a mixed-question regression test.

### CORE-002 — Manual marks do not preserve attempt identity and can overwrite all attempts

Severity: HIGH
Category: Grade integrity / insufficient write predicate
Location: `api/teacher/save_marks.php:22-67`; `edit_marks.php:13-72`; schema `quiz_results`

What is wrong:

Normal quiz results are attempt-specific, but manual mark paths find and update by `(quiz_id, user_email)`. This update predicate affects every attempt result for that learner/quiz. A new manual mark is inserted without `attempt_id` or `academic_year_id`; neither path validates roster membership or score bounds.

Evidence:

- The schema has unique `quiz_results.attempt_id`, permitting multiple results for a learner/quiz with different attempts.
- `save_marks.php:34-56` check/updates by learner+quiz and inserts a result with no attempt or year.
- `edit_marks.php:55-70` repeats the pattern and does not verify ownership of the requested quiz.

Why it matters:

Attempt is the result identity. Replacing it with learner-plus-quiz can destroy attempt history and create results that do not represent a submission.

Potential production impact:

One correction can rewrite historical attempts, invalid marks can enter reports, and manual records may be missing from year-filtered reports.

Confidence: Confirmed.

Recommended direction:

Require an exact attempt/result identity, or model a distinct constrained manual assessment. Validate teacher authority, roster, score range, and year in a single transaction.

### CORE-003 — Assignment deadline enforcement is frozen to a 2025 test timestamp

Severity: HIGH
Category: Assignment submission correctness
Location: `submit_assignment.php:64-79`; schema `assignments.allow_late`

What is wrong:

The submission page compares all due dates to the literal `2025-08-19 18:01:00` rather than server time and never reads the persisted `allow_late` policy.

Evidence:

- `submit_assignment.php:65-67` constructs the fixed date and bases `$past_due` on it.
- The write guard at line 79 is only `!$past_due`.
- `assignments.allow_late` exists in the schema but is unused by this path.

Why it matters:

Deadline state is a core business rule; it is now independent of the actual date.

Potential production impact:

Late work can be accepted as on-time and work due before the fixed date can remain blocked. `submissions.is_late` is not derived or recorded here.

Confidence: Confirmed.

Recommended direction:

Use the server clock plus the persisted late policy and persist late state atomically with the submission.

### CORE-004 — Enrolment rules are contradictory, and the API join path has a parameter-count defect

Severity: HIGH
Category: Enrolment integrity / identity
Location: `api/learner/join_class.php:23-40`; `learner_dashboard.php:105-130`; `api/learner/get_my_class.php:24-40`; `api/learner/get_quizzes.php:22-89`; schema `class_students`

What is wrong:

The code does not establish whether a learner has one concurrent class or many. Quiz listing supports many current classes, while profile/evaluation/resource/calendar paths select an unordered first class. Learners can request arbitrary class IDs. The API join path also prepares a two-placeholder duplicate check but binds three values (`"sii"`) whenever a current year exists.

Evidence:

- `join_class.php:26-30` has two placeholders but binds three values in the normal current-year branch; under PHP 8.2 strict MySQLi this throws, otherwise it fails the intended check.
- `learner_dashboard.php:111-126` independently implements joining with different behavior.
- The supplied schema provides only a non-unique index on `(student_email, academic_year_id, class_id)`.
- `get_my_class.php:30-35` takes a first class; `get_quizzes.php:22-89` loads all current-year classes.

Why it matters:

Membership authorizes content and supplies class identity to evaluations. Different interpretations cause different workflows to act on different classes.

Potential production impact:

Join can fail, concurrent joins can duplicate rows, and current learners can be nondeterministically associated with the wrong class.

Confidence: Confirmed for code/schema behavior. The intended one-versus-many product rule requires owner confirmation.

Recommended direction:

Specify enrolment cardinality, enforce the resulting identity in the database, and route all reads/writes through one enrolment use case.

### CORE-005 — Evaluation responses are not bound to the evaluation's class, year, or statements

Severity: HIGH
Category: Evaluation data integrity / partial writes
Location: `api/learner/submit_evaluation.php:12-49`; `api/learner/get_evaluations.php:28-42`; schema evaluation tables

What is wrong:

The submit endpoint accepts any `eval_id`, obtains the first current-year class for the caller, and writes a response without checking the evaluation's class, active state, year, or its statement set. It inserts arbitrary posted statement IDs individually, with no transaction.

Evidence:

- `submit_evaluation.php:19-25` obtains caller class, not target evaluation class.
- Lines 27-37 never query `teacher_evaluations`; lines 42-47 insert posted answers without evaluation-scoped validation or a transaction.
- `get_evaluations.php:28-42` selects by class but omits `te.academic_year_id`, a different visibility rule.
- Foreign keys only prove a statement exists; they do not prove it belongs to this response's evaluation.

Why it matters:

Feedback has meaning only for the requested class/year/question set. Incomplete or mismatched anonymous feedback still looks valid.

Potential production impact:

Responses can be attributed to the wrong class, include another evaluation's statements, or remain partially written after an error.

Confidence: Confirmed.

Recommended direction:

Validate evaluation, current membership, active year, and all statement IDs server-side; write the response and answers atomically.

### CORE-006 — Teachers can establish or use arbitrary class relationships for core content

Severity: HIGH
Category: Teacher/class relationship integrity
Location: `api/teacher/save_teacher_subject.php:23-62`; `api/teacher/save_subject.php:18-38`; `api/teacher/create_assignment.php:55-151`; `api/teacher/create_evaluation.php:46-67`; `api/teacher/add_manual_quiz.php:32-64`

What is wrong:

Teacher content creation verifies role and sometimes class existence, but not an existing teacher-class assignment. Both teacher-subject endpoints allow any teacher to create a relation to any existing class; assignments/evaluations then notify that class's learners.

Evidence:

- `save_teacher_subject.php:29-58` checks only class existence then writes the teacher/class relation.
- `save_subject.php:27-34` upserts the same relation with no class/assignment validation.
- Assignment, evaluation, and manual quiz creation accept the chosen class without a teacher-class relationship query.

Why it matters:

The application treats `teacher_subjects` as the relationship, but does not protect its write boundary.

Potential production impact:

Unrelated learners can receive content and notifications that later become indistinguishable from authorised academic records.

Confidence: Confirmed; the exact allocation policy requires product confirmation.

Recommended direction:

Use one authoritative teacher-class assignment check for every class-scoped teacher write.

## Medium Findings

### CORE-007 — The database does not guarantee one current academic year

Severity: MEDIUM
Category: Academic-year integrity
Location: schema `academic_years`; widespread `is_current = 1 LIMIT 1` queries

What is wrong:

The schema indexes `(school_id, is_current)` but does not enforce one current year. Most endpoints read an unordered `LIMIT 1` row.

Evidence:

- The schema has `UNIQUE (school_id, name)` and a non-unique `idx_current (school_id, is_current)`.
- Examples: `submit_quiz.php:20-25`, `api/learner/get_quizzes.php:15-20`, and `api/teacher/get_quiz_grades.php:32-36`.

Why it matters:

Year selection controls enrolment/content visibility. Multiple current rows cause silent, arbitrary context.

Potential production impact:

An incomplete or concurrent rollover can place requests in different academic years without an error.

Confidence: Confirmed for the missing guarantee; live duplicate-current data requires database verification.

Recommended direction:

Enforce and transactionally maintain one current year, with a shared resolver that fails clearly if violated.

### CORE-008 — Result academic-year attribution conflicts with quiz year

Severity: MEDIUM
Category: Historical record integrity
Location: `submit_quiz.php:20-46,328-337`; `api/teacher/save_marks.php:51-56`; school report endpoints

What is wrong:

Normal submission validates quiz-year membership but writes the globally current year into the result. Manual insert omits the result year. School reports often filter `qr.academic_year_id`; learner grade views commonly filter `q.academic_year_id`.

Evidence:

- `submit_quiz.php:42-46` resolves quiz year, while line 336 writes `$current_academic_year_id`.
- `save_marks.php:51-56` omits `academic_year_id`.
- `api/school/get_overview.php`, `get_learners.php`, `get_teachers.php`, and teacher analytics query the result-year field.

Why it matters:

One result has two competing academic identities.

Potential production impact:

After rollover or manual entry, a result can be omitted from or included in the wrong year report.

Confidence: Strong evidence; whether historical quizzes remain open needs runtime/product verification.

Recommended direction:

Define the canonical result year, persist it consistently, and reconcile historical rows before enforcement.

### CORE-009 — Assignment submissions permit duplicates under concurrent requests

Severity: MEDIUM
Category: Concurrency / submission identity
Location: `submit_assignment.php:69-76,136-154`; schema `submissions`

What is wrong:

The first-submission path uses check-then-insert with no transaction and no unique `(assignment_id, student_email)` constraint.

Evidence:

- Lines 69-76 read first; lines 136-154 update-or-insert.
- The supplied schema gives `submissions` only a primary key on `id`.

Why it matters:

The UI assumes one submission. Concurrent first requests can both insert and future `fetch_assoc()` calls choose an arbitrary row.

Potential production impact:

Retries/double-clicks can create duplicate work records and orphan upload files.

Confidence: Confirmed.

Recommended direction:

Enforce submission identity in the database and use an atomic write; define whether resubmission replaces, versions, or rejects.

### CORE-010 — Teacher analytics can multiply results through historical enrolment rows

Severity: MEDIUM
Category: Reporting correctness
Location: `api/teacher/get_analytics_data.php:48-193`

What is wrong:

Analytics filters quizzes to the current year, but joins `class_students` by learner and class without `cs.academic_year_id`. Re-enrolment in the same class across years duplicates joined result rows.

Evidence:

- The average query at lines 48-60 joins `cs` only on learner/class; the gender, top-five, term, and median queries repeat the pattern.
- The schema retains enrolment year and supplied sample data includes memberships in different years.

Why it matters:

This changes aggregate weights, not merely display duplication.

Potential production impact:

Class averages, rankings, distributions, and medians can be skewed as history grows.

Confidence: Confirmed for the omitted condition; live impact size needs database verification.

Recommended direction:

Join membership using the quiz academic year and add a historical re-enrolment test fixture.

## Low Findings

### CORE-011 — Core workflow rules have no clear owner and are difficult to test consistently

Severity: LOW
Category: Architecture / maintainability
Location: Quiz, mark, enrolment, assignment, and evaluation endpoints listed above

What is wrong:

The documented controller-to-service-to-repository direction is not yet present in the highest-risk workflows. Scoring, manual marking, enrolment, and academic-year lookups each have duplicate implementations with different semantics.

Evidence:

- `ARCHITECTURE_STANDARDS.md` calls for thin controllers and services for business validation/state transitions.
- CORE-001 through CORE-004 demonstrate materially divergent implementations.
- No focused automated tests for the reviewed core race/identity scenarios were found.

Why it matters:

This is not a framework concern. A business-rule change must be manually located and reproduced across several scripts.

Potential production impact:

Fixes can correct one entry point but leave another writer capable of reintroducing incompatible data.

Confidence: Confirmed.

Recommended direction:

Incrementally centralize quiz scoring/results, enrolment, assignment submission, and evaluation submission behind small use-case services; add behavior tests first.

## Systemic Patterns

1. **Identity varies by workflow.** Normal results use attempts; manual marks use learner-plus-quiz. Enrolment is treated as both one and many current classes.
2. **Business rules are duplicated.** Quiz scoring, manual marks, and class joining each have independent paths with different validation.
3. **Academic-year context is ad hoc.** Unordered current-year reads, quiz-year/result-year differences, and yearless membership joins produce inconsistent history.
4. **Database constraints do not protect core assumptions.** Result/answer constraints are strong, but current year, enrolment, and assignment submission uniqueness are not enforced.
5. **Transactions do not follow domain atomicity.** Quiz submission is transactional; evaluation response/answers and assignment submission/file state are not.

## Areas That Are Working Well

- `submit_quiz.php:79-110` starts a transaction and locks the in-progress attempt before result creation.
- The schema has unique result-per-attempt, answer-per-attempt/question, and open-grade-per-attempt/question constraints.
- Quiz submission verifies learner membership against quiz class and year server-side (`submit_quiz.php:63-77`).
- `api/teacher/edit_quiz.php:189-275` detects attempts and prevents question-payload changes after attempts exist.
- Quiz/evaluation deletion paths block deletion after dependent learner work exists.
- Most inspected user-controlled SQL uses prepared statements.

## Findings Requiring Further Verification

- Intended learner class cardinality: one homeroom, many subject classes, or separate concepts.
- Live rollover procedure and whether more than one current academic year exists.
- Whether historical quizzes can stay open across rollover.
- Live volume of duplicate submissions, nullable/manual results, and historical enrolment skew.
- File/database compensation policy before adding submission uniqueness.

## Overall Assessment

iSkool has a workable direct PHP/MySQLi base, but core correctness depends too much on endpoint-local checks. The immediate risks are incorrect academic records through mismatched identities, duplicate logic, and inadequate transaction/constraint boundaries. The existing incremental architecture direction is appropriate if applied first to these high-value workflows rather than as a rewrite.

## Recommended Priorities

1. Correct and test central quiz score recalculation for every question type.
2. Freeze/manual-mark identity, validation, and transaction policy.
3. Replace fixed assignment time with server-time plus late policy, and make submission identity atomic.
4. Resolve/enforce enrolment cardinality.
5. Make evaluation response validation class/year/statement scoped and atomic.
6. Enforce a single current-year invariant and make reporting joins year-aware.
7. Add integration tests for retries, duplicate submits, multiple attempts, rollover, and historical enrolment.

## Conclusion

The audit confirms high-priority correctness risks that can affect marks, submissions, enrolments, feedback, and reporting while appearing successful. Verify the high findings and plan remediation before wider refactoring.
