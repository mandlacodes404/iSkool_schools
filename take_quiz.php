<?php
ob_start();
error_reporting(E_ALL);
ini_set('display_errors', 1);
ini_set('log_errors', 1);
ini_set('error_log', 'php_errors.log');

session_start();
// ────────────────────── UPDATED MOBILE DETECTION ──────────────────────
$user_agent = $_SERVER['HTTP_USER_AGENT'] ?? '';
$is_mobile_ua = preg_match("/(android|iphone|ipad|ipod|webos|windows phone|mobile)/i", $user_agent);
$is_mobile_get = (isset($_GET['mobile']) && $_GET['mobile'] == 'true');

// If either is true, we are in Mobile App mode
$isMobileApp = ($is_mobile_ua || $is_mobile_get);
// ──────────────────────────────────────────────────────────────────────
require_once 'config.php';

if (!isset($_SESSION['email']) || $_SESSION['role'] !== 'learner' || !isset($_GET['quiz_id'])) {
    header("Location: index.php");
    exit();
}

$userEmail = $_SESSION['email'];
$quizId = intval($_GET['quiz_id']);

// Fetch quiz details
$quizStmt = $conn->prepare("SELECT title, duration, status, layout_mode, shuffle_questions FROM quizzes WHERE id = ?");
$quizStmt->bind_param("i", $quizId);
if (!$quizStmt->execute()) {
    error_log("Quiz fetch failed: " . $quizStmt->error);
    echo "Database error. Please try again later.";
    exit();
}
$quizResult = $quizStmt->get_result();
if ($quizResult->num_rows === 0) {
    echo "Invalid quiz ID.";
    exit();
}
$quiz = $quizResult->fetch_assoc();
$layoutType = $quiz['layout_mode'] ?? 'single_page';
$quizTitle = $quiz['title'];
$quizDuration = $quiz['duration'];
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

        /* Only show the mobile exit button when in App Mode */
.mobile-exit-nav {
    display: none; 
}

<?php if ($isMobileApp): ?>
.mobile-exit-nav {
    display: block;
    padding: 10px 0;
    margin-bottom: 10px;
    border-bottom: 1px solid var(--border-color);
}

.btn-exit {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    color: var(--accent-color);
    text-decoration: none;
    font-weight: 600;
    font-size: 16px;
    background: none;
    border: none;
    cursor: pointer;
}
<?php endif; ?>
    </style>
</head>
<body>
    <div class="container">
        <h1><i class="fas fa-ban"></i> Quiz Closed</h1>
        <p>The quiz "<strong><?= htmlspecialchars($quizTitle) ?></strong>" is closed and cannot be attempted.</p>
        <a class="btn-dashboard" href="quiz_list.php" aria-label="Return to dashboard">Back to Quizzes</a>
    </div>
</body>
</html>
<?php
    exit();
}

