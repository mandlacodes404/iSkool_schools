# Teacher desktop light mode — implementation proposal

## Decision

Add a per-teacher **Appearance** preference to the existing desktop Settings modal. Version one offers `Dark` (the existing default) and `Light`. It is deliberately a **desktop/tablet feature only**: at widths of **769px and above** the selected preference is applied; at `768px` and below, the current mobile dark palette is always used and no appearance control is rendered.

The preference should be saved per teacher in that school's tenant database, rather than only in `localStorage`. This means the choice follows a teacher to another desktop browser and remains available after browser storage is cleared. `localStorage` may be used only as an optional optimistic cache, never as the source of truth.

## Current implementation slice

The first UI slice now implements the Appearance pane and applies Light mode only to the desktop sidebar/menu and Teacher Home. Until the tenant database migration and API in this proposal are deployed, the setting is stored in browser storage with a key unique to the signed-in teacher and school. It survives a refresh on that browser but does not yet follow the teacher to another browser or device.

All other teacher pages retain their existing dark content surface. The desktop sidebar follows the selected light preference, and mobile remains unchanged.

## What the teacher side looks like today

The teacher dashboard already provides the correct integration points:

- `teacher_dashboard.php` loads all teacher CSS and JavaScript, performs the authenticated teacher lookup, and is the earliest safe place to apply a saved theme before the first dashboard paint.
- `assets/js/teacher/teacher_desktop_settings.js` builds the desktop/tablet Settings modal. Its rail currently contains Profile, Password, and Notifications, making **Appearance** a natural fourth item.
- `assets/css/teacher/teacher_desktop_settings.css` owns the desktop Settings look and is already isolated with `@media (min-width: 769px)`.
- `assets/css/teacher/teacher_desktop_menu.css` introduces useful shared desktop menu variables (`--dm-bg`, `--dm-page`, `--dm-card`, text and state colours). Several newer screens consume these.
- The desktop/mobile boundary is consistently `768px`/`769px`, so we should not introduce a second breakpoint.

The implementation must also account for older, page-specific colour systems. There are about 1,900 direct colour literals across the teacher CSS/JS, notably the injected style blocks in `quizzes.js` and `analytics.js`, plus CSS for assignments, grades, evaluations, resources, SBO, announcements, calendar and dashboard views. A single last-minute CSS override would leave parts of those pages dark or produce unreadable text. The safe approach is token migration, screen by screen.

## Recommended architecture

### 1. Store a small, extensible preference record

Create one new table in every tenant database. `users.id` is already present, so use it rather than an email address.

```sql
CREATE TABLE user_preferences (
    user_id INT NOT NULL,
    desktop_theme ENUM('dark', 'light') NOT NULL DEFAULT 'dark',
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id)
);
```

Do not add a foreign key until the tenant schemas have been checked for consistent user-id types and existing foreign-key conventions. The primary key gives one preference record per teacher. The migration must be run on dev first and then every production tenant database; there is no migration framework in this project.

`dark` is the default so all existing teachers retain exactly the present appearance and the dashboard works if no preference row exists.

### 2. Read and apply it before the page paints

In `teacher_dashboard.php`, fetch `desktop_theme` with the existing authenticated teacher lookup (or a prepared `LEFT JOIN` to `user_preferences`). Validate the value against `dark` and `light`, then render it on the root element:

```html
<html data-teacher-theme="light">
```

The server-rendered attribute is important: waiting for JavaScript or `localStorage` causes a dark flash before the light stylesheet wins. On a phone, the attribute may still be present but has no visual effect because every light selector is scoped to `@media (min-width: 769px)`.

Keep browser/PWA `theme-color` handling separate for the first release. It is mobile-focused today and should remain on its existing dark values, since mobile does not support the preference.

### 3. Establish one semantic desktop token contract

Add a dedicated stylesheet, for example `assets/css/teacher/teacher_desktop_theme.css`, loaded **after every teacher page stylesheet and after the desktop menu/settings stylesheets**. Define neutral, semantic values rather than component-specific colour names.

```css
@media (min-width: 769px) {
    html {
        --t-theme-page: #151515;
        --t-theme-sidebar: #111111;
        --t-theme-surface: #1a1a19;
        --t-theme-surface-raised: #212121;
        --t-theme-border: #262625;
        --t-theme-text: #f0efec;
        --t-theme-text-muted: #9b9c92;
        --t-theme-hover: rgba(255, 255, 255, .055);
        --t-theme-selected: #383838;
        --t-theme-accent: #4fd1c5;
        --t-theme-danger: #f4776f;
        --t-theme-success: #22c55e;
        --t-theme-warning: #f3a93c;
    }

    html[data-teacher-theme="light"] {
        --t-theme-page: #f7f8fa;
        --t-theme-sidebar: #ffffff;
        --t-theme-surface: #ffffff;
        --t-theme-surface-raised: #f1f3f5;
        --t-theme-border: #d9dee5;
        --t-theme-text: #18212b;
        --t-theme-text-muted: #5f6b78;
        --t-theme-hover: rgba(24, 33, 43, .055);
        --t-theme-selected: #e4e9ee;
        --t-theme-accent: #087f78;
        --t-theme-danger: #c53b35;
        --t-theme-success: #16803c;
        --t-theme-warning: #a85d00;
    }
}
```

