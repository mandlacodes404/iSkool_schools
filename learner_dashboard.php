<?php
/**
 * iSkool - Learner Dashboard
 *
 * Main interface for logged-in learners. Provides navigation to all learner features,
 * including quizzes, assignments, grades, resources, announcements, and teacher evaluations.
 * Features:
 * - Responsive sidebar with collapsible mode and mobile support
 * - Dynamic school branding (name and logo)
 * - Class joining workflow with one-time selection
 * - Parent linking functionality
 * - Profile picture upload
 * - iframe-based content loading with navigation highlighting
 * - Mobile bottom navigation bar
 * - Full-screen processing loader
 *
 * @package     iSkool
 * @subpackage  Learner
 * @author      mandlasimphiwe99@gmail.com
 * @copyright   2025 iSkool EdTech. All rights reserved.
 * @license     Proprietary - Unauthorized use prohibited
 * @version     1.1.3
 * @since       2025-12-14
 * @link        https://iskool.xyz
 */

// Pilot Program - Simulated Tweak 2026
//New work-flow
ob_start();
error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);
ini_set('error_log', 'php_errors.log');

require_once __DIR__ . '/auth/session_guard.php';
require_once 'config.php';
require_once __DIR__ . '/includes/app_version.php';

// ──────────────────────────────────────────────────────────────────
//        Security: Only logged in + correct role 
//──────────────────────────────────────────────────────────────────
if (!isset($_SESSION['email']) || $_SESSION['role'] !== 'learner') {
    header("Location: index.php");
    exit();
}


$learnerEmail = $_SESSION['email'];

//──────────────────────────────────────────────────────────────────
//           Get learner school name + logo
//──────────────────────────────────────────────────────────────────
$schoolName = 'My School'; // fallback only
$schoolLogo = null; // null = no logo uploaded yet -> show initials avatar instead
$result = $conn->query("SELECT setting_value, school_logo FROM school_name WHERE setting_key = 'school_name' LIMIT 1");
if ($row = $result->fetch_assoc()) {
    $schoolName = $row['setting_value'];
    $logoPath   = trim((string)($row['school_logo'] ?? ''));

    // Treat the shared default placeholder as "not uploaded".
    $isDefaultPlaceholder = ($logoPath === '' || stripos($logoPath, 'default_school.png') !== false);

    // A path saved in the DB doesn't guarantee the file is still there
    // (deleted upload, bad path, etc). Verify it actually exists on disk —
    // otherwise the <img> just shows the browser's broken-image icon
    // instead of falling back to the initials avatar.
    $logoFileExists = false;
    if (!$isDefaultPlaceholder) {
        $logoRelative    = ltrim(str_replace('\\', '/', $logoPath), '/');
        $logoFullPath    = __DIR__ . '/' . $logoRelative;
        $logoFileExists  = is_file($logoFullPath);
    }

    if (!$isDefaultPlaceholder && $logoFileExists) {
        $schoolLogo = $logoPath;
    }
}

// Build 2-letter school initials from the first two words of the school name
// e.g. "Landulwazi Highschool" -> LH, "Thoko Thaba Highschool" -> TT
$schoolNameWords = preg_split('/\s+/', trim($schoolName), -1, PREG_SPLIT_NO_EMPTY);
$schoolInitials  = '';
foreach (array_slice($schoolNameWords, 0, 2) as $word) {
    $schoolInitials .= strtoupper(substr($word, 0, 1));
}
if ($schoolInitials === '') { $schoolInitials = '??'; }

//──────────────────────────────────────────────────────────────────────────────
//        Get current active academic year (no school_id needed) 
//──────────────────────────────────────────────────────────────────────────────
$currentYearResult = $conn->query("SELECT id, name FROM academic_years WHERE is_current = 1 LIMIT 1");
if ($currentYearResult->num_rows === 0) {
    $currentYearName = "Current Year";
    $currentYearId   = 0;
} else {
    $year            = $currentYearResult->fetch_assoc();
    $currentYearId   = $year['id'];
    $currentYearName = $year['name'];
}

//──────────────────────────────────────────────────────────────────────────────
//                     Handle class join 
//──────────────────────────────────────────────────────────────────────────────
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['join_class'])) {
    require_once __DIR__ . '/auth/csrf_helper.php';
    verify_csrf_token();

    $classId = (int)$_POST['class_id'];

    // Prevent duplicate join
    $check = $conn->prepare("SELECT 1 FROM class_students WHERE student_email = ? AND class_id = ?");
    if ($currentYearId > 0) {
        $check = $conn->prepare("SELECT 1 FROM class_students WHERE student_email = ? AND class_id = ? AND academic_year_id = ?");
        $check->bind_param("sii", $learnerEmail, $classId, $currentYearId);
    } else {
        $check->bind_param("si", $learnerEmail, $classId);
    }
    $check->execute();
    if ($check->get_result()->num_rows === 0) {
        if ($currentYearId > 0) {
            $insert = $conn->prepare("INSERT INTO class_students (student_email, class_id, academic_year_id) VALUES (?, ?, ?)");
            $insert->bind_param("sii", $learnerEmail, $classId, $currentYearId);
        } else {
            $insert = $conn->prepare("INSERT INTO class_students (student_email, class_id) VALUES (?, ?)");
            $insert->bind_param("si", $learnerEmail, $classId);
        }
        $insert->execute();
        $insert->close();
    }
    $check->close();
    header("Location: learner_dashboard.php");
    exit();
}


//────────────────────────────────────────────────────────────────────────
//         Learner profile info 
//────────────────────────────────────────────────────────────────────────
// Default fallback values from session
$learnerName           = $_SESSION['name'] ?? '';
$learnerSurname        = '';
$learnerProfilePicture = 'default.png';

$stmt = $conn->prepare("SELECT name, surname, profile_picture, gender FROM users WHERE email = ?");
$stmt->bind_param("s", $learnerEmail);
$stmt->execute();
$res = $stmt->get_result();

$learnerGender = '';
if ($row = $res->fetch_assoc()) {
    $learnerName           = $row['name'] ?: $learnerName;
    $learnerSurname        = $row['surname'] ?: '';
    $learnerProfilePicture = $row['profile_picture'] ?: 'default.png';
    $learnerGender         = $row['gender'] ?: '';
}
$stmt->close();

// 2. Generate Full Name (Mandla Mahlangu)
$learnerFullName = trim($learnerName . ' ' . $learnerSurname);

// 3. Generate Initials (MM)
$firstInitial = !empty($learnerName) ? strtoupper(substr(trim($learnerName), 0, 1)) : '';
$lastInitial  = !empty($learnerSurname) ? strtoupper(substr(trim($learnerSurname), 0, 1)) : '';
$initials     = $firstInitial . $lastInitial;

// Fallback if somehow both are empty
if (empty($initials)) { $initials = "??"; }

//────────────────────────────────────────────────────────────────────────────────────
//         Get all classes available in this school  
//────────────────────────────────────────────────────────────────────────────────────
$classesStmt = $conn->prepare("SELECT id, name FROM classes ORDER BY name ASC");
$classesStmt->execute();
$classesResult = $classesStmt->get_result();

$allClasses = [];
while ($row = $classesResult->fetch_assoc()) {
    $allClasses[] = $row;
}
$classesStmt->close();
$classes = $allClasses;

//──────────────────────────────────────────────────────────────────────
//         Get classes the learner has already joined 
//─────────────────────────────────────────────────────────────────────
$joinedClassIds = [];
if ($currentYearId > 0) {
    $joinedStmt = $conn->prepare("SELECT class_id FROM class_students WHERE student_email = ? AND academic_year_id = ?");
    $joinedStmt->bind_param("si", $learnerEmail, $currentYearId);
} else {
    $joinedStmt = $conn->prepare("SELECT class_id FROM class_students WHERE student_email = ?");
    $joinedStmt->bind_param("s", $learnerEmail);
}
$joinedStmt->execute();
$joinedResult = $joinedStmt->get_result();
while ($row = $joinedResult->fetch_assoc()) {
    $joinedClassIds[] = $row['class_id'];
}
$joinedStmt->close();

//────────────────────────────────────────────────────────────────────────
//           Parent linking (only if learner is in a class) 
//────────────────────────────────────────────────────────────────────────
$parentLink     = null;
$parentsInClass = [];

