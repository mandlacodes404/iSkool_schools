<?php
ob_start();
error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);
ini_set('error_log', 'php_errors.log');
require_once __DIR__ . '/auth/session_guard.php';
include("config.php");
require_once __DIR__ . '/includes/app_version.php';

if (!isset($_SESSION['email']) || $_SESSION['role'] !== 'teacher') {
    header("Location: index.php");
    exit();
}

$email = $_SESSION['email'];

$stmtTeacher = $conn->prepare("SELECT name, surname, profile_picture FROM users WHERE email = ?");
$stmtTeacher->bind_param("s", $email);
$stmtTeacher->execute();
$resultTeacher = $stmtTeacher->get_result();

$teacherName    = $_SESSION['name'] ?? 'Teacher';
$teacherSurname = '';
$teacherProfile = '';

if ($rowTeacher = $resultTeacher->fetch_assoc()) {
    $teacherName    = $rowTeacher['name'] ?: $teacherName;
    $teacherSurname = $rowTeacher['surname'] ?: '';
    $teacherProfile = $rowTeacher['profile_picture'];
}
$stmtTeacher->close();

$teacherFullName = trim($teacherName . ' ' . $teacherSurname);
$teacherEmail    = $_SESSION['email'];
$teacherThemeStorageKey = 'iskoolTeacherDesktopTheme:' . hash('sha256', ($_SESSION['current_school_db'] ?? '') . '|' . $teacherEmail);
// Phones have their own light / dark choice (Settings > Appearance), saved apart from the desktop one.
$teacherMobileThemeStorageKey = 'iskoolTeacherMobileTheme:' . hash('sha256', ($_SESSION['current_school_db'] ?? '') . '|' . $teacherEmail);

$tFirstInitial   = !empty($teacherName)    ? strtoupper(substr(trim($teacherName), 0, 1))    : '';
$tLastInitial    = !empty($teacherSurname) ? strtoupper(substr(trim($teacherSurname), 0, 1)) : '';
$teacherInitials = $tFirstInitial . $tLastInitial ?: '??';

$schoolName = 'My School';
$schoolLogo = null; // null = no logo uploaded yet -> show initials avatar instead (same as learner_dashboard.php)
$result = $conn->query("SELECT setting_value, school_logo FROM school_name WHERE setting_key = 'school_name' LIMIT 1");
if ($row = $result->fetch_assoc()) {
    $schoolName = $row['setting_value'];
    $logoPath   = trim((string)($row['school_logo'] ?? ''));

    // Treat the shared default placeholder as "not uploaded".
    $isDefaultPlaceholder = ($logoPath === '' || stripos($logoPath, 'default_school.png') !== false);

    // A path saved in the DB doesn't guarantee the file is still there
    // (deleted upload, bad path, etc). Verify it actually exists on disk,
    // otherwise the <img> would show a broken-image icon instead of falling
    // back to the initials avatar.
    $logoFileExists = false;
    if (!$isDefaultPlaceholder) {
        $logoRelative   = ltrim(str_replace('\\', '/', $logoPath), '/');
        $logoFullPath   = __DIR__ . '/' . $logoRelative;
        $logoFileExists = is_file($logoFullPath);
    }

    if (!$isDefaultPlaceholder && $logoFileExists) {
        $schoolLogo = $logoPath;
    }
}

// Build 2-letter school initials from the first two words of the school name
// e.g. "Landulwazi Highschool" -> LH, "Thoko Thaba Highschool" -> TT
// (identical logic to learner_dashboard.php)
$schoolNameWords = preg_split('/\s+/', trim($schoolName), -1, PREG_SPLIT_NO_EMPTY);
$schoolInitials  = '';
foreach (array_slice($schoolNameWords, 0, 2) as $word) {
    $schoolInitials .= strtoupper(substr($word, 0, 1));
}
if ($schoolInitials === '') { $schoolInitials = '??'; }