// School and class access control
$classCheck = $conn->prepare("
    SELECT cs.class_id
    FROM class_students cs
    WHERE cs.student_email = ?
    LIMIT 1
");
$classCheck->bind_param("s", $userEmail);
if (!$classCheck->execute()) {
    error_log("Class check failed: " . $classCheck->error);
    echo "Database error. Please try again later.";
    exit();
}
$classInfo = $classCheck->get_result()->fetch_assoc();
$classCheck->close();

if (!$classInfo) {
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
        <p>You are not assigned to any class.</p>
        <a class="btn-dashboard" href="quiz_list.php" aria-label="Return to dashboard">Back to Quizzes</a>
    </div>
</body>
</html>
<?php
    exit();
}

$learnerClassId = $classInfo['class_id'];


$verifyQuiz = $conn->prepare("
    SELECT q.class_id 
    FROM quizzes q
    WHERE q.id = ?
");
$verifyQuiz->bind_param("i", $quizId);
if (!$verifyQuiz->execute()) {
    error_log("Quiz verification failed: " . $verifyQuiz->error);
    echo "Database error. Please try again later.";
    exit();
}
$quizCheck = $verifyQuiz->get_result()->fetch_assoc();
$verifyQuiz->close();

if (!$quizCheck || $quizCheck['class_id'] != $learnerClassId) {
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
        <p>This quiz is not for your class.</p>
        <a class="btn-dashboard" href="quiz_list.php" aria-label="Return to dashboard">Back to Quizzes</a>
    </div>
</body>
</html>
<?php
    exit();
}

// Check for prior attempt (optional warning)
$priorAttempt = null;
$attemptCheck = $conn->prepare("SELECT id, score, submitted_at FROM quiz_results WHERE user_email = ? AND quiz_id = ?");
$attemptCheck->bind_param("si", $userEmail, $quizId);
if (!$attemptCheck->execute()) {
    error_log("Prior attempt check failed: " . $attemptCheck->error);
} else {
    $attemptResult = $attemptCheck->get_result();
    $priorAttempt = $attemptResult->fetch_assoc();
}
$attemptCheck->close();

// ==========================================
// START OF WORLD-CLASS TIMER LOGIC
// ==========================================

// 1. Check if an active attempt exists in the quiz_attempts table
// We use 'start_time' to calculate the real ticking clock
$checkAttempt = $conn->prepare("SELECT start_time, status FROM quiz_attempts WHERE user_email = ? AND quiz_id = ?");
$checkAttempt->bind_param("si", $userEmail, $quizId);
$checkAttempt->execute();
$attemptData = $checkAttempt->get_result()->fetch_assoc();

$currentTime = time();

if (!$attemptData) {
    // Brand new attempt: Record the start time NOW
    $now = date('Y-m-d H:i:s');

    $insertAttempt = $conn->prepare("
        INSERT INTO quiz_attempts (user_email, quiz_id, start_time, status) 
        VALUES (?, ?, ?, 'in_progress')
    ");
    $insertAttempt->bind_param("sis", $userEmail, $quizId, $now);

    if ($insertAttempt->execute()) {
        // Success - normal flow
        $startTime = $currentTime;
    } else {
        // ERROR HAPPENED → Show it clearly so we can see why
        $errorMessage = "Failed to create quiz attempt for user $userEmail on quiz $quizId: " . $insertAttempt->error;
        error_log($errorMessage);  // Also log it
        die("<div style='color:red; padding:20px; background:#fee; border:2px solid red; margin:20px; font-family:Arial;'>
            <h2>DEBUG ERROR - Quiz Start Failed</h2>
            <p>$errorMessage</p>
            <p><strong>Please copy this message and send it to your developer.</strong></p>
            <p>After fixing, refresh the page to try again.</p>
        </div>");
    }

    $insertAttempt->close();
} else {
    // Resume existing attempt (keep your original code here)
    if ($attemptData['status'] !== 'in_progress') {
        header("Location: quiz_results.php?quiz_id=" . $quizId);
        exit();
    }
    $startTime = strtotime($attemptData['start_time']);
}

// 2. Calculate the REAL time left
$durationSeconds = $quizDuration * 60;
$elapsedSeconds = $currentTime - $startTime;
$actualTimeLeft = $durationSeconds - $elapsedSeconds;

// ==========================================
// THE SAFETY GATE (Replaces your old redirect)
// ==========================================
if ($actualTimeLeft <= 0) {
    ?>
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>Time Expired</title>
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.2/css/all.min.css" />
        <style>
            body { 
                background: #0d1117; color: #e0e6f0; font-family: 'Inter', sans-serif; 
                display: flex; justify-content: center; align-items: center; 
                height: 100vh; margin: 0; text-align: center;
            }
            .container { max-width: 400px; padding: 20px; }
            h1 { color: #f85149; }
            .loader { 
                border: 4px solid #1a202c; border-top: 4px solid #4fd1c5; 
                border-radius: 50%; width: 40px; height: 40px; 
                animation: spin 1s linear infinite; margin: 20px auto; 
            }
            @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        </style>
    </head>
    <body>
        <div class="container">
            <h1><i class="fas fa-hourglass-end"></i> Time is up!</h1>
            <p>Your quiz session has ended. We are submitting your answers now...</p>
            <div class="loader"></div>
            
            <form id="autoSubmitGate" action="submit_quiz.php" method="POST">
                <input type="hidden" name="quiz_id" value="<?= $quizId ?>">
                <input type="hidden" name="start_time" value="<?= $startTime ?>">
                </form>
        </div>

        <script>
            // Short delay to let the user see the message before the POST happens
            setTimeout(() => {
                document.getElementById('autoSubmitGate').submit();
            }, 2000);
        </script>
    </body>
    </html>
    <?php
    exit(); 
}
// ==========================================

// ==========================================
// END OF WORLD-CLASS TIMER LOGIC
// ==========================================

// Fetch questions + choices
$query = $conn->prepare("
    SELECT q.id AS question_id, q.question_text, q.image_path, q.points,
           c.id AS choice_id, c.choice_text
    FROM quizquestions q
    LEFT JOIN choices c ON q.id = c.question_id
    WHERE q.quiz_id = ?
    ORDER BY q.id, c.id
");
$query->bind_param("i", $quizId);
if (!$query->execute()) {
    error_log("Questions fetch failed: " . $query->error);
    echo "Database error. Please try again later.";
    exit();
}
$result = $query->get_result();

$questions = [];
while ($row = $result->fetch_assoc()) {
    $qid = $row['question_id'];
    if (!isset($questions[$qid])) {
        $questions[$qid] = [
            'text' => $row['question_text'],
            'image' => $row['image_path'],
            'points' => $row['points'],
            'choices' => []
        ];
    }
    if ($row['choice_id']) {
        $questions[$qid]['choices'][] = [
            'id' => $row['choice_id'],
            'text' => $row['choice_text']
        ];
    }
}
$query->close();
// --- SHUFFLE LOGIC ---
// Check if shuffle is enabled in the database for this specific quiz
if (isset($quiz['shuffle_questions']) && $quiz['shuffle_questions'] == 1) {
    // We shuffle the keys (Question IDs) to maintain the link between questions and their choices
    $keys = array_keys($questions);
    shuffle($keys);
    $shuffledQuestions = [];
    foreach ($keys as $key) {
        $shuffledQuestions[$key] = $questions[$key];
        
        // Optional: Shuffle choices within each question too
        if (!empty($shuffledQuestions[$key]['choices'])) {
            shuffle($shuffledQuestions[$key]['choices']);
        }
    }
    $questions = $shuffledQuestions;
}
// ----------------------
// --- FETCH SAVED ANSWERS FROM DATABASE ---
$savedAnswers = [];
$loadStmt = $conn->prepare("SELECT question_id, selected_choice_id FROM user_answers WHERE user_email = ? AND quiz_id = ?");
$loadStmt->bind_param("si", $userEmail, $quizId);
$loadStmt->execute();
$savedResult = $loadStmt->get_result();

while ($row = $savedResult->fetch_assoc()) {
    $savedAnswers[$row['question_id']] = $row['selected_choice_id'];
}
$loadStmt->close();
// ------------------------------------------
?>

<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title><?= htmlspecialchars($quizTitle) ?> - Take Quiz</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.2/css/all.min.css" integrity="sha512-z3gLpd7yknf1YoNbCzqRKc4qyor8gaKU1qmn+CShxbuBusANI9QpRohGBreCFkKxLhei6S9CQXFEbbKuqLg0DA==" crossorigin="anonymous" referrerpolicy="no-referrer" />
    <style>
        :root {
            --bg-color: #0d1117;
            --card-bg: #1a202c;
            --text-color: #e0e6f0;
            --accent-color: #4fd1c5;
            --button-bg: #2c3e50;
            --button-hover-bg: #34495e;
            --card-radius: 12px;
            --shadow-glow: rgba(79, 209, 197, 0.3);
            --border-color: rgba(255, 255, 255, 0.1);
            --warning-color: #f28c38;
            --answered-color: #238636;
            --status-open: #f28c38;
        }

        body {
            font-family: 'Inter', Arial, sans-serif;
            background-color: var(--bg-color);
            color: var(--text-color);
            padding: 20px;
            margin: 0;
            min-height: 100vh;
        }

        .container {
            max-width: 800px;
            margin: 0 auto;
        }

        h2 {
            font-size: 28px;
            color: var(--text-color);
            text-align: center;
            margin-bottom: 20px;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 10px;
        }

        .quiz-info {
            text-align: center;
            font-size: 16px;
            color: var(--accent-color);
            margin-bottom: 20px;
        }

        .quiz-info .status-badge {
            background: var(--status-open);
            color: var(--bg-color);
            padding: 4px 8px;
            border-radius: 10px;
            font-size: 12px;
            font-weight: 600;
            margin-left: 10px;
        }

        #timer {
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: var(--card-bg);
            color: var(--text-color);
            padding: 10px 20px;
            border-radius: var(--card-radius);
            box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
            font-size: 18px;
            font-weight: 600;
            z-index: 1000;
            display: flex;
            align-items: center;
            gap: 10px;
        }

        @media (min-width: 769px) {
            #timer {
                left: auto;
                right: 20px;
                transform: none;
            }
        }

        .timer-circle {
            width: 40px;
            height: 40px;
            position: relative;
        }

        .timer-circle svg {
            transform: rotate(-90deg);
        }

        .timer-circle circle {
            fill: none;
            stroke: var(--accent-color);
            stroke-width: 4;
            stroke-dasharray: 113;
            stroke-dashoffset: 0;
            transition: stroke-dashoffset 1s linear;
        }

        .question-block {
            background: var(--card-bg);
            padding: 20px;
            border-radius: var(--card-radius);
            margin-bottom: 20px;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
            transition: box-shadow 0.3s ease;
        }

        .question-block:hover {
            box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
        }

        .question-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 15px;
        }

        .question-header span {
            font-weight: 600;
            font-size: 16px;
        }

        .points {
            background: var(--accent-color);
            color: var(--bg-color);
            padding: 5px 12px;
            border-radius: 20px;
            font-weight: 600;
            font-size: 14px;
        }

        .flag-btn {
            background: none;
            border: none;
            color: var(--text-color);
            font-size: 16px;
            cursor: pointer;
            transition: color 0.3s ease;
        }

        .flag-btn.flagged {
            color: var(--warning-color);
        }

        .flag-btn:hover {
            color: var(--accent-color);
        }

        .question-block p {
            margin: 10px 0;
            font-size: 16px;
            line-height: 1.5;
        }

        img.quiz-image {
            max-width: 300px;
            height: auto;
            margin: 10px auto;
            border-radius: 8px;
            display: block;
            cursor: zoom-in;
            transition: transform 0.3s ease;
        }

        img.quiz-image:hover {
            transform: scale(1.05);
        }

        /* --- APP MODE OVERRIDES --- */
<?php if ($isMobileApp): ?>
body { padding: 0 !important; margin: 0 !important; background-color: #000 !important; }
.container { max-width: 100% !important; width: 100% !important; margin: 0 !important; border-radius: 0 !important; border: none !important; padding: 10px !important; }
#timer { position: sticky !important; top: 0 !important; width: 100%; border-radius: 0; box-shadow: 0 4px 10px rgba(0,0,0,0.5); }
<?php endif; ?>

/* --- TAPPABLE CHOICE BUTTONS --- */
.choice-label {
    display: flex;
    align-items: center;
    background: #1e293b;
    margin-bottom: 12px;
    padding: 18px; /* Bigger padding for fingers */
    border-radius: 12px;
    border: 1px solid var(--border-color);
    cursor: pointer;
    transition: all 0.2s ease;
}

/* Highlight box when radio is checked */
.choice-label:has(input[type="radio"]:checked) {
    border-color: var(--accent-color);
    background: rgba(79, 209, 197, 0.15);
    box-shadow: 0 0 12px var(--shadow-glow);
}

.choice-label input[type="radio"] {
    width: 22px; /* Bigger radio button */
    height: 22px;
    margin-right: 15px;
    accent-color: var(--accent-color);
}

        input[type="radio"]:checked + span {
            color: var(--answered-color);
            font-weight: 600;
        }

        .submit-btn {
            background: var(--accent-color);
            color: var(--bg-color);
            border: none;
            padding: 12px 30px;
            font-size: 16px;
            font-weight: 600;
            border-radius: var(--card-radius);
            cursor: pointer;
            display: block;
            margin: 30px auto;
            transition: background-color 0.3s ease, box-shadow 0.3s ease;
        }

        .submit-btn:hover {
            background-color: #1ed760;
            box-shadow: 0 0 15px var(--shadow-glow);
        }

        #timeUpModal, #submitModal, #oneMinuteAlert {
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.7);
            z-index: 1000;
            justify-content: center;
            align-items: center;
        }

        #timeUpModalContent, #submitModalContent, #oneMinuteAlertContent {
            background: var(--card-bg);
            padding: 20px;
            border-radius: var(--card-radius);
            max-width: 400px;
            text-align: center;
            box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
        }

        #timeUpModalContent p, #submitModalContent p, #oneMinuteAlertContent p {
            font-size: 18px;
            margin: 0 0 20px;
        }

        .modal-actions {
            display: flex;
            gap: 10px;
            justify-content: center;
        }

        .modal-btn {
            background: var(--accent-color);
            color: var(--bg-color);
            border: none;
            padding: 10px 20px;
            border-radius: var(--card-radius);
            font-size: 14px;
            cursor: pointer;
            transition: background 0.3s ease;
        }

        .modal-btn.cancel {
            background: var(--button-bg);
        }

        .modal-btn:hover {
            background: #1ed760;
        }

        .modal-btn.cancel:hover {
            background: var(--button-hover-bg);
        }

        #oneMinuteAlertContent {
            background: var(--warning-color);
            color: var(--bg-color);
            padding: 15px 25px;
            font-size: 16px;
            font-weight: 600;
        }

        #lightbox {
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.9);
            justify-content: center;
            align-items: center;
            z-index: 2000;
        }

        #lightbox img {
            max-width: 90%;
            max-height: 90%;
            border-radius: 8px;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
        }

        #lightboxControls {
            position: absolute;
            bottom: 20px;
            display: flex;
            gap: 15px;
        }

        .lightbox-btn {
            background: var(--accent-color);
            color: var(--bg-color);
            border: none;
            padding: 8px;
            border-radius: 50%;
            cursor: pointer;
            font-size: 16px;
            transition: background 0.3s ease;
        }

        .lightbox-btn:hover {
            background: #1ed760;
        }

        @media (max-width: 768px) {
            .container {
                padding: 0 10px;
            }

            h2 {
                font-size: 24px;
            }

            .question-block {
                padding: 15px;
            }

            .question-header span {
                font-size: 14px;
            }

            .points {
                font-size: 12px;
            }

            #timer {
                font-size: 16px;
                padding: 8px 15px;
            }

            .timer-circle {
                width: 30px;
                height: 30px;
            }
        }

        /* Hide questions by default only in multi-page mode */
