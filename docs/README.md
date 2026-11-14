# Documentation index

Every document in this repository is listed here once. If you add a document, add a line here in the same pull request. How documentation is written and kept current is set out in [DOCUMENTATION_PLAYBOOK.md](DOCUMENTATION_PLAYBOOK.md).

Purposes below are taken from each file's own title. Status lines (current, historical, superseded) for the plans and proposals are still to be added (playbook, section 4).

## Start here

| Document | What it is for |
|----------|----------------|
| [../README.md](../README.md) | Front door: what iSkool is, where things live, setup, deployment |
| [../ARCHITECTURE.md](../ARCHITECTURE.md) | How the system works inside: requests, auth, database, API, frontend, deployment (being split into `docs/architecture/`) |
| [../AGENTS.md](../AGENTS.md) | Working rules for AI agents, with links to the facts |
| [DOCUMENTATION_PLAYBOOK.md](DOCUMENTATION_PLAYBOOK.md) | How documentation is written, checked and kept current; the work plan |
| [../CHANGELOG.md](../CHANGELOG.md) | Release record, newest first, with an Unreleased section |
| [../SECURITY.md](../SECURITY.md) | Security document |
| [../superadmin/README.md](../superadmin/README.md) | Setup guide for the superadmin panel |

## Engineering process and audits

| Document | What it is for |
|----------|----------------|
| [engineering/ARCHITECTURE_STANDARDS.md](engineering/ARCHITECTURE_STANDARDS.md) | Architecture and engineering standards for the hardening project |
| [engineering/MASTER_DELEGATION.md](engineering/MASTER_DELEGATION.md) | The engineering hardening project: objectives and how the work is split |
| [engineering/agents/ACCOUNT_1_ARCHITECT.md](engineering/agents/ACCOUNT_1_ARCHITECT.md), [ACCOUNT_2_SENTINEL.md](engineering/agents/ACCOUNT_2_SENTINEL.md), [ACCOUNT_3_TENANT.md](engineering/agents/ACCOUNT_3_TENANT.md), [ACCOUNT_4_API.md](engineering/agents/ACCOUNT_4_API.md), [ACCOUNT_5_CORE.md](engineering/agents/ACCOUNT_5_CORE.md), [ACCOUNT_6_FORGE.md](engineering/agents/ACCOUNT_6_FORGE.md), [ACCOUNT_7_OPS.md](engineering/agents/ACCOUNT_7_OPS.md) | One brief per engineering account in the hardening project |
| [engineering/audits/API_AUDIT.md](engineering/audits/API_AUDIT.md) | API security audit |
| [security/SENTINEL_AUDIT.md](security/SENTINEL_AUDIT.md) | Security audit |
| [../INDEPENDENT_CORE_AUDIT.md](../INDEPENDENT_CORE_AUDIT.md) | Independent audit of core architecture and data access |
| [../EMAIL_FIX.md](../EMAIL_FIX.md) | Email-system investigation handoff |

## Plans, specs and proposals

| Document | What it is for |
|----------|----------------|
| [parent-app-v1-spec.md](parent-app-v1-spec.md) | Parent app version 1 spec |
| [parent-mobile-app-ux-review.md](parent-mobile-app-ux-review.md) | Parent mobile app UI/UX review |
| [teacher_desktop_light_mode_proposal.md](teacher_desktop_light_mode_proposal.md) | Teacher desktop light mode implementation proposal |
| [../DESKTOP_UI_VISION.md](../DESKTOP_UI_VISION.md) | Desktop UI vision |
| [../specs/TEACHER_MOBILE_APP.md](../specs/TEACHER_MOBILE_APP.md) | Teacher mobile app "detail page" project notes |
| [../specs/performance-plan.md](../specs/performance-plan.md) | Performance plan for the PWA |
| [../specs/service-worker-plan.md](../specs/service-worker-plan.md) | Service worker and offline support plan |

## Manuals for teachers

| Document | What it is for |
|----------|----------------|
| [manuals/teachers/TEACHER_QUIZ_DOCUMENTATION_INDEX.md](manuals/teachers/TEACHER_QUIZ_DOCUMENTATION_INDEX.md) | Index of the teacher quiz documentation |
| [manuals/teachers/TEACHER_QUIZ_MANUAL.md](manuals/teachers/TEACHER_QUIZ_MANUAL.md) | The teacher's complete quiz manual |
| [manuals/teachers/TEACHER_QUIZ_CHEATSHEET.md](manuals/teachers/TEACHER_QUIZ_CHEATSHEET.md) | Quick reference for the quiz creator |
| [manuals/teachers/TEACHER_QUIZ_DECISION_GUIDE.md](manuals/teachers/TEACHER_QUIZ_DECISION_GUIDE.md) | Visual guide to choosing quiz settings |
| [manuals/teachers/TEACHER_QUIZ_FAQ.md](manuals/teachers/TEACHER_QUIZ_FAQ.md) | Quiz system FAQs and troubleshooting |
| [manuals/teachers/QUIZ_DOCUMENTATION_SUMMARY.md](manuals/teachers/QUIZ_DOCUMENTATION_SUMMARY.md) | Summary of the quiz documentation set |

## Not written yet

The architecture, module, API reference and operations pages are planned in the playbook (sections 4 and 7). They will be listed here as they are added.

Last verified: 2026-11-14 against `259ff6c`