// The current academic year, shown under the school name in the menu (same query as learner_dashboard.php).
// Empty when no year is marked as current: then the line is left out.
$teacherYearName = '';
$teacherYearResult = $conn->query("SELECT name FROM academic_years WHERE is_current = 1 LIMIT 1");
if ($teacherYearResult && ($teacherYearRow = $teacherYearResult->fetch_assoc())) {
    $teacherYearName = trim((string)($teacherYearRow['name'] ?? ''));
}
?>
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="csrf-token" content="<?php echo htmlspecialchars($_SESSION['csrf_token']); ?>">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <meta name="theme-color" content="#0d1117">
    <meta name="mobile-web-app-capable" content="yes">
    <meta name="application-name" content="iSkool">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="msapplication-navbutton-color" content="#0d1117">
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
    <link rel="icon" type="image/svg+xml" href="/icon.svg?v=1.4">
    <link rel="apple-touch-icon" href="/apple-touch-icon.png?v=1.1">
    <!-- Phone canvas: the colour behind the page, there from the very first frame (when the app opens, and in the
         instant between two pages) so a white or wrong-coloured edge never shows. Dark phone mode only, the same
         colour as the body (--bg-color in teacher_dashboard.css): in light mode the page colour is decided page by
         page (teacher_mobile_light.css), so <html> is left alone and takes whatever <body> paints. -->
    <style>
        @media (max-width: 768px) {
            html:not([data-teacher-mobile-theme="light"]) { background-color: #0d1117; }
        }
    </style>
    <link rel="stylesheet" href="assets/css/teacher/dashboard.css?v=5.3">
    <link rel="stylesheet" href="assets/css/pill-loader.css?v=1.0">
    <link rel="stylesheet" href="assets/css/teacher/announcements.css?v=7.5">
    <link rel="stylesheet" href="assets/css/teacher/assignments.css?v=3.5">
    <link rel="stylesheet" href="assets/css/teacher/resources.css?v=2.5">
    <link rel="stylesheet" href="assets/css/teacher/sbo.css?v=2.4">
    <link rel="stylesheet" href="assets/css/teacher/evaluations.css?v=3.2">
    <link rel="stylesheet" href="assets/css/teacher/grades.css?v=3.2">
    <link rel="stylesheet" href="assets/css/teacher/teacher_detail.css?v=1.2">
    <link rel="stylesheet" href="assets/css/teacher/teacher_calendar.css?v=1.3">
    <title>Dashboard - <?= htmlspecialchars($schoolName) ?></title>
    <link rel="manifest" href="/manifest.php?v=1.2">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.2/css/all.min.css" crossorigin="anonymous" referrerpolicy="no-referrer" />
    <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@200;300;400;500;600&family=Fraunces:opsz,wght@9..144,500;9..144,600&family=Geist:wght@400..600&display=swap" rel="stylesheet">
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <link rel="stylesheet" href="assets/css/teacher/teacher_dashboard.css?v=14.2">
    <link rel="stylesheet" href="assets/css/teacher/teacher_desktop_menu.css?v=2.5">
    <link rel="stylesheet" href="assets/css/teacher/teacher_mobile_menu.css?v=1.7">
    <link rel="stylesheet" href="assets/css/teacher/teacher_mobile_settings.css?v=1.4">
    <link rel="stylesheet" href="assets/css/shared/pwa_prompts.css?v=1.0">
    <link rel="stylesheet" href="assets/css/shared/pull_to_refresh.css?v=1.0">
    <link rel="stylesheet" href="assets/css/shared/net_status.css?v=1.0">
    <link rel="stylesheet" href="assets/css/shared/back_button.css?v=1.0">
    <link rel="stylesheet" href="assets/css/teacher/teacher_desktop_settings.css?v=1.4">
    <link rel="stylesheet" href="assets/css/teacher/teacher_desktop_light_mode.css?v=1.8">
    <link rel="stylesheet" href="assets/css/teacher/teacher_mobile_light.css?v=1.8">
    <link rel="stylesheet" href="assets/css/splash_light.css?v=<?= (int) @filemtime(__DIR__ . '/assets/css/splash_light.css') ?>">
    <script>
    // Desktop sidebar: restore the saved collapsed state BEFORE first paint (no flash).
    // With no saved choice, screens narrower than 1440px start as a rail.
    (function () {
        try {
            var s = localStorage.getItem('iskoolTeacherMenuCollapsed');
            if (s === '1' || (s === null && window.innerWidth < 1440)) document.documentElement.classList.add('dm-collapsed');
        } catch (e) {}
        // Desktop light mode (769px and up): applying the saved value before <body> is painted prevents a
        // visible dark-to-light flash on Home. Phones have their own switch, see teacher_mobile_theme.js below.
        window.ISKOOL_TEACHER_THEME_KEY = <?php echo json_encode($teacherThemeStorageKey); ?>;
        window.ISKOOL_TEACHER_MOBILE_THEME_KEY = <?php echo json_encode($teacherMobileThemeStorageKey); ?>;
        try {
            var theme = localStorage.getItem(window.ISKOOL_TEACHER_THEME_KEY);
            document.documentElement.dataset.teacherTheme = theme === 'light' ? 'light' : 'dark';
            // Remember the theme last shown on this browser. The login page is shown before anyone signs in, so
            // it reads this value (includes/login_theme_head.php).
            localStorage.setItem('iskoolDesktopThemeLastUsed', theme === 'light' ? 'light' : 'dark');
        } catch (e) {
            document.documentElement.dataset.teacherTheme = 'dark';
        }
    })();
    </script>
    <!-- Phone light / dark: sets <html data-teacher-mobile-theme> and the status bar colour before first paint
         (see teacher_mobile_theme.js). Needs the theme-color <meta> tag above. -->
    <script src="assets/js/teacher/teacher_mobile_theme.js?v=1.3"></script>
<script>
function getCsrfToken() {
    const meta = document.querySelector('meta[name="csrf-token"]');
    return meta ? meta.getAttribute('content') : '';
}
</script></head>
<body>
<!-- ──────── SPLASH HANDOFF ────────
     Continues the splash started on index.php so there is no blank flash
     between the login page redirecting here and Home being ready. Ported
     from learner_dashboard.php. Deliberately uses the SAME colours as the
     learner splash: index.php shows one splash to every role before it
     knows who is logging in, so a role-specific colour here would create
     the very flash this is meant to remove. -->
<style id="dash-splash-bg-override">
    /* Match body to the splash so the dashboard's own background never
       shows through around/under it during paint or fade-out. Removed
       once the splash has finished hiding. */
    body { background-color: #0a0a0a !important; }
    @media (max-width: 899px) {
        body { background-color: #20201f !important; }
    }
    /* Desktop light mode (769px and up): the splash is light, see assets/css/splash_light.css */
    @media (min-width: 769px) {
        html[data-teacher-theme="light"] body { background-color: #faf9f5 !important; }
    }
</style>
<div id="dash-splash">
    <div id="dash-splash-logo">
        <img src="/icon.svg?v=1.4" width="180" height="180" alt="iSkool logo">
        <span id="dash-splash-wordmark">iSkool</span>
    </div>
    <img src="enthropy/wiggle_colored.svg" alt="ENTHROPY" id="dash-splash-brand-wordmark">
</div>
<script>
// ──────── SPLASH HANDOFF: hide once Home is actually ready ────────
// Hides when BOTH are true, whichever finishes last:
//   1) the remaining time on the 1300ms budget index.php already started
//      (total splash stays ~1300ms across both pages, not 2600ms)
//   2) Home is really rendered — 'iskool:teacher-home-ready', fired by
//      afterTeacherHomeRender() in dashboard.js — or the mainFrame
//      iframe's 'load' (when the restored page is iframe-based).
// MAX_SPLASH_MS guarantees it can never hang.
(function () {
    var splash = document.getElementById('dash-splash');
    if (!splash) return;

    var root = document.documentElement;
    var themeMeta = document.querySelector('meta[name="theme-color"]');
    var THEME_AFTER = themeMeta ? themeMeta.getAttribute('content') : '#0d1117';
    var isMobile = window.matchMedia('(max-width: 768px)').matches;

    function removeBgOverride() {
        var styleTag = document.getElementById('dash-splash-bg-override');
        if (styleTag) styleTag.remove();
    }

    function finishCleanup() {
        splash.style.display = 'none';
        removeBgOverride();
        root.classList.remove('splash-handoff');
        window.suppressInitialLoader = false;
        // Hand the browser bar back to the teacher theme now the splash is gone.
        if (themeMeta) themeMeta.setAttribute('content', THEME_AFTER);
    }

    var startedAtRaw = null;
    try { startedAtRaw = sessionStorage.getItem('splashStartedAt'); } catch (e) {}

    // No handoff flag → not arriving via the login splash (e.g. a plain
    // refresh). Show no splash of our own.
    if (!startedAtRaw) {
        splash.style.display = 'none';
        removeBgOverride();
        return;
    }
    // Consume the flag so a later refresh never re-triggers the splash.
    try { sessionStorage.removeItem('splashStartedAt'); } catch (e) {}

    // Cold load: keep the pill loader from flashing over Home, and paint
    // the browser bar the same colour as the splash for the duration.
    window.suppressInitialLoader = true;
    root.classList.add('splash-handoff');
    if (isMobile && themeMeta) themeMeta.setAttribute('content', '#20201f');

    var MIN_SPLASH_MS = 1300;
    var MAX_SPLASH_MS = 6000;
    var elapsed = Date.now() - parseInt(startedAtRaw, 10);
    var remaining = Math.max(0, MIN_SPLASH_MS - elapsed);

    var hidden = false;
    function hideSplash() {
        if (hidden) return;
        hidden = true;
        splash.classList.add('dash-splash-hidden');
        // Only hand background/theme back once the fade has finished, so
        // no seam shows mid-fade.
        setTimeout(finishCleanup, 400);
    }

    var minFloor = new Promise(function (resolve) { setTimeout(resolve, remaining); });
    var homeReady = new Promise(function (resolve) {
        window.addEventListener('iskool:teacher-home-ready', resolve, { once: true });
        // #mainFrame is defined later in the body, so wait for
        // DOMContentLoaded before attaching its 'load' listener.
        document.addEventListener('DOMContentLoaded', function () {
            var frame = document.getElementById('mainFrame');
            if (frame) frame.addEventListener('load', resolve, { once: true });
        }, { once: true });
    });

    Promise.all([minFloor, homeReady]).then(hideSplash);
    setTimeout(hideSplash, MAX_SPLASH_MS);
})();
</script>
<?php require_once __DIR__ . '/rotate-lock.php'; ?>
<script>
// Re-initialise in portrait so the mobile home layout is never inherited from
// a desktop-width render that happened while the phone was sideways.
if (window.iSkoolOrientationLock && window.iSkoolOrientationLock.wasLockedAtLoad) {
    window.addEventListener('iskool:portrait-ready', function () {
        window.location.reload();
    }, { once: true });
}
</script>
<?php $currentPage = basename($_SERVER['PHP_SELF']); ?>

<!-- ═══════════════════════════════════════════
     SIDEBAR
═══════════════════════════════════════════ -->
<div class="sidebar dm-menu" id="dmSidebar">

    <!-- ══ DESKTOP ONLY: brand row + quick search (hidden on mobile by CSS) ══ -->
    <div class="dm-brand">
        <?php if ($schoolLogo): ?>
            <img class="dm-mark" src="<?= htmlspecialchars($schoolLogo) ?>" alt="">
        <?php else: ?>
            <span class="dm-mark dm-mark--initials" aria-hidden="true"><?= htmlspecialchars($schoolInitials) ?></span>
        <?php endif; ?>
        <div class="dm-brand-text">
            <span class="dm-brand-name" title="<?= htmlspecialchars($schoolName) ?>"><?= htmlspecialchars($schoolName) ?></span>
            <?php if ($teacherYearName !== ''): ?><span class="dm-brand-sub"><?= htmlspecialchars($teacherYearName) ?></span><?php endif; ?>
        </div>
        <button type="button" class="dm-toggle" id="dmToggle" aria-controls="dmSidebar" aria-expanded="true" aria-label="Collapse sidebar"></button>
    </div>

    <button type="button" class="dm-search" id="dmSearchBtn" aria-label="Search pages and actions">
        <span class="dm-label">Search</span><kbd class="dm-kbd" id="dmSearchKbd"></kbd>
    </button>

    <!-- Profile block. Mobile: avatar, name and email at the top of the menu.
         Desktop: the same three elements become the account button at the bottom. -->
    <div class="dm-account-root" id="dmAccount">
    <div class="sidebar-header">
        <div class="profile-picture-wrapper">
            <?php if (!empty($teacherProfile) && $teacherProfile !== 'default.png'): ?>
                <img src="uploads/teachers/<?= htmlspecialchars($teacherProfile) ?>" alt="Profile" class="teacher-avatar">
            <?php else: ?>
                <div class="initials-avatar teacher-avatar"><?= htmlspecialchars($teacherInitials) ?></div>
            <?php endif; ?>
            <input type="file" id="teacherProfileInput" accept="image/*" style="display:none;">
        </div>
        <button class="round-toggle" onclick="toggleDesktopSidebar()">
            <span id="toggleIcon" class="drawer-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
                     stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="2"></rect>
                    <line x1="7" y1="3" x2="7" y2="21"></line>
                </svg>
            </span>
        </button>
    </div>

    <div class="teacher-name"><?= htmlspecialchars($teacherFullName) ?></div>
    <div class="teacher-role">Teacher</div>
    <div class="teacher-email"><?= htmlspecialchars($teacherEmail) ?></div>
    </div>

    <div class="sidebar-links" style="margin-top:40px;">
        <!-- Home -->
        <a class="mobile-bottom-link dm-item" href="javascript:void(0)" data-page="teacher_manual" onclick="loadTeacherManual()">
            <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" style="margin-right:10px;">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                <polyline points="9 22 9 12 15 12 15 22"></polyline>
            </svg>
            <span class="dm-label">Home</span>
        </a>

        <!-- Quizzes -->
        <a class="desktop-bottom-link dm-item" href="javascript:void(0)" data-page="teacher_quizzes" onclick="fetchTeacherQuizzes()">
            <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" style="margin-right:10px;">
                <line x1="18" y1="20" x2="18" y2="10"></line>
                <line x1="12" y1="20" x2="12" y2="4"></line>
                <line x1="6"  y1="20" x2="6"  y2="14"></line>
            </svg>
            <span class="dm-label">Quizzes</span>
        </a>

        <!-- Assignments -->
        <a class="mobile-bottom-link dm-item" href="javascript:void(0)" data-page="teacher_assignments" onclick="fetchTeacherAssignments()">
            <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" style="margin-right:10px;">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="16" y1="13" x2="8" y2="13"></line>
                <line x1="16" y1="17" x2="8" y2="17"></line>
            </svg>
            <span class="dm-label">Assignments</span>
        </a>

        <!-- Announcements -->
        <a class="mobile-bottom-link dm-item" href="javascript:void(0)" data-page="teacher_announcements" onclick="fetchTeacherAnnouncements()">
            <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" style="margin-right:10px;">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
            </svg>
            <span class="dm-label">Announcements</span>
        </a>

        <!-- Grades -->
        <a class="dm-item" href="javascript:void(0)" data-page="teacher_grades" onclick="fetchTeacherGrades()">
            <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" style="margin-right:10px;">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="16" y1="13" x2="8" y2="13"></line>
                <line x1="16" y1="17" x2="8" y2="17"></line>
            </svg>
            <span class="dm-label">Grades</span>
        </a>

        <!-- Resources -->
        <a class="mobile-bottom-link dm-item" href="javascript:void(0)" data-page="teacher_resources" onclick="fetchTeacherResources()">
            <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" style="margin-right:10px;">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
            </svg>
            <span class="dm-label">Resources</span>
        </a>

        <!-- Syllabus -->
        <a class="desktop-top-row-link dm-item" href="javascript:void(0)" data-page="teacher_syllabus" onclick="fetchTeacherSyllabus(); setTopNavTab('tab-syllabus')">
            <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" style="margin-right:10px;">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
                <line x1="12" y1="6" x2="16" y2="6"></line>
                <line x1="12" y1="10" x2="16" y2="10"></line>
                <line x1="12" y1="14" x2="16" y2="14"></line>
            </svg>
            <span class="dm-label">Syllabus</span>
        </a>

        <!-- Evaluations -->
        <a class="desktop-top-row-link dm-item" href="javascript:void(0)" data-page="teacher_evaluations" onclick="fetchTeacherEvaluations(); setTopNavTab('tab-evaluations')">
            <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" style="margin-right:10px;">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
            </svg>
            <span class="dm-label">Evaluations</span>
        </a>

        <!-- Analytics -->
        <a class="desktop-only desktop-top-row-link dm-item" href="javascript:void(0)" data-page="teacher_analytics" onclick="fetchTeacherAnalytics(); setTopNavTab('tab-analytics')">
            <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" style="margin-right:10px;">
                <path d="M21.21 15.89A10 10 0 1 1 8 2.83"></path>
                <path d="M22 12A10 10 0 0 0 12 2v10z"></path>
            </svg>
            <span class="dm-label">Analytics</span>
        </a>

        <!-- Calendar -->
        <a class="desktop-top-row-link dm-item" href="javascript:void(0)" data-page="teacher_calendar" onclick="fetchTeacherCalendar(); setTopNavTab('tab-calendar')">
            <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" style="margin-right:10px;">
                <rect x="3" y="4" width="18" height="18" rx="2"></rect>
                <line x1="16" y1="2" x2="16" y2="6"></line>
                <line x1="8" y1="2" x2="8" y2="6"></line>
                <line x1="3" y1="10" x2="21" y2="10"></line>
            </svg>
            <span class="dm-label">Calendar</span>
        </a>

        <!-- Settings -->
        <a class="desktop-top-row-link dm-item" href="javascript:void(0)" data-page="teacher_settings" onclick="loadTeacherSettings(); setTopNavTab('tab-settings')">
            <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" style="margin-right:10px;">
                <circle cx="12" cy="12" r="3"></circle>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
            </svg>
            <span class="dm-label">Settings</span>
        </a>
    
        <div class="dm-sep dm-sep--a" aria-hidden="true"></div>
        <div class="dm-sep dm-sep--b" aria-hidden="true"></div>
        <div class="dm-sep dm-sep--d" aria-hidden="true"></div>
    </div>

    <div class="dm-sep dm-sep--c" aria-hidden="true"></div>

    <div class="footer" style="font-size:15px;"><span><strong><?= htmlspecialchars(iskool_app_version_label()) ?></strong></span></div>
</div>

<div id="mobileOverlay"></div>

<!-- ══ DESKTOP ONLY: floating pieces. They sit outside .sidebar so its overflow can't clip them. ══ -->
<div class="dm-tip" id="dmTip" role="tooltip"><span id="dmTipText"></span><kbd id="dmTipKbd"></kbd></div>

<div class="dm-pop" id="dmAccountMenu" role="menu" aria-label="Account">
    <div class="dm-pop-head">
        <span class="dm-pop-name"><?= htmlspecialchars($teacherFullName) ?></span>
        <span class="dm-pop-mail"><?= htmlspecialchars($teacherEmail) ?></span>
    </div>
    <button type="button" class="dm-pop-item" role="menuitem" data-act="settings" style="--dm-ico: var(--dm-i-sliders)">Settings</button>
    <button type="button" class="dm-pop-item" role="menuitem" data-act="photo" style="--dm-ico: var(--dm-i-upload)">Upload photo</button>
    <div class="dm-pop-sep" role="separator"></div>
    <button type="button" class="dm-pop-item is-danger" role="menuitem" data-act="signout" style="--dm-ico: var(--dm-i-logout)">Sign out</button>
    <div class="dm-pop-ver"><?= htmlspecialchars(iskool_app_version_label()) ?></div>
</div>

<div class="dm-palette" id="dmPalette" aria-hidden="true">
    <div class="dm-palette-panel" role="dialog" aria-modal="true" aria-label="Search pages and actions">
        <div class="dm-palette-field">
            <input id="dmPaletteInput" type="text" placeholder="Jump to a page or action" autocomplete="off" spellcheck="false"
                   role="combobox" aria-expanded="true" aria-controls="dmPaletteList" aria-autocomplete="list" aria-label="Search pages and actions">
        </div>
        <ul id="dmPaletteList" role="listbox"></ul>
        <p class="dm-palette-empty" id="dmPaletteEmpty" hidden></p>
        <div class="dm-palette-foot">
            <span><kbd>&uarr;</kbd><kbd>&darr;</kbd>Move</span>
            <span><kbd>&crarr;</kbd>Open</span>
            <span><kbd>Esc</kbd>Close</span>
        </div>
    </div>
</div>

<!-- ═══════════════════════════════════════════
     MAIN CONTENT
═══════════════════════════════════════════ -->
<div class="main-content">

    <!-- ── GITHUB-STYLE TOP NAV (not fixed) ── -->
    <div class="top-nav-wrapper">

        <!-- ROW 1: hamburger | logo + name | avatar -->
        <div class="top-nav-row1">

            <div class="top-nav-left">
                <!-- Mobile hamburger -->
                <button id="mobileToggle" onclick="toggleSidebar()" aria-label="Toggle Mobile Menu">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"
                         fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                        <line x1="3" y1="12" x2="21" y2="12"></line>
                        <line x1="3" y1="6"  x2="21" y2="6"></line>
                        <line x1="3" y1="18" x2="21" y2="18"></line>
                    </svg>
                </button>

                <!-- Desktop hamburger -->
                <button id="desktopMenuToggle">
                    <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor"
                         stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round">
                        <line x1="3" y1="12" x2="21" y2="12"></line>
                        <line x1="3" y1="6"  x2="21" y2="6"></line>
                        <line x1="3" y1="18" x2="21" y2="18"></line>
                    </svg>
                </button>

                <!-- Detail-mode back button (hidden unless configureTeacherHeader
                     sets mode:'detail' — see dashboard.js). Mirrors the learner
                     side's #headerBackBtn/#headerBackLabel. -->
                <button id="teacherHeaderBackBtn" onclick="window.handleTeacherHeaderBack(event)" style="display:none;">
                    <svg viewBox="0 0 24 24" width="22" height="22" stroke="currentColor"
                         stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="15 18 9 12 15 6"></polyline>
                    </svg>
                    <span id="teacherHeaderBackLabel"></span>
                </button>
            </div>

            <!-- DESKTOP ONLY: names the current page (kept in step with the active sidebar link by teacher_desktop_menu.js) -->
            <h1 class="dm-page-title" id="dmPageTitle"></h1>

            <!-- Centre: logo + school name (standard mode) / detail title (detail mode) -->
            <div class="top-nav-brand" id="teacherHeaderBrand">
                <?php if ($schoolLogo): ?>
                    <img src="<?= htmlspecialchars($schoolLogo) ?>" alt="School Logo" id="teacherHeaderLogo">
                <?php else: ?>
                    <span id="teacherHeaderLogo" class="school-logo-initials" aria-label="School Logo"><?= htmlspecialchars($schoolInitials) ?></span>
                <?php endif; ?>
                <span class="top-nav-school-name"><?= htmlspecialchars($schoolName) ?></span>
            </div>
            <div class="top-nav-brand top-nav-brand--detail" id="teacherHeaderDetailTitle" style="display:none;">
                <span class="top-nav-school-name" id="teacherHeaderTitle"></span>
            </div>

            <!-- Right: avatar + dropdown -->
         <!-- Search + Avatar -->
<div style="display:flex;align-items:center;gap:10px;flex-shrink:0;" id="teacherHeaderRight">

    <!-- SEARCH BAR -->
    <div style="position:relative;" id="teacherSearchWrapper">
        <div style="display:flex;align-items:center;gap:8px;
                    background:#21262d;border:1px solid #30363d;
                    border-radius:6px;padding:6px 12px;
                    transition:border-color 0.2s ease;width:220px;"
             id="teacherSearchBox">
            <svg viewBox="0 0 24 24" width="14" height="14" stroke="#8b949e"
                 stroke-width="2" fill="none" flex-shrink="0">
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <input type="text" id="teacherSearchInput"
                   placeholder="Search..."
                   autocomplete="off"
                   style="background:none;border:none;outline:none;
                          color:#e2e8f0;font-size:13px;font-weight:600;
                          font-family:'Nunito',sans-serif;width:100%;"/>
            <span style="font-size:11px;color:#555e6a;
                         border:1px solid #30363d;border-radius:4px;
                         padding:1px 5px;font-family:'Nunito',sans-serif;">/</span>
        </div>

        <!-- SUGGESTIONS DROPDOWN -->
        <div id="teacherSearchSuggestions"
             style="display:none;position:absolute;top:calc(100% + 6px);
                    left:0;right:0;background:#161b22;
                    border:1px solid #30363d;border-radius:8px;
                    overflow:hidden;z-index:9000;
                    box-shadow:0 8px 24px rgba(0,0,0,0.5);">
        </div>
    </div>

    <!-- AVATAR -->
    <div class="top-nav-avatar-btn">
        <div class="top-nav-avatar" onclick="toggleAvatarDropdown()" id="topNavAvatar">
            <?php if (!empty($teacherProfile) && $teacherProfile !== 'default.png'): ?>
                <img src="uploads/teachers/<?= htmlspecialchars($teacherProfile) ?>"
                     alt="Profile" id="topNavAvatarImg">
            <?php else: ?>
                <span class="initials-sm" id="topNavAvatarInitials">
                    <?= htmlspecialchars($teacherInitials) ?>
                </span>
            <?php endif; ?>
        </div>

        <!-- Dropdown -->
        <div class="avatar-dropdown" id="avatarDropdown">
            <div class="avatar-dropdown-header">
                <div class="avatar-dropdown-name"><?= htmlspecialchars($teacherFullName) ?></div>
                <div class="avatar-dropdown-email"><?= htmlspecialchars($teacherEmail) ?></div>
            </div>
            <button class="avatar-dropdown-item" onclick="triggerTopNavUpload()">
                <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor"
                     stroke-width="2" fill="none">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                    <polyline points="17 8 12 3 7 8"></polyline>
                    <line x1="12" y1="3" x2="12" y2="15"></line>
                </svg>
                Upload Photo
            </button>
            <button class="avatar-dropdown-item"
                    onclick="loadTeacherSettings(); closeAvatarDropdown();">
                <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor"
                     stroke-width="2" fill="none">
                    <circle cx="12" cy="12" r="3"></circle>
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
                </svg>
                Settings
            </button>
            <button class="avatar-dropdown-item danger"
                    onclick="window.location.href='logout.php'">
                <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor"
                     stroke-width="2" fill="none">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                    <polyline points="16 17 21 12 16 7"></polyline>
                    <line x1="21" y1="12" x2="9" y2="12"></line>
                </svg>
                Sign Out
            </button>
        </div>

        <input type="file" id="topNavProfileInput" accept="image/*">
    </div>

</div> 
</div>    

        

        <!-- ROW 2: tab links (desktop only) -->
        <nav class="top-nav-row2" id="topNavRow2">

            <button class="top-nav-tab" id="tab-syllabus"
                    onclick="fetchTeacherSyllabus(); setTopNavTab('tab-syllabus')">
                <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor"
                     stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
                    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
                    <line x1="12" y1="6"  x2="16" y2="6"/>
                    <line x1="12" y1="10" x2="16" y2="10"/>
                    <line x1="12" y1="14" x2="16" y2="14"/>
                </svg>
                Syllabus
            </button>

            <button class="top-nav-tab" id="tab-evaluations"
                    onclick="fetchTeacherEvaluations(); setTopNavTab('tab-evaluations')">
                <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor"
                     stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                </svg>
                Evaluations
            </button>

            <button class="top-nav-tab" id="tab-analytics"
                    onclick="fetchTeacherAnalytics(); setTopNavTab('tab-analytics')">
                <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor"
                     stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M21.21 15.89A10 10 0 1 1 8 2.83"/>
                    <path d="M22 12A10 10 0 0 0 12 2v10z"/>
                </svg>
                Analytics
            </button>

            <button class="top-nav-tab" id="tab-calendar"
                    onclick="fetchTeacherCalendar(); setTopNavTab('tab-calendar')">
                <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor"
                     stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="3" y="4" width="18" height="18" rx="2"/>
                    <line x1="16" y1="2" x2="16" y2="6"/>
                    <line x1="8"  y1="2" x2="8"  y2="6"/>
                    <line x1="3"  y1="10" x2="21" y2="10"/>
                </svg>
                Calendar
            </button>

            <button class="top-nav-tab" id="tab-settings"
                    onclick="loadTeacherSettings(); setTopNavTab('tab-settings')">
                <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor"
                     stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="3"/>
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
                </svg>
                Settings
            </button>

        </nav>
    </div>
    

    <!-- ── END TOP NAV ── -->

    <div id="api-content-area" style="display:none; flex:1; overflow-y:auto; padding:20px; box-sizing:border-box;"></div>
    <iframe id="mainFrame" name="mainFrame" src="about:blank" style="display:none; flex:1;"></iframe>

    <div id="loaderOverlay">
        <div class="loader">
            <div class="loader-dot3"></div>
            <div class="loader-dot4"></div>
        </div>
        <div class="loader-version"><?= htmlspecialchars(iskool_app_version_label()) ?></div>
    </div>
</div>

<!-- Phone bottom bar. Same look as the parent app's bar: 64px high, solid, thin line icons, four tabs. -->
<nav id="mobileBottomNav" aria-label="Teacher app">
    <a href="javascript:void(0)" data-page="teacher_manual" onclick="loadTeacherManual()">
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 11l9-8 9 8"/><path d="M5 10v10h5v-6h4v6h5V10"/></svg>
        <span>Home</span>
    </a>
    <a href="javascript:void(0)" data-page="teacher_assignments" onclick="fetchTeacherAssignments()">
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M9 13h6"/><path d="M9 17h4"/></svg>
        <span>Assignments</span>
    </a>
    <a href="javascript:void(0)" data-page="teacher_resources" onclick="fetchTeacherResources()">
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 5h7a3 3 0 0 1 3 3v12a2 2 0 0 0-2-2H2z"/><path d="M22 5h-7a3 3 0 0 0-3 3v12a2 2 0 0 1 2-2h8z"/></svg>
        <span>Resources</span>
    </a>
    <a href="javascript:void(0)" data-page="teacher_announcements" onclick="fetchTeacherAnnouncements()">
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>
        <span>Announcement</span>
    </a>
</nav>

<!-- ── INLINE SCRIPTS ── -->
<script>
// ── TOP NAV TAB ACTIVE STATE ──
window.setTopNavTab = function(tabId) {
    document.querySelectorAll('.top-nav-tab').forEach(t => t.classList.remove('active'));
    if (!tabId) return;
    const el = document.getElementById(tabId);
    if (el) el.classList.add('active');
};

// ── AVATAR DROPDOWN ──
window.toggleAvatarDropdown = function() {
    document.getElementById('avatarDropdown').classList.toggle('open');
};
window.closeAvatarDropdown = function() {
    document.getElementById('avatarDropdown').classList.remove('open');
};
// Close when clicking outside
document.addEventListener('click', function(e) {
    const btn  = document.querySelector('.top-nav-avatar-btn');
    const drop = document.getElementById('avatarDropdown');
    if (btn && !btn.contains(e.target)) drop.classList.remove('open');
});

// ── TOP NAV PHOTO UPLOAD ──
window.triggerTopNavUpload = function() {
    closeAvatarDropdown();
    document.getElementById('topNavProfileInput').click();
};

document.getElementById('topNavProfileInput').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (!file) return;

    // Instant preview in BOTH avatar spots
    const previewUrl = URL.createObjectURL(file);
    updateAllAvatars(previewUrl);

    const fd = new FormData();
    fd.append('profile', file);

    fetch('upload_teacher_profile.php', { method: 'POST', headers: { 'X-CSRF-Token': getCsrfToken() }, body: fd })
        .then(r => r.json())
        .then(d => {
            if (d.success) {
                const url = 'uploads/teachers/' + d.file + '?t=' + Date.now();
                updateAllAvatars(url);
                loadTeacherSettings(); // ← ADDED
            } else {
                alert(d.error || 'Upload failed');
            }
            this.value = '';
        })
        .catch(() => { alert('Connection error'); this.value = ''; });
});

function updateAllAvatars(url) {
    // Top nav avatar
    const topNav = document.getElementById('topNavAvatar');
    if (topNav) {
        topNav.innerHTML = `<img src="${url}" alt="Profile" style="width:100%;height:100%;object-fit:cover;">`;
    }
    // Sidebar avatar
    const wrapper = document.querySelector('.sidebar .profile-picture-wrapper');
    if (wrapper) {
        let img = wrapper.querySelector('img.teacher-avatar');
        if (img) {
            img.src = url;
        } else {
            const initDiv = wrapper.querySelector('.initials-avatar');
            if (initDiv) initDiv.remove();
            const newImg = document.createElement('img');
            newImg.className = 'teacher-avatar';
            newImg.style.cssText = 'width:100%;height:100%;object-fit:cover;';
            newImg.src = url;
            wrapper.insertBefore(newImg, wrapper.querySelector('#teacherProfileInput'));
        }
    }
}

// Default browser bar colour (matches <meta name="theme-color"> in <head>)
const DEFAULT_THEME_COLOR = '#0d1117';
// Mobile menu background colour (matches .sidebar background in teacher_dashboard.css)
const SIDEBAR_THEME_COLOR = '#1a1919';

function setBrowserBarColor(color) {
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', color);
}

// Header (.top-nav-wrapper) colour handling while the mobile menu is open.
// Mirrors the learner dashboard: the header sits INSIDE .main-content and can
// carry an inline page-colour background (set by dashboard.js once a coloured
// page is scrolled). Left alone, that colour would show beside the open menu
// and break the curved seam, so on open we recolour it to the menu's own
// colour and remember what it was; on close we put back exactly what was
// there. dashboard.js's scroll handler skips the browser-bar colour while the
// menu is open, so it cannot fight this.
window.closeMobileSidebar = function() {
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.getElementById('mobileOverlay');
    const topNav  = document.querySelector('.top-nav-wrapper');

    if (sidebar) {
        sidebar.classList.remove('active');
    }
    // Drives the body background that makes the curved corners blend (see
    // body.menu-open in teacher_dashboard.css). Mobile-only rule, so this
    // is a harmless no-op on desktop.
    document.body.classList.remove('menu-open');
    if (overlay) {
        overlay.style.opacity = '0';
        overlay.style.pointerEvents = 'none';
    }

    // Put the header's background back to whatever it legitimately was.
    if (topNav && topNav.dataset.bgBeforeMenu !== undefined) {
        topNav.style.background = topNav.dataset.bgBeforeMenu;
        delete topNav.dataset.bgBeforeMenu;
    }

    // Restore the browser bar to what the current page should be showing: the
    // page's signature colour if it is scrolled on a coloured page, otherwise
    // the default dark surface (same rule dashboard.js applies on scroll).
    let barColor = DEFAULT_THEME_COLOR;
    if (window.innerWidth <= 768 && topNav) {
        const pageColor = topNav.getAttribute('data-page-color');
        if (pageColor && topNav.classList.contains('header-scrolled')) {
            barColor = pageColor;
        }
    }
    setBrowserBarColor(barColor);
};

window.toggleSidebar = function(forceClose = false) {
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.getElementById('mobileOverlay');
    const topNav  = document.querySelector('.top-nav-wrapper');

    if (!sidebar) return;

    if (forceClose || sidebar.classList.contains('active')) {
        closeMobileSidebar();
    } else {
        sidebar.classList.add('active');
        document.body.classList.add('menu-open');
        if (overlay) overlay.style.opacity = '1';
        if (overlay) overlay.style.pointerEvents = 'all';

        // Recolour the header to the menu colour (saving the original once).
        if (window.innerWidth <= 768 && topNav) {
            if (topNav.dataset.bgBeforeMenu === undefined) {
                topNav.dataset.bgBeforeMenu = topNav.style.background || '';
            }
            topNav.style.background = SIDEBAR_THEME_COLOR;
        }

        setBrowserBarColor(SIDEBAR_THEME_COLOR);
    }
};

// ── MOBILE SWIPE GESTURES ────────────────────────────────────────────────
// Swipe right from the left screen edge to open the menu; swipe left while it
// is open to close it. Same logic as learner_dashboard.php, so both
// dashboards behave identically.
//
//   Open  : the touch starts within 28px of the left edge and finishes
//           further right, with more horizontal than vertical movement.
//           There is no minimum distance.
//   Close : the menu is open and the touch finishes further left, with more
//           horizontal than vertical movement.
//   Mobile widths only (<= 768px). Vertical scrolling is never blocked.
//
// touchmove is registered NON-passive on purpose: an edge swipe that is moving
// right is cancelled with preventDefault(), which stops the browser's own
// gesture (back-navigation / reload / pull-to-refresh) from taking the touch
// over — the intermittent "swiped to open the menu and the app refreshed".
// The overscroll-behavior-x rules in teacher_dashboard.css cover the first few
// pixels of the touch, where JS can lose the race against the OS gesture.
(function initTeacherMenuSwipe() {
    const sidebar = document.querySelector('.sidebar');
    if (!sidebar) return;

    const EDGE_ZONE = 28;    // px from the left edge where an open-swipe may begin
    let startX   = 0;
    let startY   = 0;
    let tracking = false;
    let isEdge   = false;    // true when the gesture started at the left edge

    // Registered at every width and gated inside each handler, so the swipe
    // also works after a rotation or resize into mobile width without a reload.
    document.addEventListener('touchstart', function (e) {
        if (window.innerWidth > 768) { tracking = false; return; }
        const t = e.touches[0];
        startX   = t.clientX;
        startY   = t.clientY;
        isEdge   = startX <= EDGE_ZONE;                                  // left-edge open gesture
        tracking = isEdge || sidebar.classList.contains('active');
    }, { passive: true });

    // Non-passive so a rightward edge swipe can be cancelled (see above).
    document.addEventListener('touchmove', function (e) {
        if (!tracking || !isEdge) return;                                // only edge-open swipes are blocked
        if (window.innerWidth > 768) return;
        const deltaX = e.touches[0].clientX - startX;
        const deltaY = e.touches[0].clientY - startY;
        // Only cancel if the move is more horizontal than vertical
        if (Math.abs(deltaX) > Math.abs(deltaY) && deltaX > 0) {
            e.preventDefault();                                          // stops the browser back-swipe / refresh
        }
    }, { passive: false });

    document.addEventListener('touchend', function (e) {
        if (!tracking || window.innerWidth > 768) return;
        tracking = false;
        const t      = e.changedTouches[0];
        const deltaX = t.clientX - startX;
        const deltaY = t.clientY - startY;
        // Must be horizontal-dominant
        if (Math.abs(deltaX) <= Math.abs(deltaY)) return;
        const isOpen = sidebar.classList.contains('active');
        if (deltaX > 0 && !isOpen && isEdge) { window.toggleSidebar();     } // right-swipe from the edge -> open
        if (deltaX < 0 &&  isOpen)           { window.toggleSidebar(true); } // left-swipe -> close
        isEdge = false;
    }, { passive: true });
})();

document.querySelectorAll('.sidebar-links a').forEach(link => {
    link.addEventListener('click', () => {
        if (window.innerWidth <= 768) {
            closeMobileSidebar();
        }
    });
});

// ── SETTINGS LOADER ──
window.loadTeacherSettings = function() {
    const apiArea = document.getElementById('api-content-area');
    const iframe  = document.getElementById('mainFrame');

    if (iframe)  iframe.style.display  = 'none';
    if (apiArea) apiArea.style.display = 'block';

    sessionStorage.setItem("lastTeacherPage", "teacher_settings");

    // Grab current avatar
    const avatarImg = document.querySelector('.sidebar .profile-picture-wrapper img.teacher-avatar');
    const initialsEl = document.querySelector('.sidebar .profile-picture-wrapper .initials-avatar');
    const avatarHTML = avatarImg
        ? `<img src="${avatarImg.src}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`
        : `<span style="font-size:32px;font-weight:800;color:#f4e4e4;text-transform:uppercase;">${initialsEl ? initialsEl.textContent.trim() : '??'}</span>`;

    const isDesktop = window.innerWidth > 768;

    // ── SHARED BLOCKS (used in both layouts) ─────────────────────────────

    const profileCardHTML = `
        <div style="display:flex;flex-direction:column;align-items:center;margin-bottom:28px;">
            <div onclick="triggerTopNavUpload()"
                 style="position:relative;width:100px;height:100px;border-radius:50%;
                        background:#6f1d1b;overflow:hidden;cursor:pointer;flex-shrink:0;
                        transition:border-color 0.2s ease;"
                 onmouseover="this.querySelector('.cam-overlay').style.opacity='1';"
                 onmouseout="this.querySelector('.cam-overlay').style.opacity='0';">
                <div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:#1b1b1b;">
                    ${avatarHTML}
                </div>
                <div class="cam-overlay"
                     style="position:absolute;top:0;left:0;width:100%;height:100%;
                            background:rgba(0,0,0,0.55);border-radius:50%;
                            display:flex;flex-direction:column;align-items:center;
                            justify-content:center;opacity:0;
                            transition:opacity 0.2s ease;pointer-events:none;">
                    <svg viewBox="0 0 24 24" width="26" height="26" stroke="#ffffff" stroke-width="2" fill="none">
                        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
                        <circle cx="12" cy="13" r="4"></circle>
                    </svg>
                    <span style="color:#fff;font-size:11px;font-weight:700;margin-top:4px;">Edit</span>
                </div>
            </div>
            <div style="margin-top:10px;font-size:13px;color:#8b949e;">Click to update photo</div>
        </div>`;

    const profileActionsHTML = `
        <div style="background:#1b1b1b;border:1px solid rgba(255,255,255,0.06);border-radius:14px;overflow:hidden;margin-bottom:20px;">
            <div onclick="triggerTopNavUpload()"
                 style="display:flex;align-items:center;gap:14px;padding:14px 16px;cursor:pointer;transition:background 0.2s ease;"
                 onmouseover="this.style.background='#21262d'"
                 onmouseout="this.style.background='transparent'">
                <div style="width:36px;height:36px;border-radius:9px;background:rgba(79,209,197,0.12);
                            display:flex;align-items:center;justify-content:center;flex-shrink:0;">
                    <svg viewBox="0 0 24 24" width="20" height="20" stroke="#4fd1c5" stroke-width="2" fill="none">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                        <polyline points="17 8 12 3 7 8"></polyline>
                        <line x1="12" y1="3" x2="12" y2="15"></line>
                    </svg>
                </div>
                <div style="flex:1;">
                    <div style="color:#e2e8f0;font-weight:600;font-size:14px;">Update Profile Picture</div>
                    <div style="color:#8b949e;font-size:12px;margin-top:2px;">Upload a new photo</div>
                </div>
                <svg viewBox="0 0 24 24" width="15" height="15" stroke="#8b949e" stroke-width="2" fill="none">
                    <polyline points="9 18 15 12 9 6"></polyline>
                </svg>
            </div>
            <div style="height:1px;background:rgba(255,255,255,0.06);margin-left:64px;"></div>
            <div onclick="removeTeacherProfilePicture()"
                 style="display:flex;align-items:center;gap:14px;padding:14px 16px;cursor:pointer;transition:background 0.2s ease;"
                 onmouseover="this.style.background='#21262d'"
                 onmouseout="this.style.background='transparent'">
                <div style="width:36px;height:36px;border-radius:9px;background:rgba(248,81,73,0.1);
                            display:flex;align-items:center;justify-content:center;flex-shrink:0;">
                    <svg viewBox="0 0 24 24" width="20" height="20" stroke="#f85149" stroke-width="2" fill="none">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path>
                        <path d="M10 11v6M14 11v6"></path>
                    </svg>
                </div>
                <div style="flex:1;">
                    <div style="color:#f85149;font-weight:600;font-size:14px;">Remove Profile Picture</div>
                    <div style="color:#8b949e;font-size:12px;margin-top:2px;">Revert to initials avatar</div>
                </div>
                <svg viewBox="0 0 24 24" width="15" height="15" stroke="#8b949e" stroke-width="2" fill="none">
                    <polyline points="9 18 15 12 9 6"></polyline>
                </svg>
            </div>
        </div>`;

    const notificationsHTML = `
        <div style="background:#1b1b1b;border:1px solid rgba(255,255,255,0.06);
                    border-radius:14px;overflow:hidden;margin-bottom:20px;">
            <div style="padding:16px 18px;">
                <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;">
                    <div style="width:36px;height:36px;border-radius:9px;background:rgba(79,209,197,0.12);
                                display:flex;align-items:center;justify-content:center;flex-shrink:0;">
                        <span style="font-size:18px;line-height:1;">💡</span>
                    </div>
                    <div style="color:#4fd1c5;font-weight:700;font-size:14px;">How to enable notifications</div>
                </div>

                <div style="margin-bottom:14px;">
                    <div style="font-size:12px;font-weight:700;color:#c9d1d9;margin-bottom:6px;">🤖 Android Users</div>
                    <ol style="margin:0;padding-left:18px;font-size:13px;color:#8b949e;line-height:1.9;">
                        <li>Open iSkool in Chrome and tap the menu (⋮).</li>
                        <li>Select <strong style="color:#c9d1d9;">Add to Home Screen</strong>.</li>
                        <li>Open the app from your home screen, then tap <strong style="color:#c9d1d9;">Sync Notifications</strong> below.</li>
                        <li>Select <strong style="color:#c9d1d9;">Allow</strong> when prompted.</li>
                    </ol>
                </div>

                <div style="height:1px;background:rgba(255,255,255,0.06);margin-bottom:14px;"></div>

                <div style="margin-bottom:14px;">
                    <div style="font-size:12px;font-weight:700;color:#c9d1d9;margin-bottom:6px;">🍎 iPhone / iOS Users</div>
                    <ol style="margin:0;padding-left:18px;font-size:13px;color:#8b949e;line-height:1.9;">
                        <li>Open iSkool in <strong style="color:#c9d1d9;">Safari</strong> (notifications only work in Safari on iPhone).</li>
                        <li>Tap the share icon and select <strong style="color:#c9d1d9;">Add to Home Screen</strong>.</li>
                        <li>Open the app from your home screen, then tap <strong style="color:#c9d1d9;">Sync Notifications</strong> below.</li>
                        <li>Select <strong style="color:#c9d1d9;">Allow</strong> on the popup.</li>
                    </ol>
                </div>

                <div style="height:1px;background:rgba(255,255,255,0.06);margin-bottom:14px;"></div>

                <div>
                    <div style="font-size:12px;font-weight:700;color:#c9d1d9;margin-bottom:6px;">🌐 Desktop / Browser Users</div>
                    <ol style="margin:0;padding-left:18px;font-size:13px;color:#8b949e;line-height:1.9;">
                        <li>Click <strong style="color:#c9d1d9;">Sync Notifications</strong> below.</li>
                        <li>Click <strong style="color:#c9d1d9;">Allow</strong> when your browser asks for permission.</li>
                        <li>If you previously blocked notifications, reset them in your browser's site settings.</li>
                    </ol>
                </div>
            </div>
        </div>
        <div onclick="requestTeacherPush()"
             style="display:flex;align-items:center;gap:14px;padding:14px 16px;cursor:pointer;
                    background:#1b1b1b;border:1px solid rgba(255,255,255,0.06);border-radius:14px;
                    transition:background 0.2s ease;"
             onmouseover="this.style.background='#21262d'"
             onmouseout="this.style.background='#1b1b1b'">
            <div style="width:36px;height:36px;border-radius:9px;background:rgba(79,209,197,0.12);
                        display:flex;align-items:center;justify-content:center;flex-shrink:0;">
                <svg viewBox="0 0 24 24" width="20" height="20" stroke="#4fd1c5" stroke-width="2" fill="none">
                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                    <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
                </svg>
            </div>
            <div style="flex:1;">
                <div style="color:#e2e8f0;font-weight:600;font-size:14px;">Sync Notifications</div>
                <div style="color:#8b949e;font-size:12px;margin-top:2px;">Not receiving alerts? Tap to sync</div>
            </div>
            <svg viewBox="0 0 24 24" width="15" height="15" stroke="#8b949e" stroke-width="2" fill="none">
                <polyline points="9 18 15 12 9 6"></polyline>
            </svg>
        </div>`;

    const accountHTML = `
        <div style="background:#1b1b1b;border:1px solid rgba(255,255,255,0.06);border-radius:14px;overflow:hidden;">
            <div onclick="window.location.href='logout.php'"
                 style="display:flex;align-items:center;gap:14px;padding:14px 16px;cursor:pointer;transition:background 0.2s ease;"
                 onmouseover="this.style.background='#21262d'"
                 onmouseout="this.style.background='transparent'">
                <div style="width:36px;height:36px;border-radius:9px;background:rgba(248,81,73,0.1);
                            display:flex;align-items:center;justify-content:center;flex-shrink:0;">
                    <svg viewBox="0 0 24 24" width="20" height="20" stroke="#f85149" stroke-width="2" fill="none">
                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                        <polyline points="16 17 21 12 16 7"></polyline>
                        <line x1="21" y1="12" x2="9" y2="12"></line>
                    </svg>
                </div>
                <div style="flex:1;">
                    <div style="color:#f85149;font-weight:600;font-size:14px;">Sign Out</div>
                    <div style="color:#8b949e;font-size:12px;margin-top:2px;">Log out of your account</div>
                </div>
                <svg viewBox="0 0 24 24" width="15" height="15" stroke="#8b949e" stroke-width="2" fill="none">
                    <polyline points="9 18 15 12 9 6"></polyline>
                </svg>
            </div>
        </div>`;

    // ── DESKTOP: Claude-style tabbed layout ──────────────────────────────
    if (isDesktop) {
        apiArea.innerHTML = `
        <style>
            .ts-desktop {
                display: grid;
                grid-template-columns: 200px minmax(0, 1fr);
                min-height: calc(100vh - 62px);
                font-family: 'Nunito', sans-serif;
            }
            .ts-rail {
                padding: 28px 12px;
                background: #0d1117;
                border-right: 1px solid rgba(255,255,255,0.07);
                display: flex;
                flex-direction: column;
                gap: 2px;
            }
            .ts-nav-item {
                display: flex;
                align-items: center;
                padding: 9px 14px;
                border-radius: 8px;
                font-size: 14px;
                font-weight: 500;
                color: #8b949e;
                cursor: pointer;
                transition: background 0.15s ease, color 0.15s ease;
                border: none;
                background: none;
                width: 100%;
                text-align: left;
                font-family: 'Nunito', sans-serif;
                border-left: 2px solid transparent;
            }
            .ts-nav-item:hover {
                background: rgba(255,255,255,0.04);
                color: #e2e8f0;
            }
            .ts-nav-item.ts-active {
                background: rgba(79,209,197,0.08);
                color: #4fd1c5;
                font-weight: 600;
                border-left: 2px solid #4fd1c5;
            }
            .ts-panel {
                padding: 32px 40px 56px;
                overflow-y: auto;
                max-height: calc(100vh - 62px);
                background: #0a0e14;
            }
            .ts-panel-section {
                display: none;
                max-width: 600px;
            }
            .ts-panel-section.ts-panel-active {
                display: block;
            }
        </style>
        <div class="ts-desktop">

            <!-- LEFT RAIL: nav items only -->
            <nav class="ts-rail">
                <button class="ts-nav-item ts-active" onclick="tsSwitch('profile', this)">Profile</button>
                <button class="ts-nav-item" onclick="tsSwitch('notifications', this)">Notifications</button>
                <button class="ts-nav-item" onclick="tsSwitch('account', this)">Account</button>
            </nav>

            <!-- RIGHT PANEL: content -->
            <div class="ts-panel">
                <div id="ts-section-profile" class="ts-panel-section ts-panel-active">
                    ${profileCardHTML}
                    ${profileActionsHTML}
                </div>
                <div id="ts-section-notifications" class="ts-panel-section">
                    ${notificationsHTML}
                </div>
                <div id="ts-section-account" class="ts-panel-section">
                    ${accountHTML}
                </div>
            </div>

        </div>`;

        // Tab switching function
        window.tsSwitch = function(section, btn) {
            document.querySelectorAll('.ts-nav-item').forEach(b => b.classList.remove('ts-active'));
            document.querySelectorAll('.ts-panel-section').forEach(p => p.classList.remove('ts-panel-active'));
            btn.classList.add('ts-active');
            document.getElementById('ts-section-' + section).classList.add('ts-panel-active');
        };

        return;
    }

    // ── MOBILE: original single-column layout ────────────────────────────
    apiArea.innerHTML = `
        <div style="padding:20px;">

            <!-- CIRCULAR PROFILE -->
            <div style="display:flex;flex-direction:column;align-items:center;margin-bottom:28px;">
                <div onclick="triggerTopNavUpload()"
                     style="position:relative;width:100px;height:100px;border-radius:50%;
                            background:#6f1d1b;border:none;
                            overflow:hidden;cursor:pointer;flex-shrink:0;
                            transition:border-color 0.2s ease;"
                     onmouseover="this.querySelector('.cam-overlay').style.opacity='1';"
                     onmouseout="this.querySelector('.cam-overlay').style.opacity='0';">
                    <div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:#1b1b1b;">
                        ${avatarHTML}
                    </div>
                    <div class="cam-overlay"
                         style="position:absolute;top:0;left:0;width:100%;height:100%;
                                background:rgba(0,0,0,0.55);border-radius:50%;
                                display:flex;flex-direction:column;align-items:center;
                                justify-content:center;opacity:0;
                                transition:opacity 0.2s ease;pointer-events:none;">
                        <svg viewBox="0 0 24 24" width="26" height="26" stroke="#ffffff" stroke-width="2" fill="none">
                            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
                            <circle cx="12" cy="13" r="4"></circle>
                        </svg>
                        <span style="color:#fff;font-size:11px;font-weight:700;margin-top:4px;">Edit</span>
                    </div>
                </div>
                <div style="margin-top:10px;font-size:13px;color:#8b949e;">Click to update photo</div>
            </div>

            <div style="max-width:440px;margin:0 auto;display:flex;flex-direction:column;gap:12px;">

                <div class="teacher-resource-card" onclick="triggerTopNavUpload()" style="cursor:pointer;gap:14px;">
                    <div class="teacher-resource-icon">
                        <svg viewBox="0 0 24 24" width="22" height="22" stroke="#4fd1c5" stroke-width="2" fill="none">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                            <polyline points="17 8 12 3 7 8"></polyline>
                            <line x1="12" y1="3" x2="12" y2="15"></line>
                        </svg>
                    </div>
                    <div class="teacher-resource-info">
                        <div class="teacher-resource-name">Update Profile Picture</div>
                        <div class="teacher-resource-meta">Upload a new photo</div>
                    </div>
                    <svg viewBox="0 0 24 24" width="16" height="16" stroke="#8b949e" stroke-width="2" fill="none">
                        <polyline points="9 18 15 12 9 6"></polyline>
                    </svg>
                </div>

                <div class="teacher-resource-card" onclick="removeTeacherProfilePicture()" style="cursor:pointer;gap:14px;">
                    <div class="teacher-resource-icon">
                        <svg viewBox="0 0 24 24" width="22" height="22" stroke="#f85149" stroke-width="2" fill="none">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path>
                            <path d="M10 11v6M14 11v6"></path>
                        </svg>
                    </div>
                    <div class="teacher-resource-info">
                        <div class="teacher-resource-name" style="color:#f85149;">Remove Profile Picture</div>
                        <div class="teacher-resource-meta">Revert to initials avatar</div>
                    </div>
                    <svg viewBox="0 0 24 24" width="16" height="16" stroke="#8b949e" stroke-width="2" fill="none">
                        <polyline points="9 18 15 12 9 6"></polyline>
                    </svg>
                </div>

                <div class="teacher-resource-card" onclick="requestTeacherPush()" style="cursor:pointer;gap:14px;margin-top:8px;">
                    <div class="teacher-resource-icon">
                        <svg viewBox="0 0 24 24" width="22" height="22" stroke="#4fd1c5" stroke-width="2" fill="none">
                            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                            <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
                        </svg>
                    </div>
                    <div class="teacher-resource-info">
                        <div class="teacher-resource-name">Sync Notifications</div>
                        <div class="teacher-resource-meta">Not receiving alerts? Tap to sync</div>
                    </div>
                    <svg viewBox="0 0 24 24" width="16" height="16" stroke="#8b949e" stroke-width="2" fill="none">
                        <polyline points="9 18 15 12 9 6"></polyline>
                    </svg>
                </div>

                <div class="teacher-resource-card" onclick="window.location.href='logout.php'" style="cursor:pointer;gap:14px;margin-top:8px;">
                    <div class="teacher-resource-icon">
                        <svg viewBox="0 0 24 24" width="22" height="22" stroke="#f85149" stroke-width="2" fill="none">
                            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                            <polyline points="16 17 21 12 16 7"></polyline>
                            <line x1="21" y1="12" x2="9" y2="12"></line>
                        </svg>
                    </div>
                    <div class="teacher-resource-info">
                        <div class="teacher-resource-name" style="color:#f85149;">Sign Out</div>
                        <div class="teacher-resource-meta">Log out of your account</div>
                    </div>
                    <svg viewBox="0 0 24 24" width="16" height="16" stroke="#8b949e" stroke-width="2" fill="none">
                        <polyline points="9 18 15 12 9 6"></polyline>
                    </svg>
                </div>

            </div>
        </div>`;
};

window.removeTeacherProfilePicture = function() {
    if (!confirm('Remove your profile picture?')) return;
    fetch('upload_profile.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' , 'X-CSRF-Token': getCsrfToken() },
        body: 'remove=1'
    })
    .then(r => r.json())
    .then(data => {
        if (data.success) {
            const initials = '<?= htmlspecialchars($teacherInitials) ?>';
            const topNav = document.getElementById('topNavAvatar');
            if (topNav) topNav.innerHTML = `<span class="initials-sm">${initials}</span>`;
            const wrapper = document.querySelector('.sidebar .profile-picture-wrapper');
            if (wrapper) {
                const img = wrapper.querySelector('img.teacher-avatar');
                if (img) img.remove();
                if (!wrapper.querySelector('.initials-avatar')) {
                    const div = document.createElement('div');
                    div.className = 'initials-avatar teacher-avatar';
                    div.textContent = initials;
                    wrapper.insertBefore(div, wrapper.querySelector('#teacherProfileInput'));
                }
            }
            loadTeacherSettings();
        } else {
            alert(data.error || 'Failed to remove picture');
        }
    })
    .catch(() => alert('Connection error'));
};

