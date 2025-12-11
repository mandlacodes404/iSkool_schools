<?php
ob_start();
error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);
ini_set('error_log', 'php_errors.log');

session_start();
require_once 'config.php';

// ────── Security: Only logged in + correct role ──────
if (!isset($_SESSION['email']) || $_SESSION['role'] !== 'learner') {
    header("Location: index.php");
    exit();
}

$learnerEmail = $_SESSION['email'];

$schoolName = 'My School'; // fallback only
$result = $conn->query("SELECT setting_value FROM school_name WHERE setting_key = 'school_name' LIMIT 1");
if ($row = $result->fetch_assoc()) {
    $schoolName = $row['setting_value'];
}
$schoolLogo = 'Uploads/schools/default_school.png';

// ────── Get current active academic year (no school_id needed) ──────
$currentYearResult = $conn->query("SELECT id, name FROM academic_years WHERE is_current = 1 LIMIT 1");
if ($currentYearResult->num_rows === 0) {
    $currentYearName = "Current Year";
    $currentYearId   = 0;
} else {
    $year            = $currentYearResult->fetch_assoc();
    $currentYearId   = $year['id'];
    $currentYearName = $year['name'];
}

// ────── Handle class join ──────
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['join_class'])) {
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

// ────── Learner profile info ──────
// Default fallback values
$learnerName           = $_SESSION['name'] ?? '';
$learnerSurname        = '';
$learnerFullName       = trim($learnerName); // fallback to just name if no surname
$learnerProfilePicture = 'default.png';

$stmt = $conn->prepare("SELECT name, surname, profile_picture FROM users WHERE email = ?");
$stmt->bind_param("s", $learnerEmail);
$stmt->execute();
if ($row = $stmt->get_result()->fetch_assoc()) {
    $learnerName           = $row['name'] ?: $learnerName;
    $learnerSurname        = $row['surname'] ?? '';
    $learnerProfilePicture = $row['profile_picture'] ?: 'default.png';
    
    // Combine name + surname
    $learnerFullName = trim($learnerName . ' ' . $learnerSurname);
}
$stmt->close();

// ────── Get all classes available in this school (no school_id needed) ──────
$classesStmt = $conn->prepare("SELECT id, name FROM classes ORDER BY name ASC");
$classesStmt->execute();
$classesResult = $classesStmt->get_result();

$allClasses = [];
while ($row = $classesResult->fetch_assoc()) {
    $allClasses[] = $row;
}
$classesStmt->close();
$classes = $allClasses;

// ────── Get classes the learner has already joined ──────
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

// ────── Parent linking (only if learner is in a class) ──────
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
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Learner Dashboard</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.2/css/all.min.css" integrity="sha512-z3gLpd7yknf1YoNbCzqRKc4qyor8gaKU1qmn+CShxbuBusANI9QpRohGBreCFkKxLhei6S9CQXFEbbKuqLg0DA==" crossorigin="anonymous" referrerpolicy="no-referrer" />
    <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@600&display=swap" rel="stylesheet">
 <style>
:root {
    --bg-color: #0d1117;
    --sidebar-bg: #1a202c;
    --text-color: #e2e8f0;
    --accent-color: #4fd1c5;
    --secondary-accent: #f6877a;
    --card-bg: #1a202c;
    --button-bg: #f7fafc;
    --button-hover-bg: #edf2f7;
    --warning-color: #c0392b;
    --shadow-glow: rgba(79, 209, 197, 0.3);
    --card-radius: 16px;
    --sidebar-width: 240px;
    --sidebar-collapsed-width: 64px;
    --transition-speed: 0.3s;
}

body {
    margin: 0;
    font-family: 'Nunito', sans-serif;
    display: flex;
    height: 100vh;
    background-color: var(--bg-color);
    color: var(--text-color);
    overflow: hidden;
}

.sidebar {
    width: var(--sidebar-width);
    background: #1a1919ff;
    display: flex;
    flex-direction: column;
    padding: 20px;
    box-sizing: border-box;
    transition: width var(--transition-speed) ease, left var(--transition-speed) ease;
    position: fixed;
    top: 0;
    left: 0;
    height: 100vh;
    z-index: 5000;
    overflow-y: auto;
    box-shadow: 2px 0 8px rgba(0, 0, 0, 0.2);
    font-weight: 400;
}

.sidebar.collapsed {
    width: var(--sidebar-collapsed-width);
}

.sidebar h2 {
    margin: 0 0 20px 0;
    font-size: 16px;
    color: #ffffff;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 100%;
    transition: opacity var(--transition-speed) ease, font-size var(--transition-speed) ease;
    font-weight: 400;
}

.sidebar.collapsed h2 {
    font-size: 12px;
    opacity: 0.7;
    text-align: center;
}

.sidebar a,
.sidebar button,
.sidebar .footer,
.sidebar .logout {
    color: var(--text-color);
    text-decoration: none;
    padding: 10px 12px;
    margin-bottom: 6px;
    border-radius: var(--card-radius);
    display: flex;
    align-items: center;
    transition: background var(--transition-speed) ease, transform 0.15s ease;
    white-space: nowrap;
    overflow: hidden;
    font-weight: 400;
    background: none;
    border: none;
    cursor: pointer;
    width: 100%;
    text-align: left;
}

.sidebar a:hover,
.sidebar button:hover,
.sidebar .footer:hover,
.sidebar .logout:hover {
    background: rgba(79, 209, 197, 0.08);
    transform: translateX(2px);
}

.sidebar.collapsed a,
.sidebar.collapsed button,
.sidebar.collapsed .footer,
.sidebar.collapsed .logout {
    justify-content: center;
    padding: 10px;
}

.sidebar.collapsed a span,
.sidebar.collapsed button span,
.sidebar.collapsed .footer span,
.sidebar.collapsed .logout span {
    display: none;
}

.sidebar a i,
.sidebar button i,
.sidebar .footer i,
.sidebar .logout i {
    font-family: 'Font Awesome 6 Free';
    font-weight: 900;
    margin-right: 10px;
    font-size: 18px;
}

.sidebar.collapsed a i,
.sidebar.collapsed button i,
.sidebar .footer i,
.sidebar.collapsed .logout i {
    margin-right: 0;
}

.sidebar .join-class-form {
    margin-top: 12px;
    padding: 12px;
    border-radius: var(--card-radius);
    background: rgba(255, 255, 255, 0.03);
}

.sidebar select {
    width: 100%;
    padding: 10px;
    border-radius: 999px;
    border: 1.5px solid var(--accent-color);
    background-color: var(--card-bg);
    color: var(--text-color);
    font-size: 14px;
    font-weight: 400;
    transition: border-color 0.3s ease, box-shadow 0.3s ease;
}

.sidebar select:hover,
.sidebar select:focus {
    border-color: var(--secondary-accent);
    box-shadow: 0 0 6px var(--shadow-glow);
    outline: none;
}

.sidebar .join-class-btn {
    background-color: var(--secondary-accent);
    color: #1a202c;
    padding: 10px;
    border-radius: 999px;
    border: none;
    font-weight: 400;
    margin-top: 10px;
    width: 100%;
    text-align: center;
    transition: background-color 0.3s ease, transform 0.15s ease;
}

.sidebar .join-class-btn:hover {
    background-color: #f56565;
    transform: scale(1.01);
}

.sidebar .join-status {
    color: var(--accent-color);
    font-size: 14px;
    padding: 10px 12px;
    opacity: 0.85;
}

.sidebar.collapsed .join-class-form,
.sidebar.collapsed .join-status {
    display: none;
}

.sidebar .footer {
    position: absolute;
    bottom: 10px;
    width: calc(100% - 40px);
    font-size: 12px;
    opacity: 0.6;
    cursor: default;
}

.sidebar.collapsed .footer {
    width: calc(100% - 20px);
    font-size: 10px;
    text-align: center;
    bottom: 20px;
}

.sidebar .logout {
    background: var(--warning-color);
    color: white;
    text-align: center;
    transition: background 0.3s ease, transform 0.15s ease;
}

.sidebar .logout:hover {
    background: #a93226;
    transform: scale(1.01);
}

.sidebar.collapsed .logout {
    font-size: 12px;
}

.desktop-toggle-btn {
    background: none;
    border: none;
    color: var(--text-color);
    font-size: 18px;
    cursor: pointer;
    padding: 10px;
    display: none;
    align-items: center;
    justify-content: center;
    transition: color 0.3s ease;
}

.desktop-toggle-btn:hover {
    color: var(--secondary-accent);
}

@media (min-width: 769px) {
    .desktop-toggle-btn {
        display: block;
    }
    .sidebar .footer {
        bottom: 10px;
    }
    .sidebar.collapsed .footer {
        bottom: 20px;
    }
}

.main-content {
    flex: 1;
    background-color: var(--bg-color);
    padding: 0;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    margin-left: var(--sidebar-width);
    transition: margin-left var(--transition-speed) ease;
}

.sidebar.collapsed ~ .main-content {
    margin-left: var(--sidebar-collapsed-width);
}

iframe {
    border: none;
    width: 100%;
    flex: 1;
    overflow: auto;
    background: var(--card-bg);
}

.main-header {
    padding: 10px 18px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    background: linear-gradient(180deg, rgba(26, 32, 44, 0.8), var(--bg-color));
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.main-header .logo-container {
    display: flex;
    align-items: center;
    gap: 10px;
}

.main-header .school-name {
    font-size: 18px;
    font-weight: 500;
    color: var(--text-color);
    display: none;
}

@media (min-width: 769px) {
    .main-header .school-name {
        display: inline;
    }
}

.main-header .logout {
    background: var(--warning-color);
    color: white;
    padding: 8px 16px;
    border-radius: 8px;
    text-decoration: none;
    transition: background 0.3s ease, transform 0.2s ease;
}

.main-header .logout:hover {
    background: #a93226;
    transform: scale(1.02);
}

.toggle-btn {
    background: none;
    border: none;
    cursor: pointer;
    font-size: 24px;
    color: #e2dadaff;
    transition: color 0.3s ease;
}

.toggle-btn:hover {
    color: var(--secondary-accent);
}

.toggle-btn::before {
    content: 'Menu';
}

.main-header #settingsBtn {
    background: none;
    border: none;
    cursor: pointer;
    font-size: 15px;
    color: var(--text-color);
    transition: color 0.3s ease, transform 0.2s ease;
    display: flex;
    align-items: center;
    padding: 8px;
}

.main-header #settingsBtn:hover {
    color: var(--secondary-accent);
    transform: scale(1.02);
}

