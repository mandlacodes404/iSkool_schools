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
 * @version     1.0.0
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

session_start();
require_once 'config.php';

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
$schoolLogo = 'uploads/schools/default_school.png';

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

$stmt = $conn->prepare("SELECT name, surname, profile_picture FROM users WHERE email = ?");
$stmt->bind_param("s", $learnerEmail);
$stmt->execute();
$res = $stmt->get_result();

if ($row = $res->fetch_assoc()) {
    // 1. Update variables with real data from DB
    $learnerName           = $row['name'] ?: $learnerName;
    $learnerSurname        = $row['surname'] ?: '';
    $learnerProfilePicture = $row['profile_picture'] ?: 'default.png';
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
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Learner Dashboard</title>
    <link rel="icon" type="image/svg+xml" href="/icon.svg?v=1.2">
    <link rel="stylesheet" href="assets/css/learner/quiz.css?v=1.5">
    <link rel="stylesheet" href="assets/css/learner/manual.css?v=1.4">
    <meta name="theme-color" content="#1a1919">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-status-bar-style" content="default">
    <link rel="manifest" href="/manifest.json">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.2/css/all.min.css" integrity="sha512-z3gLpd7yknf1YoNbCzqRKc4qyor8gaKU1qmn+CShxbuBusANI9QpRohGBreCFkKxLhei6S9CQXFEbbKuqLg0DA==" crossorigin="anonymous" referrerpolicy="no-referrer" />
    <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@600&display=swap" rel="stylesheet">
 <style>
:root {
    --bg-color: #0d1117;
    --sidebar-bg: #1a202c;
    --text-color: #e2e8f0;
    --accent-color765: #4fd1c5;
    --secondary-accent: #f6877a;
    --card-bg: #1a202c;
    --button-bg: #f7fafc;
    --button-hover-bg: #edf2f7;
    --warning-color: #c0392b;
    --shadow-glow: rgba(79, 209, 197, 0.3);
    --card-radius: 16px;
    --sidebar-width: 240px;
    --sidebar-collapsed-width: 80px;
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
    transition: left var(--transition-speed) ease, transform var(--transition-speed) ease;
    position: fixed;
    top: 0;
    left: 0;
    height: 100vh;
    z-index: 5000;
    
    /* FIX STARTS HERE */
    overflow-y: auto;   /* Keep vertical scrolling for long menus */
    overflow-x: hidden; /* Prevents horizontal scroll entirely */
    scrollbar-width: none; /* Hides scrollbar track in Firefox */
    
   border-right: 1px solid rgba(255, 255, 255, 0.08);
    font-weight: 100;

    /* THE CURVES: Only top-right and bottom-right */
    border-top-right-radius: 20px;
    border-bottom-right-radius: 20px;
    
    /* THE BORDER: A subtle "rim" makes the curve look premium */
    border-right: 1px solid rgba(190, 188, 188, 0.08);
}

.sidebar::-webkit-scrollbar {
    display: none; /* Hides scrollbar track in Chrome/Safari */
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
    font-weight: 100;
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
    color: #b2b5b9ff;;             /* sidebar text colour*/
    text-decoration: none;
    padding: 10px 12px;
    margin-bottom: 0px;
    border-radius: var(--card-radius);
    display: flex;
    align-items: center;
    transition: background var(--transition-speed) ease, transform 0.15s ease;
    white-space: nowrap;
    overflow: hidden;
    font-weight: 100;
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
    color: #ffffff;
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
   
}

/*.sidebar.collapsed ~ .main-content {
    margin-left: var(--sidebar-collapsed-width);
}*/

iframe {
    border: none;
    width: 100%;
    flex: 1;
    overflow: auto;
    background: var(--card-bg);
}

.main-header {
    padding: 10px 18px;
    border-bottom: 1px solid var(--border-color);          /* faint rim like sidebar */
    background: rgba(26, 25, 25, 0.92);                    /* almost exact sidebar bg #1a1919 with slight transparency */
    backdrop-filter: blur(10px);                           /* glass effect – premium dim look */
    display: flex;
    justify-content: space-between;
    align-items: center;
    position: sticky;
    top: 0;
    z-index: 1000;
}

.main-header .logo-container {
    display: flex;
    align-items: center;
    gap: 10px;
}

.main-header .school-name {
    font-size: 18px;
    font-weight: 600;
    color: var(--text-color);           /* soft white #e2e8f0 */
    display: none;                      /* hidden on mobile – already good */
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
        width: 300px; /* Increased from 240px to 300px */
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
       transform: translateX(300px);
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
        width: auto !important; /* Changed from 100% to auto */
       
        box-sizing: border-box !important;

        font-size: 17px !important; 
        font-weight: 700 !important; /* Bold like teacher side */
        padding: 18px 15px !important; /* Tall touch targets */
        margin-bottom: 10px !important;
        background: rgba(255, 255, 255, 0.03); /* Subtle button background */
        border-radius: 14px !important;
    }

    .sidebar a i, .sidebar button i {
        font-size: 20px !important;
        margin-right: 15px !important;
        width: 25px;
        text-align: center;
    }

    .sidebar-links {
        margin-top: 30px !important;
    }
    /* 1. Make the Profile Area "Pop" */
    .profile-picture-wrapper img.learner-avatar {
        width: 70px !important;   
        height: 70px !important;  
        border: 4px solid #757272ff !important;
        margin-bottom: 12px;
    }
    .sidebar h2 {
        font-size: 16px;
    }

    .main-header h1 {
        font-size: 18px;
    }

    .main-header #settingsBtn {
        font-size: 20px;
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

    .learner-name { 
        font-size: 23px !important; 
        max-height: none !important; 
        font-weight: 800 !important; 
        margin-top: 8px;
        color: #ffffff;
    }

    .learner-email { 
        font-size: 16px !important; 
        margin-bottom: 30px !important; 
        max-height: none !important; 
        opacity: 0.7;
    }
    .sidebar .footer {
        bottom: 40px !important; /* Lifts it higher on mobile */
        font-size: 16px !important;
        opacity: 0.8 !important; /* Makes it a bit easier to see */
    }
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

/* Update this block to use an INSET shadow instead of a BORDER */
.sidebar a.active,
.sidebar button.active {
    background: rgba(79, 209, 197, 0.15);
    /* This creates the line inside the button so width doesn't change */
    box-shadow: inset 4px 0 0 0 #8b949e; /* Grey active line instead of Teal */
    border-left: none; /* Remove the old border */
}

.sidebar span {
    opacity: 1;
    transition: opacity var(--transition-speed) ease;
}

.sidebar.collapsed span {
    opacity: 0;
}

        /* Mobile Bottom Navigation - Now fully consistent with platform style */
#mobileBottomNav {
    display: none;
    position: fixed;
    bottom: 0;
    left: 0;
    width: 100%;
    height: 70px;                                 /* your preferred height */
    background: rgba(27, 27, 27, 0.85);           /* ← #1b1b1b with transparency – exact platform charcoal glass */
    backdrop-filter: blur(20px);                  /* ← premium blur like other glass elements */
    -webkit-backdrop-filter: blur(20px);
    border-top: 1px solid rgba(255, 255, 255, 0.05);  /* ← faint platform border */
    box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.4);   /* ← soft dark shadow */
    justify-content: space-around;
    align-items: flex-start;                      /* content pushed to top */
    padding-top: 10px;                             /* breathing room at top */
    padding-bottom: env(safe-area-inset-bottom);
    padding-bottom: constant(safe-area-inset-bottom);
    z-index: 4000;
    box-sizing: border-box;
    transition: padding-bottom 0.3s ease, height 0.3s ease;
   border-top: 3px solid rgba(255, 255, 255, 0.12);
}


        #mobileBottomNav a {
    color: var(--text-color);                     /* ← #e2e8f0 – clear white/off-white */
    text-decoration: none;
    font-size: 11px;
    text-align: center;
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-start;
    padding-top: 0;
    transition: all 0.2s ease;
}

        #mobileBottomNav a i {
    font-size: 20px;
    margin-bottom: 3px;                           /* tighter spacing */
    color: var(--secondary-text);                 /* muted gray #8b949e by default */
}
        #mobileBottomNav a.active,
        #mobileBottomNav a:hover {
            color: var(--accent-color);
            transform: translateY(-3px);
        }

        /* Mobile Layout - Show bottom nav + safe area support */
        @media (max-width: 768px) {
            #mobileBottomNav {
                display: flex;
            }

            /* Critical: Lifts the entire bar on iPhone & Android gesture navigation */
            #mobileBottomNav {
                padding-bottom: env(safe-area-inset-bottom);
                padding-bottom: constant(safe-area-inset-bottom); /* older iOS fallback */
                height: calc(70px + env(safe-area-inset-bottom));
                height: calc(70px + constant(safe-area-inset-bottom));
            }

            iframe {
                height: calc(100vh - 80px);
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

/* World Class Initials Avatar */
.initials-avatar {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: #121212; /* Charcoal Background */
    color: #8b8989ff;            /* Muted Silver/Grey text */
    font-size: 14px;
    font-weight: 800;
    border: 2px solid #8b8989ff;
    user-select: none;
    text-transform: uppercase;
    letter-spacing: -1px; /* Tighter letters look more professional for initials */
}

/* Adjust for the larger mobile view profile picture */
@media (max-width: 480px) {
    .initials-avatar {
        width: 70px !important;
        height: 70px !important;
        font-size: 24px !important;
        border: 1.5px solid #8b8989ff!important;
    }
}
/* SVG icons – consistent with platform style */
.sidebar a svg,
#mobileBottomNav a svg,
.main-header button svg {
    width: 20px;
    height: 20px;
    stroke: currentColor;
    flex-shrink: 0;
    transition: stroke 0.3s ease;
}
@media (max-width: 768px) {
    /* Perspective is key for the 3D 'pop' */
    body {
        perspective: 1200px;
        overflow-x: hidden;
    }

    .main-content {
        backface-visibility: hidden;
        transform-style: preserve-3d;
    }

    @keyframes mobileHorizontalFlip {
        0% {
            /* Start rotated 180 degrees sideways and slightly smaller */
            transform: rotateY(-180deg) scale(0.8);
            opacity: 0;
        }
        100% {
            /* Spin to front and full size */
            transform: rotateY(0deg) scale(1);
            opacity: 1;
        }
    }

    .mobile-first-load {
        /* Duration 0.6s with a 'spring' ease-out */
        animation: mobileHorizontalFlip 0.8s cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
    }
}
/* Desktop slide-in menu (no overlay/dim) */
.sidebar.desktop-open {
    left: 0 !important;
    transform: translateX(0) !important;
}

/* Default hidden on desktop - slide from left */
@media (min-width: 769px) {
    .sidebar {
        left: -100%;                    /* Start hidden off-screen */
        transition: left var(--transition-speed) ease, transform var(--transition-speed) ease;
        width: var(--sidebar-width);    /* Keep your 240px width */
        box-shadow: 4px 0 20px rgba(0,0,0,0.35); /* subtle shadow when open */
        z-index: 2000;                  /* Above main content but below header if needed */
    }

    .sidebar.desktop-open {
        left: 0;
    }

    /* No permanent sidebar anymore - remove collapsed logic */
    .sidebar.collapsed,
    .sidebar.collapsed ~ .main-content {
        margin-left: 0 !important;
        width: 0 !important;
    }

    /* Main content full width now (no margin for sidebar) */
    .main-content {
        margin-left: 0 !important;
        transition: none; /* no shift needed */
    }
}
#desktopMenuToggle {
    display: none;
    background: #000000;
    border: 2px solid #333;
    color: #e2e8f0;
    width: 40px;
    height: 40px;
    border-radius: 19%;
    cursor: pointer;
    align-items: center;
    justify-content: center;
    transition: all 0.3s ease;
    margin-right: 15px;
}

