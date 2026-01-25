<?php
ob_start();
error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);
ini_set('error_log', 'php_errors.log');

session_start();
require_once 'config.php';

// === NEW: Fetch current academic year (this is the only addition here) ===
$currentYearResult = $conn->query("SELECT id FROM academic_years WHERE is_current = 1 LIMIT 1");
if ($currentYearResult->num_rows === 0) {
    die("No active academic year set. Contact your admin.");
}
$current_academic_year_id = (int)$currentYearResult->fetch_assoc()['id'];

// 1. Security Check
if ($_SERVER['REQUEST_METHOD'] !== 'POST' || !isset($_SESSION['email']) || $_SESSION['role'] !== 'learner' || !isset($_POST['quiz_id'])) {
    header("Location: index.php");
    exit();
}

$quizId = intval($_POST['quiz_id']);
$userEmail = $_SESSION['email'];

// 2. Prevent Double Submissions (Crucial for data integrity)
$checkStmt = $conn->prepare("SELECT id FROM quiz_results WHERE user_email = ? AND quiz_id = ?");
$checkStmt->bind_param("si", $userEmail, $quizId);
$checkStmt->execute();
if ($checkStmt->get_result()->num_rows > 0) {
    header("Location: learner_dashboard.php"); 
    exit();
}
$checkStmt->close();

// 3. Fetch Quiz Metadata
$quizStmt = $conn->prepare("SELECT title, publish_marks, status FROM quizzes WHERE id = ?");
$quizStmt->bind_param("i", $quizId);
$quizStmt->execute();
$quiz = $quizStmt->get_result()->fetch_assoc();
if (!$quiz) { header("Location: learner_dashboard.php"); exit(); }

$quizTitle = $quiz['title'];
$publishMarks = (int)$quiz['publish_marks'];
$status = $quiz['status'] ?? 'Open';
$quizStmt->close();

// 4. Handle Closed Status
if ($status === 'Closed') {
    render_page("Quiz Closed", "fas fa-ban", "The quiz \"<strong>" . htmlspecialchars($quizTitle) . "</strong>\" is closed and cannot be submitted.", "#f85149");
    exit();
}

// 5. Grading Preparation
$startTimePost = isset($_POST['start_time']) ? intval($_POST['start_time']) : 0;
$timeTaken = ($startTimePost > 0) ? max(0, time() - $startTimePost) : null;

// Fetch Correct Answers
$sql = "SELECT q.id as qid, q.points, c.id as cid FROM quizquestions q 
        JOIN choices c ON q.id = c.question_id WHERE q.quiz_id = ? AND c.is_correct = 1";
$stmt = $conn->prepare($sql);
$stmt->bind_param("i", $quizId);
$stmt->execute();
$res = $stmt->get_result();
$correctAnswers = [];
$totalPointsAvailable = 0;
while ($row = $res->fetch_assoc()) {
    $correctAnswers[$row['qid']] = ['cid' => $row['cid'], 'pts' => (int)$row['points']];
    $totalPointsAvailable += (int)$row['points'];
}
$stmt->close();

// 6. Consolidate Answers (POST + Database Fallback)
$finalAnswers = isset($_POST['answers']) && is_array($_POST['answers']) ? $_POST['answers'] : [];
if (empty($finalAnswers)) {
    $savedStmt = $conn->prepare("SELECT question_id, selected_choice_id FROM user_answers WHERE user_email = ? AND quiz_id = ?");
    $savedStmt->bind_param("si", $userEmail, $quizId);
    $savedStmt->execute();
    $savedRes = $savedStmt->get_result();
    while ($sRow = $savedRes->fetch_assoc()) { $finalAnswers[$sRow['question_id']] = $sRow['selected_choice_id']; }
    $savedStmt->close();
}

// 7. Scoring
$earnedScore = 0;
foreach ($correctAnswers as $qid => $data) {
    if (isset($finalAnswers[$qid]) && $finalAnswers[$qid] == $data['cid']) {
        $earnedScore += $data['pts'];
    }
}