.main-header #settingsBtn i {
    font-family: 'Font Awesome 6 Free';
    font-weight: 900;
    margin-right: 4px;
}

.my-class-content {
    display: none;
    padding: 24px;
    flex: 1;
    overflow: auto;
    background: var(--card-bg);
    border-radius: var(--card-radius);
    margin: 20px;
}

.my-class-content.active {
    display: block;
}

.my-class-content h3 {
    color: var(--accent-color);
    margin-top: 0;
    font-weight: 600;
    font-size: 20px;
}

.my-class-content ul {
    padding-left: 20px;
    color: var(--text-color);
}

.my-class-content ul li {
    margin-bottom: 8px;
    font-size: 16px;
    text-shadow: none;
}

.my-class-content p {
    color: var(--text-color);
    opacity: 0.9;
    font-size: 15px;
}

 /* Loader */
        #loaderOverlay {
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0,0,0,0.7); backdrop-filter: blur(5px);
            display: none; flex-direction: column; justify-content: center; align-items: center;
            z-index: 9999; color: white; font-size: 18px;
        }

.sidebar.collapsed ~ #loaderOverlay {
    left: var(--sidebar-collapsed-width);
    width: calc(100% - var(--sidebar-collapsed-width));
}

.loader {
            border: 6px solid #e2e8f0; border-top: 6px solid var(--accent-color);
            border-radius: 50%; width: 60px; height: 60px; animation: spin 1s linear infinite; margin-top: 20px;
        }

