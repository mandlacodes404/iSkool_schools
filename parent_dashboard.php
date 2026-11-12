<?php
/**
 * iSkool parent app: the page shell.
 *
 * Loaded by dashboard.php for the "parent" role. The page only draws the frame (sidebar on desktop, header and
 * bottom tabs on phones, the account menu); everything inside it comes from api/parent/*.php through
 * assets/js/parent/parent_app.js. A parent only ever sees the learners linked to them (parent_links).
 */

require_once __DIR__ . '/auth/session_guard.php';
require_once __DIR__ . '/auth/parent_app_functions.php';
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/includes/app_version.php';

if (!isset($_SESSION['email']) || ($_SESSION['role'] ?? '') !== 'parent') {
    header('Location: index.php');
    exit();
}

$parent_email = $_SESSION['email'];

$parent_name = '';
$parent_initials = 'P';
$stmt = $conn->prepare("SELECT name, surname FROM users WHERE email = ? AND role = 'parent' LIMIT 1");
$stmt->bind_param('s', $parent_email);
$stmt->execute();
if ($row = $stmt->get_result()->fetch_assoc()) {
    $parent_name = parent_full_name($row['name'], $row['surname']);
    if ($parent_name !== '') {
        $parent_initials = parent_person_initials($row['name'], $row['surname']);
    }
}
$stmt->close();
if ($parent_name === '') {
    $parent_name = 'Parent';
}

$school = parent_school_info($conn, __DIR__);

function pa_e($value): string
{
    return htmlspecialchars((string) $value, ENT_QUOTES, 'UTF-8');
}

// The five tabs: Home, Report, Syllabus, News and Events. "Add a child" is not a tab; it sits in the account menus.
$nav = [
    ['home',     'Home',     '<path d="M3 11l9-8 9 8"/><path d="M5 10v10h5v-6h4v6h5V10"/>'],
    ['report',   'Report',   '<path d="M4 20h16"/><path d="M7 20v-9"/><path d="M12 20V5"/><path d="M17 20v-6"/>'],
    ['syllabus', 'Syllabus', '<path d="M2 5h7a3 3 0 0 1 3 3v12a2 2 0 0 0-2-2H2z"/><path d="M22 5h-7a3 3 0 0 0-3 3v12a2 2 0 0 1 2-2h8z"/>'],
    ['news',     'News',     '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>'],
    ['events',   'Events',   '<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>'],
];

// Headings above some of the pages, like the learner menu's "Learning" and "Academics": Home on its own, then these two groups.
$groups = ['report' => 'Progress', 'news' => 'School'];

function pa_icon(string $paths, int $size = 20, string $width = '1.8'): string
{
    return '<svg width="' . $size . '" height="' . $size . '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="' . $width
        . '" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' . $paths . '</svg>';
}

/** The school's logo, or its initials when there is no logo (same fallback as the learner menu). */
function pa_school_mark(array $school): string
{
    if (!empty($school['logo'])) {
        return '<img class="pa-mark" src="' . pa_e($school['logo']) . '" alt="">';
    }
    return '<span class="pa-mark pa-mark--initials" aria-hidden="true">' . pa_e($school['initials']) . '</span>';
}

/** The page links of the sidebar and the phone menu, with the group headings between them. */
function pa_nav_links(array $nav, array $groups): string
{
    $html = '';
    foreach ($nav as [$id, $label, $icon]) {
        if (isset($groups[$id])) {
            $html .= '<div class="pa-nav-group" aria-hidden="true">' . pa_e($groups[$id]) . '</div>';
        }
        $html .= '<a class="pa-nav-link" href="#/' . $id . '" data-route="' . $id . '">' . pa_icon($icon, 18)
            . '<span class="pa-nav-label">' . pa_e($label) . '</span></a>';
    }
    return $html;
}

