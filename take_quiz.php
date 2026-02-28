<?php
ob_start();
error_reporting(E_ALL);
ini_set('display_errors', 1);
ini_set('log_errors', 1);
ini_set('error_log', 'php_errors.log');

session_start();
$user_agent = $_SERVER['HTTP_USER_AGENT'] ?? '';
$is_mobile_ua = preg_match("/(android|iphone|ipad|ipod|webos|windows phone|mobile)/i", $user_agent);
$is_mobile_get = (isset($_GET['mobile']) && $_GET['mobile'] == 'true');
$isMobileApp = ($is_mobile_ua || $is_mobile_get);

require_once 'config.php';

if (!isset($_SESSION['email']) || $_SESSION['role'] !== 'learner' || !isset($_GET['quiz_id'])) {
    header("Location: index.php");
    exit();
}

$userEmail = $_SESSION['email'];
$quizId = intval($_GET['quiz_id']);

$quizStmt = $conn->prepare("SELECT title, duration, status, layout_mode, shuffle_questions, is_linear FROM quizzes WHERE id = ?");
$quizStmt->bind_param("i", $quizId);
if (!$quizStmt->execute()) { echo "Database error."; exit(); }
$quizResult = $quizStmt->get_result();
if ($quizResult->num_rows === 0) { echo "Invalid quiz ID."; exit(); }
$quiz = $quizResult->fetch_assoc();
$layoutType = $quiz['layout_mode'] ?? 'single_page';
$is_linear = $quiz['is_linear'] ?? 0;
if ($is_linear == 1 || $is_linear == 'is_linear') { $layoutType = 'multi_page'; }
$quizTitle = $quiz['title'];
$quizDuration = $quiz['duration'];
$status = $quiz['status'] ?? 'Open';
$quizStmt->close();