// ── TEACHER NAVIGATION SEARCH ──
(function() {
    const navLinks = [
        { label: 'Home',           keywords: ['home','manual'],          action: () => { loadTeacherManual(); } },
        { label: 'Quizzes',        keywords: ['quiz','quizzes'],         action: () => { fetchTeacherQuizzes(); } },
        { label: 'Assignments',    keywords: ['assign','assignments'],   action: () => { fetchTeacherAssignments(); } },
        { label: 'Announcements',  keywords: ['announce','announcements'],action: () => { fetchTeacherAnnouncements(); } },
        { label: 'Grades',         keywords: ['grade','grades','marks'], action: () => { fetchTeacherGrades(); } },
        { label: 'Resources',      keywords: ['resource','upload'],      action: () => { fetchTeacherResources(); } },
        { label: 'Evaluations',    keywords: ['eval','evaluations'],     action: () => { fetchTeacherEvaluations(); setTopNavTab('tab-evaluations'); } },
        { label: 'Analytics',      keywords: ['analyt','analytics'],     action: () => { fetchTeacherAnalytics(); setTopNavTab('tab-analytics'); } },
        { label: 'Settings',       keywords: ['setting','settings'],     action: () => { loadTeacherSettings(); setTopNavTab('tab-settings'); } },
        { label: 'Syllabus',       keywords: ['syllab','syllabus'],      action: () => { fetchTeacherSyllabus(); setTopNavTab('tab-syllabus'); } },
        { label: 'Calendar',       keywords: ['calendar','remind'],      action: () => { fetchTeacherCalendar(); setTopNavTab('tab-calendar'); } },
    ];

    const input       = document.getElementById('teacherSearchInput');
    const suggestions = document.getElementById('teacherSearchSuggestions');
    const searchBox   = document.getElementById('teacherSearchBox');

    if (!input) return;

    // Focus styling
    input.addEventListener('focus', () => {
        searchBox.style.borderColor = '#4fd1c5';
    });
    input.addEventListener('blur', () => {
        searchBox.style.borderColor = '#30363d';
    });

    input.addEventListener('input', function() {
        const query = this.value.trim().toLowerCase();

        if (!query) {
            suggestions.style.display = 'none';
            suggestions.innerHTML = '';
            return;
        }

        const matches = navLinks.filter(link =>
            link.keywords.some(k => k.startsWith(query)) ||
            link.label.toLowerCase().startsWith(query)
        );

        if (!matches.length) {
            suggestions.style.display = 'none';
            suggestions.innerHTML = '';
            return;
        }

        suggestions.innerHTML = matches.map((m, i) => `
            <div class="teacher-search-suggestion" data-index="${i}"
                 style="display:flex;align-items:center;gap:10px;
                        padding:10px 14px;cursor:pointer;
                        font-size:13px;font-weight:700;
                        color:#c9d1d9;font-family:'Nunito',sans-serif;
                        transition:background 0.15s ease;">
                <svg viewBox="0 0 24 24" width="14" height="14"
                     stroke="#8b949e" stroke-width="2" fill="none">
                    <circle cx="11" cy="11" r="8"></circle>
                    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                </svg>
                ${m.label}
            </div>
        `).join('');

        // Hover effect
        suggestions.querySelectorAll('.teacher-search-suggestion').forEach((el, i) => {
            el.addEventListener('mouseenter', () => {
                el.style.background = '#21262d';
                el.style.color = '#e2e8f0';
            });
            el.addEventListener('mouseleave', () => {
                el.style.background = '';
                el.style.color = '#c9d1d9';
            });
            el.addEventListener('mousedown', (e) => {
                e.preventDefault(); // prevents blur firing before click
                matches[i].action();
                input.value = '';
                suggestions.style.display = 'none';
                suggestions.innerHTML = '';
            });
        });

        suggestions.style.display = 'block';
    });

    // Close on outside click
    document.addEventListener('click', function(e) {
        const wrapper = document.getElementById('teacherSearchWrapper');
        if (wrapper && !wrapper.contains(e.target)) {
            suggestions.style.display = 'none';
            suggestions.innerHTML = '';
            input.value = '';
            searchBox.style.borderColor = '#30363d';
        }
    });

    // Hide search on mobile
    const style = document.createElement('style');
    style.textContent = `
        @media (max-width: 768px) {
            #teacherSearchWrapper { display: none !important; }
        }
    `;
    document.head.appendChild(style);
})();
</script>

