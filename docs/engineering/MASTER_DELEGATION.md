# iSkool Engineering Hardening Project

Repository: mandlacodes404/iSkool_schools
Project: iSkool Schools LMS
Owner: Mandla Mahlangu
Engineering team: 7 AI accounts + founder
Project lead: Account 1 — Architect

## 1. Purpose

This project improves the security, maintainability, reliability, and architecture of the existing iSkool codebase.

We are NOT rewriting iSkool. We are hardening and organizing the existing working product while preserving functionality.

## 2. Objectives

### P0 — Protect the business
- Guarantee tenant/data isolation.
- Audit authentication and authorization.
- Audit CSRF and security boundaries.
- Audit file-upload/security boundaries.
- Prevent production errors from exposing sensitive information.
- Establish reliable backup/recovery practices.

### P1 — Architecture
- Introduce a practical application/service layer.
- Centralize tenant/school context.
- Centralize authorization.
- Standardize API responses.
- Establish a cleaner database-access boundary.

### P2 — Technical debt
- Consolidate duplicated school logic.
- Consolidate duplicated user/session logic.
- Break up excessively large PHP files.
- Centralize error handling.
- Standardize validation.
- Remove dead/obsolete code where safe.
- Establish naming conventions.

### P3 — Engineering maturity
- Increase PHPUnit coverage.
- Add integration tests.
- Add tenant-isolation tests.
- Improve CI/CD checks.
- Introduce structured logging.
- Improve monitoring/diagnostics.
- Test database backup/recovery procedures.

## 3. Non-negotiable rules

1. Do not rewrite iSkool or migrate frameworks unless explicitly authorized.
2. Preserve existing functionality.
3. No unrelated changes.
4. Do not change the database schema without explicit approval.
5. Do not modify another agent's ownership area without coordination.
6. Security issues must be reported immediately.
7. Do not introduce unnecessary abstractions.
8. Prefer incremental refactoring.
9. Important behavioral and security changes require tests.
10. Never experiment directly in production.

## 4. Agent roster

### Account 1 — ARCHITECT
Senior engineer / technical lead.

Owns architecture, coordination, engineering standards, integration, architectural reviews, dependency resolution, and final technical review.

First assignment:
- Study the repository.
- Establish architecture conventions.
- Define tenant-context direction.
- Define authorization conventions.
- Define API response conventions.
- Define service/repository conventions.
- Define testing expectations.
- Define boundaries for every agent.

### Account 2 — SENTINEL
Security / authentication / authorization engineer.

Owns authentication, sessions, authorization, CSRF, password handling, protected endpoints, privilege escalation, file-upload security, sensitive endpoint exposure, and error leakage.

Deliverables: security audit, vulnerability list, authorization strategy, approved security fixes, security tests, remaining-risk report.

### Account 3 — TENANT
Multi-tenancy and data-isolation engineer.

Owns school identification, database selection, school context, hostname/subdomain resolution, API school resolution, cross-school access, super-admin boundaries, school-specific resources, and tenant-related file access.

Deliverables: tenant audit, tenant-context strategy, cross-tenant tests, unsafe access findings, approved remediation, documentation.

### Account 4 — API
API engineering specialist.

Owns the 100+ endpoint audit, authentication/authorization consistency, validation, HTTP status codes, JSON response consistency, tenant context, error handling, and API tests.

Preferred status direction: 200 success, 201 created, 400 bad request, 401 unauthenticated, 403 forbidden, 404 not found, 409 conflict, 422 validation failure, 500 server error.

Preferred response direction:
```json
{
  "success": true,
  "data": {}
}
```