if (!empty($joinedClassIds)) {
    $classId = $joinedClassIds[0]; // learner can only be in one class

    // Check if already linked to a parent
    $linkStmt = $conn->prepare("SELECT parent_email FROM parent_links WHERE learner_email = ? AND class_id = ?");
    $linkStmt->bind_param("si", $learnerEmail, $classId);
    $linkStmt->execute();
    if ($res = $linkStmt->get_result()->fetch_assoc()) {
        $parentLink = $res['parent_email'];
    }
    $linkStmt->close();

    // Get all parents in this class
    $parentStmt = $conn->prepare("
        SELECT u.email, u.name 
        FROM parent_classes pc 
        JOIN users u ON pc.parent_email = u.email 
        WHERE pc.class_id = ? AND u.role = 'parent'
        ORDER BY u.name
    ");
    $parentStmt->bind_param("i", $classId);
    $parentStmt->execute();
    $parentsResult = $parentStmt->get_result();
    while ($row = $parentsResult->fetch_assoc()) {
        $parentsInClass[] = $row;
    }
    $parentStmt->close();
}
?>
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="csrf-token" content="<?php echo htmlspecialchars($_SESSION['csrf_token']); ?>">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>Dashboard - <?= htmlspecialchars($schoolName) ?></title>
    <link rel="icon" type="image/svg+xml" href="/icon.svg?v=1.4">
    <link rel="stylesheet" href="assets/css/learner/quiz.css?v=5.5">
    <link rel="stylesheet" href="assets/css/learner/manual.css?v=7.6">
    <link rel="stylesheet" href="assets/css/learner/announcements.css?v=3.0">
    <link rel="stylesheet" href="assets/css/learner/assignments.css?v=2.8">
    <link rel="stylesheet" href="assets/css/pill-loader.css?v=1.0">
    <link rel="stylesheet" href="assets/css/learner/grades.css?v=2.9">
    <link rel="stylesheet" href="assets/css/learner/resources.css?v=2.1">
     <link rel="stylesheet" href="assets/css/learner/evaluations.css?v=4.2">
     <link rel="stylesheet" href="assets/css/learner/learner_dashboard.css?v=13.3">
    <meta name="theme-color" content="#20201f">
    <meta name="mobile-web-app-capable" content="yes">
    <meta name="application-name" content="iSkool">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-status-bar-style" content="black">
    <meta name="msapplication-navbutton-color" content="#20201f">
    <link rel="manifest" href="/manifest.php?v=1.1">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.2/css/all.min.css" integrity="sha512-z3gLpd7yknf1YoNbCzqRKc4qyor8gaKU1qmn+CShxbuBusANI9QpRohGBreCFkKxLhei6S9CQXFEbbKuqLg0DA==" crossorigin="anonymous" referrerpolicy="no-referrer" />
    <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@600&family=Fraunces:opsz,wght@9..144,500;9..144,600&display=swap" rel="stylesheet">
    
<script>
function getCsrfToken() {
    const meta = document.querySelector('meta[name="csrf-token"]');
    return meta ? meta.getAttribute('content') : '';
}
</script></head>
<body>
<?php require_once __DIR__ . '/rotate-lock.php'; ?>

<!-- ──────── SPLASH HANDOFF ────────
     Continues the splash started on index.php so there's no blank flash
     between the login page redirecting here and the dashboard being ready.
     Hidden by dash-splash-init.js below once the dashboard's home content
     has actually finished loading AND the original 700ms splash budget
     (tracked from index.php) has elapsed. If a visitor lands here directly
     (no sessionStorage flag set — e.g. a plain refresh), the init script
     hides this immediately so it never shows on its own. -->
<style id="dash-splash-bg-override">
    /* The dashboard's own background is #20201f (used across sidebar,
       header, content area — see learner_dashboard.css). Without this,
       that shows through as a flash around/under the splash during initial
       paint and again during the fade-out transition, since #dash-splash
       itself is #0a0a0a on desktop / #20201f on mobile (matching
       index.php's own desktop/mobile split — see the comment above
       #dash-splash in learner_dashboard.css for why those differ).
       Match body's background to whichever the splash is currently using;
       dash-splash-init.js removes this <style> tag once the splash finishes
       hiding, handing background control back to the normal dashboard
       theme. */
    body { background-color: #0a0a0a !important; }
    @media (max-width: 899px) {
        body { background-color: #20201f !important; }
    }
</style>
<div id="dash-splash">
    <div id="dash-splash-logo">
        <img src="/icon.svg?v=1.4" width="180" height="180" alt="iSkool logo">
        <span id="dash-splash-wordmark">iSkool</span>
    </div>
    <img src="enthropy/enthropy_wordmark.svg" alt="ENTHROPY" id="dash-splash-brand-wordmark">
</div>
<script>
// ──────── SPLASH HANDOFF: hide once home is actually ready ────────
// Waits on TWO things, whichever finishes last:
//   1) the remaining time on the 1300ms budget index.php already started
//      (so total splash time across both pages stays ~1300ms, not 2600ms)
//   2) home content actually being ready — either the 'iskool:home-ready'
//      event (fired by afterHomeRender() in manual.js once Home's fetches
//      resolve and render) or the mainFrame iframe's 'load' event, whichever
//      applies to how this visit's Home content ends up loading.
// A hard MAX_SPLASH_MS ceiling guarantees the splash is never stuck up
// forever if something above fails silently.
(function () {
    var splash = document.getElementById('dash-splash');
    if (!splash) return;

    function removeBgOverride() {
        var styleTag = document.getElementById('dash-splash-bg-override');
        if (styleTag) styleTag.remove();
    }

    var startedAtRaw = null;
    try { startedAtRaw = sessionStorage.getItem('splashStartedAt'); } catch (e) {}

    // No handoff flag → we didn't arrive here via the login splash (e.g. a
    // plain refresh on the dashboard). Don't show a splash of our own.
    if (!startedAtRaw) {
        splash.style.display = 'none';
        removeBgOverride();
        return;
    }
    try { sessionStorage.removeItem('splashStartedAt'); } catch (e) {}

    var MIN_SPLASH_MS = 1300;
    var MAX_SPLASH_MS = 6000; // safety ceiling — never hang forever
    var elapsed = Date.now() - parseInt(startedAtRaw, 10);
    var remaining = Math.max(0, MIN_SPLASH_MS - elapsed);

    var hidden = false;
    function hideSplash() {
        if (hidden) return;
        hidden = true;
        splash.classList.add('dash-splash-hidden');
        // Hand background control back to the normal dashboard theme only
        // once the splash's own fade-out (see .dash-splash-hidden transition
        // in learner_dashboard.css) has finished, so the black/near-black
        // seam never becomes visible mid-fade either.
        setTimeout(function () {
            splash.style.display = 'none';
            removeBgOverride();
        }, 400);
    }

    var minFloor = new Promise(function (resolve) { setTimeout(resolve, remaining); });
    var homeReady = new Promise(function (resolve) {
        window.addEventListener('iskool:home-ready', resolve, { once: true });
        // The #mainFrame iframe is defined further down in the body, so it
        // doesn't exist yet at this point in the initial top-of-body script —
        // wait for DOMContentLoaded before attaching its 'load' listener.
        document.addEventListener('DOMContentLoaded', function () {
            var frame = document.querySelector('iframe[name="mainFrame"]');
            if (frame) frame.addEventListener('load', resolve, { once: true });
        }, { once: true });
    });

    Promise.all([minFloor, homeReady]).then(hideSplash);
    setTimeout(hideSplash, MAX_SPLASH_MS);
})();
</script>
<script>
// A dashboard opened while a phone is sideways may already have selected the
// desktop home layout. Rebuild it once portrait is restored.
if (window.iSkoolOrientationLock && window.iSkoolOrientationLock.wasLockedAtLoad) {
    window.addEventListener('iskool:portrait-ready', function () {
        window.location.reload();
    }, { once: true });
}
</script>
<?php $currentPage = basename($_SERVER['PHP_SELF']); ?>

<div class="sidebar">
    
    <div class="sidebar-header" style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 15px;">
        
        <div class="profile-picture-wrapper" style="position:relative; display:inline-block; cursor:pointer;" onclick="if(typeof loadLearnerSettings === 'function') loadLearnerSettings(); if(typeof toggleSidebar === 'function') toggleSidebar(true);">
            <?php if ($learnerProfilePicture && $learnerProfilePicture !== 'default.png'): ?>
                <img src="uploads/learners/<?= htmlspecialchars($learnerProfilePicture) ?>" 
                     alt="Profile Picture" 
                     class="learner-avatar"
                     style="width:40px; height:40px; border-radius:50%; object-fit:cover; border:none;">
            <?php else: ?>
                <div class="initials-avatar">
                    <?= htmlspecialchars($initials) ?>
                </div>
            <?php endif; ?>
            <input type="file" id="profileInput" accept="image/*" style="display:none;">
        </div>

        <button type="button" class="desktop-close-btn" onclick="toggleSidebar(true)" aria-label="Close Menu">
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
         stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2"></rect>
        <line x1="7" y1="3" x2="7" y2="21"></line>
    </svg>
</button>
    </div>

    <div class="learner-name"><?= htmlspecialchars($learnerFullName) ?></div>  
    <div class="learner-email"><?= htmlspecialchars($learnerEmail ?: '') ?></div>

    <div class="sidebar-links" style="margin-top:50px;">
      <a href="javascript:void(0)" class="desktop-only" onclick="loadManual();" data-page="partials/manual.html" id="nav-home-sidebar">
           <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:20px; height:20px; margin-right:10px;">
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
    <polyline points="9 22 9 12 15 12 15 22"/>
</svg><span>Home</span>
        </a>

        <a href="javascript:void(0)" onclick="fetchQuizzes(); updateHeaderTitle('Quizzes')" data-page="quiz_list.php" class="desktop-only" id="nav-quiz-sidebar">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg><span>Quiz</span>
        </a>

        <a href="javascript:void(0)" onclick="fetchAssignments(); updateHeaderTitle('Assignments')" data-page="assignment_list.php" class="desktop-only" id="nav-assignments-sidebar">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 12h6"/><path d="M9 16h6"/><rect x="4" y="4" width="16" height="16" rx="2"/></svg><span>Assignments</span>
        </a>

       <a href="javascript:void(0)" onclick="fetchResources(); updateHeaderTitle('Resources')" data-page="resource_list.php" class="desktop-only" id="nav-resources-sidebar">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg><span>Resources</span>
        </a>

        <a href="javascript:void(0)"
   onclick="fetchGrades(); updateHeaderTitle('Gradebook')"
   data-page="grades" id="nav-grades-sidebar">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
         stroke-linecap="round" stroke-linejoin="round">
        <line x1="18" y1="20" x2="18" y2="10"/>
        <line x1="12" y1="20" x2="12" y2="4"/>
        <line x1="6"  y1="20" x2="6"  y2="14"/>
    </svg>
    <span>Gradebook</span>
</a>

        <a href="javascript:void(0)" onclick="fetchAnnouncements(); updateHeaderTitle('Announcements')" data-page="announcement_list.php" id="nav-announcements-sidebar">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg><span>Announcements</span>
        </a>

        <a href="javascript:void(0)" onclick="fetchEvaluations(); updateHeaderTitle('Evaluations')" data-page="evaluation_list.php" id="nav-evaluations-sidebar">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15 8 21 9 17 14 18 21 12 18 6 21 7 14 3 9 9 8 12 2"/></svg><span>Evaluations</span>
        </a>

        <a href="javascript:void(0)" onclick="fetchSyllabus()" data-page="syllabus" id="nav-syllabus-sidebar">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
         stroke-linecap="round" stroke-linejoin="round">
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
        <line x1="12" y1="6" x2="16" y2="6"/>
        <line x1="12" y1="10" x2="16" y2="10"/>
        <line x1="12" y1="14" x2="16" y2="14"/>
    </svg>
    <span>Syllabus</span>
</a>
        <a href="javascript:void(0)" onclick="fetchDiscussions(); updateHeaderTitle('Discussions')" data-page="discussion_list.php" class="mobile-only-discussions" id="nav-discussions-sidebar">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg><span>Discussions</span>
        </a>

        <a href="javascript:void(0)" onclick="return openLearnerCalendar(event)" data-page="learner_calendar" class="mobile-only-calendar" id="nav-calendar-sidebar">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2"></rect>
                <line x1="16" y1="2" x2="16" y2="6"></line>
                <line x1="8" y1="2" x2="8" y2="6"></line>
                <line x1="3" y1="10" x2="21" y2="10"></line>
            </svg>
            <span>Calendar</span>
        </a>

        <?php if (empty($joinedClassIds)): ?>
            <button type="button" onclick="toggleJoinClassForm()" data-page="join-class" id="nav-joinclass-sidebar"
                    class="<?= $currentPage === 'learner_dashboard.php' && !empty($_GET['join']) ? 'active' : '' ?>">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg><span>Join a Class</span>
            </button>
            <div class="join-class-form" id="joinClassForm" style="display: none;">
                <p style="color: var(--warning-color); font-weight: bold; font-size: 14px;">
                    Warning: You can only choose your class *once*. Make sure you select the correct one.
                </p>
                <form method="POST">
                    <input type="hidden" name="csrf_token" value="<?php echo htmlspecialchars($_SESSION['csrf_token']); ?>">
                    <select name="class_id" required>
                        <option value="">-- Select Class --</option>
                        <?php foreach ($classes as $c): ?>
                            <option value="<?= $c['id'] ?>"><?= htmlspecialchars($c['name']) ?></option>
                        <?php endforeach; ?>
                    </select>
                    <button type="submit" name="join_class" class="join-class-btn">Join Class</button>
                </form>
            </div>
        <?php else: ?>
            <button type="button" onclick="showMyClass()" data-page="my-class" class="my-class-btn" id="nav-myclass-sidebar">
               <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg><span>My Class</span>
            </button>
            <div class="join-status">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <path d="M20 6L9 17l-5-5"></path>
                </svg>
                <span>Joined Class</span>
            </div>
        <?php endif; ?>
    </div>

    <div class="footer" style="font-size:15px;"><span><strong><?= htmlspecialchars(iskool_app_version_label()) ?></strong></span></div>
</div>

<div class="main-content">
  
    <div class="main-header">
    
    <div id="headerLeft" style="flex: 1; display: flex; align-items: center;">
        <button id="mobileToggle" onclick="toggleSidebar()" aria-label="Toggle Mobile Menu">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                <line x1="3" y1="12" x2="21" y2="12"></line>
                <line x1="3" y1="6" x2="21" y2="6"></line>
                <line x1="3" y1="18" x2="21" y2="18"></line>
            </svg>
        </button>

       <button id="desktopMenuToggle" type="button" aria-label="Open Desktop Menu">
    <svg viewBox="0 0 24 24" width="22" height="22" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round">
        <line x1="3" y1="12" x2="21" y2="12"></line>
        <line x1="3" y1="6" x2="21" y2="6"></line>
        <line x1="3" y1="18" x2="21" y2="18"></line>
    </svg>
</button>

        <button id="headerBackBtn" type="button" style="display: none; background: none; border: none; color: inherit; cursor: pointer; padding: 5px;" onclick="return window.handleHeaderBack(event)">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <line x1="19" y1="12" x2="5" y2="12"></line>
                <polyline points="12 19 5 12 12 5"></polyline>
            </svg>
            <span id="headerBackLabel"></span>
        </button>
    </div>

    <div class="logo-container" style="flex: 2; display: flex; justify-content: center; align-items: center; gap: 10px;">
        <?php if ($schoolLogo): ?>
            <img id="headerLogo" src="<?= htmlspecialchars($schoolLogo) ?>"
                 alt="School Logo"
                 style="width:40px; height:40px; border-radius:8px; object-fit:cover; border:0.5px solid rgba(255,255,255,0.2);">
        <?php else: ?>
            <span id="headerLogo" class="school-logo-initials" aria-label="School Logo"><?= htmlspecialchars($schoolInitials) ?></span>
        <?php endif; ?>
        <span class="school-name" id="headerTitle"><?= htmlspecialchars($schoolName) ?></span>
    </div>

    <div id="headerRight" style="flex: 1; display: flex; justify-content: flex-end;">
        <div class="top-nav-avatar-btn">
            <button type="button" class="top-nav-avatar" onclick="toggleLearnerAvatarDropdown()" id="topNavAvatar" aria-label="Profile menu">
                <?php if ($learnerProfilePicture && $learnerProfilePicture !== 'default.png'): ?>
                    <img src="uploads/learners/<?= htmlspecialchars($learnerProfilePicture) ?>" alt="Profile" id="topNavAvatarImg">
                <?php else: ?>
                    <span class="initials-sm" id="topNavAvatarInitials"><?= htmlspecialchars($initials) ?></span>
                <?php endif; ?>
            </button>

            <div class="avatar-dropdown" id="learnerAvatarDropdown">
                <div class="avatar-dropdown-header">
                    <div class="avatar-dropdown-name"><?= htmlspecialchars($learnerFullName) ?></div>
                    <div class="avatar-dropdown-email"><?= htmlspecialchars($learnerEmail ?: '') ?></div>
                </div>
                <button class="avatar-dropdown-item" onclick="loadLearnerPersonalInfo(); closeLearnerAvatarDropdown();">
                    <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none">
                        <path d="M20 21a8 8 0 0 0-16 0"></path>
                        <circle cx="12" cy="7" r="4"></circle>
                    </svg>
                    Edit Profile
                </button>
                <button class="avatar-dropdown-item" onclick="triggerLearnerProfileUpload()">
                    <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                        <polyline points="17 8 12 3 7 8"></polyline>
                        <line x1="12" y1="3" x2="12" y2="15"></line>
                    </svg>
                    Upload Photo
                </button>
                <button class="avatar-dropdown-item danger" onclick="sessionStorage.removeItem('lastLearnerPage'); window.location.href='logout.php';">
                    <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none">
                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                        <polyline points="16 17 21 12 16 7"></polyline>
                        <line x1="21" y1="12" x2="9" y2="12"></line>
                    </svg>
                    Sign Out
                </button>
            </div>
        </div>
    </div>
</div>
    
   

    <div class="my-class-content" id="myClassContent">
        <?php if (!empty($joinedClassIds)): ?>
            <?php
            $placeholders = implode(',', array_fill(0, count($joinedClassIds), '?'));
            $types = str_repeat('i', count($joinedClassIds));
            $classNamesSql = "SELECT name FROM classes WHERE id IN ("
                . $placeholders .
                ")";
            $resStmt = $conn->prepare($classNamesSql);
            $resStmt->bind_param($types, ...$joinedClassIds);
            $resStmt->execute();
            $res = $resStmt->get_result();
            $myClasses = [];
            while ($c = $res->fetch_assoc()) { $myClasses[] = $c; }
            $resStmt->close();
            ?>
            <div class="lmc-wrap">
                <!-- ═══ CLASS ═══ -->
                <div class="lmc-col">
                    <div class="lmc-panel-title">My Class</div>
                    <?php foreach ($myClasses as $c): ?>
                        <div class="lmc-class-card">
                            <div class="lmc-class-icon">
                                <svg viewBox="0 0 24 24" width="20" height="20" stroke="#63b3ed" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
                                </svg>
                            </div>
                            <div class="lmc-class-body">
                                <div class="lmc-class-label">Class</div>
                                <div class="lmc-class-name"><?= htmlspecialchars($c['name']) ?></div>
                                <div class="lmc-class-sub"><?= htmlspecialchars($currentYearName) ?></div>
                            </div>
                        </div>
                    <?php endforeach; ?>
                </div>

                <!-- ═══ PARENT LINK ═══ -->
                <div class="lmc-col">
                    <div class="lmc-panel-title">Parent Link</div>
                    <div class="parent-link-section lmc-parent-block">
                        <div class="lmc-parent-top">
                            <div class="lmc-class-icon lmc-parent-icon <?= $parentLink ? 'lmc-parent-icon--linked' : '' ?>">
                                <svg viewBox="0 0 24 24" width="20" height="20" stroke="<?= $parentLink ? '#68d391' : '#63b3ed' ?>" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                                    <?php if ($parentLink): ?>
                                        <path d="M20 6L9 17l-5-5"/>
                                    <?php else: ?>
                                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                                    <?php endif; ?>
                                </svg>
                            </div>
                            <div class="lmc-class-body">
                                <div class="lmc-class-label">Parent</div>
                                <div class="lmc-class-name"><?= $parentLink ? 'Linked' : 'Not linked' ?></div>
                                <div class="lmc-class-sub"><?= $parentLink ? 'A parent has access to your progress' : 'No parent linked to your account yet' ?></div>
                            </div>
                        </div>
                        <button type="button" class="toggle-parent-link lmc-toggle-btn" onclick="toggleParentDropdown()">
                            <?= $parentLink ? 'Manage Parent Link' : 'Link My Parent' ?>
                        </button>
                        <div class="parent-dropdown lmc-parent-dropdown" id="parentDropdown" style="display:none;">
                            <?php if (!empty($parentsInClass)): ?>
                                <form id="parentLinkForm" class="lmc-parent-form">
                                    <label class="lmc-form-label" for="lmcParentSelect">Select parent</label>
                                    <select name="parent_email" id="lmcParentSelect" required>
                                        <option value="">-- Select Parent --</option>
                                        <?php foreach ($parentsInClass as $p): ?>
                                            <option value="<?= $p['email'] ?>" <?= ($p['email']===$parentLink?'selected':'') ?>>
                                                <?= htmlspecialchars($p['name']) ?>
                                            </option>
                                        <?php endforeach; ?>
                                    </select>
                                    <button type="submit" class="join-class-btn lmc-save-btn">Save</button>
                                </form>
                            <?php else: ?>
                                <p class="lmc-empty-note">No parents in class yet.</p>
                            <?php endif; ?>
                        </div>
                    </div>
                </div>
            </div>
        <?php else: ?>
            <div class="lmc-empty-wrap">
                <svg viewBox="0 0 24 24" width="40" height="40" stroke="#63b3ed" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
                </svg>
                <p>Not joined any class yet.</p>
            </div>
        <?php endif; ?>
    </div>


    <div id="api-content-area" style="display:none;"></div>
<iframe id="mainFrame" name="mainFrame" src="about:blank" style="display:none;"></iframe>

<div id="loaderOverlay">
    <div class="loader">
        <div class="loader-dot3"></div>
        <div class="loader-dot4"></div>
    </div>
    <div class="loader-version"><?= htmlspecialchars(iskool_app_version_label()) ?></div>
</div>
</div>

<script>
window.learnerQueueUser = <?= json_encode($learnerEmail) ?>;
// A learner section can still be fetching when another section is selected.
// Keep a single navigation identity so an older response cannot replace the
// page the learner just chose (most noticeable when opening Calendar on mobile).
window.learnerViewNavigation = window.learnerViewNavigation || { id: 0, page: '' };
window.beginLearnerViewNavigation = function(page) {
    const navigation = window.learnerViewNavigation;
    navigation.id += 1;
    navigation.page = page;
    return { id: navigation.id, page: page };
};
window.isCurrentLearnerViewNavigation = function(navigation) {
    return Boolean(navigation) &&
        window.learnerViewNavigation.id === navigation.id &&
        window.learnerViewNavigation.page === navigation.page;
};

// ACTIVE-TAB TAP: pressing the nav tab you are already on scrolls that page
// back to the top. This is deliberately the ONLY thing that happens on a nav
// press. It used to reset the scroll position, header tint and browser-bar
// colour the instant a link was touched, which made the current page jump and
// made the header/browser bar flash their "at top" look. Everything that
// changes when you ARRIVE on a page (scroll offset, header tint, browser bar,
// bottom nav) now happens together, in one step, in the MOBILE VIEW
// TRANSITIONS block inside the mobile scroll-UI section further down.
//
// Called on pointerdown rather than click: by click time the page has already
// started loading and rewritten lastLearnerPage, so "is this the page I was
// already on" could no longer be answered.
window.prepareLearnerMobileNavigation = function(link) {
    if (window.innerWidth > 768) return;
    const apiArea = document.getElementById('api-content-area');
    if (!apiArea) return;
    const tapped  = link && link.getAttribute ? link.getAttribute('data-page') : null;
    const current = sessionStorage.getItem('lastLearnerPage');
    if (!tapped || tapped !== current || window.learnerHeaderDetailType) return;
    if (apiArea.scrollTop > 0) {
        apiArea.style.scrollBehavior = 'auto';
        apiArea.scrollTop = 0;
    }
    if (typeof window.learnerForgetMobileScroll === 'function') window.learnerForgetMobileScroll();
};

window.handleLearnerMobileBottomNav = function(event, loaderFn) {
    if (event) event.preventDefault();

    requestAnimationFrame(() => {
        if (typeof loaderFn === 'function') loaderFn();
    });

    return false;
};

document.addEventListener("DOMContentLoaded", function () {
    const loader         = document.getElementById("loaderOverlay");
    const iframe         = document.querySelector('iframe[name="mainFrame"]');
    const sidebar        = document.querySelector(".sidebar");
    const myClassContent = document.getElementById("myClassContent");
    const apiArea = document.getElementById('api-content-area');
    const mobileOverlay  = document.getElementById("mobileOverlay") || createMobileOverlay();
    window.loaderTimeout = null;

    // ────────────────────────────────────────────────────────────────────────
    // NEW: MOBILE TWIST LOGIC (Add this here)
    // ────────────────────────────────────────────────────────────────────────
    const isMobile = window.innerWidth <= 768;
    // Do not use the old mobile-first-load flip here. Its first animation
    // frame has opacity: 0, which deliberately hid the dashboard for ~0.8s
    // whenever the PWA opened in a new browser session.
    if (isMobile) {
        const bottomNav = document.getElementById('mobileBottomNav');
        if (bottomNav) bottomNav.classList.add('nav-scrolled');
    }

    // ────────────────────────────────────────────────────────────────────────
    // 1. SMART LOAD LOGIC (Deep Linking + Refresh Persistence)
    // ────────────────────────────────────────────────────────────────────────
    // On refresh/deep-link, JS memory (cache + prefetch state) is always
    // wiped, so there's never anything to serve instantly. Rather than flash
    // the full-screen loader for this one unavoidable cold load, suppress it
    // here and let the content simply pop in once it arrives.
    window.suppressInitialLoader = true;

    const urlParams = new URLSearchParams(window.location.search);
    const targetPage = urlParams.get('page'); // From Push Notifications
    // UPDATE THIS LINE: Change localStorage to sessionStorage
    const savedPage = sessionStorage.getItem("lastLearnerPage");

    // Refresh normally only warms the ONE page you land on — every other
    // page (Quizzes, Announcements, Resources, etc.) stays cold for the
    // rest of the session because the prefetch chain in afterHomeRender()
    // only ever runs after Home renders. Kick it off here too so a refresh
    // on any page still warms the rest in the background, same as Home does.
    // Detail deep-links (e.g. "quiz_detail") map to their list page so we
    // don't redundantly prefetch the same page that's about to be fetched
    // directly for the detail view.
    const detailToListPage = {
        quiz_detail: 'quiz_list.php',
        announcement_detail: 'announcement_list.php',
        evaluation_detail: 'evaluation_list.php',
        assignment_detail: 'assignment_list.php',
        discussion: 'discussion_list.php'
    };
    const prefetchSkipKey = detailToListPage[targetPage] || targetPage || savedPage;
    if (typeof window.kickOffLearnerPrefetches === 'function') {
        window.kickOffLearnerPrefetches(prefetchSkipKey);
    }

 if (targetPage) {
    window.history.replaceState({}, document.title, window.location.pathname);

    if (targetPage === 'discussion' && window.innerWidth <= 768) {
    const discId = urlParams.get('id');
    if (discId) {
        // Make sure apiArea is visible first
        if (apiArea) apiArea.style.display = 'block';
        if (iframe) iframe.style.display = 'none';
        setTimeout(() => {
            if (typeof window.fetchDiscussions === 'function') {
                window.fetchDiscussions({ openDiscussionId: discId });
            }
        }, 100);
    } else {
        if (apiArea) apiArea.style.display = 'block';
        if (iframe) iframe.style.display = 'none';
        setTimeout(() => {
            window.fetchDiscussions();
        }, 100);
    }
}
     else if (targetPage === 'announcement_detail') {
        const annId = urlParams.get('id');
        window.fetchAnnouncements().then(() => {
            if (annId && typeof window.openMobileLearnerAnnouncementById === 'function') {
                window.openMobileLearnerAnnouncementById(annId);
            }
        });
    } else if (targetPage === 'evaluation_detail') {
        const evaluationId = urlParams.get('id');
        window.fetchEvaluations().then(() => {
            if (evaluationId && typeof window.openMobileLearnerEvaluationById === 'function') {
                window.openMobileLearnerEvaluationById(evaluationId);
            }
        });
    } else if (targetPage === 'assignment_detail') {
        const assignmentId = urlParams.get('id');
        window.fetchAssignments().then(() => {
            if (assignmentId && typeof window.openMobileLearnerAssignmentById === 'function') {
                window.openMobileLearnerAssignmentById(assignmentId);
            }
        });
    } else if (targetPage === 'quiz_detail') {
        const quizId = urlParams.get('id');
        if (apiArea) apiArea.style.display = 'block';
        if (iframe) iframe.style.display = 'none';
        if (quizId && typeof window.loadQuizInstructions === 'function') {
            window.loadQuizInstructions(quizId);
        } else {
            window.fetchQuizzes();
        }
     } else if (targetPage === 'announcement_list.php') {
        window.fetchAnnouncements();
    } else if (targetPage === 'quiz_list.php') {
        window.fetchQuizzes();
    } else if (targetPage === 'assignment_list.php') {
        window.fetchAssignments();
    } else if (targetPage === 'evaluation_list.php') {
        window.fetchEvaluations();
    } else if (targetPage === 'resource_list.php') {
        window.fetchResources();
    } else if (targetPage === 'grades') {
        window.fetchGrades();
    } else if (targetPage === 'syllabus') {
        window.fetchSyllabus();
    } else {
        if (apiArea) apiArea.style.display = 'none';
        iframe.style.display = 'block';
        iframe.src = targetPage;
    }
} 
    else if (savedPage) {
        // Single if/else-if/else chain — exactly one branch runs per
        // savedPage value. Previously this was two separate if-statements:
        // the first correctly called the right fetchX() function, but a
        // second, independent if-statement right after it would then also
        // run and fall through to its own catch-all `else`, which called
        // loadManual() unconditionally — overwriting whatever the first
        // block had just loaded. That's why a refresh on Quizzes,
        // Assignments, Resources, Announcements, Evaluations, Grades, or
        // Syllabus always landed back on Home instead of staying put.
        if (savedPage.includes("quiz_list.php")) {
            window.fetchQuizzes();
        } else if (savedPage.includes("assignment_list.php")) {
            window.fetchAssignments();
        } else if (savedPage.includes("resource_list.php")) {
            window.fetchResources();
        } else if (savedPage.includes("announcement_list.php")) {
            window.fetchAnnouncements();
        } else if (savedPage === 'grades') {
            window.fetchGrades();
        } else if (savedPage === 'syllabus') {
            window.fetchSyllabus();
        } else if (savedPage.includes("evaluation_list.php")) {
            window.fetchEvaluations();
        } else if (savedPage === 'learner_calendar') {
            window.fetchLearnerCalendar();
        } else if (savedPage.includes("discussion_list.php")) {
            window.fetchDiscussions();
        } else if (savedPage === "partials/manual.html" || savedPage === "learner_manual.php") {
            if (apiArea) apiArea.style.display = "block";
            if (iframe) iframe.style.display = "none";
            if (typeof loadManual === "function") {
                loadManual();
            } else {
                // Emergency fallback if loadManual somehow isn't defined
                iframe.style.display = "block";
                iframe.src = "partials/manual.html";
            }
        } else {
            // Not an API-driven page and not the manual — load the saved
            // path directly into the iframe (e.g. profile.php).
            iframe.style.display = 'block';
            if (apiArea) apiArea.style.display = 'none';
            iframe.src = savedPage;
        }
    } else {
        // FRESH START: No saved page at all (Trigger the new Manual logic)
        if (typeof loadManual === "function") {
            loadManual();
        } else {
            // Emergency Fallback
            iframe.style.display = "block";
            iframe.src = "partials/manual.html";
        }
    }

    // The suppress flag only applies to this initial restore call. Clear it
    // shortly after so any page the person navigates to afterward in the
    // same session shows the loader normally on a genuine cold fetch.
    // (200ms comfortably covers the 100ms setTimeout used by the discussion
    // deep-link branch above.)
    setTimeout(() => { window.suppressInitialLoader = false; }, 200);

   // ────────────────────────────────────────────────────────────────────────
    // 2. LOADER & MOBILE AUTO-CLOSE (Teacher-style navigation)
    // ────────────────────────────────────────────────────────────────────────
    
    document.querySelectorAll('.sidebar a, #mobileBottomNav a').forEach(link => {
        link.addEventListener('pointerdown', () => {
            window.prepareLearnerMobileNavigation(link);
        }, { passive: true });
    });

    // We target ALL links in the sidebar and bottom nav to ensure menu closes
  document.querySelectorAll('.sidebar a, #mobileBottomNav a').forEach(link => {
    link.addEventListener('click', () => {
        const onClick = link.getAttribute('onclick') || "";
        const isApiCall = onClick.includes('loadManual') || 
                          onClick.includes('fetchQuizzes') || 
                          onClick.includes('fetchAssignments') || 
                          onClick.includes('fetchResources') ||
                          onClick.includes('fetchDiscussions') ||
                          onClick.includes('fetchEvaluations') ||
                          onClick.includes('fetchGrades') ||
                          onClick.includes('fetchSyllabus') || 
                          onClick.includes('fetchLearnerCalendar') ||
                          onClick.includes('openLearnerCalendar') ||
                          onClick.includes('fetchAnnouncements');

        // Inside your Main Script's link click listener:
const isCached = (onClick.includes('loadManual') && window.manualCache && window.homeDataCache) ||
                 (onClick.includes('fetchQuizzes') && (window.learnerQuizCache || window.learnerQuizPrefetchPromise)) ||
                 (onClick.includes('fetchAssignments') && (window.learnerAssignmentCache || window.learnerAssignmentPrefetchPromise)) ||
                 (onClick.includes('fetchAnnouncements') && (window.announcementCache || window.announcementPrefetchPromise)) ||
                 (onClick.includes('fetchResources') && (window.resourceCache || window.resourcePrefetchPromise)) ||
                 (onClick.includes('fetchEvaluations') && (window.evaluationCache || window.evaluationPrefetchPromise)) ||
                 (onClick.includes('fetchGrades') && window.learnerGradesCache) ||
                 (onClick.includes('fetchSyllabus') && (window.syllabusCache || window.syllabusPrefetchPromise)) ||
                 onClick.includes('fetchLearnerCalendar') ||
                 onClick.includes('openLearnerCalendar') ||
                 (onClick.includes('fetchDiscussions') && (window.discussionCache || window.discussionPrefetchPromise)); // <-- ADD THIS

        // 1. AUTO-CLOSE MENU
        if (sidebar.classList.contains("active") || sidebar.classList.contains("desktop-open")) {
            sidebar.classList.remove("active");
            sidebar.classList.remove("desktop-open");
            if (window.innerWidth <= 768 && mobileOverlay) {
                mobileOverlay.style.display = "none";
            }
            // Restore the browser bar colour here too — this auto-close
            // path (triggered by tapping a nav link) bypasses toggleSidebar
            // entirely, so it needs the same restore logic, otherwise the
            // browser bar would stay stuck on the menu's dark colour after
            // navigating to a page that should have its own accent colour.
            if (window.innerWidth <= 768) {
                const _themeColorMeta = document.querySelector('meta[name="theme-color"]');
                const _mainHeader = document.querySelector('.main-header');
                if (_themeColorMeta) {
                    const _isScrolledOnColoredPage =
                        _mainHeader &&
                        _mainHeader.classList.contains('header-scrolled') &&
                        _mainHeader.getAttribute('data-page-color');
                    _themeColorMeta.setAttribute(
                        'content',
                        _isScrolledOnColoredPage ? window.learnerCurrentPageColor : '#20201f'
                    );
                }
                // Same bypass problem as the theme-color restore above:
                // this path never touches toggleSidebar, so the background
                // override applied to .main-header on open needs restoring
                // here too, otherwise it stays stuck on the menu's dark
                // colour after navigating (even though the nav-link's own
                // page load will likely set a fresh colour moments later,
                // this keeps things consistent either way).
                if (_mainHeader) {
                    _mainHeader.style.background = _mainHeader.dataset.bgBeforeMenu ?? '';
                    delete _mainHeader.dataset.bgBeforeMenu;
                    _mainHeader.style.pointerEvents = '';
                }
            }
        }

        // 2. Detect same-page clicks
        let currentIframePage = '';
        try {
            if (iframe.contentWindow && iframe.contentWindow.location) {
                currentIframePage = iframe.contentWindow.location.pathname.split("/").pop() + iframe.contentWindow.location.search;
            }
        } catch (e) {}
        const targetHref = link.getAttribute('href') || '';
        const isSamePage = targetHref && currentIframePage && targetHref.includes(currentIframePage);

        // 3. Clear old timeout
        clearTimeout(window.loaderTimeout);

        // 4. SMART LOADER: Only show if NOT cached and NOT a same-page repeat
        if (!isCached && !isSamePage) {
            window.loaderTimeout = setTimeout(() => {
                loader.style.display = 'flex';
            }, 800);
        }

        // 5. UI prep
        if (isApiCall) {
            if (myClassContent) myClassContent.classList.remove("active");
            if (iframe) iframe.style.display = "none";
            if (apiArea) apiArea.style.display = "block";
            
            // If it's cached, ensure the loader is hidden immediately
            if (isCached) loader.style.display = 'none';
        } else {
            if (link.getAttribute('target') === 'mainFrame' && myClassContent) {
                myClassContent.classList.remove("active");
                iframe.style.display = "block";
                if (apiArea) apiArea.style.display = 'none';
            }
        }
    });
});

    // LOADER: Hide when iframe finishes loading
    iframe?.addEventListener('load', () => {
        // 1. CANCEL THE TIMER (This prevents the loader from showing for fast pages)
   clearTimeout(window.loaderTimeout); // Change to window.loaderTimeout

    // 2. Hide it if it's already visible
    loader.style.display = 'none';
        try {
            const win = iframe.contentWindow;
            const fullPage = win.location.pathname.split("/").pop() + win.location.search;
            
            // ADD these to the exclusion list:
if (fullPage && 
    !fullPage.startsWith('blank.php') && 
    !fullPage.startsWith('submit_quiz.php') &&   // ADD THIS
    !fullPage.startsWith('take_quiz.php') && 
    !fullPage.startsWith('quiz_history.php') &&  // ← ADD THIS    
    fullPage !== "") {
    sessionStorage.setItem("lastLearnerPage", fullPage);
                const filename = win.location.pathname.split("/").pop();
                setActive(filename);
            }
        } catch (e) { 
            console.log("State save skipped (External/Cross-origin)"); 
        }
    });

    // ────────────────────────────────────────────────────────────────────────
    // 3. SETTINGS & PROFILE (Your original working logic)
    // ────────────────────────────────────────────────────────────────────────
    window.loadLearnerSettings = function() {
    const apiArea = document.getElementById('api-content-area');
    const iframe  = document.getElementById('mainFrame');

    if (iframe)  iframe.style.display  = 'none';
    if (apiArea) apiArea.style.display = 'block';

    sessionStorage.setItem("lastLearnerPage", "learner_settings");
    window.configureHeader({ title: 'Settings', mode: 'standard' });
    if (typeof window.setActive === 'function') window.setActive("learner_settings");

    // Grab current avatar src or initials
    const avatarImg = document.querySelector('.profile-picture-wrapper img.learner-avatar');
    const initialsEl = document.querySelector('.profile-picture-wrapper .initials-avatar');
    const avatarHTML = avatarImg
        ? `<img src="${avatarImg.src}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`
        : `<span style="font-size:32px;font-weight:800;color:#f4e4e4;text-transform:uppercase;font-family:'Nunito',sans-serif;letter-spacing:1px;">${initialsEl ? initialsEl.textContent.trim() : '??'}</span>`;

    const isDesktop = window.innerWidth > 768;

    // ── SHARED BLOCKS (used in both layouts) ──────────────────────────────

    const profileCardHTML = `
        <!-- ── PROFILE CARD ── -->
        <div onclick="loadLearnerPersonalInfo()"
             style="display:flex;align-items:center;gap:16px;
                    background:transparent;border:1px solid rgba(255,255,255,0.06);
                    border-radius:14px;padding:16px;cursor:pointer;
                    transition:background 0.2s ease;margin-bottom:28px;"
             onmouseover="this.style.background='rgba(255,255,255,0.04)'"
             onmouseout="this.style.background='transparent'">
            <div style="position:relative;width:64px;height:64px;border-radius:50%;
                        background:#6f1d1b;border:none;
                        overflow:hidden;flex-shrink:0;">
                <div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;">
                    ${avatarHTML}
                </div>
            </div>
            <div style="flex:1;min-width:0;">
                <div style="color:#e2e8f0;font-weight:700;font-size:17px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                    <?= htmlspecialchars($learnerFullName) ?>
                </div>
                <div style="color:#8b949e;font-size:13px;margin-top:3px;">
                    <?= htmlspecialchars($learnerEmail) ?>
                </div>
            </div>
            <svg viewBox="0 0 24 24" width="16" height="16" stroke="#8b949e" stroke-width="2" fill="none" style="flex-shrink:0;">
                <polyline points="9 18 15 12 9 6"></polyline>
            </svg>
        </div>`;

    const profilePicHTML = `
        <!-- SECTION: PROFILE -->
        <div style="font-size:12px;font-weight:600;color:#8b949e;text-transform:uppercase;
                    letter-spacing:0.08em;padding:0 4px;margin-bottom:8px;">Profile</div>
        <div style="background:transparent;border:1px solid rgba(255,255,255,0.06);
                    border-radius:14px;overflow:hidden;margin-bottom:28px;">
            <div onclick="document.getElementById('profileInput').click()"
                 style="display:flex;align-items:center;gap:14px;padding:14px 16px;cursor:pointer;transition:background 0.2s ease;"
                 onmouseover="this.style.background='rgba(255,255,255,0.04)'"
                 onmouseout="this.style.background='transparent'">
                <div style="width:36px;height:36px;border-radius:9px;
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
                <svg viewBox="0 0 24 24" width="15" height="15" stroke="#8b949e" stroke-width="2" fill="none" style="flex-shrink:0;">
                    <polyline points="9 18 15 12 9 6"></polyline>
                </svg>
            </div>
            <div style="height:1px;background:rgba(255,255,255,0.06);margin-left:64px;"></div>
            <div onclick="removeLearnerProfilePicture()"
                 style="display:flex;align-items:center;gap:14px;padding:14px 16px;cursor:pointer;transition:background 0.2s ease;"
                 onmouseover="this.style.background='rgba(255,255,255,0.04)'"
                 onmouseout="this.style.background='transparent'">
                <div style="width:36px;height:36px;border-radius:9px;
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
                <svg viewBox="0 0 24 24" width="15" height="15" stroke="#8b949e" stroke-width="2" fill="none" style="flex-shrink:0;">
                    <polyline points="9 18 15 12 9 6"></polyline>
                </svg>
            </div>
        </div>`;

    const notificationsHTML = `
        <!-- SECTION: NOTIFICATIONS -->
        <div style="font-size:12px;font-weight:600;color:#8b949e;text-transform:uppercase;
                    letter-spacing:0.08em;padding:0 4px;margin-bottom:8px;">Notifications</div>
        <div style="background:transparent;border:1px solid rgba(255,255,255,0.06);
                    border-radius:14px;overflow:hidden;margin-bottom:28px;">
            <div style="padding:14px 16px;">
                <div style="display:flex;align-items:center;gap:12px;margin-bottom:10px;">
                    <div style="width:36px;height:36px;border-radius:9px;
                                display:flex;align-items:center;justify-content:center;flex-shrink:0;">
                        <span style="font-size:18px;line-height:1;">💡</span>
                    </div>
                    <div style="color:#4fd1c5;font-weight:700;font-size:14px;">Notification Help</div>
                </div>
                <ol style="margin:0;padding-left:18px;font-size:13px;color:#8b949e;line-height:1.8;">
                    <li><strong style="color:#c9d1d9;">iPhone Users:</strong> You must "Add to Home Screen" first.</li>
                    <li>Tap <strong style="color:#c9d1d9;">Sync Notifications</strong> below if you aren't getting alerts.</li>
                    <li>If prompted, select <strong style="color:#c9d1d9;">"Allow"</strong> on the system popup.</li>
                </ol>
            </div>
            <div style="height:1px;background:rgba(255,255,255,0.06);margin-left:64px;"></div>
            <div onclick="requestIphonePush()"
                 style="display:flex;align-items:center;gap:14px;padding:14px 16px;cursor:pointer;transition:background 0.2s ease;"
                 onmouseover="this.style.background='rgba(255,255,255,0.04)'"
                 onmouseout="this.style.background='transparent'">
                <div style="width:36px;height:36px;border-radius:9px;
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
                <svg viewBox="0 0 24 24" width="15" height="15" stroke="#8b949e" stroke-width="2" fill="none" style="flex-shrink:0;">
                    <polyline points="9 18 15 12 9 6"></polyline>
                </svg>
            </div>
        </div>`;

    const accountHTML = `
        <!-- SECTION: ACCOUNT -->
        <div style="font-size:12px;font-weight:600;color:#8b949e;text-transform:uppercase;
                    letter-spacing:0.08em;padding:0 4px;margin-bottom:8px;">Account</div>
        <div style="background:transparent;border:1px solid rgba(255,255,255,0.06);
                    border-radius:14px;overflow:hidden;">
            <div onclick="sessionStorage.removeItem('lastLearnerPage'); window.location.href='logout.php';"
                 style="display:flex;align-items:center;gap:14px;padding:14px 16px;cursor:pointer;transition:background 0.2s ease;"
                 onmouseover="this.style.background='rgba(255,255,255,0.04)'"
                 onmouseout="this.style.background='transparent'">
                <div style="width:36px;height:36px;border-radius:9px;
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
                <svg viewBox="0 0 24 24" width="15" height="15" stroke="#8b949e" stroke-width="2" fill="none" style="flex-shrink:0;">
                    <polyline points="9 18 15 12 9 6"></polyline>
                </svg>
            </div>
        </div>`;

    // ── DESKTOP: Claude-style tabbed layout ───────────────────────────────
    if (isDesktop) {

        // Profile panel content (personal info form — loaded async)
        const profilePanelHTML = `
            <div id="ls-profile-panel">
                <div style="display:flex;flex-direction:column;align-items:center;margin-bottom:28px;">
                    <div onclick="document.getElementById('profileInput').click()"
                         style="position:relative;width:80px;height:80px;border-radius:50%;
                                background:#6f1d1b;overflow:hidden;cursor:pointer;flex-shrink:0;">
                        <div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;">
                            ${avatarHTML}
                        </div>
                    </div>
                    <div style="display:flex;gap:12px;margin-top:10px;">
                        <button onclick="document.getElementById('profileInput').click()"
                                style="background:rgba(79,209,197,0.1);border:1px solid rgba(79,209,197,0.25);
                                       color:#4fd1c5;font-size:12px;font-weight:600;padding:6px 14px;
                                       border-radius:8px;cursor:pointer;font-family:'Nunito',sans-serif;transition:background 0.2s;"
                                onmouseover="this.style.background='rgba(79,209,197,0.18)'"
                                onmouseout="this.style.background='rgba(79,209,197,0.1)'">
                            Upload Photo
                        </button>
                        <button onclick="removeLearnerProfilePicture()"
                                style="background:rgba(248,81,73,0.08);border:1px solid rgba(248,81,73,0.2);
                                       color:#f85149;font-size:12px;font-weight:600;padding:6px 14px;
                                       border-radius:8px;cursor:pointer;font-family:'Nunito',sans-serif;transition:background 0.2s;"
                                onmouseover="this.style.background='rgba(248,81,73,0.15)'"
                                onmouseout="this.style.background='rgba(248,81,73,0.08)'">
                            Remove
                        </button>
                    </div>
                </div>

                <!-- Personal -->
                <div style="font-size:11px;font-weight:700;color:#8b949e;text-transform:uppercase;
                            letter-spacing:0.1em;margin-bottom:8px;">Personal</div>
                <div style="background:#1b1b1b;border:1px solid rgba(255,255,255,0.06);
                            border-radius:14px;overflow:hidden;margin-bottom:24px;">
                    <div style="padding:13px 16px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid rgba(255,255,255,0.05);">
                        <span style="font-size:13px;color:#8b949e;">Name</span>
                        <span style="font-size:13px;color:#c9d1d9;font-weight:500;"><?= htmlspecialchars($learnerFullName) ?></span>
                    </div>
                    <div style="padding:13px 16px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid rgba(255,255,255,0.05);">
                        <span style="font-size:13px;color:#8b949e;">Email</span>
                        <span style="font-size:13px;color:#c9d1d9;"><?= htmlspecialchars($learnerEmail) ?></span>
                    </div>
                    <div style="padding:13px 16px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid rgba(255,255,255,0.05);">
                        <span style="font-size:13px;color:#8b949e;">Gender</span>
                        <span style="font-size:13px;color:#c9d1d9;"><?php if (!empty($learnerGender)): ?><?= htmlspecialchars(ucfirst($learnerGender)) ?><?php else: ?><span style="color:#8b949e;font-style:italic;">Not set</span><?php endif; ?></span>
                    </div>
                    <div style="padding:13px 16px;border-bottom:1px solid rgba(255,255,255,0.05);">
                        <label style="display:block;font-size:11px;color:#8b949e;margin-bottom:5px;font-weight:600;letter-spacing:0.03em;">Date of Birth</label>
                        <input type="date" id="pi_dob"
                               style="width:100%;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);
                                      border-radius:9px;padding:9px 12px;color:#e2e8f0;font-size:13px;
                                      font-family:inherit;box-sizing:border-box;color-scheme:dark;">
                    </div>
                    <div style="padding:13px 16px;border-bottom:1px solid rgba(255,255,255,0.05);">
                        <label style="display:block;font-size:11px;color:#8b949e;margin-bottom:5px;font-weight:600;letter-spacing:0.03em;">ID Number</label>
                        <input type="text" id="pi_id" placeholder="13-digit South African ID" maxlength="13"
                               style="width:100%;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);
                                      border-radius:9px;padding:9px 12px;color:#e2e8f0;font-size:13px;
                                      font-family:inherit;box-sizing:border-box;">
                    </div>
                    <div style="padding:13px 16px;">
                        <label style="display:block;font-size:11px;color:#8b949e;margin-bottom:5px;font-weight:600;letter-spacing:0.03em;">Address</label>
                        <input type="text" id="pi_address" placeholder="Street, City, Province"
                               style="width:100%;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);
                                      border-radius:9px;padding:9px 12px;color:#e2e8f0;font-size:13px;
                                      font-family:inherit;box-sizing:border-box;">
                    </div>
                </div>

                <!-- Guardian -->
                <div style="font-size:11px;font-weight:700;color:#8b949e;text-transform:uppercase;
                            letter-spacing:0.1em;margin-bottom:8px;">Guardian / Parent</div>
                <div style="background:#1b1b1b;border:1px solid rgba(255,255,255,0.06);
                            border-radius:14px;overflow:hidden;margin-bottom:24px;">
                    <div style="padding:13px 16px;border-bottom:1px solid rgba(255,255,255,0.05);">
                        <label style="display:block;font-size:11px;color:#8b949e;margin-bottom:5px;font-weight:600;">Guardian Name</label>
                        <input type="text" id="pi_gname" placeholder="Full name of guardian"
                               style="width:100%;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);
                                      border-radius:9px;padding:9px 12px;color:#e2e8f0;font-size:13px;
                                      font-family:inherit;box-sizing:border-box;">
                    </div>
                    <div style="padding:13px 16px;border-bottom:1px solid rgba(255,255,255,0.05);">
                        <label style="display:block;font-size:11px;color:#8b949e;margin-bottom:5px;font-weight:600;">Relationship</label>
                        <select id="pi_grel"
                                style="width:100%;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);
                                       border-radius:9px;padding:9px 12px;color:#e2e8f0;font-size:13px;
                                       font-family:inherit;box-sizing:border-box;cursor:pointer;color-scheme:dark;">
                            <option value="" style="background:#1b1b1b;">Select relationship</option>
                            ${['Mother','Father','Grandmother','Grandfather','Aunt','Uncle','Sister','Brother','Legal Guardian','Other'].map(r =>
                                `<option value="${r}" style="background:#1b1b1b;">${r}</option>`
                            ).join('')}
                        </select>
                    </div>
                    <div style="padding:13px 16px;border-bottom:1px solid rgba(255,255,255,0.05);">
                        <label style="display:block;font-size:11px;color:#8b949e;margin-bottom:5px;font-weight:600;">Guardian Phone</label>
                        <input type="tel" id="pi_gphone" placeholder="e.g. 071 234 5678"
                               style="width:100%;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);
                                      border-radius:9px;padding:9px 12px;color:#e2e8f0;font-size:13px;
                                      font-family:inherit;box-sizing:border-box;">
                    </div>
                    <div style="padding:13px 16px;">
                        <label style="display:block;font-size:11px;color:#8b949e;margin-bottom:5px;font-weight:600;">Guardian Email</label>
                        <input type="email" id="pi_gemail" placeholder="guardian@example.com"
                               style="width:100%;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);
                                      border-radius:9px;padding:9px 12px;color:#e2e8f0;font-size:13px;
                                      font-family:inherit;box-sizing:border-box;">
                    </div>
                </div>

                <!-- Emergency & Medical -->
                <div style="font-size:11px;font-weight:700;color:#8b949e;text-transform:uppercase;
                            letter-spacing:0.1em;margin-bottom:8px;">Emergency &amp; Medical</div>
                <div style="background:#1b1b1b;border:1px solid rgba(255,255,255,0.06);
                            border-radius:14px;overflow:hidden;margin-bottom:24px;">
                    <div style="padding:13px 16px;border-bottom:1px solid rgba(255,255,255,0.05);">
                        <label style="display:block;font-size:11px;color:#8b949e;margin-bottom:5px;font-weight:600;">Emergency Contact Name</label>
                        <input type="text" id="pi_ename" placeholder="Full name"
                               style="width:100%;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);
                                      border-radius:9px;padding:9px 12px;color:#e2e8f0;font-size:13px;
                                      font-family:inherit;box-sizing:border-box;">
                    </div>
                    <div style="padding:13px 16px;border-bottom:1px solid rgba(255,255,255,0.05);">
                        <label style="display:block;font-size:11px;color:#8b949e;margin-bottom:5px;font-weight:600;">Emergency Contact Phone</label>
                        <input type="tel" id="pi_ephone" placeholder="e.g. 082 345 6789"
                               style="width:100%;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);
                                      border-radius:9px;padding:9px 12px;color:#e2e8f0;font-size:13px;
                                      font-family:inherit;box-sizing:border-box;">
                    </div>
                    <div style="padding:13px 16px;">
                        <label style="display:block;font-size:11px;color:#8b949e;margin-bottom:5px;font-weight:600;">Medical Notes</label>
                        <textarea id="pi_medical" rows="3" placeholder="Allergies, conditions, medication, etc."
                                  style="width:100%;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);
                                         border-radius:9px;padding:9px 12px;color:#e2e8f0;font-size:13px;
                                         font-family:inherit;box-sizing:border-box;resize:vertical;min-height:80px;"></textarea>
                    </div>
                </div>

                <!-- Save -->
                <button id="pi_save_btn" onclick="saveLearnerPersonalInfo()"
                        style="width:100%;padding:14px;background:#4fd1c5;border:none;border-radius:12px;
                               color:#0d1117;font-size:14px;font-weight:700;cursor:pointer;
                               font-family:'Nunito',sans-serif;transition:opacity 0.2s;"
                        onmouseover="this.style.opacity='0.88'"
                        onmouseout="this.style.opacity='1'">
                    Save Changes
                </button>
                <div id="pi_feedback" style="display:none;margin-top:12px;padding:12px 16px;
                                             border-radius:10px;font-size:13px;font-weight:600;text-align:center;"></div>
            </div>`;

        // Notifications panel content
        const notificationsPanelHTML = `
            <div id="ls-notifications-panel">
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
                            <div style="font-size:12px;font-weight:700;color:#c9d1d9;margin-bottom:6px;">
                                🤖 Android Users
                            </div>
                            <ol style="margin:0;padding-left:18px;font-size:13px;color:#8b949e;line-height:1.9;">
                                <li>Open iSkool in Chrome and tap the menu (⋮).</li>
                                <li>Select <strong style="color:#c9d1d9;">Add to Home Screen</strong>.</li>
                                <li>Open the app from your home screen, then tap <strong style="color:#c9d1d9;">Sync Notifications</strong> below.</li>
                                <li>Select <strong style="color:#c9d1d9;">Allow</strong> when prompted.</li>
                            </ol>
                        </div>

                        <div style="height:1px;background:rgba(255,255,255,0.06);margin-bottom:14px;"></div>

                        <div style="margin-bottom:14px;">
                            <div style="font-size:12px;font-weight:700;color:#c9d1d9;margin-bottom:6px;">
                                🍎 iPhone / iOS Users
                            </div>
                            <ol style="margin:0;padding-left:18px;font-size:13px;color:#8b949e;line-height:1.9;">
                                <li>Open iSkool in <strong style="color:#c9d1d9;">Safari</strong> (notifications only work in Safari on iPhone).</li>
                                <li>Tap the share icon and select <strong style="color:#c9d1d9;">Add to Home Screen</strong>.</li>
                                <li>Open the app from your home screen, then tap <strong style="color:#c9d1d9;">Sync Notifications</strong> below.</li>
                                <li>Select <strong style="color:#c9d1d9;">Allow</strong> on the popup.</li>
                            </ol>
                        </div>

                        <div style="height:1px;background:rgba(255,255,255,0.06);margin-bottom:14px;"></div>

                        <div>
                            <div style="font-size:12px;font-weight:700;color:#c9d1d9;margin-bottom:6px;">
                                🌐 Desktop / Browser Users
                            </div>
                            <ol style="margin:0;padding-left:18px;font-size:13px;color:#8b949e;line-height:1.9;">
                                <li>Click <strong style="color:#c9d1d9;">Sync Notifications</strong> below.</li>
                                <li>Click <strong style="color:#c9d1d9;">Allow</strong> when your browser asks for permission.</li>
                                <li>If you previously blocked notifications, reset them in your browser's site settings.</li>
                            </ol>
                        </div>
                    </div>
                </div>

                <div onclick="requestIphonePush()"
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
                </div>
            </div>`;

        // Account panel content
        const accountPanelHTML = `
            <div id="ls-account-panel">
                <div style="background:#1b1b1b;border:1px solid rgba(255,255,255,0.06);border-radius:14px;overflow:hidden;">
                    <div onclick="sessionStorage.removeItem('lastLearnerPage'); window.location.href='logout.php';"
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
                </div>
            </div>`;

        apiArea.innerHTML = `
        <style>
            .ls-desktop {
                display: grid;
                grid-template-columns: 200px minmax(0, 1fr);
                min-height: calc(100vh - 62px);
                font-family: 'Nunito', sans-serif;
            }
            .ls-rail {
                padding: 28px 12px;
                background: #0d1117;
                border-right: 1px solid rgba(255,255,255,0.07);
                display: flex;
                flex-direction: column;
                gap: 2px;
            }
            .ls-nav-item {
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
            .ls-nav-item:hover {
                background: rgba(255,255,255,0.04);
                color: #e2e8f0;
            }
            .ls-nav-item.ls-active {
                background: rgba(79,209,197,0.08);
                color: #4fd1c5;
                font-weight: 600;
                border-left: 2px solid #4fd1c5;
            }
            .ls-panel {
                padding: 32px 40px 56px;
                overflow-y: auto;
                max-height: calc(100vh - 62px);
                background: #0a0e14;
            }
            .ls-panel-section {
                display: none;
                max-width: 600px;
            }
            .ls-panel-section.ls-panel-active {
                display: block;
            }
        </style>
        <div class="ls-desktop">

            <!-- LEFT RAIL: nav items only -->
            <nav class="ls-rail">
                <button class="ls-nav-item ls-active" onclick="lsSwitch('profile', this)">Profile</button>
                <button class="ls-nav-item" onclick="lsSwitch('notifications', this)">Notifications</button>
                <button class="ls-nav-item" onclick="lsSwitch('account', this)">Account</button>
            </nav>

            <!-- RIGHT PANEL: content -->
            <div class="ls-panel">
                <div id="ls-section-profile" class="ls-panel-section ls-panel-active">
                    ${profilePanelHTML}
                </div>
                <div id="ls-section-notifications" class="ls-panel-section">
                    ${notificationsPanelHTML}
                </div>
                <div id="ls-section-account" class="ls-panel-section">
                    ${accountPanelHTML}
                </div>
            </div>

        </div>`;

        // Tab switching function (scoped to settings)
        window.lsSwitch = function(section, btn) {
            document.querySelectorAll('.ls-nav-item').forEach(b => b.classList.remove('ls-active'));
            document.querySelectorAll('.ls-panel-section').forEach(p => p.classList.remove('ls-panel-active'));
            btn.classList.add('ls-active');
            document.getElementById('ls-section-' + section).classList.add('ls-panel-active');
        };

        // Load saved profile data into the form fields
        fetch('api/learner/get_learner_profile.php')
            .then(r => r.json())
            .then(data => {
                if (!data.success) return;
                const p = data.profile;
                const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };
                set('pi_dob',     p.date_of_birth);
                set('pi_id',      p.id_number);
                set('pi_address', p.address);
                set('pi_gname',   p.guardian_name);
                set('pi_grel',    p.guardian_relationship);
                set('pi_gphone',  p.guardian_phone);
                set('pi_gemail',  p.guardian_email);
                set('pi_ename',   p.emergency_contact_name);
                set('pi_ephone',  p.emergency_contact_phone);
                set('pi_medical', p.medical_notes);
            })
            .catch(() => { /* silently fail — form stays empty */ });

        return;
    }

    // ── MOBILE: original single-column layout ──────────────────────────────
    apiArea.innerHTML = `
        <div style="padding:20px 16px 40px;max-width:480px;margin:0 auto;">
            ${profileCardHTML}
            ${notificationsHTML}
            ${profilePicHTML}
            ${accountHTML}
        </div>`;
};

window.toggleLearnerAvatarDropdown = function() {
    document.getElementById('learnerAvatarDropdown')?.classList.toggle('open');
};

window.closeLearnerAvatarDropdown = function() {
    document.getElementById('learnerAvatarDropdown')?.classList.remove('open');
};

window.triggerLearnerProfileUpload = function() {
    closeLearnerAvatarDropdown();
    document.getElementById('profileInput')?.click();
};

document.addEventListener('click', function(e) {
    const btn = document.querySelector('.top-nav-avatar-btn');
    const drop = document.getElementById('learnerAvatarDropdown');
    if (btn && drop && !btn.contains(e.target)) drop.classList.remove('open');
});

// ────────────────────────────────────────────────────────────────────────
// 4. PERSONAL INFORMATION (Detail view — iOS-style)
// ────────────────────────────────────────────────────────────────────────
window.loadLearnerPersonalInfo = async function() {
    const apiArea = document.getElementById('api-content-area');
    const iframe  = document.getElementById('mainFrame');

    if (iframe)  iframe.style.display  = 'none';
    if (apiArea) apiArea.style.display = 'block';

    window.configureHeader({ title: 'Personal Information', mode: 'detail' });

    // Show skeleton while loading
    apiArea.innerHTML = `
        <div style="padding:24px 16px 40px;max-width:520px;margin:0 auto;">
            <div style="display:flex;flex-direction:column;align-items:center;margin-bottom:28px;gap:10px;">
                <div style="width:80px;height:80px;border-radius:50%;background:#21262d;animation:pulse 1.5s infinite;"></div>
                <div style="width:60px;height:13px;border-radius:6px;background:#21262d;animation:pulse 1.5s infinite;"></div>
            </div>
            ${[1,2,3].map(() => `
                <div style="background:#1b1b1b;border:1px solid rgba(255,255,255,0.06);border-radius:14px;overflow:hidden;margin-bottom:28px;">
                    <div style="height:12px;width:80px;border-radius:6px;background:#21262d;margin:16px;animation:pulse 1.5s infinite;"></div>
                    ${[1,2].map(() => `
                        <div style="padding:14px 16px;border-top:1px solid rgba(255,255,255,0.04);">
                            <div style="height:11px;width:100px;border-radius:5px;background:#21262d;margin-bottom:8px;animation:pulse 1.5s infinite;"></div>
                            <div style="height:14px;width:200px;border-radius:5px;background:#21262d;animation:pulse 1.5s infinite;"></div>
                        </div>`).join('')}
                </div>`).join('')}
        </div>`;

    // Fetch current profile data
    let profile = {};
    try {
        const res  = await fetch('api/learner/get_learner_profile.php');
        const data = await res.json();
        if (data.success) profile = data.profile;
    } catch(e) {
        console.warn('Profile fetch failed, showing empty form');
    }

    const avatarImg = document.querySelector('.profile-picture-wrapper img.learner-avatar');
    const initialsEl = document.querySelector('.profile-picture-wrapper .initials-avatar');
    const avatarHTML = avatarImg
        ? `<img src="${avatarImg.src}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`
        : `<span style="font-size:28px;font-weight:800;color:#f4e4e4;font-family:'Nunito',sans-serif;letter-spacing:1px;">${initialsEl ? initialsEl.textContent.trim() : '??'}</span>`;

    const fields = [
        profile.date_of_birth, profile.id_number, profile.address,
        profile.guardian_name, profile.guardian_relationship,
        profile.guardian_phone, profile.guardian_email,
        profile.emergency_contact_name, profile.emergency_contact_phone,
        profile.medical_notes
    ];


    function val(v) { return v || ''; }

    const isDesktop = window.innerWidth > 768;

    // ── SHARED SECTION BLOCKS ─────────────────────────────────────────────

    const avatarBlockHTML = `
        <div style="display:flex;flex-direction:column;align-items:center;margin-bottom:24px;">
            <div onclick="document.getElementById('profileInput').click()"
                 style="position:relative;width:80px;height:80px;border-radius:50%;
                        background:#6f1d1b;border:none;
                        overflow:hidden;cursor:pointer;flex-shrink:0;">
                <div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:#6f1d1b;">
                    ${avatarHTML}
                </div>
            </div>
            <div onclick="document.getElementById('profileInput').click()"
                 style="margin-top:8px;font-size:14px;color:#4fd1c5;font-weight:600;cursor:pointer;">
                Edit
            </div>
        </div>`;

    const personalSectionHTML = `
        <div style="font-size:12px;font-weight:600;color:#8b949e;text-transform:uppercase;
                    letter-spacing:0.08em;padding:0 4px;margin-bottom:8px;">Personal</div>
        <div style="background:#1b1b1b;border:1px solid rgba(255,255,255,0.06);
                    border-radius:14px;overflow:hidden;margin-bottom:28px;">
            <div style="padding:14px 16px;display:flex;align-items:center;justify-content:space-between;">
                <span style="font-size:14px;color:#8b949e;">Name</span>
                <span style="font-size:14px;color:#c9d1d9;font-weight:500;"><?= htmlspecialchars($learnerFullName) ?></span>
            </div>
            <div style="height:1px;background:rgba(255,255,255,0.06);margin-left:16px;"></div>
            <div style="padding:14px 16px;display:flex;align-items:center;justify-content:space-between;">
                <span style="font-size:14px;color:#8b949e;">Email</span>
                <span style="font-size:13px;color:#c9d1d9;max-width:220px;text-align:right;word-break:break-all;"><?= htmlspecialchars($learnerEmail) ?></span>
            </div>
            <div style="height:1px;background:rgba(255,255,255,0.06);margin-left:16px;"></div>
            <div style="padding:14px 16px;display:flex;align-items:center;justify-content:space-between;">
                <span style="font-size:14px;color:#8b949e;">Gender</span>
                <span style="font-size:14px;color:#c9d1d9;font-weight:500;"><?php if (!empty($learnerGender)): ?><?= htmlspecialchars(ucfirst($learnerGender)) ?><?php else: ?><span style="color:#8b949e;font-style:italic;">Not set</span><?php endif; ?></span>
            </div>
            <div style="height:1px;background:rgba(255,255,255,0.06);margin-left:16px;"></div>
            <div style="padding:14px 16px;">
                <label style="display:block;font-size:12px;color:#8b949e;margin-bottom:6px;font-weight:500;letter-spacing:0.03em;">Date of Birth</label>
                <input type="date" id="pi_dob" value="${val(profile.date_of_birth)}"
                       style="width:100%;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);
                              border-radius:9px;padding:10px 12px;color:#e2e8f0;font-size:14px;
                              font-family:inherit;box-sizing:border-box;color-scheme:dark;">
            </div>
            <div style="height:1px;background:rgba(255,255,255,0.06);margin-left:16px;"></div>
            <div style="padding:14px 16px;">
                <label style="display:block;font-size:12px;color:#8b949e;margin-bottom:6px;font-weight:500;letter-spacing:0.03em;">ID Number</label>
                <input type="text" id="pi_id" value="${val(profile.id_number)}"
                       placeholder="13-digit South African ID" maxlength="13"
                       style="width:100%;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);
                              border-radius:9px;padding:10px 12px;color:#e2e8f0;font-size:14px;
                              font-family:inherit;box-sizing:border-box;">
            </div>
            <div style="height:1px;background:rgba(255,255,255,0.06);margin-left:16px;"></div>
            <div style="padding:14px 16px;">
                <label style="display:block;font-size:12px;color:#8b949e;margin-bottom:6px;font-weight:500;letter-spacing:0.03em;">Address</label>
                <input type="text" id="pi_address" value="${val(profile.address)}"
                       placeholder="Street, City, Province"
                       style="width:100%;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);
                              border-radius:9px;padding:10px 12px;color:#e2e8f0;font-size:14px;
                              font-family:inherit;box-sizing:border-box;">
            </div>
        </div>`;

    const guardianSectionHTML = `
        <div style="font-size:12px;font-weight:600;color:#8b949e;text-transform:uppercase;
                    letter-spacing:0.08em;padding:0 4px;margin-bottom:8px;">Guardian / Parent</div>
        <div style="background:#1b1b1b;border:1px solid rgba(255,255,255,0.06);
                    border-radius:14px;overflow:hidden;margin-bottom:28px;">
            <div style="padding:14px 16px;">
                <label style="display:block;font-size:12px;color:#8b949e;margin-bottom:6px;font-weight:500;letter-spacing:0.03em;">Guardian Name</label>
                <input type="text" id="pi_gname" value="${val(profile.guardian_name)}"
                       placeholder="Full name of guardian"
                       style="width:100%;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);
                              border-radius:9px;padding:10px 12px;color:#e2e8f0;font-size:14px;
                              font-family:inherit;box-sizing:border-box;">
            </div>
            <div style="height:1px;background:rgba(255,255,255,0.06);margin-left:16px;"></div>
            <div style="padding:14px 16px;">
                <label style="display:block;font-size:12px;color:#8b949e;margin-bottom:6px;font-weight:500;letter-spacing:0.03em;">Relationship</label>
                <select id="pi_grel"
                        style="width:100%;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);
                               border-radius:9px;padding:10px 12px;color:#e2e8f0;font-size:14px;
                               font-family:inherit;box-sizing:border-box;cursor:pointer;color-scheme:dark;">
                    <option value="" style="background:#1b1b1b;">Select relationship</option>
                    ${['Mother','Father','Grandmother','Grandfather','Aunt','Uncle','Sister','Brother','Legal Guardian','Other'].map(r =>
                        `<option value="${r}" style="background:#1b1b1b;" ${val(profile.guardian_relationship) === r ? 'selected' : ''}>${r}</option>`
                    ).join('')}
                </select>
            </div>
            <div style="height:1px;background:rgba(255,255,255,0.06);margin-left:16px;"></div>
            <div style="padding:14px 16px;">
                <label style="display:block;font-size:12px;color:#8b949e;margin-bottom:6px;font-weight:500;letter-spacing:0.03em;">Guardian Phone</label>
                <input type="tel" id="pi_gphone" value="${val(profile.guardian_phone)}"
                       placeholder="e.g. 071 234 5678"
                       style="width:100%;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);
                              border-radius:9px;padding:10px 12px;color:#e2e8f0;font-size:14px;
                              font-family:inherit;box-sizing:border-box;">
            </div>
            <div style="height:1px;background:rgba(255,255,255,0.06);margin-left:16px;"></div>
            <div style="padding:14px 16px;">
                <label style="display:block;font-size:12px;color:#8b949e;margin-bottom:6px;font-weight:500;letter-spacing:0.03em;">Guardian Email</label>
                <input type="email" id="pi_gemail" value="${val(profile.guardian_email)}"
                       placeholder="guardian@example.com"
                       style="width:100%;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);
                              border-radius:9px;padding:10px 12px;color:#e2e8f0;font-size:14px;
                              font-family:inherit;box-sizing:border-box;">
            </div>
        </div>`;

    const emergencySectionHTML = `
        <div style="font-size:12px;font-weight:600;color:#8b949e;text-transform:uppercase;
                    letter-spacing:0.08em;padding:0 4px;margin-bottom:8px;">Emergency &amp; Medical</div>
        <div style="background:#1b1b1b;border:1px solid rgba(255,255,255,0.06);
                    border-radius:14px;overflow:hidden;margin-bottom:28px;">
            <div style="padding:14px 16px;">
                <label style="display:block;font-size:12px;color:#8b949e;margin-bottom:6px;font-weight:500;letter-spacing:0.03em;">Emergency Contact Name</label>
                <input type="text" id="pi_ename" value="${val(profile.emergency_contact_name)}"
                       placeholder="Full name"
                       style="width:100%;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);
                              border-radius:9px;padding:10px 12px;color:#e2e8f0;font-size:14px;
                              font-family:inherit;box-sizing:border-box;">
            </div>
            <div style="height:1px;background:rgba(255,255,255,0.06);margin-left:16px;"></div>
            <div style="padding:14px 16px;">
                <label style="display:block;font-size:12px;color:#8b949e;margin-bottom:6px;font-weight:500;letter-spacing:0.03em;">Emergency Contact Phone</label>
                <input type="tel" id="pi_ephone" value="${val(profile.emergency_contact_phone)}"
                       placeholder="e.g. 082 345 6789"
                       style="width:100%;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);
                              border-radius:9px;padding:10px 12px;color:#e2e8f0;font-size:14px;
                              font-family:inherit;box-sizing:border-box;">
            </div>
            <div style="height:1px;background:rgba(255,255,255,0.06);margin-left:16px;"></div>
            <div style="padding:14px 16px;">
                <label style="display:block;font-size:12px;color:#8b949e;margin-bottom:6px;font-weight:500;letter-spacing:0.03em;">Medical Notes</label>
                <textarea id="pi_medical" rows="3"
                          placeholder="Allergies, conditions, medication, etc."
                          style="width:100%;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);
                                 border-radius:9px;padding:10px 12px;color:#e2e8f0;font-size:14px;
                                 font-family:inherit;box-sizing:border-box;resize:vertical;min-height:80px;">${val(profile.medical_notes)}</textarea>
            </div>
        </div>`;

    const saveBtnHTML = `
        <button id="pi_save_btn" onclick="saveLearnerPersonalInfo()"
                style="width:100%;padding:16px;background:#4fd1c5;border:none;border-radius:14px;
                       color:#0d1117;font-size:15px;font-weight:700;cursor:pointer;
                       font-family:inherit;transition:opacity 0.2s ease;letter-spacing:0.02em;">
            Save Changes
        </button>
        <div id="pi_feedback" style="display:none;margin-top:12px;text-align:center;
                                     font-size:13px;font-weight:600;padding:12px;
                                     border-radius:10px;"></div>`;

    // ── DESKTOP: two-column layout ─────────────────────────────────────────
    if (isDesktop) {
        apiArea.innerHTML = `
        <style>
            .learner-personal-desktop {
                max-width: 1120px;
                margin: 0 auto;
                padding: 24px 28px 56px;
                font-family: 'Nunito', sans-serif;
            }
            .learner-personal-shell {
                display: grid;
                grid-template-columns: minmax(280px, 340px) minmax(0, 1fr);
                gap: 0;
                min-height: calc(100vh - 150px);
                border: 1px solid rgba(255,255,255,0.07);
                border-radius: 14px;
                overflow: hidden;
                background: #0d1117;
            }
            .learner-personal-rail {
                padding: 24px 22px;
                background: #0d1117;
                border-right: 1px solid rgba(255,255,255,0.07);
            }
            .learner-personal-main {
                padding: 24px;
                overflow-y: auto;
            }
            .learner-personal-heading {
                margin: 0 0 18px;
                color: #4fd1c5;
                font-size: 11px;
                font-weight: 800;
                letter-spacing: 1.5px;
                text-transform: uppercase;
            }
            .learner-personal-main-grid {
                display: grid;
                grid-template-columns: repeat(2, minmax(0, 1fr));
                gap: 20px;
                align-items: start;
            }
            .learner-personal-save {
                max-width: 460px;
                margin-left: auto;
            }
        </style>
        <div class="learner-personal-desktop">
            <div class="learner-personal-shell">

                <!-- LEFT: Avatar + Personal details -->
                <div class="learner-personal-rail">
                    <h2 class="learner-personal-heading">Personal Information</h2>
                    ${avatarBlockHTML}
                    ${personalSectionHTML}
                </div>

                <!-- RIGHT: Guardian + Emergency + Save -->
                <div class="learner-personal-main">
                    <div class="learner-personal-main-grid">
                        <div>${guardianSectionHTML}</div>
                        <div>${emergencySectionHTML}</div>
                    </div>
                    <div class="learner-personal-save">${saveBtnHTML}</div>
                </div>

            </div>
        </div>`;
        return;
    }

    // ── MOBILE: original single-column layout ──────────────────────────────
    apiArea.innerHTML = `
        <div style="padding:24px 16px 60px;max-width:520px;margin:0 auto;">
            ${avatarBlockHTML}
            ${personalSectionHTML}
            ${guardianSectionHTML}
            ${emergencySectionHTML}
            ${saveBtnHTML}
        </div>`;
};

// ── SAVE HANDLER ─────────────────────────────────────────────────────────
window.saveLearnerPersonalInfo = async function() {
    const btn      = document.getElementById('pi_save_btn');
    const feedback = document.getElementById('pi_feedback');

    btn.disabled     = true;
    btn.textContent  = 'Saving…';
    btn.style.opacity = '0.6';

    const payload = new URLSearchParams({
        date_of_birth:           document.getElementById('pi_dob')?.value    || '',
        id_number:               document.getElementById('pi_id')?.value     || '',
        address:                 document.getElementById('pi_address')?.value || '',
        guardian_name:           document.getElementById('pi_gname')?.value  || '',
        guardian_relationship:   document.getElementById('pi_grel')?.value   || '',
        guardian_phone:          document.getElementById('pi_gphone')?.value  || '',
        guardian_email:          document.getElementById('pi_gemail')?.value  || '',
        emergency_contact_name:  document.getElementById('pi_ename')?.value  || '',
        emergency_contact_phone: document.getElementById('pi_ephone')?.value  || '',
        medical_notes:           document.getElementById('pi_medical')?.value || '',
    });

    try {
        const res  = await fetch('api/learner/save_learner_profile.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' , 'X-CSRF-Token': getCsrfToken() },
            body: payload
        });
        const data = await res.json();

        if (data.success) {
            feedback.style.display     = 'block';
            feedback.style.background  = 'rgba(79,209,197,0.1)';
            feedback.style.border      = '1px solid rgba(79,209,197,0.3)';
            feedback.style.color       = '#4fd1c5';
            feedback.textContent       = '✓ Profile saved successfully';
            btn.textContent            = 'Save Changes';
            btn.disabled               = false;
            btn.style.opacity          = '1';

            // Auto-hide feedback after 3s
            setTimeout(() => { if (feedback) feedback.style.display = 'none'; }, 3000);
        } else {
            throw new Error(data.error || 'Save failed');
        }
    } catch(e) {
        feedback.style.display    = 'block';
        feedback.style.background = 'rgba(248,81,73,0.1)';
        feedback.style.border     = '1px solid rgba(248,81,73,0.3)';
        feedback.style.color      = '#f85149';
        feedback.textContent      = '✗ ' + (e.message || 'Could not save. Try again.');
        btn.textContent           = 'Save Changes';
        btn.disabled              = false;
        btn.style.opacity         = '1';
    }
};

window.removeLearnerProfilePicture = function() {
    if (!confirm('Remove your profile picture?')) return;
    fetch('upload_profile.php', {
        method: 'POST',
        headers: { 'X-CSRF-Token': getCsrfToken() },
        body: new URLSearchParams({ remove: '1' })
    })
    .then(r => r.json())
    .then(data => {
        if (data.success) {
            const initials = '<?= htmlspecialchars($initials) ?>';
            if (typeof window.resetAvatarUI === 'function') {
                window.resetAvatarUI(initials);
            }
             loadLearnerSettings(); // ← ADDED
        } else {
            alert(data.error || 'Failed to remove picture');
        }
    })
    .catch(() => alert('Connection error'));
};

   const avatarWrapper = document.querySelector(".profile-picture-wrapper");
const profileInput = document.getElementById("profileInput");

// Shared function to update avatar instantly in the sidebar
window.updateAvatarUI = function(imageUrl) {
    const topNav = document.getElementById('topNavAvatar');
    if (topNav) {
        topNav.innerHTML = `<img src="${imageUrl}" alt="Profile" style="width:100%;height:100%;object-fit:cover;">`;
    }

    let img = avatarWrapper.querySelector('img.learner-avatar');
    if (img) {
        // Already has a photo — just swap the src
        img.src = imageUrl;
    } else {
        // Had initials — remove initials div, create img, keep file input intact
        const initialsDiv = avatarWrapper.querySelector('.initials-avatar');
        if (initialsDiv) initialsDiv.remove();

        const newImg = document.createElement('img');
        newImg.alt = "Profile Picture";
        newImg.className = "learner-avatar";
        newImg.style.cssText = "width:40px;height:40px;border-radius:50%;object-fit:cover;border:none;";
        newImg.src = imageUrl;

        // Insert BEFORE the file input so input stays in DOM
        avatarWrapper.insertBefore(newImg, profileInput);
    }
};

// Shared function to revert back to initials
window.resetAvatarUI = function(initials) {
    const topNav = document.getElementById('topNavAvatar');
    if (topNav) topNav.innerHTML = `<span class="initials-sm">${initials}</span>`;

    const img = avatarWrapper.querySelector('img.learner-avatar');
    if (img) img.remove();

    if (!avatarWrapper.querySelector('.initials-avatar')) {
        const div = document.createElement('div');
        div.className = 'initials-avatar';
        div.textContent = initials;
        avatarWrapper.insertBefore(div, profileInput);
    }
};

if (avatarWrapper && profileInput) {
    profileInput.addEventListener("change", function (e) {
        const file = e.target.files[0];
        if (!file) return;

        // Show instant preview BEFORE upload completes (no loader needed)
        const previewUrl = URL.createObjectURL(file);
        window.updateAvatarUI(previewUrl);

        const fd = new FormData();
        fd.append("profile", file);

        fetch("upload_profile.php", { method: "POST", headers: { 'X-CSRF-Token': getCsrfToken() }, body: fd })
            .then(r => r.json())
            .then(data => {
                if (data.success) {
                    // Swap blob preview with real permanent server URL
                    const serverUrl = "uploads/learners/" + data.file + "?t=" + Date.now();
                    window.updateAvatarUI(serverUrl);
                     loadLearnerSettings(); // ← ADDED
                } else {
                    alert(data.error || "Upload failed");
                }
                profileInput.value = ''; // Reset so same file can be picked again
            })
            .catch(err => {
                console.error("Upload Error:", err);
                alert("A connection error occurred during upload.");
                profileInput.value = '';
            });
    });
}
    // ────────────────────────────────────────────────────────────────────────
    // 4. SIDEBAR & MY CLASS (Your original working logic)
    // ────────────────────────────────────────────────────────────────────────
    const navItems = document.querySelectorAll("[data-page]");
    window.setActive = function(page) {
        navItems.forEach(item => {
            item.classList.toggle("active", item.getAttribute("data-page") === page);
        });
    }

window.toggleSidebar = function (forceClose = false) {
    const isCurrentlyOpen = sidebar.classList.contains("active");
    const themeColorMeta = document.querySelector('meta[name="theme-color"]');
    const mainHeader = document.querySelector('.main-header');

    // If forceClose is true (from the X button) or it's already open, close it
    if (forceClose || isCurrentlyOpen) {
        sidebar.classList.remove("active");
        sidebar.classList.remove("desktop-open"); 
        if (mobileOverlay) {
            mobileOverlay.style.display = "none";
        }

        // MENU CLOSED: put .main-header's background back to whatever it
        // legitimately was before the menu opened (its own page colour, or
        // transparent on Home) — restored from the value we saved on open,
        // rather than guessing, so we never clobber a real page colour.
        if (mainHeader) {
            mainHeader.style.background = mainHeader.dataset.bgBeforeMenu ?? '';
            delete mainHeader.dataset.bgBeforeMenu;
            mainHeader.style.pointerEvents = '';
        }

        // MENU CLOSED: restore the browser bar to whatever colour the
        // current page should actually be showing right now. If the page
        // is scrolled down past the header threshold on a coloured page
        // (e.g. Announcements), that's window.learnerCurrentPageColor —
        // otherwise it's the dark default, matching exactly what the
        // scroll handler in configureHeader already does on its own.
        if (window.innerWidth <= 768 && themeColorMeta) {
            const isScrolledOnColoredPage =
                mainHeader &&
                mainHeader.classList.contains('header-scrolled') &&
                mainHeader.getAttribute('data-page-color');
            themeColorMeta.setAttribute(
                'content',
                isScrolledOnColoredPage ? window.learnerCurrentPageColor : '#20201f'
            );
        }
    } else {
        // Only allow open on mobile
        if (window.innerWidth <= 768) {
            sidebar.classList.add("active");
            mobileOverlay.style.display = "block";

            // MENU OPEN: .main-header is nested inside .main-content, so
            // it can't be reached with a CSS sibling selector off
            // .sidebar.active the way #mobileBottomNav and #mobileOverlay
            // are — and its own position:fixed + z-index gives it its own
            // stacking context, so it doesn't inherit .main-content's
            // blur either. Simplest fix: rather than trying to blur it,
            // just recolour it to match the menu's own background
            // (#20201f) directly, so the whole top strip blends in
            // exactly like the rest of the dimmed screen. The header's
            // CURRENT background is saved first (it might legitimately be
            // a page's own accent colour) so we can put it back exactly
            // as it was when the menu closes, instead of guessing.
            if (mainHeader) {
                mainHeader.dataset.bgBeforeMenu = mainHeader.style.background || '';
                mainHeader.style.background = '#20201f';
                mainHeader.style.pointerEvents = 'none';
            }

            // MENU OPEN: force the browser bar to match the menu's own
            // dark background (#20201f), regardless of whatever colour
            // the current page had it set to — keeps the whole screen
            // reading as one consistent dark surface while the menu is
            // open. Restored back on close, above.
            if (themeColorMeta) themeColorMeta.setAttribute('content', '#20201f');
        }
        // Desktop open is handled by desktopToggle listener — do nothing here
    }
};



    window.showMyClass = function () {
        myClassContent.classList.add("active");
        iframe.style.display = "none";
        setActive("my-class");
        if (window.configureHeader) {
            window.configureHeader({ title: 'My Class', mode: 'standard', color: '#63b3ed' });
        }
        if (window.innerWidth <= 768) toggleSidebar();
        if (apiArea) apiArea.style.display = "none";
    };

    window.toggleParentDropdown = () => {
        const drop = document.getElementById("parentDropdown");
        drop.style.display = drop.style.display === "block" ? "none" : "block";
    };

    document.getElementById("parentLinkForm")?.addEventListener("submit", function(e) {
    e.preventDefault();
    const email = this.querySelector("select").value;
    // Get the class ID from a hidden input or the PHP variable
    const classId = "<?= $joinedClassIds[0] ?? 0 ?>"; 

    if (!email || classId == 0) return alert("Select a parent and ensure you are in a class.");
    
    loader.style.display = "flex";
    
    fetch("link_parent.php", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" , 'X-CSRF-Token': getCsrfToken() },
        // Use encodeURIComponent for both to be safe
        body: "parent_email=" + encodeURIComponent(email) + "&class_id=" + classId
    })
    .then(r => r.json())
    .then(d => { 
        if (d.success) {
            location.reload(); 
        } else {
            alert("Error: " + d.error); // This will now tell you exactly what's wrong
        }
    })
    .catch(err => alert("Connection error"))
    .finally(() => loader.style.display = "none");
});

    function createMobileOverlay() {
        const div = document.createElement("div");
        div.id = "mobileOverlay";
        Object.assign(div.style, {
            display: "none", position: "fixed", top: 0, left: 0, width: "100%", height: "100%",
            background: "rgba(0,0,0,0.4)", zIndex: 1500
        });
        document.body.appendChild(div);
        return div;
    }

    mobileOverlay.addEventListener("click", toggleSidebar);

    // ------------------------------------------------------------------------
    // MOBILE SWIPE GESTURES - open sidebar on swipe-right, close on swipe-left
    // Rules:
    //   - Open  : touch starts within 28px of left edge, swipes right >= 60px,
    //             horizontal drag is dominant (more X movement than Y)
    //   - Close : sidebar is open, swipes left >= 60px, horizontal dominant
    //   - Only active on mobile (<= 768px). Does not block page scroll.
    // ------------------------------------------------------------------------
    if (window.innerWidth <= 768) {
        let _swipeStartX   = 0;
        let _swipeStartY   = 0;
        let _swipeTracking = false;
        let _swipeIsEdge   = false; // true when gesture started from left edge

        document.addEventListener('touchstart', function(e) {
            if (window.innerWidth > 768) return;
            const t = e.touches[0];
            _swipeStartX   = t.clientX;
            _swipeStartY   = t.clientY;
            _swipeIsEdge   = _swipeStartX <= 28;                          // left-edge open gesture
            _swipeTracking = _swipeIsEdge || sidebar.classList.contains('active');
        }, { passive: true });

        // touchmove: non-passive so we can preventDefault on left-edge swipes,
        // preventing the browser back-navigation gesture from stealing the event.
        document.addEventListener('touchmove', function(e) {
            if (!_swipeTracking || !_swipeIsEdge) return;                 // only block edge-open swipes
            if (window.innerWidth > 768) return;
            const deltaX = e.touches[0].clientX - _swipeStartX;
            const deltaY = e.touches[0].clientY - _swipeStartY;
            // Only cancel if the move is more horizontal than vertical
            if (Math.abs(deltaX) > Math.abs(deltaY) && deltaX > 0) {
                e.preventDefault();                                       // stops browser back-swipe
            }
        }, { passive: false });

        document.addEventListener('touchend', function(e) {
            if (!_swipeTracking || window.innerWidth > 768) return;
            _swipeTracking = false;
            const t      = e.changedTouches[0];
            const deltaX = t.clientX - _swipeStartX;
            const deltaY = t.clientY - _swipeStartY;
            // Must be horizontal-dominant; no minimum distance for edge-open swipes
            if (Math.abs(deltaX) <= Math.abs(deltaY)) return;
            const isOpen = sidebar.classList.contains('active');
            if (deltaX > 0 && !isOpen && _swipeIsEdge) { toggleSidebar();      } // any right-swipe from edge -> open
            if (deltaX < 0 &&  isOpen)                 { toggleSidebar(true);  } // swipe left -> close (keep 60px min)
            _swipeIsEdge = false;
        }, { passive: true });
    }

    
    // Init UI Highlighter
    const lastSaved = sessionStorage.getItem("lastLearnerPage");
    if (lastSaved === "quiz_list.php") {
        window.setActive("quiz_list.php");
        } else if (lastSaved === "assignment_list.php") { // <--- ADD THIS
    window.setActive("assignment_list.php");
    } else if (lastSaved === "resource_list.php") {
    window.setActive("resource_list.php");
 } else if (lastSaved === "partials/manual.html") {
    window.setActive("partials/manual.html");
} else if (lastSaved === "announcement_list.php") {
    window.setActive("announcement_list.php");
} else if (lastSaved === "evaluation_list.php") {
    window.setActive("evaluation_list.php");
} else if (lastSaved === 'grades') {
    window.setActive('grades');
} else if (lastSaved === 'syllabus') {
    window.setActive('syllabus');
} else if (lastSaved === "discussion_list.php") {
    window.setActive("discussion_list.php");
} else if (lastSaved === "learner_calendar") {
    window.setActive("learner_calendar");
} else if (lastSaved === "learner_settings") {
    window.setActive("learner_settings");
}
    else {
        window.setActive("<?= $currentPage ?>");
    }

    // Desktop slide-in with backdrop
const desktopToggle = document.getElementById('desktopMenuToggle');
const desktopBackdrop = document.getElementById('desktopBackdrop');

if (desktopToggle) {
    desktopToggle.addEventListener('click', () => {
        sidebar.classList.toggle('desktop-open'); 
        sidebar.classList.remove('active');
    });

    // Click backdrop to close
    if (desktopBackdrop) {
        desktopBackdrop.addEventListener('click', () => {
            if (window.innerWidth > 768) {
                sidebar.classList.remove('desktop-open');
            }
        });
    }

    // Esc key to close
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape' && sidebar.classList.contains('desktop-open')) {
            sidebar.classList.remove('desktop-open');
        }
    });
}
    loader.style.display = "none";

    // ─────────────────────────────────────────────────────────────────────
    // Watches .main-content (the mobile scroll container).
    // Header:   transparent at top  → glass when scrolled DOWN past threshold.
    // Bottom nav: transparent at bottom → glass when scrolled UP (not at bottom).
    // Only wired on mobile. Discussion threads set overflow:hidden on
    // .main-content so scrollTop never changes — safe during threads.
    if (window.innerWidth <= 768) {
        const apiArea       = document.querySelector('#api-content-area');
        const mainHeader    = document.querySelector('.main-header');
        const bottomNav     = document.getElementById('mobileBottomNav');
        const themeColorMeta = document.querySelector('meta[name="theme-color"]');
        const SCROLL_THRESHOLD = 10; // px before header solidifies
        const DETAIL_TITLE_THRESHOLD = 28; // px before detail title collapses into header
        const BOTTOM_THRESHOLD = 10; // px from bottom before nav fades out

        // Pulled out into its own named function so it can be run both on
        // a real scroll event AND right after a page's content finishes
        // loading (see the MutationObserver below) — previously this only
        // ran on 'scroll', so after switching pages (Quiz, Announcements,
        // etc.) the bottom nav's background was decided against whatever
        // content happened to be in the DOM at that instant. Since those
        // pages load asynchronously, the synthetic scroll dispatch in
        // prepareLearnerMobileNavigation() often fired BEFORE the new
        // content existed, leaving distFromBottom calculated against the
        // old/empty page — so the bottom nav could get stuck showing the
        // wrong background (solid vs transparent) until the person
        // manually scrolled and triggered a fresh, correct calculation.
        // Exposed globally (window.recalcMobileScrollUI) so page-specific
        // scripts — assignments.js, quiz.js, announcements.js, etc. — can
        // trigger a recalculation themselves after anything that changes
        // the page's scrollable height WITHOUT a real scroll event, such
        // as expanding/collapsing an accordion folder. Previously the
        // bottom nav's background only updated on an actual scroll or a
        // page switch (via the loader-hide hook below); toggling a folder
        // open/closed does neither, so the nav could get stuck showing a
        // background that no longer matched whether the page could
        // actually scroll.
        window.recalcMobileScrollUI = function recalcMobileScrollUI() {
            if (!apiArea || !mainHeader) return;
            // Bail out completely while a full-screen sheet (Progress Report /
            // Quiz Review) is open. Those sheets force the header background
            // AND the theme-color meta to the sheet's own dark #20201f via
            // darkenBrowserBarForSheet() (see grades.js) so the browser/status
            // bar blends with the sheet instead of the page underneath. But
            // this function keeps running off the underlying page's OWN
            // scroll container/listener + the loader-hide MutationObserver,
            // both of which are completely independent of the sheet — so a
            // scroll (or a recalc triggered from inside the sheet's content,
            // e.g. an accordion toggle) could fire in between, re-read the
            // underlying page's scrollTop, and slam the header/theme-color
            // back to that page's own accent colour (e.g. Grades' green)
            // WHILE the sheet is still open and dark on top of it — the
            // exact mismatch this was reported for. Checking for the sheet
            // here, at the single source both the header background and the
            // theme-color meta are decided, closes that race instead of
            // relying on timing.
            if (document.querySelector('.pr-modal-overlay')) return;
            // While a page transition is in flight, judge the header, browser
            // bar and bottom nav by where the incoming page is about to be
            // scrolled to -- not by the position the outgoing content happens
            // to be at. That is what lets them go straight to their final look
            // instead of flashing the "at top" look first. See MOBILE VIEW
            // TRANSITIONS below.
            const pending       = window._learnerPendingScroll;
            const realScrollTop = apiArea.scrollTop;
            const scrollTop     = pending ? pending.target : realScrollTop;
            const scrollHeight  = apiArea.scrollHeight;
            const clientHeight  = apiArea.clientHeight;
            let distFromBottom  = scrollHeight - realScrollTop - clientHeight;
            if (pending && pending.atBottom !== undefined) {
                distFromBottom = pending.atBottom ? 0 : BOTTOM_THRESHOLD + 1;
            }

            // Header: solid when scrolled down, transparent at top
            if (scrollTop > SCROLL_THRESHOLD) {
                const pageColor = window.learnerCurrentPageColor || '#20201f';
                const isHome = !mainHeader.getAttribute('data-page-color');
                // Home stays dark glass; other pages match the browser bar colour
                const headerBg = isHome
                    ? '#20201f'
                    : pageColor;
                mainHeader.classList.add('header-scrolled');
                mainHeader.style.background = headerBg;
                if (themeColorMeta) themeColorMeta.setAttribute('content', isHome ? '#20201f' : pageColor);
            } else {
                mainHeader.classList.remove('header-scrolled');
                mainHeader.style.background = '';
                if (themeColorMeta) themeColorMeta.setAttribute('content', '#20201f');
            }

            if (mainHeader.classList.contains('mobile-detail-mode')) {
                if (scrollTop > DETAIL_TITLE_THRESHOLD) {
                    mainHeader.classList.add('detail-title-collapsed');
                } else {
                    mainHeader.classList.remove('detail-title-collapsed');
                }
            }

            // Bottom nav: transparent near bottom, glass when scrolled up
            if (bottomNav) {
                if (distFromBottom <= BOTTOM_THRESHOLD) {
                    bottomNav.classList.remove('nav-scrolled');
                } else {
                    bottomNav.classList.add('nav-scrolled');
                }
            }
        };
        const recalcMobileScrollUI = window.recalcMobileScrollUI;

        if (apiArea && mainHeader) {
            apiArea.addEventListener('scroll', recalcMobileScrollUI, { passive: true });

            // Every learner page renders inside #api-content-area, but not every
            // page uses the loader or has its own recheck helper. Observe that
            // shared container so a page which renders from cache, completes a
            // delayed request, expands a section, or changes a filter gets the
            // correct bottom-nav state without requiring the learner to scroll.
            // The delayed checks also cover CSS height transitions, whose final
            // size is not available in the mutation callback itself.
            let contentRecheckFrame = null;
            let contentRecheckTimers = [];
            const scheduleContentScrollUIRecheck = () => {
                if (contentRecheckFrame !== null) {
                    cancelAnimationFrame(contentRecheckFrame);
                }
                contentRecheckTimers.forEach(clearTimeout);
                contentRecheckTimers = [];

                contentRecheckFrame = requestAnimationFrame(() => {
                    contentRecheckFrame = requestAnimationFrame(() => {
                        contentRecheckFrame = null;
                        recalcMobileScrollUI();
                    });
                });

                [150, 400].forEach(delay => {
                    contentRecheckTimers.push(setTimeout(recalcMobileScrollUI, delay));
                });
            };

            const contentObserver = new MutationObserver(scheduleContentScrollUIRecheck);
            contentObserver.observe(apiArea, {
                childList: true,
                subtree: true,
                attributes: true,
                attributeFilter: ['class', 'style', 'hidden', 'open']
            });

            // Images, embedded content, and fonts can increase a page's height
            // after its markup has already been inserted. Capturing load events
            // from descendants keeps the nav correct for those pages as well.
            apiArea.addEventListener('load', scheduleContentScrollUIRecheck, true);
            window.addEventListener('resize', scheduleContentScrollUIRecheck, { passive: true });
            window.addEventListener('orientationchange', scheduleContentScrollUIRecheck, { passive: true });

            // Set the correct state for the initially rendered learner page too.
            scheduleContentScrollUIRecheck();

            // ─────────────────────────────────────────────────────────────
            // MOBILE VIEW TRANSITIONS — scroll memory + flicker-free chrome
            //
            // Two jobs, done as ONE step so they can never disagree:
            //   1. Remember where each list was scrolled to and put it back.
            //   2. Set the header tint, browser-bar colour and bottom-nav
            //      glass for the page you are ARRIVING on, from the position
            //      it is about to be restored to, before the first paint.
            //
            // Why one step: the header and browser bar are derived from
            // scrollTop. If a page is first shown at the top and only later
            // scrolled to its remembered spot, they show the "at top" look
            // first and switch a moment later — and with CSS transitions on
            // both, that switch is a visible fade out and back in.
            //
            // How it works
            //   configureHeader() announces the incoming view
            //   (learnerBeginViewTransition). From that moment,
            //   recalcMobileScrollUI() judges the chrome by the
            //   REMEMBERED position (window._learnerPendingScroll) rather
            //   than the outgoing content's. When the new content actually
            //   lands in #api-content-area, the scroll offset is applied in
            //   the same task — before the browser paints — and stays under
            //   watch until it sticks, because content can keep growing
            //   after first render (Home's class list arrives from a fetch
            //   into a NESTED element, which watching only direct children
            //   never saw). CSS transitions on the two bars are switched off
            //   for the duration so the state snaps rather than fades.
            //
            // Views are keyed  <lastLearnerPage>:list  |  <lastLearnerPage>:<detailType>.
            // Only lists are remembered. Every detail page (all quizzes share
            // the one "Quiz" type, and so on) always opens at the top —
            // remembering per type would open quiz #5 scrolled to wherever
            // quiz #2 was left.
            // ─────────────────────────────────────────────────────────────
            window.learnerViewKey = function() {
                const page = sessionStorage.getItem('lastLearnerPage') || 'partials/manual.html';
                const detail = window.learnerHeaderDetailType;
                return page + ':' + (detail ? String(detail) : 'list');
            };
            const isListKey = (key) => /:list$/.test(key);

            const MOBILE_SCROLL_STORE = 'learnerMobileScroll';
            const MOBILE_BOTTOM_STORE = 'learnerMobileScrollAtBottom';
            const ARM_TIMEOUT_MS  = 4000;   // how long to wait for the new view's content to arrive
            const LAND_TIMEOUT_MS = 4000;   // how long to keep waiting for the page to become tall enough
            const HOLD_MS         = 500;    // keep re-asserting after landing (late layout, engine resets)

            const readStore = (name) => {
                try { return JSON.parse(sessionStorage.getItem(name) || '{}') || {}; }
                catch (e) { return {}; }
            };
            let scrollMemory = readStore(MOBILE_SCROLL_STORE);
            let bottomMemory = readStore(MOBILE_BOTTOM_STORE);
            let persistTimer = null;
            const persistMemory = () => {
                try {
                    sessionStorage.setItem(MOBILE_SCROLL_STORE, JSON.stringify(scrollMemory));
                    sessionStorage.setItem(MOBILE_BOTTOM_STORE, JSON.stringify(bottomMemory));
                } catch (e) { /* quota / private mode: memory just won't survive a refresh */ }
            };
            const schedulePersist = () => { clearTimeout(persistTimer); persistTimer = setTimeout(persistMemory, 250); };
            const atBottomNow = () =>
                (apiArea.scrollHeight - apiArea.scrollTop - apiArea.clientHeight) <= BOTTOM_THRESHOLD;

            // While a transition runs, the header and bottom nav must take
            // their final state instantly, not fade through the wrong one.
            if (!document.getElementById('learner-nav-snap-style')) {
                const snapStyle = document.createElement('style');
                snapStyle.id = 'learner-nav-snap-style';
                snapStyle.textContent =
                    'html.learner-nav-snap .main-header,' +
                    'html.learner-nav-snap #mobileBottomNav{transition:none !important;}';
                document.head.appendChild(snapStyle);
            }
            let snapOn = false;
            const beginSnap = () => { snapOn = true; document.documentElement.classList.add('learner-nav-snap'); };
            const endSnap = () => {
                if (!snapOn) return;
                snapOn = false;
                // Let the final state paint with transitions off, THEN turn them back on.
                requestAnimationFrame(() => requestAnimationFrame(() => {
                    if (!snapOn) document.documentElement.classList.remove('learner-nav-snap');
                }));
            };

            const recalcNow = () => {
                if (typeof window.recalcMobileScrollUI === 'function') window.recalcMobileScrollUI();
            };
            const setPending = (t) => {
                window._learnerPendingScroll = t ? { target: t.target, atBottom: t.atBottom } : null;
            };

            // One transition at a time:
            //   { key, target, atBottom, swapped, swappedAt, landedAt }
            //   swapped = the new view's content has been inserted
            //   landedAt = when the remembered offset was successfully applied
            let trans = null;
            let rafId = 0;
            let armTimer = 0;
            let trackedKey = window.learnerViewKey();   // view whose scroll we are recording
            let lastSeenKey = null;                           // last view whose content we saw swapped in

            // When a section renders from a requestAnimationFrame (the bottom nav
            // does), its own "reopen the folders you had open" step runs one
            // frame later, so the remembered offset can't be reached yet and
            // the first painted frame would show the page collapsed at the top.
            // Keep the new content invisible until the offset can land (its
            // layout is unaffected, so the measuring still works), and never
            // for longer than HIDE_MAX_MS.
            const HIDE_MAX_MS = 350;
            let heldBack = false;
            let heldTimer = 0;
            const holdBack = () => {
                if (heldBack) return;
                heldBack = true;
                apiArea.style.visibility = 'hidden';
                clearTimeout(heldTimer);
                heldTimer = setTimeout(reveal, HIDE_MAX_MS);
            };
            const reveal = () => {
                if (!heldBack) return;
                heldBack = false;
                clearTimeout(heldTimer);
                apiArea.style.visibility = '';
            };

            const finish = () => {
                cancelAnimationFrame(rafId); rafId = 0;
                clearTimeout(armTimer);
                trans = null;
                reveal();
                setPending(null);
                recalcNow();
                endSnap();
            };

            // Apply the remembered offset. Returns false while the page is
            // still too short to reach it.
            const land = () => {
                const want = trans.target;
                const max = apiArea.scrollHeight - apiArea.clientHeight;
                if (want > max + 1) return false;
                if (Math.abs(apiArea.scrollTop - want) > 1) {
                    if (want === 0) {
                        // Going to the top: also stop any iOS momentum still
                        // carrying the outgoing page's offset.
                        apiArea.style.overflowY = 'hidden';
                        apiArea.scrollTop = 0;
                        void apiArea.offsetHeight;
                        requestAnimationFrame(() => { apiArea.style.overflowY = ''; });
                    } else {
                        apiArea.style.scrollBehavior = 'auto';
                        apiArea.scrollTop = want;
                    }
                }
                return true;
            };

            const step = () => {
                if (!trans || !trans.swapped) return;
                if (land() && !trans.landedAt) {
                    trans.landedAt = performance.now();
                    reveal();
                    setPending(null);   // real scrollTop now equals the target
                    recalcNow();
                }
            };

            const tick = () => {
                rafId = 0;
                if (!trans) return;
                step();
                const t = performance.now();
                const expired = trans.landedAt
                    ? (t - trans.landedAt > HOLD_MS)
                    : (t - trans.swappedAt > LAND_TIMEOUT_MS);
                if (expired) { finish(); return; }
                rafId = requestAnimationFrame(tick);
            };

            const markSwapped = () => {
                if (!trans || trans.swapped) return;
                trans.swapped = true;
                trans.swappedAt = performance.now();
                lastSeenKey = trans.key;
                trackedKey = trans.key;     // retarget recording BEFORE any scroll event for the new content is delivered
                clearTimeout(armTimer);
                step();                     // lands right now — same task, before first paint
                if (trans && !trans.landedAt && trans.target > 0) holdBack();   // can't reach it yet: don't paint the page at the top
                if (!rafId && trans) rafId = requestAnimationFrame(tick);
            };

            const startTransition = (key, contentAlreadyHere) => {
                if (trans && trans.key === key) {
                    if (contentAlreadyHere) markSwapped();
                    return;
                }
                if (trans) { cancelAnimationFrame(rafId); rafId = 0; clearTimeout(armTimer); }
                const saved = isListKey(key) ? scrollMemory[key] : 0;
                trans = {
                    key,
                    target: (Number.isFinite(saved) && saved > 0) ? saved : 0,
                    atBottom: (key in bottomMemory) ? !!bottomMemory[key] : undefined,
                    swapped: false, swappedAt: 0, landedAt: 0
                };
                setPending(trans);
                beginSnap();
                clearTimeout(armTimer);
                // If the content never arrives (fetch failed, nothing rendered),
                // don't leave the chrome judged by a position we never reached.
                armTimer = setTimeout(() => { if (trans && !trans.swapped) finish(); }, ARM_TIMEOUT_MS);
                if (contentAlreadyHere) markSwapped();
            };
            window.learnerBeginViewTransition = (key) => {
                // The view being announced is already the one on screen (same
                // tab tapped again, or a section that calls configureHeader
                // after it has rendered): nothing is arriving, so don't arm a
                // transition that would wait for content that never comes.
                if (!trans && key === lastSeenKey) return;
                startTransition(key, false);
            };

            // A finger on the page always wins over anything restored.
            const cancelTransition = () => { if (trans) finish(); };
            apiArea.addEventListener('touchstart', cancelTransition, { passive: true });
            apiArea.addEventListener('wheel', cancelTransition, { passive: true });

            // Record where the learner is, per list view.
            apiArea.addEventListener('scroll', () => {
                if (trans && trans.swapped) return;                       // our own landing / hold window
                // Page identity changed (lastLearnerPage is written when a
                // fetch STARTS) but the content hasn't been swapped in yet:
                // what is scrolling is still the previous view. Attribute the
                // scroll to neither.
                if (window.learnerViewKey() !== trackedKey) return;
                if (!isListKey(trackedKey)) return;
                scrollMemory[trackedKey] = apiArea.scrollTop;
                bottomMemory[trackedKey] = atBottomNow();
                schedulePersist();
            }, { passive: true });

            // New content inserted into the container = the view has swapped.
            const onContentSwap = () => {
                const key = window.learnerViewKey();
                if (trans && trans.key === key) {
                    if (!trans.swapped) {
                        markSwapped();
                    } else {
                        // Rendered again right after landing (loader -> content,
                        // double render): re-apply and restart the hold window.
                        trans.landedAt = 0;
                        trans.swappedAt = performance.now();
                        step();
                    }
                    return;
                }
                if (key !== lastSeenKey) startTransition(key, true);
                // else: the same view re-rendered itself (filter, search, data
                // refresh) — leave the scroll exactly where the learner put it.
            };
            new MutationObserver(onContentSwap).observe(apiArea, { childList: true });

            // Tapping the tab you are already on: forget the position so it
            // isn't restored over the scroll-to-top.
            window.learnerForgetMobileScroll = function() {
                const key = window.learnerViewKey();
                if (!isListKey(key)) return;
                scrollMemory[key] = 0;
                bottomMemory[key] = atBottomNow();
                schedulePersist();
            };

            // Persist on the way out so a refresh keeps the position too.
            window.addEventListener('pagehide', persistMemory);
            document.addEventListener('visibilitychange', () => {
                if (document.visibilityState === 'hidden') persistMemory();
            });

            // Re-run the same check once the loader overlay hides — that's
            // the one centralised signal that reliably fires after ANY
            // page's async content has actually finished loading,
            // regardless of which specific fetch function (fetchQuizzes,
            // fetchAssignments, etc.) populated it. Using a
            // MutationObserver instead of a guessed setTimeout, since a
            // fixed delay would either fire too early on slow connections
            // or waste time waiting on fast ones.
            const loaderOverlayEl = document.getElementById('loaderOverlay');
            if (loaderOverlayEl) {
                // getComputedStyle (not .style.display) since the loader
                // starts hidden via CSS (display:none in the stylesheet),
                // not an inline style — reading .style.display alone would
                // wrongly see '' (empty) at first load and think it's visible.
                let wasLoaderVisible = getComputedStyle(loaderOverlayEl).display !== 'none';
                const loaderObserver = new MutationObserver(() => {
                    const isLoaderVisible = getComputedStyle(loaderOverlayEl).display !== 'none';
                    if (wasLoaderVisible && !isLoaderVisible) {
                        // Loader just went from visible -> hidden: content is ready.
                        // Double rAF so layout has settled before we measure.
                        requestAnimationFrame(() => requestAnimationFrame(recalcMobileScrollUI));
                    }
                    wasLoaderVisible = isLoaderVisible;
                });
                loaderObserver.observe(loaderOverlayEl, { attributes: true, attributeFilter: ['style'] });
            }
        }
    }
    // ─────────────────────────────────────────────────────────────────────
    // PULL-TO-REFRESH — mobile only
    // Swipe down from the very top of #api-content-area to refresh the current page.
    // Shows a small grey starburst spinner (matching the native iOS PTR style),
    // busts the cache, then re-calls the active page fetch function.
    // The loaderOverlay is suppressed during PTR so only ONE spinner is visible.
    // ─────────────────────────────────────────────────────────────────────
    if (window.innerWidth <= 768) {
        (function initPullToRefresh() {
            const scrollEl = document.querySelector('#api-content-area');
            if (!scrollEl) return;

            // Inject keyframes once
            if (!document.getElementById('ptrStyles')) {
                const st = document.createElement('style');
                st.id = 'ptrStyles';
                st.textContent = [
                    '@keyframes ptrSpin { to { transform: rotate(360deg); } }',
                    '@keyframes ptrFadeIn { from { opacity:0; } to { opacity:1; } }'
                ].join(' ');
                document.head.appendChild(st);
            }

            // ── Indicator element — grey starburst spinner ───────────────────────
            // A compact ring of rounded, fully visible spinner pills,
            // sitting in a white pill/circle, centered just below the header.
            const ptr = document.createElement('div');
            ptr.id = 'ptrIndicator';

            // Build eight thicker rounded pills. Keeping every pill at full
            // opacity makes the rotating ring clear instead of fading away.
            ptr.innerHTML = '<svg id="ptrSpinSvg" width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">'
                + (function() {
                    var lines = '';
                    for (var i = 0; i < 8; i++) {
                        var angle  = i * 45;
                        // Each pill is a short segment around the centre.
                        var rad    = (angle - 90) * Math.PI / 180;
                        var x1     = (16 + Math.cos(rad) * 6).toFixed(2);
                        var y1     = (16 + Math.sin(rad) * 6).toFixed(2);
                        var x2     = (16 + Math.cos(rad) * 13).toFixed(2);
                        var y2     = (16 + Math.sin(rad) * 13).toFixed(2);
                        lines += '<line x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2
                               + '" stroke="rgb(120,120,128)" stroke-width="3.8" stroke-linecap="round"/>';
                    }
                    return lines;
                }())
                + '</svg>';

            Object.assign(ptr.style, {
                position:        'fixed',
                top:             '68px',
                left:            '50%',
                transform:       'translateX(-50%) translateY(-80px)',
                width:           '42px',
                height:          '42px',
                borderRadius:    '50%',
                background:      'transparent',
                boxShadow:       'none',
                display:         'flex',
                alignItems:      'center',
                justifyContent:  'center',
                zIndex:          '9999',
                opacity:         '0',
                transition:      'opacity 0.18s ease, transform 0.18s ease',
                pointerEvents:   'none',
            });
            document.body.appendChild(ptr);

            const svgEl    = ptr.querySelector('#ptrSpinSvg');
            const THRESHOLD = 72;
            const HOLD_OFFSET = 52;
            const PTR_REFRESH_TIMEOUT = 15000;
            let startY = 0, pulling = false, triggered = false, pullOffset = 0;

            function startSpin() {
                svgEl.style.animation = 'ptrSpin 1.35s linear infinite';
            }
            function hide() {
                ptr.style.opacity   = '0';
                ptr.style.transform = 'translateX(-50%) translateY(-80px)';
                svgEl.style.animation = 'none';
            }

            // Move the actual page with the gesture, rather than only moving
            // the indicator. This gives the refresh interaction the familiar
            // native-app feel: pull, hold while loading, then settle back.
            function setPagePullOffset(offset, animate) {
                scrollEl.style.transition = animate
                    ? 'transform 0.24s cubic-bezier(0.22, 1, 0.36, 1)'
                    : 'none';
                scrollEl.style.transform = offset ? 'translate3d(0, ' + offset + 'px, 0)' : '';

                if (animate && !offset) {
                    setTimeout(function() {
                        if (!window._ptrRefreshing) scrollEl.style.transition = '';
                    }, 260);
                }
            }

            // The indicator belongs in the empty space above the pulled-down
            // content. Centre its unchanged 42px wrapper inside that gap.
            function getIndicatorOffset(offset) {
                return Math.max((offset - 42) / 2, -42);
            }

            // ── Cache bust + re-fetch — loaderOverlay suppressed during PTR ──────
            const refreshPages = {
                'quiz_list.php': {
                    caches: ['learnerQuizCache'], pending: ['learnerQuizPrefetchPromise'],
                    refresh: () => window.fetchQuizzes?.()
                },
                'assignment_list.php': {
                    caches: ['learnerAssignmentCache'], pending: ['learnerAssignmentPrefetchPromise'],
                    refresh: () => window.fetchAssignments?.()
                },
                'announcement_list.php': {
                    caches: ['announcementCache'], pending: ['announcementPrefetchPromise'],
                    refresh: () => window.fetchAnnouncements?.()
                },
                'resource_list.php': {
                    caches: ['resourceCache'], pending: ['resourcePrefetchPromise'],
                    refresh: () => window.fetchResources?.()
                },
                'evaluation_list.php': {
                    caches: ['evaluationCache'], pending: ['evaluationPrefetchPromise'],
                    refresh: () => window.fetchEvaluations?.()
                },
                'syllabus': {
                    caches: ['syllabusCache'], pending: ['syllabusPrefetchPromise'],
                    refresh: () => window.fetchSyllabus?.()
                },
                'grades': {
                    caches: ['learnerGradesCache'], pending: ['learnerGradesCachePromise'],
                    refresh: () => window.fetchGrades?.()
                },
                'discussion_list.php': {
                    caches: ['discussionCache'], pending: ['discussionPrefetchPromise'],
                    refresh: () => window.fetchDiscussions?.()
                },
                'learner_calendar': {
                    clear: () => { window.learnerCalendarEventsCache = {}; },
                    pending: ['learnerCalendarEventsPromises'],
                    refresh: () => window.fetchLearnerCalendar?.()
                },
                'partials/manual.html': {
                    caches: ['manualCache', 'homeDataCache'],
                    refresh: () => window.loadManual?.()
                },
                'learner_manual.php': {
                    refresh: () => window.loadManual?.()
                }
            };

            // Support page keys saved by earlier dashboard versions too.
            refreshPages.resources = refreshPages['resource_list.php'];
            refreshPages.manual = refreshPages['partials/manual.html'];
            refreshPages.home = refreshPages['partials/manual.html'];

            function clearPageCaches(config) {
                if (typeof config.clear === 'function') config.clear();
                (config.caches || []).forEach(function(cacheName) {
                    window[cacheName] = null;
                });
            }

            function waitForPendingRefreshes(config) {
                const pending = (config.pending || [])
                    .map(function(promiseName) {
                        const request = window[promiseName];
                        if (request && typeof request.then === 'function') {
                            return Promise.resolve(request).catch(function() {});
                        }
                        if (request && typeof request === 'object') {
                            const requests = Object.values(request)
                                .filter(function(value) { return value && typeof value.then === 'function'; });
                            return requests.length ? Promise.all(requests).catch(function() {}) : null;
                        }
                        return null;
                    })
                    .filter(Boolean);
                if (!pending.length) return Promise.resolve(false);

                // A stalled prefetch used to make the pull indicator spin
                // indefinitely. Wait briefly, then start a fresh request.
                return Promise.race([
                    Promise.all(pending).then(() => false),
                    new Promise(resolve => setTimeout(() => resolve(true), PTR_REFRESH_TIMEOUT))
                ]);
            }

            function clearPendingRefreshes(config) {
                (config.pending || []).forEach(function(promiseName) {
                    const request = window[promiseName];
                    window[promiseName] = request && typeof request === 'object' &&
                        typeof request.then !== 'function' ? {} : null;
                });
            }

            // The saved page keys above are the source of truth. On every pull
            // we clear its live cache, wait out any earlier prefetch, clear the
            // result again, then run the normal page fetcher. This prevents a
            // stale prefetch response from being rendered as a "refresh".
            function refreshCurrentPage() {
                const page = sessionStorage.getItem('lastLearnerPage') || 'partials/manual.html';
                const config = refreshPages[page] || refreshPages['partials/manual.html'];

                window._ptrRefreshing = true;
                clearTimeout(window.loaderTimeout);
                loader.style.display = 'none';

                clearPageCaches(config);
                const refreshWork = waitForPendingRefreshes(config)
                    .then(function(prefetchTimedOut) {
                        if (prefetchTimedOut) clearPendingRefreshes(config);
                        clearPageCaches(config);
                        return typeof config.refresh === 'function' ? config.refresh() : null;
                    });

                // Mobile requests can remain pending without rejecting. The
                // gesture must always release even when that happens.
                return Promise.race([
                    refreshWork,
                    new Promise(resolve => setTimeout(() => resolve('timed_out'), PTR_REFRESH_TIMEOUT))
                ]).then(function(result) {
                    if (result === 'timed_out') console.warn('Pull-to-refresh timed out.');
                })
                    .finally(function() {
                        window._ptrRefreshing = false;
                    });
            }

            // ── Touch handlers ──────────────────────────────────────────────────
            scrollEl.addEventListener('touchstart', function(e) {
                // Discussion threads have their own nested message scroller. Its
                // touch events bubble to #api-content-area, which is kept at
                // scrollTop 0 while the thread is open. Without this guard, a
                // normal swipe through older messages looks like a page-level
                // pull-to-refresh gesture.
                if (scrollEl.classList.contains('disc-thread-active')) {
                    pulling = false;
                    triggered = false;
                    return;
                }

                if (window._ptrRefreshing) return;

                if (scrollEl.scrollTop === 0) {
                    startY    = e.touches[0].clientY;
                    pulling   = true;
                    triggered = false;
                    pullOffset = 0;
                }
            }, { passive: true });

            scrollEl.addEventListener('touchmove', function(e) {
                if (!pulling) return;
                const deltaY = e.touches[0].clientY - startY;
                if (deltaY <= 0) { pulling = false; return; }

                const capped     = Math.min(deltaY, THRESHOLD * 1.5);
                const progress   = Math.min(capped / THRESHOLD, 1);
                pullOffset       = Math.min(capped * 0.5, HOLD_OFFSET);

                ptr.style.opacity   = String(Math.min(progress * 1.5, 1));
                ptr.style.transform = 'translateX(-50%) translateY(' + getIndicatorOffset(pullOffset) + 'px)';
                setPagePullOffset(pullOffset, false);

                if (capped >= THRESHOLD && !triggered) {
                    triggered = true;
                    startSpin();
                }
            }, { passive: true });

            scrollEl.addEventListener('touchend', function() {
                if (!pulling) return;
                pulling = false;
                if (triggered) {
                    // Keep the content and spinner visibly held while the
                    // request runs, then ease both back to their resting place.
                    pullOffset = Math.max(pullOffset, HOLD_OFFSET);
                    ptr.style.opacity = '1';
                    ptr.style.transform = 'translateX(-50%) translateY(' + getIndicatorOffset(pullOffset) + 'px)';
                    setPagePullOffset(pullOffset, true);
                    setTimeout(function() {
                        refreshCurrentPage().finally(function() {
                            setTimeout(function() {
                                hide();
                                setPagePullOffset(0, true);
                            }, 180);
                        });
                    }, 150);
                } else {
                    hide();
                    setPagePullOffset(0, true);
                }
            }, { passive: true });
        })();

        // ── Patch loaderOverlay show logic to respect PTR suppression ──────────
        // Wrap the native display setter so that when a PTR refresh is in
        // progress, the overlay cannot be made visible by the fetch functions.
    }
    // ─────────────────────────────────────────────────────────────────────
});