#desktopMenuToggle:hover {
    background: #111111;
}

@media (min-width: 769px) {
    #desktopMenuToggle {
        display: flex;
    }
}

@media (max-width: 768px) {
    #desktopMenuToggle {
        display: none !important;
    }
}

.desktop-close-btn {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: #000000;
    border: 2px solid #333;
    color: #e2e8f0;
    font-size: 18px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.3s ease;
    flex-shrink: 0;
}

.desktop-close-btn:hover {
    /* Remove hover/highlight effect so it stays visually constant */
    background: #000000 !important;
    color: #e2e8f0 !important;
    transform: none !important;
}

.desktop-close-btn:focus {
    outline: none;
    box-shadow: none;
}

@media (max-width: 768px) {
    .desktop-close-btn {
        display: none !important;
    }
}

</style>
</head>
<body>
<?php $currentPage = basename($_SERVER['PHP_SELF']); ?>

<div class="sidebar">
    
    <div class="sidebar-header" style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 15px;">
        
        <div class="profile-picture-wrapper" style="position:relative; display:inline-block; cursor:pointer;" onclick="document.getElementById('profileInput').click();">
            <?php if ($learnerProfilePicture && $learnerProfilePicture !== 'default.png'): ?>
                <img src="uploads/learners/<?= htmlspecialchars($learnerProfilePicture) ?>" 
                     alt="Profile Picture" 
                     class="learner-avatar"
                     style="width:40px; height:40px; border-radius:50%; object-fit:cover; border:3px solid #757272ff;">
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

    <div class="sidebar-links">
      <a href="javascript:void(0)" class="desktop-only" onclick="loadManual();">
           <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:20px; height:20px; margin-right:10px;">
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
    <polyline points="9 22 9 12 15 12 15 22"/>
