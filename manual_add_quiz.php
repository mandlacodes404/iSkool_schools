<?php
require_once __DIR__ . '/auth/session_guard.php';
require_once __DIR__ . '/auth/csrf_helper.php';
include("config.php");

if (!isset($_SESSION['email']) || $_SESSION['role'] !== 'teacher') {
    header("Location: index.php");
    exit();
}

$email = $_SESSION['email'];
$message = "";

/**
 * 1. GET CURRENT ACADEMIC YEAR
 * Removed school_id logic because the subdomain database is school-specific.
 */
$current_academic_year_id = null;
$currentYearStmt = $conn->prepare("SELECT id FROM academic_years WHERE is_current = 1 LIMIT 1");
$currentYearStmt->execute();
$currentYearResult = $currentYearStmt->get_result();

if ($currentYearRow = $currentYearResult->fetch_assoc()) {
    $current_academic_year_id = $currentYearRow['id'];
} else {
    // Fallback: get the latest year if none is marked current
    $backupRes = $conn->query("SELECT id FROM academic_years ORDER BY id DESC LIMIT 1");
    if($bRow = $backupRes->fetch_assoc()){
        $current_academic_year_id = $bRow['id'];
    }
}
$currentYearStmt->close();

if (!$current_academic_year_id) {
    die("System Error: No academic years configured in this school's database.");
}

/**
 * 2. GET CURRENT GLOBAL TERM
 */
$current_global_term = 4; // fallback
$termResult = $conn->query("SELECT current_global_term FROM platform_settings LIMIT 1");
if ($termRow = $termResult->fetch_assoc()) {
    $current_global_term = (int)$termRow['current_global_term'];
}

/**
 * 3. FETCH CLASSES
 * Removed school_id filter.
 */
$classStmt = $conn->prepare("SELECT id, name FROM classes ORDER BY name");
$classStmt->execute();
$classResult = $classStmt->get_result();

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    verify_csrf_token();

    $title = trim($_POST['title'] ?? '');
    $class_id = intval($_POST['class_id'] ?? 0);
    $is_summative = isset($_POST['is_summative']) ? 1 : 0;
    $weight_percent = $is_summative && !empty($_POST['weight_percent']) ? floatval($_POST['weight_percent']) : null;

    if ($title && $class_id > 0) {
        $insert = $conn->prepare("
            INSERT INTO quizzes 
            (title, class_id, created_by, is_summative, weight_percent, duration, publish_marks,
             academic_year_id, term_number, created_at, status)
            VALUES (?, ?, ?, ?, ?, 0, 0, ?, ?, NOW(), 'Closed')
        ");
        $insert->bind_param(
            "sisidii", 
            $title,
            $class_id,
            $email,
            $is_summative,
            $weight_percent,
            $current_academic_year_id,
            $current_global_term
        );

        if ($insert->execute()) {
            $quizId = $conn->insert_id;
            $message = "success";
            $finalWeight = $weight_percent ?? 0;
            $weightDisplay = $finalWeight > 0 ? "$finalWeight%" : "Not set";
        } else {
            $message = "Failed to add quiz: " . $insert->error;
        }
        $insert->close();
    } else {
        $message = "Please fill all required fields.";
    }
}
?>

<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="csrf-token" content="<?php echo htmlspecialchars($_SESSION['csrf_token']); ?>">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Manual Add Quiz</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.2/css/all.min.css">
    <style>
        :root { --bg: #0d1117; --card: #1a202c; --text: #e0e6f0; --accent: #4fd1c5; --green: #27ae60; }
        body { margin:0; font-family:Arial; background:var(--bg); color:var(--text); padding:40px; }
        h2 { text-align:center; color:#58a6ff; }
        .box { max-width:400px; margin:20px auto; background:var(--card); padding:20px; border-radius:16px; }
        label { display:block; margin-top:15px; font-weight:600; }
        input, select { width:100%; padding:10px; margin-top:5px; background:#21262d; border:1px solid #30363d; border-radius:8px; color:var(--text); }
        button { width:100%; padding:12px; margin-top:20px; background:var(--green); color:white; border:none; border-radius:12px; font-weight:bold; cursor:pointer; }
        .info { text-align:center; border-left:5px solid var(--accent); padding:15px; margin-top:20px; background:#1a202c; border-radius:12px; }
        .info strong { color:#58a6ff; }
        .actions { margin-top:15px; display:flex; gap:10px; justify-content:center; }
        .actions a { padding:8px 16px; border-radius:8px; text-decoration:none; font-weight:bold; font-size:13px; }
        .edit { background:#58a6ff; color:#0d1117; }
        .back { background:#30363d; color:var(--text); }
        .checkbox { display:flex; align-items:center; gap:8px; margin-top:12px; font-size:13px; }
        #weightContainer { display:none; margin-top:10px; }
        #weightContainer input { max-width:120px; }
    </style>
</head>
<body>

<h2>Manual Add Quiz</h2>

<?php if ($message === "success"): ?>
    <div class="box info">
        <p style="color:var(--green); font-weight:bold;">Quiz added successfully!</p>
        <p> Now you can go to learner grades and find the name of the quiz you just created and then edit marks for all learners in class</p>
        <div class="actions">
           
            <a href="teacher_quizzes.php" class="back">Back</a>
        </div>
    </div>
<?php else: ?>
    <div class="box">
        <?php if ($message && $message !== "success"): ?>
            <p style="color:#c0392b; text-align:center;"><?= htmlspecialchars($message) ?></p>
        <?php endif; ?>

        <form method="POST">
            <input type="hidden" name="csrf_token" value="<?php echo htmlspecialchars($_SESSION['csrf_token']); ?>">
            <label>Quiz Title:</label>
            <input type="text" name="title" required>

            <label>Assign to Class:</label>
            <select name="class_id" required>
                <option value="">-- Select --</option>
                <?php mysqli_data_seek($classResult, 0); while ($c = $classResult->fetch_assoc()): ?>
                    <option value="<?= $c['id'] ?>"><?= htmlspecialchars($c['name']) ?></option>
                <?php endwhile; ?>
            </select>

            <!-- TERM INFO BOX — BEAUTIFUL & CLEAR -->
            <div style="background:#1a202c; padding:18px; border-radius:12px; border-left:5px solid #4fd1c5; margin:25px 0; text-align:center; font-size:1.1rem;">
                <strong style="color:#4fd1c5; font-size:1.3rem;">Posting to: TERM <?= $current_global_term ?></strong><br>
                <small style="color:#8b949e;">This manual quiz automatically belongs to the current term.<br>You (Super Admin) control the current term globally.</small>
            </div>

            <div class="checkbox">
                <input type="checkbox" name="is_summative" id="summative">
                <label for="summative">Counts toward term mark</label>
            </div>

            <div id="weightContainer">
                <label>Weight %:</label>
                <input type="number" name="weight_percent" min="0" max="100" step="0.1" placeholder="30">
            </div>

            <button type="submit">Add Quiz</button>
        </form>
    </div>
<?php endif; ?>

<script>
    document.getElementById('summative')?.addEventListener('change', function() {
        document.getElementById('weightContainer').style.display = this.checked ? 'block' : 'none';
    });
</script>

</body>
</html>
