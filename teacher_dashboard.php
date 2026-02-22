<?php
/**
 * iSkool - Teacher Dashboard
 *
 * Main interface for logged-in teachers. Provides centralized navigation to all teacher tools,
 * including quiz creation, assignment management, announcements, learner grades, and analytics.
 * Features:
 * - Responsive sidebar with collapsible desktop mode and mobile bottom navigation
 * - Dynamic school branding (name and logo)
 * - Teacher profile display with picture upload
 * - iframe-based content loading with active state highlighting
 * - Full-screen processing loader
 * - Mobile-friendly overlay and toggle behavior
 *
 * @package     iSkool
 * @subpackage  Teacher
 * @author      mandlasimphiwe99@gmail.com
 * @copyright   2025 iSkool EdTech. All rights reserved.
 * @license     Proprietary - Unauthorized use prohibited
 * @version     1.0.0
 * @since       2025-12-14
 * @link        https://iskool.online
 */
ob_start();
error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);
ini_set('error_log', 'php_errors.log');
session_start();
include("config.php");
//──────────────────────────────────────────────────────────────────────────────
//           Security: Only logged in + correct role
//──────────────────────────────────────────────────────────────────────────────
if (!isset($_SESSION['email']) || $_SESSION['role'] !== 'teacher') {
    header("Location: index.php");
    exit();
}

$email = $_SESSION['email'];

//──────────────────────────────────────────────────────────────────────────────
//                     Fetch teacher info
//──────────────────────────────────────────────────────────────────────────────
//──────────────────────────────────────────────────────────────────────────────
//                    Fetch teacher info
//──────────────────────────────────────────────────────────────────────────────
$stmtTeacher = $conn->prepare("SELECT name, surname, profile_picture FROM users WHERE email = ?");
$stmtTeacher->bind_param("s", $email);
$stmtTeacher->execute();
$resultTeacher = $stmtTeacher->get_result();

$teacherName    = $_SESSION['name'] ?? 'Teacher';
$teacherSurname = '';
$teacherProfile = ''; // Start empty

if ($rowTeacher = $resultTeacher->fetch_assoc()) {
    $teacherName    = $rowTeacher['name'] ?: $teacherName;
    $teacherSurname = $rowTeacher['surname'] ?: '';
    $teacherProfile = $rowTeacher['profile_picture'];
}
$stmtTeacher->close();

// Generate Full Name
$teacherFullName = trim($teacherName . ' ' . $teacherSurname);
$teacherEmail    = $_SESSION['email'];

// Generate Initials (e.g., MS)
$tFirstInitial = !empty($teacherName) ? strtoupper(substr(trim($teacherName), 0, 1)) : '';
$tLastInitial  = !empty($teacherSurname) ? strtoupper(substr(trim($teacherSurname), 0, 1)) : '';
$teacherInitials = $tFirstInitial . $tLastInitial ?: '??';

//──────────────────────────────────────────────────────────────────────────────
//           Get teacher school name
//──────────────────────────────────────────────────────────────────────────────

$schoolName = 'My School'; // fallback only
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
    <link rel="stylesheet" href="assets/css/teacher/announcements.css?v=1.2">
    <title>Teacher Dashboard</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.2/css/all.min.css" crossorigin="anonymous" referrerpolicy="no-referrer" />
    <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@200;300;400;500;600&display=swap" rel="stylesheet">
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
        body { margin:0; font-family:'Nunito',sans-serif; font-weight:600; display:flex; height:100vh; background:var(--bg-color); color:var(--text-color); overflow:hidden; }
        
        /* SIDEBAR */
.sidebar {
    width: var(--sidebar-width);
    background: #1a1919ff;
    display: flex;
    flex-direction: column;
    padding: 20px;
    box-sizing: border-box;
    position: fixed;
    top: 0;
   left: -240px; /* Hide it to the left */
   visibility: hidden; /* Add this */
    opacity: 0;         /* Add this */
    height: 100vh;
    z-index: 5000;
    overflow-y: auto;
    box-shadow: 2px 0 8px rgba(0,0,0,0.2);
    transition: left var(--transition-speed) ease, width var(--transition-speed) ease;
}
.sidebar.desktop-open, .sidebar.active {
    left: 0;
    visibility: visible;
    opacity: 1;
}