</svg><span>Home</span>
        </a>

        <a href="javascript:void(0)" onclick="fetchQuizzes(); updateHeaderTitle('Quizzes')" class="desktop-only">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg><span>Quiz</span>
        </a>

        <a href="javascript:void(0)" onclick="fetchAssignments(); updateHeaderTitle('Assignments')" class="desktop-only">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 12h6"/><path d="M9 16h6"/><rect x="4" y="4" width="16" height="16" rx="2"/></svg><span>Assignments</span>
        </a>

       <a href="javascript:void(0)" onclick="fetchResources(); updateHeaderTitle('Resources')" class="desktop-only">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg><span>Resources</span>
        </a>

        <a href="javascript:void(0)"
   onclick="fetchGrades(); updateHeaderTitle('My Grades')"
   data-page="grades">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
         stroke-linecap="round" stroke-linejoin="round">
        <line x1="18" y1="20" x2="18" y2="10"/>
        <line x1="12" y1="20" x2="12" y2="4"/>
        <line x1="6"  y1="20" x2="6"  y2="14"/>
    </svg>
    <span>Grades</span>
</a>

        <a href="javascript:void(0)" onclick="fetchAnnouncements(); updateHeaderTitle('Announcements')">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg><span>Announcements</span>
        </a>

        <a href="javascript:void(0)" onclick="fetchEvaluations(); updateHeaderTitle('Evaluations')">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15 8 21 9 17 14 18 21 12 18 6 21 7 14 3 9 9 8 12 2"/></svg><span>Teacher Evaluations</span>
        </a>

        <a href="javascript:void(0)" onclick="fetchSyllabus()" data-page="syllabus" >
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
        <a href="javascript:void(0)" onclick="fetchDiscussions(); updateHeaderTitle('Discussions')">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg><span>Discussions</span>
        </a>

        <?php if (empty($joinedClassIds)): ?>
            <button type="button" onclick="toggleJoinClassForm()" data-page="join-class"
                    class="<?= $currentPage === 'learner_dashboard.php' && !empty($_GET['join']) ? 'active' : '' ?>">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg><span>Join a Class</span>
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
               <span>My Class</span>
            </button>
            <div class="join-status"><i class="fas fa-check"></i><span>Joined Class</span></div>
        <?php endif; ?>
    </div>

    <div class="footer" style="font-size:15px;"><span><strong>iSkool v.1.0.0</strong></span></div>