.loader-text {
    color: var(--text-color);
    font-size: 18px;
    font-weight: 600;
    text-align: center;
}

@keyframes spin { 
    to { transform: rotate(360deg); } 
}

@media (max-width: 768px) {
    body {
        flex-direction: column;
    }

    .sidebar {
        left: -100%;
        width: var(--sidebar-width);
        transition: left var(--transition-speed) ease;
    }

    .sidebar.active {
        left: 0;
    }

    .sidebar.collapsed {
        left: -100%;
        width: var(--sidebar-width);
    }

    .sidebar h2, .sidebar .footer, .sidebar .logout {
        font-size: 14px;
    }

    .main-content {
        margin-left: 0 !important;
        transition: transform var(--transition-speed) ease, filter var(--transition-speed) ease;
    }

    .sidebar.active ~ .main-content {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100vh;
        transform: translateX(var(--sidebar-width));
        filter: blur(2px);
    }

    .main-header {
        justify-content: space-between;
        padding: 10px 12px;
    }

    .main-header h1 {
        font-size: 20px;
    }

    .main-header .school-logo {
        width: 32px;
        height: 32px;
    }

    .main-header .toggle-btn {
        font-size: 14px;
    }

    .main-header #settingsBtn {
        font-size: 14px;
        padding: 6px;
    }

    .main-header #settingsBtn i {
        font-size: 16px;
    }

    .main-header .logout {
        display: none;
    }

    .desktop-toggle-btn {
        display: none;
    }

    .sidebar.active .desktop-toggle-btn {
        display: none;
    }

    iframe {
        height: calc(100vh - 60px);
    }

    .my-class-content {
        margin: 12px;
        padding: 16px;
    }

    .sidebar.collapsed a span,
    .sidebar.collapsed button span,
    .sidebar.collapsed .footer span,
    .sidebar.collapsed .logout span {
        display: inline !important;
    }
}

