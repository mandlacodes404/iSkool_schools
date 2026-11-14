# iSkool Documentation Playbook

Status: Draft for owner review
Owner: Mandla Mahlangu
Created: 2026-11-14 · Baseline: `dev` @ `95facd1`
Audience: the owner, and every person or AI agent who writes or changes documentation in this repository.

---

## 1. Purpose

iSkool has real documentation, but it is spread across too many files and parts of it no longer match the code. This playbook says how we fix that, and how we keep it fixed, in a way that any agent can pick up a piece of the work and finish it without asking what "good" looks like.

It is a working agreement, not a wish list. If you are about to write or change documentation here, read sections 3, 5 and 6 first.

---

## 2. Where we start (baseline)

Checked against the code on 2026-11-14. These numbers are a snapshot: recompute them with the commands in section 5 before relying on them.

| Documents say | The code says |
|---|---|
| README: version 1.1.2 | `CHANGELOG.md`: latest release v1.3.4 (2026-11-09), plus an Unreleased section |
| README and AGENTS.md: 76 API endpoints | 99 PHP files under `api/` (some may be helpers; confirm before quoting a number) |
| README and AGENTS.md: `migrations/` is empty | It holds 2 SQL files |
| README and AGENTS.md: only 1 test exists | `tests/` has 43 files |
| ARCHITECTURE.md: no shared auth guard, checks are copied into every file | 98 of the 99 `api/` files reference `auth/session_guard.php`; `auth/` also has `csrf_helper.php` and `rate_limit_functions.php` |
| README setup starts from `config.php` | `config.php` is in `.gitignore`; only `.env.example` is tracked, so a fresh clone cannot follow the steps (how a new developer creates `config.php` is undocumented) |
| AGENTS.md: "no local development environment" | README describes a local setup |
| ARCHITECTURE.md: "Last updated May 2026" | The parent app, light/dark theme, clean URLs and many other features landed after that |
| (code) | About half of the `api/` files have a header comment |

Two things follow. First, the docs under-report progress (tests, auth guard), which makes the project look weaker than it is. Second, three files (README, ARCHITECTURE, AGENTS) each describe structure and conventions, which is exactly how drift starts.

---

## 3. Principles

1. **One home per fact.** Each fact is written in one place. Everywhere else links to it. If you catch yourself copying a paragraph, link instead.
2. **Verify, never recall.** Do not write from memory, and do not copy a claim from another document. Open the code. Every factual claim about the code names the path it came from; every count names the command that produced it (section 5). If you cannot verify something, write `Unverified:` in front of it and add it to the open questions in section 9.
3. **Don't write facts that rot.** No version numbers, endpoint counts or full file trees in the README. Describe how to find the answer instead.
4. **Describe what is, mark what should be.** Current behaviour goes under "How it works". Weaknesses and plans go under "Known gaps". Never document intended behaviour as if it exists.
5. **Small pages.** One question per page. Module pages stay under about 150 lines. If a page needs more, split it.
6. **Docs ship with code.** A pull request that changes behaviour updates the page that describes it, in the same pull request.
7. **Comments never change behaviour.** A pull request that only adds code headers must show, in its diff, only comment lines (see section 7, Phase 3).
8. **Protect the repository.** No secrets, credentials, real learner data or personal contact details in any document or example; use placeholders. Do not edit off-limits paths: `old_files/`, `_archive/`, `react_test_manual/`, `vendor/`, `.git/`, `php_errors.log`. This repository can be publicly readable, so specific vulnerabilities belong in `docs/internal/`, and moving or removing them is the owner's call.

---

## 4. Target structure

```
README.md                    short front door: what it is, how to run it, where docs live
ARCHITECTURE.md              short overview (about 40 lines) that links into docs/architecture/
AGENTS.md                    short pointer for AI agents: rules plus links, no duplicated facts
CHANGELOG.md                 unchanged: release record
SECURITY.md                  unchanged

docs/
  README.md                  index: every doc listed once with a one-line purpose
  DOCUMENTATION_PLAYBOOK.md  this file
  architecture/
    overview.md              system shape, roles, request flow
    multi-tenancy.md         subdomain to database routing, session keys
    auth-and-sessions.md     login, remember-me, session guard, CSRF, rate limiting
    frontend.md              dashboards, JS modules, shared containers, phone vs desktop, light/dark theme
    database.md              tables by domain, relationships, schema drift, migrations
    uploads.md               where files go, validation rules
    notifications.md         push and email, and when each is used
    decisions/               one short file per decision (0001-subdomain-per-school.md, ...)
  modules/                   one page per feature (template in 6.3)
  api/
    README.md                response conventions, error shapes, how the reference is generated
    endpoints.md             generated: one row per endpoint
  ops/
    environments.md          dev, sandbox, production
    env-vars.md              every .env key: what it does, never the value
    deploy.md                how a merge becomes a deploy
    rollback.md
    migrations.md            how schema changes are applied to every school database
    backups.md
  manuals/                   user-facing manuals (existing, unchanged)
  internal/                  engineering process, audits, AI delegation
                             (moved from docs/engineering and docs/security)
```