/* Desktop: Round toggle button */
.sidebar-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 12px;
}
.profile-picture-wrapper {
    width: 40px; height: 40px; border-radius: 50%; overflow: hidden; border: 3px solid #757272ff; cursor: pointer;
}
.profile-picture-wrapper img { width: 100%; height: 100%; object-fit: cover; }
.round-toggle {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: #000000; /* ⬅️ BLACK BACKGROUND */
    border: 2px solid #333; /* subtle ring so it stands out */
    color: #e2e8f0;
    font-size: 18px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.3s ease;
}
.round-toggle:hover { background: #111111; }

/* HIDE CHEVRON BUTTON ON MOBILE */
@media (max-width: 768px) {
    .round-toggle { display: none !important; }
}


.teacher-name { margin-top: 8px; font-size: 18px; color: #fff; }
.teacher-email { font-size: 12px; color: #aaa; margin-top: 4px; }

/* UPDATED SIDEBAR LINKS */
.sidebar a, .sidebar .footer {
    color: var(--text-color);
    text-decoration: none;
    padding: 5px 12px;      /* slightly smaller vertical padding */
    margin-bottom: 0px;     /* closer spacing between links */
    border-radius: var(--card-radius);
    display: flex;
    align-items: center;
    transition: all 0.2s ease;
    white-space: nowrap;
    overflow: hidden;
    font-weight: 200;
}
/* --- Add this right before your first @media line --- */
.sidebar-footer {
    display: none; /* This keeps it hidden on computers */
    text-align: center;
    padding: 20px 0;
    margin-top: auto; /* This pins it to the bottom */
    border-top: 1px solid rgba(255, 255, 255, 0.05);
}

.sidebar-footer span {
    font-size: 13px;
    color: #777;
    letter-spacing: 1px;
}
.sidebar a:hover { background: rgba(79,209,197,0.08); transform: translateX(3px); }
.sidebar a.active { background: rgba(79,209,197,0.2); border-left: 4px solid var(--accent-color); }
.sidebar a i { font-size: 16px; margin-right: 10px; }  /* smaller icon and closer to text */
.sidebar .footer { position: absolute; bottom: 15px; width: calc(100% - 40px); font-size: 12px; opacity: 0.7; text-align: center; }

        /* Main Content */
        .main-content {
            flex: 1;
           margin-left: 0;
            transition: margin-left var(--transition-speed) ease;
            display: flex;
            flex-direction: column;
        }

        .main-header {
            padding: 12px 18px;
            border-bottom: 1px solid rgba(255,255,255,0.1);
            background: linear-gradient(180deg, rgba(26,32,44,0.9), var(--bg-color));
            display: flex;
            justify-content: space-between;
            align-items: center;
            z-index: 1000;
        }
        .logo-container { display: flex; align-items: center; gap: 12px; }
        .school-name { font-size: 18px; font-weight: 500; display: none; }
        #mobileToggle { 
            display: none; 
            background: none; 
            border: none; 
            color: #e2e8f0; 
            font-size: 26px; 
            cursor: pointer; 
            padding: 8px;
        }
        #settingsBtn { background: none; border: none; color: #e2e8f0; font-size: 20px; cursor: pointer; }

        iframe { border: none; width: 100%; flex: 1; background: #1a202c; }

        /* MOBILE OVERLAY */
        #mobileOverlay {
            position: fixed;
            top: 0; left: 0;
            width: 100vw;
            height: 100vh;
            background: rgba(0, 0, 0, 0.55);
            backdrop-filter: blur(6px);
            opacity: 0;
            pointer-events: none;
            z-index: 4999;
            transition: opacity var(--transition-speed) ease;
        }
        .sidebar.active ~ #mobileOverlay {
            opacity: 1;
            pointer-events: all;
        }

        /* Loader */
        #loaderOverlay {
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0,0,0,0.7); backdrop-filter: blur(5px);
            display: none; flex-direction: column; justify-content: center; align-items: center;
            z-index: 9999; color: white; font-size: 18px;
        }
        .loader {
            border: 6px solid #e2e8f0; border-top: 6px solid var(--accent-color);
            border-radius: 50%; width: 60px; height: 60px; animation: spin 1s linear infinite; margin-top: 20px;
        }
        @keyframes spin { to { transform: rotate(360deg); } }

                     /* Mobile Bottom Navigation */
        #mobileBottomNav {
            display: none;
            position: fixed;
            bottom: 0;
            left: 0;
            width: 100%;
            height: 70px; /* taller base height for better visibility and comfort */
            background: rgba(66, 65, 65, 0.35);
            backdrop-filter: blur(20px);
            -webkit-backdrop-filter: blur(20px);
            border-top: 1px solid rgba(255, 255, 255, 0.1);
            box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.3);
            z-index: 4000;
            justify-content: space-around;
            align-items: flex-start;
            box-sizing: border-box;
            transition: padding-bottom 0.3s ease, height 0.3s ease;
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
            justify-content: flex-start; /* align content to the top */
            padding-top: 5px; /* pushes icons and text higher inside the taller bar */
            transition: all 0.2s;
        }

        #mobileBottomNav a i {
            font-size: 20px;
            margin-bottom: 4px;
        }

        #mobileBottomNav a.active,
        #mobileBottomNav a:hover {
            color: var(--accent-color);
            transform: translateY(-3px);
        }

        /* MOBILE LAYOUT */
        @media (max-width: 768px) {
            #mobileToggle { display: block; }
            .school-name { display: none !important; }
            .sidebar-footer {
        display: block !important; /* This "wakes it up" on mobile */
    }
            
            .sidebar { left: -100%; width: 300px; /* ⬅️ INCREASE THIS VALUE (e.g., 280px or 300px) */ }
            .sidebar.active { left: 0; width: 300px; }
            
            .main-content { margin-left: 0 !important; }
            .sidebar.active ~ .main-content { transform: translateX(300px); filter: blur(3px); }
            .sidebar.active ~ #mobileBottomNav { filter: blur(5px); pointer-events: none; }
            
            iframe { height: calc(100vh - 120px) !important; }
            #mobileBottomNav { display: flex !important; }

            /* Safe area support - now based on 80px base height */
            #mobileBottomNav {
                padding-bottom: env(safe-area-inset-bottom);
                padding-bottom: constant(safe-area-inset-bottom); /* older iOS fallback */
                height: calc(70px + env(safe-area-inset-bottom));
                height: calc(70px + constant(safe-area-inset-bottom));
            }

            .sidebar a.desktop-only { display: none; }
        }

        @media (min-width: 769px) {
            .school-name { display: inline; }
        }

        .drawer-icon svg {
            transition: transform 0.3s ease;
            display: block;
        }

        @media (max-width: 480px) {
            .sidebar {
        width: 80% !important; /* Covers most of the screen */
    }
    .sidebar.active ~ .main-content { 
        transform: translateX(80vw) !important; 
    }
            .sidebar-footer span {
        font-size: 16px !important; /* Increased from 13px */
        color: #bbbbbb;            /* Lighter color for better contrast */
        font-weight: 700;
    }

        .sidebar-footer {
        margin-bottom: 30px !important; /* Space so it doesn't hit the bottom edge */
    }
    /* 1. INCREASE PROFILE PICTURE SIZE */
    .profile-picture-wrapper {
        width: 70px !important;   /* Was 40px */
        height: 70px !important;  /* Was 40px */
        border-width: 4px !important;
        margin-bottom: 10px;
    }

    /* 2. TEXT SIZES FOR THE DRAWER */
    .teacher-name { 
        font-size: 24px !important; 
        font-weight: 800 !important;
        margin-top: 5px;
    }
    
    .teacher-email { 
        font-size: 14px !important; 
        margin-bottom: 20px; 
        opacity: 0.8;
    }

    /* 3. BUTTON SPACING & FONT SIZE (Touch Targets) */
    .sidebar a, .sidebar .logout {
        font-size: 17px !important;   /* Larger text for readability */
        font-weight: 700 !important;
        padding: 16px 15px !important; /* Taller buttons for easy tapping */
        margin-bottom: 8px !important; /* Gap between buttons */
        background: rgba(255, 255, 255, 0.03); /* Slight visibility for the button area */
    }

    .sidebar a i {
        font-size: 20px !important;   /* Match icon scale to text */
        margin-right: 15px !important;
    }

    /* 4. DRAWER HEADER ADJUSTMENT */
    .sidebar-header {
        flex-direction: column;
        align-items: flex-start;
        margin-bottom: 25px;
    }

    /* 5. SIDEBAR LINKS CONTAINER */
    /* Adds a little breathing room at the top of the list */
    .sidebar-links {
        margin-top: 20px;
    }
}
.initials-avatar {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: #2d2d2d; 
    color: #a0a0a0;            
    font-size: 16px; 
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: -1px;
}
/* Adjust font size for the larger mobile profile view */
@media (max-width: 480px) {
    .initials-avatar { font-size: 24px; }
}

