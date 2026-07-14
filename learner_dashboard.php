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
 * @link        https://iskool.online
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
//           Get learner school name
//──────────────────────────────────────────────────────────────────
$schoolName = 'My School'; // fallback only
$result = $conn->query("SELECT setting_value FROM school_name WHERE setting_key = 'school_name' LIMIT 1");
if ($row = $result->fetch_assoc()) {
    $schoolName = $row['setting_value'];
}
$schoolLogo = 'uploads/schools/default_school.png?v=1.1';

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
    <title>Dashboard - iSkool</title>
    <link rel="icon" type="image/svg+xml" href="/icon.svg?v=1.4">
    <link rel="stylesheet" href="assets/css/learner/quiz.css?v=4.7">
    <link rel="stylesheet" href="assets/css/learner/manual.css?v=3.0">
    <meta name="theme-color" content="#20201f">
    <meta name="mobile-web-app-capable" content="yes">
    <meta name="application-name" content="iSkool">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-status-bar-style" content="black">
    <meta name="msapplication-navbutton-color" content="#20201f">
    <link rel="manifest" href="/manifest.php">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.2/css/all.min.css" integrity="sha512-z3gLpd7yknf1YoNbCzqRKc4qyor8gaKU1qmn+CShxbuBusANI9QpRohGBreCFkKxLhei6S9CQXFEbbKuqLg0DA==" crossorigin="anonymous" referrerpolicy="no-referrer" />
    <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@600&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="assets/css/learner/learner_dashboard.css?v=4.8">
<script>
function getCsrfToken() {
    const meta = document.querySelector('meta[name="csrf-token"]');
    return meta ? meta.getAttribute('content') : '';
}
</script></head>
<body>
<?php $currentPage = basename($_SERVER['PHP_SELF']); ?>

<div class="sidebar">
    
    <div class="sidebar-header" style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 15px;">
        
        <div class="profile-picture-wrapper" style="position:relative; display:inline-block; cursor:pointer;" onclick="if(typeof loadLearnerSettings === 'function') loadLearnerSettings(); const _sb = document.querySelector('.sidebar'); if(_sb){ _sb.classList.remove('active','desktop-open'); const _ov = document.getElementById('mobileOverlay'); if(_ov) _ov.style.display='none'; }">
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
      <a href="javascript:void(0)" class="desktop-only" onclick="loadManual();" id="nav-home-sidebar">
           <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:20px; height:20px; margin-right:10px;">
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
    <polyline points="9 22 9 12 15 12 15 22"/>
</svg><span>Home</span>
        </a>

        <a href="javascript:void(0)" onclick="fetchQuizzes(); updateHeaderTitle('Quizzes')" class="desktop-only" id="nav-quiz-sidebar">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg><span>Quiz</span>
        </a>

        <a href="javascript:void(0)" onclick="fetchAssignments(); updateHeaderTitle('Assignments')" class="desktop-only" id="nav-assignments-sidebar">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 12h6"/><path d="M9 16h6"/><rect x="4" y="4" width="16" height="16" rx="2"/></svg><span>Assignments</span>
        </a>

       <a href="javascript:void(0)" onclick="fetchResources(); updateHeaderTitle('Resources')" class="desktop-only" id="nav-resources-sidebar">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg><span>Resources</span>
        </a>

        <a href="javascript:void(0)"
   onclick="fetchGrades(); updateHeaderTitle('My Grades')"
   data-page="grades" id="nav-grades-sidebar">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
         stroke-linecap="round" stroke-linejoin="round">
        <line x1="18" y1="20" x2="18" y2="10"/>
        <line x1="12" y1="20" x2="12" y2="4"/>
        <line x1="6"  y1="20" x2="6"  y2="14"/>
    </svg>
    <span>Grades</span>