<script>
function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

const PUSH_VAPID_PUBLIC_KEY = <?= json_encode(getenv('VAPID_PUBLIC_KEY') ?: 'BLl4HnUrajJk2h5w4P9RlQZpiGgBCO7ZKCwVR2D_jcuvbBEDsm9eBMic1CNa-4E_aoTn4FqjhaJmgS7QIyv7C1w') ?>;

async function registerPushServiceWorker() {
    const registration = await navigator.serviceWorker.register('/service-worker.js', { scope: '/' });
    return navigator.serviceWorker.ready.then(() => registration);
}

if ('serviceWorker' in navigator) {
    let teacherUpdateReloading = false;
    const teacherHadServiceWorkerController = Boolean(navigator.serviceWorker.controller);
    navigator.serviceWorker.addEventListener('message', event => {
        if (event.data?.type !== 'iskool-update-available') return;
        // An in-app banner (assets/js/shared/pwa_prompts.js) instead of a browser pop-up. Its Update button asks the
        // waiting worker to take over; the controllerchange handler below reloads the page. If the banner script
        // has not loaded yet, it picks this flag up when it starts.
        if (window.iskoolPwa) window.iskoolPwa.offerUpdate(); else window.__iskoolUpdatePending = true;
    });
    navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!teacherHadServiceWorkerController || teacherUpdateReloading) return;
        teacherUpdateReloading = true;
        window.location.reload();
    });
}