function toggleJoinClassForm() {
    const form = document.getElementById("joinClassForm");
    if (form) form.style.display = form.style.display === "none" ? "block" : "none";
}

// --- DYNAMIC UI COMMAND CENTER ---
// Tracks the current page accent colour so the scroll handler can keep
// the browser bar in sync without resetting it to black on every scroll.
window.learnerCurrentPageColor = '#20201f';

window.configureHeader = function(config) {
    let { title, mode, color } = config;

    // ── Mobile colour theming ──────────────────────────────────────────
    // Only applies on mobile. Home has no colour (stays dark surface).
    if (window.innerWidth <= 768) {
        const themeColorMeta = document.querySelector('meta[name="theme-color"]');
        const mainHeader     = document.querySelector('.main-header');

        if (color) {
            window.learnerCurrentPageColor = color;
            if (themeColorMeta) themeColorMeta.setAttribute('content', '#20201f');
            // Header bottom accent + tinted glass background when scrolled
            if (mainHeader)     mainHeader.style.borderBottom = '2px solid ' + color + '55';
            if (mainHeader)     mainHeader.setAttribute('data-page-color', color);
        } else {
            // Home or no colour — reset to dark surface/default
            window.learnerCurrentPageColor = '#20201f';
            if (themeColorMeta) themeColorMeta.setAttribute('content', '#20201f');
            if (mainHeader)     mainHeader.style.borderBottom = '';
            if (mainHeader)     mainHeader.removeAttribute('data-page-color');
        }
    }
    // ──────────────────────────────────────────────────────────────────
    
    // Select our UI elements
    const mainHeader = document.querySelector('.main-header');
    const mainContent = document.querySelector('#api-content-area') || document.querySelector('.main-content');
    const mobileBottomNav = document.getElementById('mobileBottomNav');
    const titleEl = document.getElementById('headerTitle');
    const logoEl = document.getElementById('headerLogo');
    const mobileBtn = document.getElementById('mobileToggle');
    const desktopBtn = document.getElementById('desktopMenuToggle');
    const backBtn = document.getElementById('headerBackBtn');
    const backLabelEl = document.getElementById('headerBackLabel');
    const rightSide = document.getElementById('headerRight');

    // Handle School Name Logic
    const schoolName = "<?= htmlspecialchars($schoolName) ?>"; 
   // Update this to include the folder path if that's what you're saving
if (!title || title === 'Home' || title === 'partials/manual.html' || title === 'learner_manual.php') {
    title = schoolName;
}
    if (titleEl) titleEl.innerText = title;

    if (mode === 'detail') {
    window.learnerHeaderDetailType = config.detailType || title;
    // Detail pages may define a specific return destination. Keeping this on
    // the header state avoids inferring navigation from a title that can be
    // hidden or replaced on mobile while the page scrolls.
    window.learnerHeaderBackAction = typeof config.backAction === 'function'
        ? config.backAction
        : null;
    const backLabel = config.backLabel || window.learnerHeaderCurrentTitle || '';
    if (backLabelEl) backLabelEl.innerText = backLabel;
    if (mainHeader && window.innerWidth <= 768) {
        mainHeader.classList.add('mobile-detail-mode');
        if (mainContent && mainContent.scrollTop > 28) {
            mainHeader.classList.add('detail-title-collapsed');
        } else {
            mainHeader.classList.remove('detail-title-collapsed');
        }
    }
    if (mobileBottomNav) mobileBottomNav.style.setProperty('display', 'none', 'important'); 
    if (mobileBtn) mobileBtn.style.display = 'none';             
    if (desktopBtn) desktopBtn.style.display = 'none';
    if (backBtn) backBtn.style.display = 'flex';

    if (window.innerWidth <= 768) {
        // MOBILE: Body title stays large at top; header title fades in on scroll.
        if (logoEl) logoEl.style.display = 'none';
        if (titleEl) titleEl.style.display = 'block';  // ← SHOW TEXT
        if (rightSide) rightSide.style.visibility = 'hidden';
    } else {
        // DESKTOP: Immersive — hide both logo and right side
        if (logoEl) logoEl.style.display = 'none';
        if (rightSide) rightSide.style.visibility = 'hidden'; 
    }
} else {
        window.learnerHeaderDetailType = null;
        window.learnerHeaderBackAction = null;
        window.learnerHeaderCurrentTitle = title;
        if (backLabelEl) backLabelEl.innerText = '';
        if (mainHeader) mainHeader.classList.remove('mobile-detail-mode', 'detail-title-collapsed');
        // --- STANDARD MODE: EXPLORATION ---
        // On mobile, this will show the nav. On desktop, your CSS still keeps it hidden.
        if (mobileBottomNav) {
            if (window.innerWidth <= 768) {
                mobileBottomNav.style.display = 'flex';
            } else {
                mobileBottomNav.style.display = 'none';
            }
        }
        
        if (backBtn) backBtn.style.display = 'none';
        if (logoEl) logoEl.style.display = (logoEl.tagName === 'IMG') ? 'block' : 'flex';
if (window.innerWidth <= 768 && titleEl) titleEl.style.display = 'none'; // ← HIDE TEXT on mobile in standard mode
        if (rightSide) rightSide.style.visibility = 'visible';

        // Decide which menu button to show based on screen size
        if (window.innerWidth <= 768) {
            if (mobileBtn) mobileBtn.style.display = 'block';
            if (desktopBtn) desktopBtn.style.display = 'none';
        } else {
            if (mobileBtn) mobileBtn.style.display = 'none';
            if (desktopBtn) desktopBtn.style.display = 'block';
        }
    }

    // Tell the mobile scroll layer which view is about to show, so the header
    // and browser-bar state computed just below already reflects where that
    // view will be scrolled to. Without the recalc, the browser bar sat on the
    // flat #20201f set at the top of this function until a later scroll event.
    if (typeof window.learnerBeginViewTransition === 'function') {
        const pageKey   = sessionStorage.getItem('lastLearnerPage') || 'partials/manual.html';
        const detailKey = window.learnerHeaderDetailType ? String(window.learnerHeaderDetailType) : 'list';
        window.learnerBeginViewTransition(pageKey + ':' + detailKey);
    }
    if (typeof window.recalcMobileScrollUI === 'function') {
        window.recalcMobileScrollUI();
    }
};