</div>

<div class="main-content">
  
    <div class="main-header">
    
    <div id="headerLeft" style="flex: 1; display: flex; align-items: center;">
        <button id="mobileToggle" onclick="toggleSidebar()" aria-label="Toggle Mobile Menu">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
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
        </button>
    </div>

    <div class="logo-container" style="flex: 2; display: flex; justify-content: center; align-items: center; gap: 10px;">
        <img id="headerLogo" src="<?= htmlspecialchars($schoolLogo) ?>" 
             alt="School Logo" 
             style="width:40px; height:40px; border-radius:8px; object-fit:cover; border:3px solid #757272ff;">
        <span class="school-name" id="headerTitle"><?= htmlspecialchars($schoolName) ?></span>
    </div>

    <div id="headerRight" style="flex: 1; display: flex; justify-content: flex-end;">
        <button id="settingsBtn">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:20px; height:20px;">
                <circle cx="12" cy="12" r="3"></circle>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
        </button>
    </div>
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

    <div id="api-content-area" style="display:none;"></div>
<iframe id="mainFrame" name="mainFrame" src="about:blank" style="display:none;"></iframe>
</div>


<div id="loaderOverlay">
    <div class="loader-text">Processing...</div>
    <div class="loader"></div>
</div>

<script>
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
        setTimeout(() => {
            mainContent.classList.remove("mobile-first-load");
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
        // Wait for all scripts to finish loading
        setTimeout(() => {
            window.loadDiscussionThread(discId);
        }, 100);
    } else {
        setTimeout(() => {
            window.fetchDiscussions();
        }, 100);
    }
}
     else if (targetPage === 'announcement_list.php') {
        window.fetchAnnouncements();
    } else if (targetPage === 'quiz_list.php') {
        window.fetchQuizzes();
    } else if (targetPage === 'assignment_list.php') {
        window.fetchAssignments();
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
            window.fetchAnnouncements();
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
                          onClick.includes('fetchAnnouncements');

        // Inside your Main Script's link click listener:
const isCached = (onClick.includes('loadManual') && window.manualCache) ||
                 (onClick.includes('fetchQuizzes') && window.learnerQuizCache) ||
                 (onClick.includes('fetchAssignments') && window.learnerAssignmentCache) ||
                 (onClick.includes('fetchAnnouncements') && window.announcementCache) ||
                 (onClick.includes('fetchResources') && window.resourceCache) ||
                 (onClick.includes('fetchEvaluations') && window.evaluationCache) ||
                 (onClick.includes('fetchGrades') && window.learnerGradesCache) ||
                 (onClick.includes('fetchSyllabus') && window.syllabusCache) ||
                 (onClick.includes('fetchDiscussions') && window.discussionCache); // <-- ADD THIS

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

    // Grab current avatar src or initials
    const avatarImg = document.querySelector('.profile-picture-wrapper img.learner-avatar');
    const initialsEl = document.querySelector('.profile-picture-wrapper .initials-avatar');
    const avatarHTML = avatarImg
        ? `<img src="${avatarImg.src}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`
        : `<span style="font-size:32px;font-weight:800;color:#8b949e;text-transform:uppercase;">${initialsEl ? initialsEl.textContent.trim() : '??'}</span>`;

    apiArea.innerHTML = `
        <div style="padding:20px;">

            <!-- CIRCULAR PROFILE -->
            <div style="display:flex;flex-direction:column;align-items:center;margin-bottom:28px;">
                <div onclick="document.getElementById('profileInput').click()"
                     style="position:relative;width:100px;height:100px;border-radius:50%;
                            background:#1b1b1b;border:3px solid #30363d;
                            overflow:hidden;cursor:pointer;flex-shrink:0;
                            transition:border-color 0.2s ease;"
                     onmouseover="this.style.borderColor='#4fd1c5'; this.querySelector('.cam-overlay').style.opacity='1';"
                     onmouseout="this.style.borderColor='#30363d'; this.querySelector('.cam-overlay').style.opacity='0';">

                    <!-- Avatar (photo or initials) -->
                    <div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:#1b1b1b;">
                        ${avatarHTML}
                    </div>

                    <!-- Camera hover overlay -->
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

                <!-- Notification Help Box -->
                <div style="background:rgba(79,209,197,0.05);border:1px solid rgba(79,209,197,0.2);
                            border-left:4px solid #4fd1c5;border-radius:12px;padding:15px;margin-bottom:4px;">
                    <div style="color:#4fd1c5;font-weight:800;font-size:14px;margin-bottom:8px;">
                        💡 Notification Help
                    </div>
                    <ol style="margin:0;padding-left:18px;font-size:13px;color:#8b949e;line-height:1.7;">
                        <li><strong style="color:#c9d1d9;">iPhone Users:</strong> You must "Add to Home Screen" first.</li>
                        <li>Tap <strong style="color:#c9d1d9;">Sync Notifications</strong> below if you aren't getting alerts.</li>
                        <li>If prompted, select <strong style="color:#c9d1d9;">"Allow"</strong> on the system popup.</li>
                    </ol>
                </div>

                <!-- Update Profile Picture -->
                <div onclick="document.getElementById('profileInput').click()"
                     style="display:flex;align-items:center;gap:14px;
                            background:#1b1b1b;border:1px solid rgba(255,255,255,0.06);
                            border-radius:12px;padding:16px;cursor:pointer;
                            transition:background 0.2s ease;"
                     onmouseover="this.style.background='#21262d'"
                     onmouseout="this.style.background='#1b1b1b'">
                    <div style="width:40px;height:40px;border-radius:10px;
                                background:rgba(79,209,197,0.1);
                                display:flex;align-items:center;justify-content:center;flex-shrink:0;">
                        <svg viewBox="0 0 24 24" width="22" height="22" stroke="#4fd1c5" stroke-width="2" fill="none">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                            <polyline points="17 8 12 3 7 8"></polyline>
                            <line x1="12" y1="3" x2="12" y2="15"></line>
                        </svg>
                    </div>
                    <div style="flex:1;">
                        <div style="color:#e2e8f0;font-weight:700;font-size:14px;">Update Profile Picture</div>
                        <div style="color:#8b949e;font-size:12px;margin-top:2px;">Upload a new photo</div>
                    </div>
                    <svg viewBox="0 0 24 24" width="16" height="16" stroke="#8b949e" stroke-width="2" fill="none">
                        <polyline points="9 18 15 12 9 6"></polyline>
                    </svg>
                </div>

                <!-- Remove Profile Picture -->
                <div onclick="removeLearnerProfilePicture()"
                     style="display:flex;align-items:center;gap:14px;
                            background:#1b1b1b;border:1px solid rgba(255,255,255,0.06);
                            border-radius:12px;padding:16px;cursor:pointer;
                            transition:background 0.2s ease;"
                     onmouseover="this.style.background='#21262d'"
                     onmouseout="this.style.background='#1b1b1b'">
                    <div style="width:40px;height:40px;border-radius:10px;
                                background:rgba(248,81,73,0.1);
                                display:flex;align-items:center;justify-content:center;flex-shrink:0;">
                        <svg viewBox="0 0 24 24" width="22" height="22" stroke="#f85149" stroke-width="2" fill="none">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path>
                            <path d="M10 11v6M14 11v6"></path>
                        </svg>
                    </div>
                    <div style="flex:1;">
                        <div style="color:#f85149;font-weight:700;font-size:14px;">Remove Profile Picture</div>
                        <div style="color:#8b949e;font-size:12px;margin-top:2px;">Revert to initials avatar</div>
                    </div>
                    <svg viewBox="0 0 24 24" width="16" height="16" stroke="#8b949e" stroke-width="2" fill="none">
                        <polyline points="9 18 15 12 9 6"></polyline>
                    </svg>
                </div>

                <!-- Sync Notifications -->
                <div onclick="requestIphonePush()"
                     style="display:flex;align-items:center;gap:14px;
                            background:#1b1b1b;border:1px solid rgba(255,255,255,0.06);
                            border-radius:12px;padding:16px;cursor:pointer;
                            transition:background 0.2s ease;"
                     onmouseover="this.style.background='#21262d'"
                     onmouseout="this.style.background='#1b1b1b'">
                    <div style="width:40px;height:40px;border-radius:10px;
                                background:rgba(79,209,197,0.1);
                                display:flex;align-items:center;justify-content:center;flex-shrink:0;">
                        <svg viewBox="0 0 24 24" width="22" height="22" stroke="#4fd1c5" stroke-width="2" fill="none">
                            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                            <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
                        </svg>
                    </div>
                    <div style="flex:1;">
                        <div style="color:#e2e8f0;font-weight:700;font-size:14px;">Sync Notifications</div>
                        <div style="color:#8b949e;font-size:12px;margin-top:2px;">Not receiving alerts? Tap to sync</div>
                    </div>
                    <svg viewBox="0 0 24 24" width="16" height="16" stroke="#8b949e" stroke-width="2" fill="none">
                        <polyline points="9 18 15 12 9 6"></polyline>
                    </svg>
                </div>

                <!-- Sign Out -->
                <div onclick="sessionStorage.removeItem('lastLearnerPage'); window.location.href='logout.php';"
                     style="display:flex;align-items:center;gap:14px;
                            background:#1b1b1b;border:1px solid rgba(255,255,255,0.06);
                            border-radius:12px;padding:16px;cursor:pointer;
                            margin-top:8px;transition:background 0.2s ease;"
                     onmouseover="this.style.background='#21262d'"
                     onmouseout="this.style.background='#1b1b1b'">
                    <div style="width:40px;height:40px;border-radius:10px;
                                background:rgba(248,81,73,0.1);
                                display:flex;align-items:center;justify-content:center;flex-shrink:0;">
                        <svg viewBox="0 0 24 24" width="22" height="22" stroke="#f85149" stroke-width="2" fill="none">
                            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                            <polyline points="16 17 21 12 16 7"></polyline>
                            <line x1="21" y1="12" x2="9" y2="12"></line>
                        </svg>
                    </div>
                    <div style="flex:1;">
                        <div style="color:#f85149;font-weight:700;font-size:14px;">Sign Out</div>
                        <div style="color:#8b949e;font-size:12px;margin-top:2px;">Log out of your account</div>
                    </div>
                    <svg viewBox="0 0 24 24" width="16" height="16" stroke="#8b949e" stroke-width="2" fill="none">
                        <polyline points="9 18 15 12 9 6"></polyline>
                    </svg>
                </div>

            </div>
        </div>`;
};
document.getElementById("settingsBtn")?.addEventListener('click', function() {
    loadLearnerSettings();
    if (window.innerWidth <= 768 && sidebar.classList.contains("active")) toggleSidebar();
});

