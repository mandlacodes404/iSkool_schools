<?php
require_once __DIR__ . '/auth/session_guard.php';
require_once __DIR__ . '/auth/csrf_helper.php';
include("config.php");

if (!isset($_SESSION['email']) || $_SESSION['role'] !== 'teacher') {
    header("Location: index.php");
    exit();
}

if (!isset($_GET['quiz_id'], $_GET['user_email'], $_GET['result_id'])) {
    echo "Missing quiz, learner, or result ID.";
    exit();
}

$quizId = intval($_GET['quiz_id']);
$userEmail = $_GET['user_email'];
$resultId = intval($_GET['result_id']);
if ($quizId <= 0 || $resultId <= 0) {
    http_response_code(400);
    exit('Invalid grade request.');
}

// 1. Fetch Student Name and Surname
$userStmt = $conn->prepare("SELECT name, surname FROM users WHERE email = ?");
$userStmt->bind_param("s", $userEmail);
$userStmt->execute();
$userResult = $userStmt->get_result();
$userData = $userResult->fetch_assoc();
$fullName = ($userData) ? $userData['name'] . ' ' . $userData['surname'] : $userEmail;
$userStmt->close();

// 2. Fetch Quiz Title
$quizStmt = $conn->prepare("SELECT title, class_id, academic_year_id FROM quizzes WHERE id = ? AND created_by = ?");
$quizStmt->bind_param("is", $quizId, $_SESSION['email']);
$quizStmt->execute();
$quiz = $quizStmt->get_result()->fetch_assoc();
$quizStmt->close();

if (!$quiz) {
    http_response_code(403);
    exit('Access denied.');
}

$learnerStmt = $conn->prepare("
    SELECT 1
    FROM class_students
    WHERE class_id = ? AND student_email = ? AND academic_year_id = ?
    LIMIT 1
");
$learnerStmt->bind_param("isi", $quiz['class_id'], $userEmail, $quiz['academic_year_id']);
$learnerStmt->execute();
$isLearnerInQuizClass = $learnerStmt->get_result()->num_rows > 0;
$learnerStmt->close();

if (!$isLearnerInQuizClass) {
    http_response_code(403);
    exit('Access denied.');
}

$quizTitle = $quiz['title'];

// 3. Fetch Existing Marks (to pre-fill the form)
$existingScore = "";
$existingTotal = 100; 
$scoreStmt = $conn->prepare("SELECT score, total FROM quiz_results WHERE id = ? AND quiz_id = ? AND user_email = ? AND academic_year_id = ?");
$scoreStmt->bind_param("iisi", $resultId, $quizId, $userEmail, $quiz['academic_year_id']);
$scoreStmt->execute();
$scoreRes = $scoreStmt->get_result();
if ($row = $scoreRes->fetch_assoc()) {
    $existingScore = $row['score'];
    $existingTotal = $row['total'];
}
$scoreStmt->close();

// Handle form submission
$success = '';
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    verify_csrf_token();

    $score = floatval($_POST['score']);
    $total = floatval($_POST['total']);
    if ($score < 0 || $total <= 0 || $score > $total) {
        http_response_code(400);
        exit('Score must be between 0 and the total.');
    }

    $updateStmt = $conn->prepare("\n        UPDATE quiz_results SET score = ?, total = ?, submitted_at = NOW()\n        WHERE id = ? AND quiz_id = ? AND user_email = ? AND academic_year_id = ?\n    ");
    $updateStmt->bind_param("ddiisi", $score, $total, $resultId, $quizId, $userEmail, $quiz['academic_year_id']);
    if ($updateStmt->execute() && $updateStmt->affected_rows >= 0) {
        $success = "Marks updated successfully.";
    } else {
        http_response_code(404);
        exit('Result not found.');
    }
    // Update local variables to show new marks in form immediately
    $existingScore = $score;
    $existingTotal = $total;
}
?>

<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8" />
    <meta name="csrf-token" content="<?php echo htmlspecialchars($_SESSION['csrf_token']); ?>">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Edit Marks - <?= htmlspecialchars($fullName) ?></title>
    <style>
        body { 
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
            background: #0d1117; 
            color: #e0e6f0; 
            padding: 40px; 
            display: flex; 
            justify-content: center; 
            align-items: center; 
            min-height: 80vh;
        }
        .form-box {
            width: 100%;
            max-width: 450px;
            background: rgba(22, 27, 34, 0.8);
            padding: 30px;
            border-radius: 16px;
            box-shadow: 0 0 20px rgba(255, 255, 255, 0.05);
            border: 1px solid rgba(255,255,255,0.1);
        }
        h2 { text-align: center; color: white; margin-bottom: 10px; }
        p.subtitle { text-align: center; color: #888; margin-bottom: 25px; font-size: 14px; }
        label { display: block; margin-bottom: 8px; font-weight: bold; color: #c9d1d9; }
        input[type="number"] {
            width: 100%;
            padding: 12px;
            margin-bottom: 20px;
            border-radius: 8px;
            border: 1px solid #30363d;
            background: #0d1117;
            color: white;
            box-sizing: border-box;
        }
        button {
            width: 100%;
            padding: 12px;
            background-color: #238636;
            color: white;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            font-size: 16px;
            font-weight: bold;
            transition: 0.3s;
        }
        button:hover { background-color: #2ea043; }
        .message { text-align: center; margin-top: 15px; padding: 10px; border-radius: 8px; }
        .success { background: rgba(46, 160, 67, 0.15); color: #3fb950; border: 1px solid rgba(63, 185, 80, 0.3); }
        .back-link {
            display: block;
            text-align: center;
            margin-top: 25px;
            color: #58a6ff;
            text-decoration: none;
            font-size: 14px;
        }
        .back-link:hover { text-decoration: underline; }
    </style>
</head>
<body>

<div class="form-box">
    <h2>Edit Marks</h2>
    <p class="subtitle">Student: <strong><?= htmlspecialchars($fullName) ?></strong><br>Quiz: <?= htmlspecialchars($quizTitle) ?></p>
    
    <form method="POST">
        <input type="hidden" name="csrf_token" value="<?php echo htmlspecialchars($_SESSION['csrf_token']); ?>">
        <label for="score">Score Received:</label>
        <input type="number" step="0.01" name="score" id="score" value="<?= htmlspecialchars($existingScore) ?>" placeholder="e.g. 15" required>

        <label for="total">Maximum Possible Score:</label>
        <input type="number" step="0.01" name="total" id="total" value="<?= htmlspecialchars($existingTotal) ?>" required>

        <button type="submit">Update Student Grade</button>
    </form>

    <?php if ($success): ?>
        <div class="message success"><?= $success ?></div>
    <?php endif; ?>

    <a href="quiz_grades.php?quiz_id=<?= $quizId ?>" class="back-link">← Return to Grade List</a>
</div>

</body>
</html>