// --- BACK BUTTON NAVIGATION LOGIC ---
window.returnToLearnerHome = function() {
    const apiArea = document.getElementById('api-content-area');
    const iframe = document.getElementById('mainFrame');
    const myClassContent = document.getElementById('myClassContent');
    const sidebar = document.querySelector('.sidebar');
    const mobileOverlay = document.getElementById('mobileOverlay');

    if (sidebar) sidebar.classList.remove('active', 'desktop-open');
    if (mobileOverlay) mobileOverlay.style.display = 'none';
    if (apiArea) apiArea.style.display = 'block';
    if (iframe) iframe.style.display = 'none';
    if (myClassContent) myClassContent.classList.remove('active');

    if (typeof window.loadManual === 'function') {
        window.loadManual();
        return;
    }

    // Keep the existing iframe fallback available if the Home script failed
    // to load, rather than leaving the learner stranded on a detail page.
    if (iframe) {
        iframe.style.display = 'block';
        iframe.src = 'partials/manual.html';
    }
    window.configureHeader?.({ title: 'Home', mode: 'standard' });
    window.setActive?.('partials/manual.html');
};

window.handleHeaderBack = function(event) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }

    const iframe = document.getElementById('mainFrame');
    const titleEl = document.getElementById('headerTitle');
    const currentTitle = titleEl ? titleEl.innerText : '';
    const detailType = window.learnerHeaderDetailType || currentTitle;

    // Calendar and other API detail views can declare their exact return
    // action. Execute it before inspecting an iframe, which may still hold a
    // hidden page from an earlier visit.
    const backAction = window.learnerHeaderBackAction;
    if (typeof backAction === 'function') {
        backAction();
        return false;
    }

    // 1. QUIZ PROTECTION: Only a visible iframe can be the current quiz.
    // A hidden iframe can retain confirmExit() after a previous quiz and was
    // preventing unrelated pages, including Calendar, from going back.
    const iframeIsVisible = iframe && getComputedStyle(iframe).display !== 'none';
    if (iframeIsVisible && iframe.contentWindow && typeof iframe.contentWindow.confirmExit === 'function') {
        iframe.contentWindow.confirmExit();
        return false;
    }

    // 2. ASSIGNMENTS: If coming back from Submission detail
    if (currentTitle === 'Submission') {
        if (typeof fetchAssignments === 'function') {
            window.fetchAssignments(); // Triggers API fetch and switches UI to 'standard'
            return;
        }
    }

    // 3. QUIZZES: If coming back from Instructions
    if (currentTitle === 'Instructions') {
        if (typeof fetchQuizzes === 'function') {
            window.fetchQuizzes(); 
            return;
        }
    } 

    // 4. DISCUSSIONS: If coming back from a discussion thread
