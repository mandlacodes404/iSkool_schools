# Service Worker & Offline Support Plan — iSkool PWA

## Goal

Offline-first behavior appropriate for a school app: the shell and recently viewed content load instantly regardless of connection quality, writes (submissions, grades) queue and sync when connectivity returns, and nothing that matters (submissions, grading, auth) is ever served from a stale cache.

---

## Caching strategies — what each one means

A service worker intercepts every request the app makes (API calls, images, CSS/JS files) and decides how to respond. The "strategy" is that decision logic.

## Open Items — next work

### Offline splash screen on the root document (`/`) — FIXED

**The problem:** the root document (`/`, which serves the splash/login shell) was being routed through the same `isAuthenticationRoute` bucket as actual login/session actions (`/index.php`, `/dashboard.php`, `/auth/*`) — all sent straight to `fetch(request)` with no cache fallback. This is correct for login *actions* (a failed login POST should fail loudly, not silently serve cached HTML), but wrong for the shell *document itself*. Result: a learner opening the app with zero network connection got the browser's own offline error, even though `/` was already sitting in `APP_SHELL` and precached at install — the routing logic just never gave it a chance to be read from cache.

**The fix:** `/` now has its own navigation-request handler (`isShellNavigationRoute`), separate from `isAuthenticationRoute`. It tries the network first — so a signed-in learner still gets the live, correct server-side redirect to their dashboard — and only falls back to the precached shell if there's no network at all. `/index.php` as a direct path, `/dashboard.php`, and `/auth/*` are untouched and remain strictly network-only, as before.

**Cache versions bumped** (`iskool-static-v1` → `v2`, and `content`/`network` caches to match) so browsers treat this as a new service worker and re-run the install step against the updated logic, rather than potentially continuing to serve the old cached behavior. This is the same mechanism the "Update handling" section below already documents — this deploy is a live test of that update-prompt flow.

**Known, expected limitation (not a bug):** the cached fallback for `/` reflects whatever the shell looked like the first time it was precached — typically the unauthenticated splash/login shell. If a learner is logged in and goes offline before ever having the app cached while authenticated, the offline fallback will briefly show the splash shell rather than their dashboard, until any local/client-side session check resolves. This is consistent with how every other cache-first fallback in this plan behaves, and is preferable to a blank browser error.

**Still to test:** confirm this in the actual browser with network fully disabled (not just throttled) — open once online to populate the cache, then go offline, force-close, and reopen.

---

### Warn before logout discards pending offline work — NOT YET IMPLEMENTED

The worker correctly clears queued writes on logout, and discards a queue when its stored learner identity does not match the currently signed-in learner. There is **no learner-visible warning yet**, so an unsent assignment submission or quiz-progress save could currently disappear without a warning.

The agreed next implementation is:

1. When online, try to sync pending work before allowing logout.
2. When offline, warn that logging out will discard unsent work and require explicit confirmation.
3. If a queue is discarded because the identity check fails, show a "some work wasn't saved" notice on the next login.

Do not treat this item as complete until those learner-facing messages and logout controls exist.

---

## Implementation status

The caching and offline-write routing below is **IMPLEMENTED**. [`/service-worker.js`](../service-worker.js) is the source of truth for the current request-path routing and queue eligibility; this document records the intended policy and implementation context.

Important implementation detail: the authenticated `learner_dashboard.php` document is **network-first**, not stale-while-revalidate, because it contains learner-specific HTML. Its static shell assets are cache-first, while the Home data APIs use stale-while-revalidate.

---

### Cache-first
Check cache. If present, serve instantly — never touch the network. Only fetch from network if missing, then save it for next time.

```
Request → in cache? → YES: serve from cache (instant)
                    → NO:  fetch from network → save to cache → serve
```
**Use for:** things that never change once shipped — logo, fonts, versioned/hashed CSS/JS bundles.
**Risk:** if a cached file *can* change and its filename isn't versioned, users get stuck on a stale version indefinitely.

### Network-first
Try the network first. If it responds, use it and update the cache. Only fall back to cache if the network fails.

```
Request → try network → SUCCESS: serve fresh, update cache
                       → FAIL:    serve from cache (fallback)
```
**Use for:** content that changes and where freshness matters more than speed — newly posted grades, announcements.
**Risk:** slower than cache-first when online, since every load waits on the network.

### Stale-while-revalidate
Serve from cache immediately (even if possibly outdated), then fetch fresh in the background and update the cache for next time.

```
Request → serve from cache immediately (instant)
        → simultaneously fetch from network in background
        → update cache silently when it arrives
```
**Use for:** the "most content" default — dashboard, lesson lists, class rosters. Fast open, self-corrects shortly after.
**Risk:** user may briefly see data that's a few seconds/minutes stale.

### Network-only
No caching. Always hit the network. Fails outright if offline.

```
Request → fetch from network → SUCCESS: serve it
                              → FAIL:    error / offline message
```
**Use for:** anything where a cached or stale response would be actively wrong — assignment submissions, exam answers, login, payments.

---

## Strategy map for iSkool

**Status: IMPLEMENTED.** [`/service-worker.js`](../service-worker.js) is the source of truth for current route-level routing.