// Saves the browser subscription so announcements/reminders can reach this teacher.
// The server identifies the signed-in user from the session; no email address
// is trusted from the browser request.
async function sendToCatcher(subscription) {
    const response = await fetch('subscribe_push.php', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRF-Token': getCsrfToken(),
        },
        body: JSON.stringify({ subscription }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.success) {
        throw new Error(data.message || data.error || 'Could not save notification subscription.');
    }
    return data;
}

/**
 * Runs when the teacher taps "Sync Notifications" in Settings.
 */
async function requestTeacherPush() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
        alert('Notifications are not supported by this browser.');
        return;
    }

    try {
        const permission = Notification.permission === 'default'
            ? await Notification.requestPermission()
            : Notification.permission;
        if (permission !== 'granted') {
            alert('Notifications are ' + permission + '. If blocked, enable them in your browser or device settings.');
            return;
        }

        const registration = await registerPushServiceWorker();
        let subscription = await registration.pushManager.getSubscription();
        if (!subscription) {
            subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(PUSH_VAPID_PUBLIC_KEY),
            });
        }
        await sendToCatcher(subscription);
        alert('Notifications are synced.');
    } catch (err) {
        console.error('Push subscription failed:', err);
        alert('Could not enable notifications. Please try Sync Notifications again.');
    }
}

