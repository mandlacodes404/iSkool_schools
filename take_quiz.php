<?php
ob_start();
error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);
ini_set('error_log', 'php_errors.log');

session_start();
require_once 'config.php';

if (!isset($_SESSION['email']) || $_SESSION['role'] !== 'user' || !isset($_GET['quiz_id'])) {
    header("Location: index.php");
    exit();
}

$userEmail = $_SESSION['email'];
$quizId = intval($_GET['quiz_id']);

// Fetch quiz details
$quizStmt = $conn->prepare("SELECT title, duration, status FROM quizzes WHERE id = ?");
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
    SELECT c.id AS class_id, c.school_id
    FROM class_students cs
    JOIN classes c ON cs.class_id = c.id
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
$learnerSchoolId = $classInfo['school_id'];

$verifyQuiz = $conn->prepare("
    SELECT q.class_id, c.school_id 
    FROM quizzes q
    JOIN classes c ON q.class_id = c.id
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

if (!$quizCheck || $quizCheck['class_id'] != $learnerClassId || $quizCheck['school_id'] != $learnerSchoolId) {
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

        label {
            display: block;
            padding: 8px 0;
            font-size: 15px;
            cursor: pointer;
            transition: background 0.2s ease;
        }

        input[type="radio"] {
            margin-right: 10px;
            cursor: pointer;
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
    </style>
</head>
<body>
    <div class="container">
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
        <form id="quizForm" action="submit_quiz.php" method="POST">
            <input type="hidden" name="quiz_id" value="<?= $quizId ?>">
            <input type="hidden" name="start_time" value="<?= time() ?>">
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
                        <div>
                            <label>
                                <input type="radio" name="answers[<?= $qid ?>]" value="<?= $choice['id'] ?>" aria-label="Option: <?= htmlspecialchars($choice['text']) ?>">
                                <span><?= htmlspecialchars($choice['text']) ?></span>
                            </label>
                        </div>
                    <?php endforeach; ?>
                </div>
            <?php 
            $questionNumber++;
            endforeach; 
            ?>
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
        let timeLeft = <?= $quizDuration * 60 ?>;
        let oneMinuteAlertShown = false;
        const totalTime = timeLeft;
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
                const questionId = input.name.match(/answers\[(\d+)\]/)[1];
                answers[questionId] = input.value;
            });
            sessionStorage.setItem('quizAnswers_<?= $quizId ?>', JSON.stringify(answers));
        }

        function loadAnswers() {
            const answers = JSON.parse(sessionStorage.getItem('quizAnswers_<?= $quizId ?>') || '{}');
            Object.keys(answers).forEach(questionId => {
                const input = document.querySelector(`input[name="answers[${questionId}]"][value="${answers[questionId]}"]`);
                if (input) input.checked = true;
            });
            const flaggedQuestions = JSON.parse(sessionStorage.getItem('flaggedQuestions') || '[]');
            flaggedQuestions.forEach(questionId => {
                const button = document.querySelector(`.question-block[data-question-id="${questionId}"] .flag-btn`);
                if (button) button.classList.add('flagged');
            });
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
            document.querySelectorAll('input[type="radio"]').forEach(input => {
                input.addEventListener('change', saveAnswers);
            });
        });
    </script>
</body>
</html>