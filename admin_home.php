<?php
session_start();
require_once 'config.php';

if (!isset($_SESSION['email']) || $_SESSION['role'] !== 'admin') {
    header("Location: index.php");
    exit();
}

$adminSchoolId = $_SESSION['school_id'];
$isSuperAdmin = ($adminSchoolId == 9999);

// For super admin: fetch all schools for dropdown
$schools = [];
if ($isSuperAdmin) {
    $result = $conn->query("SELECT id, name FROM schools ORDER BY name ASC");
    while ($row = $result->fetch_assoc()) {
        $schools[] = $row;
    }

    // Get selected school from GET or default to first school in list
    $selectedSchoolId = $schools[0]['id'] ?? null;
    if (isset($_GET['school_id']) && is_numeric($_GET['school_id'])) {
        $selectedSchoolId = intval($_GET['school_id']);
    }
}
?>

<!DOCTYPE html>
<html>
<head>
    
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Admin Dashboard</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            background: #ecf0f1;
            padding: 30px;
        }
        h1 {
            color: #2c3e50;
        }
        .logout {
            float: right;
            background: #e74c3c;
            color: white;
            padding: 8px 14px;
            border-radius: 5px;
            text-decoration: none;
        }
        .dashboard-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
            gap: 20px;
            margin-top: 40px;
        }
        .card {
            background: white;
            padding: 20px;
            border-radius: 10px;
            box-shadow: 0 3px 8px rgba(0,0,0,0.1);
            transition: transform 0.2s ease;
        }
        .card:hover {
            transform: translateY(-5px);
        }
        .card h3 {
            margin-top: 0;
            color: #34495e;
        }
        .card p {
            font-size: 14px;
            color: #666;
        }
        .card a {
            display: inline-block;
            margin-top: 10px;
            text-decoration: none;
            background: #2980b9;
            color: white;
            padding: 6px 12px;
            border-radius: 5px;
        }
        /* School selector form */
        #school-select {
            margin-bottom: 20px;
        }
    </style>
</head>
<body>

<a class="logout" href="logout.php">Logout</a>
<h1>Welcome Admin 👨‍💼</h1>

<?php if ($isSuperAdmin): ?>
    <form id="school-select" method="GET" action="admin_home.php">
        <label for="school_id">Select School to Manage:</label>
        <select name="school_id" id="school_id" onchange="this.form.submit()">
            <?php foreach ($schools as $school): ?>
                <option value="<?= $school['id'] ?>" <?= ($school['id'] == $selectedSchoolId) ? 'selected' : '' ?>>
                    <?= htmlspecialchars($school['name']) ?>
                </option>
            <?php endforeach; ?>
        </select>
    </form>
<?php endif; ?>

<div class="dashboard-grid">
    <div class="card">
        <h3>Manage Classes</h3>
        <p>Create, view, and delete school classes (e.g., 11A, 12B).</p>
        <?php if ($isSuperAdmin && $selectedSchoolId !== null): ?>
            <a href="admin_classes.php?school_id=<?= $selectedSchoolId ?>">Open Class Manager</a>
        <?php else: ?>
            <a href="admin_classes.php">Open Class Manager</a>
        <?php endif; ?>
    </div>

    <div class="card">
        <h3>Manage Teachers</h3>
        <p>Assign or view teacher profiles and their classes.</p>
        <a href="#">Coming Soon</a>
    </div>

    <div class="card">
        <h3>Manage Learners</h3>
        <p>View learner accounts and which class they're assigned to.</p>
        <a href="#">Coming Soon</a>
    </div>

    <div class="card">
        <h3>Subjects</h3>
        <p>Set up subjects like Maths, Physics, Life Science, etc.</p>
        <a href="#">Coming Soon</a>
    </div>

    <div class="card">
        <h3>Platform Stats</h3>
        <p>See total users, quizzes created, active classes and more.</p>
        <a href="#">Coming Soon</a>
    </div>
</div>

<footer style="margin-top: 60px; text-align: center; color: var(--text-color); opacity: 0.6; font-size: 14px;">
    Powered by <a href="#" style="color: var(--accent-color); text-decoration: none;"><strong>iSkool</strong></a> 🚀
</footer>
</body>
</html>