/**
 * Checks if the teacher is already subscribed when the dashboard loads,
 * and silently re-saves the subscription (e.g. after a browser reinstall).
 */
document.addEventListener('DOMContentLoaded', function () {
    if ('serviceWorker' in navigator && 'PushManager' in window) {
        registerPushServiceWorker()
            .then(registration => registration.pushManager.getSubscription())
            .then(existingSub => {
                if (existingSub) return sendToCatcher(existingSub);
            })
            .catch(err => console.error('Push subscription sync failed:', err));
    }
});
</script>

<script src="assets/js/teacher/dashboard.js?v=13.8"></script>
<script src="assets/js/teacher/class-picker.js?v=1.1"></script>
<script src="assets/js/teacher/teacher_detail.js?v=1.1"></script>
<script src="assets/js/teacher/quizzes.js?v=8.7"></script>
<script src="assets/js/teacher/announcements.js?v=6.3"></script>
<script src="assets/js/teacher/evaluations.js?v=5.4"></script>
<script src="assets/js/teacher/resources.js?v=4.9"></script>
<script src="assets/js/teacher/grades.js?v=5.5"></script>
<script src="assets/js/teacher/assignments.js?v=5.6"></script>
<script src="assets/js/teacher/sbo.js?v=5.2"></script>
<script src="assets/js/teacher/analytics.js?v=4.3"></script>
<script src="assets/js/teacher/teacher_calendar.js?v=2.0"></script>
<script src="assets/js/teacher/teacher_desktop_menu.js?v=1.0"></script>
<script src="assets/js/teacher/teacher_mobile_menu.js?v=1.0"></script>
<script>window.ISKOOL_TEACHER = <?= json_encode(['name'=>$teacherFullName,'email'=>$teacherEmail,'initials'=>$teacherInitials], JSON_HEX_TAG|JSON_HEX_AMP|JSON_HEX_APOS|JSON_HEX_QUOT) ?>;</script>
<script src="assets/js/teacher/teacher_mobile_settings.js?v=1.1"></script>
<script src="assets/js/teacher/teacher_desktop_settings.js?v=1.4"></script>
<script src="assets/js/shared/pwa_prompts.js?v=1.0"></script>
<script src="assets/js/shared/pull_to_refresh.js?v=1.0"></script>
<script src="assets/js/teacher/teacher_pull_to_refresh.js?v=1.0"></script>
<script src="assets/js/shared/net_status.js?v=1.1"></script>
<script src="assets/js/teacher/teacher_net_status.js?v=1.0"></script>
<script src="assets/js/shared/back_button.js?v=1.0"></script>
<script src="assets/js/teacher/teacher_back_button.js?v=1.0"></script>
</body>
</html>