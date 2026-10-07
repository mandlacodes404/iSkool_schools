# iSkool Architecture & Engineering Standards

Repository: mandlacodes404/iSkool_schools
Project: iSkool Schools
Document owner: Account 1 — Architect
Audience: All 7 AI engineering accounts
Status: Engineering standard

## 1. Purpose

This document defines the technical conventions all engineering accounts must follow. The architecture evolves incrementally; it is not replaced wholesale.

## 2. Core principles

1. Preserve working behavior.
2. Security before cleanliness.
3. Explicit is better than implicit.
4. Business logic should have a clear home.
5. Refactor toward consistency, not perfection.

## 3. Target architecture

```
HTTP Request
     ↓
Authentication
     ↓
Tenant Context
     ↓
Authorization
     ↓
Controller / API
     ↓
Service / Use Case
     ↓
Repository / Data Access
     ↓
Database
```

This is the direction for new code and refactored code. Existing files do not need immediate wholesale conversion.

## 4. Authentication

Authentication answers: Who is this user?

Authentication and authorization are separate concepts. Respect the existing iSkool authentication system; do not introduce a new authentication framework merely for preferred syntax.

## 5. Authorization

Authorization answers: What is this authenticated user allowed to do?

Long-term direction:
```php
authorize('grades.view');
authorize('grades.edit');
authorize('quiz.create');
authorize('quiz.submit');
```

Role checks may remain during migration, but authorization should increasingly use explicit capabilities.

## 6. Roles vs permissions

Roles include learner, teacher, parent, school_admin, and admin.

Permissions should describe actions, for example grades.view, grades.edit, students.view, students.edit, quiz.create, quiz.submit, and reports.view.

Do not introduce a complicated RBAC framework unless the product requires it.

## 7. Tenant context

Tenant isolation is a critical security requirement. A tenant represents a school.

Protected tenant operations should establish reliable school context before accessing tenant-specific data.

```
Request
   ↓
Identify school
   ↓
Validate school
   ↓
Establish tenant context
   ↓
Authenticate user
   ↓
Verify relationship to tenant
   ↓
Perform operation
```

## 8. Tenant access

A client-provided school ID is input, not proof of authorization.

Normal school users should operate through trusted server-side tenant context. Super-admin cross-school access must be an explicit privilege.

## 9. Database access

Target:
```
Service → Repository → Database
```

Do not allow business workflows to accumulate inside dashboards or API scripts.

## 10. Repositories

Repositories represent persistence operations. Examples include UserRepository, SchoolRepository, ClassRepository, AssignmentRepository, QuizRepository, and GradeRepository.

Repositories should not contain large business workflows.

## 11. Services

Services contain application/business logic. Examples include QuizService, AssignmentService, GradeService, ClassService, EnrollmentService, and NotificationService.

Example:
```
Controller → QuizService.submitAttempt() → QuizRepository → Database
```

Services may handle business-rule validation, attempt limits, grading rules, state transitions, and related operations.

## 12. Controllers and API endpoints

Controllers should be thin:
1. Receive request.
2. Validate request shape.
3. Authenticate/authorize.
4. Call service.
5. Return response.

Do not place entire business workflows inside endpoints.

## 13. API response standard

New APIs should follow a consistent JSON structure.

Success:
```json
{
  "success": true,
  "data": {}
}
```

Error:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request."
  }
}
```

Do not change existing APIs blindly if it would break consumers.

## 14. HTTP status codes

Preferred direction:
- 200 OK
- 201 Created
- 204 No Content
- 400 Bad Request
- 401 Unauthorized
- 403 Forbidden
- 404 Not Found
- 409 Conflict
- 422 Unprocessable Entity
- 500 Internal Server Error

Compatibility with existing clients must be considered during migration.

## 15. Validation

Separate request validation from business validation.

Request validation checks shape and type. Business validation checks whether the requested operation is actually allowed.

Request validation belongs near the request boundary. Business validation generally belongs in the service layer.

## 16. Error handling

Never expose SQL statements, database credentials, filesystem paths, stack traces, or internal exception details to production users.

Users receive safe messages. Developers receive detailed diagnostics through logs.

## 17. Error codes

Where useful, use stable codes such as AUTH_REQUIRED, ACCESS_DENIED, VALIDATION_ERROR, TENANT_NOT_FOUND, RESOURCE_NOT_FOUND, RESOURCE_CONFLICT, and INTERNAL_ERROR.

## 18. Request IDs

Important requests should eventually have a request ID that can connect a support report to server-side logs.

## 19. Logging

Useful fields include timestamp, request_id, user_id, school_id, route, method, status, duration, and exception.

Never log passwords, session tokens, CSRF tokens, API secrets, database passwords, or unnecessary sensitive personal information.

## 20. CSRF

State-changing browser requests must maintain appropriate CSRF protection. Preserve and improve the existing CSRF infrastructure rather than replacing it unnecessarily.

Different authentication mechanisms can have different CSRF requirements. Understand the authentication model before changing it.

## 21. Database queries

Prepared statements remain mandatory for user-controlled values. Do not replace safe parameterized queries with string interpolation.

## 22. Transactions

Use transactions when multiple operations must succeed or fail together. Do not add transactions blindly around every query.

## 23. File uploads

Treat uploaded files as untrusted input. Validate file type, size, filename, extension, storage location, and access permissions.

School/user files must also respect tenant access controls.

## 24. Sensitive configuration

Never commit passwords, API keys, private keys, deployment credentials, Web Push secrets, or other secrets to Git.

Preserve existing configuration mechanisms until a deliberate migration is planned.

## 25. PHP standards

iSkool targets PHP 8.2+. New code must remain compatible with the supported production runtime.

Prefer modern PHP when it improves clarity. Do not modernize legacy code solely for aesthetics.

## 26. Type safety

Where useful in new/refactored code, use parameter types, return types, strict comparisons, explicit nullable types, and small value objects.

Do not type every legacy file in one operation.

## 27. Frontend code

Vanilla JavaScript, Vanilla CSS, and the existing PWA remain valid technologies. Do not introduce React merely because it is popular.

## 28. Dashboard files

Large dashboards should gradually become thinner:
```
Dashboard
 ├── authentication
 ├── controller logic
 ├── service calls
 └── view