</a>

        <a href="javascript:void(0)" onclick="fetchAnnouncements(); updateHeaderTitle('Announcements')" id="nav-announcements-sidebar">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg><span>Announcements</span>
        </a>

        <a href="javascript:void(0)" onclick="fetchEvaluations(); updateHeaderTitle('Evaluations')" id="nav-evaluations-sidebar">
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
        <a href="javascript:void(0)" onclick="fetchDiscussions(); updateHeaderTitle('Discussions')" id="nav-discussions-sidebar">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg><span>Discussions</span>
        </a>

        <a href="javascript:void(0)" onclick="fetchLearnerCalendar()" data-page="learner_calendar" class="mobile-only-calendar" id="nav-calendar-sidebar">
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

        <button id="headerBackBtn" style="display: none; background: none; border: none; color: inherit; cursor: pointer; padding: 5px;" onclick="handleHeaderBack()">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <line x1="19" y1="12" x2="5" y2="12"></line>
                <polyline points="12 19 5 12 12 5"></polyline>
            </svg>
            <span id="headerBackLabel"></span>
        </button>
    </div>

    <div class="logo-container" style="flex: 2; display: flex; justify-content: center; align-items: center; gap: 10px;">
        <img id="headerLogo" src="<?= htmlspecialchars($schoolLogo) ?>" 
             alt="School Logo" 
             style="width:40px; height:40px; border-radius:8px; object-fit:cover; border:0.5px solid rgba(255,255,255,0.2);">
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
        <h3>My Class</h3>
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
            while ($c = $res->fetch_assoc()): ?>
                <p style="font-size:18px;color:#4fd1c5;font-weight:bold;"><?= htmlspecialchars($c['name']) ?></p>
            <?php endwhile; ?>
            <?php $resStmt->close(); ?>

            <hr>
            <div class="parent-link-section">
                <button type="button" class="toggle-parent-link" onclick="toggleParentDropdown()">
                    <?= $parentLink ? 'Linked to Parent' : 'Link My Parent' ?>
                </button>
                <div class="parent-dropdown" id="parentDropdown" style="display:none;">
                    <?php if (!empty($parentsInClass)): ?>
                        <form id="parentLinkForm">
                            <select name="parent_email" required>
                                <option value="">-- Select Parent --</option>
                                <?php foreach ($parentsInClass as $p): ?>
                                    <option value="<?= $p['email'] ?>" <?= ($p['email']===$parentLink?'selected':'') ?>>
                                        <?= htmlspecialchars($p['name']) ?>
                                    </option>
                                <?php endforeach; ?>
                            </select>
                            <button type="submit" class="join-class-btn">Save</button>
                        </form>
                    <?php else: ?>
                        <p>No parents in class yet.</p>
                    <?php endif; ?>
                </div>
            </div>
        <?php else: ?>
            <p>Not joined any class yet.</p>
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
window.prepareLearnerMobileNavigation = function() {
    if (window.innerWidth > 768) return;

    const apiArea = document.getElementById('api-content-area');
    const mainContent = document.querySelector('.main-content');
    const mainHeader = document.querySelector('.main-header');
    const bottomNav = document.getElementById('mobileBottomNav');
    const themeColorMeta = document.querySelector('meta[name="theme-color"]');

    [apiArea, mainContent].forEach(el => {
        if (!el) return;
        el.style.scrollBehavior = 'auto';
        el.scrollTop = 0;
    });

    if (apiArea) {
        apiArea.style.webkitOverflowScrolling = 'auto';
        apiArea.style.overflowY = 'hidden';
        void apiArea.offsetHeight;
        apiArea.scrollTop = 0;

        requestAnimationFrame(() => {
            apiArea.style.overflowY = 'auto';
            apiArea.style.webkitOverflowScrolling = 'touch';
            apiArea.scrollTop = 0;
            apiArea.dispatchEvent(new Event('scroll'));
        });
    }

    if (mainHeader) {
        mainHeader.classList.remove('header-scrolled', 'detail-title-collapsed');
        mainHeader.style.background = '';
    }

    if (bottomNav) {
        bottomNav.style.setProperty('display', 'flex');
        bottomNav.classList.add('nav-scrolled');
    }

    if (themeColorMeta) themeColorMeta.setAttribute('content', '#20201f');
};

