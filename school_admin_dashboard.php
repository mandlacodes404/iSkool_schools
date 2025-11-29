<?php
session_start();
require_once 'config.php';

if (!isset($_SESSION['school_admin']) || !isset($_SESSION['school_id'])) {
    header("Location: index.php");
    exit();
}

$name      = $_SESSION['name'];
$schoolId  = $_SESSION['school_id'];

// ======================== ACADEMIC YEAR LOGIC ========================
$currentYearResult = $conn->query("SELECT id, name FROM academic_years WHERE school_id = $schoolId AND is_current = 1 LIMIT 1");
$currentYear       = $currentYearResult->fetch_assoc();
$currentYearId     = $currentYear['id'] ?? null;
$currentYearName   = $currentYear['name'] ?? 'Not Set';

// Handle year switch
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['academic_year_id'])) {
    $newYearId = (int)$_POST['academic_year_id'];
    $check = $conn->prepare("SELECT id FROM academic_years WHERE id = ? AND school_id = ?");
    $check->bind_param("ii", $newYearId, $schoolId);
    $check->execute();
    if ($check->get_result()->num_rows === 1) {
        $_SESSION['admin_selected_year_id'] = $newYearId;
    }
    $check->close();
    header("Location: " . $_SERVER['PHP_SELF']);
    exit();
}

$activeYearId   = $_SESSION['admin_selected_year_id'] ?? $currentYearId;
$activeYearName = $currentYearName;

if ($activeYearId && $activeYearId != $currentYearId) {
    $res = $conn->query("SELECT name FROM academic_years WHERE id = $activeYearId");
    if ($row = $res->fetch_assoc()) $activeYearName = $row['name'];
}

// ======================== COUNTS ========================

// 1. Teachers – always all active
$teacherCount = $conn->query("SELECT COUNT(*) FROM users WHERE role = 'teacher' AND school_id = $schoolId AND is_deleted = 0")->fetch_row()[0];

// 2. Learners – always ALL active students (your original way)
$learnerCount = $conn->query("SELECT COUNT(*) FROM users WHERE role = 'user' AND school_id = $schoolId AND is_deleted = 0")->fetch_row()[0];

// 3. Classes – only those that have at least one student THIS academic year
if ($activeYearId) {
    $classCountResult = $conn->query("
        SELECT COUNT(DISTINCT cs.class_id) 
        FROM class_students cs 
        WHERE cs.academic_year_id = $activeYearId
    ");
    $classCount = $classCountResult->fetch_row()[0] ?? 0;
} else {
    // No year selected → show total permanent classes
    $classCount = $conn->query("SELECT COUNT(*) FROM classes WHERE school_id = $schoolId")->fetch_row()[0];
}

// School name
$schoolName = 'Your School';
$stmt = $conn->prepare("SELECT name FROM schools WHERE id = ?");
$stmt->bind_param("i", $schoolId);
$stmt->execute();
if ($row = $stmt->get_result()->fetch_assoc()) $schoolName = $row['name'];
$stmt->close();
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
    <?php
    $logoPath = '';
    $stmt = $conn->prepare("SELECT logo FROM schools WHERE id = ?");
    $stmt->bind_param("i", $schoolId);
    $stmt->execute();
    if ($row = $stmt->get_result()->fetch_assoc()) $logoPath = $row['logo'];
    $stmt->close();
    ?>
    <div style="text-align:center;margin-bottom:20px;">
        <?php if ($logoPath && file_exists($logoPath)): ?>
            <img src="<?=htmlspecialchars($logoPath)?>" alt="Logo" style="max-height:80px;border-radius:10px;">
        <?php else: ?><div style="opacity:0.5;font-size:13px;">No Logo</div><?php endif; ?>
    </div>

    <a href="upload_logo.php" target="mainFrame">Upload Logo</a>
    <a href="admin_manual.php" target="mainFrame">Admin Manual</a>
    <a href="manage_teachers.php" target="mainFrame">Manage Teachers</a>
    <a href="manage_learners.php" target="mainFrame">Manage Learners</a>
    <a href="admin_announcements.php" target="mainFrame">Create Announcement</a>
    <a href="admin_view_announcements.php" target="mainFrame">View Announcements</a>
    <a href="reports.php" target="mainFrame">Reports</a>
    <a href="release_evaluation.php" target="mainFrame">Teacher Evaluation</a>
    <a href="view_evaluations.php" target="mainFrame">View Evaluations</a>
    <a href="admin_top_achievers.php" target="mainFrame">Top Achievers</a>
    <a href="view_top_achievers.php" target="mainFrame">View Top Achievers</a>
    <a href="logout.php">Logout</a>
</div>

<div class="main-content">
    <div class="main-header">
        <button class="toggle-btn" onclick="toggleSidebar()">Menu</button>
        <h2><?= htmlspecialchars($schoolName) ?></h2>

        <div style="text-align:right;">
            <div style="font-size:22px;margin-bottom:6px;">Welcome, <?= htmlspecialchars($name) ?></div>
            <div class="stats-bar">
                Teachers: <strong><?= $teacherCount ?></strong> • 
                Learners: <strong><?= $learnerCount ?></strong> • 
                Classes (Active): <strong><?= $classCount ?></strong>
            </div>

            <div class="year-switcher">
                <form method="POST" style="margin:0;">
                    <select name="academic_year_id" onchange="this.form.submit()">
                        <?php
                        $years = $conn->query("SELECT id, name, is_current FROM academic_years WHERE school_id = $schoolId ORDER BY start_date DESC");
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

    <iframe name="mainFrame" src="admin_manual.php"></iframe>
    <footer><strong>iSkool • <?= htmlspecialchars($activeYearName) ?></strong></footer>
</div>

<div id="loaderOverlay">
    <div class="loader"></div>
    <div style="color:white;margin-top:20px;font-size:18px;">Loading...</div>
</div>

<script>
    document.querySelectorAll(".sidebar a").forEach(l => l.addEventListener("click", () => {
        document.getElementById("loaderOverlay").style.display = "flex";
    }));
    document.querySelector("iframe").addEventListener("load", () => {
        document.getElementById("loaderOverlay").style.display = "none";
    });
    function toggleSidebar() {
        document.querySelector(".sidebar").classList.toggle("collapsed");
    }
</script>
</body>
</html>