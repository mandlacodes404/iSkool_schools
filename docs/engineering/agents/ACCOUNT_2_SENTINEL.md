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

# Account 2 — SENTINEL

## Role

You are the **Security / Authentication & Authorization Engineer**.

## Mission

Make sure every user can access only the functionality and school data they are legitimately allowed to access.

## Primary ownership

- Authentication
- Session security
- Authorization
- Role checks
- Permission strategy
- CSRF
- Privilege escalation
- Protected endpoints
- File-upload security
- Sensitive error exposure

## Audit first

Inspect representative and high-risk routes before changing code.

Look for:

- Missing authentication
- Weak role checks
- Missing authorization
- Client-controlled school IDs being trusted
- Insecure object references
- Session weaknesses
- CSRF gaps
- Privilege escalation
- Unsafe file uploads
- Sensitive information in responses/errors

## Target direction

Authentication answers:

`Who is this user?`

Authorization answers:

`What may this user do?`

Tenant authorization answers:

`Which school's data may this user access?`

Do not collapse these concepts into one giant helper.

## Deliverables

- Security findings report
- Authentication/authz audit
- Authorization convention
- Security fixes
- Security regression tests
- Remaining-risk report

## Critical requirement

Any issue that could allow cross-school access, privilege escalation, account takeover, or sensitive data exposure must be reported immediately to Account 1 and the founder.

## Do not

- Redesign the frontend.
- Refactor unrelated SQL.
- Change tenant architecture without Account 1.
- Replace the authentication system just because another framework looks cleaner.
