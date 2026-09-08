# Service Worker & Offline Support Plan — iSkool PWA

## Goal

Offline-first behavior appropriate for a school app: the shell and recently viewed content load instantly regardless of connection quality, writes (submissions, grades) queue and sync when connectivity returns, and nothing that matters (submissions, grading, auth) is ever served from a stale cache.

---

## Caching strategies — what each one means

A service worker intercepts every request the app makes (API calls, images, CSS/JS files) and decides how to respond. The "strategy" is that decision logic.

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

| Content | Strategy | Why |
|---|---|---|
| App shell (JS, CSS, logo, fonts) | Cache-first | Never changes between deploys (versioned filenames) |
| Dashboard, course/lesson lists | Stale-while-revalidate | Instant open, quietly self-updates |
| Grades, announcements | Network-first | Freshness matters; offline fallback still available |
| Assignment submission, login, exam answers | Network-only + background sync queue | Must never fake-succeed against cached/stale data |

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

## Build order

1. Register a basic service worker + cache the app shell (cache-first) — biggest immediate win, foundation for everything else.
2. Add stale-while-revalidate for dashboard/content routes.
3. Add network-first for grades/announcements.
4. Explicitly mark submission/login/exam endpoints as network-only.
5. Add IndexedDB queue + Background Sync for offline submissions.
6. Add the update-available prompt so future deploys don't get silently stuck.

## Open items / files still needed to finalize

- Confirm which endpoints are submission/grading-related so they can be explicitly excluded from any caching (network-only)
- Confirm current service worker file, if one already exists, so this can extend rather than replace it
- `dashboard.php` / relevant frontend routes — to map actual URL patterns to the strategy table above