// 8. DATABASE UPDATES (Transaction-style)
$conn->begin_transaction();
try {
    // A. Insert Result Record — UPDATED with academic_year_id
    $insRes = $conn->prepare("
        INSERT INTO quiz_results (
            user_email, 
            quiz_id, 
            score, 
            total, 
            time_taken, 
            submitted_at,
            academic_year_id
        ) VALUES (?, ?, ?, ?, ?, NOW(), ?)
    ");
    $insRes->bind_param("siiiis", $userEmail, $quizId, $earnedScore, $totalPointsAvailable, $timeTaken, $current_academic_year_id);
    $insRes->execute();
    $resultId = $insRes->insert_id;

    // B. Link/Update user_answers with the Result ID
    if (!empty($finalAnswers)) {
        $ansQuery = "INSERT INTO user_answers (user_email, quiz_id, question_id, selected_choice_id, result_id) 
                     VALUES (?, ?, ?, ?, ?) 
                     ON DUPLICATE KEY UPDATE selected_choice_id = VALUES(selected_choice_id), result_id = VALUES(result_id)";
        $ansStmt = $conn->prepare($ansQuery);
        foreach ($finalAnswers as $qid => $cid) {
            $ansStmt->bind_param("siiii", $userEmail, $quizId, $qid, $cid, $resultId);
            $ansStmt->execute();
        }
    }

    // C. Update Attempt Status
    $updAtt = $conn->prepare("UPDATE quiz_attempts SET status = 'submitted' WHERE user_email = ? AND quiz_id = ?");
    $updAtt->bind_param("si", $userEmail, $quizId);
    $updAtt->execute();

    $conn->commit();
} catch (Exception $e) {
    $conn->rollback();
    error_log("Submission Error: " . $e->getMessage());
    die("An error occurred while saving your results.");
}

// 9. Render Final Page
if ($publishMarks === 0) {
    render_page("Submitted!", "fas fa-lock", "The results for \"<strong>" . htmlspecialchars($quizTitle) . "</strong>\" have not yet been published. Your score has been recorded.");
} else {
    $timeStr = $timeTaken ? floor($timeTaken/60) . " min " . ($timeTaken%60) . " sec" : "N/A";
    render_page("Quiz Result", "fas fa-poll", "You scored <strong>$earnedScore</strong> / <strong>$totalPointsAvailable</strong><br><small>Time Taken: $timeStr</small>");
}

// Helper for UI Consistency

function render_page($title, $icon, $message, $accent = "#4fd1c5") {
    ?>
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">
        <title><?= $title ?></title>
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.2/css/all.min.css" />
        <style>
            :root { --bg-color: #0d1117; --card-bg: #1a202c; --text-color: #e0e6f0; }
            body { font-family: 'Inter', sans-serif; background-color: var(--bg-color); color: var(--text-color); display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; text-align: center; }
            .container { max-width: 500px; padding: 40px; background: var(--card-bg); border-radius: 20px; box-shadow: 0 10px 40px rgba(0,0,0,0.6); position: relative; overflow: hidden; }
            h1 { color: <?= $accent ?>; margin-bottom: 15px; font-size: 2rem; }
            p { font-size: 1.1rem; line-height: 1.6; margin-bottom: 25px; }
            
            /* The 5-Second Wheel Timer */
            .timer-container { position: relative; width: 80px; height: 80px; margin: 20px auto; }
            .timer-svg { transform: rotate(-90deg); width: 80px; height: 80px; }
            .timer-circle {
                fill: none;
                stroke: <?= $accent ?>;
                stroke-width: 6;
                stroke-dasharray: 226; /* Circumference for 40px radius */
                stroke-dashoffset: 226;
                stroke-linecap: round;
                animation: progress-wheel 10s linear forwards;
            }
            .timer-bg { fill: none; stroke: rgba(255,255,255,0.1); stroke-width: 6; }
            
            @keyframes progress-wheel {
                from { stroke-dashoffset: 226; }
                to { stroke-dashoffset: 0; }
            }

            .redirect-text { font-size: 0.9rem; opacity: 0.7; margin-top: 10px; }
        </style>
    </head>
    <body>
        <div class="container">
            <h1><i class="<?= $icon ?>"></i> <?= $title ?></h1>
            <p><?= $message ?></p>
            
            <div class="timer-container">
                <svg class="timer-svg">
                    <circle class="timer-bg" cx="40" cy="40" r="36"></circle>
                    <circle class="timer-circle" cx="40" cy="40" r="36"></circle>
                </svg>
            </div>
            
            <p class="redirect-text">Redirecting to your results in <span id="countdown">10</span> seconds...</p>
        </div>

        <script>
            let timeLeft = 10;
            const countdownElement = document.getElementById('countdown');
            
            const timer = setInterval(() => {
                timeLeft--;
                countdownElement.textContent = timeLeft;
                
                if (timeLeft <= 0) {
                    clearInterval(timer);
                    // Redirect to the grades/results page
                    window.location.href = 'quiz_history.php'; 
                }
            }, 1000);
        </script>
    </body>
    </html>
    <?php
}