window.handleLearnerMobileBottomNav = function(event, loaderFn) {
    if (event) event.preventDefault();
    window.prepareLearnerMobileNavigation();

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
    // We check sessionStorage for "lastLearnerPage" to see if this is a fresh start
    if (isMobile && !sessionStorage.getItem("lastLearnerPage")) {
        const mainContent = document.querySelector(".main-content");
        mainContent.classList.add("mobile-first-load");

        // Ensure the bottom navigation shows its glass background on first open
        const bottomNav = document.getElementById('mobileBottomNav');
        if (bottomNav) bottomNav.classList.add('nav-scrolled');

        setTimeout(() => {
            mainContent.classList.remove("mobile-first-load");
            mainContent.style.transform = '';
        }, 1000);
    }

    // ────────────────────────────────────────────────────────────────────────
    // 1. SMART LOAD LOGIC (Deep Linking + Refresh Persistence)
    // ────────────────────────────────────────────────────────────────────────
    const urlParams = new URLSearchParams(window.location.search);
    const targetPage = urlParams.get('page'); // From Push Notifications
    // UPDATE THIS LINE: Change localStorage to sessionStorage
    const savedPage = sessionStorage.getItem("lastLearnerPage");

 if (targetPage) {
    window.history.replaceState({}, document.title, window.location.pathname);

    if (targetPage === 'discussion') {
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
        // 2. Priority: API-Driven Pages (Special Logic)
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
        } 

        // THE FIX FOR REFRESH:
        if (savedPage === "partials/manual.html" || savedPage === "learner_manual.php") {
            if (apiArea) apiArea.style.display = "block"; // SHOW THIS
            if (iframe) iframe.style.display = "none";    // HIDE THIS
            if (typeof loadManual === "function") {
                loadManual();
            }
        }
      // 2. YOUR CASE: If it's NOT an API page AND NOT the manual, 
        // load the specific saved page into the iframe (like profile.php)
        else if (
    savedPage !== "learner_manual.php" && 
    savedPage !== "quiz_list.php" && 
    savedPage !== "assignment_list.php" && 
    savedPage !== "resource_list.php" && 
    savedPage !== "discussion_list.php" &&
    savedPage !== "evaluation_list.php" &&
    savedPage !== "syllabus" &&
    savedPage !== "grades" &&
    savedPage !== "learner_calendar" &&
    savedPage !== "announcement_list.php"
) {
    iframe.style.display = 'block';   // ← ADD THIS
    if (apiArea) apiArea.style.display = 'none'; // ← ADD THIS
    iframe.src = savedPage;
}
       // 3. If it IS the manual, trigger the function to load from /partials
        else {
            if (typeof loadManual === "function") {
                loadManual();
            } else {
                // Emergency Fallback
                iframe.style.display = "block";
                iframe.src = "learner_manual.php";
            }
        }
    } else {
        // FRESH START: No saved page at all (Trigger the new Manual logic)
        if (typeof loadManual === "function") {
            loadManual();
        } else {
            // Emergency Fallback
            iframe.style.display = "block";
            iframe.src = "learner_manual.php";
        }
    }

   // ────────────────────────────────────────────────────────────────────────
    // 2. LOADER & MOBILE AUTO-CLOSE (Teacher-style navigation)
    // ────────────────────────────────────────────────────────────────────────
    
    document.querySelectorAll('#mobileBottomNav a').forEach(link => {
        link.addEventListener('touchstart', () => {
            window.prepareLearnerMobileNavigation();
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
                          onClick.includes('fetchAnnouncements');

        // Inside your Main Script's link click listener:
const isCached = (onClick.includes('loadManual') && window.manualCache) ||
                 (onClick.includes('fetchQuizzes') && (window.learnerQuizCache || window.learnerQuizPrefetchPromise)) ||
                 (onClick.includes('fetchAssignments') && (window.learnerAssignmentCache || window.learnerAssignmentPrefetchPromise)) ||
                 (onClick.includes('fetchAnnouncements') && (window.announcementCache || window.announcementPrefetchPromise)) ||
                 (onClick.includes('fetchResources') && (window.resourceCache || window.resourcePrefetchPromise)) ||
                 (onClick.includes('fetchEvaluations') && (window.evaluationCache || window.evaluationPrefetchPromise)) ||
                 (onClick.includes('fetchGrades') && window.learnerGradesCache) ||
                 (onClick.includes('fetchSyllabus') && (window.syllabusCache || window.syllabusPrefetchPromise)) ||
                 onClick.includes('fetchLearnerCalendar') ||
                 (onClick.includes('fetchDiscussions') && (window.discussionCache || window.discussionPrefetchPromise)); // <-- ADD THIS

        // 1. AUTO-CLOSE MENU
        if (sidebar.classList.contains("active") || sidebar.classList.contains("desktop-open")) {
            sidebar.classList.remove("active");
            sidebar.classList.remove("desktop-open");
            if (window.innerWidth <= 768 && mobileOverlay) {
                mobileOverlay.style.display = "none";
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
                    background:#1b1b1b;border:1px solid rgba(255,255,255,0.06);
                    border-radius:14px;padding:16px;cursor:pointer;
                    transition:background 0.2s ease;margin-bottom:28px;"
             onmouseover="this.style.background='#21262d'"
             onmouseout="this.style.background='#1b1b1b'">
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
        <div style="background:#1b1b1b;border:1px solid rgba(255,255,255,0.06);
                    border-radius:14px;overflow:hidden;margin-bottom:28px;">
            <div onclick="document.getElementById('profileInput').click()"
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
                <svg viewBox="0 0 24 24" width="15" height="15" stroke="#8b949e" stroke-width="2" fill="none" style="flex-shrink:0;">
                    <polyline points="9 18 15 12 9 6"></polyline>
                </svg>
            </div>
            <div style="height:1px;background:rgba(255,255,255,0.06);margin-left:64px;"></div>
            <div onclick="removeLearnerProfilePicture()"
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
                <svg viewBox="0 0 24 24" width="15" height="15" stroke="#8b949e" stroke-width="2" fill="none" style="flex-shrink:0;">
                    <polyline points="9 18 15 12 9 6"></polyline>
                </svg>
            </div>
        </div>`;

    const notificationsHTML = `
        <!-- SECTION: NOTIFICATIONS -->
        <div style="font-size:12px;font-weight:600;color:#8b949e;text-transform:uppercase;
                    letter-spacing:0.08em;padding:0 4px;margin-bottom:8px;">Notifications</div>
        <div style="background:#1b1b1b;border:1px solid rgba(255,255,255,0.06);
                    border-radius:14px;overflow:hidden;margin-bottom:28px;">
            <div style="padding:14px 16px;">
                <div style="display:flex;align-items:center;gap:12px;margin-bottom:10px;">
                    <div style="width:36px;height:36px;border-radius:9px;background:rgba(79,209,197,0.12);
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
                 onmouseover="this.style.background='#21262d'"
                 onmouseout="this.style.background='transparent'">
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
                <svg viewBox="0 0 24 24" width="15" height="15" stroke="#8b949e" stroke-width="2" fill="none" style="flex-shrink:0;">
                    <polyline points="9 18 15 12 9 6"></polyline>
                </svg>
            </div>
        </div>`;

    const accountHTML = `
        <!-- SECTION: ACCOUNT -->
        <div style="font-size:12px;font-weight:600;color:#8b949e;text-transform:uppercase;
                    letter-spacing:0.08em;padding:0 4px;margin-bottom:8px;">Account</div>
        <div style="background:#1b1b1b;border:1px solid rgba(255,255,255,0.06);
                    border-radius:14px;overflow:hidden;">
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

    // If forceClose is true (from the X button) or it's already open, close it
    if (forceClose || isCurrentlyOpen) {
        sidebar.classList.remove("active");
        sidebar.classList.remove("desktop-open"); 
        if (mobileOverlay) {
            mobileOverlay.style.display = "none";
        }
    } else {
        // Only allow open on mobile
        if (window.innerWidth <= 768) {
            sidebar.classList.add("active");
            mobileOverlay.style.display = "block";
        }
        // Desktop open is handled by desktopToggle listener — do nothing here
    }
};



    window.showMyClass = function () {
        myClassContent.classList.add("active");
        iframe.style.display = "none";
        setActive("my-class");
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

    // ── SIDEBAR MOBILE: wrap each SVG in a coloured box ──────────────────
    // Only runs on mobile. Maps each nav link to its colour, wraps the
    // existing SVG in a .sidebar-nav-box div. Desktop sidebar untouched.
    if (window.innerWidth <= 768) {
        const sidebarNavConfig = [
            { selector: '#nav-home-sidebar',          color: '#4fd1c5' },
            { selector: '#nav-quiz-sidebar',          color: '#fdd663' },
            { selector: '#nav-assignments-sidebar',   color: '#a78bfa' },
            { selector: '#nav-resources-sidebar',     color: '#f28c38' },
            { selector: '#nav-grades-sidebar',        color: '#68d391' },
            { selector: '#nav-announcements-sidebar', color: '#f28c38' },
            { selector: '#nav-evaluations-sidebar',   color: '#fc8181' },
            { selector: '#nav-syllabus-sidebar',      color: '#63b3ed' },
            { selector: '#nav-discussions-sidebar',   color: '#f85149' },
            { selector: '#nav-calendar-sidebar',      color: '#f472b6' },
            { selector: '#nav-joinclass-sidebar',     color: '#48bb78' },
            { selector: '#nav-myclass-sidebar',       color: '#63b3ed' },
        ];
        sidebarNavConfig.forEach(({ selector, color }) => {
            const el  = document.querySelector(selector);
            if (!el) return;
            const svg = el.querySelector('svg');
            if (!svg) return;
            // Colour the SVG stroke
            svg.style.stroke = color;
            // Wrap in a box
            const box = document.createElement('div');
            box.className = 'sidebar-nav-box';
            box.style.background = color + '18';
            box.style.border     = '1px solid ' + color + '30';
            svg.parentNode.insertBefore(box, svg);
            box.appendChild(svg);
        });
    }
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

        if (apiArea && mainHeader) {
            apiArea.addEventListener('scroll', function () {
                const scrollTop    = apiArea.scrollTop;
                const scrollHeight = apiArea.scrollHeight;
                const clientHeight = apiArea.clientHeight;
                const distFromBottom = scrollHeight - scrollTop - clientHeight;

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
            }, { passive: true });
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
            // Replicates the native iOS pull-to-refresh indicator:
            // a 32px grey spinner made of 12 radial lines (like a clock face),
            // sitting in a white pill/circle, centered just below the header.
            const ptr = document.createElement('div');
            ptr.id = 'ptrIndicator';

            // Build 12 radial lines (starburst) as inline SVG — grey, like Image 1
            ptr.innerHTML = '<svg id="ptrSpinSvg" width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">'
                + (function() {
                    var lines = '';
                    for (var i = 0; i < 12; i++) {
                        var angle  = i * 30;
                        var opacity = (0.2 + (i / 12) * 0.8).toFixed(2);
                        // Each line: short inner segment to outer edge from center
                        var rad    = (angle - 90) * Math.PI / 180;
                        var x1     = (16 + Math.cos(rad) * 7).toFixed(2);
                        var y1     = (16 + Math.sin(rad) * 7).toFixed(2);
                        var x2     = (16 + Math.cos(rad) * 13).toFixed(2);
                        var y2     = (16 + Math.sin(rad) * 13).toFixed(2);
                        lines += '<line x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2
                               + '" stroke="rgba(120,120,128,' + opacity + ')" stroke-width="2.6" stroke-linecap="round"/>';
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
            let startY = 0, pulling = false, triggered = false;

            function startSpin() {
                svgEl.style.animation = 'ptrSpin 0.75s linear infinite';
            }
            function hide() {
                ptr.style.opacity   = '0';
                ptr.style.transform = 'translateX(-50%) translateY(-80px)';
                svgEl.style.animation = 'none';
            }

            // ── Cache bust + re-fetch — loaderOverlay suppressed during PTR ──────
            function refreshCurrentPage() {
                const page = sessionStorage.getItem('lastLearnerPage') || 'home';
                if (page === 'quiz_list.php')         window.learnerQuizCache          = null;
                if (page === 'assignment_list.php')   window.learnerAssignmentCache    = null;
                if (page === 'announcement_list.php') window.announcementCache         = null;
                if (page === 'grades')                window.learnerGradesCache        = null;
                if (page === 'resources')             window.learnerResourcesCache     = null;
                if (page === 'manual')                window.learnerManualCache        = null;

                // Suppress the loaderOverlay so only the PTR spinner is visible
                window._ptrRefreshing = true;
                clearTimeout(window.loaderTimeout);
                loader.style.display = 'none';

                const fnMap = {
                    'quiz_list.php':         window.fetchQuizzes,
                    'assignment_list.php':   window.fetchAssignments,
                    'announcement_list.php': window.fetchAnnouncements,
                    'grades':                window.fetchGrades,
                    'resources':             window.fetchResources,
                    'manual':                window.fetchManual,
                };
                const fn = fnMap[page];
                if (typeof fn === 'function') fn();
                else if (typeof window.loadLearnerHome === 'function') window.loadLearnerHome();

                // Re-enable loaderOverlay after the fetch cycle completes
                setTimeout(function() { window._ptrRefreshing = false; }, 1200);
            }

            // ── Touch handlers ──────────────────────────────────────────────────
            scrollEl.addEventListener('touchstart', function(e) {
                if (scrollEl.scrollTop === 0) {
                    startY    = e.touches[0].clientY;
                    pulling   = true;
                    triggered = false;
                }
            }, { passive: true });

            scrollEl.addEventListener('touchmove', function(e) {
                if (!pulling) return;
                const deltaY = e.touches[0].clientY - startY;
                if (deltaY <= 0) { pulling = false; return; }

                const capped     = Math.min(deltaY, THRESHOLD * 1.5);
                const progress   = Math.min(capped / THRESHOLD, 1);
                const translateY = Math.min(capped * 0.4, 28);

                ptr.style.opacity   = String(Math.min(progress * 1.5, 1));
                ptr.style.transform = 'translateX(-50%) translateY(' + translateY + 'px)';

                if (capped >= THRESHOLD && !triggered) {
                    triggered = true;
                    startSpin();
                }
            }, { passive: true });

            scrollEl.addEventListener('touchend', function() {
                if (!pulling) return;
                pulling = false;
                if (triggered) {
                    setTimeout(function() {
                        refreshCurrentPage();
                        setTimeout(hide, 900);
                    }, 150);
                } else {
                    hide();
                }
            }, { passive: true });
        })();

        // ── Patch loaderOverlay show logic to respect PTR suppression ──────────
        // Wrap the native display setter so that when a PTR refresh is in
        // progress, the overlay cannot be made visible by the fetch functions.
        (function patchLoaderForPTR() {
            var origSet = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'style');
            // Lightweight approach: override on the specific element after DOM ready
            var _loaderEl = document.getElementById('loaderOverlay');
            if (!_loaderEl) return;
            var _origDisplayDescriptor = Object.getOwnPropertyDescriptor(
                CSSStyleDeclaration.prototype, 'display'
            );
            // Monkey-patch only this element's style.display
            Object.defineProperty(_loaderEl.style, 'display', {
                get: function() {
                    return _origDisplayDescriptor.get.call(_loaderEl.style);
                },
                set: function(val) {
                    // If a PTR refresh is running, block any attempt to show the overlay
                    if (val === 'flex' && window._ptrRefreshing) return;
                    _origDisplayDescriptor.set.call(_loaderEl.style, val);
                },
                configurable: true,
            });
        }());
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
        if (logoEl) logoEl.style.display = 'block';
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
};

// --- BACK BUTTON NAVIGATION LOGIC ---
window.handleHeaderBack = function() {
    const iframe = document.getElementById('mainFrame');
    const titleEl = document.getElementById('headerTitle');
    const currentTitle = titleEl ? titleEl.innerText : '';
    const detailType = window.learnerHeaderDetailType || currentTitle;

    // 1. QUIZ PROTECTION: If taking a quiz, ask before leaving
    if (iframe && iframe.contentWindow && typeof iframe.contentWindow.confirmExit === 'function') {
        iframe.contentWindow.confirmExit();
        return; 
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
if (currentTitle === 'Discussion') {
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

if (currentTitle === 'Calendar') {
    if (typeof loadManual === 'function') {
        window.loadManual();
        return;
    }
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
    const apiArea = document.getElementById('api-content-area');
    if (apiArea) apiArea.style.display = 'block'; // Show API
    if (iframe) iframe.style.display = 'none';   // Hide Iframe

    if (typeof window.loadManual === 'function') {
        window.loadManual();
    } else {
        if (iframe) {
            iframe.style.display = 'block';
            iframe.src = 'learner_manual.php';
        }
    }
    window.configureHeader({ title: 'Home', mode: 'standard' });
    
    // Update Active UI using the full path
    if (typeof window.setActive === 'function') {
        window.setActive("partials/manual.html");
    }
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

// Global function to send the subscription to your server log
function sendToCatcher(subscription) {
    console.log('Sending subscription to server...');
    fetch('subscribe_push.php', {
        method: 'POST',
        headers: { 'X-CSRF-Token': getCsrfToken() },
        body: JSON.stringify({
            subscription: subscription,
            email: '<?= addslashes($_SESSION['email']) ?>',
            role: '<?= addslashes($_SESSION['role']) ?>'
        }),
        headers: {'Content-Type': 'application/json'}
    })
    .then(res => res.json())
    .then(data => {
        console.log('Server response:', data);
        if(document.getElementById('pushPromptContainer')) {
            document.getElementById('pushPromptContainer').style.display = 'none';
        }
    })
    .catch(err => {
        console.error('Catcher send failed:', err);
        alert('Log Error: ' + err);
    });
}

/**
 * 2. IPHONE BUTTON ACTION
 * This is what runs when you tap your orange button
 */
function requestIphonePush() {
    console.log("Requesting permission...");
    
    if (!('serviceWorker' in navigator)) {
        alert("Error: Service Worker not found.");
        return;
    }

    Notification.requestPermission().then(permission => {
        if (permission === 'granted') {
            navigator.serviceWorker.ready.then(registration => {
                registration.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: urlBase64ToUint8Array('BLl4HnUrajJk2h5w4P9RlQZpiGgBCO7ZKCwVR2D_jcuvbBEDsm9eBMic1CNa-4E_aoTn4FqjhaJmgS7QIyv7C1w')
                })
                .then(subscription => {
                    
                    sendToCatcher(subscription);
                })
                .catch(err => {
                    alert('Subscription Failed: ' + err);
                    console.error(err);
                });
            });
        } else {
            alert('Permission was: ' + permission + ". If denied, you must reset Safari settings.");
        }
    });
}

/**
 * 3. AUTOMATIC CHECK ON LOAD
 * Checks if the user is already subscribed when they open the dashboard
 */
document.addEventListener("DOMContentLoaded", function () {
    console.log('Push script initialized');

    if ('serviceWorker' in navigator && 'PushManager' in window) {
        navigator.serviceWorker.ready.then(registration => {
            registration.pushManager.getSubscription().then(existingSub => {
                if (existingSub) {
                    console.log('Already subscribed, refreshing log...');
                    sendToCatcher(existingSub);
                }
            });
        });
    }


    // --- Keep your existing Sidebar/Loader code below this line ---
    const loader = document.getElementById("loaderOverlay");
    const iframe = document.querySelector('iframe[name="mainFrame"]');
   
});


</script>

<script src="assets/js/learner/main.js?v=1.2"></script>
<script src="assets/js/learner/manual.js?v=3.9"></script>
<script src="assets/js/learner/quiz.js?v=7.6"></script>
<script src="assets/js/learner/assignments.js?v=7.0"></script>
<script src="assets/js/learner/resources.js?v=5.9"></script>
<script src="assets/js/learner/announcements.js?v=6.4"></script>
<script src="assets/js/learner/grades.js?v=4.5"></script>
<script src="assets/js/learner/evaluations.js?v=2.8"></script>
<script src="assets/js/learner/discussions.js?v=7.5"></script>
<script src="assets/js/learner/syllabus.js?v=2.2"></script>
<script src="assets/js/learner/learner_calendar.js?v=1.6"></script>
<?php include 'includes/global_viewer.php'; ?>
</body>
</html>