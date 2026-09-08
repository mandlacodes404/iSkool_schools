# Performance Plan — iSkool PWA

## Goal

Make the app feel instant on open: fast first load for new visits, near-instant load on repeat visits, and no unnecessary re-render of the login/splash screen for users who are already authenticated.

---

## 1. Stop rendering the login page for logged-in users

**Problem today:** `index.php` runs `check_remember_me.php` (which can restore a valid session from the cookie), but then renders the *entire* login page anyway — splash screen, login form, register form, animated preview panel, Google Fonts, Font Awesome — regardless of auth state. A logged-in user pays the full weight of that page every time the app opens.

**Fix:** redirect immediately, before any HTML is built, the moment we know the session is valid.

```php
require_once __DIR__ . '/auth/session_guard.php';
require_once 'config.php';
require_once __DIR__ . '/includes/app_version.php';
require_once 'check_remember_me.php';

// Add this immediately after check_remember_me.php runs
if (isset($_SESSION['email']) && isset($_SESSION['role'])) {
    header('Location: /dashboard.php');
    exit;
}
```

**Impact:** logged-in users get a one-line HTTP redirect instead of downloading/parsing ~1,300 lines of login page markup, fonts, and animation code. This is the single biggest win available and should be done first.

**Still to confirm:** whether `dashboard.php` (or equivalent) has its own splash/loading pattern on top of this — that's a separate thing to check once we can see that file.

---

## 2. Fast first load (cold start / first-ever visit)

This is what Core Web Vitals actually measure, and what determines how long a brand-new visitor stares at a blank or loading screen.

- **Don't block first paint on the whole app bundle.** Split code so the login screen only loads what the login screen needs — not the gradebook, quiz engine, or admin panel JS.
- **Preload critical resources.** `<link rel="preload">` for fonts and critical CSS so the browser fetches them early rather than discovering them late in the render process. *(Already partially in place — `index.php` preloads dashboard CSS for logged-in users while the splash plays.)*
- **Compress responses.** Enable Brotli or gzip on the server for JS, CSS, and JSON/API responses.
- **Optimize images.** Serve WebP/AVIF, sized correctly for where they're displayed (don't ship a 2000px image to render at 200px). Lazy-load anything below the fold.

**Target metrics (Core Web Vitals):**
| Metric | What it measures | Target |
|---|---|---|
| LCP (Largest Contentful Paint) | Time until the biggest visible element renders | < 2.5s |
| INP (Interaction to Next Paint) | Responsiveness when tapped/clicked | < 200ms |
| CLS (Cumulative Layout Shift) | Visual stability — does content jump as it loads | as close to 0 as possible |

---

## 3. Instant repeat loads (app shell architecture)

The pattern that makes reopening the app feel native rather than like reloading a website:

1. **Shell renders from cache immediately** — nav bar, tab bar, layout skeleton, logo — all served by the service worker with zero network wait.
2. **Actual content streams in after** — today's assignments, grades, announcements — fetched fresh (or served stale-then-refreshed; see the service worker plan for strategy details).

This depends on the service worker cache-first strategy for shell assets (CSS/JS/logo/fonts) — see `service-worker-plan.md`.

**Result:** on a warm reopen, the user sees the app's layout in milliseconds, with content filling in a beat later — instead of a blank screen or spinner while everything downloads from scratch.

---

## 4. Local auth check before any network round-trip

**Problem:** if "am I logged in" is answered by waiting on an API call, the splash/loading screen has to sit there for however long that round-trip takes (200ms–several seconds depending on connection).

**Fix:** check auth state locally first (session cookie / stored token), route immediately based on that, and verify with the server *after* the user is already looking at their dashboard — only bouncing them to login if that background check actually fails.

```
App opens
  → Read local session/token — instant, no network
  → Valid?
       YES → go straight to dashboard shell (from cache)
             → verify with server in background
             → if server says session is dead → then redirect to login
       NO  → go to login
```

This is the same principle as the `index.php` redirect above, applied to the client side for cases where the shell is served from cache rather than fresh from PHP.

---

## 5. Code-split by route

Framework-level (if/when the frontend is restructured into a JS framework, or via lazy-loaded script bundles in the current setup):

- Teacher opens app → only dashboard + nav code loads
- Teacher taps "Gradebook" → gradebook code loads on demand, not before
- Admin settings, grading-rubric editor, etc. — never loaded until actually opened

Reduces the size of what has to be downloaded before the app is usable at all, which directly improves LCP on first load.

---

## Priority order

1. **Redirect logged-in users before rendering the login page** — biggest win, smallest effort, purely server-side.
2. **Service worker app shell caching** — see `service-worker-plan.md`.
3. **Local auth check on repeat opens** — removes network-wait from the splash screen.
4. **Cold-start performance polish** — compression, image optimization, preloading.
5. **Code-splitting** — longer-term, more effort, best done alongside any frontend restructuring.

## Open items / files still needed to finalize

- `dashboard.php` (or equivalent) — to check whether it has its own loading/splash pattern
- `session_guard.php` — to see what auth logic already runs first on every request
- Truncated middle section of `index.php` — to see existing client-side redirect logic, if any
