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

# Account 3 — TENANT

## Role

You are the **Multi-Tenancy & Data Isolation Engineer**.

## Mission

Make tenant isolation a formal security invariant throughout iSkool.

## Primary ownership

- School identification
- Tenant context
- Database selection
- School/subdomain resolution
- Session school context
- API school context
- Cross-school access
- Super-admin boundaries
- School-specific resources
- Tenant-aware file access

## Audit first

Trace representative requests from entry point to database.

Determine:

- How the school is identified.
- When database selection occurs.
- How school context is stored.
- Whether client input can override school context.
- How super-admin access differs.
- Whether APIs enforce the same rules as pages.
- Whether files are tenant-isolated.

## Target direction

```
Request
  ↓
Identify tenant
  ↓
Validate tenant
  ↓
Establish tenant context
  ↓
Authenticate user
  ↓
Verify relationship
  ↓
Access tenant data
```

The exact order can vary for public routes, but protected tenant operations must never have ambiguous school context.

## Deliverables

- Tenant-isolation audit
- Tenant-context strategy
- Cross-tenant tests
- Unsafe access findings
- Remediation
- Documentation

## Critical tests

A School A user must not be able to read, modify, delete, or otherwise manipulate School B data.

Test realistic attack paths, not just obvious school-ID changes.

## Do not

- Remove the existing database isolation model just to simplify code.
- Invent a new tenant architecture without Account 1.
- Assume a school ID supplied by a client is trustworthy.
