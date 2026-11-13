<?php
/**
 * iSkool - Login & Registration 
 *
 * Entry point for user authentication and account creation.
 * Features:
 * - Animated splash screen with branded loader
 * - Responsive login and registration forms with role selection
 * - Password visibility toggle
 * - Access key validation for registration
 * - Full-screen processing overlay
 * - PWA support with service worker and push notification subscription
 * - Dynamic school name display from database
 * Security: Input validation, prepared statements, secure password hashing, session management, and remember me functionality.
 *
 * @package     iSkool
 * @subpackage  Authentication
 * @author      mandlasimphiwe99@gmail.com
 * @copyright   2025 iSkool EdTech. All rights reserved.
 * @license     Proprietary - Unauthorized use prohibited
 * @version     1.1.3
 * @since       2025-12-14
 * @link        https://iskool.xyz
 */

require_once __DIR__ . '/auth/session_guard.php';

require_once 'config.php'; 
require_once __DIR__ . '/includes/app_version.php';
require_once 'check_remember_me.php';     
require_once __DIR__ . '/auth/parent_invite_functions.php';

$errors = [
    'login' => $_SESSION['login_error'] ?? '',
    'register' => $_SESSION['register_error'] ?? ''
];
$activeForm = $_SESSION['active_form'] ?? 'login';
// parent_link.php sends a new parent straight to the register form
if (($_GET['form'] ?? '') === 'register') {
    $activeForm = 'register';
}
// A parent who came from a learner's invite link has the code in a cookie (set by parent_link.php). Only its shape is
// checked here; auth/register_ajax.php checks the invite itself. The register form uses this flag to say the access
// key is not needed.
$has_parent_invite = parent_invite_is_valid_code_format($_COOKIE['pending_parent_invite'] ?? '');
$resetMessage = $_SESSION['reset_message'] ?? '';
$resetError   = $_SESSION['reset_error'] ?? '';

unset($_SESSION['login_error'], $_SESSION['register_error'], $_SESSION['active_form'], $_SESSION['reset_message'], $_SESSION['reset_error']);

function showError($error){
    return !empty($error) ? "<p class='error-message' style='color:red;'>$error</p>" : '';
}

function isActiveForm($formName, $activeForm) {
    return $formName === $activeForm ? 'active' : '';
}

$schoolName = 'My School'; // fallback only (will almost never show)

$result = $conn->query("SELECT setting_value FROM school_name WHERE setting_key = 'school_name' LIMIT 1");
if ($result && $row = $result->fetch_assoc()) {
    $schoolName = trim($row['setting_value']);
    if (empty($schoolName)) {
        $schoolName = 'My School';
    }
}


?>

<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8" />
<meta name="csrf-token" content="<?php echo htmlspecialchars($_SESSION['csrf_token']); ?>">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Login - <?= htmlspecialchars($schoolName) ?></title>

<link rel="manifest" href="/manifest.php?v=1.2">

<meta name="theme-color" content="#20201f">

<link rel="icon" type="image/svg+xml" href="/icon.svg?v=1.4">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<link rel="apple-touch-icon" href="/apple-touch-icon.png?v=1.1">
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600&display=swap" rel="stylesheet">
    <link href="https://fonts.googleapis.com/css2?family=Fraunces:wght@400;500;600&display=swap" rel="stylesheet">
    <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@700;800&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css">
    <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@600&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="assets/css/index.css?v=9.8">
    <?php require __DIR__ . '/includes/login_theme_head.php'; ?>
    <?php
    // A teacher who is already signed in saves their phone theme under their own key (the one teacher_dashboard.php builds,
    // keep the two in step), so the splash reads that one and matches the teacher waiting screen it hands over to.
    // Everyone else keeps reading the learner's key below.
    $splashPhoneThemeKey = '';
    if (($_SESSION['role'] ?? '') === 'teacher' && !empty($_SESSION['email'])) {
        $splashPhoneThemeKey = 'iskoolTeacherMobileTheme:' . hash('sha256', ($_SESSION['current_school_db'] ?? '') . '|' . $_SESSION['email']);
    }
    ?>
    <script>
    // Phone light mode (768px and below): apply the phone theme saved by the learner dashboard (or, for a signed-in teacher,
    // by the teacher dashboard) BEFORE first paint, so the splash and the login page never start dark and then flip. Dark
    // is the default. The attribute only has CSS at 768px and below (index_light.css, splash_light.css); the status bar
    // colour (theme-color above) follows it on phones.
    (function () {
        try {
            var key = <?= json_encode($splashPhoneThemeKey) ?> || window.ISKOOL_LEARNER_MOBILE_THEME_KEY || 'iskoolLearnerMobileTheme';
            var light = localStorage.getItem(key) === 'light';
            if (light) document.documentElement.setAttribute('data-login-mobile-theme', 'light');
            var meta = document.querySelector('meta[name="theme-color"]');
            var phone = window.matchMedia('(max-width: 768px)');
            var bar = function () { if (meta) meta.setAttribute('content', light && phone.matches ? '#faf9f5' : '#20201f'); };
            bar();
            if (phone.addEventListener) phone.addEventListener('change', bar);
        } catch (e) {}
    })();
    </script>

<?php if (isset($_SESSION['email']) && isset($_SESSION['role'])): ?>
    <!-- ──────────────────────────────────────────────────────────────────
         Warm-start hints for "remember me" users only.
         We already know server-side (from the session) that this visit
         is going to end at the dashboard, so we spend the 1300ms splash
         window fetching what the dashboard will need instead of leaving
         the network idle. Nothing here changes the splash timing/feel —
         it only runs in parallel with it, and only for logged-in users,
         so a first-time / logged-out visitor's page weight is unchanged.
         ────────────────────────────────────────────────────────────── -->
    <link rel="preload" as="style" href="assets/css/learner/quiz.css?v=5.2">
    <link rel="preload" as="style" href="assets/css/learner/manual.css?v=3.6">
    <link rel="preload" as="style" href="assets/css/learner/announcements.css?v=1.0">
    <link rel="preload" as="style" href="assets/css/learner/assignments.css?v=1.0">
    <link rel="preload" as="style" href="assets/css/learner/grades.css?v=1.7">
    <link rel="preload" as="style" href="assets/css/learner/resources.css?v=1.0">
    <link rel="preload" as="style" href="assets/css/learner/evaluations.css?v=2.8">
    <link rel="preload" as="style" href="assets/css/learner/learner_dashboard.css?v=6.5">
    <link rel="preload" as="style" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.2/css/all.min.css">
    <link rel="preload" as="style" href="https://fonts.googleapis.com/css2?family=Nunito:wght@600&display=swap">
    <link rel="preconnect" href="https://cdnjs.cloudflare.com">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<?php endif; ?>
    <style>
    #loader-logo svg,
    #loader-logo img {
        filter: none;
    }
    </style>
    