/** The avatar, the parent's name with the "Parent" role under it, and the up/down chevron (the account row at the bottom of the menu). */
function pa_account_row(string $initials, string $name): string
{
    return '<span class="pa-avatar">' . pa_e($initials) . '</span>'
        . '<span class="pa-account-text">'
        . '<span class="pa-account-name">' . pa_e($name) . '</span>'
        . '<span class="pa-account-role">Parent</span>'
        . '</span>'
        . '<span class="pa-account-chev" aria-hidden="true"></span>';
}
?>
<!DOCTYPE html>
<html lang="en" data-theme="light">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
    <title>iSkool Parent</title>
    <meta name="csrf-token" content="<?= pa_e($_SESSION['csrf_token'] ?? '') ?>">
    <link rel="icon" href="icon.svg?v=1.4" type="image/svg+xml">
    <!-- Installed app: the same tags as the learner dashboard. The status bar colour (theme-color) follows the page's
         theme and is dark while the splash is up (paSyncBar below). -->
    <meta name="theme-color" content="#20201f">
    <meta name="mobile-web-app-capable" content="yes">
    <meta name="application-name" content="iSkool">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-status-bar-style" content="black">
    <meta name="msapplication-navbutton-color" content="#20201f">
    <link rel="manifest" href="/manifest.php?v=1.2">
    <link rel="apple-touch-icon" href="/apple-touch-icon.png?v=1.1">
    <script>
        // Set the saved theme and the sidebar's collapsed state before anything paints, so there is no flash.
        // Light is the default. With no saved choice the sidebar is a narrow rail on windows under 1100px.
        (function () {
            try {
                var t = localStorage.getItem('parentApp.theme');
                if (t === 'dark' || t === 'light') document.documentElement.setAttribute('data-theme', t);
                var c = localStorage.getItem('parentApp.menuCollapsed');
                if (c === '1' || (c === null && window.innerWidth < 1100)) document.documentElement.classList.add('pa-collapsed');
            } catch (e) {}
        })();

        // The browser's / installed app's status bar colour: the page's own colour, except while the splash is up
        // (dark, like the login page's splash before it). Called again when the theme is switched (parent_menu.js)
        // and when the splash goes away.
        (function () {
            var DARK = '#20201f', LIGHT = '#faf9f5';
            function splashOn() {
                var splash = document.getElementById('pa-splash');
                if (splash) return splash.style.display !== 'none' && !splash.classList.contains('pa-splash-hidden');
                try { return !!sessionStorage.getItem('splashStartedAt'); } catch (e) { return false; }
            }
            window.paSyncBar = function () {
                var meta = document.querySelector('meta[name="theme-color"]');
                if (!meta) return;
                var dark = document.documentElement.getAttribute('data-theme') === 'dark';
                meta.setAttribute('content', dark || splashOn() ? DARK : LIGHT);
            };
            window.paSyncBar();
            document.addEventListener('DOMContentLoaded', window.paSyncBar);
        })();
    </script>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600&family=Geist:wght@400;500;600&family=Nunito:wght@400;600;700;800&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="assets/css/parent/parent_app.css?v=1.14">
    <link rel="stylesheet" href="assets/css/parent/parent_menu.css?v=1.3">
    <link rel="stylesheet" href="assets/css/parent/parent_splash.css?v=1.2">
    <link rel="stylesheet" href="assets/css/pill-loader.css?v=1.0">
    <link rel="stylesheet" href="assets/css/shared/pull_to_refresh.css?v=1.0">
    <link rel="stylesheet" href="assets/css/shared/pwa_prompts.css?v=1.0">
    <link rel="stylesheet" href="assets/css/shared/back_button.css?v=1.0">
</head>
<body>

<!-- ──────── SPLASH HANDOFF ────────
     Continues the splash that index.php shows while it signs a parent in, so the app does not open on a blank page
     (the same hand-off the learner dashboard has). It is hidden once the first screen has been drawn (parent_app.js
     says so with the 'iskool:home-ready' event) and the 1300ms the login page started has run out, and at the latest
     after 6 seconds. Opened directly (a plain refresh, no splash started by index.php) it hides at once. -->