Existing files that stay where they are but get a `Status:` line at the top (current, historical, or superseded): `specs/*`, `docs/parent-app-v1-spec.md`, `docs/parent-mobile-app-ux-review.md`, `docs/teacher_desktop_light_mode_proposal.md`.

---

## 5. How to verify facts (recipes)

Run from the repository root. If a recipe and a document disagree, the recipe wins and the document gets fixed.

```bash
# Current commit you are verifying against
git rev-parse --short HEAD

# Latest released version
grep -m1 -E '^## \[v' CHANGELOG.md

# API files, and how many do NOT reference the shared session guard
git ls-files 'api/*.php' | wc -l
grep -L session_guard $(git ls-files 'api/*.php')

# Tests and migrations
git ls-files tests | wc -l
ls migrations

# API files that already have a header comment (first 15 lines)
for f in $(git ls-files 'api/*.php'); do head -15 "$f" | grep -qE '^\s*(/\*\*|/\*|//)' && echo "$f"; done

# Application code only (skip vendored and archived code)
git ls-files | grep -Ev '^(vendor|_archive|old_files|react_test_manual|superadmin/phpmailer)/'

# Which tables a file touches (starting point; read the file to confirm)
grep -noE '(FROM|JOIN|INTO|UPDATE)\s+`?[a-z_]+`?' path/to/file.php
```

For anything these cannot answer (deployment behaviour, server settings), read `.github/workflows/` or ask the owner. Do not guess.

---

## 6. Templates

### 6.1 API endpoint header (PHP)

Matches the style already used in `api/learner/create_parent_invite.php`. Goes at the top of every file in `api/` and every PHP page, directly after `<?php`.

```php
/**
 * api/<role>/<file>.php
 * <One sentence: what it does> (<METHOD>, <roles allowed>).
 * Input:  <fields and types>
 * Output: <JSON shape, HTML fragment, or redirect>
 * Tables: read: <a, b> | write: <c>
 * Notes:  <side effects (push/email), CSRF, rate limit, anything surprising>
 */
```

### 6.2 JavaScript module header

```js
/* assets/js/<role>/<file>.js
 * Screen:    <what page or feature it drives>
 * Endpoints: <api files it calls>
 * Globals:   <window.* it reads or sets; shared containers it touches>
 * Notes:     <phone/desktop split; which PHP file holds its ?v= cache number>
 */
```

Adding or editing a header does not change behaviour, so do not bump the `?v=` cache numbers for a comment-only change.

### 6.3 Module page (`docs/modules/<feature>.md`)

```markdown
# <Feature>

## Purpose
Two sentences.

## Who uses it
Roles: learner / teacher / school admin / parent / superadmin.

## Files
| File | Its part in the feature |
|---|---|

## Endpoints
| Endpoint | Method | Does |
|---|---|---|

## Tables
Table names and how they relate, one line each.

## How it works
Numbered steps for the main flow, with file names.

## Known gaps
Things that are inconsistent, missing or risky today.

## Tests
Which files in `tests/` cover it.

Last verified: YYYY-MM-DD against `<short sha>`
```

### 6.4 Decision record (`docs/architecture/decisions/NNNN-title.md`)

```markdown
# NNNN. Title
Status: accepted | superseded by NNNN | proposed
Date: YYYY-MM-DD

## Context
What problem, what constraints.

## Decision
What we chose, in one paragraph.

## Consequences
What gets easier, what gets harder.
```

Decisions are recorded as they are discovered, written from the code and the changelog. If the reason for a past choice is not written down anywhere, record the decision and put `Reason: Unverified, ask the owner` rather than inventing one.

### 6.5 Footer on every page

```
Last verified: YYYY-MM-DD against <short sha>
```

---

## 7. Work plan

Each phase is its own pull request against `dev`. Branch names: `docs/<area>`. Commit style follows the README: `docs: ...`. The owner merges; agents do not.

