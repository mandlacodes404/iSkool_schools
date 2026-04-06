<?php
ob_start();
error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);
ini_set('error_log', 'php_errors.log');
session_start();
include("config.php");

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

$tFirstInitial   = !empty($teacherName)    ? strtoupper(substr(trim($teacherName), 0, 1))    : '';
$tLastInitial    = !empty($teacherSurname) ? strtoupper(substr(trim($teacherSurname), 0, 1)) : '';
$teacherInitials = $tFirstInitial . $tLastInitial ?: '??';

$schoolName = 'My School';
$result = $conn->query("SELECT setting_value FROM school_name WHERE setting_key = 'school_name' LIMIT 1");
if ($row = $result->fetch_assoc()) {
    $schoolName = $row['setting_value'];
}
$schoolLogo = 'uploads/schools/default_school.png';
?>
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <link rel="icon" type="image/svg+xml" href="/icon.svg?v=1.2">
    <link rel="stylesheet" href="assets/css/teacher/announcements.css?v=3.6">
    <title>Teacher Dashboard</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.2/css/all.min.css" crossorigin="anonymous" referrerpolicy="no-referrer" />
    <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@200;300;400;500;600&display=swap" rel="stylesheet">
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <style>
        :root {
            --bg-color: #0d1117;
            --text-color: #e2e8f0;
            --accent-color765: #4fd1c5;
            --card-radius: 16px;
            --sidebar-width: 240px;
            --sidebar-collapsed-width: 80px;
            --transition-speed: 0.3s;
        }

        body {
            margin: 0;
            font-family: 'Nunito', sans-serif;
            font-weight: 600;
            display: flex;
            height: 100vh;
            background: var(--bg-color);
            color: var(--text-color);
            overflow: hidden;
        }

        /* ── SIDEBAR ── */
        .sidebar {
            width: var(--sidebar-width);
            background: #1a1919ff;
            display: flex;
            flex-direction: column;
            padding: 20px;
            box-sizing: border-box;
            position: fixed;
            top: 0;
            left: -240px;
            visibility: hidden;
            opacity: 0;
            height: 100vh;
            z-index: 5000;
            overflow-y: auto;
            box-shadow: 2px 0 8px rgba(0,0,0,0.2);
            transition: left var(--transition-speed) ease, width var(--transition-speed) ease,
                        visibility var(--transition-speed), opacity var(--transition-speed);
        }
        .sidebar.desktop-open,
        .sidebar.active {
            left: 0;
            visibility: visible;
            opacity: 1;
        }

        .sidebar-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 12px;
        }
        .profile-picture-wrapper {
            width: 40px; height: 40px; border-radius: 50%;
            overflow: hidden; border: 3px solid #757272ff; cursor: pointer;
        }
        .profile-picture-wrapper img { width: 100%; height: 100%; object-fit: cover; }

        .round-toggle {
            width: 40px; height: 40px; border-radius: 50%;
            background: #000; border: 2px solid #333; color: #e2e8f0;
            font-size: 18px; cursor: pointer;
            display: flex; align-items: center; justify-content: center;
            transition: all 0.3s ease;
        }
        .round-toggle:hover { background: #111; }

        @media (max-width: 768px) {
            .round-toggle { display: none !important; }
        }

        .teacher-name  { margin-top: 8px; font-size: 18px; color: #fff; }
        .teacher-email { font-size: 12px; color: #aaa; margin-top: 4px; }

        .sidebar a, .sidebar .footer {
            color: #b2b5b9;
            text-decoration: none;
            padding: 7px 12px;
            margin-bottom: 0px;
            border-radius: var(--card-radius);
            display: flex;
            align-items: center;
            transition: all 0.2s ease;
            white-space: nowrap;
            overflow: hidden;
            font-weight: 100;
        }
        .sidebar-footer {
            position: absolute;
            bottom: 10px;
            width: calc(100% - 40px);
            text-align: left;
            padding: 0;
            border-top: none;
        }
        .sidebar-footer span { font-size: 15px; font-weight: 700; color: #777; }
        .sidebar a:hover { background: rgba(79,209,197,0.08); transform: translateX(3px); }
        .sidebar a.active { background: rgba(79,209,197,0.2); border-left: 4px solid var(--accent-color); }
        .sidebar a i { font-size: 16px; margin-right: 10px; }
        .sidebar .footer { position: absolute; bottom: 15px; width: calc(100% - 40px); font-size: 12px; opacity: 0.7; text-align: center; }

        /* ── MAIN CONTENT ── */
        .main-content {
            flex: 1;
            margin-left: 0;
            transition: margin-left var(--transition-speed) ease;
            display: flex;
            flex-direction: column;
            overflow: hidden;
        }

        /* ── TOP NAV WRAPPER (not fixed, scrolls with content) ── */
        .top-nav-wrapper {
            background: #161b22;
            border-bottom: 1px solid #30363d;
            flex-shrink: 0;
        }

        /* ── ROW 1: brand bar ── */
        .top-nav-row1 {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 12px 20px;
            gap: 12px;
        }

        .top-nav-left {
            display: flex;
            align-items: center;
            gap: 12px;
        }

        /* Hamburger — desktop only */
        #desktopMenuToggle {
            display: none;
            background: #21262d;
            border: 1px solid #30363d;
            color: #e2e8f0;
            width: 36px; height: 36px;
            border-radius: 8px;
            cursor: pointer;
            align-items: center;
            justify-content: center;
            transition: all 0.2s ease;
            flex-shrink: 0;
        }
        #desktopMenuToggle:hover { background: #30363d; }

        /* Mobile hamburger */
        #mobileToggle {
            display: none;
            background: none;
            border: none;
            color: #e2e8f0;
            font-size: 26px;
            cursor: pointer;
            padding: 4px;
        }

        .top-nav-brand {
            display: flex;
            align-items: center;
            gap: 10px;
            flex: 1;
            justify-content: center;
        }
        .top-nav-brand img {
            width: 36px; height: 36px;
            border-radius: 8px;
            object-fit: cover;
            border: 2px solid #30363d;
        }
        .top-nav-school-name {
            font-size: 16px;
            font-weight: 700;
            color: #e2e8f0;
        }

        /* Avatar button — top right */
        .top-nav-avatar-btn {
            position: relative;
            flex-shrink: 0;
        }
        .top-nav-avatar {
            width: 36px; height: 36px;
            border-radius: 50%;
            border: 2px solid #30363d;
            cursor: pointer;
            overflow: hidden;
            display: flex; align-items: center; justify-content: center;
            background: #21262d;
            transition: border-color 0.2s ease;
        }
        .top-nav-avatar:hover { border-color: #4fd1c5; }
        .top-nav-avatar img { width: 100%; height: 100%; object-fit: cover; }
        .top-nav-avatar .initials-sm {
            font-size: 13px; font-weight: 800;
            color: #8b949e; text-transform: uppercase;
        }

        /* Avatar dropdown */
        .avatar-dropdown {
            display: none;
            position: absolute;
            top: calc(100% + 8px);
            right: 0;
            background: #161b22;
            border: 1px solid #30363d;
            border-radius: 10px;
            min-width: 200px;
            box-shadow: 0 8px 24px rgba(0,0,0,0.5);
            z-index: 6000;
            overflow: hidden;
        }
        .avatar-dropdown.open { display: block; }

        .avatar-dropdown-header {
            padding: 12px 16px;
            border-bottom: 1px solid #21262d;
        }
        .avatar-dropdown-name {
            font-size: 14px; font-weight: 800; color: #e2e8f0;
        }
        .avatar-dropdown-email {
            font-size: 12px; color: #8b949e; margin-top: 2px;
        }
        .avatar-dropdown-item {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 10px 16px;
            font-size: 13px;
            font-weight: 600;
            color: #c9d1d9;
            cursor: pointer;
            transition: background 0.15s;
            border: none;
            background: none;
            width: 100%;
            text-align: left;
            font-family: 'Nunito', sans-serif;
        }
        .avatar-dropdown-item:hover { background: #21262d; color: #e2e8f0; }
        .avatar-dropdown-item.danger { color: #f85149; }
        .avatar-dropdown-item.danger:hover { background: rgba(248,81,73,0.08); }

        /* Hidden file input for avatar upload */
        #topNavProfileInput { display: none; }

        /* ── ROW 2: tab bar (desktop only) ── */
        .top-nav-row2 {
            display: none; /* hidden on mobile */
            align-items: center;
            padding: 0 20px;
            gap: 0;
            overflow-x: auto;
            scrollbar-width: none;
        }
        .top-nav-row2::-webkit-scrollbar { display: none; }

        .top-nav-tab {
            display: flex;
            align-items: center;
            gap: 7px;
            padding: 10px 14px;
            font-size: 13px;
            font-weight: 700;
            color: #8b949e;
            cursor: pointer;
            border: none;
            background: none;
            font-family: 'Nunito', sans-serif;
            border-bottom: 2px solid transparent;
            margin-bottom: -1px; /* sits on the border */
            white-space: nowrap;
            transition: color 0.2s ease, border-color 0.2s ease;
            text-decoration: none;
        }
        .top-nav-tab:hover {
            color: #e2e8f0;
            border-bottom-color: #30363d;
        }
        .top-nav-tab.active {
            color: #e2e8f0;
            border-bottom-color: #f97316; /* orange underline — iSkool accent, GitHub-style */
        }
        .top-nav-tab svg {
            flex-shrink: 0;
        }

        /* Show row 2 on desktop */
        @media (min-width: 769px) {
            .top-nav-row2   { display: flex; }
            #desktopMenuToggle { display: flex; }
            #mobileToggle   { display: none; }
            .top-nav-school-name { display: inline; }
        }

        /* ── CONTENT AREA ── */
        #api-content-area {
            flex: 1;
            overflow-y: auto;
        }
        iframe {
            border: none;
            width: 100%;
            flex: 1;
            background: #1a202c;
        }

        /* ── MOBILE OVERLAY ── */
        #mobileOverlay {
            position: fixed;
            top: 0; left: 0;
            width: 100vw; height: 100vh;
            background: rgba(0,0,0,0.55);
            backdrop-filter: blur(6px);
            opacity: 0;
            pointer-events: none;
            z-index: 4999;
            transition: opacity var(--transition-speed) ease;
        }
        .sidebar.active ~ #mobileOverlay,
        .sidebar.desktop-open ~ #mobileOverlay {
            opacity: 1;
            pointer-events: all;
        }

        /* ── LOADER ── */
        #loaderOverlay {
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0,0,0,0.7); backdrop-filter: blur(5px);
            display: none; flex-direction: column;
            justify-content: center; align-items: center;
            z-index: 9999; color: white; font-size: 18px;
        }
        .loader {
            border: 6px solid #e2e8f0;
            border-top: 6px solid var(--accent-color);
            border-radius: 50%; width: 60px; height: 60px;
            animation: spin 1s linear infinite; margin-top: 20px;
        }
        @keyframes spin { to { transform: rotate(360deg); } }

        /* ── MOBILE BOTTOM NAV ── */
        #mobileBottomNav {
            display: none;
            position: fixed;
            bottom: 0; left: 0;
            width: 100%;
            height: 70px;
            background: rgba(66,65,65,0.35);
            backdrop-filter: blur(20px);
            -webkit-backdrop-filter: blur(20px);
            border-top: 1px solid rgba(255,255,255,0.1);
            box-shadow: 0 -4px 20px rgba(0,0,0,0.3);
            z-index: 4000;
            justify-content: space-around;
            align-items: flex-start;
            box-sizing: border-box;
        }
        #mobileBottomNav a {
            color: var(--text-color);
            text-decoration: none;
            font-size: 11px;
            text-align: center;
            flex: 1;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: flex-start;
            padding-top: 5px;
            transition: all 0.2s;
        }
        #mobileBottomNav a i { font-size: 20px; margin-bottom: 4px; }
        #mobileBottomNav a.active,
        #mobileBottomNav a:hover { color: var(--accent-color); transform: translateY(-3px); }

        /* ── MOBILE LAYOUT ── */
        @media (max-width: 768px) {
            #mobileToggle { display: block; }
            .top-nav-school-name { display: none; }
            .sidebar-footer { width: calc(100% - 40px); }
            .sidebar { left: -100%; width: 300px; }
            .sidebar.active { left: 0; width: 300px; }
            .main-content { margin-left: 0 !important; }
            .sidebar.active ~ .main-content { transform: translateX(300px); filter: blur(3px); }
            .sidebar.active ~ #mobileBottomNav { filter: blur(5px); pointer-events: none; }
            iframe { height: calc(100vh - 120px) !important; }
            #mobileBottomNav { display: flex !important; }
            #mobileBottomNav {
                padding-bottom: env(safe-area-inset-bottom);
                height: calc(70px + env(safe-area-inset-bottom));
            }
            .sidebar a.desktop-only { display: none; }
        }

        @media (max-width: 480px) {
            .sidebar { width: 80% !important; }
            .sidebar.active ~ .main-content { transform: translateX(80vw) !important; }
            .sidebar-footer span { font-size: 16px !important; color: #bbb; font-weight: 700; }
            .sidebar-footer { margin-bottom: 30px !important; }
            .profile-picture-wrapper { width: 70px !important; height: 70px !important; border-width: 4px !important; }
            .teacher-name  { font-size: 24px !important; font-weight: 800 !important; }
            .teacher-email { font-size: 14px !important; margin-bottom: 20px; }
            .sidebar a { font-size: 17px !important; font-weight: 700 !important; padding: 16px 15px !important; margin-bottom: 8px !important; }
            .sidebar a i { font-size: 20px !important; margin-right: 15px !important; }
            .sidebar-header { flex-direction: column; align-items: flex-start; margin-bottom: 25px; }
            .sidebar-links { margin-top: 20px; }
        }

        .initials-avatar {
            width: 100%; height: 100%;
            display: flex; align-items: center; justify-content: center;
            background-color: #2d2d2d; color: #a0a0a0;
            font-size: 16px; font-weight: 800;
            text-transform: uppercase; letter-spacing: -1px;
        }
        @media (max-width: 480px) { .initials-avatar { font-size: 24px; } }

        .drawer-icon svg { transition: transform 0.3s ease; display: block; }
    </style>
</head>
<body>
<?php $currentPage = basename($_SERVER['PHP_SELF']); ?>

<!-- ═══════════════════════════════════════════
     SIDEBAR
═══════════════════════════════════════════ -->
<div class="sidebar">
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
    <div class="teacher-email"><?= htmlspecialchars($teacherEmail) ?></div>

    <div class="sidebar-links" style="margin-top:20px;">
        <!-- Home -->
        <a href="javascript:void(0)" data-page="teacher_manual" onclick="loadTeacherManual()">
            <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" style="margin-right:10px;">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                <polyline points="9 22 9 12 15 12 15 22"></polyline>
            </svg>
            <span>Home</span>
        </a>

        <!-- Quizzes -->
        <a href="javascript:void(0)" data-page="teacher_quizzes" onclick="fetchTeacherQuizzes()">
            <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" style="margin-right:10px;">
                <line x1="18" y1="20" x2="18" y2="10"></line>
                <line x1="12" y1="20" x2="12" y2="4"></line>
                <line x1="6"  y1="20" x2="6"  y2="14"></line>
            </svg>
            <span>Quizzes</span>
        </a>

        <!-- Assignments -->
        <a href="javascript:void(0)" data-page="teacher_assignments" onclick="fetchTeacherAssignments()">
            <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" style="margin-right:10px;">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="16" y1="13" x2="8" y2="13"></line>
                <line x1="16" y1="17" x2="8" y2="17"></line>
            </svg>
            <span>Assignments</span>
        </a>

        <!-- Announcements -->
        <a href="javascript:void(0)" data-page="teacher_announcements" onclick="fetchTeacherAnnouncements()">
            <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" style="margin-right:10px;">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
            </svg>
            <span>Announcements</span>
        </a>

        <!-- Grades -->
        <a href="javascript:void(0)" data-page="teacher_grades" onclick="fetchTeacherGrades()">
            <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" style="margin-right:10px;">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="16" y1="13" x2="8" y2="13"></line>
                <line x1="16" y1="17" x2="8" y2="17"></line>
            </svg>
            <span>Grades</span>
        </a>

        <!-- Resources -->
        <a href="javascript:void(0)" data-page="teacher_resources" class="desktop-only" onclick="fetchTeacherResources()">
            <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" style="margin-right:10px;">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
            </svg>
            <span>Upload Resource</span>
        </a>

        <!-- Discussions -->
        <a href="javascript:void(0)" data-page="teacher_discussions" onclick="fetchTeacherDiscussions()">
            <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" style="margin-right:10px;">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
            </svg>
            <span>Discussions</span>
        </a>
    </div>

    <div class="sidebar-footer">
        <span>iSkool v.1.0.0</span>
    </div>
</div>

<div id="mobileOverlay"></div>

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
                <button id="mobileToggle" onclick="toggleSidebar()">
                    <svg viewBox="0 0 24 24" width="26" height="26" stroke="currentColor"
                         stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round">
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
            </div>

            <!-- Centre: logo + school name -->
            <div class="top-nav-brand">
                <img src="<?= htmlspecialchars($schoolLogo) ?>" alt="School Logo">
                <span class="top-nav-school-name"><?= htmlspecialchars($schoolName) ?></span>
            </div>

            <!-- Right: avatar + dropdown -->
         <!-- Search + Avatar -->
<div style="display:flex;align-items:center;gap:10px;flex-shrink:0;">

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
</div>

<!-- Loader -->
<div id="loaderOverlay">
    <div>Processing...</div>
    <div class="loader"></div>
</div>

<!-- Mobile Bottom Nav — UNCHANGED -->
<nav id="mobileBottomNav">
     <a href="javascript:void(0)" data-page="teacher_quizzes" onclick="fetchTeacherQuizzes()">
        <svg viewBox="0 0 24 24" width="22" height="22" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom:4px;">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="16"></line>
            <line x1="8"  y1="12" x2="16" y2="12"></line>
        </svg>
        <span>Quiz</span>
    </a>
    <a href="javascript:void(0)" data-page="teacher_assignments" onclick="fetchTeacherAssignments()">
        <svg viewBox="0 0 24 24" width="22" height="22" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom:4px;">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
            <line x1="12" y1="18" x2="12" y2="12"></line>
            <line x1="9"  y1="15" x2="15" y2="15"></line>
        </svg>
        <span>Assignments</span>
    </a>
    <a href="javascript:void(0)" data-page="teacher_resources" onclick="fetchTeacherResources()">
        <svg viewBox="0 0 24 24" width="22" height="22" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom:4px;">
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
        </svg>
        <span>Resources</span>
    </a>
    <a href="javascript:void(0)" data-page="teacher_announcements" onclick="fetchTeacherAnnouncements()">
        <svg viewBox="0 0 24 24" width="22" height="22" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom:4px;">
            <path d="M11 5L6 9H2v6h4l5 4V5z"></path>
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
        </svg>
        <span>Announcement</span>
    </a>
</nav>

<!-- ── INLINE SCRIPTS ── -->
<script>
// ── TOP NAV TAB ACTIVE STATE ──
window.setTopNavTab = function(tabId) {
    document.querySelectorAll('.top-nav-tab').forEach(t => t.classList.remove('active'));
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

    fetch('upload_teacher_profile.php', { method: 'POST', body: fd })
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

window.toggleSidebar = function() {
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.getElementById('mobileOverlay');
    
    if (sidebar.classList.contains('active')) {
        sidebar.classList.remove('active');
        if (overlay) overlay.style.opacity = '0';
        if (overlay) overlay.style.pointerEvents = 'none';
    } else {
        sidebar.classList.add('active');
        if (overlay) overlay.style.opacity = '1';
        if (overlay) overlay.style.pointerEvents = 'all';
    }
};
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
        : `<span style="font-size:32px;font-weight:800;color:#8b949e;text-transform:uppercase;">${initialsEl ? initialsEl.textContent.trim() : '??'}</span>`;

    apiArea.innerHTML = `
        <div style="padding:20px;">

            <!-- CIRCULAR PROFILE -->
            <div style="display:flex;flex-direction:column;align-items:center;margin-bottom:28px;">
                <div onclick="triggerTopNavUpload()"
                     style="position:relative;width:100px;height:100px;border-radius:50%;
                            background:#1b1b1b;border:3px solid #30363d;
                            overflow:hidden;cursor:pointer;flex-shrink:0;
                            transition:border-color 0.2s ease;"
                     onmouseover="this.style.borderColor='#4fd1c5'; this.querySelector('.cam-overlay').style.opacity='1';"
                     onmouseout="this.style.borderColor='#30363d'; this.querySelector('.cam-overlay').style.opacity='0';">

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
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
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
        { label: 'Discussions',    keywords: ['discuss','discussions'],  action: () => { fetchTeacherDiscussions(); } },
        { label: 'Evaluations',    keywords: ['eval','evaluations'],     action: () => { fetchTeacherEvaluations(); setTopNavTab('tab-evaluations'); } },
        { label: 'Analytics',      keywords: ['analyt','analytics'],     action: () => { fetchTeacherAnalytics(); setTopNavTab('tab-analytics'); } },
        { label: 'Settings',       keywords: ['setting','settings'],     action: () => { loadTeacherSettings(); setTopNavTab('tab-settings'); } },
        { label: 'Syllabus',       keywords: ['syllab','syllabus'],      action: () => { openSBODrawer(); setTopNavTab('tab-syllabus'); } },
        { label: 'Calendar',       keywords: ['calendar','remind'],      action: () => { loadTeacherManual(); setTopNavTab('tab-calendar'); } },
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

<script src="assets/js/teacher/dashboard.js?v=4.4"></script>
<script src="assets/js/teacher/quizzes.js?v=1.7"></script>
<script src="assets/js/teacher/announcements.js?v=1.6"></script>
<script src="assets/js/teacher/evaluations.js?v=1.4"></script>
<script src="assets/js/teacher/resources.js?v=1.2"></script>
<script src="assets/js/teacher/grades.js?v=1.1"></script>
<script src="assets/js/teacher/assignments.js?v=1.0"></script>
<script src="assets/js/teacher/discussions.js?v=1.0"></script>
<script src="assets/js/teacher/sbo.js?v=1.1"></script>
<script src="assets/js/teacher/analytics.js?v=1.1"></script>
<script src="assets/js/teacher/teacher_calendar.js?v=1.1"></script>
</body>
</html>