.multi-page-mode .question-block {
    display: none;
}
.multi-page-mode .question-block.active {
    display: block;
}
.nav-buttons {
    display: flex;
    justify-content: space-between;
    margin-top: 20px;
}
.hidden { display: none !important; }

/* --- QUIZ SUMMARY PALETTE (Desktop Only) --- */
.quiz-summary-palette {
    position: fixed;
    right: 20px;
    top: 100px;
    width: 220px;
    background: var(--card-bg);
    padding: 15px;
    border-radius: var(--card-radius);
    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
    z-index: 900;
}

/* Hide on mobile/tablets */
@media (max-width: 768px) {
    .quiz-summary-palette { display: none; }
}

.palette-grid {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 8px;
    margin-top: 10px;
}

.palette-item {
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--button-bg);
    border-radius: 6px;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
    border: 1px solid transparent;
}

/* Status Colors */
.palette-item.answered { background-color: var(--answered-color); color: white; }
.palette-item.flagged { border-color: var(--warning-color); color: var(--warning-color); }
.palette-item.current { outline: 2px solid var(--accent-color); outline-offset: 2px; }
    </style>
</head>
<body>
    <div class="container">
    <?php if ($isMobileApp): ?>
    <div class="mobile-exit-nav">
        <button type="button" onclick="confirmExit()" class="btn-exit">
            <i class="fas fa-chevron-left"></i> Exit Quiz
        </button>
    </div>
    <?php endif; ?>

    
        <h2><i class="fas fa-poll"></i> <?= htmlspecialchars($quizTitle) ?></h2>
        <div class="quiz-info">
            Duration: <?= $quizDuration ?> minutes
            <span class="status-badge <?= htmlspecialchars($status) ?>"><?= ucfirst(htmlspecialchars($status)) ?></span>
        </div>
        <div id="timer" aria-live="polite">
            <div class="timer-circle">
                <svg width="40" height="40">
                    <circle cx="20" cy="20" r="18"></circle>
                </svg>
            </div>
            <span></span>
        </div>
        <?php if (!$isMobileApp): ?>
