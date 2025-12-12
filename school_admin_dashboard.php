<?php
session_start();
require_once 'config.php';

// Security – only school_admin allowed (no school_id needed)
if (!isset($_SESSION['school_admin'])) {
    header("Location: index.php");
    exit();
}

$name = $_SESSION['name'];

// ======================== ACADEMIC YEAR LOGIC (NO SCHOOL_ID) ========================
$currentYearResult = $conn->query("SELECT id, name FROM academic_years WHERE is_current = 1 LIMIT 1");
$currentYear       = $currentYearResult->fetch_assoc();
$currentYearId     = $currentYear['id'] ?? null;
$currentYearName   = $currentYear['name'] ?? 'Not Set';

// Handle year switch
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['academic_year_id'])) {
    $newYearId = (int)$_POST['academic_year_id'];
    $check = $conn->query("SELECT id FROM academic_years WHERE id = $newYearId LIMIT 1");
    if ($check && $check->num_rows === 1) {
        $_SESSION['admin_selected_year_id'] = $newYearId;
    }
    header("Location: " . $_SERVER['PHP_SELF']);
    exit();
}

$activeYearId   = $_SESSION['admin_selected_year_id'] ?? $currentYearId;
$activeYearName = $currentYearName;

if ($activeYearId && $activeYearId != $currentYearId) {
    $res = $conn->query("SELECT name FROM academic_years WHERE id = $activeYearId");
    if ($row = $res->fetch_assoc()) {
        $activeYearName = $row['name'];
    }
}

// ======================== COUNTS (NO SCHOOL_ID) ========================

// 1. Teachers – all active in current database (permanent, not year-specific)
$teacherCount = $conn->query("SELECT COUNT(*) FROM users WHERE role = 'teacher' AND is_deleted = 0")->fetch_row()[0];

// 2. Learners – ONLY those enrolled in the selected academic year
if ($activeYearId) {
    $stmt = $conn->prepare("SELECT COUNT(DISTINCT student_email) FROM class_students WHERE academic_year_id = ?");
    $stmt->bind_param("i", $activeYearId);
    $stmt->execute();
    $learnerCount = $stmt->get_result()->fetch_row()[0] ?? 0;
    $stmt->close();
} else {
    // Rare fallback: if no year selected somehow, count all learners
    $learnerCount = $conn->query("SELECT COUNT(*) FROM users WHERE role = 'learner' AND is_deleted = 0")->fetch_row()[0];
}