@media (max-width: 480px) {
    .sidebar a, .sidebar button {
        font-size: 12px;
        padding: 8px 10px;
    }
    .sidebar h2 {
        font-size: 16px;
    }

    .main-header h1 {
        font-size: 18px;
    }

    .main-header #settingsBtn {
        font-size: 12px;
    }

    .main-header #settingsBtn i {
        font-size: 14px;
    }

    .my-class-content ul {
        padding-left: 0;
        list-style: none;
        text-align: center;
    }

    .my-class-content h3 {
        font-size: 18px;
    }

    .learner-name { font-size: 16px; }
    .learner-email { font-size: 11px; margin-bottom: 100px; }
}

@media (min-width: 769px) {
    #mobileToggle {
        display: none;
    }

    .sidebar {
        left: 0;
    }

    .sidebar.active {
        width: var(--sidebar-width);
    }
}

.sidebar a.active,
.sidebar button.active {
    background: rgba(79, 209, 197, 0.2);
    border-left: 4px solid var(--accent-color);
}

.sidebar span {
    opacity: 1;
    transition: opacity var(--transition-speed) ease;
}

.sidebar.collapsed span {
    opacity: 0;
}

/* FIXED: Only this part was cleaned — everything else is 100% original */
#mobileBottomNav {
    display: none;
    position: fixed;
    bottom: 0;
    left: 0;
    width: 100%;
    height: 60px;
    background: rgba(20, 20, 20, 0.6);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    justify-content: space-around;
    align-items: center;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
    z-index: 4000;
    transition: background 0.3s ease, transform 0.3s ease;
}

#mobileBottomNav a {
    color: #b4b8c2ff;
    text-decoration: none;
    font-size: 11px;
    text-align: center;
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    transition: color 0.3s ease, transform 0.2s ease;
}

