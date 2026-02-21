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
        <link rel="icon" type="image/svg+xml" href="/icon.svg?v=1.2">
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.2/css/all.min.css" />
        <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@600&display=swap" rel="stylesheet">
        <style>
            :root { --bg-color: #0d1117; --card-bg: #1a202c; --text-color: #e2e8f0; }
            body { font-family: 'Nunito', sans-serif; background-color: var(--bg-color); color: var(--text-color); display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; text-align: center; }
            .container { max-width: 450px; width: 90%; padding: 30px; background: var(--card-bg); border-radius: 20px; box-shadow: 0 10px 40px rgba(0,0,0,0.5); }
            h1 { color: <?= $accent ?>; margin-bottom: 10px; font-size: 1.8rem; }
            p { font-size: 1.1rem; opacity: 0.9; margin-bottom: 20px; }
            
            /* The 5-Second Wheel */
            .timer-container { position: relative; width: 70px; height: 70px; margin: 15px auto; }
            .timer-svg { transform: rotate(-90deg); width: 70px; height: 70px; }
            .timer-circle {
                fill: none; stroke: <?= $accent ?>; stroke-width: 10;
                stroke-dasharray: 201; stroke-dashoffset: 201; stroke-linecap: round;
                animation: progress-wheel 10s linear forwards;
            }
            .timer-bg { fill: none; stroke: rgba(255,255,255,0.1); stroke-width: 5; }
            @keyframes progress-wheel { from { stroke-dashoffset: 201; } to { stroke-dashoffset: 0; } }
            .redirect-text { font-size: 0.85rem; color: <?= $accent ?>; opacity: 0.8; }
        </style>
    </head>
    <body>
        <div class="container">
            <h1><i class="<?= $icon ?>"></i> <?= $title ?></h1>
            <p><?= $message ?></p>
            
            <div class="timer-container">
                <svg class="timer-svg">
                    <circle class="timer-bg" cx="35" cy="35" r="32"></circle>
                    <circle class="timer-circle" cx="35" cy="35" r="32"></circle>
                </svg>
            </div>
            
            <p class="redirect-text">Saving to Grades <span id="countdown">10</span>s...</p>
        </div>

        <script>
           let timeLeft = 10;
const countdownElement = document.getElementById('countdown');

const timer = setInterval(() => {
    timeLeft--;
    countdownElement.textContent = timeLeft;
    
if (timeLeft <= 0) {
    clearInterval(timer);

    // 1. Update the "Memory" so a refresh doesn't break anything
    sessionStorage.setItem("lastLearnerPage", "quiz_history.php");

    // 2. Talk to the Parent (The Dashboard Brain)
    if (window.parent && window.parent.document) {
        const p = window.parent; // Shortcut to parent window

        // A. Reset the UI: Show Sidebar/Nav and Logo again
        if (typeof p.configureHeader === 'function') {
            p.configureHeader({ title: 'My Grades', mode: 'standard' });
        }

        // B. Toggle Visibility: Hide the API area, Show the Iframe
        const apiArea = p.document.getElementById('api-content-area');
        const iframe = p.document.getElementById('mainFrame');
        
        if (apiArea) apiArea.style.display = 'none';
        if (iframe) {
            iframe.style.display = 'block';
            iframe.src = 'quiz_history.php'; // Load the actual grades
        }

        // C. Update Sidebar Highlight
        if (typeof p.setActive === 'function') {
            p.setActive('quiz_history.php');
        }

    } else {
        // Fallback: If not in an iframe, just go to the dashboard
        window.location.href = 'index.php';
    }
}
}, 1000);
        </script>
    </body>
    </html>
    <?php
}