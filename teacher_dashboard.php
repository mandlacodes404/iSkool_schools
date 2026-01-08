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
$stmtTeacher = $conn->prepare("SELECT name, surname, profile_picture FROM users WHERE email = ?");
$stmtTeacher->bind_param("s", $email);
$stmtTeacher->execute();
$resultTeacher = $stmtTeacher->get_result();

$teacherName     = $_SESSION['name'] ?? 'Teacher';
$teacherSurname  = '';
$teacherFullName = $teacherName; // fallback
$teacherProfile  = 'default.png';
$teacherEmail    = $_SESSION['email'];

if ($resultTeacher->num_rows > 0) {
    $rowTeacher = $resultTeacher->fetch_assoc();
    $teacherName    = $rowTeacher['name'] ?: $teacherName;
    $teacherSurname = $rowTeacher['surname'] ?? '';
    $teacherProfile = $rowTeacher['profile_picture'] ?: 'default.png';
    
    // Combine name + surname
    $teacherFullName = trim($teacherName . ' ' . $teacherSurname);
}
$stmtTeacher->close();

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
    <title>Teacher Dashboard</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.2/css/all.min.css" crossorigin="anonymous" referrerpolicy="no-referrer" />
    <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@600&display=swap" rel="stylesheet">
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
    left: 0;
    height: 100vh;
    z-index: 5000;
    overflow-y: auto;
    box-shadow: 2px 0 8px rgba(0,0,0,0.2);
    transition: left var(--transition-speed) ease, width var(--transition-speed) ease;
}
.sidebar.collapsed { width: var(--sidebar-collapsed-width); }

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
.sidebar.collapsed .round-toggle { opacity: 0; pointer-events: none; position: absolute; left: 50%; transform: translateX(-50%); }
.sidebar.collapsed:hover .round-toggle { opacity: 1; pointer-events: all; }