The light palette above is a starting palette to be checked for WCAG contrast, especially muted labels, disabled controls, chart text and coloured status badges. Preserve semantic status colours, but use their darker accessible variants on light surfaces.

Map the current desktop-menu tokens to these shared tokens (`--dm-bg`, `--dm-page`, `--dm-card`, `--dm-text`, etc.) rather than maintaining two competing token systems. Page-local variables such as `--q-*`, `--an-*`, `--as-dp-*`, `--gr-dp-*`, `--ev-dp-*`, `--rs-f-*` and `--sbo-dp-*` should then resolve from the shared semantic tokens.

### 4. Make Appearance a Settings pane

Extend `teacher_desktop_settings.js` with an `appearance` entry in its existing settings navigation and search metadata. The pane should contain:

- Heading: **Appearance**
- One row: **Desktop theme** with the description “Choose the colour scheme used on desktop and tablet. Mobile keeps its current appearance.”
- An accessible two-option segmented control or radio group: **Dark** and **Light**
- A compact saving indicator and an inline failure message; do not claim the choice saved until the server confirms it.

On selection:

1. Update `document.documentElement.dataset.teacherTheme` immediately, for a responsive preview.
2. Send a same-origin `POST` to a new teacher endpoint with the CSRF token.
3. Retain the change on success.
4. On error, restore the previously confirmed value and show a clear retry message.

The control is not added to `teacher_mobile_settings.js`. The desktop settings script already exits to the mobile implementation at phone widths, which preserves this boundary. A resize from desktop to mobile should naturally reveal the unchanged mobile palette because theme CSS does not apply below 769px.

### 5. Use a narrowly scoped API

Add `api/teacher/update_preferences.php` (or `api/teacher/update_desktop_theme.php` if no other preferences are imminent). It must follow the existing API rules:

- JSON content type and teacher session/role check.
- CSRF validation for the state-changing request.
- Allow-list `desktop_theme` to exactly `dark` or `light`.
- Obtain the user ID from the authenticated session/email on the server; never accept a user ID from the browser.
- Prepared statements only.
- `INSERT ... ON DUPLICATE KEY UPDATE` into `user_preferences`.
- Return `{"success":true,"data":{"desktop_theme":"light"}}` only after the write succeeds.

Because this preference is personal, it must not be stored in a school-wide settings table or broadcast to other teachers.

## Delivery order

1. **Inventory and token foundation:** add `teacher_desktop_theme.css`, map the base shell, sidebar, desktop menu, Settings modal, global forms, dialogs and loaders. Keep dark visually identical first.
2. **Settings and persistence:** deploy the database migration to dev, add the read/write API, server-side hydration, and the Appearance pane. Verify dark default and cross-browser persistence.
3. **Migrate screens in batches:** home/dashboard; quizzes; assignments; announcements; evaluations; grades; resources; SBO; analytics; calendar. Replace direct background/text/border literals with semantic variables. Refactor style strings injected by `quizzes.js` and `analytics.js`; their values cannot be fully fixed by an external stylesheet.
4. **Charts and non-CSS surfaces:** update Chart.js legend/tick/grid options when theme changes, and destroy/recreate or update existing charts after a preference change. Check SVGs, canvas elements, inline `style` attributes, browser-native inputs and `color-scheme` declarations.
5. **Regression and rollout:** test on the dev server at 768px, 769px and common desktop widths; verify all teacher pages, modal states, empty/error/loading states, focus rings, keyboard navigation and page reloads. Test both themes before merging `dev` to `main`.

## Acceptance criteria

- A teacher can set Dark or Light from desktop Settings and sees the result immediately.
- The selection survives a refresh, a new desktop session and another desktop browser for the same teacher and school.
- A teacher with no preference record sees the current dark desktop exactly as before.
- At `768px` and below, the present mobile palette and Settings UI are unchanged, regardless of saved desktop choice.
- At `769px` and above, every teacher page named above has readable text, borders, inputs, overlays, charts and status states in both themes.
- No theme flash occurs on a normal dashboard load.
- Invalid, unauthenticated and CSRF-invalid preference requests are rejected without changing data.

## Explicit non-goals for version one

- No mobile light mode or mobile colour control.
- No OS “system”/automatic theme option yet; adding it later is safe as a third validated value once the two fixed themes are complete.
- No changes to learner, school-admin or superadmin themes.
- No global rewrite of every colour at once; screen-by-screen token migration reduces the risk of breaking teacher workflows.