<div class="quiz-summary-palette">
    <div style="font-size: 14px; font-weight: 600; margin-bottom: 10px; border-bottom: 1px solid var(--border-color); padding-bottom: 5px;">
        <i class="fas fa-th"></i> Question Summary
    </div>
    <div class="palette-grid">
        <?php for ($i = 0; $i < count($questions); $i++): ?>
            <div class="palette-item" id="palette-item-<?= $i ?>" onclick="jumpToQuestion(<?= $i ?>)">
                <?= $i + 1 ?>
            </div>
        <?php endfor; ?>
    </div>
</div>
<?php endif; ?>
        <form id="quizForm" action="submit_quiz.php" method="POST">
            <input type="hidden" name="quiz_id" value="<?= $quizId ?>">
            <input type="hidden" name="start_time" value="<?= $startTime ?>">
            <?php 
            $questionNumber = 1;
            foreach ($questions as $qid => $q): 
            ?>
                <div class="question-block" data-question-id="<?= $qid ?>">
                    <div class="question-header">
                        <span>Question <?= $questionNumber ?> of <?= count($questions) ?></span>
                        <span class="points"><?= $q['points'] ?> pts</span>
                        <button type="button" class="flag-btn" aria-label="Flag question for review" onclick="toggleFlag(this, <?= $qid ?>)">
                            <i class="fas fa-flag"></i>
                        </button>
                    </div>
                    <p><strong><?= htmlspecialchars($q['text']) ?></strong></p>
                    <?php if (!empty($q['image'])): ?>
                        <img src="<?= htmlspecialchars($q['image']) ?>" alt="Question Image" class="quiz-image" onclick="openLightbox(this)">
                    <?php endif; ?>
                   <?php foreach ($q['choices'] as $choice): ?>
                           <div class="choice-wrapper">
                               <label class="choice-label">
                                 <input type="radio" 
                                 name="answers[<?= $qid ?>]" 
                                 value="<?= $choice['id'] ?>" 
                                  aria-label="Option: <?= htmlspecialchars($choice['text']) ?>">
                                 <span class="choice-text"><?= htmlspecialchars($choice['text']) ?></span>
                           </label>
                         </div>
                  <?php endforeach; ?>
                </div>
            <?php 
            $questionNumber++;
            endforeach; 
            ?>

            <div class="nav-buttons <?= ($layoutType === 'single_page') ? 'hidden' : '' ?>" style="margin-bottom: 20px;">
                <button type="button" id="prevBtn" class="modal-btn cancel" onclick="changeQuestion(-1)">Previous</button>
                <button type="button" id="nextBtn" class="modal-btn" onclick="changeQuestion(1)">Next</button>
            </div>
            <button class="submit-btn" type="button" onclick="showSubmitModal()" aria-label="Submit quiz">Submit Quiz</button>
        </form>
        <div id="timeUpModal">
            <div id="timeUpModalContent">
                <p><i class="fas fa-hourglass-end"></i> Time's up! Your quiz will now be submitted.</p>
            </div>
        </div>
        <div id="submitModal">
            <div id="submitModalContent">
                <p>Are you sure you want to submit your quiz? <?php if ($priorAttempt): ?>This will overwrite your previous attempt.<?php else: ?>You cannot change your answers after submission.<?php endif; ?></p>
                <div class="modal-actions">
                    <button class="modal-btn" onclick="submitQuiz()" aria-label="Confirm quiz submission">Submit</button>
                    <button class="modal-btn cancel" onclick="closeSubmitModal()" aria-label="Cancel submission">Cancel</button>
                </div>
            </div>
        </div>
        <div id="oneMinuteAlert">
            <div id="oneMinuteAlertContent">
                <p><i class="fas fa-exclamation-triangle"></i> You have 1 minute remaining! Review your answers.</p>
            </div>
        </div>
        <div id="lightbox">
            <img alt="Zoomed question image">
            <div id="lightboxControls">
                <button class="lightbox-btn" onclick="zoomImage(1.2)" aria-label="Zoom in"><i class="fas fa-search-plus"></i></button>
                <button class="lightbox-btn" onclick="zoomImage(0.8)" aria-label="Zoom out"><i class="fas fa-search-minus"></i></button>
                <button class="lightbox-btn" onclick="closeLightbox()" aria-label="Close lightbox"><i class="fas fa-times"></i></button>
            </div>
        </div>
    </div>
    <script>
        let isSubmitting = false;
        let timeLeft = <?= max(0, $actualTimeLeft) ?>;
        let currentStep = 0;
        const layoutType = '<?= $layoutType ?>'; // From PHP
        const questions = document.querySelectorAll('.question-block');
        let oneMinuteAlertShown = false;
         const totalTime = <?= $quizDuration * 60 ?>;
        const timerCircle = document.querySelector('.timer-circle circle');

        function startTimer() {
            const timerDisplay = document.querySelector('#timer span');
            const interval = setInterval(() => {
                let minutes = Math.floor(timeLeft / 60);
                let seconds = timeLeft % 60;
                timerDisplay.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
                const dashOffset = 113 * (1 - timeLeft / totalTime);
                timerCircle.style.strokeDashoffset = dashOffset;
                timeLeft--;

                if (timeLeft === 60 && !oneMinuteAlertShown) {
                    oneMinuteAlertShown = true;
                    const alert = document.getElementById('oneMinuteAlert');
                    alert.style.display = 'flex';
                    setTimeout(() => alert.style.display = 'none', 4000);
                }

                if (timeLeft < 0) {
                    clearInterval(interval);
                    showTimeUpModal();
                }
            }, 1000);
        }

        function showTimeUpModal() {
            isSubmitting = true; // Set this to true here
            document.getElementById('timeUpModal').style.display = 'flex';
            setTimeout(() => document.getElementById('quizForm').submit(), 3000);
        }

        function showSubmitModal() {
            document.getElementById('submitModal').style.display = 'flex';
        }

        function closeSubmitModal() {
            document.getElementById('submitModal').style.display = 'none';
        }

        function submitQuiz() {
            isSubmitting = true; // Set this to true here
            document.getElementById('quizForm').submit();
        }

        function toggleFlag(button, questionId) {
            button.classList.toggle('flagged');
            const flaggedQuestions = JSON.parse(sessionStorage.getItem('flaggedQuestions') || '[]');
            if (button.classList.contains('flagged')) {
                if (!flaggedQuestions.includes(questionId)) flaggedQuestions.push(questionId);
            } else {
                const index = flaggedQuestions.indexOf(questionId);
                if (index > -1) flaggedQuestions.splice(index, 1);
            }
            sessionStorage.setItem('flaggedQuestions', JSON.stringify(flaggedQuestions));
        }

        function saveAnswers() {
            const answers = {};
            document.querySelectorAll('input[type="radio"]:checked').forEach(input => {
               const match = input.name.match(/answers\[(\d+)\]/);
if (match) {
    const questionId = match[1];
    answers[questionId] = input.value;
}
             
            });
            sessionStorage.setItem('quizAnswers_<?= $quizId ?>', JSON.stringify(answers));
        }
