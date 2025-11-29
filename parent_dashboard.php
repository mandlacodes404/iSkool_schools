<?php
session_start();
require_once 'config.php';

if (!isset($_SESSION['email']) || $_SESSION['role'] !== 'parent') {
    header("Location: index.php");
    exit();
}

$parentEmail = $_SESSION['email'];
$parentName  = $_SESSION['name'] ?? 'Parent';
$schoolId    = $_SESSION['school_id'] ?? 0;

/* ---------- SCHOOL INFO ---------- */
$schoolName = 'Your School';
$schoolLogo = 'Uploads/schools/default_school.png';
if ($schoolId) {
    $stmtSchool = $conn->prepare("SELECT name, logo FROM schools WHERE id = ?");
    $stmtSchool->bind_param("i", $schoolId);
    $stmtSchool->execute();
    $resultSchool = $stmtSchool->get_result();
    if ($resultSchool->num_rows > 0) {
        $rowSchool = $resultSchool->fetch_assoc();
        $schoolName = $rowSchool['name'] ?: $schoolName;
        $schoolLogo = !empty($rowSchool['logo']) ? $rowSchool['logo'] : $schoolLogo;
    }
    $stmtSchool->close();
}

/* ---------- PROFILE PICTURE ---------- */
$stmtParent = $conn->prepare("SELECT profile_picture FROM users WHERE email = ? AND role = 'parent'");
$stmtParent->bind_param("s", $parentEmail);
$stmtParent->execute();
$resultParent = $stmtParent->get_result();
$parentProfile = 'default.png';
if ($resultParent->num_rows > 0) {
    $rowParent = $resultParent->fetch_assoc();
    $parentProfile = $rowParent['profile_picture'] ?: $parentProfile;
}
$stmtParent->close();

/* ---------- JOIN CLASS ---------- */
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['join_class'])) {
    $classId = intval($_POST['class_id']);
    $check   = $conn->query("SELECT * FROM parent_classes WHERE parent_email = '$parentEmail' AND class_id = $classId");
    if ($check->num_rows === 0) {
        $conn->query("INSERT INTO parent_classes (parent_email, class_id) VALUES ('$parentEmail', $classId)");
    }
    header("Location: parent_dashboard.php");
    exit();
}

/* ---------- AVAILABLE CLASSES ---------- */
$classStmt = $conn->prepare("SELECT * FROM classes WHERE school_id = ? ORDER BY name ASC");
$classStmt->bind_param("i", $schoolId);
$classStmt->execute();
$classResult = $classStmt->get_result();

/* ---------- JOINED CLASSES ---------- */
$joined = $conn->query("SELECT class_id FROM parent_classes WHERE parent_email = '$parentEmail'");
$joinedClassIds = [];
while ($row = $joined->fetch_assoc()) {
    $joinedClassIds[] = $row['class_id'];
}
?>
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Parent Dashboard</title>
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