<script>
function getCsrfToken() {
    const meta = document.querySelector('meta[name="csrf-token"]');
    return meta ? meta.getAttribute('content') : '';
}
</script></head>
<body>
<?php require_once __DIR__ . '/rotate-lock.php'; ?>
    <!-- Animation wrapper -->
    <div id="animation-wrapper">
       <div id="loader-logo">
          <img id="splash-svg" src="/icon.svg?v=1.4" width="180" height="180" alt="iSkool logo">
          <span id="splash-wordmark">iSkool</span>
        </div>
        <div class="branding splash-version-footer">
            <img src="enthropy/wiggle_colored.svg" alt="ENTHROPY" id="splash-brand-wordmark">
        </div>
    </div>
    <!-- Login/Register container -->
    <div class="container">

        <!-- LEFT: Animated Preview Panel (desktop only) -->
        <div class="brand-panel">

            <!-- Eyebrow only above preview -->
            <div class="bp-intro">
                <div class="bp-intro-eyebrow">
                    <div id="bp-logo-svg">
                        <img src="/icon.svg?v=1.4" width="36" height="36" alt="iSkool logo">
                    </div>
                    <span class="bp-brand-name">iSkool</span>
                </div>
            </div>

            <!--
                The preview animation used to be ~700 lines of hardcoded
                cards + a matching JS state machine, inline right here.
                It now lives in its own standalone, self-contained file —
                currently animations/features/quiz-intro.html — loaded via
                iframe. Swap the src to point at a different animation
                (e.g. animations/features/login-preview.html) whenever you
                want to show something else in this slot.
            -->
            <iframe
                class="preview-frame"
                src="animations/features/quiz-intro.html"
                title="iSkool feature preview"
                scrolling="no"
                frameborder="0"
            ></iframe>

            <?php /* ───────────────────────────────────────────────────
                ORIGINAL INLINE MARKUP — kept here, commented out, only
                until the iframe version has been checked in production.
                Safe to delete this whole comment block afterwards.
            <div class="preview-wrap">

                <!-- Card 0: Typewriter Intro -->
                <div class="preview-card pv-intro-card" id="pv0">
                    <div class="pv-tw-wrap">
                        <div class="pv-tw-line" id="pv-tw1"></div>
                        <div class="pv-tw-line pv-tw-line2" id="pv-tw2"></div>
                    </div>
                </div>

                <!-- Card 1: Class Discussion -->
                <div class="preview-card" id="pv1">
                    <div class="pv-header">
                        <div class="pv-icon orange">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#e07b3a" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                        </div>
                        <div>
                            <div class="pv-title">Class discussion</div>
                            <div class="pv-sub"><span class="pv-pulse"></span> Grade 10 · Maths</div>
                        </div>
                    </div>
                    <div class="pv-chat">
                        <div class="pv-bubble user" id="pv-b1">Sir, when is the Maths test?</div>
                        <div class="pv-typing" id="pv-typing"><div class="pv-dot"></div><div class="pv-dot"></div><div class="pv-dot"></div></div>
                        <div class="pv-bubble ai" id="pv-b2">Friday 9am — Chapter 4 &amp; 5. Good luck! 📚</div>
                        <div class="pv-bubble user" id="pv-b3">Will past papers be uploaded?</div>
                        <div class="pv-bubble ai" id="pv-b4">Yes, check Resources by Thursday.</div>
                    </div>
                </div>

                <!-- Card 2: Announcements -->
                <div class="preview-card" id="pv2">
                    <div class="pv-header">
                        <div class="pv-icon blue">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#5ba4e0" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
                        </div>
                        <div>
                            <div class="pv-title">Announcements</div>
                            <div class="pv-sub">School-wide &amp; class notices</div>
                        </div>
                    </div>
                    <div class="pv-ann-item" id="pv-a1">
                        <div class="pv-ann-dot" style="background:#cf5050;"></div>
                        <div>
                            <div class="pv-ann-text"><span class="pv-ann-badge urgent">Urgent</span>Term 2 fees due 30 April</div>
                            <div class="pv-ann-meta">Bursar · 2 hrs ago</div>
                        </div>
                    </div>
                    <div class="pv-ann-item" id="pv-a2">
                        <div class="pv-ann-dot" style="background:#5ba4e0;"></div>
                        <div>
                            <div class="pv-ann-text"><span class="pv-ann-badge info">Notice</span>Library closes at 3pm this week</div>
                            <div class="pv-ann-meta">Admin · Yesterday</div>
                        </div>
                    </div>
                    <div class="pv-ann-item" id="pv-a3">
                        <div class="pv-ann-dot" style="background:#8b80d1;"></div>
                        <div>
                            <div class="pv-ann-text"><span class="pv-ann-badge event">Event</span>Science fair: Friday 2pm, Hall B</div>
                            <div class="pv-ann-meta">Mrs Dlamini · 3 days ago</div>
                        </div>
                    </div>
                </div>

                <!-- Card 3: Auto Quiz -->
                <div class="preview-card" id="pv3">
                    <div class="pv-header">
                        <div class="pv-icon purple">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8b80d1" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                        </div>
                        <div>
                            <div class="pv-title">Auto quiz</div>
                            <div class="pv-sub">Life Sciences · Grade 11</div>
                        </div>
                    </div>
                    <div class="pv-quiz-q" id="pv-qq">What is the powerhouse of the cell?</div>
                    <div class="pv-quiz-opt" id="pv-qo1"><div class="pv-quiz-circle"></div>Nucleus</div>
                    <div class="pv-quiz-opt" id="pv-qo2"><div class="pv-quiz-circle"></div>Mitochondria</div>
                    <div class="pv-quiz-opt" id="pv-qo3"><div class="pv-quiz-circle"></div>Ribosome</div>
                </div>

                <!-- Card 4: Teacher Analytics -->
                <div class="preview-card" id="pv4">
                    <div class="pv-header">
                        <div class="pv-icon green">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3ecf8e" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
                        </div>
                        <div>
                            <div class="pv-title">Teacher analytics</div>
                            <div class="pv-sub">This term's overview</div>
                        </div>
                    </div>
                    <div class="pv-stat-grid">
                        <div class="pv-stat-box"><div class="pv-stat-num" id="pv-sn1">0</div><div class="pv-stat-lbl">Learners</div></div>
                        <div class="pv-stat-box"><div class="pv-stat-num" id="pv-sn2">0</div><div class="pv-stat-lbl">Teachers</div></div>
                        <div class="pv-stat-box"><div class="pv-stat-num" id="pv-sn3">0%</div><div class="pv-stat-lbl">Attendance</div></div>
                    </div>
                    <div class="pv-bar-group">
                        <div>
                            <div class="pv-bar-lbl-row"><span>Pass rate</span><span id="pv-bl1">0%</span></div>
                            <div class="pv-bar-track"><div class="pv-bar-fill" id="pv-bf1" style="background:#3ecf8e;"></div></div>
                        </div>
                        <div>
                            <div class="pv-bar-lbl-row"><span>Submissions</span><span id="pv-bl2">0%</span></div>
                            <div class="pv-bar-track"><div class="pv-bar-fill" id="pv-bf2" style="background:#8b80d1;"></div></div>
                        </div>
                    </div>
                </div>

                <!-- Card 5: AI Invigilator -->
                <div class="preview-card" id="pv5">
                    <div class="pv-header">
                        <div class="pv-icon red">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#cf5050" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                        </div>
                        <div>
                            <div class="pv-title">AI invigilator</div>
                            <div class="pv-sub" id="pv-inv-sub">Monitoring exam session</div>
                        </div>
                    </div>
                    <div class="pv-inv-screen" id="pv-inv-screen">
                        <div class="pv-inv-grid">
                            <div class="pv-inv-face" id="pv-if1">🧑</div>
                            <div class="pv-inv-face" id="pv-if2">👩</div>
                            <div class="pv-inv-face" id="pv-if3">🧑</div>
                            <div class="pv-inv-face" id="pv-if4">👦</div>
                            <div class="pv-inv-face" id="pv-if5">👩</div>
                            <div class="pv-inv-face" id="pv-if6">🧑</div>
                        </div>
                        <div class="pv-inv-status">
                            <span id="pv-inv-badge" class="pv-inv-badge active">● LIVE</span>
                            <span style="font-size:11px;color:#444;">6 learners · Maths P1</span>
                        </div>
                    </div>
                    <div class="pv-inv-alert-row" id="pv-inv-alert">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#cf7070" stroke-width="2" stroke-linecap="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                        Suspicious activity detected — Learner 4
                    </div>
                </div>

                <!-- Card 6: Academic Calendar -->
                <div class="preview-card" id="pv6">
                    <div class="pv-header">
                        <div class="pv-icon green">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3ecf8e" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                        </div>
                        <div>
                            <div class="pv-title">Academic calendar</div>
                            <div class="pv-sub">Term 2 · April 2025</div>
                        </div>
                    </div>
                    <div class="pv-cal-month" id="pv-cal-month">April 2025</div>
                    <div class="pv-cal-grid">
                        <div class="pv-cal-day" id="pvc-1">1</div><div class="pv-cal-day" id="pvc-2">2</div>
                        <div class="pv-cal-day has-event" id="pvc-3">3</div><div class="pv-cal-day" id="pvc-4">4</div>
                        <div class="pv-cal-day" id="pvc-5">5</div><div class="pv-cal-day holiday" id="pvc-6">6</div>
                        <div class="pv-cal-day" id="pvc-7">7</div><div class="pv-cal-day" id="pvc-8">8</div>
                        <div class="pv-cal-day" id="pvc-9">9</div><div class="pv-cal-day today" id="pvc-10">10</div>
                        <div class="pv-cal-day" id="pvc-11">11</div><div class="pv-cal-day has-event" id="pvc-12">12</div>
                        <div class="pv-cal-day" id="pvc-13">13</div><div class="pv-cal-day" id="pvc-14">14</div>
                    </div>
                    <div class="pv-event-list">
                        <div class="pv-event-row" id="pv-ev1"><div class="pv-event-dot" style="background:#8b80d1;"></div><span class="pv-event-label">Grade 12 Mock Exams</span><span class="pv-event-date">Apr 3</span></div>
                        <div class="pv-event-row" id="pv-ev2"><div class="pv-event-dot" style="background:#cf5050;"></div><span class="pv-event-label">Public Holiday</span><span class="pv-event-date">Apr 6</span></div>
                        <div class="pv-event-row" id="pv-ev3"><div class="pv-event-dot" style="background:#3ecf8e;"></div><span class="pv-event-label">Parent-Teacher Meeting</span><span class="pv-event-date">Apr 12</span></div>
                    </div>
                </div>

                <!-- Card 7: Learner Dashboard -->
                <div class="preview-card" id="pv7">
                    <div class="pv-header">
                        <div class="pv-icon blue">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#5ba4e0" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>
                        </div>
                        <div>
                            <div class="pv-title">Learner dashboard</div>
                            <div class="pv-sub">Thabo M. · Grade 10</div>
                        </div>
                    </div>
                    <div class="pv-subj-grid">
                        <div class="pv-subj-row" id="pv-sr1"><div class="pv-subj-ico" style="background:#0e2e22;">📐</div><span class="pv-subj-name">Mathematics</span><div class="pv-subj-track"><div class="pv-subj-fill" id="pv-sf1" style="background:#3ecf8e;"></div></div><span class="pv-subj-pct" id="pv-sp1">0%</span><span class="pv-grade-badge a">A</span></div>
                        <div class="pv-subj-row" id="pv-sr2"><div class="pv-subj-ico" style="background:#0d1e2e;">🔬</div><span class="pv-subj-name">Life Sciences</span><div class="pv-subj-track"><div class="pv-subj-fill" id="pv-sf2" style="background:#5ba4e0;"></div></div><span class="pv-subj-pct" id="pv-sp2">0%</span><span class="pv-grade-badge b">B+</span></div>
                        <div class="pv-subj-row" id="pv-sr3"><div class="pv-subj-ico" style="background:#1c1830;">📖</div><span class="pv-subj-name">English HL</span><div class="pv-subj-track"><div class="pv-subj-fill" id="pv-sf3" style="background:#8b80d1;"></div></div><span class="pv-subj-pct" id="pv-sp3">0%</span><span class="pv-grade-badge c">B</span></div>
                        <div class="pv-subj-row" id="pv-sr4"><div class="pv-subj-ico" style="background:#2e1a0e;">🌍</div><span class="pv-subj-name">Geography</span><div class="pv-subj-track"><div class="pv-subj-fill" id="pv-sf4" style="background:#e07b3a;"></div></div><span class="pv-subj-pct" id="pv-sp4">0%</span><span class="pv-grade-badge b">B</span></div>
                    </div>
                </div>

                <!-- Card 8: Admin Dashboard -->
                <div class="preview-card" id="pv8">
                    <div class="pv-header">
                        <div class="pv-icon purple">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8b80d1" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                        </div>
                        <div>
                            <div class="pv-title">Admin dashboard</div>
                            <div class="pv-sub">School overview · Live</div>
                        </div>
                    </div>
                    <div class="pv-admin-stats">
                        <div class="pv-admin-box" id="pv-ab1"><div class="pv-admin-num" id="pv-an1">0</div><div class="pv-admin-lbl">Total Learners</div></div>
                        <div class="pv-admin-box" id="pv-ab2"><div class="pv-admin-num" id="pv-an2">0</div><div class="pv-admin-lbl">Teachers</div></div>
                        <div class="pv-admin-box" id="pv-ab3"><div class="pv-admin-num" id="pv-an3">0</div><div class="pv-admin-lbl">Active Classes</div></div>
                        <div class="pv-admin-box" id="pv-ab4"><div class="pv-admin-num" id="pv-an4">0%</div><div class="pv-admin-lbl">Avg Attendance</div></div>
                    </div>
                    <div class="pv-admin-row" id="pv-ar1"><span>System status</span><span class="pv-admin-chip ok">● Online</span></div>
                    <div class="pv-admin-row" id="pv-ar2"><span>Pending registrations</span><span style="color:#e3e3e3;font-weight:600;">12</span></div>
                    <div class="pv-admin-row" id="pv-ar3"><span>Reports generated today</span><span style="color:#e3e3e3;font-weight:600;">7</span></div>
                </div>

                <!-- Card 9: Auto Grading -->
                <div class="preview-card" id="pv9">
                    <div class="pv-header">
                        <div class="pv-icon orange">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#e07b3a" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
                        </div>
                        <div>
                            <div class="pv-title">Auto grading</div>
                            <div class="pv-sub">Maths P1 · 28 submissions</div>
                        </div>
                    </div>
                    <div class="pv-grade-header" id="pv-gh"><span class="pv-grade-title">Lerato S. · Question breakdown</span><div class="pv-grade-total"><span id="pv-gtotal">0</span><span>/50</span></div></div>
                    <div class="pv-q-row" id="pv-qr1"><span class="pv-q-num">Q1</span><div class="pv-q-bar-wrap"><div class="pv-q-bar" id="pv-qb1" style="background:#3ecf8e;"></div></div><span class="pv-q-mark correct" id="pv-qm1">0/10</span></div>
                    <div class="pv-q-row" id="pv-qr2"><span class="pv-q-num">Q2</span><div class="pv-q-bar-wrap"><div class="pv-q-bar" id="pv-qb2" style="background:#3ecf8e;"></div></div><span class="pv-q-mark correct" id="pv-qm2">0/10</span></div>
                    <div class="pv-q-row" id="pv-qr3"><span class="pv-q-num">Q3</span><div class="pv-q-bar-wrap"><div class="pv-q-bar" id="pv-qb3" style="background:#e07b3a;"></div></div><span class="pv-q-mark partial" id="pv-qm3">0/15</span></div>
                    <div class="pv-q-row" id="pv-qr4"><span class="pv-q-num">Q4</span><div class="pv-q-bar-wrap"><div class="pv-q-bar" id="pv-qb4" style="background:#cf5050;"></div></div><span class="pv-q-mark wrong" id="pv-qm4">0/15</span></div>
                </div>

                <!-- Card 10: Teacher Evaluations -->
                <div class="preview-card" id="pv10">
                    <div class="pv-header">
                        <div class="pv-icon" style="background:#1a1030;">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
                        </div>
                        <div>
                            <div class="pv-title">Teacher evaluations</div>
                            <div class="pv-sub">Rate your educators &middot; Term 2</div>
                        </div>
                    </div>
                    <div class="pv-eval-layout">
                        <div class="pv-eval-sidebar">
                            <div class="pv-eval-item active" id="pv-ev-i1">
                                <span class="pv-eval-dot pending"></span>
                                <span class="pv-eval-name">Mr Khumalo &middot; Maths</span>
                            </div>
                            <div class="pv-eval-item" id="pv-ev-i2">
                                <span class="pv-eval-dot done"></span>
                                <span class="pv-eval-name">Mrs Dlamini &middot; English</span>
                            </div>
                            <div class="pv-eval-item" id="pv-ev-i3">
                                <span class="pv-eval-dot pending"></span>
                                <span class="pv-eval-name">Mr Sithole &middot; Physics</span>
                            </div>
                        </div>
                        <div class="pv-eval-panel">
                            <div class="pv-eval-q" id="pv-eval-q">The teacher explains concepts clearly.</div>
                            <div class="pv-eval-options">
                                <div class="pv-eval-opt" id="pv-eopt1">Strongly Agree</div>
                                <div class="pv-eval-opt" id="pv-eopt2">Agree</div>
                                <div class="pv-eval-opt" id="pv-eopt3">Neutral</div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Card 11: Subject Brief & Outline -->
                <div class="preview-card" id="pv11">
                    <div class="pv-header">
                        <div class="pv-icon" style="background:#0a1e1a;">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4fd1c5" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/><line x1="12" y1="6" x2="16" y2="6"/><line x1="12" y1="10" x2="16" y2="10"/></svg>
                        </div>
                        <div>
                            <div class="pv-title">Subject brief &amp; outline</div>
                            <div class="pv-sub">Term 2 &middot; Mathematics</div>
                        </div>
                    </div>
                    <div class="pv-syl-tabs">
                        <span class="pv-syl-tab" id="pv-st1">Term 1</span>
                        <span class="pv-syl-tab active" id="pv-st2">Term 2 <span class="pv-syl-current">Current</span></span>
                        <span class="pv-syl-tab" id="pv-st3">Term 3</span>
                    </div>
                    <div class="pv-syl-card" id="pv-syl-card">
                        <div class="pv-syl-card-header">
                            <div>
                                <div class="pv-syl-subject">Mathematics</div>
                                <div class="pv-syl-teacher">Mr Khumalo</div>
                            </div>
                            <div class="pv-syl-date">Updated Apr 2</div>
                        </div>
                        <div class="pv-syl-section-lbl">Syllabus Topics</div>
                        <ul class="pv-syl-topics">
                            <li class="pv-syl-topic" id="pv-sta">Quadratic Equations</li>
                            <li class="pv-syl-topic" id="pv-stb">Functions &amp; Graphs</li>
                            <li class="pv-syl-topic" id="pv-stc">Euclidean Geometry</li>
                        </ul>
                        <div class="pv-syl-section-lbl">Assessment Weighting</div>
                        <div class="pv-syl-assess-row" id="pv-sa1">
                            <span class="pv-syl-atype">Tests</span>
                            <span class="pv-syl-apct" style="color:#4fd1c5;">40%</span>
                        </div>
                        <div class="pv-syl-abar-wrap"><div class="pv-syl-abar" id="pv-sab1" style="background:#4fd1c5;width:0%;"></div></div>
                        <div class="pv-syl-assess-row" id="pv-sa2">
                            <span class="pv-syl-atype">Assignments</span>
                            <span class="pv-syl-apct" style="color:#a78bfa;">30%</span>
                        </div>
                        <div class="pv-syl-abar-wrap"><div class="pv-syl-abar" id="pv-sab2" style="background:#a78bfa;width:0%;"></div></div>
                    </div>
                </div>

            </div>
            */ ?>

        </div>

        <!-- RIGHT: Form panel -->
        <div class="form-panel">
        <!-- School Name (desktop: shown here, replaces brand panel header) -->
        <div id="form-top-brand">
            <div id="form-school-badge">
                <div id="form-school-dot"></div>
                <span id="form-school-name"><?= htmlspecialchars($schoolName) ?></span>
            </div>
        </div>
        <!-- LOGIN FORM -->
        <div class="form-box <?= isActiveForm('login', $activeForm); ?>" id="login-form">
            <form id="login-form-el" novalidate>
                <!-- iSkool brand text -->
                <div id="iskool-brand">
                   <img src="/icon.svg?v=1.4" width="120" height="120" alt="iSkool logo">
                   <span id="iskool-brand-wordmark" class="iskool-brand-wordmark">iSkool</span>
                </div>
                <!-- AJAX error message box (hidden until an error occurs) -->
                <div class="m-head m-only"><h3>Log in</h3><p>Good to see you. Pick up where you left off.</p></div>
                <div id="login-error-box" style="display:none;background:rgba(255,77,77,0.10);border:1px solid rgba(255,77,77,0.3);color:#ff6b6b;font-size:14px;padding:11px 16px;border-radius:12px;margin-bottom:16px;text-align:center;"></div>
                <div class="field">
                    <label class="field-label" for="login-email">Email</label>
                    <input type="email" name="email" id="login-email" placeholder="name@example.com" required>
                </div>
                <div class="field">
                    <label class="field-label" for="login-password">Password</label>
                    <div class="password-wrapper">
                        <input type="password" name="password" id="login-password" placeholder="Enter your password" required>
                        <i class="fas fa-eye toggle-password" onclick="togglePassword('login-password', this)"></i>
                    </div>
                </div>
                <div class="remember-me-row" style="display: flex; align-items: center; margin: 0 0 15px 0; text-align: left;">
                  <input type="checkbox" name="remember_me" id="remember_me" style="width: 16px; height: 16px; margin: 0 10px 0 0; cursor: pointer;">
                  <label for="remember_me" style="font-size: 13px; color: #ccc; cursor: pointer; user-select: none;">Keep me logged in</label>
                </div>
                <button type="submit" id="login-btn">
                    <span class="btn-label">Login</span>
                    <span class="btn-spinner" aria-hidden="true">
                        <span></span><span></span><span></span><span></span>
                        <span></span><span></span><span></span><span></span>
                    </span>
                </button>
                <div class="m-note m-only">One login for learners, teachers, parents and school admins.</div>
                <p class="reg-link">Don't have an account? 
                   <a href="#" onclick="showForm('register-form'); return false;">Register</a>
                </p>
                <p class="forgot-p" style="text-align:center; margin-top: 8px;">
                    <a href="#" onclick="showForm('forgot-form'); return false;" style="color:#888;">Forgot your password?</a>
                </p>
            </form><!-- /#login-form-el -->
        </div>
        <!-- REGISTER FORM -->
        <div class="form-box <?= isActiveForm('register', $activeForm); ?>" id="register-form" data-cur="1">
            <form id="register-form-el" novalidate>
                <!-- iSkool brand text (mobile only — see #register-iskool-brand in CSS) -->
                <div id="register-iskool-brand" class="iskool-brand-lockup">
                   <img src="/icon.svg?v=1.4" width="120" height="120" alt="iSkool logo">
                   <span class="iskool-brand-wordmark">iSkool</span>
                </div>
                <h2>Register</h2>
                <div class="reg-prog m-only"><div><b class="on"></b><b></b><b></b></div><span id="reg-prog-t">Step 1 of 3</span></div>
                <div class="m-head m-only"><h3 id="reg-h">Who is joining?</h3><p id="reg-sub">Choose the option that fits you best.</p></div>
                <!-- AJAX error message box (hidden until an error occurs) -->
                <div id="register-error-box" style="display:none;background:rgba(255,77,77,0.10);border:1px solid rgba(255,77,77,0.3);color:#ff6b6b;font-size:14px;padding:11px 16px;border-radius:12px;margin-bottom:16px;text-align:center;"></div>

                <div class="reg-fields">
                <!-- Title + First Name + Second Name + Surname -->
                <div class="name-row">
                    <div class="field field-title">
                        <label class="field-label" for="register-title">Title</label>
                        <select name="title" id="register-title" required>
                            <option value="" disabled selected>Select</option>
                            <option value="Mr">Mr</option>
                            <option value="Mrs">Mrs</option>
                            <option value="Ms">Ms</option>
                            <option value="Dr">Dr</option>
                            <option value="Prof">Prof</option>
                            <option value="Rev">Rev</option>
                        </select>
                    </div>
                    <div class="field">
                        <label class="field-label" for="register-first-name">First name</label>
                        <input type="text" name="name" id="register-first-name" required>
                    </div>
                    <div class="field">
                        <label class="field-label" for="register-second-name">Second name</label>
                        <input type="text" name="second_name" id="register-second-name">
                    </div>
                    <div class="field">
                        <label class="field-label" for="register-surname">Surname</label>
                        <input type="text" name="surname" id="register-surname" required>
                    </div>
                </div>

                <div class="field">
                    <label class="field-label" for="register-email">Email</label>
                    <input type="email" name="email" id="register-email" placeholder="name@example.com" required>
                </div>
                <div class="field">
                    <label class="field-label" for="register-password">Password</label>
                    <div class="password-wrapper">
                        <input type="password" name="password" id="register-password" placeholder="Min. 8 characters" required minlength="8">
                        <i class="fas fa-eye toggle-password" onclick="togglePassword('register-password', this)"></i>
                    </div>
                    <div id="password-strength-msg" style="font-size:12px; color:#ff5555; margin: 6px 0 0; display:none;">Password must be at least 8 characters.</div>
                </div>
                <div class="field">
                    <label class="field-label" for="confirm-password">Confirm password</label>
                    <div class="password-wrapper">
                        <input type="password" name="confirm_password" id="confirm-password" placeholder="Re-enter your password" required>
                        <i class="fas fa-eye toggle-password" onclick="togglePassword('confirm-password', this)"></i>
                    </div>
                    <div id="password-match-msg" style="font-size:12px; color:#ff5555; margin: 6px 0 0; display:none;">Passwords do not match.</div>
                </div>

                <div class="field">
                    <label class="field-label" for="register-role">Role</label>
                    <div class="role-cards m-only"><button type="button" class="role-card" data-role="learner"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M22 10 12 5 2 10l10 5 10-5z"/><path d="M6 12v5c3 2 9 2 12 0v-5"/></svg><span><strong>Learner</strong><em>See classes, quizzes and grades</em></span></button><button type="button" class="role-card" data-role="teacher"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/></svg><span><strong>Teacher</strong><em>Run classes and assessments</em></span></button><button type="button" class="role-card" data-role="parent"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M20.8 5.6a5.2 5.2 0 0 0-7.4 0L12 7l-1.4-1.4a5.2 5.2 0 0 0-7.4 7.4L12 21.8l8.8-8.8a5.2 5.2 0 0 0 0-7.4z"/></svg><span><strong>Parent</strong><em>Follow your child's progress</em></span></button><button type="button" class="role-card" data-role="school_admin"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg><span><strong>School admin</strong><em>Manage the school's account</em></span></button></div>
                    <select name="role" id="register-role" required>
                        <option value="">-- Select Role --</option>
                        <option value="learner">Learner</option>
                        <option value="teacher">Teacher</option>
                        <option value="parent">Parent</option>
                        <option value="school_admin">Principal/School Admin</option>
                    </select>
                </div>
                <div class="field">
                    <label class="field-label" for="gender">Gender</label>
                    <select name="gender" id="gender" required>
                        <option value="" disabled selected>Select gender</option>
                        <option value="male">Male</option>
                        <option value="female">Female</option>
                        <option value="other">Other</option>
                    </select>
                </div>
                <div class="field">
                    <label class="field-label" for="age">Age</label>
                    <input type="number" name="age" id="age" min="3" max="120" required placeholder="Enter your age">
                </div>
                <div class="field">
                    <label class="field-label" for="register-access-key">Access key</label>
                    <input type="text" name="access_key" id="register-access-key" placeholder="Enter your access key" required>
                    <p id="invite-key-note" hidden style="margin:6px 0 0;font-size:12.5px;line-height:1.5;color:#8b8b86;text-align:left;">You were invited by a learner, so you do not need an access key. Leave this empty.</p>
                </div>

                <!-- NEW: Notification Agreement Checkbox -->
                <div style="margin: 15px 0; text-align: left;">
                    <label style="display: flex; align-items: flex-start; font-size: 13px; line-height: 1.5; color: #ccc; cursor: pointer;">
                        <input type="checkbox" name="agree_notifications" required style="width: 16px; height: 16px; margin: 2px 10px 0 0; padding: 0; flex-shrink: 0;">
                        <span>I agree to receive notifications for important updates, replies, announcements, and grades.</span>
                    </label>
                </div>

                </div><!-- /.reg-fields -->

                <div class="reg-nav"><button type="button" class="reg-back">Back</button><button type="button" class="reg-next">Continue</button><button type="submit" id="register-btn">Register</button></div>
                <p>Already have an account? 
                   <a href="#" onclick="showForm('login-form'); return false;">Login</a>
                </p>
            </form><!-- /#register-form-el -->
        </div>
        <!-- FORGOT PASSWORD FORM -->
        <div class="form-box <?= ($activeForm === 'forgot-form') ? 'active' : '' ?>" id="forgot-form">
            <h2>Forgot password?</h2>
            <p style="color:#888; font-size:14px; margin-bottom:20px; text-align:center;">Enter your email and we'll send you a reset link.</p>

            <div id="forgot-error-box" style="display:none;background:rgba(255,77,77,0.10);border:1px solid rgba(255,77,77,0.3);color:#ff6b6b;font-size:14px;padding:11px 16px;border-radius:12px;margin-bottom:16px;text-align:center;"></div>

            <form id="forgot-form-el" novalidate>
                <div class="field">
                    <label class="field-label" for="forgot-email">Email</label>
                    <input type="email" name="email" id="forgot-email" placeholder="name@example.com" required>
                </div>
                <button type="submit" id="forgot-btn">Send Reset Link</button>
            </form>
            <p style="text-align:center; margin-top:20px;">
                <a href="#" onclick="showForm('login-form'); return false;" style="color:#888; font-size:14px;">&#8592; Back to login</a>
            </p>
        </div>
        </div><!-- /.form-panel -->
    </div><!-- /.container -->
    <div id="loaderOverlay">
        <div class="loader-container">
            <div class="loader-book">
                <i class="fas fa-book-open"></i>
            </div>
            <div class="loader-text">Processing...</div>
        </div>
    </div>
    <script>
    // ── Form switcher ──────────────────────────────────────────────────────────
    function showForm(id) {
        document.querySelectorAll('.form-box').forEach(f => f.classList.remove('active'));
        document.getElementById(id).classList.add('active');
        const panel = document.querySelector('.form-panel');
        if (panel) panel.scrollTo({ top: 0, behavior: 'smooth' });
    }


    // Show glowing logo loader until it's actually ready, then fade out and show container + brand.
    // Instead of a fixed timer, this waits on:
    //   1) the splash logo image finishing load (near-instant once cached on repeat visits)
    //   2) a small minimum floor (200ms) so the splash never flashes on/off too fast to read
    //   3) (only when showing the login form) web fonts finishing load, so labels/icons
    //      don't visibly snap into place right after the form becomes visible
    // Whichever condition finishes last is what decides when the splash goes away.
    document.addEventListener('DOMContentLoaded', function () {
        const animationWrapper = document.getElementById('animation-wrapper');
        const container = document.querySelector('.container');
        const splashImg = document.getElementById('splash-svg');
        const MIN_SPLASH_MS = 700;

    <?php if (isset($_SESSION['email']) && isset($_SESSION['role'])): ?>
        // ──────── SPLASH HANDOFF (logged-in users) ────────
        // The dashboard paints its own copy of this exact splash the instant
        // it starts loading, so we deliberately do NOT hide #animation-wrapper
        // before navigating below — leaving it up avoids a blank flash between
        // this page and the dashboard's own splash taking over.
        // Record when the splash first appeared so the dashboard can honour
        // the *remaining* time on this same 1300ms budget instead of
        // restarting the full timer on the new page.
        try {
            sessionStorage.setItem('splashStartedAt', String(Date.now()));
        } catch (e) {}

        // ──────── WARM-START PING (splash-time only, logged-in users) ────────
        // We already know this visit ends at the dashboard. Fire a background
        // request for it right now, at the very start of the 1300ms splash,
        // so the dashboard's PHP (session check, school/year/profile/class
        // queries) and its response run *during* the splash instead of only
        // starting after we navigate. This is fire-and-forget: it never
        // touches revealApp/minFloor, so the splash duration and feel are
        // completely unchanged either way.
        try {
            fetch('dashboard', { credentials: 'same-origin' }).catch(() => {});
        } catch (e) {}
    <?php endif; ?>

        const revealApp = () => {
    // ──────── AFTER ANIMATION: CHECK IF LOGGED IN ────────
    <?php if (isset($_SESSION['email']) && isset($_SESSION['role'])): ?>
        // Do not let the splash redirect initialise a dashboard while a phone
        // is sideways. The shared portrait guard resumes this after rotation.
        // Note: animationWrapper is intentionally left visible here — see the
        // SPLASH HANDOFF comment above. The dashboard takes over the splash
        // and is responsible for hiding it once it's actually ready.
        const openDashboard = () => {
            if (window.iSkoolOrientationLock && window.iSkoolOrientationLock.isLocked()) {
                return;
            }
            // replace(), not href: same reason as after sign-in (the sign-in page must not stay below the dashboard).
            window.location.replace('dashboard');
        };
        window.addEventListener('iskool:portrait-ready', openDashboard, { once: true });
        openDashboard();
    <?php else: ?>
        // Not logged in → hide the splash and show the login form
        animationWrapper.style.display = 'none';
        document.querySelector('.form-panel').style.opacity = '1';
        container.classList.add('show');
       
    <?php endif; ?>
    // ─────────────────────────────────────────────────────
        };

        const minFloor = new Promise(resolve => setTimeout(resolve, MIN_SPLASH_MS));

        const imageReady = new Promise(resolve => {
            // .complete is true immediately if the image is already cached/loaded
            // (this is what makes repeat/warm visits skip the wait almost entirely)
            if (splashImg && splashImg.complete) {
                resolve();
            } else if (splashImg) {
                splashImg.addEventListener('load', resolve, { once: true });
                splashImg.addEventListener('error', resolve, { once: true }); // don't hang splash on a failed image
            } else {
                resolve();
            }
        });

        const baseReady = Promise.all([minFloor, imageReady]);

    <?php if (isset($_SESSION['email']) && isset($_SESSION['role'])): ?>
        // Logged in → we're about to navigate away to the dashboard, so there's
        // no point waiting on fonts here — reveal as soon as the base conditions are met.
        baseReady.then(revealApp);
    <?php else: ?>
        // Not logged in → the login form is about to become visible on this same page,
        // so also wait for its fonts/icons (Nunito, Inter, Font Awesome) to be ready —
        // otherwise labels and icons would visibly snap into place right after reveal.
        // (Falls back to just baseReady if the Font Loading API isn't supported.)
        const fontsReady = (document.fonts && document.fonts.ready) ? document.fonts.ready : Promise.resolve();
        Promise.all([baseReady, fontsReady]).then(revealApp);
    <?php endif; ?>

        const loginForm = document.getElementById('login-form');
        const registerForm = document.getElementById('register-form');
        const activeForm = "<?= $activeForm ?>";
        if (activeForm === 'login') {
            loginForm.classList.add('active');
        } else {
            registerForm.classList.add('active');
        }
    });
    // Toggle password visibility
    function togglePassword(inputId, icon) {
        const input = document.getElementById(inputId);
        if (input.type === "password") {
            input.type = "text";
            icon.classList.remove("fa-eye");
            icon.classList.add("fa-eye-slash");
        } else {
            input.type = "password";
            icon.classList.remove("fa-eye-slash");
            icon.classList.add("fa-eye");
        }
    }

    // Password validation for register form
    const regPassword = document.getElementById('register-password');
    const confirmPassword = document.getElementById('confirm-password');
    const strengthMsg = document.getElementById('password-strength-msg');
    const matchMsg = document.getElementById('password-match-msg');
    const loader = document.getElementById("loaderOverlay");

    regPassword.addEventListener('input', function() {
        if (this.value.length > 0 && this.value.length < 8) {
            strengthMsg.style.display = 'block';
        } else {
            strengthMsg.style.display = 'none';
        }
    });

    confirmPassword.addEventListener('input', function() {
        if (this.value.length > 0 && this.value !== regPassword.value) {
            matchMsg.style.display = 'block';
        } else {
            matchMsg.style.display = 'none';
        }
    });

    // Form submit handlers
    document.querySelectorAll("form").forEach(form => {
        form.addEventListener("submit", function(e) {
            // Only validate register form
            if (this.querySelector('#register-password')) {
                const pwd = regPassword.value;
                const confirmPwd = confirmPassword.value;

                if (pwd.length < 8) {
                    e.preventDefault();
                    strengthMsg.style.display = 'block';
                    regPassword.focus();
                    return;
                }
                if (pwd !== confirmPwd) {
                    e.preventDefault();
                    matchMsg.style.display = 'block';
                    confirmPassword.focus();
                    return;
                }
            }
           
        });
    });
    if ("serviceWorker" in navigator) {
        navigator.serviceWorker.register("service-worker.js")
            .then(reg => console.log("Service Worker registered", reg))
            .catch(err => console.error("Service Worker failed", err));
    }

    // The brand-panel preview animation used to run here (~430 lines
    // driving 12 cards). It now lives entirely inside
    // animations/features/login-preview.html, loaded via the iframe
    // in the brand-panel markup above — nothing to run on this page.
    </script>

    <script>
    // ── AJAX Forgot Password ───────────────────────────────────────────────────
    document.getElementById('forgot-form-el').addEventListener('submit', async function (e) {
        e.preventDefault();

        const btn      = document.getElementById('forgot-btn');
        const errorBox = document.getElementById('forgot-error-box');

        errorBox.style.display = 'none';
        errorBox.textContent   = '';

        const email = document.getElementById('forgot-email').value.trim();
        if (!email) {
            errorBox.textContent   = 'Please enter your email address.';
            errorBox.style.display = 'block';
            return;
        }

        btn.disabled    = true;
        btn.textContent = 'Sending\u2026';

        const formData = new FormData(this);

        try {
            const res  = await fetch('send_reset_link.php', { method: 'POST', headers: { 'X-CSRF-Token': getCsrfToken() }, body: formData });
            const data = await res.json();

            if (data.success) {
                showResetEmailSent();
            } else {
                errorBox.textContent   = data.message || 'Something went wrong. Please try again.';
                errorBox.style.display = 'block';
                btn.disabled    = false;
                btn.textContent = 'Send Reset Link';
            }
        } catch (err) {
            errorBox.textContent   = 'Network error. Please check your connection and try again.';
            errorBox.style.display = 'block';
            btn.disabled    = false;
            btn.textContent = 'Send Reset Link';
        }
    });

    function showResetEmailSent() {
        const forgotBox = document.getElementById('forgot-form');
        const formPanel = document.querySelector('.form-panel');

        const sentBox = document.createElement('div');
        sentBox.className = 'form-box';
        sentBox.id        = 'reset-sent-form';
        sentBox.style.cssText = 'opacity:0;transition:opacity 0.5s ease;text-align:center;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:60vh;';
        sentBox.innerHTML = `
            <i class="fas fa-paper-plane" style="font-size:3.2rem;color:#00ff99;margin-bottom:22px;filter:drop-shadow(0 0 10px rgba(0,255,153,0.35));"></i>
            <h2 style="margin-bottom:10px;">Check your inbox</h2>
            <p style="color:#888;font-size:15px;line-height:1.6;max-width:300px;margin:0 auto 32px;">
                If an account matches that address, a reset link will arrive shortly. It expires in 1 hour.
            </p>
            <a href="#" onclick="backToLoginFromReset(); return false;"
               style="display:inline-block;background:#ffffff;color:#131314;font-weight:700;font-size:15px;padding:14px 32px;border-radius:24px;text-decoration:none;">
               \u2190 Back to Login
            </a>
        `;
        formPanel.appendChild(sentBox);

        forgotBox.style.transition    = 'opacity 0.4s ease';
        forgotBox.style.opacity       = '0';
        forgotBox.style.pointerEvents = 'none';

        setTimeout(() => {
            forgotBox.classList.remove('active');
            sentBox.classList.add('active');
            requestAnimationFrame(() => { sentBox.style.opacity = '1'; });
        }, 400);
    }

    function backToLoginFromReset() {
        const sentBox   = document.getElementById('reset-sent-form');
        const forgotBox = document.getElementById('forgot-form');
        const formPanel = document.querySelector('.form-panel');

        if (sentBox) {
            sentBox.style.opacity = '0';
            setTimeout(() => {
                sentBox.remove();
                document.getElementById('forgot-form-el').reset();
                document.getElementById('forgot-btn').disabled    = false;
                document.getElementById('forgot-btn').textContent = 'Send Reset Link';
                document.getElementById('forgot-error-box').style.display = 'none';
                forgotBox.style.opacity       = '1';
                forgotBox.style.pointerEvents = '';
                forgotBox.style.transition    = '';
            }, 400);
        }
        showForm('login-form');
        if (formPanel) formPanel.scrollTo({ top: 0, behavior: 'smooth' });
    }

    // ── AJAX Login ─────────────────────────────────────────────────────────────
    document.getElementById('login-form-el').addEventListener('submit', async function (e) {
        e.preventDefault();

        const btn      = document.getElementById('login-btn');
        const errorBox = document.getElementById('login-error-box');

        // Clear any previous error
        errorBox.style.display = 'none';
        errorBox.textContent   = '';

        // Show loading state
        btn.disabled = true;
        btn.classList.add('is-loading');

        // ──────── WARM-START: dashboard static assets ────────
        // These are public files, not gated by login, so it's safe to start
        // pulling them in the background the moment the user hits submit —
        // even before we know if the login itself succeeds. If it fails,
        // we've just warmed some CSS/fonts for nothing; if it succeeds,
        // the dashboard's stylesheets are already in cache by the time the
        // redirect below lands, instead of starting cold on arrival.
        // (Doesn't touch dashboard PHP/DB — that only runs once we know
        // login succeeded, via the real navigation itself.)
        if (!window.__dashboardAssetsWarmed) {
            window.__dashboardAssetsWarmed = true;
            [
                'assets/css/learner/quiz.css?v=5.2',
                'assets/css/learner/manual.css?v=3.6',
                'assets/css/learner/announcements.css?v=1.0',
                'assets/css/learner/assignments.css?v=1.0',
                'assets/css/learner/grades.css?v=1.7',
                'assets/css/learner/resources.css?v=1.0',
                'assets/css/learner/evaluations.css?v=2.8',
                'assets/css/learner/learner_dashboard.css?v=6.5',
                'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.2/css/all.min.css',
                'https://fonts.googleapis.com/css2?family=Nunito:wght@600&display=swap'
            ].forEach(href => {
                const link = document.createElement('link');
                link.rel  = 'preload';
                link.as   = 'style';
                link.href = href;
                document.head.appendChild(link);
            });
        }

        const formData = new FormData(this);
        // Pass the remember_me checkbox value explicitly
        if (!this.querySelector('[name="remember_me"]').checked) {
            formData.delete('remember_me');
        }

        try {
            const res  = await fetch('login_ajax.php', { method: 'POST', headers: { 'X-CSRF-Token': getCsrfToken() }, body: formData });
            const data = await res.json();

            if (data.success) {
                // Keep the dimmed + spinner state going right up until the redirect fires.
                // replace(), not href: the sign-in page must not stay in the history below the dashboard, or the
                // phone's Back button from Home lands on it and it sends the person straight back in.
                window.location.replace(data.redirect);
            } else {
                // Show error inline — no page reload
                errorBox.textContent   = data.message || 'Something went wrong. Please try again.';
                errorBox.style.display = 'block';
                // Scroll error into view on mobile
                errorBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                btn.disabled = false;
                btn.classList.remove('is-loading');
            }
        } catch (err) {
            errorBox.textContent   = 'Network error. Please check your connection and try again.';
            errorBox.style.display = 'block';
            btn.disabled = false;
            btn.classList.remove('is-loading');
        }
    });

    // ── AJAX Register ───────────────────────────────────────────────────────────
    document.getElementById('register-form-el').addEventListener('submit', async function (e) {
        e.preventDefault();

        const btn      = document.getElementById('register-btn');
        const errorBox = document.getElementById('register-error-box');

        // Clear previous error
        errorBox.style.display = 'none';
        errorBox.textContent   = '';

        // Client-side password checks before hitting the server
        const pwd     = document.getElementById('register-password').value;
        const confirm = document.getElementById('confirm-password').value;

        if (pwd.length < 8) {
            errorBox.textContent   = 'Password must be at least 8 characters long.';
            errorBox.style.display = 'block';
            errorBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            return;
        }
        if (pwd !== confirm) {
            errorBox.textContent   = 'Passwords do not match. Please try again.';
            errorBox.style.display = 'block';
            errorBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            return;
        }

        btn.disabled    = true;
        btn.textContent = 'Registering…';

        const formData = new FormData(this);

        try {
            const res  = await fetch('register_ajax.php', { method: 'POST', headers: { 'X-CSRF-Token': getCsrfToken() }, body: formData });
            const data = await res.json();

            if (data.success) {
                showRegistrationSuccess(!!data.linked);
            } else {
                errorBox.textContent   = data.message || 'Registration failed. Please try again.';
                errorBox.style.display = 'block';
                errorBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                btn.disabled    = false;
                btn.textContent = 'Register';
            }
        } catch (err) {
            errorBox.textContent   = 'Network error. Please check your connection and try again.';
            errorBox.style.display = 'block';
            btn.disabled    = false;
            btn.textContent = 'Register';
        }
    });

    // ── Guided register (3 steps). Shared by mobile + desktop; CSS decides the layout. ──
    (function () {
        const f = document.getElementById('register-form'), fe = document.getElementById('register-form-el');
        const eb = document.getElementById('register-error-box'), sel = document.getElementById('register-role');
        // Came from a learner's invite link: a parent does not need the access key
        const FROM_INVITE = <?= $has_parent_invite ? 'true' : 'false' ?>;
        const keyInput = document.getElementById('register-access-key'), inviteNote = document.getElementById('invite-key-note');
        const usesInvite = () => FROM_INVITE && sel.value === 'parent';
        const T = [['Who is joining?', 'Choose the option that fits you best.'], ['Tell us about you', 'We use this to set up your profile.'], ['Set up your login', 'Last step. Your school gave you an access key.']];
        const tag = (id, step, order, half) => { const el = document.getElementById(id).closest('.field'); el.dataset.step = step; el.dataset.o = order; if (half) el.dataset.half = 1; };
        tag('register-role', 1, 1); tag('register-title', 2, 1, 1); tag('gender', 2, 2, 1); tag('register-first-name', 2, 3); tag('register-surname', 2, 4); tag('register-second-name', 2, 5, 1); tag('age', 2, 6, 1);
        tag('register-email', 3, 1); tag('register-password', 3, 2); tag('confirm-password', 3, 3); tag('register-access-key', 3, 4);
        const ag = fe.querySelector('input[name="agree_notifications"]').closest('div'); ag.dataset.step = 3; ag.dataset.o = 5;
        const go = k => {
            f.dataset.cur = k; eb.style.display = 'none';
            f.querySelectorAll('.reg-prog b').forEach((b, i) => b.className = i < k ? 'on' : '');
            document.getElementById('reg-prog-t').textContent = 'Step ' + k + ' of 3';
            document.getElementById('reg-h').textContent = T[k - 1][0];
            document.getElementById('reg-sub').textContent = (k === 3 && usesInvite()) ? 'Last step. Your invite means you do not need an access key.' : T[k - 1][1];
            const pnl = document.querySelector('.form-panel'); if (pnl) pnl.scrollTo({ top: 0 });
        };
        const sync = () => f.querySelectorAll('.role-card').forEach(c => c.classList.toggle('on', c.dataset.role === sel.value));
        const syncInvite = () => {
            const on = usesInvite();
            inviteNote.hidden = !on;
            keyInput.required = !on;
            keyInput.placeholder = on ? 'Not needed with an invite link' : 'Enter your access key';
        };
        sel.addEventListener('change', syncInvite);
        f.querySelectorAll('.role-card').forEach(c => c.addEventListener('click', () => { sel.value = c.dataset.role; sync(); syncInvite(); eb.style.display = 'none'; }));
        if (FROM_INVITE && !sel.value) { sel.value = 'parent'; sync(); }
        syncInvite();
        const bad = msg => { eb.textContent = msg; eb.style.display = 'block'; };
        f.querySelector('.reg-next').addEventListener('click', () => {
            const k = +f.dataset.cur;
            if (k === 1 && !sel.value) return bad('Please choose who is joining.');
            if (k === 2 && !['register-title', 'gender', 'register-first-name', 'register-surname', 'age'].every(i => document.getElementById(i).value.trim())) return bad('Please fill in your title, gender, name, surname and age.');
            go(k + 1);
        });
        f.querySelector('.reg-back').addEventListener('click', () => go(Math.max(1, +f.dataset.cur - 1)));
        fe.addEventListener('reset', () => setTimeout(() => { sync(); syncInvite(); go(1); }));
    })();

    // ── Inline registration success (no page reload) ─────────────────────────
    function showRegistrationSuccess(linked) {
        // Inject a hidden success form-box into the form panel
        const formPanel = document.querySelector('.form-panel');

        // Build the success card matching the app's style
        const successBox = document.createElement('div');
        successBox.className = 'form-box';
        successBox.id        = 'success-form';
        successBox.style.cssText = 'opacity:0;transition:opacity 0.5s ease;text-align:center;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:60vh;';
        successBox.innerHTML = `
            <i class="fas fa-check-circle" style="font-size:3.2rem;color:#00ff99;margin-bottom:22px;filter:drop-shadow(0 0 10px rgba(0,255,153,0.4));"></i>
            <h2 style="margin-bottom:10px;">You're registered!</h2>
            <p id="success-text" style="color:#888;font-size:15px;line-height:1.6;max-width:300px;margin:0 auto 30px;">
                Your account has been created. Taking you to login…
            </p>
            <div style="width:100%;max-width:280px;background:#2a2a28;border-radius:99px;height:3px;overflow:hidden;">
                <div id="success-progress-bar" style="height:100%;width:0%;background:#00ff99;border-radius:99px;transition:width 3s linear;"></div>
            </div>
        `;
        if (linked) {
            successBox.querySelector('#success-text').textContent = 'Your account has been created and your child is linked. Taking you to login…';
        }
        formPanel.appendChild(successBox);

        // Fade out the register form, fade in the success card
        const registerBox = document.getElementById('register-form');
        registerBox.style.transition = 'opacity 0.4s ease';
        registerBox.style.opacity    = '0';
        registerBox.style.pointerEvents = 'none';

        setTimeout(() => {
            registerBox.classList.remove('active');
            successBox.classList.add('active');
            // Kick off fade-in
            requestAnimationFrame(() => {
                successBox.style.opacity = '1';
                // Start the progress bar after a tiny delay so CSS transition fires
                setTimeout(() => {
                    document.getElementById('success-progress-bar').style.width = '100%';
                }, 60);
            });
        }, 400);

        // After 3 seconds switch to login form, remove success card
        setTimeout(() => {
            successBox.style.opacity = '0';
            setTimeout(() => {
                successBox.remove();
                // Reset register form opacity so it's usable if they ever come back
                registerBox.style.opacity      = '1';
                registerBox.style.pointerEvents = '';
                registerBox.style.transition    = '';
                // Also reset the register form fields and button
                document.getElementById('register-form-el').reset();
                document.getElementById('register-btn').disabled    = false;
                document.getElementById('register-btn').textContent = 'Register';
                // Show the login form
                showForm('login-form');
                // Scroll the panel back to the top
                if (formPanel) formPanel.scrollTo({ top: 0, behavior: 'smooth' });
            }, 500);
        }, 3500);
    }
    </script>
</body>
</html>