function loadAnswers() {
            const dbAnswers = <?= json_encode($savedAnswers) ?>;
            const localAnswers = JSON.parse(sessionStorage.getItem('quizAnswers_<?= $quizId ?>') || '{}');
            const finalAnswers = { ...localAnswers, ...dbAnswers };

            Object.keys(finalAnswers).forEach(questionId => {
                const choiceId = finalAnswers[questionId];
                const input = document.querySelector(`input[name="answers[${questionId}]"][value="${choiceId}"]`);
                if (input) { input.checked = true; }
            });

            const flaggedQuestions = JSON.parse(sessionStorage.getItem('flaggedQuestions') || '[]');
            flaggedQuestions.forEach(questionId => {
                const button = document.querySelector(`.question-block[data-question-id="${questionId}"] .flag-btn`);
                if (button) button.classList.add('flagged');
            });
        }

        function initLayout() {
            if (layoutType === 'multi_page') {
                document.querySelector('.container').classList.add('multi-page-mode');
                showQuestion(0);
            }
        }

        function showQuestion(n) {
            questions.forEach(q => q.classList.remove('active'));
            questions[n].classList.add('active');

            document.getElementById('prevBtn').classList.toggle('hidden', n === 0);
            
            const nextBtn = document.getElementById('nextBtn');
            const mainSubmitBtn = document.querySelector('.submit-btn');

            if (n === (questions.length - 1)) {
                nextBtn.innerText = "Finish & Review";
                nextBtn.onclick = showSubmitModal;
                mainSubmitBtn.classList.remove('hidden'); 
            } else {
                nextBtn.innerText = "Next";
                nextBtn.onclick = () => changeQuestion(1);
                mainSubmitBtn.classList.add('hidden'); 
            }
            updatePalette(); // <--- ADD THIS HERE
        }

        function changeQuestion(n) {
            currentStep += n;
            showQuestion(currentStep);
            window.scrollTo(0, 0); 
        }

        function autoSaveToDatabase(questionId, choiceId) {
            const formData = new FormData();
            formData.append('quiz_id', <?= $quizId ?>);
            formData.append('question_id', questionId);
            formData.append('choice_id', choiceId);

            fetch('save_progress.php', {
                method: 'POST',
                body: formData
            })
            .then(response => response.json())
            .then(data => { console.log("Server Saved:", data.status); })
            .catch(err => console.error("Save failed:", err));
        }

        let zoomLevel = 1;
        function openLightbox(img) {
            const lightbox = document.getElementById('lightbox');
            const lightboxImg = lightbox.querySelector('img');
            lightboxImg.src = img.src;
            lightboxImg.style.transform = 'scale(1)';
            zoomLevel = 1;
            lightbox.style.display = 'flex';
        }

        function zoomImage(factor) {
            zoomLevel *= factor;
            zoomLevel = Math.min(Math.max(zoomLevel, 0.5), 2);
            const lightboxImg = document.querySelector('#lightbox img');
            lightboxImg.style.transform = `scale(${zoomLevel})`;
        }

        function closeLightbox() {
            document.getElementById('lightbox').style.display = 'none';
        }

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && document.getElementById('lightbox').style.display === 'flex') {
                closeLightbox();
            } else if (e.key === 'Escape' && document.getElementById('submitModal').style.display === 'flex') {
                closeSubmitModal();
            }
        });

       window.addEventListener('load', () => {
    startTimer();
    loadAnswers();
    initLayout(); // <--- ADD THIS LINE

    document.querySelectorAll('input[type="radio"]').forEach(input => {
        input.addEventListener('change', (e) => {
            // 1. Existing local save (sessionStorage)
            saveAnswers(); 
            
            // 2. NEW: Database Auto-save
            // This extracts the question ID from your input name "answers[123]"
            const questionId = e.target.name.match(/answers\[(\d+)\]/)[1];
            const choiceId = e.target.value;
            
            autoSaveToDatabase(questionId, choiceId);
            updatePalette(); // <--- ADD THIS HERE
        });
    });
});

        function confirmExit() {
    if (confirm("Are you sure you want to exit? Your progress may not be saved.")) {
        // If opened via target="_blank", this closes the tab and returns to the app
        window.close();
        
        // Fallback if window.close() is blocked:
        setTimeout(() => {
            window.location.href = 'quiz_list.php';
        }, 100);
    }
}

