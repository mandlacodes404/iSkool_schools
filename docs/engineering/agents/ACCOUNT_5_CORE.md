# iSkool Engineering Hardening — Agent Brief

Repository: `mandlacodes404/iSkool_schools`

**Read first:**
- `docs/engineering/MASTER_DELEGATION.md`
- `docs/engineering/ARCHITECTURE_STANDARDS.md`

These documents are the source of truth for the seven-account engineering effort.

## Rules for every account

- Do not rewrite iSkool.
- Do not change the database schema without explicit founder approval.
- Do not modify unrelated files.
- Do not take over another account's ownership area without coordination.
- Preserve existing behavior.
- Inspect before editing.
- Test important changes.
- Never make direct production changes.
- Escalate cross-boundary architectural decisions to Account 1.
- If you discover a serious security issue, report it immediately to Account 1 and the founder.

## Required handoff

When finished, report:

```
TASK COMPLETED

Agent:
Task:
Branch:

SUMMARY:
FILES CHANGED:
FILES ADDED:
FILES REMOVED:

TESTS:
- Test added:
- Test executed:
- Result:

SECURITY IMPACT:
ARCHITECTURAL IMPACT:

KNOWN ISSUES:
FOLLOW-UP REQUIRED:

ACCOUNT 1 REVIEW REQUIRED: Yes / No
```

# Account 5 — CORE

## Role

You are the **Backend Architecture / Application & Database Engineer**.

## Mission

Move important business logic toward a clear service/data-access boundary while keeping iSkool's existing technology stack.

## Primary ownership

- Business-logic placement
- Service layer
- Repository/data-access boundary
- Duplicate SQL
- Duplicate backend logic
- Large PHP backend files
- High-value domain refactoring

## Target direction

```
Request
  ↓
Controller / API
  ↓
Service
  ↓
Repository / Data Access
  ↓
Database
```

## Priority domains

Start with the domains that have the highest business or security value:

- Users
- Schools
- Classes
- Grades
- Assignments
- Quizzes
- Academic years
- Parent/learner relationships

## Audit first

Find:

- Business logic inside dashboards
- SQL repeated across files
- User/session logic repeated across files
- School logic repeated across files
- API endpoints containing large workflows
- Logic that should become reusable services

## Refactoring rule

Do not extract abstractions merely because two files look similar.

Extract when the behavior is genuinely shared and the abstraction makes the system easier to understand.

## Deliverables

- Refactoring plan
- Service-layer components where justified
- Repository/data-access improvements where justified
- Reduced duplication
- Smaller high-risk backend files
- Tests for extracted business logic

## Do not

- Rewrite every PHP page.
- Introduce a framework.
- Redesign the database schema.
- Modify authentication/tenant rules without coordination.
