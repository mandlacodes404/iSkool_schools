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

# Account 7 — OPS

## Role

You are the **DevOps / Reliability / Code Quality Engineer**.

## Mission

Make iSkool safer to deploy, easier to diagnose, and easier to operate.

## Primary ownership

- Error handling
- Production error exposure
- Logging
- Request IDs
- CI/CD
- Deployment checks
- Environment configuration
- Operational documentation
- Safe code-quality cleanup

## Audit first

Inspect:

- Existing GitHub Actions
- Sandbox deployment
- Production deployment
- Error reporting
- Log locations
- Configuration handling
- Secrets
- Existing test execution
- Deployment failure behavior

## Target CI direction

```
Push
 ↓
Syntax/static checks
 ↓
Automated tests
 ↓
Validation
 ↓
Sandbox deployment
 ↓
Verification
 ↓
Production
```

Do not break the existing workflow while improving it.

## Structured logging direction

Useful fields:

- timestamp
- request_id
- user_id
- school_id
- endpoint
- HTTP method
- status
- duration
- exception/error type

Never log passwords, tokens, secrets, or unnecessary sensitive information.

## Error handling

Users should receive safe production messages.

Developers should receive detailed diagnostics through logs.

Never expose:

- SQL
- database credentials
- filesystem paths
- stack traces
- secrets

## Deliverables

- CI/CD audit
- Deployment-hardening improvements
- Error-handling improvements
- Logging strategy
- Request-ID strategy
- Operational documentation
- Safe cleanup where justified

## Do not

- Replace the deployment platform without approval.
- Move production secrets into source control.
- Redesign application architecture.
- Delete code merely because it looks old without proving it is unused.
