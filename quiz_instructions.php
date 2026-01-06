<?php
session_start();
require_once 'config.php';

if (!isset($_SESSION['email']) || $_SESSION['role'] !== 'learner' || !isset($_GET['quiz_id'])) {
    header("Location: index.php");
    exit();
}

$quizId = intval($_GET['quiz_id']);
$userEmail = $_SESSION['email'];

// Fetch quiz info
$stmt = $conn->prepare("SELECT title, duration, attempt_limit FROM quizzes WHERE id = ?");
$stmt->bind_param("i", $quizId);
$stmt->execute();
$stmt->bind_result($quizTitle, $duration, $attemptLimit);
$stmt->fetch();
$stmt->close();

// ────────────────────── YOUR MOBILE DETECTION ──────────────────────
$user_agent = $_SERVER['HTTP_USER_AGENT'] ?? '';
$is_mobile = preg_match("/(android|iphone|ipad|ipod|webos|windows phone|mobile)/i", $user_agent);
// ──────────────────────────────────────────────────────────────────
?>

<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Quiz Instructions</title>
    <style>
        /* --- YOUR MOBILE CSS OVERRIDES --- */
        <?php if ($is_mobile): ?>
        body { padding: 10px !important; margin: 0 !important; background: #0d1117 !important; }
        .container { max-width: 100% !important; width: 100% !important; margin: 0 !important; border-radius: 0 !important; padding: 20px !important; box-sizing: border-box; box-shadow: none !important; }
        <?php endif; ?>

        body {
            font-family: Arial, sans-serif;
            background-color: #0d1117;
            color: #e0e6f0;
            margin: 0;
            padding: 30px;
        }
        .container {
            max-width: 700px;
            margin: auto;
            background-color: #161b22;
            padding: 30px;
            border-radius: 12px;
            box-shadow: 0 0 20px rgba(0, 191, 255, 0.15);
        }
        h2 { color: #c9d1d9; margin-bottom: 20px; font-weight: 600; text-align: center; }
        ul { list-style-type: disc; padding-left: 20px; }
        li { margin-bottom: 10px; color: #c9d1d9; font-size: 15px; }
        .quiz-info { background-color: #21262d; padding: 15px; border-radius: 8px; margin-bottom: 20px; color: #8b949e; font-size: 15px; }
        .start-btn {
            background-color: #238636; color: white; padding: 12px 25px; border: none; border-radius: 8px;
            font-size: 16px; font-weight: 600; cursor: pointer; transition: background-color 0.3s ease;
            display: block; margin: 0 auto; width: 100%; max-width: 300px;
            box-shadow: 0 2px 8px rgba(35, 134, 54, 0.5);
        }
        .start-btn:hover { background-color: #2ea043; }
    </style>
</head>
<body>

<div class="container">
    <h2>📚 Quiz Instructions</h2>

    <div class="quiz-info">
        <p><strong>Quiz Title:</strong> <?= htmlspecialchars($quizTitle) ?></p>
        <p><strong>Duration:</strong> <?= $duration ?> minutes</p>
        <p><strong>Attempts Allowed:</strong> <?= $attemptLimit ?></p>
    </div>

    <h3 style="color:#c9d1d9;">⚠️ Please read carefully:</h3>
    <ul>
        <li>You can only attempt this quiz <strong><?= $attemptLimit ?></strong> time(s).</li>
        <li>Once you begin, the timer will start immediately.</li>
        <li>Make sure your internet connection is stable.</li>
        <li>Only click "Start Quiz" when you're ready.</li>
    </ul>

    <form method="GET" action="take_quiz.php" <?= $is_mobile ? 'target="_blank"' : '' ?>>
        <input type="hidden" name="quiz_id" value="<?= $quizId ?>">
        
        <?php if ($is_mobile): ?>
            <input type="hidden" name="mobile" value="true">
        <?php endif; ?>
        
        <button type="submit" class="start-btn">✅ Start Quiz</button>
    </form>
</div>

</body>
</html>