if (detailType === 'Discussion') {
    if (typeof fetchDiscussions === 'function') {
        window.fetchDiscussions();
        return;
    }
}

if (detailType === 'Announcement') {
    if (typeof fetchAnnouncements === 'function') {
        window.fetchAnnouncements();
        return;
    }
}

if (detailType === 'Evaluation') {
    if (typeof fetchEvaluations === 'function') {
        window.fetchEvaluations();
        return;
    }
}

// The visible header title can be replaced or hidden while a mobile detail
// page scrolls. The detail type is the stable source of truth for Calendar.
if (detailType === 'Calendar') {
    window.returnToLearnerHome();
    return false;
}

if (currentTitle === 'Review') {
    if (typeof fetchGrades === 'function') {
        window.fetchGrades();
        return;
    }
}

if (currentTitle === 'Personal Information') {
    if (typeof loadLearnerSettings === 'function') {
        window.loadLearnerSettings();
        return;
    }
}

    // 4. GENERAL FALLBACK: Return to Home/Manual
    window.returnToLearnerHome();
    return false;
};

// --- IFRAME MONITOR (The "Safety Net") ---
const mainFrame = document.getElementById('mainFrame');

if (mainFrame) {
    mainFrame.onload = function() {
        try {
            const path = mainFrame.contentWindow.location.pathname;
            const page = path.split("/").pop();

            if (page === 'learner_manual.php' || page === 'manual.html' || 
                page === '' || page === 'index.php') {
                window.configureHeader({ title: 'Home', mode: 'standard' });
            }
            
            // END ADD ↑
            else if (page === 'quiz_instructions.php' || page === 'take_quiz.php' || 
                     page === 'submit_assignment.php') {
                if (page === 'take_quiz.php') {
                    window.configureHeader({ mode: 'detail' }); 
                    return; 
                }
                let detailTitle = 'Details';
                if (page.includes('quiz')) detailTitle = 'Instructions';
                if (page.includes('assignment')) detailTitle = 'Submission';
                window.configureHeader({ title: detailTitle, mode: 'detail' });
            }
        } catch (e) {
            console.error("Iframe navigation error (Cross-Origin):", e);
        }
    };
}
window.loadHome = function() {
    // 1. Reset Visibility
    const apiArea = document.getElementById('api-content-area');
    const iframe = document.getElementById('mainFrame');
    
    // Switch visibility to the API Area
    if (apiArea) apiArea.style.display = 'block';
    if (iframe) {
        iframe.style.display = 'none';
        iframe.src = 'about:blank'; 
    }
      

    if (typeof window.setActive === 'function') {
        window.setActive("partials/manual.html");
    }
    // 2. Reset Header & Show Bottom Nav
    window.configureHeader({ title: 'Home', mode: 'standard' });

};