<div id="pa-splash">
    <div id="pa-splash-logo">
        <img src="/icon.svg?v=1.4" width="180" height="180" alt="iSkool logo">
        <span id="pa-splash-wordmark">iSkool</span>
    </div>
    <img src="enthropy/wiggle_colored.svg" alt="ENTHROPY" id="pa-splash-brand-wordmark">
</div>
<script>
(function () {
    var splash = document.getElementById('pa-splash');
    if (!splash) return;

    var startedAtRaw = null;
    try { startedAtRaw = sessionStorage.getItem('splashStartedAt'); } catch (e) {}

    // Not here through the login splash (a plain refresh): no splash of our own
    if (!startedAtRaw) {
        splash.style.display = 'none';
        return;
    }
    try { sessionStorage.removeItem('splashStartedAt'); } catch (e) {}

    var MIN_SPLASH_MS = 1300;   // the budget index.php started: the time still left is waited out, not a new 1300ms
    var MAX_SPLASH_MS = 6000;   // never stuck up for ever
    var remaining = Math.max(0, MIN_SPLASH_MS - (Date.now() - parseInt(startedAtRaw, 10)));

    var hidden = false;
    function hideSplash() {
        if (hidden) return;
        hidden = true;
        splash.classList.add('pa-splash-hidden');
        if (window.paSyncBar) window.paSyncBar();
        setTimeout(function () { splash.style.display = 'none'; }, 400);
    }

    var minFloor = new Promise(function (resolve) { setTimeout(resolve, remaining); });
    var homeReady = new Promise(function (resolve) {
        window.addEventListener('iskool:home-ready', resolve, { once: true });
    });
    Promise.all([minFloor, homeReady]).then(hideSplash);
    setTimeout(hideSplash, MAX_SPLASH_MS);
})();
</script>
<div class="pa" id="parentApp" data-email="<?= pa_e($parent_email) ?>" data-version="<?= pa_e(iskool_app_version_label()) ?>">

    <!-- Desktop: sidebar. Same structure as the learner menu: school logo and name, the pages, the account row at the bottom. -->
    <aside class="pa-side" id="paSide" aria-label="Parent menu">
        <div class="pa-brand">
            <?= pa_school_mark($school) ?>
            <div class="pa-brand-text">
                <span class="pa-brand-name" title="<?= pa_e($school['name']) ?>"><?= pa_e($school['name']) ?></span>
                <?php if ($school['year'] !== ''): ?><span class="pa-brand-sub"><?= pa_e($school['year']) ?></span><?php endif; ?>
            </div>
            <button type="button" class="pa-toggle" id="paToggle" aria-controls="paSide" aria-expanded="true" aria-label="Collapse sidebar"></button>
        </div>
        <button type="button" class="pa-search" id="paSearchBtn" aria-label="Search pages and actions">
            <span class="pa-nav-label">Search</span><kbd class="pa-kbd" id="paSearchKbd"></kbd>
        </button>
        <nav class="pa-nav" aria-label="Parent app">
            <?= pa_nav_links($nav, $groups) ?>
        </nav>
        <div class="pa-account" id="paAccountDesktop">
            <button type="button" class="pa-account-btn" id="paAccountBtn" aria-haspopup="menu" aria-expanded="false" aria-controls="paMenuDesktop">
                <?= pa_account_row($parent_initials, $parent_name) ?>
            </button>
            <div class="pa-menu pa-menu-up" id="paMenuDesktop" data-pa-menu hidden></div>
        </div>
    </aside>

    <div class="pa-body">

        <!-- Phone: header, same structure as the learner app (menu, school logo, profile) -->
        <header class="pa-top">
            <button type="button" class="pa-icon-btn" id="paMenuBtn" aria-label="Open menu" aria-expanded="false" aria-controls="paDrawer">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
            </button>
            <div class="pa-top-logo">
                <?php if ($school['logo']): ?>
                    <img class="pa-logo" src="<?= pa_e($school['logo']) ?>" alt="<?= pa_e($school['name']) ?>">
                <?php else: ?>
                    <span class="pa-logo pa-logo-initials" role="img" aria-label="<?= pa_e($school['name']) ?>"><?= pa_e($school['initials']) ?></span>
                <?php endif; ?>
            </div>
            <div class="pa-top-right" id="paAccountMobile">
                <button type="button" class="pa-avatar-btn" id="paAvatarBtn" aria-label="Profile menu" aria-haspopup="menu" aria-expanded="false" aria-controls="paMenuMobile">
                    <span class="pa-avatar"><?= pa_e($parent_initials) ?></span>
                </button>
                <div class="pa-menu pa-menu-down" id="paMenuMobile" data-pa-menu hidden></div>
            </div>
        </header>

        <div class="pa-content">
            <!-- Shown by parent_app.js when the page on screen is the last copy this phone saw (no connection) -->
            <div class="pa-offline" id="paOffline" role="status" hidden></div>
            <div class="pa-switcher" id="paSwitcher" hidden></div>
            <main class="pa-view" id="paView" tabindex="-1" aria-busy="true">
                <p class="pa-muted pa-loading">Loading…</p>
            </main>
        </div>

        <!-- Phone: bottom tabs. Dynamic like the learner bar: clear near the bottom of the page, glass once it is scrolled up (parent_bottom_nav.js) -->
        <nav class="pa-tabs" id="mobileBottomNav" aria-label="Parent app">
            <?php foreach ($nav as [$id, $label, $icon]): ?>
                <a class="pa-tab" href="#/<?= $id ?>" data-route="<?= $id ?>"><?= pa_icon($icon, 22) ?><span><?= pa_e($label) ?></span></a>
            <?php endforeach; ?>
        </nav>
    </div>

    <!-- Phone: slide-in menu. School logo and name at the top, the account row at the bottom (it opens the sheet below). -->
    <div class="pa-overlay" id="paOverlay"></div>
    <aside class="pa-drawer" id="paDrawer" aria-label="Menu" aria-hidden="true">
        <div class="pa-drawer-head">
            <?= pa_school_mark($school) ?>
            <div class="pa-brand-text">
                <span class="pa-brand-name"><?= pa_e($school['name']) ?></span>
                <?php if ($school['year'] !== ''): ?><span class="pa-brand-sub"><?= pa_e($school['year']) ?></span><?php endif; ?>
            </div>
        </div>
        <button type="button" class="pa-search" id="paDrawerSearch" aria-label="Search pages and actions">
            <span class="pa-nav-label">Search</span>
        </button>
        <nav class="pa-nav" aria-label="Parent app">
            <?= pa_nav_links($nav, $groups) ?>
        </nav>
        <button type="button" class="pa-account-btn pa-drawer-account" id="paDrawerAccount" aria-haspopup="menu" aria-expanded="false" aria-controls="paMenuSheet">
            <?= pa_account_row($parent_initials, $parent_name) ?>
        </button>
    </aside>

    <!-- Phone: account sheet. It sits outside the drawer on purpose: the drawer slides with a transform, which would
         turn a fixed-position sheet inside it into one that is positioned against the drawer instead of the screen. -->
    <div class="pa-sheet-bg" id="paSheetBg"></div>
    <div class="pa-menu pa-sheet" id="paMenuSheet" data-pa-menu role="menu" aria-label="Account"></div>
</div>

<!-- Phone: the blue arc over the page while a screen with nothing to show yet waits for the server (the learner
     app's loader; parent_app.js shows it after a short moment and never while the splash is up) -->
<div class="pa-loader" id="paLoader" aria-hidden="true"><div class="pa-loader-ring"></div></div>

<script src="assets/js/parent/parent_menu.js?v=1.1"></script>
<script src="assets/js/shared/pull_to_refresh.js?v=1.0"></script>
<script src="assets/js/parent/parent_app.js?v=1.12"></script>
<script src="assets/js/parent/parent_bottom_nav.js?v=1.0"></script>
<script src="assets/js/parent/parent_pwa.js?v=1.0"></script>
<script src="assets/js/shared/pwa_prompts.js?v=1.0"></script>
<script src="assets/js/shared/back_button.js?v=1.0"></script>
<script src="assets/js/parent/parent_back_button.js?v=1.0"></script>
</body>
</html>