#mobileBottomNav a i {
    font-family: 'Font Awesome 6 Free';
    font-weight: 900;
    font-size: 20px;
    margin-bottom: 4px;
}

#mobileBottomNav a.active,
#mobileBottomNav a:hover {
    color: var(--accent-color);
    transform: translateY(-2px);
}

@media (max-width: 768px) {
    #mobileBottomNav {
        display: flex !important;
    }
    iframe {
        height: calc(100vh - 60px);
    }
}

.sidebar.active ~ #mobileBottomNav {
    filter: blur(5px);
    pointer-events: none;
}

.learner-name {
    margin-top: 4px;
    font-size: 18px;
    font-weight: 500;
    color: #fff;
    transition: max-height 0.3s ease, opacity 0.3s ease;
    overflow: hidden;
    max-height: 30px;
    opacity: 1;
}

.learner-email {
    font-size: 12px;
    font-weight: 400;
    color: #aaa;
    margin-top: 1px;
    margin-bottom: 2px;
    transition: max-height 0.3s ease, opacity 0.3s ease;
    overflow: hidden;
    max-height: 20px;
    opacity: 1;
}

.sidebar.collapsed .learner-name,
.sidebar.collapsed .learner-email {
    max-height: 0;
    opacity: 0;
}

@media (max-width: 480px) {
    .sidebar-links {
        margin-top: 45px;
    }
}

/* Parent Linker Styles */
.parent-link-section {
    margin-top: 20px;
}

.toggle-parent-link {
    background: rgba(79, 209, 197, 0.15);
    color: var(--accent-color);
    border: none;
    padding: 12px 16px;
    border-radius: 12px;
    font-size: 15px;
    font-weight: 600;
    cursor: pointer;
    width: 100%;
    text-align: left;
    display: flex;
    align-items: center;
    justify-content: space-between;
    transition: all 0.3s ease;
}

.toggle-parent-link:hover {
    background: rgba(79, 209, 197, 0.25);
}

.toggle-parent-link::after {
    content: 'Down Arrow';
    font-size: 12px;
    margin-left: 8px;
}

.parent-dropdown {
    animation: fadeIn 0.3s ease;
    margin-top: 10px;
    padding: 15px;
    background: rgba(0,0,0,0.2);
    border-radius: 12px;
}

@keyframes fadeIn {
    from { opacity: 0; transform: translateY(-10px); }
    to { opacity: 1; transform: translateY(0); }
}

@media (max-width: 768px) {
    .sidebar a.desktop-only { display: none; }
}

#mobileToggle {
    display: none;
    background: none;
    border: none;
    color: #e0e6f0;
    font-size: 26px;
    cursor: pointer;
    padding: 8px;
    transition: color 0.3s ease;
}

#mobileToggle:hover {
    color: var(--accent-color);
}

@media (max-width: 768px) {
    #mobileToggle {
        display: block;
    }
}
</style>
</head>
<body>
<?php $currentPage = basename($_SERVER['PHP_SELF']); ?>

