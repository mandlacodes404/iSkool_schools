<?php
ob_start();
error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);
ini_set('error_log', 'php_errors.log');

session_start();
// Determine if we are in the mobile app view
$isMobileApp = isset($_SESSION['app_mode']) && $_SESSION['app_mode'] === true;

require_once 'config.php';

// Security and Session Check
if ($_SERVER['REQUEST_METHOD'] !== 'POST' || !isset($_SESSION['email']) || $_SESSION['role'] !== 'learner' || !isset($_POST['quiz_id'])) {
    header("Location: index.php");
    exit();
}

$quizId = intval($_POST['quiz_id']);
$userEmail = $_SESSION['email'];

// Fetch quiz info
$quizStmt = $conn->prepare("SELECT title, publish_marks, status FROM quizzes WHERE id = ?");
$quizStmt->bind_param("i", $quizId);
if (!$quizStmt->execute()) {
    error_log("Quiz fetch failed: " . $quizStmt->error);
    echo "Database error. Please try again later.";
    exit();
}
$quizResult = $quizStmt->get_result();
if ($quizResult->num_rows === 0) {
    header("Location: learner_dashboard.php");
    exit();
}
$quiz = $quizResult->fetch_assoc();
$quizTitle = $quiz['title'];
$publishMarks = $quiz['publish_marks'];
$status = $quiz['status'] ?? 'Open';
$quizStmt->close();