// ── CLOSED ──────────────────────────────────────────────────────────────────
if ($status === 'Closed') { ?>
<!DOCTYPE html><html lang="en"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Quiz Closed</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Nunito',sans-serif;background:#0d1117;color:#e2e8f0;display:flex;justify-content:center;align-items:center;height:100vh;text-align:center;padding:20px}
.state-card{background:#1a1919;border:1px solid rgba(255,255,255,0.06);border-radius:20px;padding:40px;max-width:420px;width:100%}
.state-icon{width:64px;height:64px;background:rgba(248,81,73,0.1);border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 20px}
h1{font-size:22px;font-weight:800;color:#f85149;margin-bottom:10px}
p{color:#8b949e;font-size:15px;line-height:1.6;margin-bottom:24px}
a{background:#4fd1c5;color:#0d1117;padding:12px 28px;border-radius:10px;font-weight:700;text-decoration:none;font-size:14px;display:inline-block}
</style></head><body>
<div class="state-card">
<div class="state-icon"><svg viewBox="0 0 24 24" width="28" height="28" stroke="#f85149" stroke-width="2" fill="none"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg></div>
<h1>Quiz Closed</h1>
<p>The quiz "<strong><?= htmlspecialchars($quizTitle) ?></strong>" is closed and cannot be attempted right now.</p>
<a href="quiz_list.php">Back to Quizzes</a>
</div></body></html>
<?php exit(); }

// ── CLASS ACCESS CHECK ───────────────────────────────────────────────────────
$classCheck = $conn->prepare("SELECT cs.class_id FROM class_students cs WHERE cs.student_email = ? LIMIT 1");
$classCheck->bind_param("s", $userEmail);
$classCheck->execute();
$classInfo = $classCheck->get_result()->fetch_assoc();
$classCheck->close();
if (!$classInfo) { header("Location: quiz_list.php"); exit(); }
$learnerClassId = $classInfo['class_id'];

$verifyQuiz = $conn->prepare("SELECT q.class_id FROM quizzes q WHERE q.id = ?");
$verifyQuiz->bind_param("i", $quizId);
$verifyQuiz->execute();
$quizCheck = $verifyQuiz->get_result()->fetch_assoc();
$verifyQuiz->close();
if (!$quizCheck || $quizCheck['class_id'] != $learnerClassId) { header("Location: quiz_list.php"); exit(); }

// ── TIMER LOGIC ──────────────────────────────────────────────────────────────
$checkAttempt = $conn->prepare("SELECT start_time, status, current_step FROM quiz_attempts WHERE user_email = ? AND quiz_id = ?");
$checkAttempt->bind_param("si", $userEmail, $quizId);
$checkAttempt->execute();
$attemptData = $checkAttempt->get_result()->fetch_assoc();
$currentTime = time();

if (!$attemptData) {
    $now = date('Y-m-d H:i:s');
    $insertAttempt = $conn->prepare("INSERT INTO quiz_attempts (user_email, quiz_id, start_time, status) VALUES (?, ?, ?, 'in_progress')");
    $insertAttempt->bind_param("sis", $userEmail, $quizId, $now);
    if ($insertAttempt->execute()) {
        $startTime = $currentTime;
        $current_saved_step = 0;
    } else {
        die("Failed to create quiz attempt: " . $insertAttempt->error);
    }
    $insertAttempt->close();
} else {
    if ($attemptData['status'] !== 'in_progress') { header("Location: quiz_results.php?quiz_id=" . $quizId); exit(); }
    $startTime = strtotime($attemptData['start_time']);
    $current_saved_step = isset($attemptData['current_step']) ? (int)$attemptData['current_step'] : 0;
}

$durationSeconds = $quizDuration * 60;
$elapsedSeconds = $currentTime - $startTime;
$actualTimeLeft = $durationSeconds - $elapsedSeconds;

if ($actualTimeLeft <= 0) { ?>
<!DOCTYPE html><html lang="en"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Time Expired</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Nunito',sans-serif;background:#0d1117;color:#e2e8f0;display:flex;justify-content:center;align-items:center;height:100vh;text-align:center;padding:20px}
.state-card{background:#1a1919;border:1px solid rgba(255,255,255,0.06);border-radius:20px;padding:40px;max-width:420px}
h1{font-size:22px;font-weight:800;color:#f85149;margin-bottom:10px}
p{color:#8b949e;font-size:15px;line-height:1.6;margin-bottom:24px}
.spinner{width:44px;height:44px;border:3px solid rgba(255,255,255,0.06);border-top:3px solid #4fd1c5;border-radius:50%;animation:spin 0.8s linear infinite;margin:0 auto}
@keyframes spin{to{transform:rotate(360deg)}}
</style></head><body>
<div class="state-card">
<h1>⏱ Time's Up!</h1>
<p>Your session has ended. Submitting your answers now...</p>
<div class="spinner"></div>
<form id="autoSubmitGate" action="submit_quiz.php" method="POST" style="display:none">
<input type="hidden" name="quiz_id" value="<?= $quizId ?>">
<input type="hidden" name="start_time" value="<?= $startTime ?>">
</form></div>
<script>setTimeout(()=>document.getElementById('autoSubmitGate').submit(),2000)</script>
</body></html>
<?php exit(); }

// ── QUESTIONS ────────────────────────────────────────────────────────────────
$query = $conn->prepare("SELECT q.id AS question_id, q.question_text, q.image_path, q.points, c.id AS choice_id, c.choice_text FROM quizquestions q LEFT JOIN choices c ON q.id = c.question_id WHERE q.quiz_id = ? ORDER BY q.id, c.id");
$query->bind_param("i", $quizId);
$query->execute();
$result = $query->get_result();

$questions = [];
while ($row = $result->fetch_assoc()) {
    $qid = $row['question_id'];
    if (!isset($questions[$qid])) {
        $questions[$qid] = ['id' => $qid, 'text' => $row['question_text'], 'image' => $row['image_path'], 'points' => $row['points'], 'choices' => []];
    }
    if ($row['choice_id']) { $questions[$qid]['choices'][] = ['id' => $row['choice_id'], 'text' => $row['choice_text']]; }
}
$query->close();

if (isset($quiz['shuffle_questions']) && $quiz['shuffle_questions'] == 1) {
    $questions = array_values($questions);
    shuffle($questions);
    foreach ($questions as &$q) { if (!empty($q['choices'])) shuffle($q['choices']); }
    unset($q);
}

$savedAnswers = [];
$loadStmt = $conn->prepare("SELECT question_id, selected_choice_id FROM user_answers WHERE user_email = ? AND quiz_id = ?");
$loadStmt->bind_param("si", $userEmail, $quizId);
$loadStmt->execute();
$savedResult = $loadStmt->get_result();
while ($row = $savedResult->fetch_assoc()) { $savedAnswers[$row['question_id']] = $row['selected_choice_id']; }
$loadStmt->close();

$totalQuestions = count($questions);
$answeredCount = count($savedAnswers);
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title><?= htmlspecialchars($quizTitle) ?></title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
    <style>
        /* ═══════════════════════════════════════════════
           RESET & VARIABLES
        ═══════════════════════════════════════════════ */
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        :root {
            --bg:            #0d1117;
            --surface:       #161b22;
            --surface-2:     #1a1f2a;
            --border:        rgba(255,255,255,0.07);
            --border-active: rgba(79,209,197,0.4);
            --teal:          #4fd1c5;
            --teal-dim:      rgba(79,209,197,0.12);
            --teal-glow:     rgba(79,209,197,0.25);
            --green:         #22c55e;
            --green-dim:     rgba(34,197,94,0.12);
            --orange:        #f59e0b;
            --orange-dim:    rgba(245,158,11,0.12);
            --red:           #f85149;
            --text-1:        #e2e8f0;
            --text-2:        #94a3b8;
            --text-3:        #4a5568;
            --radius:        14px;
            --radius-sm:     8px;
            --sidebar-w:     260px;
            --timer-h:       64px;
            --font:          'Nunito', sans-serif;
        }

        html, body {
            background: var(--bg);
            color: var(--text-1);
            font-family: var(--font);
            min-height: 100vh;
            overflow-x: hidden;
        }

        /* ═══════════════════════════════════════════════
           TOP BAR  (quiz title + back btn + timer)
        ═══════════════════════════════════════════════ */
        .topbar {
            position: fixed;
            top: 0; left: 0; right: 0;
            height: var(--timer-h);
            background: var(--surface);
            border-bottom: 1px solid var(--border);
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 0 20px 0 16px;
            z-index: 1000;
            gap: 12px;
        }

        .topbar-left {
            display: flex;
            align-items: center;
            gap: 12px;
            min-width: 0;
            flex: 1;
        }

        .back-btn {
            flex-shrink: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            width: 36px; height: 36px;
            background: rgba(255,255,255,0.05);
            border: 1px solid var(--border);
            border-radius: var(--radius-sm);
            color: var(--text-2);
            cursor: pointer;
            transition: all 0.2s;
        }
        .back-btn:hover { background: rgba(255,255,255,0.09); color: var(--text-1); }

        .topbar-title {
            font-size: 15px;
            font-weight: 800;
            color: var(--text-1);
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }

        .topbar-meta {
            font-size: 12px;
            color: var(--text-2);
            white-space: nowrap;
        }

        /* ── TIMER PILL ── */
        .timer-pill {
            flex-shrink: 0;
            display: flex;
            align-items: center;
            gap: 10px;
            background: var(--surface-2);
            border: 1px solid var(--border);
            border-radius: 100px;
            padding: 7px 16px 7px 10px;
            transition: border-color 0.4s, background 0.4s;
        }

        .timer-pill.warn  { border-color: rgba(245,158,11,0.5); background: rgba(245,158,11,0.06); }
        .timer-pill.danger{ border-color: rgba(248,81,73,0.5);  background: rgba(248,81,73,0.06);  }

        .timer-ring {
            position: relative;
            width: 32px; height: 32px;
            flex-shrink: 0;
        }

        .timer-ring svg { transform: rotate(-90deg); display: block; }

        .timer-ring circle {
            fill: none;
            stroke-width: 3;
            stroke-linecap: round;
        }

        .ring-track { stroke: rgba(255,255,255,0.08); }
        .ring-fill  {
            stroke: var(--teal);
            stroke-dasharray: 82;
            stroke-dashoffset: 0;
            transition: stroke-dashoffset 1s linear, stroke 0.4s;
        }

        .timer-pill.warn  .ring-fill  { stroke: var(--orange); }
        .timer-pill.danger .ring-fill { stroke: var(--red); animation: pulse-ring 0.6s ease-in-out infinite alternate; }

        @keyframes pulse-ring { to { opacity: 0.5; } }

        #timer-display {
            font-size: 17px;
            font-weight: 800;
            color: var(--text-1);
            font-variant-numeric: tabular-nums;
            letter-spacing: 0.5px;
            min-width: 44px;
        }

        .timer-pill.warn  #timer-display { color: var(--orange); }
        .timer-pill.danger #timer-display { color: var(--red); }

        /* ═══════════════════════════════════════════════
           DESKTOP LAYOUT SHELL
        ═══════════════════════════════════════════════ */
        .page-shell {
            display: flex;
            padding-top: var(--timer-h);
            min-height: 100vh;
        }

        /* ─── LEFT SIDEBAR ─── */
        .sidebar {
            width: var(--sidebar-w);
            flex-shrink: 0;
            position: fixed;
            top: var(--timer-h);
            left: 0;
            bottom: 0;
            background: var(--surface);
            border-right: 1px solid var(--border);
            overflow-y: auto;
            padding: 20px 16px 40px;
            display: flex;
            flex-direction: column;
            gap: 20px;
        }

        .sidebar::-webkit-scrollbar { width: 4px; }
        .sidebar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 4px; }

        /* Progress summary */
        .sidebar-progress {
            background: var(--surface-2);
            border: 1px solid var(--border);
            border-radius: var(--radius);
            padding: 16px;
        }

        .sidebar-progress-label {
            font-size: 11px;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 1.2px;
            color: var(--text-2);
            margin-bottom: 12px;
        }

        .progress-bar-track {
            height: 6px;
            background: rgba(255,255,255,0.06);
            border-radius: 100px;
            overflow: hidden;
            margin-bottom: 8px;
        }

        .progress-bar-fill {
            height: 100%;
            background: linear-gradient(90deg, var(--teal), #6ee7b7);
            border-radius: 100px;
            transition: width 0.4s ease;
        }

        .progress-fraction {
            font-size: 13px;
            font-weight: 700;
            color: var(--teal);
        }

        .progress-fraction span { color: var(--text-2); font-weight: 600; }

        /* Legend */
        .sidebar-legend {
            display: flex;
            flex-direction: column;
            gap: 8px;
        }

        .legend-item {
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 12px;
            color: var(--text-2);
        }

        .legend-dot {
            width: 10px; height: 10px;
            border-radius: 3px;
            flex-shrink: 0;
        }

        .ld-unanswered { background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.15); }
        .ld-answered   { background: var(--green); }
        .ld-current    { background: var(--teal-dim); border: 1px solid var(--teal); }
        .ld-flagged    { background: var(--orange-dim); border: 1px solid var(--orange); }

        /* Palette section label */
        .sidebar-section-label {
            font-size: 11px;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 1.2px;
            color: var(--text-2);
            margin-bottom: 10px;
        }

        /* Palette grid */
        .palette-grid {
            display: grid;
            grid-template-columns: repeat(5, 1fr);
            gap: 6px;
        }

        .p-item {
            aspect-ratio: 1;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 8px;
            font-size: 12px;
            font-weight: 700;
            cursor: pointer;
            border: 1px solid rgba(255,255,255,0.08);
            background: rgba(255,255,255,0.04);
            color: var(--text-2);
            transition: all 0.18s ease;
            user-select: none;
        }

        .p-item:hover { transform: translateY(-2px); background: rgba(255,255,255,0.08); color: var(--text-1); }

        .p-item.answered {
            background: var(--green-dim);
            border-color: rgba(34,197,94,0.3);
            color: var(--green);
        }

        .p-item.current {
            background: var(--teal-dim);
            border-color: var(--teal);
            color: var(--teal);
            box-shadow: 0 0 0 2px var(--teal-glow);
        }

        .p-item.answered.current {
            background: linear-gradient(135deg, var(--green-dim), var(--teal-dim));
            border-color: var(--teal);
            color: var(--teal);
        }

        .p-item.flagged {
            border-color: rgba(245,158,11,0.4) !important;
            color: var(--orange) !important;
        }

        /* ─── MAIN CONTENT ─── */
        .main-content {
            flex: 1;
            margin-left: var(--sidebar-w);
            padding: 32px 48px 80px;
            max-width: 780px;
        }

        /* ═══════════════════════════════════════════════
           QUESTION CARD
        ═══════════════════════════════════════════════ */
        .question-card {
            background: var(--surface);
            border: 1px solid var(--border);
            border-radius: var(--radius);
            padding: 28px 28px 24px;
            margin-bottom: 16px;
            transition: border-color 0.2s, box-shadow 0.2s;
            animation: fadeUp 0.3s ease both;
        }

        @keyframes fadeUp {
            from { opacity: 0; transform: translateY(12px); }
            to   { opacity: 1; transform: translateY(0); }
        }

        .question-card:hover { border-color: rgba(255,255,255,0.12); }

        /* Active in multi-page: teal left border */
        .question-card.active-card {
            border-color: var(--border-active);
            box-shadow: 0 0 0 1px var(--teal-glow), inset 4px 0 0 var(--teal);
        }

        /* Answered: green left border */
        .question-card.card-answered {
            border-color: rgba(34,197,94,0.25);
            box-shadow: inset 4px 0 0 var(--green);
        }

        /* Question top row */
        .q-toprow {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 16px;
            gap: 10px;
        }

        .q-number {
            font-size: 12px;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 1px;
            color: var(--text-2);
        }

        .q-toprow-right {
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .pts-badge {
            background: var(--teal-dim);
            color: var(--teal);
            border: 1px solid rgba(79,209,197,0.2);
            padding: 3px 10px;
            border-radius: 100px;
            font-size: 12px;
            font-weight: 700;
        }

        .flag-btn {
            width: 30px; height: 30px;
            border-radius: 8px;
            border: 1px solid var(--border);
            background: none;
            color: var(--text-3);
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.2s;
        }

        .flag-btn:hover { border-color: var(--orange); color: var(--orange); background: var(--orange-dim); }
        .flag-btn.flagged { border-color: var(--orange); color: var(--orange); background: var(--orange-dim); }

        /* Question text */
        .q-text {
            font-size: 16px;
            font-weight: 700;
            color: var(--text-1);
            line-height: 1.6;
            margin-bottom: 20px;
        }

        /* Question image */
        .q-image {
            max-width: 100%;
            max-height: 280px;
            object-fit: contain;
            border-radius: 10px;
            border: 1px solid var(--border);
            margin-bottom: 20px;
            display: block;
            cursor: zoom-in;
            transition: transform 0.2s;
        }
        .q-image:hover { transform: scale(1.02); }

        /* ── CHOICES ── */
        .choices-list {
            display: flex;
            flex-direction: column;
            gap: 10px;
        }

        .choice-item {
            display: flex;
            align-items: center;
            gap: 14px;
            padding: 14px 18px;
            background: rgba(255,255,255,0.025);
            border: 1.5px solid rgba(255,255,255,0.07);
            border-radius: 10px;
            cursor: pointer;
            transition: all 0.18s ease;
            user-select: none;
        }

        .choice-item:hover {
            background: rgba(255,255,255,0.05);
            border-color: rgba(255,255,255,0.15);
            transform: translateX(3px);
        }

        /* Custom radio */
        .choice-radio {
            width: 20px; height: 20px;
            border-radius: 50%;
            border: 2px solid rgba(255,255,255,0.2);
            flex-shrink: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.18s;
        }

        .choice-radio::after {
            content: '';
            width: 9px; height: 9px;
            border-radius: 50%;
            background: var(--teal);
            transform: scale(0);
            transition: transform 0.18s cubic-bezier(0.34, 1.56, 0.64, 1);
        }

        /* Selected state */
        .choice-item.selected {
            background: var(--teal-dim);
            border-color: var(--teal);
        }

        .choice-item.selected .choice-radio {
            border-color: var(--teal);
        }

        .choice-item.selected .choice-radio::after { transform: scale(1); }

        .choice-item.selected .choice-text { color: var(--teal); font-weight: 700; }

        .choice-text {
            font-size: 14px;
            font-weight: 600;
            color: var(--text-1);
            line-height: 1.5;
            flex: 1;
        }

        /* Hidden real radio */
        .choice-item input[type="radio"] {
            position: absolute;
            opacity: 0;
            width: 0; height: 0;
        }

        /* ═══════════════════════════════════════════════
           NAVIGATION BUTTONS (multi-page)
        ═══════════════════════════════════════════════ */
        .nav-bar {
            display: flex;
            gap: 12px;
            margin-top: 24px;
        }

        .nav-btn {
            flex: 1;
            padding: 14px 20px;
            border-radius: var(--radius);
            font-family: var(--font);
            font-size: 14px;
            font-weight: 700;
            cursor: pointer;
            border: 1px solid var(--border);
            transition: all 0.2s;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
        }

        #prevBtn {
            background: rgba(255,255,255,0.04);
            color: var(--text-2);
        }
        #prevBtn:hover { background: rgba(255,255,255,0.08); color: var(--text-1); }

        #nextBtn {
            background: var(--teal);
            color: #0d1117;
            border-color: var(--teal);
        }
        #nextBtn:hover { background: #3bbfb3; }

        .hidden { display: none !important; }

        /* ═══════════════════════════════════════════════
           SUBMIT BUTTON
        ═══════════════════════════════════════════════ */
        .submit-btn {
            width: 100%;
            padding: 16px;
            background: linear-gradient(135deg, var(--teal), #6ee7b7);
            color: #0d1117;
            border: none;
            border-radius: var(--radius);
            font-family: var(--font);
            font-size: 15px;
            font-weight: 800;
            cursor: pointer;
            margin-top: 24px;
            letter-spacing: 0.3px;
            transition: all 0.2s;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
        }
        .submit-btn:hover { opacity: 0.9; transform: translateY(-1px); box-shadow: 0 8px 24px rgba(79,209,197,0.25); }

        /* ═══════════════════════════════════════════════
           MODALS
        ═══════════════════════════════════════════════ */
        .modal-overlay {
            display: none;
            position: fixed;
            inset: 0;
            background: rgba(0,0,0,0.75);
            backdrop-filter: blur(6px);
            z-index: 2000;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }
        .modal-overlay.show { display: flex; }

        .modal-box {
            background: var(--surface);
            border: 1px solid rgba(255,255,255,0.1);
            border-radius: 20px;
            padding: 32px 28px;
            max-width: 420px;
            width: 100%;
            text-align: center;
            box-shadow: 0 24px 64px rgba(0,0,0,0.5);
            animation: modalPop 0.25s cubic-bezier(0.34,1.56,0.64,1);
        }

        @keyframes modalPop {
            from { opacity: 0; transform: scale(0.9); }
            to   { opacity: 1; transform: scale(1); }
        }

        .modal-icon {
            width: 56px; height: 56px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0 auto 16px;
        }

        .modal-icon.warn    { background: rgba(245,158,11,0.12); }
        .modal-icon.danger  { background: rgba(248,81,73,0.12);  }
        .modal-icon.success { background: var(--teal-dim); }

        .modal-title {
            font-size: 18px;
            font-weight: 800;
            color: var(--text-1);
            margin-bottom: 8px;
        }

        .modal-body {
            font-size: 14px;
            color: var(--text-2);
            line-height: 1.6;
            margin-bottom: 24px;
        }

        .modal-body strong { color: var(--text-1); }

        .modal-actions {
            display: flex;
            gap: 10px;
        }

        .modal-btn {
            flex: 1;
            padding: 12px;
            border-radius: 10px;
            font-family: var(--font);
            font-size: 14px;
            font-weight: 700;
            cursor: pointer;
            border: none;
            transition: all 0.2s;
        }

        .modal-btn.primary { background: var(--teal); color: #0d1117; }
        .modal-btn.primary:hover { background: #3bbfb3; }
        .modal-btn.secondary { background: rgba(255,255,255,0.06); color: var(--text-1); border: 1px solid var(--border); }
        .modal-btn.secondary:hover { background: rgba(255,255,255,0.1); }
        .modal-btn.danger { background: var(--red); color: white; }
        .modal-btn.danger:hover { background: #e04040; }

        /* One minute toast */
        .toast {
            position: fixed;
            bottom: 28px;
            left: 50%;
            transform: translateX(-50%) translateY(100px);
            background: var(--orange);
            color: #0d1117;
            padding: 12px 24px;
            border-radius: 100px;
            font-size: 14px;
            font-weight: 800;
            z-index: 3000;
            display: flex;
            align-items: center;
            gap: 8px;
            box-shadow: 0 8px 24px rgba(245,158,11,0.4);
            transition: transform 0.4s cubic-bezier(0.34,1.56,0.64,1);
            white-space: nowrap;
        }
        .toast.show { transform: translateX(-50%) translateY(0); }

        /* ═══════════════════════════════════════════════
           LIGHTBOX
        ═══════════════════════════════════════════════ */
        .lightbox {
            display: none;
            position: fixed;
            inset: 0;
            background: rgba(0,0,0,0.92);
            z-index: 4000;
            align-items: center;
            justify-content: center;
            flex-direction: column;
            gap: 16px;
        }
        .lightbox.show { display: flex; }
        .lightbox img { max-width: 90vw; max-height: 80vh; border-radius: 12px; }
        .lightbox-close {
            position: absolute;
            top: 20px; right: 20px;
            width: 40px; height: 40px;
            border-radius: 50%;
            background: rgba(255,255,255,0.1);
            border: none;
            color: white;
            font-size: 18px;
            cursor: pointer;
            display: flex; align-items: center; justify-content: center;
        }

        /* ═══════════════════════════════════════════════
           MULTI-PAGE MODE
        ═══════════════════════════════════════════════ */
        .multi-page-mode .question-card { display: none; }
        .multi-page-mode .question-card.active { display: block; }

        /* ═══════════════════════════════════════════════
           MOBILE
        ═══════════════════════════════════════════════ */
        @media (max-width: 768px) {
            .sidebar { display: none; }

            .main-content {
                margin-left: 0;
                padding: 16px 14px 100px;
            }

            .topbar { padding: 0 14px; }
            .topbar-meta { display: none; }

            .question-card { padding: 20px 18px; }
            .q-text { font-size: 15px; }
            .choice-item { padding: 12px 14px; }

            .submit-btn { position: fixed; bottom: 0; left: 0; right: 0; border-radius: 0; z-index: 100; margin: 0; }

            .nav-bar { position: fixed; bottom: 0; left: 0; right: 0; padding: 12px; background: var(--surface); border-top: 1px solid var(--border); margin: 0; z-index: 100; }
            .nav-btn { padding: 12px; }
        }

        /* ═══════════════════════════════════════════════
           APP MODE
        ═══════════════════════════════════════════════ */
        <?php if ($isMobileApp): ?>
        .topbar { position: sticky; }
        .main-content { padding: 14px 12px 100px; }
        <?php endif; ?>

        /* ═══════════════════════════════════════════════
           QUESTION COUNTER (multi-page)
        ═══════════════════════════════════════════════ */
        .step-indicator {
            display: flex;
            align-items: center;
            gap: 6px;
            margin-bottom: 20px;
        }

        .step-dot {
            height: 4px;
            border-radius: 100px;
            background: rgba(255,255,255,0.1);
            flex: 1;
            transition: background 0.3s;
        }

        .step-dot.done    { background: var(--green); }
        .step-dot.active  { background: var(--teal); }
    </style>
</head>
<body>

<!-- ═══════════════ TOP BAR ═══════════════ -->
<header class="topbar">
    <div class="topbar-left">
        <button class="back-btn" onclick="confirmExit()" title="Exit quiz">
            <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2.5" fill="none">
                <polyline points="15 18 9 12 15 6"/>
            </svg>
        </button>
        <div>
            <div class="topbar-title"><?= htmlspecialchars($quizTitle) ?></div>
            <div class="topbar-meta"><?= $totalQuestions ?> questions &middot; <?= $quizDuration ?> min</div>
        </div>
    </div>

    <div class="timer-pill" id="timerPill">
        <div class="timer-ring">
            <svg width="32" height="32" viewBox="0 0 32 32">
                <circle class="ring-track" cx="16" cy="16" r="13"/>
                <circle class="ring-fill" id="ringFill" cx="16" cy="16" r="13"/>
            </svg>
        </div>
        <span id="timer-display">--:--</span>
    </div>
</header>

<!-- ═══════════════ PAGE SHELL ═══════════════ -->
<div class="page-shell">

    <!-- ─── LEFT SIDEBAR ─── -->
    <aside class="sidebar" id="sidebar">

        <!-- Progress -->
        <div class="sidebar-progress">
            <div class="sidebar-progress-label">Your Progress</div>
            <div class="progress-bar-track">
                <div class="progress-bar-fill" id="progressFill"
                     style="width: <?= $totalQuestions > 0 ? round(($answeredCount/$totalQuestions)*100) : 0 ?>%">
                </div>
            </div>
            <div class="progress-fraction">
                <span id="answeredCount"><?= $answeredCount ?></span>
                <span> of <?= $totalQuestions ?> answered</span>
            </div>
        </div>

        <!-- Legend -->
        <div class="sidebar-legend">
            <div class="legend-item"><div class="legend-dot ld-unanswered"></div> Unanswered</div>
            <div class="legend-item"><div class="legend-dot ld-answered"></div> Answered</div>
            <div class="legend-item"><div class="legend-dot ld-current"></div> Current</div>
            <div class="legend-item"><div class="legend-dot ld-flagged"></div> Flagged</div>
        </div>

        <!-- Palette -->
        <div>
            <div class="sidebar-section-label">Questions</div>
            <div class="palette-grid" id="paletteGrid">
                <?php for ($i = 0; $i < $totalQuestions; $i++): ?>
                    <div class="p-item" id="pi-<?= $i ?>" onclick="jumpToQuestion(<?= $i ?>)"><?= $i + 1 ?></div>
                <?php endfor; ?>
            </div>
        </div>

        <!-- Submit from sidebar -->
        <button class="submit-btn" onclick="submitQuiz()" style="margin-top:auto;">
            <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2.5" fill="none">
                <polyline points="20 6 9 17 4 12"/>
            </svg>
            Submit Quiz
        </button>
    </aside>

    <!-- ─── MAIN CONTENT ─── -->
    <main class="main-content">

        <!-- Step dots (multi-page only) -->
        <?php if ($layoutType === 'multi_page'): ?>
        <div class="step-indicator" id="stepIndicator">
            <?php for ($i = 0; $i < $totalQuestions; $i++): ?>
                <div class="step-dot" id="sd-<?= $i ?>"></div>
            <?php endfor; ?>
        </div>
        <?php endif; ?>

        <!-- Quiz Form -->
        <form id="quizForm" action="submit_quiz.php" method="POST">
            <input type="hidden" name="quiz_id" value="<?= $quizId ?>">
            <input type="hidden" name="start_time" value="<?= $startTime ?>">

            <?php
            $qNum = 0;
            foreach ($questions as $q):
                $qid = $q['id'];
            ?>
            <div class="question-card" id="qcard-<?= $qNum ?>" data-question-id="<?= $qid ?>">

                <div class="q-toprow">
                    <span class="q-number">Question <?= $qNum + 1 ?> of <?= $totalQuestions ?></span>
                    <div class="q-toprow-right">
                        <span class="pts-badge"><?= $q['points'] ?> <?= $q['points'] == 1 ? 'pt' : 'pts' ?></span>
                        <button type="button" class="flag-btn" id="flag-<?= $qNum ?>"
                            onclick="toggleFlag(this, <?= $qid ?>)" title="Flag for review">
                            <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none">
                                <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/>
                                <line x1="4" y1="22" x2="4" y2="15"/>
                            </svg>
                        </button>
                    </div>
                </div>

                <p class="q-text"><?= htmlspecialchars($q['text']) ?></p>

                <?php if (!empty($q['image'])): ?>
                    <img src="<?= htmlspecialchars($q['image']) ?>" class="q-image" alt="Question image"
                         onclick="openLightbox(this)">
                <?php endif; ?>

                <div class="choices-list">
                    <?php foreach ($q['choices'] as $ci => $choice): ?>
                    <label class="choice-item" id="choice-<?= $qid ?>-<?= $choice['id'] ?>">
                        <input type="radio"
                               name="answers[<?= $qid ?>]"
                               value="<?= $choice['id'] ?>"
                               onchange="onChoiceSelect(this, <?= $qNum ?>)">
                        <div class="choice-radio"></div>
                        <span class="choice-text"><?= htmlspecialchars($choice['text']) ?></span>
                    </label>
                    <?php endforeach; ?>
                </div>
            </div>
            <?php
            $qNum++;
            endforeach;
            ?>

            <!-- Nav buttons (multi-page) -->
            <div class="nav-bar <?= $layoutType === 'single_page' ? 'hidden' : '' ?>" id="navBar">
                <button type="button" id="prevBtn" class="nav-btn" onclick="changeQuestion(-1)">
                    <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2.5" fill="none"><polyline points="15 18 9 12 15 6"/></svg>
                    Previous
                </button>
                <button type="button" id="nextBtn" class="nav-btn" onclick="changeQuestion(1)">
                    Next
                    <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2.5" fill="none"><polyline points="9 18 15 12 9 6"/></svg>
                </button>
            </div>

            <!-- Submit (single page + last question of multi-page) -->
            <?php if ($layoutType === 'single_page'): ?>
            <button type="button" class="submit-btn" id="mainSubmit" onclick="submitQuiz()">
                <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2.5" fill="none">
                    <polyline points="20 6 9 17 4 12"/>
                </svg>
                Submit Quiz
            </button>
            <?php else: ?>
            <button type="button" class="submit-btn hidden" id="mainSubmit" onclick="submitQuiz()">
                <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2.5" fill="none">
                    <polyline points="20 6 9 17 4 12"/>
                </svg>
                Submit Quiz
            </button>
            <?php endif; ?>

        </form>
    </main>
</div>

<!-- ═══════════════ MODALS ═══════════════ -->

<!-- Time Up Modal -->
<div class="modal-overlay" id="timeUpModal">
    <div class="modal-box">
        <div class="modal-icon danger">
            <svg viewBox="0 0 24 24" width="28" height="28" stroke="#f85149" stroke-width="2" fill="none">
                <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
            </svg>
        </div>
        <div class="modal-title">Time's Up!</div>
        <div class="modal-body">Your quiz is being submitted automatically.</div>
    </div>
</div>

<!-- Submit Confirm Modal -->
<div class="modal-overlay" id="submitModal">
    <div class="modal-box">
        <div class="modal-icon success">
            <svg viewBox="0 0 24 24" width="28" height="28" stroke="#4fd1c5" stroke-width="2" fill="none">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
        </div>
        <div class="modal-title">Submit Quiz?</div>
        <div class="modal-body" id="submitModalBody">
            You have answered <strong id="smAnswered">0</strong> of <strong><?= $totalQuestions ?></strong> questions.
            Are you sure you want to submit?
        </div>
        <div class="modal-actions">
            <button class="modal-btn secondary" onclick="closeSubmitModal()">Go Back</button>
            <button class="modal-btn danger" onclick="confirmSubmit()">Yes, Submit</button>
        </div>
    </div>
</div>

<!-- Exit Confirm Modal -->
<div class="modal-overlay" id="exitModal">
    <div class="modal-box">
        <div class="modal-icon warn">
            <svg viewBox="0 0 24 24" width="28" height="28" stroke="#f59e0b" stroke-width="2" fill="none">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
        </div>
        <div class="modal-title">Exit Quiz?</div>
        <div class="modal-body">Your progress is saved but the <strong>timer keeps running</strong>. You can return and continue.</div>
        <div class="modal-actions">
            <button class="modal-btn secondary" onclick="closeExitModal()">Stay</button>
            <button class="modal-btn primary" onclick="doExit()">Exit</button>
        </div>
    </div>
</div>

<!-- 1-Minute Toast -->
<div class="toast" id="oneMinToast">
    <svg viewBox="0 0 24 24" width="16" height="16" stroke="#0d1117" stroke-width="2.5" fill="none">
        <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
    </svg>
    1 minute remaining!
</div>

<!-- Lightbox -->
<div class="lightbox" id="lightbox" onclick="closeLightbox()">
    <img id="lightboxImg" alt="Zoomed image">
    <button class="lightbox-close" onclick="closeLightbox()">✕</button>
</div>

<!-- ═══════════════ SCRIPT ═══════════════ -->
<script>
    // ── CONSTANTS FROM PHP ──────────────────────────────────────────────────
    const QUIZ_ID       = <?= $quizId ?>;
    const LAYOUT        = '<?= $layoutType ?>';
    const IS_LINEAR     = <?= ($is_linear == 1) ? 'true' : 'false' ?>;
    const TOTAL_TIME    = <?= $quizDuration * 60 ?>;
    const TOTAL_Q       = <?= $totalQuestions ?>;
    const DB_ANSWERS    = <?= json_encode($savedAnswers) ?>;
    const RING_CIRC     = 82; // 2*π*13

    // ── STATE ───────────────────────────────────────────────────────────────
    let timeLeft        = <?= max(0, $actualTimeLeft) ?>;
    let currentStep     = <?= isset($current_saved_step) ? (int)$current_saved_step : 0 ?>;
    let isSubmitting    = false;
    let oneMinShown     = false;
    let lastActionTime  = Date.now();

    const questions     = document.querySelectorAll('.question-card');
    const ringFill      = document.getElementById('ringFill');
    const timerPill     = document.getElementById('timerPill');
    const timerDisplay  = document.getElementById('timer-display');
    const progressFill  = document.getElementById('progressFill');
    const answeredEl    = document.getElementById('answeredCount');

    // ── TIMER ───────────────────────────────────────────────────────────────
    function startTimer() {
        updateTimerDisplay();
        setInterval(() => {
            if (isSubmitting) return;
            timeLeft--;
            updateTimerDisplay();

            if (timeLeft === 60 && !oneMinShown) {
                oneMinShown = true;
                showToast();
            }

            if (timeLeft <= 0) {
                isSubmitting = true;
                document.getElementById('timeUpModal').classList.add('show');
                setTimeout(() => document.getElementById('quizForm').submit(), 3000);
            }
        }, 1000);
    }

    function updateTimerDisplay() {
        const m = Math.floor(Math.max(timeLeft, 0) / 60);
        const s = Math.max(timeLeft, 0) % 60;
        timerDisplay.textContent = `${m}:${s.toString().padStart(2, '0')}`;

        // Ring
        const ratio = Math.max(timeLeft, 0) / TOTAL_TIME;
        ringFill.style.strokeDashoffset = RING_CIRC * (1 - ratio);

        // Color states
        timerPill.classList.remove('warn', 'danger');
        if (timeLeft <= 60)       timerPill.classList.add('danger');
        else if (timeLeft <= 300) timerPill.classList.add('warn');
    }

    // ── TOAST ───────────────────────────────────────────────────────────────
    function showToast() {
        const t = document.getElementById('oneMinToast');
        t.classList.add('show');
        setTimeout(() => t.classList.remove('show'), 5000);
    }

    // ── LAYOUT INIT ─────────────────────────────────────────────────────────
    function initLayout() {
        if (LAYOUT === 'multi_page' || IS_LINEAR) {
            document.querySelector('.main-content').classList.add('multi-page-mode');
            showQuestion(currentStep);
        } else {
            // Single page: mark all answered cards
            updateAllCardStates();
        }
    }

    // ── QUESTION NAVIGATION ─────────────────────────────────────────────────
    function showQuestion(n) {
        questions.forEach(q => q.classList.remove('active'));
        questions[n].classList.add('active');

        const prevBtn = document.getElementById('prevBtn');
        const nextBtn = document.getElementById('nextBtn');
        const submitBtn = document.getElementById('mainSubmit');

        // Previous: hide if linear or first
        if (IS_LINEAR || n === 0) prevBtn.classList.add('hidden');
        else prevBtn.classList.remove('hidden');

        // Last question
        if (n === questions.length - 1) {
            nextBtn.classList.add('hidden');
            submitBtn.classList.remove('hidden');
        } else {
            nextBtn.classList.remove('hidden');
            submitBtn.classList.add('hidden');
        }

        currentStep = n;
        updateStepDots();
        updatePalette();
        autoSave();
    }

    function changeQuestion(dir) {
        const next = currentStep + dir;
        if (next < 0 || next >= questions.length) return;
        trackSpeed();
        currentStep = next;
        showQuestion(currentStep);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function jumpToQuestion(n) {
        trackSpeed();
        if (IS_LINEAR && n < currentStep) {
            alert("Linear mode: you cannot go back.");
            return;
        }
        if (LAYOUT === 'multi_page' || IS_LINEAR) {
            currentStep = n;
            showQuestion(n);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } else {
            // Smooth scroll to question
            const card = document.getElementById(`qcard-${n}`);
            if (card) card.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }

    // ── STEP DOTS ────────────────────────────────────────────────────────────
    function updateStepDots() {
        if (LAYOUT !== 'multi_page' && !IS_LINEAR) return;
        for (let i = 0; i < TOTAL_Q; i++) {
            const dot = document.getElementById(`sd-${i}`);
            if (!dot) continue;
            dot.className = 'step-dot';
            if (i < currentStep) dot.classList.add('done');
            else if (i === currentStep) dot.classList.add('active');
        }
    }

    // ── CHOICE SELECTION ─────────────────────────────────────────────────────
    function onChoiceSelect(radio, qIndex) {
        // Update visual selection for this question's choices
        const card = radio.closest('.question-card');
        card.querySelectorAll('.choice-item').forEach(li => li.classList.remove('selected'));
        radio.closest('.choice-item').classList.add('selected');

        // Mark card as answered
        card.classList.add('card-answered');

        saveAnswers();
        const qid = card.getAttribute('data-question-id');
        autoSave(qid, radio.value);
        updatePalette();
        updateProgress();
    }

    function updateAllCardStates() {
        questions.forEach(card => {
            const qid = card.getAttribute('data-question-id');
            const checked = card.querySelector('input[type="radio"]:checked');
            if (checked) {
                card.classList.add('card-answered');
                checked.closest('.choice-item').classList.add('selected');
            }
        });
    }

    // ── LOAD ANSWERS ─────────────────────────────────────────────────────────
    function loadAnswers() {
        const local = JSON.parse(sessionStorage.getItem('quiz_' + QUIZ_ID) || '{}');
        const merged = { ...local, ...DB_ANSWERS };

        Object.entries(merged).forEach(([qid, cid]) => {
            const radio = document.querySelector(`input[name="answers[${qid}]"][value="${cid}"]`);
            if (radio) {
                radio.checked = true;
                radio.closest('.choice-item').classList.add('selected');
                radio.closest('.question-card').classList.add('card-answered');
            }
        });

        // Restore flags
        const flags = JSON.parse(sessionStorage.getItem('flags_' + QUIZ_ID) || '[]');
        flags.forEach(qid => {
            const btn = document.querySelector(`.question-card[data-question-id="${qid}"] .flag-btn`);
            if (btn) btn.classList.add('flagged');
        });
    }

    // ── SAVE ANSWERS ─────────────────────────────────────────────────────────
    function saveAnswers() {
        const obj = {};
        document.querySelectorAll('input[type="radio"]:checked').forEach(r => {
            const m = r.name.match(/answers\[(\d+)\]/);
            if (m) obj[m[1]] = r.value;
        });
        sessionStorage.setItem('quiz_' + QUIZ_ID, JSON.stringify(obj));
    }

    // ── AUTO SAVE TO SERVER ──────────────────────────────────────────────────
    function autoSave(questionId = null, choiceId = null) {
        const fd = new FormData();
        fd.append('quiz_id', QUIZ_ID);
        fd.append('current_step', currentStep);
        if (questionId && choiceId) {
            fd.append('question_id', questionId);
            fd.append('choice_id', choiceId);
        }
        fetch('save_progress.php', { method: 'POST', body: fd })
            .catch(e => console.warn('Save failed', e));
    }

    // ── PALETTE ──────────────────────────────────────────────────────────────
    function updatePalette() {
        questions.forEach((card, i) => {
            const qid = card.getAttribute('data-question-id');
            const answered = card.querySelector('input[type="radio"]:checked');
            const flagged  = document.getElementById(`flag-${i}`)?.classList.contains('flagged');
            const item = document.getElementById(`pi-${i}`);
            if (!item) return;

            item.className = 'p-item';
            if (answered) item.classList.add('answered');
            if (flagged)  item.classList.add('flagged');
            if ((LAYOUT === 'multi_page' || IS_LINEAR) && i === currentStep) item.classList.add('current');
        });
    }

    // ── PROGRESS BAR ─────────────────────────────────────────────────────────
    function updateProgress() {
        const count = document.querySelectorAll('input[type="radio"]:checked').length;
        const pct   = TOTAL_Q > 0 ? Math.round((count / TOTAL_Q) * 100) : 0;
        if (progressFill) progressFill.style.width = pct + '%';
        if (answeredEl)   answeredEl.textContent = count;
    }

    // ── FLAG ─────────────────────────────────────────────────────────────────
    function toggleFlag(btn, qid) {
        btn.classList.toggle('flagged');
        const flags = JSON.parse(sessionStorage.getItem('flags_' + QUIZ_ID) || '[]');
        if (btn.classList.contains('flagged')) {
            if (!flags.includes(qid)) flags.push(qid);
        } else {
            const idx = flags.indexOf(qid);
            if (idx > -1) flags.splice(idx, 1);
        }
        sessionStorage.setItem('flags_' + QUIZ_ID, JSON.stringify(flags));
        updatePalette();
    }

    // ── SUBMIT ───────────────────────────────────────────────────────────────
    function submitQuiz() {
        const count = document.querySelectorAll('input[type="radio"]:checked').length;
        document.getElementById('smAnswered').textContent = count;
        document.getElementById('submitModal').classList.add('show');
    }

    function closeSubmitModal() {
        document.getElementById('submitModal').classList.remove('show');
    }

    function confirmSubmit() {
        isSubmitting = true;
        document.getElementById('quizForm').submit();
    }

    // ── EXIT ─────────────────────────────────────────────────────────────────
    function confirmExit() {
        document.getElementById('exitModal').classList.add('show');
    }

    function closeExitModal() {
        document.getElementById('exitModal').classList.remove('show');
    }

    function doExit() {
        window.parent.location.href = 'learner_dashboard.php';
    }

    // ── INTEGRITY ────────────────────────────────────────────────────────────
    function logIntegrity(eventType) {
        if (isSubmitting) return;
        const fd = new FormData();
        fd.append('quiz_id', QUIZ_ID);
        fd.append('event_type', eventType);
        fd.append('layout_mode', LAYOUT);

        let activeQid = null;
        if (LAYOUT === 'multi_page' || IS_LINEAR) {
            activeQid = questions[currentStep]?.getAttribute('data-question-id');
        } else {
            const closest = Array.from(questions).reduce((p, c) =>
                Math.abs(c.getBoundingClientRect().top) < Math.abs(p.getBoundingClientRect().top) ? c : p
            );
            activeQid = closest.getAttribute('data-question-id');
        }
        fd.append('active_question_id', activeQid);
        navigator.sendBeacon('log_integrity_event.php', fd);
    }

    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') logIntegrity('tab_hidden');
    });
    window.addEventListener('blur', () => logIntegrity('window_blur'));

    function trackSpeed() {
        const now = Date.now();
        if ((now - lastActionTime) / 1000 < 2) logIntegrity('rapid_navigation');
        lastActionTime = now;
    }

    // ── LIGHTBOX ─────────────────────────────────────────────────────────────
    function openLightbox(img) {
        document.getElementById('lightboxImg').src = img.src;
        document.getElementById('lightbox').classList.add('show');
    }
    function closeLightbox() {
        document.getElementById('lightbox').classList.remove('show');
    }
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') {
            closeLightbox();
            closeSubmitModal();
            closeExitModal();
        }
    });

    // ── INIT ─────────────────────────────────────────────────────────────────
    window.addEventListener('load', () => {
        loadAnswers();
        initLayout();
        updatePalette();
        updateProgress();
        startTimer();
    });
</script>
</body>
</html>