Error direction:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request."
  }
}
```

Do not break existing consumers during migration.

### Account 5 — CORE
Backend architecture / application and database engineer.

Owns business-logic cleanup, duplicated SQL, service-layer introduction, repository/data-access boundaries, large dashboard refactoring, and high-value domain refactoring.

Target:
```
Request → Controller/API → Service → Repository/Data Access → Database
```

Priority domains: users, schools, classes, grades, assignments, quizzes, academic years, parent/learner relationships.

### Account 6 — FORGE
QA / testing engineer.

Owns PHPUnit, integration tests, authentication tests, authorization tests, tenant-isolation tests, business-logic tests, API tests, and regression protection.

Prioritize authentication, authorization, tenant isolation, quiz submission, assignment submission, grade calculations, parent/learner relationships, academic years, class membership, and notifications.

### Account 7 — OPS
DevOps / reliability / code-quality engineer.

Owns error handling, production error exposure, logging, request IDs, CI/CD, deployment checks, environment configuration, safe cleanup, and operational documentation.

Preferred CI direction:
```
Push → checks → tests → validation → sandbox → verification → production
```

Do not break the existing deployment process.

## 5. Ownership matrix

| Area | Account |
|---|---:|
| Architecture | 1 |
| Security | 2 |
| Authentication | 2 |
| Authorization | 2 |
| Multi-tenancy | 3 |
| School isolation | 3 |
| API conventions | 4 |
| API endpoint audit | 4 |
| Services | 5 |
| Repositories / DB boundary | 5 |
| Business logic refactoring | 5 |
| Testing | 6 |
| Regression testing | 6 |
| CI testing | 6 + 7 |
| Logging | 7 |
| Error handling | 7 |
| Deployment | 7 |
| Final architectural review | 1 |
| Final product approval | Founder |

## 6. Dependencies

Phase 1: Account 1 establishes architecture, tenant, authorization, API, service/repository, and testing conventions.

Phase 2: Accounts 2–7 audit and implement their assigned work in parallel where safe.

Agents must communicate dependencies and must not invent conflicting architecture independently.

## 7. Branching

Use the existing workflow:
```
feature branch → dev → sandbox → main → production
```

Suggested agent branches:
- agent/security-hardening
- agent/tenant-isolation
- agent/api-standardization
- agent/service-layer
- agent/testing
- agent/ops
- agent/architecture

## 8. Merge rules

Before merging:
1. Review changed files.
2. Run relevant tests.
3. Check for unintended changes.
4. Confirm no unrelated files changed.
5. Confirm existing functionality remains intact.
6. Document architectural changes.
7. Notify Account 1.
8. Account 1 reviews architectural changes.
9. Founder has final authority over production merges.

## 9. Handoff protocol

Every completed task must report:
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
SECURITY IMPACT: None / Low / Medium / High
ARCHITECTURAL IMPACT: None / Low / Medium / High
KNOWN ISSUES:
FOLLOW-UP REQUIRED:
ACCOUNT 1 REVIEW REQUIRED: Yes / No
```

## 10. Out of scope unless explicitly authorized

- Full framework migration
- Full frontend rewrite
- React migration
- Node.js migration
- Microservices
- Kubernetes
- Complete database redesign
- Rewriting all 100+ APIs
- Rewriting every PHP page
- Replacing the PWA
- UI redesign
- Rebuilding iSkool from scratch

## 11. Success criteria

Security: users cannot access data outside their authorized school or role.
Architecture: new business logic has a clear home.
APIs: behavior is predictable and consistent.
Multi-tenancy: tenant context is explicit and tested.
Testing: important business and security behavior has automated protection.
Operations: production errors are safer and failures easier to diagnose.
Development: future engineers and AI agents can understand where new functionality belongs.

Most importantly: iSkool should still be recognizably the same product.

## 12. Founder authority

The founder has final authority over product decisions, architectural disagreements, scope changes, database changes, production deployments, major refactors, technology migrations, and security-risk acceptance.

AI accounts are engineering collaborators. They do not independently redefine the product.

## 13. First instruction to every agent

Before changing code:
1. Read this document.
2. Read existing repository documentation.
3. Inspect the relevant code.
4. Understand existing behavior.
5. Identify dependencies.
6. Do not assume unfamiliar code is wrong.
7. Create an audit/findings report before a large refactor.
8. Stay within assigned ownership.
9. Preserve working functionality.
10. Escalate cross-boundary architectural decisions.

**Do not start by rewriting code. Start by understanding the system.**

## Final principle

> We are not trying to make iSkool look like a textbook architecture.
>
> We are trying to make iSkool strong enough that the next 10× growth in users, schools, developers, and features does not require us to rebuild it.