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
    <script>
        // Set the saved theme before anything paints, so there is no flash. Light is the default.
        (function () {
            try {
                var t = localStorage.getItem('parentApp.theme');
                if (t === 'dark' || t === 'light') document.documentElement.setAttribute('data-theme', t);
            } catch (e) {}
        })();
    </script>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600&family=Geist:wght@400;500;600&family=Nunito:wght@400;600;700;800&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="assets/css/parent/parent_app.css?v=1.5">
</head>
<body>
<div class="pa" id="parentApp" data-email="<?= pa_e($parent_email) ?>" data-version="<?= pa_e(iskool_app_version_label()) ?>">

    <!-- Desktop: sidebar. Same structure as the learner menu: school logo and name, the pages, the account row at the bottom. -->
    <aside class="pa-side" aria-label="Parent menu">
        <div class="pa-brand">
            <?= pa_school_mark($school) ?>
            <div class="pa-brand-text">
                <span class="pa-brand-name" title="<?= pa_e($school['name']) ?>"><?= pa_e($school['name']) ?></span>
            </div>
        </div>
        <nav class="pa-nav" aria-label="Parent app">
            <?php foreach ($nav as [$id, $label, $icon]): ?>
                <a class="pa-nav-link" href="#/<?= $id ?>" data-route="<?= $id ?>"><?= pa_icon($icon, 18) ?><span><?= pa_e($label) ?></span></a>
            <?php endforeach; ?>
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
            <div class="pa-switcher" id="paSwitcher" hidden></div>
            <main class="pa-view" id="paView" tabindex="-1" aria-busy="true">
                <p class="pa-muted pa-loading">Loading…</p>
            </main>
        </div>

        <!-- Phone: bottom tabs -->
        <nav class="pa-tabs" aria-label="Parent app">
            <?php foreach ($nav as [$id, $label, $icon]): ?>
                <a class="pa-tab" href="#/<?= $id ?>" data-route="<?= $id ?>"><?= pa_icon($icon, 22) ?><span><?= pa_e($label) ?></span></a>
            <?php endforeach; ?>
        </nav>
    </div>

    <!-- Phone: slide-in menu. School logo and name at the top, the account row at the bottom (it opens the sheet below). -->
    <div class="pa-overlay" id="paOverlay" hidden></div>
    <aside class="pa-drawer" id="paDrawer" aria-label="Menu" aria-hidden="true">
        <div class="pa-drawer-head">
            <?= pa_school_mark($school) ?>
            <div class="pa-brand-text">
                <span class="pa-brand-name"><?= pa_e($school['name']) ?></span>
            </div>
        </div>
        <nav class="pa-nav" aria-label="Parent app">
            <?php foreach ($nav as [$id, $label, $icon]): ?>
                <a class="pa-nav-link" href="#/<?= $id ?>" data-route="<?= $id ?>"><?= pa_icon($icon, 18) ?><span><?= pa_e($label) ?></span></a>
            <?php endforeach; ?>
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

<script src="assets/js/parent/parent_app.js?v=1.6"></script>
</body>
</html>