window.removeLearnerProfilePicture = function() {
    if (!confirm('Remove your profile picture?')) return;
    fetch('upload_profile.php', {
        method: 'POST',
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
        newImg.style.cssText = "width:40px;height:40px;border-radius:50%;object-fit:cover;border:3px solid #757272ff;";
        newImg.src = imageUrl;

        // Insert BEFORE the file input so input stays in DOM
        avatarWrapper.insertBefore(newImg, profileInput);
    }
};

// Shared function to revert back to initials
window.resetAvatarUI = function(initials) {
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

        fetch("upload_profile.php", { method: "POST", body: fd })
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
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
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
}
    else {
        window.setActive("<?= $currentPage ?>");
    }

    // Desktop slide-in (no backdrop)
const desktopToggle = document.getElementById('desktopMenuToggle');

if (desktopToggle) {
    desktopToggle.addEventListener('click', () => {
        // Change .add to .toggle so the hamburger can also close it
        sidebar.classList.toggle('desktop-open'); 
        sidebar.classList.remove('active'); // prevents mobile style conflict
    });

    // Optional: close with Esc key
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape' && sidebar.classList.contains('desktop-open')) {
            sidebar.classList.remove('desktop-open');
        }
    });
}
    loader.style.display = "none";
});

function toggleJoinClassForm() {
    const form = document.getElementById("joinClassForm");
    if (form) form.style.display = form.style.display === "none" ? "block" : "none";
}