| Content | Strategy | Why |
|---|---|---|
| App shell (JS, CSS, logo, fonts) | Cache-first | Never changes between deploys (versioned filenames) |
| Dashboard, course/lesson lists | Stale-while-revalidate | Instant open, quietly self-updates |
| Grades, announcements | Network-first | Freshness matters; offline fallback still available |
| Assignment submission, login, exam answers | Network-only + background sync queue | Must never fake-succeed against cached/stale data |

---

Current route-level decisions, including exceptions and the authoritative path lists, live in [`/service-worker.js`](../service-worker.js). Notable implemented exceptions are:

- Learner Home data, My Class metadata, resources, and syllabus use stale-while-revalidate.
- The authenticated dashboard document, quizzes, assignments, grades, announcements, evaluations, discussions, calendar, and profile reads use network-first as appropriate.
- Reports, account/profile changes, class joining, typing, push subscription, logout, and auth routes are network-only.
- Resource files and local static assets use cache-first.

---

## Handling submissions offline (the important LMS-specific case)

A learner submitting an assignment with no signal should not see a hard failure. Instead:

1. Submission attempt goes out network-only.
2. If it fails due to no connection, queue the payload in **IndexedDB** (not just the Cache API — IndexedDB supports structured, queryable data).
3. UI shows a clear "will send when back online" state rather than an error.
4. Register a **Background Sync** event; when connectivity returns, the service worker automatically retries the queued submission.
5. Once synced, update the UI (remove the "pending" indicator) and optionally notify the user it went through.

Same pattern applies to a teacher grading offline — grade entries queue locally and sync when back online.

---

### Implemented queue scope and security rules

The worker stores eligible failed writes in IndexedDB and retries them through Background Sync; it also retries when the learner page comes back online. Currently queue-eligible learner writes are quiz progress/final submission, assignment submission, evaluation submission, discussion creation, and discussion replies.

Discussion reports are deliberately **network-only and not queued** because moderation timing matters. Logout, profile changes/uploads, parent links, class joining, typing indicators, push subscriptions, and authentication changes are also never queued.

Queued requests are bound to the learner identity captured at queue time. Before replay, the worker calls `api/learner/get_session_identity.php` and discards a queued record if its stored learner does not match the currently signed-in learner. Queues are also cleared on normal logout. These controls prevent a shared device from replaying one learner's submission under another learner's account.

The current clients show an immediate queued/offline state for supported fetch submissions; the remaining learner-visible logout/discard warning is the open item above.

---

## App shell architecture

The shell = whatever is the same on every screen (nav bar, tab bar, layout skeleton). This gets cache-first treatment so that on a repeat open:

1. Service worker serves the shell instantly from cache — nav/tab bar/layout appear in milliseconds, before any network request resolves.
2. Actual content (class list, today's schedule, grades) streams in after via stale-while-revalidate, so something meaningful is visible immediately even if it turns out to be a moment out of date.

This is also what feeds into the "why does my app reload every time" issue — combined with the `index.php` redirect fix (see `performance-plan.md`), a returning logged-in user should go from tapping the icon to seeing their dashboard shell essentially instantly, with content filling in a beat later.

---

## Update handling (don't skip this)

Service workers cache aggressively by design, which means a shipped update can silently never reach users who keep the app open/cached. Needed:

- On new deploy, the service worker should detect the update is available.
- Show a simple in-app prompt: "Update available — tap to refresh," rather than forcing it or leaving them stuck on old code indefinitely.

---

## Build order — implementation progress

1. Register a basic service worker + cache the app shell (cache-first) — biggest immediate win, foundation for everything else.
2. Add stale-while-revalidate for dashboard/content routes.
3. Add network-first for grades/announcements.
4. Explicitly mark submission/login/exam endpoints as network-only.
5. Add IndexedDB queue + Background Sync for offline submissions.
6. Add the update-available prompt so future deploys don't get silently stuck.

## Bugs found and fixed during implementation

### Missing learner manual fallback

`learner_dashboard.php` and the legacy learner-manual loader referenced `learner_manual.php`, which no longer exists outside archived code. The current manual content is [`/partials/manual.html`](../partials/manual.html), and all active fallback references now use that path.

### Missing discussion-report endpoint

`assets/js/learner/discussions.js` posted reports to `view_discussion.php`, which only existed under `old_files/` and was unsuitable for the current AJAX flow. It now posts to the new [`/api/learner/submit_discussion_report.php`](../api/learner/submit_discussion_report.php), which uses the current session, CSRF, class/year/reply authorization, prepared statements, and duplicate-report handling.

---

## Files touched in this implementation

- `service-worker.js` *(further updated after initial implementation — see "Offline splash screen on the root document" above; cache versions bumped v1 → v2)*
- `learner_dashboard.php`
- `assets/js/learner/assignments.js`
- `assets/js/learner/discussions.js`
- `assets/js/learner/evaluations.js`
- `assets/js/learner/learner_manual.js`
- `take_quiz.php`
- `api/learner/get_session_identity.php`
- `api/learner/submit_discussion_report.php`

## Superseded discovery items

- Confirm which endpoints are submission/grading-related so they can be explicitly excluded from any caching (network-only)
- Confirm current service worker file, if one already exists, so this can extend rather than replace it
- `dashboard.php` / relevant frontend routes — to map actual URL patterns to the strategy table above