// ─────────────────────────────────────────────
// REUSABLE LEARNER PAGE STATE HELPER
// Mirrors the pattern from grades.js.
// Each page calls learnerPageState.get/set with its own key.
// ─────────────────────────────────────────────
window.learnerPageState = {
    prefix: 'learnerPageState:',
    get(key) {
        try {
            const raw = sessionStorage.getItem(this.prefix + key) || sessionStorage.getItem(key);
            const parsed = raw ? JSON.parse(raw) : {};
            return parsed && typeof parsed === 'object' ? parsed : {};
        } catch (e) { return {}; }
    },
    set(key, value) {
        try {
            sessionStorage.setItem(this.prefix + key, JSON.stringify(value || {}));
        } catch (e) { /* storage full — ignore */ }
    },
    update(key, patch) {
        this.set(key, Object.assign({}, this.get(key), patch || {}));
    },
    clear(key) {
        try {
            sessionStorage.removeItem(this.prefix + key);
            sessionStorage.removeItem(key);
        } catch (e) {}
    }
};
</script>

<div id="desktopBackdrop" class="desktop-backdrop"></div>
<div id="mobileOverlay" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.4); z-index:1500;"></div>

<nav id="mobileBottomNav">

      <a href="javascript:void(0)" onclick="return handleLearnerMobileBottomNav(event, loadManual)" data-page="partials/manual.html" id="nav-home">
        <div class="lh-nav-box" style="width:28px;height:28px;border-radius:8px;background:#4fd1c518;border:1px solid #4fd1c530;display:flex;align-items:center;justify-content:center;margin-bottom:3px;transition:background 0.2s;">
          <svg viewBox="0 0 24 24" fill="none" stroke="#4fd1c5" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:16px;height:16px;">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
            <polyline points="9 22 9 12 15 12 15 22"/>
          </svg>
        </div>
        Home
      </a>

    <a href="javascript:void(0)" onclick="return handleLearnerMobileBottomNav(event, fetchQuizzes)" data-page="quiz_list.php" id="nav-quiz">
        <div class="lh-nav-box" style="width:28px;height:28px;border-radius:8px;background:#fdd66318;border:1px solid #fdd66330;display:flex;align-items:center;justify-content:center;margin-bottom:3px;transition:background 0.2s;">
          <svg viewBox="0 0 24 24" fill="none" stroke="#fdd663" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:16px;height:16px;">
            <path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
          </svg>
        </div>
        Quiz
    </a>

    <a href="javascript:void(0)" onclick="return handleLearnerMobileBottomNav(event, fetchAssignments)" data-page="assignment_list.php" id="nav-assignments">
        <div class="lh-nav-box" style="width:28px;height:28px;border-radius:8px;background:#a78bfa18;border:1px solid #a78bfa30;display:flex;align-items:center;justify-content:center;margin-bottom:3px;transition:background 0.2s;">
          <svg viewBox="0 0 24 24" fill="none" stroke="#a78bfa" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:16px;height:16px;">
            <path d="M9 12h6"/><path d="M9 16h6"/><rect x="4" y="4" width="16" height="16" rx="2"/>
          </svg>
        </div>
        Assignments
    </a>

    <a href="javascript:void(0)" onclick="return handleLearnerMobileBottomNav(event, fetchResources)" data-page="resource_list.php" id="nav-resources">
        <div class="lh-nav-box" style="width:28px;height:28px;border-radius:8px;background:#f28c3818;border:1px solid #f28c3830;display:flex;align-items:center;justify-content:center;margin-bottom:3px;transition:background 0.2s;">
          <svg viewBox="0 0 24 24" fill="none" stroke="#f28c38" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:16px;height:16px;">
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
          </svg>
        </div>
        Resources
    </a>