// --- SCENARIO 1: QUIZ IS CLOSED ---
if ($status === 'Closed') {
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Quiz Closed</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.2/css/all.min.css" />
    <style>
        :root { --bg-color: #0d1117; --card-bg: #1a202c; --text-color: #e0e6f0; --accent-color: #4fd1c5; --error-color: #f85149; --card-radius: 12px; }
        body { font-family: 'Inter', sans-serif; background-color: var(--bg-color); color: var(--text-color); display: flex; flex-direction: column; justify-content: center; align-items: center; height: 100vh; margin: 0; padding: 20px; text-align: center; }
        h1 { color: var(--error-color); font-size: 2.5rem; margin-bottom: 20px; display: flex; align-items: center; gap: 10px; }
        p { font-size: 1.2rem; margin-bottom: 30px; max-width: 400px; line-height: 1.5; }
        .back-btn { background: transparent; color: var(--text-color); border: none; font-size: 28px; cursor: pointer; margin-top: 20px; }
        .back-btn:hover { color: var(--accent-color); }
    </style>
</head>
<body>
    <div class="container">
        <h1><i class="fas fa-ban"></i> Quiz Closed</h1>
        <p>The quiz "<strong><?= htmlspecialchars($quizTitle) ?></strong>" is closed and cannot be submitted.</p>
        <button class="back-btn" onclick="goBackToDashboard()">
            <i class="fas fa-chevron-left"></i>
        </button>
    </div>

    <script>
    function goBackToDashboard() {
        if (document.referrer.includes('learner_dashboard.php') || document.referrer.includes('teacher_dashboard.php')) {
            history.back();
        } else {
            window.location.href = 'learner_dashboard.php';
        }
    }
    </script>
</body>
</html>
<?php exit(); }

// --- GRADING LOGIC ---
$startTimePost = isset($_POST['start_time']) ? intval($_POST['start_time']) : 0;
$endTime = time();
$timeTaken = ($startTimePost > 0) ? max(0, $endTime - $startTimePost) : null;

$sql = "SELECT q.id AS question_id, q.points, c.id AS correct_choice_id FROM quizquestions q JOIN choices c ON q.id = c.question_id WHERE q.quiz_id = ? AND c.is_correct = 1";
$stmt = $conn->prepare($sql);
$stmt->bind_param("i", $quizId);
$stmt->execute();
$result = $stmt->get_result();

$correctAnswers = [];
$totalPoints = 0;
while ($row = $result->fetch_assoc()) {
    $qid = $row['question_id'];
    $correctAnswers[$qid] = ['correct_choice_id' => $row['correct_choice_id'], 'points' => intval($row['points'])];
    $totalPoints += intval($row['points']);
}
$stmt->close();

$score = 0;
if (isset($_POST['answers']) && is_array($_POST['answers'])) {
    foreach ($correctAnswers as $questionId => $data) {
        $submitted = $_POST['answers'][$questionId] ?? null;
        if ($submitted == $data['correct_choice_id']) { $score += $data['points']; }
    }
}

// --- SAVE RESULTS TO DATABASE ---
$insertResult = $conn->prepare("INSERT INTO quiz_results (user_email, quiz_id, score, total, time_taken, submitted_at) VALUES (?, ?, ?, ?, ?, NOW())");
$insertResult->bind_param("siiii", $userEmail, $quizId, $score, $totalPoints, $timeTaken);
$insertResult->execute();
$resultId = $insertResult->insert_id;
$insertResult->close();

if (!empty($_POST['answers'])) {
    $values = []; $params = []; $types = '';
    foreach ($_POST['answers'] as $questionId => $selectedChoiceId) {
        $values[] = '(?, ?, ?)';
        $params[] = $resultId; $params[] = $questionId; $params[] = $selectedChoiceId;
        $types .= 'iii';
    }
    $sqlAnswers = "INSERT INTO user_answers (result_id, question_id, selected_choice_id) VALUES " . implode(',', $values);
    $answerStmt = $conn->prepare($sqlAnswers);
    $answerStmt->bind_param($types, ...$params);
    $answerStmt->execute();
    $answerStmt->close();
}

$_SESSION['success_message'] = "Quiz submitted successfully!";

// --- SCENARIO 2: RESULTS NOT PUBLISHED ---
if ($publishMarks == 0) {
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Results Not Published</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.2/css/all.min.css" />
    <style>
        :root { --bg-color: #0d1117; --card-bg: #1a202c; --text-color: #e0e6f0; --accent-color: #4fd1c5; --card-radius: 12px; }
        body { font-family: 'Inter', sans-serif; background-color: var(--bg-color); color: var(--text-color); display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; padding: 20px; text-align: center; }
        .container { max-width: 600px; background-color: var(--card-bg); padding: 30px; border-radius: var(--card-radius); box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5); }
        h1 { color: var(--accent-color); font-size: 2.5rem; margin-bottom: 20px; display: flex; align-items: center; gap: 10px; justify-content: center; }
        .back-btn { background: transparent; color: var(--text-color); border: none; font-size: 28px; cursor: pointer; margin-top: 20px; }
        .back-btn:hover { color: var(--accent-color); }
    </style>
</head>
<body>
    <div class="container">
        <h1><i class="fas fa-lock"></i> Submitted!</h1>
        <p>The results for "<strong><?= htmlspecialchars($quizTitle) ?></strong>" have not yet been published. Your score has been recorded.</p>
        <button class="back-btn" onclick="goBackToDashboard()">
            <i class="fas fa-chevron-left"></i>
        </button>
    </div>

    <script>
    function goBackToDashboard() {
        if (document.referrer.includes('learner_dashboard.php') || document.referrer.includes('teacher_dashboard.php')) {
            history.back();
        } else {
            window.location.href = 'learner_dashboard.php';
        }
    }
    </script>
</body>
</html>
<?php exit(); } ?>

<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Quiz Result</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.2/css/all.min.css" />
    <style>
        :root { --bg-color: #0d1117; --card-bg: #1a202c; --text-color: #e0e6f0; --accent-color: #4fd1c5; --card-radius: 12px; }
        body { font-family: 'Inter', sans-serif; background-color: var(--bg-color); color: var(--text-color); display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; padding: 20px; text-align: center; }
        .container { max-width: 600px; }
        h1 { color: var(--accent-color); font-size: 2.5rem; margin-bottom: 20px; display: flex; align-items: center; gap: 10px; justify-content: center; }
        .back-btn { background: transparent; color: var(--text-color); border: none; font-size: 28px; cursor: pointer; margin-top: 20px; }
        .back-btn:hover { color: var(--accent-color); }
    </style>
</head>
<body>
    <div class="container">
        <h1><i class="fas fa-poll"></i> Quiz Result</h1>
        <p style="font-size: 1.5rem;">You scored <strong><?= $score ?></strong> / <strong><?= $totalPoints ?></strong></p>
        <?php if ($timeTaken): ?>
            <p>Time Taken: <strong><?= floor($timeTaken / 60) ?> min <?= $timeTaken % 60 ?> sec</strong></p>
        <?php endif; ?>
        <button class="back-btn" onclick="goBackToDashboard()">
            <i class="fas fa-chevron-left"></i>
        </button>
    </div>

    <script>
    function goBackToDashboard() {
        if (document.referrer.includes('learner_dashboard.php') || document.referrer.includes('teacher_dashboard.php')) {
            history.back();
        } else {
            window.location.href = 'learner_dashboard.php';
        }
    }
    </script>
</body>
</html>