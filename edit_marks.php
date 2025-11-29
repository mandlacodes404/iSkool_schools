<?php
session_start();
include("config.php");

if (!isset($_SESSION['email']) || $_SESSION['role'] !== 'teacher') {
    header("Location: index.php");
    exit();
}

if (!isset($_GET['quiz_id']) || !isset($_GET['user_email'])) {
    echo "Missing quiz ID or user email.";
    exit();
}

$quizId = intval($_GET['quiz_id']);
$userEmail = $_GET['user_email'];

// Fetch quiz title and default total
$quizStmt = $conn->prepare("SELECT title FROM quizzes WHERE id = ?");
$quizStmt->bind_param("i", $quizId);
$quizStmt->execute();
$quizResult = $quizStmt->get_result();
$quiz = $quizResult->fetch_assoc();
$quizTitle = $quiz['title'] ?? 'Unknown Quiz';
$defaultTotal = 100; // Or any default total you prefer
$quizStmt->close();

// Handle form submission
$success = '';
$error = '';
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $score = floatval($_POST['score']);
    $total = floatval($_POST['total']);

    // Check if result already exists
    $checkStmt = $conn->prepare("SELECT id FROM quiz_results WHERE quiz_id = ? AND user_email = ?");
    $checkStmt->bind_param("is", $quizId, $userEmail);
    $checkStmt->execute();
    $checkResult = $checkStmt->get_result();

    if ($checkResult->num_rows > 0) {
        // Update
        $updateStmt = $conn->prepare("UPDATE quiz_results SET score = ?, total = ?, submitted_at = NOW(), time_taken = 0 WHERE quiz_id = ? AND user_email = ?");
        $updateStmt->bind_param("ddis", $score, $total, $quizId, $userEmail);
        $updateStmt->execute();
        $success = "Marks updated successfully.";
    } else {
        // Insert
        $insertStmt = $conn->prepare("INSERT INTO quiz_results (quiz_id, user_email, score, total, submitted_at, time_taken) VALUES (?, ?, ?, ?, NOW(), 0)");
        $insertStmt->bind_param("isdd", $quizId, $userEmail, $score, $total);
        $insertStmt->execute();
        $success = "Marks added successfully.";
    }
}
?>

<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Edit Marks for <?= htmlspecialchars($userEmail) ?></title>
    <style>
        body { font-family: Arial; background: #f9f9f9; padding: 40px; }
        .form-box {
            max-width: 500px;
            margin: 0 auto;
            background: #fff;
            padding: 25px;
            border-radius: 8px;
            box-shadow: 0 0 10px rgba(0,0,0,0.05);
        }
        h2 { text-align: center; margin-bottom: 20px; }
        label {
            display: block;
            margin-bottom: 6px;
            font-weight: bold;
        }
        input[type="number"] {
            width: 100%;
            padding: 8px;
            margin-bottom: 15px;
        }
        button {
            width: 100%;
            padding: 10px;
            background-color: #2980b9;
            color: #fff;
            border: none;
            cursor: pointer;
            font-size: 16px;
        }
        .message {
            text-align: center;
            margin-top: 15px;
            font-weight: bold;
        }
        .success { color: green; }
        .error { color: red; }
        .back-link {
            display: block;
            text-align: center;
            margin-top: 25px;
            color: #2980b9;
            font-weight: bold;
            text-decoration: none;
        }
    </style>
</head>
<body>

<div class="form-box">
    <h2>Edit Marks for <?= htmlspecialchars($userEmail) ?></h2>
    <form method="POST">
        <label for="score">Score:</label>
        <input type="number" step="0.01" name="score" id="score" required>

        <label for="total">Out Of:</label>
        <input type="number" step="0.01" name="total" id="total" value="<?= $defaultTotal ?>" required>

        <button type="submit">Save</button>
    </form>

    <?php if ($success): ?>
        <p class="message success"><?= $success ?></p>
    <?php elseif ($error): ?>
        <p class="message error"><?= $error ?></p>
    <?php endif; ?>

    <a href="quiz_grades.php?quiz_id=<?= $quizId ?>" class="back-link">← Back to Quiz Grades</a>
</div>

</body>
</html>