.teacher-name { margin-top: 8px; font-size: 18px; color: #fff; }
.teacher-email { font-size: 12px; color: #aaa; margin-top: 4px; }
.sidebar.collapsed .teacher-name, .sidebar.collapsed .teacher-email { opacity: 0; height: 0; overflow: hidden; margin: 0; }

/* UPDATED SIDEBAR LINKS */
.sidebar a, .sidebar .footer {
    color: var(--text-color);
    text-decoration: none;
    padding: 8px 12px;      /* slightly smaller vertical padding */
    margin-bottom: 4px;     /* closer spacing between links */
    border-radius: var(--card-radius);
    display: flex;
    align-items: center;
    transition: all 0.2s ease;
    white-space: nowrap;
    overflow: hidden;
}
.sidebar a:hover { background: rgba(79,209,197,0.08); transform: translateX(3px); }
.sidebar a.active { background: rgba(79,209,197,0.2); border-left: 4px solid var(--accent-color); }
.sidebar.collapsed a { justify-content: center; padding: 12px; }
.sidebar.collapsed a span { display: none; }
.sidebar a i { font-size: 16px; margin-right: 10px; }  /* smaller icon and closer to text */
.sidebar.collapsed a i { margin-right: 0; }
.sidebar .footer { position: absolute; bottom: 15px; width: calc(100% - 40px); font-size: 12px; opacity: 0.7; text-align: center; }

        /* Main Content */
        .main-content {
            flex: 1;
            margin-left: var(--sidebar-width);
            transition: margin-left var(--transition-speed) ease;
            display: flex;
            flex-direction: column;
        }
        .sidebar.collapsed ~ .main-content { margin-left: var(--sidebar-collapsed-width); }

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
            height: 80px; /* taller base height for better visibility and comfort */
            background: rgba(66, 65, 65, 0.35);
            backdrop-filter: blur(20px);
            -webkit-backdrop-filter: blur(20px);
            border-top: 1px solid rgba(255, 255, 255, 0.1);
            box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.3);
            z-index: 4000;
            justify-content: space-around;
            align-items: center;
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
            padding-top: 1px; /* pushes icons and text higher inside the taller bar */
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
            
            .sidebar { left: -100%; }
            .sidebar.active { left: 0; }
            
            .main-content { margin-left: 0 !important; }
            .sidebar.active ~ .main-content { transform: translateX(var(--sidebar-width)); filter: blur(3px); }
            .sidebar.active ~ #mobileBottomNav { filter: blur(5px); pointer-events: none; }
            
            iframe { height: calc(100vh - 120px) !important; }
            #mobileBottomNav { display: flex !important; }

            /* Safe area support - now based on 80px base height */
            #mobileBottomNav {
                padding-bottom: env(safe-area-inset-bottom);
                padding-bottom: constant(safe-area-inset-bottom); /* older iOS fallback */
                height: calc(80px + env(safe-area-inset-bottom));
                height: calc(80px + constant(safe-area-inset-bottom));
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
    </style>
</head>
<body>
<?php $currentPage = basename($_SERVER['PHP_SELF']); ?>

<div class="sidebar">
    <div class="sidebar-header">
        <div class="profile-picture-wrapper">
            <img src="uploads/teachers/<?= htmlspecialchars($teacherProfile ?: 'default.png') ?>" alt="Profile" class="teacher-avatar">
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
        <a href="teacher_manual.php" target="mainFrame" class="<?= $currentPage==='teacher_manual.php'?'active':'' ?>"><i class="fas fa-home"></i><span>Home</span></a>
        <a href="create_quiz.php" target="mainFrame" class="desktop-only <?= $currentPage==='create_quiz.php'?'active':'' ?>"><i class="fas fa-question-circle"></i><span>Create Quiz</span></a>
        <a href="teacher_quizzes.php" target="mainFrame" class="<?= $currentPage==='teacher_quizzes.php'?'active':'' ?>"><i class="fas fa-list-check"></i><span>View Quizzes</span></a>
        <a href="create_assignment.php" target="mainFrame" class="desktop-only <?= $currentPage==='create_assignment.php'?'active':'' ?>"><i class="fas fa-file-alt"></i><span>Create Assignment</span></a>
        <a href="teacher_assignments.php" target="mainFrame" class="<?= $currentPage==='teacher_assignments.php'?'active':'' ?>"><i class="fas fa-folder-open"></i><span>Assignments</span></a>
        <a href="create_announcement.php" target="mainFrame" class="desktop-only <?= $currentPage==='create_announcement.php'?'active':'' ?>"><i class="fas fa-bullhorn"></i><span>Announcement</span></a>
        <a href="teacher_announcements.php" target="mainFrame" class="<?= $currentPage==='teacher_announcements.php'?'active':'' ?>"><i class="fas fa-bell"></i><span>Announcements</span></a>
        <a href="learner_grades.php" target="mainFrame" class="<?= $currentPage==='learner_grades.php'?'active':'' ?>"><i class="fas fa-chart-bar"></i><span>Learner Grades</span></a>
        <a href="upload_resource.php" target="mainFrame" class="desktop-only <?= $currentPage==='upload_resource.php'?'active':'' ?>"><i class="fas fa-book"></i><span>Upload Resource</span></a>
        <a href="create_evaluation.php" target="mainFrame" class="desktop-only <?= $currentPage==='create_evaluation.php'?'active':'' ?>"><i class="fas fa-book"></i><span>Evaluation</span></a>
        <a href="view_evaluation_results.php" target="mainFrame" class="desktop-only <?= $currentPage==='view_evaluation_results.php'?'active':'' ?>"><i class="fas fa-book"></i><span>Evaluations</span></a>
        <a href="teacher_discussions.php" target="mainFrame" class="<?= $currentPage==='teacher_discussions.php'?'active':'' ?>"><i class="fas fa-home"></i><span>Discussions</span></a>
        <a href="teacher_analytics.php" target="mainFrame"><i class="fas fa-chart-line"></i><span>Analytics</span></a>
    </div>
   
</div>

<div id="mobileOverlay"></div>

<div class="main-content">
    <div class="main-header">
        
<button id="mobileToggle" onclick="toggleSidebar()"><i class="fas fa-bars"></i></button>
        
        <div class="logo-container">
            <img src="<?= htmlspecialchars($schoolLogo) ?>" alt="School Logo" style="width:40px;height:40px;border-radius:8px;object-fit:cover;border:3px solid #757272ff;">
            <span class="school-name"><?= htmlspecialchars($schoolName) ?></span>
        </div>
        <button id="settingsBtn"><i class="fas fa-gear"></i></button>
    </div>
    <iframe name="mainFrame" src="teacher_manual.php"></iframe>
</div>

<div id="loaderOverlay">
    <div>Processing...</div>
    <div class="loader"></div>
</div>

<nav id="mobileBottomNav">
    <a href="create_quiz.php" target="mainFrame" class="<?= $currentPage==='create_quiz.php'?'active':'' ?>"><i class="fas fa-question-circle"></i>Quiz</a>
    <a href="create_assignment.php" target="mainFrame" class="<?= $currentPage==='create_assignment.php'?'active':'' ?>"><i class="fas fa-file-alt"></i>Assignments</a>
    <a href="upload_resource.php" target="mainFrame" class="<?= $currentPage==='upload_resource.php'?'active':'' ?>"><i class="fas fa-book"></i>Resources</a>
    <a href="create_announcement.php" target="mainFrame" class="<?= $currentPage==='create_announcement.php'?'active':'' ?>"><i class="fas fa-bullhorn"></i>Announcement</a>
</nav>

<script>
document.addEventListener('DOMContentLoaded', function() {
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.getElementById('mobileOverlay');
    const icon = document.getElementById('toggleIcon');
    const avatar = document.querySelector('.teacher-avatar');
    const input = document.getElementById('teacherProfileInput');
    const iframe = document.querySelector('iframe');
    const loader = document.getElementById('loaderOverlay');

    // Profile upload
    avatar?.addEventListener('click', () => input.click());
    input.addEventListener('change', e => {
        const file = e.target.files[0];
        if (file) {
            avatar.src = URL.createObjectURL(file);
            const fd = new FormData(); fd.append('profile', file);
            fetch('upload_teacher_profile.php', {method:'POST', body:fd})
                .then(r => r.json())
                .then(d => { if(d.success) avatar.src = 'Uploads/teachers/' + d.file + '?t=' + Date.now(); });
        }
    });

    // Loader + Mobile Auto-Close
    document.querySelectorAll('.sidebar a, #mobileBottomNav a').forEach(link => {
        link.addEventListener('click', () => {
            loader.style.display = 'flex';

            // ADD THIS: Close sidebar on mobile when a link is clicked
            if (window.innerWidth <= 768) {
                sidebar.classList.remove('active');
                // If you have an overlay style reset, add it here too:
                if (overlay) overlay.style.display = 'none';
            }
        });
    });
    iframe?.addEventListener('load', () => loader.style.display = 'none');

   // Toggle sidebar (mobile)
    window.toggleSidebar = () => {
        if (window.innerWidth <= 768) {
            const isActive = sidebar.classList.toggle('active');
            // Show overlay if sidebar is active, hide if not
            if (overlay) {
                overlay.style.display = isActive ? 'block' : 'none';
            }
        }
    };

    // Close when tapping overlay (blurry part)
    overlay?.addEventListener('click', () => {
        sidebar.classList.remove('active');
        overlay.style.display = 'none'; // Hide the blurry part
    });

   
    // Desktop collapse - now with SVG rotation
window.toggleDesktopSidebar = () => {
    if (window.innerWidth > 768) {
        sidebar.classList.toggle('collapsed');
        const collapsed = sidebar.classList.contains('collapsed');
        localStorage.setItem('sidebarCollapsed', collapsed);
        
        // Rotate the SVG 90° when collapsed (exactly like ChatGPT)
        const svg = document.querySelector('#toggleIcon svg');
        if (svg) {
            svg.style.transform = collapsed ? 'rotate(90deg)' : 'rotate(0deg)';
        }
    }
};

    // Restore desktop state
    if (window.innerWidth > 768) {
        const saved = localStorage.getItem('sidebarCollapsed') === 'true';
        if (saved) {
            sidebar.classList.add('collapsed');
          //  icon.className = 'fas fa-chevron-right';
        }
    }

           // Settings (with loader + close mobile sidebar + clear active states)
    document.getElementById('settingsBtn')?.addEventListener('click', function() {
        loader.style.display = 'flex';  // Show loader immediately
        
        iframe.src = "teacher_settings.php";  // Load settings page

        // Optional: Clear active states from sidebar links (consistent with learner)
        document.querySelectorAll('.sidebar a').forEach(link => {
            link.classList.remove('active');
        });

        // Close mobile sidebar if open (mobile only)
        if (window.innerWidth <= 768 && sidebar.classList.contains('active')) {
            sidebar.classList.remove('active');
            overlay.style.display = 'none';  // Hide overlay/blur
        }
    });
});
</script>
</body>
</html>