<div class="sidebar">
    <button class="desktop-toggle-btn" onclick="toggleDesktopSidebar()" title="Toggle Sidebar">
        <i class="fas fa-chevron-right"></i>
    </button>
    <div class="profile-picture-wrapper" style="position:relative; display:inline-block; cursor:pointer;">
        <img src="Uploads/learners/<?= htmlspecialchars($learnerProfilePicture ?: 'default.png') ?>" 
             alt="Profile Picture" 
             class="learner-avatar"
             style="width:40px; height:40px; border-radius:50%; object-fit:cover; border:3px solid #757272ff;">
        <input type="file" id="profileInput" accept="image/*" style="display:none;">
    </div>

    <div class="learner-name"><?= htmlspecialchars($learnerFullName ?: 'Learner') ?></div>  
    <div class="learner-email"><?= htmlspecialchars($learnerEmail ?: '') ?></div>

    <div class="sidebar-links">
        <a href="learner_manual.php" target="mainFrame" data-page="learner_manual.php"
           class="<?= $currentPage === 'learner_manual.php' ? 'active' : '' ?>">
            <i class="fas fa-home"></i><span>Home</span>
        </a>

        <a href="quiz_list.php" target="mainFrame" class="desktop-only" data-page="quiz_list.php"
           class="<?= $currentPage === 'quiz_list.php' ? 'active' : '' ?>">
            <i class="fas fa-question-circle"></i><span>Quiz</span>
        </a>

        <a href="learner_assignments.php" target="mainFrame" class="desktop-only" data-page="learner_assignments.php"
           class="<?= $currentPage === 'learner_assignments.php' ? 'active' : '' ?>">
            <i class="fas fa-file-alt"></i><span>Assignments</span>
        </a>

        <a href="view_resources_user.php" target="mainFrame" class="desktop-only" data-page="view_resources_user.php"
           class="<?= $currentPage === 'view_resources_user.php' ? 'active' : '' ?>">
            <i class="fas fa-book"></i><span>Resources</span>
        </a>

        <a href="quiz_history.php" target="mainFrame" data-page="quiz_history.php"
           class="<?= $currentPage === 'quiz_history.php' ? 'active' : '' ?>">
            <i class="fas fa-chart-bar"></i><span>Grades</span>
        </a>

        <a href="view_announcements_user.php" target="mainFrame" class="desktop-only" data-page="view_announcements_user.php"
           class="<?= $currentPage === 'view_announcements_user.php' ? 'active' : '' ?>">
            <i class="fas fa-bullhorn"></i><span>Announcements</span>
        </a>

        <a href="take_teacher_evaluation.php" target="mainFrame" data-page="take_teacher_evaluation.php"
           class="<?= $currentPage === 'take_teacher_evaluation.php' ? 'active' : '' ?>">
            <i class="fas fa-star"></i><span>Teacher Evaluations</span>
        </a>

        <?php if (empty($joinedClassIds)): ?>
            <button type="button" onclick="toggleJoinClassForm()" data-page="join-class"
                    class="<?= $currentPage === 'learner_dashboard.php' && !empty($_GET['join']) ? 'active' : '' ?>">
                <i class="fas fa-plus-circle"></i><span>Join a Class</span>
            </button>
            <div class="join-class-form" id="joinClassForm" style="display: none;">
                <p style="color: var(--warning-color); font-weight: bold; font-size: 14px;">
                    Warning: You can only choose your class *once*. Make sure you select the correct one.
                </p>
                <form method="POST">
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
            <button type="button" onclick="showMyClass()" data-page="my-class" class="my-class-btn">
                <i class="fas fa-school"></i><span>My Class</span>
            </button>
            <div class="join-status"><i class="fas fa-check"></i><span>Joined Class</span></div>
        <?php endif; ?>
    </div>

    <div class="footer" style="font-size:12px;"><span><strong>iSkool v.1.0.0</strong></span></div>
</div>

<div class="main-content">
    <div class="main-header">
    <button id="mobileToggle" onclick="toggleSidebar()">
        <i class="fas fa-bars"></i>
    </button>
    
    <div class="logo-container">
        <img src="<?= htmlspecialchars($schoolLogo) ?>" 
             alt="School Logo" 
             style="width:40px; height:40px; border-radius:8px; object-fit:cover; border:3px solid #757272ff;">
        <span class="school-name"><?= htmlspecialchars($schoolName) ?></span>
    </div>
    
    <button id="settingsBtn">
        <i class="fas fa-gear"></i>
    </button>
</div>

    <div class="my-class-content" id="myClassContent">
        <h3>My Class</h3>
        <?php if (!empty($joinedClassIds)): ?>
            <?php 
            $ids = implode(',', $joinedClassIds);
            $res = $conn->query("SELECT name FROM classes WHERE id IN ($ids)");
            while ($c = $res->fetch_assoc()): ?>
                <p style="font-size:18px;color:#4fd1c5;font-weight:bold;"><?= htmlspecialchars($c['name']) ?></p>
            <?php endwhile; ?>

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

    <iframe name="mainFrame" src="learner_manual.php"></iframe>