```

Do not split files into dozens of tiny classes merely to make them shorter.

## 29. Duplication

Two similar code blocks may have different business meanings. Extract shared logic only when the behavior is genuinely the same, changes for the same reason, and the abstraction remains understandable.

## 30. Naming

Use names that describe business concepts.

Prefer getActiveAcademicYear(), authorizeGradeEdit(), and QuizSubmissionService over vague names such as getData(), check(), and HelperManager.

## 31. Testing standard

Tests should focus on behavior.

Important categories: authentication, authorization, tenant isolation, business rules, API behavior, database behavior, and regression scenarios.

Prioritize things that would seriously damage the product if broken.

## 32. Tenant isolation testing

At minimum:
```
School A user → School A data = allowed
School A user → School B data = denied
```

Test read access and write/update/delete access. Test realistic attack paths, not only obvious school-ID checks.

## 33. Authorization testing

Protected operations should test:
- Unauthenticated user → denied
- Wrong role → denied
- Correct role → allowed
- Correct role + wrong school → denied
- Correct role + correct school → allowed
- Super-admin → explicitly allowed where appropriate

## 34. Regression testing

Before changing a critical feature, identify who uses it, which APIs call it, which tables it touches, and which frontend screens depend on it.

Do not refactor based solely on the file being edited.

## 35. CI/CD

Long-term direction:
```
Git push → checks → tests → validation → sandbox → verification → production
```

Improve the existing deployment system incrementally.

## 36. Code review checklist

Architecture: Is the change in the correct layer? Is complexity justified?

Security: Can another school access this? Can another role access this? Is input trusted incorrectly? Is sensitive information exposed?

Database: Are queries parameterized? Is tenant context enforced? Are transactions needed?

API: Are status codes appropriate? Is the response consistent? Could existing clients break?

Testing: Is behavior tested? Are security boundaries tested? Does the existing suite still pass?

Scope: Were unrelated files changed? Did the change become unnecessarily large?

## 37. Architectural escalation

Ask Account 1 for review when changing tenant architecture, authentication, authorization, database architecture, API conventions, production deployment, major abstractions, external dependencies, or database schema.

## 38. When not to escalate

Agents should independently decide trivial implementation details such as variable names, local helper extraction, obvious validation improvements, test naming, and small internal refactors.

Account 1 should not become a bottleneck for every line of code.

## 39. Architectural decision records

For significant decisions use:
```
ADR-XXX

Title:
Status: Proposed / Accepted / Rejected / Superseded
Context:
Decision:
Reason:
Consequences:
Affected areas:
Owner:
Date:
```

## 40. AI agent behavior

Every AI account must behave like an engineer working inside an existing system.

```
READ → UNDERSTAND → PLAN → IMPLEMENT → TEST → REVIEW
```

Not: see problem → rewrite everything.

If an agent does not understand why an implementation exists, investigate before replacing it. Unknown does not mean wrong.

## 41. Change size

Prefer small, reviewable changes.

Good sequence:
```
Centralize school-context resolution
Migrate 5 endpoints
Migrate 10 more endpoints
```

Bad:
```
Rewrite all 100+ endpoints into a new architecture
```

## 42. Golden rule

> Every change should make it easier for the next engineer to answer: Where does this code belong?

If the answer becomes less obvious, reconsider the change.

## 43. Future direction

The cleaned architecture should allow future systems such as Laura to consume reliable domain-level data and services.

Laura should not need to scrape arbitrary PHP pages or depend on undocumented internal behavior.

## 44. Final engineering standard

Optimize for:
```
SECURITY → CORRECTNESS → RELIABILITY → MAINTAINABILITY → PERFORMANCE → CONVENIENCE
```

Not for perfect architecture, more abstractions, more frameworks, or more complexity.

The objective is to build a codebase that Mandla and future iSkool engineers can understand, modify, test, and trust.

## Account 1 authority

Account 1 maintains consistency with this document. Architectural conflicts must be reviewed by Account 1 before implementation.

If a decision materially affects the product, security, database, or production environment, the founder has final authority.

**This document is a living engineering standard.**