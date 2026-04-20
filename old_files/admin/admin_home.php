<?php
session_start();
require_once 'config.php';

// Only allow users with role = 'admin' (your true super admin)
if (!isset($_SESSION['email']) || $_SESSION['role'] !== 'admin') {
    header("Location: index.php");
    exit();
}

$name = $_SESSION['name'] ?? 'Super Admin';

// Optional: Detect if this is the global super admin (you can remove this later)
$isGlobalSuperAdmin = ($_SESSION['email'] === 'superadmin@iskool.co.za');
?>

<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Super Admin Dashboard • iSkool</title>
    <style>
        :root {
            --bg: #0d1117;
            --card: #161b22;
            --text: #e6edf3;
            --accent: #58a6ff;
            --red: #f85149;
        }
        body { margin:0; font-family:'Segoe UI',sans-serif; background:var(--bg); color:var(--text); padding:40px; }
        .header { display:flex; justify-content:space-between; align-items:center; margin-bottom:30px; }
        .logout { background:var(--red); padding:12px 24px; border-radius:10px; text-decoration:none; color:white; font-weight:600; }
        .logout:hover { background:#da3633; }
        h1 { margin:0; font-size:28px; }
        .super-badge {
            background:var(--red); color:white; padding:8px 16px; border-radius:50px; font-size:14px; font-weight:bold; margin-left:15px;
        }
        .grid {
            display:grid;
            grid-template-columns:repeat(auto-fit, minmax(320px, 1fr));
            gap:24px;
            margin-top:40px;
        }
        .card {
            background:var(--card);
            padding:28px;
            border-radius:16px;
            border:1px solid #30363d;
            transition:0.3s;
        }
        .card:hover {
            transform:translateY(-8px);
            box-shadow:0 12px 30px rgba(0,0,0,0.5);
            border-color:var(--accent);
        }
        .card h3 {
            margin:0 0 12px 0;
            color:var(--accent);
            font-size:22px;
        }
        .card p {
            opacity:0.8;
            line-height:1.5;
        }
        .btn {
            display:inline-block;
            background:var(--accent);
            color:#000;
            padding:12px 20px;
            border-radius:10px;
            text-decoration:none;
            font-weight:600;
            margin-top:16px;
            transition:0.2s;
        }
        .btn:hover {
            background:#7cc5ff;
            transform:scale(1.03);
        }
        .warning {
            background:rgba(248,81,73,0.15);
            border-left:4px solid var(--red);
            padding:16px;
            border-radius:8px;
            margin:20px 0;
        }
        footer {
            text-align:center;
            margin-top:80px;
            opacity:0.6;
            font-size:14px;
        }
    </style>
</head>
<body>

<div class="header">
    <div>
        <h1>Welcome, <?= htmlspecialchars($name) ?>
            <?php if ($isGlobalSuperAdmin): ?>
                <span class="super-badge">GLOBAL SUPER ADMIN</span>
            <?php endif; ?>
        </h1>
        <div style="margin-top:8px;opacity:0.8;">
            You have <strong>full control</strong> over this school
        </div>
    </div>
    <a href="logout.php" class="logout">Logout</a>
</div>

<?php if ($isGlobalSuperAdmin): ?>
<div class="warning">
    <strong>Super Admin Mode Active</strong><br>
    You are logged in as <code>superadmin@iskool.co.za</code> — you have access to <strong>this school only</strong>.<br>
    To manage another school, visit its subdomain (e.g. <code>rosebank.iskool.co.za</code>) and log in again.
</div>
<?php endif; ?>

<div class="grid">
    <div class="card">
        <h3>Manage Classes</h3>
        <p>Create, edit, and organize all classes in this school.</p>
        <a href="admin_classes.php" class="btn">Open Class Manager</a>
    </div>

    <div class="card">
        <h3>Manage Teachers</h3>
        <p>View, add, or remove teacher accounts and permissions.</p>
        <a href="manage_teachers.php" class="btn">Manage Teachers</a>
    </div>

    <div class="card">
        <h3>Manage Learners</h3>
        <p>View and manage all student accounts and class assignments.</p>
        <a href="manage_learners.php" class="btn">Manage Learners</a>
    </div>

    <div class="card">
        <h3>Subjects & Curriculum</h3>
        <p>Set up subjects, topics, and learning materials.</p>
        <a href="manage_subjects.php" class="btn">Manage Subjects</a>
    </div>

    <div class="card">
        <h3>School Settings</h3>
        <p>Update school name, logo, academic years, and branding.</p>
        <a href="school_settings.php" class="btn">School Settings</a>
    </div>

    <div class="card">
        <h3>Reports & Analytics</h3>
        <p>View performance, attendance, and platform usage stats.</p>
        <a href="reports.php" class="btn">View Reports</a>
    </div>

    <div class="card">
        <h3>Database Backup</h3>
        <p>Download a full backup of this school's database.</p>
        <a href="backup_database.php" class="btn">Download Backup</a>
    </div>

    <div class="card">
        <h3>System Health</h3>
        <p>Check server status, logs, and performance.</p>
        <a href="system_health.php" class="btn">View Status</a>
    </div>
</div>

<footer>
    Powered by <strong>iSkool</strong> • Super Admin Control Panel
</footer>

</body>
</html>