</nav>

<script>
/**
 * 1. CORE UTILITIES
 * These must be at the top of the script
 */
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
    let learnerUpdateReloading = false;
    const learnerHadServiceWorkerController = Boolean(navigator.serviceWorker.controller);
    navigator.serviceWorker.addEventListener('message', event => {
        if (event.data?.type !== 'iskool-update-available') return;
        if (window.confirm('An iSkool update is available. Refresh now?')) {
            navigator.serviceWorker.getRegistration('/').then(registration => {
                registration?.waiting?.postMessage({ type: 'iskool-skip-waiting' });
            });
        }
    });
    navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!learnerHadServiceWorkerController || learnerUpdateReloading) return;
        learnerUpdateReloading = true;
        window.location.reload();
    });
    window.addEventListener('online', () => {
        navigator.serviceWorker.controller?.postMessage({ type: 'iskool-replay-queued-writes' });
    });
}

// Saves the browser subscription before any teacher sends a notification.
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

    const prompt = document.getElementById('pushPromptContainer');
    if (prompt) prompt.style.display = 'none';
    return data;
}

/**
 * 2. IPHONE BUTTON ACTION
 * This is what runs when you tap your orange button
 */
async function requestIphonePush() {
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
    } catch (err) {
        console.error('Push subscription failed:', err);
        alert('Could not enable notifications. Please try Sync Notifications again.');
    }
}

