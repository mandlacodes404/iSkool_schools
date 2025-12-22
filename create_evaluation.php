<?php
session_start();
require_once 'config.php';

if (!isset($_SESSION['email']) || $_SESSION['role'] !== 'teacher') {
    header("Location: index.php"); exit();
}

$teacher_email = $_SESSION['email'];
$message = "";

// Get current year & term
$current_academic_year_id = $conn->query("SELECT id FROM academic_years WHERE is_current = 1 LIMIT 1")->fetch_assoc()['id'];
$current_global_term = $conn->query("SELECT current_global_term FROM platform_settings LIMIT 1")->fetch_assoc()['current_global_term'] ?? 4;

// Get all classes
$classes = $conn->query("SELECT id, name FROM classes ORDER BY name ASC")->fetch_all(MYSQLI_ASSOC);

// Handle form submission
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $title = trim($_POST['title']);
    $description = trim($_POST['description'] ?? '');
    $class_id = (int)$_POST['class_id'];
    $use_default = !empty($_POST['use_default']);

    if (empty($title) || $class_id <= 0) {
        $message = "Please fill all required fields.";
    } else {
        // Insert evaluation
        $stmt = $conn->prepare("INSERT INTO teacher_evaluations (title, description, class_id, created_by, academic_year_id, term_number) VALUES (?, ?, ?, ?, ?, ?)");
        $stmt->bind_param("ssisii", $title, $description, $class_id, $teacher_email, $current_academic_year_id, $current_global_term);
        $stmt->execute();
        $eval_id = $stmt->insert_id;
        $stmt->close();

        if ($use_default) {
            // Copy from default template (assumes default has evaluation_id = 1)
            $conn->query("INSERT INTO evaluation_statements (evaluation_id, statement, order_num)
                          SELECT $eval_id, statement, order_num FROM evaluation_statements WHERE evaluation_id = 1");
        }

        // Custom statements (if any)
        if (isset($_POST['statements']) && is_array($_POST['statements'])) {
            $stmt = $conn->prepare("INSERT INTO evaluation_statements (evaluation_id, statement, order_num) VALUES (?, ?, ?)");
            foreach ($_POST['statements'] as $order => $stmt_text) {
                if (trim($stmt_text) !== '') {
                    $stmt->bind_param("isi", $eval_id, $stmt_text, $order);
                    $stmt->execute();
                }
            }
            $stmt->close();
        }

        $message = "Evaluation released successfully!";
        echo '<script>
            document.addEventListener("DOMContentLoaded", () => {
                const modal = document.getElementById("successModal");
                if (modal) modal.style.display = "flex";
                setTimeout(() => window.location.href = "teacher_dashboard.php", 2000);
            });
        </script>';
    }
}
?>

<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Create Teacher Evaluation</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.2/css/all.min.css">
    <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@600;700&display=swap" rel="stylesheet">
    <style>
        body { font-family: 'Nunito', sans-serif; background: #0d1117; color: #e0e6f0; padding: 30px; }
        .container { max-width: 800px; margin: auto; background: #161b22; padding: 30px; border-radius: 12px; }
        h1 { text-align: center; color: #4fd1c5; }
        label { display: block; margin: 15px 0 5px; font-weight: 600; }
        input, textarea, select { width: 100%; padding: 10px; background: #0d1117; border: 1px solid #30363d; border-radius: 8px; color: #e0e6f0; }
        .statement { margin: 15px 0; }
        .add-btn { background: #4fd1c5; color: black; border: none; padding: 8px 12px; border-radius: 6px; cursor: pointer; margin-top: 10px; }
        button[type="submit"] { width: 100%; padding: 15px; background: #4fd1c5; color: black; font-weight: 700; border: none; border-radius: 10px; margin-top: 20px; cursor: pointer; }
        #successModal { display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(13,17,23,0.85); justify-content: center; align-items: center; z-index: 10000; }
        #successModalContent { background: #161b22; padding: 30px; border-radius: 12px; text-align: center; }
        #successModalContent i { font-size: 50px; color: #238636; }
        #successModalContent p { font-size: 20px; margin: 15px 0; }
    </style>
</head>
<body>
<div class="container">
    <h1><i class="fas fa-poll"></i> Create Teacher Evaluation</h1>

    <?php if ($message): ?>
        <p style="text-align:center; color:#ffd43b;"><?= htmlspecialchars($message) ?></p>
    <?php endif; ?>

    <form method="POST">
        <label>Title *</label>
        <input type="text" name="title" required value="<?= htmlspecialchars($_POST['title'] ?? '') ?>">

        <label>Description (optional)</label>
        <textarea name="description" rows="3"><?= htmlspecialchars($_POST['description'] ?? '') ?></textarea>

        <label>Class *</label>
        <select name="class_id" required>
            <option value="">-- Select Class --</option>
            <?php foreach ($classes as $class): ?>
                <option value="<?= $class['id'] ?>" <?= ($_POST['class_id'] ?? '') == $class['id'] ? 'selected' : '' ?>>
                    <?= htmlspecialchars($class['name']) ?>
                </option>
            <?php endforeach; ?>
        </select>

        <label><input type="checkbox" name="use_default" checked> Use default questions (recommended)</label>

        <div id="statements">
            <p><strong>Questions:</strong> (Edit or add more below)</p>
            <!-- Dynamic statements will be added via JS if not using default -->
        </div>

        <button type="button" class="add-btn" onclick="addStatement()">+ Add Question</button>

        <button type="submit">Release Evaluation</button>
    </form>
</div>

<!-- Success Modal -->
<div id="successModal">
    <div id="successModalContent">
        <i class="fas fa-check-circle"></i>
        <p>Evaluation released successfully!</p>
    </div>
</div>

<script>
function addStatement() {
    const div = document.getElementById('statements');
    const count = div.querySelectorAll('.statement').length;
    const el = document.createElement('div');
    el.className = 'statement';
    el.innerHTML = `
        <textarea name="statements[${count}]" rows="2" placeholder="Enter question..."></textarea>
    `;
    div.appendChild(el);
}
</script>
</body>
</html>