</div>

<div id="loaderOverlay">
    <div class="loader-text">Processing...</div>
    <div class="loader"></div>
</div>

<script>
document.addEventListener("DOMContentLoaded", function () {
    const loader         = document.getElementById("loaderOverlay");
    const iframe         = document.querySelector('iframe[name="mainFrame"]');
        // LOADER: Show when clicking any navigation link (sidebar + bottom nav)
    document.querySelectorAll('a[target="mainFrame"], #mobileBottomNav a').forEach(link => {
        link.addEventListener('click', () => {
            loader.style.display = 'flex';
        });
    });

    // LOADER: Hide when iframe finishes loading
    iframe?.addEventListener('load', () => {
        loader.style.display = 'none';
    });

    // ────────────────────── ADD THIS BLOCK FOR SETTINGS ──────────────────────
    const settingsBtn = document.getElementById("settingsBtn");
    
    settingsBtn.addEventListener('click', function() {
        // 1. Show the loader immediately
        loader.style.display = 'flex';
        
        // 2. Load the settings page into the iframe.
        // Assuming your settings page is 'learner_settings.php'
        iframe.src = "learner_settings.php"; 

        // 3. Clear active states (optional, but good for UI clarity)
        setActive("learner_settings.php"); 
        
        // 4. Close mobile sidebar if open
        if (sidebar.classList.contains("active")) {
            toggleSidebar();
        }
    });
    // ────────────────────── END NEW BLOCK ──────────────────────
    const sidebar        = document.querySelector(".sidebar");
    const myClassContent = document.getElementById("myClassContent");
    const mobileOverlay  = document.getElementById("mobileOverlay") || createMobileOverlay();

    function createMobileOverlay() {
        const div = document.createElement("div");
        div.id = "mobileOverlay";
        Object.assign(div.style, {
            display: "none",
            position: "fixed",
            top: 0, left: 0, width: "100%", height: "100%",
            background: "rgba(0,0,0,0.4)",
            zIndex: 1500
        });
        document.body.appendChild(div);
        return div;
    }

    // PROFILE PICTURE UPLOAD
    const avatar = document.querySelector(".learner-avatar");
    const profileInput = document.getElementById("profileInput");

    if (avatar && profileInput) {
        avatar.addEventListener("click", () => profileInput.click());
        profileInput.addEventListener("change", function (e) {
            const file = e.target.files[0];
            if (!file) return;

            avatar.src = URL.createObjectURL(file);

            const fd = new FormData();
            fd.append("profile", file);

            fetch("upload_profile.php", { method: "POST", body: fd })
                .then(r => r.json())
                .then(data => {
                    if (data.success) {
                        avatar.src = "Uploads/learners/" + data.file;
                    } else {
                        alert(data.error || "Upload failed");
                    }
                })
                .catch(() => alert("Upload error"));
        });
    }

    // SHOW LOADER ON FORM SUBMIT
    document.querySelector("form")?.addEventListener("submit", () => {
        loader.style.display = "flex";
    });

    // MENU ACTIVE STATE
    const navItems = document.querySelectorAll("[data-page]");

    function setActive(page) {
        navItems.forEach(item => {
            item.classList.toggle("active", item.getAttribute("data-page") === page);
        });
    }

    setActive("<?= $currentPage ?>");

    navItems.forEach(item => {
        item.addEventListener("click", () => {
            const page = item.getAttribute("data-page");
            if (page) setActive(page);
        });
    });

    iframe?.addEventListener("load", () => {
        try {
            const path = iframe.contentWindow.location.pathname;
            const filename = path.split("/").pop();
            if (filename) setActive(filename);
        } catch (e) { /* ignore cross-origin */ }
    });

    // SIDEBAR TOGGLES
    window.toggleSidebar = function () {
        if (window.innerWidth <= 768) {
            sidebar.classList.toggle("active");
            mobileOverlay.style.display = sidebar.classList.contains("active") ? "block" : "none";
        }
    };

    window.toggleDesktopSidebar = function () {
        if (window.innerWidth > 768) {
            sidebar.classList.toggle("collapsed");
            const collapsed = sidebar.classList.contains("collapsed");
            localStorage.setItem("sidebarCollapsed", collapsed);
            document.querySelector(".desktop-toggle-btn i").className =
                collapsed ? "fas fa-chevron-right" : "fas fa-chevron-left";
        }
    };

    if (window.innerWidth > 768) {
        const saved = localStorage.getItem("sidebarCollapsed");
        if (saved === "true" || saved === null) {
            sidebar.classList.add("collapsed");
            document.querySelector(".desktop-toggle-btn i").className = "fas fa-chevron-right";
        }
    }

    mobileOverlay.addEventListener("click", () => {
        sidebar.classList.remove("active");
        mobileOverlay.style.display = "none";
    });

    // JOIN CLASS FORM TOGGLE
    window.toggleJoinClassForm = function () {
        const form = document.getElementById("joinClassForm");
        if (form) form.style.display = form.style.display === "none" ? "block" : "none";
    };

    // SHOW MY CLASS PANEL
    window.showMyClass = function () {
        myClassContent.classList.add("active");
        iframe.style.display = "none";
        setActive("my-class");

        if (window.innerWidth <= 768) {
            sidebar.classList.remove("active");
            mobileOverlay.style.display = "none";
        }
    };

    document.querySelectorAll('.sidebar a[target="mainFrame"]').forEach(link => {
        link.addEventListener("click", () => {
            myClassContent.classList.remove("active");
            iframe.style.display = "block";
        });
    });

    window.toggleParentDropdown = () => {
        document.getElementById("parentDropdown").style.display = 
            document.getElementById("parentDropdown").style.display === "block" ? "none" : "block";
    };

    document.getElementById("parentLinkForm")?.addEventListener("submit", function(e) {
        e.preventDefault();
        const email = this.querySelector("select").value;
        if (!email) return alert("Select a parent");
        loader.style.display = "flex";
        fetch("link_parent.php", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: "parent_email=" + email + "&learner_email=<?= $_SESSION['email'] ?>&class_id=<?= $joinedClassIds[0] ?? 0 ?>"
        })
        .then(r => r.json())
        .then(d => { if (d.success) location.reload(); })
        .finally(() => loader.style.display = "none");
    });

    document.getElementById("settingsBtn")?.addEventListener("click", () => {
        iframe.src = "learner_settings.php";
        myClassContent.classList.remove("active");
        iframe.style.display = "block";
    });

    loader.style.display = "none";
});
</script>

<div id="mobileOverlay" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.4); z-index:1500;"></div>

<nav id="mobileBottomNav">
    <a href="quiz_list.php" target="mainFrame" data-page="quiz_list.php"
       class="<?= $currentPage === 'quiz_list.php' ? 'active' : '' ?>">
        <i class="fas fa-question-circle"></i>Quiz
    </a>
    <a href="learner_assignments.php" target="mainFrame" data-page="learner_assignments.php"
       class="<?= $currentPage === 'learner_assignments.php' ? 'active' : '' ?>">
        <i class="fas fa-file-alt"></i>Assignments
    </a>
    <a href="view_resources_user.php" target="mainFrame" data-page="view_resources_user.php"
       class="<?= $currentPage === 'view_resources_user.php' ? 'active' : '' ?>">
        <i class="fas fa-book"></i>Resources
    </a>
    <a href="view_announcements_user.php" target="mainFrame" data-page="view_announcements_user.php"
       class="<?= $currentPage === 'view_announcements_user.php' ? 'active' : '' ?>">
        <i class="fas fa-bullhorn"></i>Announcements
    </a>
</nav>

</body>
</html>