// 3. Classes – only those that have at least one student in the selected year
if ($activeYearId) {
    $classCountResult = $conn->query("
        SELECT COUNT(DISTINCT cs.class_id) 
        FROM class_students cs 
        WHERE cs.academic_year_id = $activeYearId
    ");
    $classCount = $classCountResult->fetch_row()[0] ?? 0;
} else {
    // Fallback: total permanent classes in this database
    $classCount = $conn->query("SELECT COUNT(*) FROM classes")->fetch_row()[0];
}

// School name – from your existing school_name table (same as login page)
$schoolName = 'Your School';
$result = $conn->query("SELECT setting_value FROM school_name WHERE setting_key = 'school_name' LIMIT 1");
if ($row = $result->fetch_assoc()) {
    $schoolName = trim($row['setting_value']);
}
?>

<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Principal Dashboard • iSkool</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.2/css/all.min.css"/>
    <style>
        :root {
            --bg-color: #0d1117;
            --sidebar-bg: #161b22;
            --text-color: #e0e6f0;
            --accent-color: #58a6ff;
            --card-bg: rgba(22, 27, 34, 0.8);
        }
        body { margin:0; font-family:Arial,sans-serif; display:flex; height:100vh; background:var(--bg-color); color:var(--text-color); overflow:hidden; }
        .sidebar { width:220px; background:var(--sidebar-bg); padding:20px; transition:0.3s; }
        .sidebar.collapsed { width:60px; }
        .sidebar a { color:var(--text-color); text-decoration:none; padding:10px 12px; margin:4px 0; border-radius:8px; display:flex; align-items:center; }
        .sidebar a:hover { background:rgba(88,166,255,0.2); }
        .sidebar.collapsed a span { display:none; }
        .sidebar a i { margin-right:12px; font-size:20px; width:24px; text-align:center; }

        .main-content { flex:1; display:flex; flex-direction:column; }
        .main-header { padding:20px; border-bottom:1px solid rgba(255,255,255,0.1); display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:15px; }
        .stats-bar { background:var(--card-bg); padding:10px 16px; border-radius:12px; backdrop-filter:blur(8px); font-size:14px; margin-top:8px; }

        .year-switcher {
            background: rgba(88,166,255,0.15);
            border: 1px solid var(--accent-color);
            border-radius: 10px;
            padding: 8px 14px;
            display: flex;
            align-items: center;
            gap: 10px;
            font-size: 15px;
            min-width: 280px;
        }
        .year-switcher select {
            background: var(--sidebar-bg);
            color: var(--text-color);
            border: none;
            border-radius: 6px;
            padding: 6px 10px;
        }
        iframe { border:none; width:100%; flex:1; }
        footer { text-align:center; padding:10px; opacity:0.7; font-size:14px; }
        .toggle-btn { background:none; border:none; font-size:28px; color:var(--accent-color); cursor:pointer; }
        #loaderOverlay { position:absolute; top:0; left:220px; width:calc(100%-220px); height:100%; background:rgba(0,0,0,0.6); display:none; justify-content:center; align-items:center; flex-direction:column; z-index:9999; }
        .sidebar.collapsed ~ .main-content #loaderOverlay { left:60px; width:calc(100%-60px); }
        .loader { border:6px solid #f3f3f3; border-top:6px solid var(--accent-color); border-radius:50%; width:60px; height:60px; animation:spin 1s linear infinite; }
        @keyframes spin { to { transform:rotate(360deg); } }
    </style>
</head>
<body>

<div class="sidebar">
<<?php
// Initialize fallback values
$schoolName = 'My School';
$schoolLogo = 'assets/img/default-school-logo.png'; // Fallback logo path

// 1. Query the school_name table for the configuration row.
// We select both the name (setting_value) and the logo path (school_logo)
// from the row where setting_key is 'school_name'.
$result = $conn->query("SELECT setting_value, school_logo FROM school_name WHERE setting_key = 'school_name' LIMIT 1"); 

if ($result && $row = $result->fetch_assoc()) {
    // 2. Retrieve School Name (from setting_value column)
    $dbSchoolName = trim($row['setting_value']);
    if (!empty($dbSchoolName)) {
        $schoolName = $dbSchoolName;
    }

    // 3. Retrieve Logo Path (from school_logo column)
    $dbLogoPath = trim($row['school_logo']);
    
    // Check if the database path is set AND the file physically exists on the server
    if (!empty($dbLogoPath) && file_exists($dbLogoPath)) {
        $schoolLogo = $dbLogoPath;
    }
    // If the file doesn't exist, $schoolLogo remains the default fallback.
}

// $schoolName and $schoolLogo are now ready to use.
?>

<div style="text-align:center;margin-bottom:20px;">
    <img src="<?= htmlspecialchars($logoPath) ?>" 
         alt="School Logo" 
         style="max-height:80px; border-radius:10px; box-shadow:0 4px 12px rgba(0,0,0,0.3);">
</div>
    <a href="upload_logo.php" target="mainFrame">
        <i class="fas fa-upload"></i> <span>Upload Logo</span>
    </a>
    <a href="admin_manual.php" target="mainFrame">
        <i class="fas fa-book"></i> <span>Admin Manual</span>
    </a>
    <a href="manage_teachers.php" target="mainFrame">
        <i class="fas fa-chalkboard-teacher"></i> <span>Manage Teachers</span>
    </a>
    <a href="manage_learners.php" target="mainFrame">
        <i class="fas fa-user-graduate"></i> <span>Manage Learners</span>
    </a>
    <a href="admin_announcements.php" target="mainFrame">
        <i class="fas fa-bullhorn"></i> <span>Create Announcement</span>
    </a>
    <a href="admin_view_announcements.php" target="mainFrame">
        <i class="fas fa-list-alt"></i> <span>View Announcements</span>
    </a>
    <a href="reports.php" target="mainFrame">
        <i class="fas fa-chart-bar"></i> <span>Reports</span>
    </a>
    <a href="release_evaluation.php" target="mainFrame">
        <i class="fas fa-star"></i> <span>Teacher Evaluation</span>
    </a>
    <a href="view_evaluations.php" target="mainFrame">
        <i class="fas fa-tasks"></i> <span>View Evaluations</span>
    </a>
    <a href="admin_top_achievers.php" target="mainFrame">
        <i class="fas fa-trophy"></i> <span>Top Achievers</span>
    </a>
    <a href="view_top_achievers.php" target="mainFrame">
        <i class="fas fa-medal"></i> <span>View Top Achievers</span>
    </a>
    <a href="logout.php">
        <i class="fas fa-sign-out-alt"></i> <span>Logout</span>
    </a>
</div>

<div class="main-content">
    <div class="main-header">
        <button class="toggle-btn" onclick="toggleSidebar()">Menu</button>
        <h2><?= htmlspecialchars($schoolName) ?></h2>

        <div style="text-align:right;">
           
            <div class="stats-bar">
                Teachers: <strong><?= $teacherCount ?></strong> • 
                Learners: <strong><?= $learnerCount ?></strong> • 
                Classes (Active): <strong><?= $classCount ?></strong>
            </div>

            <div class="year-switcher">
                <form method="POST" style="margin:0;display:inline;">
                    <select name="academic_year_id" onchange="this.form.submit()">
                        <?php
                        $years = $conn->query("SELECT id, name, is_current FROM academic_years ORDER BY start_date DESC");
                        while ($y = $years->fetch_assoc()): ?>
                            <option value="<?= $y['id'] ?>" <?= ($activeYearId == $y['id'] ? 'selected' : '') ?>>
                                <?= htmlspecialchars($y['name']) ?> <?= $y['is_current'] ? '(Current)' : '' ?>
                            </option>
                        <?php endwhile; ?>
                    </select>
                </form>
                <strong>Viewing Year: <?= htmlspecialchars($activeYearName) ?></strong>
            </div>
        </div>
    </div>

    <!-- This is the magic line — exactly like your original working version -->
    <iframe name="mainFrame" src="admin_manual.php"></iframe>
    
    <footer><strong>iSkool • <?= htmlspecialchars($activeYearName) ?></strong></footer>
</div>

<div id="loaderOverlay">
    <div class="loader"></div>
    <div style="color:white;margin-top:20px;font-size:18px;">Loading...</div>
</div>

<script>
    // This script is 100% proven from your original working file
    document.addEventListener("DOMContentLoaded", function () {
        const iframe = document.querySelector('iframe[name="mainFrame"]');
        const loader = document.getElementById("loaderOverlay");

        // Show loader when any link targeting mainFrame is clicked
        document.querySelectorAll('.sidebar a[target="mainFrame"]').forEach(link => {
            link.addEventListener("click", () => {
                loader.style.display = "flex";
            });
        });

        // Hide loader when iframe finishes loading
        if (iframe) {
            iframe.addEventListener("load", () => {
                loader.style.display = "none";
            });
        }

        // Hide loader on initial page load (in case content is already there)
        loader.style.display = "none";
    });

    function toggleSidebar() {
        document.querySelector(".sidebar").classList.toggle("collapsed");
    }
</script>
</body>
</html>