// --- UPDATED SMART INTEGRITY SNITCH ---
function logIntegrity(eventType) {
    if (isSubmitting) return;

    const formData = new FormData();
    formData.append('quiz_id', <?= $quizId ?>);
    formData.append('event_type', eventType);
    formData.append('layout_mode', layoutType);

    // Identify which question they were looking at
    let activeQuestionId = null;
    if (layoutType === 'multi_page') {
        // Multi-page: Use the current step index
        activeQuestionId = questions[currentStep].getAttribute('data-question-id');
    } else {
        // Single-page: Find the question closest to the top of the viewport
        let closest = Array.from(questions).reduce((prev, curr) => {
            return (Math.abs(curr.getBoundingClientRect().top) < Math.abs(prev.getBoundingClientRect().top) ? curr : prev);
        });
        activeQuestionId = closest.getAttribute('data-question-id');
    }
    
    formData.append('active_question_id', activeQuestionId);

    // sendBeacon is used to ensure the log is sent even if the tab is closing
    navigator.sendBeacon('log_integrity_event.php', formData);
}

// Tracks when a student switches tabs or minimizes the window
document.addEventListener("visibilitychange", function() {
    if (document.visibilityState === 'hidden') {
        logIntegrity('tab_hidden');
    }
});

// Tracks when they click out of the browser window
window.addEventListener('blur', function() {
    logIntegrity('window_blur');
});

