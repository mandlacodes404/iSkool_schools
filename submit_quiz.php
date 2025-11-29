<?php
ob_start();
error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);
ini_set('error_log', 'php_errors.log');

session_start();
require_once 'config.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST' || !isset($_SESSION['email']) || $_SESSION['role'] !== 'user' || !isset($_POST['quiz_id'])) {
    header("Location: index.php");
    exit();
}

$quizId = intval($_POST['quiz_id']);
$userEmail = $_SESSION['email'];

// Fetch quiz info (title, publish_marks, status)
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

// Check if quiz is closed
if ($status === 'Closed') {
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Quiz Closed</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.2/css/all.min.css" integrity="sha512-z3gLpd7yknf1YoNbCzqRKc4qyor8gaKU1qmn+CShxbuBusANI9QpRohGBreCFkKxLhei6S9CQXFEbbKuqLg0DA==" crossorigin="anonymous" referrerpolicy="no-referrer" />
    <style>
        :root {
            --bg-color: #0d1117;
            --card-bg: #1a202c;
            --text-color: #e0e6f0;
            --accent-color: #4fd1c5;
            --error-color: #f85149;
            --card-radius: 12px;
            --shadow-glow: rgba(79, 209, 197, 0.3);
        }
        body {
            font-family: 'Inter', Arial, sans-serif;
            background-color: var(--bg-color);
            color: var(--text-color);
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
            padding: 20px;
            text-align: center;
        }
        h1 {
            color: var(--error-color);
            font-size: 2.5rem;
            margin-bottom: 20px;
            display: flex;
            align-items: center;
            gap: 10px;
        }
        p {
            font-size: 1.2rem;
            margin-bottom: 30px;
            max-width: 400px;
            line-height: 1.5;
        }
        a.btn-dashboard {
            background-color: var(--accent-color);
            color: var(--bg-color);
            padding: 12px 30px;
            text-decoration: none;
            border-radius: var(--card-radius);
            font-weight: 600;
            transition: background-color 0.3s ease, box-shadow 0.3s ease;
        }
        a.btn-dashboard:hover {
            background-color: #1ed760;
            box-shadow: 0 0 15px var(--shadow-glow);
        }
        .container {
            max-width: 600px;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1><i class="fas fa-ban"></i> Quiz Closed</h1>
        <p>The quiz "<strong><?= htmlspecialchars($quizTitle) ?></strong>" is closed and cannot be submitted.</p>
        <a class="btn-dashboard" href="quiz_list.php" aria-label="Return to dashboard">Back to Quizzes</a>
    </div>
</body>
</html>
<?php
    exit();
}

// Get learner's school_id
$schoolStmt = $conn->prepare("SELECT school_id FROM users WHERE email = ?");
$schoolStmt->bind_param("s", $userEmail);
if (!$schoolStmt->execute()) {
    error_log("School fetch failed: " . $schoolStmt->error);
    echo "Database error. Please try again later.";
    exit();
}
$schoolStmt->bind_result($studentSchoolId);
$schoolStmt->fetch();
$schoolStmt->close();

// Confirm the quiz belongs to the same school
$quizAccessStmt = $conn->prepare("
    SELECT q.id
    FROM quizzes q
    JOIN users u ON q.created_by = u.email
    WHERE q.id = ? AND u.school_id = ?
");
$quizAccessStmt->bind_param("ii", $quizId, $studentSchoolId);
if (!$quizAccessStmt->execute()) {
    error_log("Quiz access check failed: " . $quizAccessStmt->error);
    echo "Database error. Please try again later.";
    exit();
}
$quizAccessStmt->store_result();
if ($quizAccessStmt->num_rows === 0) {
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Access Denied</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.2/css/all.min.css" integrity="sha512-z3gLpd7yknf1YoNbCzqRKc4qyor8gaKU1qmn+CShxbuBusANI9QpRohGBreCFkKxLhei6S9CQXFEbbKuqLg0DA==" crossorigin="anonymous" referrerpolicy="no-referrer" />
    <style>
        :root {
            --bg-color: #0d1117;
            --card-bg: #1a202c;
            --text-color: #e0e6f0;
            --accent-color: #4fd1c5;
            --error-color: #f85149;
            --card-radius: 12px;
            --shadow-glow: rgba(79, 209, 197, 0.3);
        }
        body {
            font-family: 'Inter', Arial, sans-serif;
            background-color: var(--bg-color);
            color: var(--text-color);
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
            padding: 20px;
            text-align: center;
        }
        h1 {
            color: var(--error-color);
            font-size: 2.5rem;
            margin-bottom: 20px;
            display: flex;
            align-items: center;
            gap: 10px;
        }
        p {
            font-size: 1.2rem;
            margin-bottom: 30px;
            max-width: 400px;
            line-height: 1.5;
        }
        a.btn-dashboard {
            background-color: var(--accent-color);
            color: var(--bg-color);
            padding: 12px 30px;
            text-decoration: none;
            border-radius: var(--card-radius);
            font-weight: 600;
            transition: background-color 0.3s ease, box-shadow 0.3s ease;
        }
        a.btn-dashboard:hover {
            background-color: #1ed760;
            box-shadow: 0 0 15px var(--shadow-glow);
        }
        .container {
            max-width: 600px;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1><i class="fas fa-ban"></i> Access Denied</h1>
        <p>You are not authorized to submit this quiz.</p>
        <a class="btn-dashboard" href="quiz_list.php" aria-label="Return to dashboard">Back to Quizzes</a>
    </div>
</body>
</html>
<?php
    $quizAccessStmt->close();
    exit();
}
$quizAccessStmt->close();

// Calculate time taken
$startTimePost = isset($_POST['start_time']) ? intval($_POST['start_time']) : 0;
$endTime = time();
$timeTaken = ($startTimePost > 0) ? max(0, $endTime - $startTimePost) : null;

// Get correct answers
$sql = "
    SELECT q.id AS question_id, q.points, c.id AS correct_choice_id
    FROM quizquestions q
    JOIN choices c ON q.id = c.question_id
    WHERE q.quiz_id = ? AND c.is_correct = 1
";
$stmt = $conn->prepare($sql);
$stmt->bind_param("i", $quizId);
if (!$stmt->execute()) {
    error_log("Correct answers fetch failed: " . $stmt->error);
    echo "Database error. Please try again later.";
    exit();
}
$result = $stmt->get_result();

$correctAnswers = [];
$totalPoints = 0;
while ($row = $result->fetch_assoc()) {
    $qid = $row['question_id'];
    $correctAnswers[$qid] = [
        'correct_choice_id' => $row['correct_choice_id'],
        'points' => intval($row['points'])
    ];
    $totalPoints += intval($row['points']);
}
$stmt->close();

// Default totalPoints to 0 if no questions found
if ($totalPoints === 0) {
    $totalPoints = 0;
}

// Grade the quiz
$score = 0;
foreach ($correctAnswers as $questionId => $data) {
    $submitted = $_POST['answers'][$questionId] ?? null;
    if ($submitted == $data['correct_choice_id']) {
        $score += $data['points'];
    }
}

// Check for existing attempt
$attemptCheck = $conn->prepare("SELECT user_email FROM quiz_attempts WHERE user_email = ? AND quiz_id = ?");
$attemptCheck->bind_param("si", $userEmail, $quizId);
if (!$attemptCheck->execute()) {
    error_log("Attempt check failed: " . $attemptCheck->error);
    echo "Database error. Please try again later.";
    exit();
}
$attemptResult = $attemptCheck->get_result();
if ($attemptResult->num_rows > 0) {
    // Update existing attempt
    $updateAttempt = $conn->prepare("UPDATE quiz_attempts SET last_attempt = NOW() WHERE user_email = ? AND quiz_id = ?");
    $updateAttempt->bind_param("si", $userEmail, $quizId);
    if (!$updateAttempt->execute()) {
        error_log("Attempt update failed: " . $updateAttempt->error);
        echo "Database error. Please try again later.";
        exit();
    }
    $updateAttempt->close();
} else {
    // Insert new attempt
    $insertAttempt = $conn->prepare("INSERT INTO quiz_attempts (user_email, quiz_id, last_attempt) VALUES (?, ?, NOW())");
    $insertAttempt->bind_param("si", $userEmail, $quizId);
    if (!$insertAttempt->execute()) {
        error_log("Attempt insert failed: " . $insertAttempt->error);
        echo "Database error. Please try again later.";
        exit();
    }
    $insertAttempt->close();
}
$attemptCheck->close();

// Save result
$insertResult = $conn->prepare("
    INSERT INTO quiz_results (user_email, quiz_id, score, total, time_taken, submitted_at)
    VALUES (?, ?, ?, ?, ?, NOW())
");
$insertResult->bind_param("siiii", $userEmail, $quizId, $score, $totalPoints, $timeTaken);
if (!$insertResult->execute()) {
    error_log("Result insert failed: " . $insertResult->error);
    echo "Database error. Please try again later.";
    exit();
}
$resultId = $insertResult->insert_id;
$insertResult->close();

// Save selected answers
$values = [];
$params = [];
$types = '';
foreach ($_POST['answers'] as $questionId => $selectedChoiceId) {
    $values[] = '(?, ?, ?)';
    $params[] = $resultId;
    $params[] = $questionId;
    $params[] = $selectedChoiceId;
    $types .= 'iii';
}
if (!empty($values)) {
    $sqlAnswers = "INSERT INTO user_answers (result_id, question_id, selected_choice_id) VALUES " . implode(',', $values);
    $answerStmt = $conn->prepare($sqlAnswers);
    $answerStmt->bind_param($types, ...$params);
    if (!$answerStmt->execute()) {
        error_log("User answers insert failed: " . $answerStmt->error);
        echo "Database error. Please try again later.";
        exit();
    }
    $answerStmt->close();
}

// Set success message
$_SESSION['success_message'] = "Quiz submitted successfully!";

// Check publish_marks and show appropriate page
if ($publishMarks == 0) {
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Results Not Published</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.2/css/all.min.css" integrity="sha512-z3gLpd7yknf1YoNbCzqRKc4qyor8gaKU1qmn+CShxbuBusANI9QpRohGBreCFkKxLhei6S9CQXFEbbKuqLg0DA==" crossorigin="anonymous" referrerpolicy="no-referrer" />
    <style>
        :root {
            --bg-color: #0d1117;
            --card-bg: #1a202c;
            --text-color: #e0e6f0;
            --accent-color: #4fd1c5;
            --card-radius: 12px;
            --shadow-glow: rgba(79, 209, 197, 0.3);
        }
        body {
            font-family: 'Inter', Arial, sans-serif;
            background-color: var(--bg-color);
            color: var(--text-color);
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
            padding: 20px;
            text-align: center;
        }
        .container {
            max-width: 600px;
            background-color: var(--card-bg);
            padding: 30px;
            border-radius: var(--card-radius);
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
        }
        h1 {
            color: var(--accent-color);
            font-size: 2.5rem;
            margin-bottom: 20px;
            display: flex;
            align-items: center;
            gap: 10px;
        }
        p {
            font-size: 1.2rem;
            margin-bottom: 20px;
            line-height: 1.6;
        }
        .btn-group a {
            display: inline-block;
            margin: 10px 15px;
            padding: 12px 30px;
            background-color: var(--accent-color);
            color: var(--bg-color);
            text-decoration: none;
            border-radius: var(--card-radius);
            font-weight: 600;
            transition: background-color 0.3s ease, box-shadow 0.3s ease;
        }
        .btn-group a:hover {
            background-color: #1ed760;
            box-shadow: 0 0 15px var(--shadow-glow);
        }
        .contact-info {
            font-size: 1rem;
            color: #a0aec0;
            margin-top: 20px;
        }
        .contact-info a {
            color: var(--accent-color);
            text-decoration: none;
        }
        .contact-info a:hover {
            text-decoration: underline;
        }
        #loaderOverlay {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(13, 17, 23, 0.85);
            display: none;
            justify-content: center;
            align-items: center;
            flex-direction: column;
            z-index: 9999;
        }
        .loader {
            border: 6px solid #f3f3f3;
            border-top: 6px solid var(--accent-color);
            border-radius: 50%;
            width: 60px;
            height: 60px;
            animation: spin 1s linear infinite;
            margin-top: 12px;
        }
        .loader-text {
            color: var(--text-color);
            font-size: 18px;
            font-weight: 600;
            text-align: center;
        }
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
    </style>
</head>
<body>
    <div class="container">
        <h1><i class="fas fa-lock"></i> Results Not Published</h1>
        <p>The results for the quiz "<strong><?= htmlspecialchars($quizTitle) ?></strong>" have not yet been published by your teacher. Please check back later or contact your teacher for more information.</p>
        <p class="contact-info">Need assistance? <a href="contact_teacher.php">Contact your teacher</a>.</p>
        <div class="btn-group">
            <a class="btn-dashboard" href="quiz_list.php" aria-label="Return to dashboard">Back to Quizzes</a>
           
        </div>
    </div>
    <div id="loaderOverlay">
        <div class="loader-text">Processing...</div>
        <div class="loader"></div>
    </div>
    <script>
        window.addEventListener('load', () => {
            const loader = document.getElementById('loaderOverlay');
            loader.style.display = 'flex';
            setTimeout(() => {
                loader.style.display = 'none';
            }, 1000);
        });
    </script>
</body>
</html>
<?php
    exit();
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Quiz Result</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.2/css/all.min.css" integrity="sha512-z3gLpd7yknf1YoNbCzqRKc4qyor8gaKU1qmn+CShxbuBusANI9QpRohGBreCFkKxLhei6S9CQXFEbbKuqLg0DA==" crossorigin="anonymous" referrerpolicy="no-referrer" />
    <style>
        :root {
            --bg-color: #0d1117;
            --card-bg: #1a202c;
            --text-color: #e0e6f0;
            --accent-color: #4fd1c5;
            --card-radius: 12px;
            --shadow-glow: rgba(79, 209, 197, 0.3);
        }
        body {
            font-family: 'Inter', Arial, sans-serif;
            background-color: var(--bg-color);
            color: var(--text-color);
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
            padding: 20px;
            text-align: center;
        }
        h1 {
            color: var(--accent-color);
            font-size: 2.5rem;
            margin-bottom: 20px;
            display: flex;
            align-items: center;
            gap: 10px;
        }
        p {
            font-size: 1.2rem;
            margin-bottom: 20px;
            max-width: 400px;
            line-height: 1.5;
        }
        .btn-group a {
            display: inline-block;
            margin: 10px 15px;
            padding: 12px 30px;
            background-color: var(--accent-color);
            color: var(--bg-color);
            text-decoration: none;
            font-weight: 600;
            border-radius: var(--card-radius);
            transition: background-color 0.3s ease, box-shadow 0.3s ease;
        }
        .btn-group a:hover {
            background-color: #1ed760;
            box-shadow: 0 0 15px var(--shadow-glow);
        }
        .container {
            max-width: 600px;
        }
        #loaderOverlay {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(13, 17, 23, 0.85);
            display: none;
            justify-content: center;
            align-items: center;
            flex-direction: column;
            z-index: 9999;
        }
        .loader {
            border: 6px solid #f3f3f3;
            border-top: 6px solid var(--accent-color);
            border-radius: 50%;
            width: 60px;
            height: 60px;
            animation: spin 1s linear infinite;
            margin-top: 12px;
        }
        .loader-text {
            color: var(--text-color);
            font-size: 18px;
            font-weight: 600;
            text-align: center;
        }
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
    </style>
</head>
<body>
    <div class="container">
        <h1><i class="fas fa-poll"></i> Quiz Result</h1>
        <p>You scored <strong><?= $score ?></strong> out of <strong><?= $totalPoints ?></strong>.</p>
        <?php if ($timeTaken !== null): ?>
            <p>Time Taken: <strong><?= floor($timeTaken / 60) ?> min <?= $timeTaken % 60 ?> sec</strong></p>
        <?php endif; ?>
        <div class="btn-group">
            <a href="quiz_history.php" aria-label="View quiz history">View Quiz History</a>
            <a href="quiz_list.php" aria-label="Return to dashboard">Back to Quizzes</a>
        </div>
    </div>
    <div id="loaderOverlay">
        <div class="loader-text">Processing...</div>
        <div class="loader"></div>
    </div>
    <script>
        window.addEventListener('load', () => {
            const loader = document.getElementById('loaderOverlay');
            loader.style.display = 'flex';
            setTimeout(() => {
                loader.style.display = 'none';
            }, 1000);
        });
    </script>
</body>
</html>
<?php
exit();
?>