| Phase | What | Files it owns | Needs |
|---|---|---|---|
| 0 | This playbook | `docs/DOCUMENTATION_PLAYBOOK.md`, one line in `AGENTS.md` | owner review |
| 1 | **Truth pass.** Correct every false fact in section 2. Shrink `AGENTS.md` to rules plus links. Create `docs/README.md`. Cut `ARCHITECTURE.md` to a short overview that links onward | `README.md`, `ARCHITECTURE.md`, `AGENTS.md`, `docs/README.md` | owner answers in section 9 |
| 2 | **Architecture and ops pages**, built from the existing ARCHITECTURE.md text and the workflows, every claim re-verified. Architecture and ops can go to two agents in parallel | `docs/architecture/*`, `docs/ops/*` | Phase 1 merged |
| 3 | **Code headers**, comments only, in batches by folder: `api/learner`, `api/teacher`, `api/school`, `api/` root, `auth/`, `assets/js/learner`, `assets/js/teacher`, `assets/js/school`. One folder per pull request | the folder's own files | Phase 1 merged |
| 4 | **Generated API reference.** A script in `tools/` reads the headers and writes `docs/api/endpoints.md` | `tools/gen_api_docs.php`, `docs/api/*` | Phase 3 done for the folders it covers |
| 5 | **Module pages**, one per feature (list below), written in batches or when a module is next touched | `docs/modules/*` | Phase 2 |
| 6 | **Guardrails.** Pull request template with a "docs updated?" checkbox. A PHPUnit test that fails when a file in `docs/` is missing from `docs/README.md` or a relative link does not resolve | `.github/pull_request_template.md`, `tests/DocsIndexTest.php` | Phases 1 to 2 |
| 7 | **Housekeeping for the owner to decide**, not for agents to do: duplicate public pages (`about`/`aboutt`, `contact`/`contacts`, `laura`/`lauraa`, policy and POPIA pairs), committed test uploads and logs, a stray `.lnk` file, and whether `docs/internal/` stays in a repository that can be public | n/a | owner |

Module pages to write (Phase 5): authentication and sessions, role dashboards, quizzes and grading, assignments, announcements, resources, discussions, evaluations, grades and progress report, syllabus, academic calendar, parent app (start from `docs/parent-app-v1-spec.md`), PWA and push notifications, email, superadmin school onboarding.

### Working in parallel

- Claim an area by naming it in your pull request title and ticking it in section 10. Do not edit files outside your area.
- Two agents never write the same file. If a page needs input from another area, link to it and note the gap.
- Phase 3 pull requests are comments-only. Before pushing, confirm that every changed line in `git diff` is a comment, run `php -l` on each changed PHP file, `node --check` on each changed JS file, and `vendor/bin/phpunit tests/`.
- Add a short line under `[Unreleased]` in `CHANGELOG.md` for each pull request, in the existing style.

---

## 8. Definition of done

A document is done when all of these are true:

- [ ] Every factual claim was checked against code or a section 5 recipe in this session.
- [ ] It follows its template in section 6, including the `Last verified` line.
- [ ] It is listed in `docs/README.md`.
- [ ] Every relative link resolves.
- [ ] It contains no secrets, no real personal data and no `.env` values.
- [ ] Anything unverifiable is marked `Unverified:` and listed in section 9.
- [ ] It repeats nothing that has a home elsewhere; it links.

---

## 9. Open questions for the owner

Agents add to this list instead of guessing. The owner answers in the pull request or here.

1. `config.php` is gitignored and only `.env.example` is tracked. How should a new developer or agent create a working `config.php` locally? Is there a local environment at all, or only the dev server?
2. README says `config.php` holds plaintext credentials, while AGENTS.md says it loads from `.env`. Which is true today?
3. Should `docs/internal/` (audits, AI delegation notes) live in this repository while it can be publicly read?
4. Are the `docs/engineering/agents/ACCOUNT_*` files still in use, or historical?
5. Is `CHANGELOG.md` (top release heading) the single source for the current version?

---

## 10. Progress

Update this table in the pull request that completes the work.

- [x] Phase 0: playbook
- [ ] Phase 1: truth pass
- [ ] Phase 2: architecture pages
- [ ] Phase 2: ops pages
- [ ] Phase 3: headers for `api/learner`
- [ ] Phase 3: headers for `api/teacher`
- [ ] Phase 3: headers for `api/school`
- [ ] Phase 3: headers for `api/` root
- [ ] Phase 3: headers for `auth/`
- [ ] Phase 3: headers for `assets/js/*`
- [ ] Phase 4: generated API reference
- [ ] Phase 5: module pages
- [ ] Phase 6: guardrails
- [ ] Phase 7: housekeeping decisions

Last verified: 2026-11-14 against `95facd1`