// --- DYNAMIC UI COMMAND CENTER ---
window.configureHeader = function(config) {
    let { title, mode } = config;
    
    // Select our UI elements
    const mobileBottomNav = document.getElementById('mobileBottomNav');
    const titleEl = document.getElementById('headerTitle');
    const logoEl = document.getElementById('headerLogo');
    const mobileBtn = document.getElementById('mobileToggle');
    const desktopBtn = document.getElementById('desktopMenuToggle');
    const backBtn = document.getElementById('headerBackBtn');
    const rightSide = document.getElementById('headerRight');

    // Handle School Name Logic
    const schoolName = "<?= htmlspecialchars($schoolName) ?>"; 
   // Update this to include the folder path if that's what you're saving
if (!title || title === 'Home' || title === 'partials/manual.html' || title === 'learner_manual.php') {
    title = schoolName;
}
    if (titleEl) titleEl.innerText = title;

    if (mode === 'detail') {
    if (mobileBottomNav) mobileBottomNav.style.setProperty('display', 'none', 'important'); 
    if (mobileBtn) mobileBtn.style.display = 'none';             
    if (desktopBtn) desktopBtn.style.display = 'none';
    if (backBtn) backBtn.style.display = 'flex';

    if (window.innerWidth <= 768) {
        // MOBILE: Hide logo but show the title text to fill the space
        if (logoEl) logoEl.style.display = 'none';
        if (titleEl) titleEl.style.display = 'block';  // ← SHOW TEXT
        if (rightSide) rightSide.style.visibility = 'visible';
    } else {
        // DESKTOP: Immersive — hide both logo and right side
        if (logoEl) logoEl.style.display = 'none';
        if (rightSide) rightSide.style.visibility = 'hidden'; 
    }
} else {
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

if (currentTitle === 'Review') {
    if (typeof fetchGrades === 'function') {
        window.fetchGrades();
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
</script>

<div id="desktopBackdrop" class="desktop-backdrop"></div>
<div id="mobileOverlay" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.4); z-index:1500;"></div>

<nav id="mobileBottomNav">

 
      <a href="javascript:void(0)" onclick="loadManual()" data-page="partials/manual.html" id="nav-home">
        
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:20px; height:20px; margin-right:10px;">
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
    <polyline points="9 22 9 12 15 12 15 22"/>
</svg>Home
    </a>


    <a href="javascript:void(0)" onclick="fetchQuizzes()" data-page="quiz_list.php" id="nav-quiz">
       <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>Quiz
    </a>
    <a href="javascript:void(0)" onclick="fetchAssignments()" data-page="learner_assignments.php" id="nav-assignments">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 12h6"/><path d="M9 16h6"/><rect x="4" y="4" width="16" height="16" rx="2"/></svg>Assignments
    </a>
     <a href="javascript:void(0)" onclick="fetchResources()" data-page="view_resources_user.php" id="nav-resources">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>Resources
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

function toggleSidebar() { document.querySelector('.sidebar').classList.toggle('active'); }
function toggleDesktopSidebar() { document.querySelector('.sidebar').classList.toggle('collapsed'); }
</script>

<script src="assets/js/learner/main.js?v=1.0"></script>
<script src="assets/js/learner/manual.js?v=1.5"></script>
<script src="assets/js/learner/quiz.js?v=2.9"></script>
<script src="assets/js/learner/assignments.js?v=2.2"></script>
<script src="assets/js/learner/resources.js?v=2.0"></script>
<script src="assets/js/learner/announcements.js?v=1.4"></script>
<script src="assets/js/learner/grades.js?v=1.3"></script>
<script src="assets/js/learner/evaluations.js?v=1.1"></script>
<script src="assets/js/learner/discussions.js?v=2.2"></script>
<script src="assets/js/learner/syllabus.js?v=1.0"></script>
<?php include 'includes/global_viewer.php'; ?>
</body>
</html>