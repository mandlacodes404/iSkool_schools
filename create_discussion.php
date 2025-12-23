<?php
session_start();
require_once 'config.php';

if (!isset($_SESSION['email']) || $_SESSION['role'] !== 'learner') {
    header("Location: index.php"); exit();
}

$learner_email = $_SESSION['email'];
$current_year_id = $conn->query("SELECT id FROM academic_years WHERE is_current = 1")->fetch_assoc()['id'];

$classStmt = $conn->prepare("SELECT class_id FROM class_students WHERE student_email = ? AND academic_year_id = ?");
$classStmt->bind_param("si", $learner_email, $current_year_id);
$classStmt->execute();
$class_id = $classStmt->get_result()->fetch_assoc()['class_id'] ?? null;
$classStmt->close();

if (!$class_id) die("Not enrolled in a class.");

$message = "";

// Get teachers who teach this class
$teachers = $conn->query("
    SELECT DISTINCT u.email, CONCAT(COALESCE(u.title,''), ' ', u.surname, ' (', u.name, ')') AS display_name
    FROM users u
    JOIN quizzes q ON u.email = q.created_by
    WHERE q.class_id = $class_id AND u.role = 'teacher'
    ORDER BY u.surname
")->fetch_all(MYSQLI_ASSOC);

if (empty($teachers)) {
    $message = "No teachers found for your class. Contact admin.";
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $title = trim($_POST['title']);
    $message_text = trim($_POST['message']);
    $anonymous = !empty($_POST['anonymous']);
    $tagged_teachers = $_POST['teachers'] ?? [];

    if (empty($title) || empty($message_text) || empty($tagged_teachers)) {
        $message = "Please fill all fields and tag at least one teacher.";
    } else {
        // Get learner's full name from session or DB
        $learner_name = $_SESSION['name'] ?? '';
        $learner_surname = $_SESSION['surname'] ?? '';
        $creator_full_name = $anonymous ? NULL : trim($learner_name . ' ' . $learner_surname);

        // Insert discussion with creator_name
        $stmt = $conn->prepare("
            INSERT INTO class_discussions 
            (title, initial_message, class_id, creator_email, creator_anonymous, creator_name) 
            VALUES (?, ?, ?, ?, ?, ?)
        ");
        $stmt->bind_param("ssisis", $title, $message_text, $class_id, $learner_email, $anonymous, $creator_full_name);
        $stmt->execute();
        $disc_id = $stmt->insert_id;
        $stmt->close();

        // Tag teachers
        $stmt = $conn->prepare("INSERT IGNORE INTO discussion_teachers (discussion_id, teacher_email) VALUES (?, ?)");
        foreach ($tagged_teachers as $t) {
            $stmt->bind_param("is", $disc_id, $t);
            $stmt->execute();
        }
        $stmt->close();

        // EMAIL NOTIFICATIONS REMOVED FOR NOW

        $message = "Discussion created successfully!";
        echo '<script>
            document.addEventListener("DOMContentLoaded", () => {
                const modal = document.getElementById("successModal");
                if (modal) modal.style.display = "flex";
                setTimeout(() => window.location.href = "discussions.php", 2000);
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
    <title>Create Discussion</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.2/css/all.min.css">
    <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@600;700&display=swap" rel="stylesheet">
    <style>
        body { font-family: 'Nunito', sans-serif; background: #0d1117; color: #e0e6f0; padding: 20px; }
        .container { max-width: 800px; margin: auto; background: #161b22; padding: 30px; border-radius: 16px; box-shadow: 0 8px 25px rgba(0,0,0,0.4); }
        h1 { text-align: center; color: #4fd1c5; margin-bottom: 30px; }
        label { display: block; margin: 20px 0 8px; font-weight: 600; font-size: 16px; }
        input[type="text"], textarea { width: 100%; padding: 14px; background: #0d1117; border: 1px solid #30363d; border-radius: 10px; color: #e0e6f0; font-size: 15px; }
        textarea { min-height: 120px; resize: vertical; }
        select[multiple] { width: 100%; padding: 12px; background: #0d1117; border: 1px solid #30363d; border-radius: 10px; color: #e0e6f0; height: 150px; }
        .checkbox { margin: 20px 0; font-size: 15px; }
        button { width: 100%; padding: 18px; background: #4fd1c5; color: black; font-weight: 700; font-size: 18px; border: none; border-radius: 12px; margin-top: 30px; cursor: pointer; transition: 0.3s; }
        button:hover { background: #3ab8ac; transform: translateY(-2px); }
        #successModal { display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(13,17,23,0.85); justify-content: center; align-items: center; z-index: 10000; }
        #successModalContent { background: #161b22; padding: 40px; border-radius: 16px; text-align: center; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
        #successModalContent i { font-size: 60px; color: #1ed760; margin-bottom: 20px; }
        #successModalContent p { font-size: 22px; font-weight: 600; }
    </style>
</head>
<body>
<div class="container">
    <h1><i class="fas fa-comments"></i> Start a New Discussion</h1>

    <?php if ($message): ?>
        <p style="text-align:center; padding:15px; background:<?= strpos($message, 'successfully') ? '#238636' : '#f85149' ?>; border-radius:12px; margin:20px 0;">
            <?= htmlspecialchars($message) ?>
        </p>
    <?php endif; ?>

    <form method="POST">
        <label>Discussion Title *</label>
        <input type="text" name="title" required placeholder="e.g. Help with Quadratic Equations" value="<?= htmlspecialchars($_POST['title'] ?? '') ?>">

        <label>Your Message / Question *</label>
        <textarea name="message" required placeholder="Explain what you need help with or want to discuss..."><?= htmlspecialchars($_POST['message'] ?? '') ?></textarea>

        <label>Tag Teacher(s) * <em>(select at least one — they will moderate)</em></label>
        <select name="teachers[]" multiple required size="6">
            <?php foreach ($teachers as $t): ?>
                <option value="<?= $t['email'] ?>" <?= in_array($t['email'], $_POST['teachers'] ?? []) ? 'selected' : '' ?>>
                    <?= htmlspecialchars($t['display_name']) ?>
                </option>
            <?php endforeach; ?>
        </select>
        <small style="color:#8b949e; display:block; margin-top:8px;">Hold Ctrl (Windows) or Cmd (Mac) to select multiple</small>

        <div class="checkbox">
            <label>
                <input type="checkbox" name="anonymous" <?= !empty($_POST['anonymous']) || !isset($_POST['anonymous']) ? 'checked' : '' ?>>
                Post anonymously (classmates won't see your name)
            </label>
        </div>

        <button type="submit"><i class="fas fa-paper-plane"></i> Create Discussion</button>
    </form>
</div>

<!-- Success Modal -->
<div id="successModal">
    <div id="successModalContent">
        <i class="fas fa-check-circle"></i>
        <p>Discussion created successfully!</p>
    </div>
</div>
</body>
</html>