/**
 * 3. AUTOMATIC CHECK ON LOAD
 * Checks if the user is already subscribed when they open the dashboard
 */
document.addEventListener("DOMContentLoaded", function () {
    console.log('Push script initialized');

    if ('serviceWorker' in navigator && 'PushManager' in window) {
        registerPushServiceWorker()
            .then(registration => registration.pushManager.getSubscription())
            .then(existingSub => {
                if (existingSub) return sendToCatcher(existingSub);
            })
            .catch(err => console.error('Push subscription sync failed:', err));
    }


    // --- Keep your existing Sidebar/Loader code below this line ---
    const loader = document.getElementById("loaderOverlay");
    const iframe = document.querySelector('iframe[name="mainFrame"]');
   
});


</script>

<script src="assets/js/learner/main.js?v=1.2"></script>
<script src="assets/js/learner/manual.js?v=11.0"></script>
<script src="assets/js/learner/quiz.js?v=11.8"></script>
<script src="assets/js/learner/assignments.js?v=9.9"></script>
<script src="assets/js/learner/resources.js?v=8.5"></script>
<script src="assets/js/learner/announcements.js?v=9.1"></script>
<script src="assets/js/learner/grades.js?v=9.8"></script>
<script src="assets/js/learner/evaluations.js?v=6.9"></script>
<script src="assets/js/learner/discussions.js?v=11.2"></script>
<script src="assets/js/learner/syllabus.js?v=3.6"></script>
<script src="assets/js/learner/learner_calendar.js?v=2.3"></script>
<?php include 'includes/global_viewer.php'; ?>
</body>
</html>