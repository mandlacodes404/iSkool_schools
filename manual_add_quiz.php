<?php
session_start();
include("config.php");

if (!isset($_SESSION['email']) || $_SESSION['role'] !== 'teacher') {
    header("Location: index.php");
    exit();
}

$email = $_SESSION['email'];
$schoolId = $_SESSION['school_id'] ?? 0;
$message = "";

if (!$schoolId) die("School missing.");

// GET CURRENT ACADEMIC YEAR
$currentYearStmt = $conn->prepare("SELECT id FROM academic_years WHERE school_id = ? AND is_current = 1 LIMIT 1");
$currentYearStmt->bind_param("i", $schoolId);
$currentYearStmt->execute();
$currentYearResult = $currentYearStmt->get_result();
$currentYearRow = $currentYearResult->fetch_assoc();
$current_academic_year_id = $currentYearRow['id'] ?? null;
$currentYearStmt->close();

if (!$current_academic_year_id) {
    die("No active academic year found.");
}

// GET CURRENT GLOBAL TERM (your throne)
$current_global_term = 4; // fallback
$termResult = $conn->query("SELECT current_global_term FROM platform_settings LIMIT 1");
if ($termRow = $termResult->fetch_assoc()) {
    $current_global_term = (int)$termRow['current_global_term'];
}

$classStmt = $conn->prepare("SELECT id, name FROM classes WHERE school_id = ? ORDER BY name");
$classStmt->bind_param("i", $schoolId);
$classStmt->execute();
$classResult = $classStmt->get_result();

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
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
            $current_academic_year_id,   // 6th → goes into academic_year_id
            $current_global_term         // 7th → goes into term_number
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
        <p><strong>Total Marks:</strong> <span>Not set (no questions yet)</span></p>
        <p><strong>Weight:</strong> <span><?= $weightDisplay ?></span></p>
        <div class="actions">
            <a href="create_quiz.php?manual=<?= $quizId ?>" class="edit">Add Questions & Marks</a>
            <a href="teacher_quizzes.php" class="back">Back</a>
        </div>
    </div>
<?php else: ?>
    <div class="box">
        <?php if ($message && $message !== "success"): ?>
            <p style="color:#c0392b; text-align:center;"><?= htmlspecialchars($message) ?></p>
        <?php endif; ?>

        <form method="POST">
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