// Navigation Timing for AI (Detects if they answer/move too fast)
let lastActionTime = Date.now();
function trackSpeed() {
    const now = Date.now();
    const timeDiff = (now - lastActionTime) / 1000;
    if (timeDiff < 2) { // If less than 2 seconds since last question change/answer
        logIntegrity('rapid_navigation');
    }
    lastActionTime = now;
}

// Function to jump to a specific question from the palette
function jumpToQuestion(n) {
    trackSpeed(); // Log if they are jumping through questions suspiciously fast
    if (layoutType === 'multi_page') {
        currentStep = n;
        showQuestion(currentStep);
    } else {
        const target = questions[n];
        window.scrollTo({ top: target.offsetTop - 100, behavior: 'smooth' });
    }
}

// Function to update the palette colors based on answers and flags
function updatePalette() {
    questions.forEach((q, index) => {
        const qId = q.getAttribute('data-question-id');
        const paletteItem = document.getElementById(`palette-item-${index}`);
        if (!paletteItem) return;

        paletteItem.classList.remove('answered', 'flagged', 'current');

        const isAnswered = document.querySelector(`input[name="answers[${qId}]"]:checked`);
        if (isAnswered) paletteItem.classList.add('answered');

        const flaggedQuestions = JSON.parse(sessionStorage.getItem('flaggedQuestions') || '[]');
        if (flaggedQuestions.includes(parseInt(qId))) paletteItem.classList.add('flagged');

        if (layoutType === 'multi_page' && index === currentStep) paletteItem.classList.add('current');
    });
}
    </script>
</body>
</html>