/* (all the CSS you already had – unchanged) */
body{font-family:'Inter',Arial,sans-serif;display:flex;height:100vh;background:var(--bg-color);color:var(--text-color);overflow:hidden;margin:0}
.sidebar{width:var(--sidebar-width);background:#1a1919ff;display:flex;flex-direction:column;padding:20px;box-sizing:border-box;transition:width var(--transition-speed) ease,left var(--transition-speed) ease;position:fixed;top:0;left:0;height:100vh;z-index:5000;overflow-y:visible;box-shadow:2px 0 8px rgba(0,0,0,.2);font-weight:400}
.sidebar.collapsed{width:var(--sidebar-collapsed-width)}
.sidebar h2{margin:0 0 20px;font-size:16px;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;transition:opacity var(--transition-speed) ease,font-size var(--transition-speed) ease}
.sidebar.collapsed h2{font-size:12px;opacity:.7;text-align:center}
.sidebar a,.sidebar button,.sidebar .footer,.sidebar .logout{color:var(--text-color);text-decoration:none;padding:10px 12px;margin-bottom:6px;border-radius:var(--card-radius);display:flex;align-items:center;transition:background var(--transition-speed) ease,transform .15s ease;white-space:nowrap;overflow:hidden;font-weight:400;background:none;border:none;cursor:pointer;width:100%;text-align:left;position:relative}
.sidebar a:hover,.sidebar button:hover,.sidebar .footer:hover,.sidebar .logout:hover{background:rgba(79,209,197,.08);transform:translateX(2px)}
.sidebar.collapsed a,.sidebar.collapsed button,.sidebar.collapsed .footer,.sidebar.collapsed .logout{justify-content:center;padding:10px}
.sidebar.collapsed a span,.sidebar.collapsed button span,.sidebar.collapsed .footer span,.sidebar.collapsed .logout span{display:none}
.sidebar a svg,.sidebar button svg,.sidebar .footer svg,.sidebar .logout svg{width:20px;height:20px;margin-right:10px;fill:currentColor;flex-shrink:0}
.sidebar.collapsed a svg,.sidebar.collapsed button svg,.sidebar .footer svg,.sidebar.collapsed .logout svg{margin-right:0}
.sidebar .join-class-form{margin-top:12px;padding:12px;border-radius:var(--card-radius);background:rgba(255,255,255,.03)}
.sidebar select{width:100%;padding:10px;border-radius:999px;border:1.5px solid var(--accent-color);background:var(--card-bg);color:var(--text-color);font-size:14px;transition:border-color .3s ease,box-shadow .3s ease}
.sidebar select:hover,.sidebar select:focus{border-color:var(--secondary-accent);box-shadow:0 0 6px var(--shadow-glow);outline:none}
.sidebar .join-class-btn{background:var(--secondary-accent);color:#1a202c;padding:10px;border-radius:999px;border:none;font-weight:400;margin-top:10px;width:100%;text-align:center;transition:background .3s ease,transform .15s ease}
.sidebar .join-class-btn:hover{background:#f56565;transform:scale(1.01)}
.sidebar .logout{background:var(--warning-color);color:#fff;text-align:center;transition:background .3s ease,transform .15s ease}
.sidebar .logout:hover{background:#a93226;transform:scale(1.01)}
.sidebar.collapsed .logout{font-size:12px}
.sidebar .footer{position:absolute;bottom:15px;width:calc(100% - 40px);font-size:12px;opacity:.6;cursor:default}
.sidebar.collapsed .footer{width:calc(100% - 20px);font-size:10px;text-align:center}
.main-content{flex:1;background:var(--bg-color);padding:0;overflow:hidden;display:flex;flex-direction:column;margin-left:var(--sidebar-width);transition:margin-left var(--transition-speed) ease}
.sidebar.collapsed ~ .main-content{margin-left:var(--sidebar-collapsed-width)}
iframe{border:none;width:100%;flex:1;overflow:auto;background:var(--card-bg)}
.main-header{padding:10px 18px;border-bottom:1px solid rgba(255,255,255,.1);background:linear-gradient(180deg,rgba(26,32,44,.8),var(--bg-color));display:flex;justify-content:space-between;align-items:center}
.main-header .logo-container{display:flex;align-items:center;gap:10px}
.main-header .school-name{font-size:18px;font-weight:500;color:var(--text-color);display:none}
@media(min-width:769px){.main-header .school-name{display:inline}}
.main-header .logout{background:var(--warning-color);color:#fff;padding:8px 16px;border-radius:8px;text-decoration:none;transition:background .3s ease,transform .2s ease}
.main-header .logout:hover{background:#a93226;transform:scale(1.02)}
.toggle-btn{background:none;border:none;cursor:pointer;font-size:24px;color:#e2dadaff;transition:color .3s ease}
.toggle-btn:hover{color:var(--secondary-accent)}
.main-header #settingsBtn{background:none;border:none;cursor:pointer;font-size:20px;font-weight:600;color:var(--text-color);transition:color .3s ease,transform .2s ease;display:flex;align-items:center;padding:8px}
.main-header #settingsBtn:hover{color:var(--secondary-accent);transform:scale(1.02)}
.my-classes-content{display:none;padding:24px;flex:1;overflow:auto;background:var(--card-bg);border-radius:var(--card-radius);margin:20px}
.my-classes-content.active{display:block}
.my-classes-content h3{color:var(--accent-color);margin-top:0;font-weight:600;font-size:20px}
.my-classes-content ul{padding-left:20px;color:var(--text-color)}
.my-classes-content ul li{margin-bottom:8px;font-size:16px}
.my-classes-content p{color:var(--text-color);opacity:.9;font-size:15px}
#loaderOverlay{position:absolute;top:0;left:var(--sidebar-width);width:calc(100% - var(--sidebar-width));height:100%;background:rgba(0,0,0,.5);display:none;flex-direction:column;justify-content:center;align-items:center;z-index:1000;transition:left var(--transition-speed) ease,width var(--transition-speed) ease}
.sidebar.collapsed ~ #loaderOverlay{left:var(--sidebar-collapsed-width);width:calc(100% - var(--sidebar-collapsed-width))}
.loader{border:6px solid #e2e8f0;border-top:6px solid var(--accent-color);border-radius:50%;width:60px;height:60px;animation:spin 1s linear infinite;margin-top:12px}
.loader-text{color:var(--text-color);font-size:18px;font-weight:600;text-align:center}
@keyframes spin{0%{transform:rotate(0)}100%{transform:rotate(360deg)}}
@media(max-width:768px){body{flex-direction:column}.sidebar{left:-100%;width:var(--sidebar-width)}.sidebar.active{left:0}.sidebar.collapsed{left:-100%}.main-content{margin-left:0 !important}.sidebar.active ~ .main-content{transform:translateX(var(--sidebar-width));filter:blur(2px)}.main-header{padding:10px 12px}.main-header .logout{display:none}#loaderOverlay{left:0;width:100%}iframe{height:calc(100vh - 60px)}.my-classes-content{margin:12px;padding:16px}}
@media(max-width:480px){.sidebar a,.sidebar button{font-size:12px;padding:8px 10px}.my-classes-content ul{padding-left:0;list-style:none;text-align:center}}
@media(min-width:769px){#mobileToggle{display:none}.sidebar{left:0}}
/* ---------- ACTIVE LINK STYLE ---------- */
.sidebar a.active,.sidebar button.active{background:rgba(79,209,197,.2);border-left:4px solid var(--accent-color)}
.sidebar span{opacity:1;transition:opacity var(--transition-speed) ease}
.sidebar.collapsed span{opacity:0}
#mobileBottomNav{display:none;position:fixed;bottom:0;left:0;width:100%;height:60px;background:rgba(20,20,20,.6);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);justify-content:space-around;align-items:center;border-top:1px solid rgba(255,255,255,.1);z-index:4000}
#mobileBottomNav a{color:var(--text-color);text-decoration:none;font-size:11px;text-align:center;flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;transition:color .3s ease,transform .2s ease}
#mobileBottomNav a svg{width:22px;height:22px;margin-bottom:4px;fill:currentColor}
#mobileBottomNav a.active,#mobileBottomNav a:hover{color:var(--accent-color);transform:translateY(-2px)}
@media(max-width:768px){#mobileBottomNav{display:flex}iframe{height:calc(100vh - 60px)}.sidebar a.desktop-only{display:none}}
.parent-name{margin-top:4px;font-size:18px;font-weight:500;color:#fff;max-height:30px;opacity:1;overflow:hidden}
.parent-email{font-size:12px;color:#aaa;margin-top:1px;max-height:20px;opacity:1;overflow:hidden}
.sidebar.collapsed .parent-name,.sidebar.collapsed .parent-email{max-height:0;opacity:0}
    </style>
</head>
<body>
<?php $currentPage = basename($_SERVER['PHP_SELF']); ?>

<div class="sidebar">
    <div class="profile-picture-wrapper" style="position:relative;display:inline-block;cursor:pointer;">
        <img src="Uploads/parents/<?=htmlspecialchars($parentProfile?:'default.png')?>" 
             alt="Profile Picture" class="parent-avatar"
             style="width:40px;height:40px;border-radius:50%;object-fit:cover;border:3px solid #757272ff;">
        <input type="file" id="parentProfileInput" accept="image/*" style="display:none;">
    </div>

    <div class="parent-name"><?=htmlspecialchars($parentName)?></div>
    <div class="parent-email"><?=htmlspecialchars($parentEmail)?></div>

    <div class="sidebar-links">
        <!-- JOIN CLASS -->
        <button type="button" onclick="toggleJoinClassForm()" data-page="join-class">
            <svg viewBox="0 0 24 24"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
            <span>Join a Class</span>
        </button>

        <div class="join-class-form" id="joinClassForm" style="display:none;">
            <p style="color:var(--warning-color);font-weight:bold;font-size:14px;">
                Warning: You can only choose your class *once*. Make sure you select the correct one.
            </p>
            <form method="POST">
                <select name="class_id" required>
                    <option value="">-- Select Class --</option>
                    <?php 
                    $classStmt->execute();
                    $classResult = $classStmt->get_result();
                    while ($c = $classResult->fetch_assoc()): 
                        if (!in_array($c['id'], $joinedClassIds)): ?>
                            <option value="<?= $c['id'] ?>"><?= htmlspecialchars($c['name']) ?></option>
                        <?php endif;
                    endwhile; ?>
                </select>
                <button type="submit" name="join_class" class="join-class-btn">Join Class</button>
            </form>
        </div>

        <!-- MY CLASSES (button) -->
        <button type="button" onclick="showClasses()" data-page="my-classes">
            <svg viewBox="0 0 24 24"><path d="M12 2L2 7v10c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-10-5zm0 2.18l6.36 3.18L12 20.18 5.64 7.36 12 4.18z"/></svg>
            <span>My Children’s Classes</span>
        </button>

        <!-- GRADES (button) -->
        <button type="button" onclick="showGrades()" data-page="parent_grades.php">
            <svg viewBox="0 0 24 24"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-9 14l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
            <span>Grades</span>
        </button>

        <!-- ANNOUNCEMENTS -->
        <a href="view_announcements_parent.php" target="mainFrame" class="desktop-only" data-page="view_announcements_parent.php">
            <svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
            <span>View Announcements</span>
        </a>

        <!-- MESSAGE TEACHER -->
        <a href="message_teacher.php" target="mainFrame" class="desktop-only" data-page="message_teacher.php">
            <svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V5h12v2z"/></svg>
            <span>Message a Teacher</span>
        </a>

        <!-- VIEW SENT MESSAGES -->
        <a href="view_messages_parent.php" target="mainFrame" class="desktop-only" data-page="view_messages_parent.php">
            <svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h4v4l4-4h6c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 9H6V9h12v2zm0-3H6V6h12v2z"/></svg>
            <span>View Sent Messages</span>
        </a>

        <!-- LOGOUT -->
        <a href="logout.php" class="logout" data-page="logout.php">
            <svg viewBox="0 0 24 24"><path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.59L17 17l5-5-5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z"/></svg>
            <span>Logout</span>
        </a>
    </div>

    <div class="footer" style="font-size:12px;">
        <svg viewBox="0 0 24 24" style="width:16px;height:16px;"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
        <span><strong>iSkool v.1.0.0</strong></span>
    </div>
</div>

<div class="main-content">
    <div class="main-header">
        <button id="mobileToggle" class="toggle-btn" onclick="toggleSidebar()"></button>
        <div class="logo-container">
            <img src="<?=htmlspecialchars($schoolLogo)?>" alt="School Logo" class="school-logo"
                 style="width:40px;height:40px;border-radius:8px;object-fit:cover;border:3px solid #757272ff;">
            <span class="school-name"><?=htmlspecialchars($schoolName)?></span>
        </div>
        <button id="settingsBtn" title="Settings">
            <svg viewBox="0 0 24 24" style="width:24px;height:24px;"><path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.5.5 0 0 0 .12-.61l-1.92-3.32a.5.5 0 0 0-.61-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.5.5 0 0 0-.5-.43h-3.84a.5.5 0 0 0-.5.43l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96a.5.5 0 0 0-.61.22L3.86 10.08a.5.5 0 0 0 .12.61l2.03 1.58c-.05.3-.07.62-.07.94 0 .33.02.64.07.94l-2.03 1.58a.5.5 0 0 0-.12.61l1.92 3.32a.5.5 0 0 0 .61.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54a.5.5 0 0 0 .5.43h3.84a.5.5 0 0 0 .5-.43l.36-2.54c.59-.24 1.13-.57 1.62-.94l2.39.96a.5.5 0 0 0 .61-.22l1.92-3.32a.5.5 0 0 0-.12-.61l-2.03-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/></svg>
        </button>
    </div>

    <div class="my-classes-content" id="myClassesContent">
        <h3>My Children’s Classes</h3>
        <?php if (!empty($joinedClassIds)): ?>
            <ul>
                <?php
                $ids = implode(',', array_map('intval', $joinedClassIds));
                $joinedNames = $conn->query("SELECT name FROM classes WHERE id IN ($ids) AND school_id = $schoolId");
                while ($cls = $joinedNames->fetch_assoc()): ?>
                    <li><?=htmlspecialchars($cls['name'])?></li>
                <?php endwhile; ?>
            </ul>
        <?php else: ?>
            <p>You haven’t joined any classes yet.</p>
        <?php endif; ?>
    </div>

    <iframe name="mainFrame" src="view_announcements_parent.php"></iframe>
</div>

<div id="loaderOverlay">
    <div class="loader-text">Processing...</div>
    <div class="loader"></div>
</div>

<div id="mobileOverlay" style="display:none;position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,.4);z-index:1500;"></div>

<nav id="mobileBottomNav">
    <a href="view_announcements_parent.php" target="mainFrame" data-page="view_announcements_parent.php">
        <svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
        Announcements
    </a>
    <a href="message_teacher.php" target="mainFrame" data-page="message_teacher.php">
        <svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V5h12v2z"/></svg>
        Message
    </a>
    <a href="view_messages_parent.php" target="mainFrame" data-page="view_messages_parent.php">
        <svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h4v4l4-4h6c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 9H6V9h12v2zm0-3H6V6h12v2z"/></svg>
        Sent
    </a>
    <a href="#" onclick="showGrades();return false;" data-page="parent_grades.php">
        <svg viewBox="0 0 24 24"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-9 14l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
        Grades
    </a>
</nav>

<script>
document.addEventListener("DOMContentLoaded", function () {
    /* ---------- PROFILE UPLOAD ---------- */
    const avatar = document.querySelector(".parent-avatar");
    const input  = document.getElementById("parentProfileInput");
    if (avatar && input) {
        avatar.addEventListener("click", () => input.click());
        input.addEventListener("change", e => {
            const file = e.target.files[0];
            if (!file) return;
            avatar.src = URL.createObjectURL(file);
            const fd = new FormData();
            fd.append('profile', file);
            fetch('upload_parent_profile.php', {method:'POST', body:fd})
                .then(r=>r.json())
                .then(d=>{ if(d.success) avatar.src='Uploads/parents/'+d.file+'?t='+Date.now(); else alert(d.error||'Upload failed'); });
        });
    }

    const iframe   = document.querySelector("iframe");
    const loader   = document.getElementById("loaderOverlay");
    const sidebar  = document.querySelector(".sidebar");
    const mobileOv = document.getElementById("mobileOverlay");
    const allNav   = document.querySelectorAll('.sidebar a, .sidebar button, #mobileBottomNav a');

    /* ---------- LOADER ---------- */
    document.querySelector("form")?.addEventListener("submit", () => loader.style.display="flex");
    iframe.addEventListener("load", () => loader.style.display="none");

    /* ---------- ACTIVE LINK (same as learner/teacher) ---------- */
    function setActive(page) {
        allNav.forEach(el => el.classList.toggle('active', el.getAttribute('data-page')===page));
    }

    // initial page
    setActive('<?= $currentPage ?>');

    // any click
    allNav.forEach(el => {
        el.addEventListener('click', function () {
            const dp = this.getAttribute('data-page');
            if (!dp) return;
            if (dp==='my-classes' || dp==='join-class') { setActive(dp); return; }
            setActive(dp);
        });
    });

    // iframe load
    iframe.addEventListener('load', () => {
        try {
            const src = iframe.contentWindow.location.pathname.split('/').pop();
            if (src) setActive(src);
        } catch(e){/*ignore cross-origin*/}
    });

    /* ---------- MY CLASSES / GRADES ---------- */
    function hideMyClasses() {
        const mc = document.getElementById('myClassesContent');
        if (mc) mc.classList.remove('active');
        if (iframe) iframe.style.display = 'block';
    }

    window.showClasses = function () {
        document.getElementById('myClassesContent').classList.add('active');
        iframe.style.display = 'none';
        setActive('my-classes');
        if (window.innerWidth<=768) toggleSidebar();
    };

    window.showGrades = function () {
        iframe.src = 'parent_grades.php';
        hideMyClasses();
        loader.style.display = 'flex';
        setActive('parent_grades.php');
        if (window.innerWidth<=768) toggleSidebar();
    };

    // hide My Classes when any normal link is clicked
    document.querySelectorAll('.sidebar a[target="mainFrame"], #mobileBottomNav a').forEach(l => l.addEventListener('click', hideMyClasses));

    /* ---------- SIDEBAR TOGGLE ---------- */
    window.toggleSidebar = function () {
        if (window.innerWidth<=768) {
            sidebar.classList.toggle('active');
            mobileOv.style.display = sidebar.classList.contains('active') ? 'block' : 'none';
        } else {
            sidebar.classList.toggle('collapsed');
            localStorage.setItem('sidebarCollapsed', sidebar.classList.contains('collapsed'));
        }
    };
    mobileOv.addEventListener('click', () => { sidebar.classList.remove('active'); mobileOv.style.display='none'; });

    /* ---------- JOIN CLASS FORM ---------- */
    window.toggleJoinClassForm = function () {
        const f = document.getElementById('joinClassForm');
        f.style.display = f.style.display==='none' ? 'block' : 'none';
        if (window.innerWidth<=768) toggleSidebar();
    };

    /* ---------- SETTINGS ---------- */
    document.getElementById('settingsBtn').addEventListener('click', () => {
        iframe.src = 'parent_settings.php';
        hideMyClasses();
        loader.style.display = 'flex';
    });
});
</script>
</body>
</html>