/* Styling the new Desktop Button */
.desktop-only-btn {
    display: none; /* Hidden by default (Mobile) */
    background: #000000;
    border: 1px solid #333;
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

.desktop-only-btn:hover {
    background: #111;
    transform: scale(1.05);
}

/* Show it only on Desktop */
@media (min-width: 769px) {
    .desktop-only-btn {
        display: flex; /* Appears on screens wider than 768px */
    }
}
    </style>
</head>
<body>
<?php $currentPage = basename($_SERVER['PHP_SELF']); ?>

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
    <a href="teacher_manual.php" target="mainFrame" class="<?= $currentPage==='teacher_manual.php'?'active':'' ?>">
        <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" style="margin-right:10px;"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
        <span>Home</span>
    </a>

    <a href="create_quiz.php" target="mainFrame" class="desktop-only <?= $currentPage==='create_quiz.php'?'active':'' ?>">
        <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" style="margin-right:10px;"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="16"></line><line x1="8" y1="12" x2="16" y2="12"></line></svg>
        <span>Create Quiz</span>
    </a>

    <a href="teacher_quizzes.php" target="mainFrame" class="<?= $currentPage==='teacher_quizzes.php'?'active':'' ?>">
        <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" style="margin-right:10px;"><path d="M9 11l3 3L22 4"></path><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path></svg>
        <span>View Quizzes</span>
    </a>

    <a href="create_assignment.php" target="mainFrame" class="desktop-only <?= $currentPage==='create_assignment.php'?'active':'' ?>">
        <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" style="margin-right:10px;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="12" y1="18" x2="12" y2="12"></line><line x1="9" y1="15" x2="15" y2="15"></line></svg>
        <span>Create Assignment</span>
    </a>

    <a href="teacher_assignments.php" target="mainFrame" class="<?= $currentPage==='teacher_assignments.php'?'active':'' ?>">
        <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" style="margin-right:10px;"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
        <span>Assignments</span>
    </a>

    <a href="create_announcement.php" target="mainFrame" class="desktop-only <?= $currentPage==='create_announcement.php'?'active':'' ?>">
        <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" style="margin-right:10px;"><path d="M11 5L6 9H2v6h4l5 4V5z"></path><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>
        <span>Create Announcement</span>
    </a>

   <a href="javascript:void(0)" data-page="teacher_announcements" onclick="fetchTeacherAnnouncements()">
        <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" style="margin-right:10px;"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>
        <span>Announcements</span>
    </a>

    <a href="learner_grades.php" target="mainFrame" class="<?= $currentPage==='learner_grades.php'?'active':'' ?>">
        <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" style="margin-right:10px;"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="8.5" cy="7" r="4"></circle><polyline points="17 11 19 13 23 9"></polyline></svg>
        <span>Learner Grades</span>
    </a>

    <a href="upload_resource.php" target="mainFrame" class="desktop-only <?= $currentPage==='upload_resource.php'?'active':'' ?>">
        <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" style="margin-right:10px;"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>
        <span>Upload Resource</span>
    </a>

    <a href="create_evaluation.php" target="mainFrame" class="desktop-only <?= $currentPage==='create_evaluation.php'?'active':'' ?>">
        <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" style="margin-right:10px;"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path><rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect><path d="M9 14l2 2 4-4"></path></svg>
        <span>Release Evaluation</span>
    </a>

    <a href="view_evaluation_results.php" target="mainFrame" class="desktop-only <?= $currentPage==='view_evaluation_results.php'?'active':'' ?>">
        <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" style="margin-right:10px;"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>
        <span>Evaluations</span>
    </a>

    <a href="teacher_discussions.php" target="mainFrame" class="<?= $currentPage==='teacher_discussions.php'?'active':'' ?>">
        <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" style="margin-right:10px;"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
        <span>Discussions</span>
    </a>

    <a href="teacher_analytics.php" target="mainFrame">
        <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" style="margin-right:10px;"><path d="M21.21 15.89A10 10 0 1 1 8 2.83"></path><path d="M22 12A10 10 0 0 0 12 2v10z"></path></svg>
        <span>Analytics</span>
    </a>
</div>
   

    <div class="sidebar-footer">
    <span>iSkool v.1.0.0</span>
</div>
</div>

<div id="mobileOverlay"></div>

<div class="main-content">
    <div class="main-header">
        
<button id="mobileToggle" onclick="toggleSidebar()">
    <svg viewBox="0 0 24 24" width="28" height="28" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round">
        <line x1="3" y1="12" x2="21" y2="12"></line>
        <line x1="3" y1="6" x2="21" y2="6"></line>
        <line x1="3" y1="18" x2="21" y2="18"></line>
    </svg>
</button>

<button id="desktopMenuToggle" class="desktop-only-btn">
    <svg viewBox="0 0 24 24" width="22" height="22" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round">
        <line x1="3" y1="12" x2="21" y2="12"></line>
        <line x1="3" y1="6" x2="21" y2="6"></line>
        <line x1="3" y1="18" x2="21" y2="18"></line>
    </svg>
</button>
        
        <div class="logo-container">
            <img src="<?= htmlspecialchars($schoolLogo) ?>" alt="School Logo" style="width:40px;height:40px;border-radius:8px;object-fit:cover;border:3px solid #757272ff;">
            <span class="school-name"><?= htmlspecialchars($schoolName) ?></span>
        </div>
        <button id="settingsBtn">
    <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="3"></circle>
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
    </svg>
</button>
    </div>
   <div id="api-content-area" style="display:none;"></div>
<iframe id="mainFrame" name="mainFrame" src="about:blank" style="display:none;"></iframe>
</div>

<div id="loaderOverlay">
    <div>Processing...</div>
    <div class="loader"></div>
</div>

<nav id="mobileBottomNav">
    <a href="create_quiz.php" target="mainFrame" class="<?= $currentPage==='create_quiz.php'?'active':'' ?>">
        <svg viewBox="0 0 24 24" width="22" height="22" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom:4px;"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="16"></line><line x1="8" y1="12" x2="16" y2="12"></line></svg>
        <span>Quiz</span>
    </a>

    <a href="create_assignment.php" target="mainFrame" class="<?= $currentPage==='create_assignment.php'?'active':'' ?>">
        <svg viewBox="0 0 24 24" width="22" height="22" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom:4px;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="12" y1="18" x2="12" y2="12"></line><line x1="9" y1="15" x2="15" y2="15"></line></svg>
        <span>Assignments</span>
    </a>

    <a href="upload_resource.php" target="mainFrame" class="<?= $currentPage==='upload_resource.php'?'active':'' ?>">
        <svg viewBox="0 0 24 24" width="22" height="22" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom:4px;"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>
        <span>Resources</span>
    </a>

    <a href="create_announcement.php" target="mainFrame" class="<?= $currentPage==='create_announcement.php'?'active':'' ?>">
        <svg viewBox="0 0 24 24" width="22" height="22" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom:4px;"><path d="M11 5L6 9H2v6h4l5 4V5z"></path><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>
        <span>Announcement</span>
    </a>
</nav>

<script src="assets/js/teacher/dashboard.js?v=1.1"></script>
<script src="assets/js/teacher/announcements.js?v=1.2"></script>
</body>
</html>