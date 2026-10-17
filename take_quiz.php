<?php
ob_start();
error_reporting(E_ALL);
ini_set('display_errors', 1);
ini_set('log_errors', 1);
ini_set('error_log', 'php_errors.log');

require_once __DIR__ . '/auth/session_guard.php';
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

$quizStmt = $conn->prepare("SELECT title, duration, status, layout_mode, shuffle_questions, is_linear, start_time, class_id, academic_year_id, attempt_limit FROM quizzes WHERE id = ?");
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
$quizStartTime = $quiz['start_time'] ?? null;
$quizClassId = (int)$quiz['class_id'];
$quizAcademicYearId = (int)($quiz['academic_year_id'] ?? 0);
$attemptLimit = (int)($quiz['attempt_limit'] ?? 1);
$quizStmt->close();

if ($quizAcademicYearId <= 0) {
    $yearResult = $conn->query("SELECT id FROM academic_years WHERE is_current = 1 LIMIT 1");
    if ($yearResult && $row = $yearResult->fetch_assoc()) {
        $quizAcademicYearId = (int)$row['id'];
    }
}

// ── CLOSED ──────────────────────────────────────────────────────────────────
$currentServerTime = time();
$quizStartTimestamp = !empty($quizStartTime) ? strtotime($quizStartTime) : null;
$isQuizAvailable = false;
if ($status === 'Open') {
    $isQuizAvailable = !$quizStartTimestamp || $currentServerTime >= $quizStartTimestamp;
} elseif ($status === 'Scheduled') {
    $isQuizAvailable = $quizStartTimestamp && $currentServerTime >= $quizStartTimestamp;
}
if (!$isQuizAvailable) { ?>
<!DOCTYPE html><html lang="en"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="theme-color" content="#20201f">
 <link rel="icon" type="image/svg+xml" href="/icon.svg?v=1.4">
<title>Quiz Unavailable</title>
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
@media (max-width:768px){body{background:#20201f}}
</style>
<?php $learnerThemeCss = 'take_quiz_light.css'; require __DIR__ . '/includes/learner_theme_head.php'; ?>
<script>
function getCsrfToken() {
    const meta = document.querySelector('meta[name="csrf-token"]');
    return meta ? meta.getAttribute('content') : '';
}
</script></head><body>
<div class="state-card">
<div class="state-icon"><svg viewBox="0 0 24 24" width="28" height="28" stroke="#f85149" stroke-width="2" fill="none"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg></div>
<h1>Quiz Unavailable</h1>
<p>The quiz "<strong><?= htmlspecialchars($quizTitle) ?></strong>" is not available to attempt right now.</p>
<a href="quiz_list.php">Back to Quizzes</a>
</div></body></html>
<?php exit(); }

// ── CLASS ACCESS CHECK ───────────────────────────────────────────────────────
$classCheck = $conn->prepare("
    SELECT 1
    FROM class_students cs
    WHERE cs.student_email = ?
      AND cs.class_id = ?
      AND cs.academic_year_id = ?
    LIMIT 1
");
$classCheck->bind_param("sii", $userEmail, $quizClassId, $quizAcademicYearId);
$classCheck->execute();
$classInfo = $classCheck->get_result()->fetch_assoc();
$classCheck->close();
if (!$classInfo) { header("Location: quiz_list.php"); exit(); }

// ── TIMER LOGIC ──────────────────────────────────────────────────────────────
$checkAttempt = $conn->prepare("
    SELECT attempt_id, start_time, status, current_step, question_order, choice_order
    FROM quiz_attempts
    WHERE user_email = ? AND quiz_id = ? AND status = 'in_progress'
    ORDER BY attempt_number DESC, attempt_id DESC
    LIMIT 1
");
$checkAttempt->bind_param("si", $userEmail, $quizId);
$checkAttempt->execute();
$attemptData = $checkAttempt->get_result()->fetch_assoc();
$currentTime = time();

if (!$attemptData) {
    $completedStmt = $conn->prepare("SELECT COUNT(*) AS completed_count FROM quiz_attempts WHERE user_email = ? AND quiz_id = ? AND status = 'submitted'");
    $completedStmt->bind_param("si", $userEmail, $quizId);
    $completedStmt->execute();
    $completedCount = (int)$completedStmt->get_result()->fetch_assoc()['completed_count'];
    $completedStmt->close();

    if ($attemptLimit > 0 && $completedCount >= $attemptLimit) {
        die("You have used all your attempts for this quiz.");
    }

    $attemptNumberStmt = $conn->prepare("SELECT COUNT(*) AS attempt_total FROM quiz_attempts WHERE user_email = ? AND quiz_id = ?");
    $attemptNumberStmt->bind_param("si", $userEmail, $quizId);
    $attemptNumberStmt->execute();
    $attemptNumber = (int)$attemptNumberStmt->get_result()->fetch_assoc()['attempt_total'] + 1;
    $attemptNumberStmt->close();

    $now = date('Y-m-d H:i:s');
    $insertAttempt = $conn->prepare("INSERT INTO quiz_attempts (user_email, quiz_id, attempt_count, attempt_number, start_time, status) VALUES (?, ?, ?, ?, ?, 'in_progress')");
    $insertAttempt->bind_param("siiis", $userEmail, $quizId, $attemptNumber, $attemptNumber, $now);
    if ($insertAttempt->execute()) {
        $attemptId = $insertAttempt->insert_id;
        $startTime = $currentTime;
        $current_saved_step = 0;
        $saved_question_order = null;
        $saved_choice_order = null;
    } else {
        error_log("Failed to create quiz attempt for quiz {$quizId}: " . $insertAttempt->error);
        die("Failed to create quiz attempt.");
    }
    $insertAttempt->close();
} else {
    if ($attemptData['status'] !== 'in_progress') { header("Location: learner_dashboard.php"); exit(); }
    $attemptId = (int)$attemptData['attempt_id'];
    $startTime = strtotime($attemptData['start_time']);
    $current_saved_step = isset($attemptData['current_step']) ? (int)$attemptData['current_step'] : 0;
    $saved_question_order = $attemptData['question_order'] ?? null;
    $saved_choice_order = $attemptData['choice_order'] ?? null;
}

$durationSeconds = $quizDuration * 60;
$elapsedSeconds = $currentTime - $startTime;
$actualTimeLeft = $durationSeconds - $elapsedSeconds;

if ($actualTimeLeft <= 0) { ?>
<!DOCTYPE html><html lang="en"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="theme-color" content="#20201f">
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
@media (max-width:768px){body{background:#20201f}}
</style>
<?php $learnerThemeCss = 'take_quiz_light.css'; require __DIR__ . '/includes/learner_theme_head.php'; ?>
<script>
function getCsrfToken() {
    const meta = document.querySelector('meta[name="csrf-token"]');
    return meta ? meta.getAttribute('content') : '';
}
</script></head><body>
<div class="state-card">
<h1>⏱ Time's Up!</h1>
<p>Your session has ended. Submitting your answers now...</p>
<div class="spinner"></div>
<form id="autoSubmitGate" action="submit_quiz.php" method="POST" style="display:none">
<input type="hidden" name="csrf_token" value="<?= htmlspecialchars($_SESSION['csrf_token']) ?>">
<input type="hidden" name="quiz_id" value="<?= $quizId ?>">
<input type="hidden" name="start_time" value="<?= $startTime ?>">
</form></div>
<script>setTimeout(()=>document.getElementById('autoSubmitGate').submit(),2000)</script>
</body></html>
<?php exit(); }

// ── QUESTIONS ────────────────────────────────────────────────────────────────
$query = $conn->prepare("SELECT q.id AS question_id, q.question_text, q.image_path, q.points, q.question_type, c.id AS choice_id, c.choice_text FROM quizquestions q LEFT JOIN choices c ON q.id = c.question_id WHERE q.quiz_id = ? ORDER BY q.id, c.id");
$query->bind_param("i", $quizId);
$query->execute();
$result = $query->get_result();

$questions = [];
while ($row = $result->fetch_assoc()) {
    $qid = $row['question_id'];
    if (!isset($questions[$qid])) {
        $questions[$qid] = ['id' => $qid, 'text' => $row['question_text'], 'image' => $row['image_path'], 'points' => $row['points'], 'question_type' => $row['question_type'] ?? 'mcq', 'choices' => []];
    }
    if ($row['choice_id']) { $questions[$qid]['choices'][] = ['id' => $row['choice_id'], 'text' => $row['choice_text']]; }
}
$query->close();

$fitbStmt = $conn->prepare("
    SELECT fq.question_id, fq.sub_type, fq.scoring_mode, fq.distractors_json,
           fb.blank_index, fb.accepted_answers_json, fb.case_sensitive
    FROM fitb_questions fq
    JOIN fitb_blanks fb ON fb.question_id = fq.question_id
    JOIN quizquestions qq ON qq.id = fq.question_id
    WHERE qq.quiz_id = ?
    ORDER BY fq.question_id ASC, fb.blank_index ASC
");
$fitbStmt->bind_param("i", $quizId);
$fitbStmt->execute();
$fitbResult = $fitbStmt->get_result();
while ($row = $fitbResult->fetch_assoc()) {
    $qid = (int)$row['question_id'];
    if (!isset($questions[$qid])) {
        continue;
    }
    if (!isset($questions[$qid]['fitb'])) {
        $distractors = json_decode($row['distractors_json'] ?? '[]', true);
        $questions[$qid]['fitb'] = [
            'sub_type' => in_array($row['sub_type'], ['free_type', 'word_bank'], true) ? $row['sub_type'] : 'free_type',
            'scoring_mode' => in_array($row['scoring_mode'], ['partial', 'all_or_nothing'], true) ? $row['scoring_mode'] : 'partial',
            'distractors' => is_array($distractors) ? $distractors : [],
            'blanks' => []
        ];
    }
    $answers = json_decode($row['accepted_answers_json'] ?? '[]', true);
    $questions[$qid]['fitb']['blanks'][] = [
        'blank_index' => (int)$row['blank_index'],
        'accepted_answers' => is_array($answers) ? $answers : [],
        'case_sensitive' => (int)$row['case_sensitive']
    ];
}
$fitbStmt->close();

$maStmt = $conn->prepare("
    SELECT question_id, scoring_mode, select_exactly
    FROM multiple_answer_questions
    WHERE question_id IN (SELECT id FROM quizquestions WHERE quiz_id = ?)
");
$maStmt->bind_param("i", $quizId);
$maStmt->execute();
$maResult = $maStmt->get_result();
while ($row = $maResult->fetch_assoc()) {
    $qid = (int)$row['question_id'];
    if (isset($questions[$qid])) {
        $questions[$qid]['multiple_answer'] = [
            'scoring_mode' => in_array($row['scoring_mode'] ?? '', ['exact_match', 'partial_penalty'], true) ? $row['scoring_mode'] : 'exact_match',
            'select_exactly' => empty($row['select_exactly']) ? null : (int)$row['select_exactly']
        ];
    }
}
$maStmt->close();

if (isset($quiz['shuffle_questions']) && $quiz['shuffle_questions'] == 1) {
    $questions = array_values($questions);

    if (!empty($saved_question_order)) {
        // Returning learner — restore exact same shuffle
        $savedOrder = json_decode($saved_question_order, true);
        $savedChoiceOrder = !empty($saved_choice_order) ? json_decode($saved_choice_order, true) : [];
        $indexed = [];
        foreach ($questions as $q) { $indexed[$q['id']] = $q; }
        $questions = [];
        foreach ($savedOrder as $qid) {
            if (isset($indexed[$qid])) $questions[] = $indexed[$qid];
        }
        if (is_array($savedChoiceOrder)) {
            foreach ($questions as &$q) {
                if (empty($savedChoiceOrder[$q['id']]) || empty($q['choices'])) continue;
                $choiceIndexed = [];
                foreach ($q['choices'] as $choice) { $choiceIndexed[$choice['id']] = $choice; }
                $orderedChoices = [];
                foreach ($savedChoiceOrder[$q['id']] as $choiceId) {
                    if (isset($choiceIndexed[$choiceId])) $orderedChoices[] = $choiceIndexed[$choiceId];
                }
                if (!empty($orderedChoices)) $q['choices'] = $orderedChoices;
            }
            unset($q);
        }
    } else {
        // First visit — shuffle and save the order
        shuffle($questions);
        foreach ($questions as &$q) { if (!empty($q['choices'])) shuffle($q['choices']); }
        unset($q);
        $order   = array_column($questions, 'id');
        $encoded = json_encode($order);
        $choiceOrder = [];
        foreach ($questions as $q) {
            $choiceOrder[$q['id']] = array_column($q['choices'], 'id');
        }
        $encodedChoiceOrder = json_encode($choiceOrder);
        $saveOrder = $conn->prepare("UPDATE quiz_attempts SET question_order = ?, choice_order = ? WHERE attempt_id = ?");
        $saveOrder->bind_param("ssi", $encoded, $encodedChoiceOrder, $attemptId);
        $saveOrder->execute();
        $saveOrder->close();
    }
}

$savedAnswers = [];
$loadStmt = $conn->prepare("SELECT question_id, selected_choice_id, answer_text FROM user_answers WHERE attempt_id = ?");
$loadStmt->bind_param("i", $attemptId);
$loadStmt->execute();
$savedResult = $loadStmt->get_result();
while ($row = $savedResult->fetch_assoc()) {
    $savedAnswers[$row['question_id']] = $row['answer_text'] !== null ? $row['answer_text'] : $row['selected_choice_id'];
}
$loadStmt->close();

$totalQuestions = count($questions);
$answeredCount = count($savedAnswers);
$answeredCount = 0;
foreach ($savedAnswers as $savedAnswer) {
    $decoded = is_string($savedAnswer) ? json_decode($savedAnswer, true) : null;
    if (is_array($decoded)) {
        if (count($decoded) > 0) $answeredCount++;
    } elseif (trim((string)$savedAnswer) !== '') {
        $answeredCount++;
    }
}

function decode_fitb_answer_map($raw): array {
    $decoded = json_decode((string)$raw, true);
    return is_array($decoded) ? $decoded : [];
}

function render_fitb_sentence(string $text, int $questionId, array $answerMap, string $subType): string {
    $parts = preg_split('/(\{blank\})/i', $text, -1, PREG_SPLIT_DELIM_CAPTURE);
    $html = '';
    $blankIndex = 1;
    foreach ($parts as $part) {
        if (preg_match('/^\{blank\}$/i', $part)) {
            $value = htmlspecialchars((string)($answerMap[(string)$blankIndex] ?? $answerMap[$blankIndex] ?? ''));
            $slotClass = $subType === 'word_bank' ? ' fitb-word-slot' : '';
            $html .= '<input type="text" class="fitb-input' . $slotClass . '" name="fitb_answers[' . $questionId . '][' . $blankIndex . ']" data-blank-index="' . $blankIndex . '" maxlength="200" placeholder="..." value="' . $value . '">';
            $blankIndex++;
        } else {
            $html .= htmlspecialchars($part);
        }
    }
    return $html;
}

function build_word_bank(array $fitb): array {
    $words = [];
    foreach ($fitb['blanks'] ?? [] as $blank) {
        foreach ($blank['accepted_answers'] ?? [] as $answer) {
            if ($answer !== '' && !in_array($answer, $words, true)) {
                $words[] = $answer;
            }
        }
    }
    foreach ($fitb['distractors'] ?? [] as $distractor) {
        if ($distractor !== '' && !in_array($distractor, $words, true)) {
            $words[] = $distractor;
        }
    }
    shuffle($words);
    return $words;
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="csrf-token" content="<?php echo htmlspecialchars($_SESSION['csrf_token']); ?>">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="theme-color" content="#20201f">
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
        .choice-checkbox { border-radius: 5px; }
        .choice-checkbox::after { border-radius: 2px; }

        .choice-item.selected .choice-text { color: var(--teal); font-weight: 700; }

        .choice-text {
            font-size: 14px;
            font-weight: 600;
            color: var(--text-1);
            line-height: 1.5;
            flex: 1;
        }

        /* Hidden real inputs */
        .choice-item input[type="radio"],
        .choice-item input[type="checkbox"] {
            position: absolute;
            opacity: 0;
            width: 0; height: 0;
        }

        .open-answer-box {
            width: 100%;
            min-height: 160px;
            resize: vertical;
            background: rgba(255,255,255,0.025);
            border: 1.5px solid rgba(255,255,255,0.07);
            border-radius: 10px;
            color: var(--text-1);
            font-family: var(--font);
            font-size: 15px;
            line-height: 1.6;
            padding: 14px 16px;
            outline: none;
            transition: border-color 0.18s, background 0.18s;
        }
        .open-answer-box:focus {
            background: rgba(255,255,255,0.04);
            border-color: var(--teal);
        }
        .open-answer-counter {
            margin-top: 8px;
            color: var(--text-2);
            font-size: 12px;
            text-align: right;
        }

        .fitb-sentence {
            font-size: 18px;
            line-height: 2.1;
            color: var(--text-1);
            margin: 8px 0 16px;
        }

        .fitb-input {
            display: inline-block;
            width: min(220px, 70vw);
            min-width: 120px;
            margin: 0 6px;
            padding: 8px 10px;
            border: 1px solid var(--border);
            border-radius: var(--radius-sm);
            background: rgba(255,255,255,0.05);
            color: var(--text-1);
            font: inherit;
        }

        .fitb-input:focus,
        .fitb-input.selected {
            outline: none;
            border-color: var(--teal);
            background: rgba(79,209,197,0.07);
        }

        .fitb-word-bank {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
            margin-top: 12px;
        }

        .fitb-chip {
            border: 1px solid rgba(79,209,197,0.28);
            background: rgba(79,209,197,0.08);
            color: var(--teal);
            border-radius: var(--radius-sm);
            padding: 8px 11px;
            font-weight: 800;
            cursor: pointer;
        }

        .fitb-chip.used {
            opacity: 0.4;
            cursor: default;
            background: rgba(255,255,255,0.04);
            color: var(--text-2);
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
            html, body { background: #20201f; }

            .sidebar { display: none; }

            .main-content {
                margin-left: 0;
                padding: 16px 14px 100px;
            }

            .topbar { padding: 0 14px; background: #20201f; }
            .topbar-meta { display: none; }

            .question-card { padding: 20px 18px; background: #20201f; }
            .q-text { font-size: 15px; }
            .choice-item { padding: 12px 14px; }

            .modal-box { background: #20201f; }

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

        /* ═══════════════════════════════════════════════
           DESKTOP REDESIGN — flat, exam-style (769px and up)
           Mobile rules above are untouched.
        ═══════════════════════════════════════════════ */
        .q-hint { color: #8b949e; font-size: 13px; font-weight: 700; margin-bottom: 12px; }
        .timer-text small { display: none; }

        @media (min-width: 769px) {
            :root {
                --bg: #0b0f14; --surface: #10151c; --surface-2: #10151c;
                --border: rgba(255,255,255,0.08); --border-strong: rgba(255,255,255,0.16);
                --text-1: #e6edf3; --text-2: #8b98a8; --text-3: #5b6675;
                --radius: 8px; --radius-sm: 6px; --sidebar-w: 240px; --timer-h: 56px;
            }
            body { font-size: 14px; font-weight: 400; }

            /* Top bar */
            .topbar { padding: 0 24px 0 16px; }
            .back-btn { width: 32px; height: 32px; background: none; border-radius: 6px; }
            .topbar-title { font-size: 14px; font-weight: 600; }
            .topbar-meta { margin-top: 1px; }
            .timer-pill { border-radius: 6px; background: none; padding: 6px 12px 6px 10px; }
            .timer-ring, .timer-ring svg { width: 22px; height: 22px; }
            .timer-ring circle { stroke-width: 2.5; }
            .timer-text small { display: block; font-size: 10px; letter-spacing: .08em; text-transform: uppercase; color: var(--text-3); line-height: 1.2; }
            #timer-display { display: block; font-size: 16px; font-weight: 600; min-width: 0; letter-spacing: .02em; line-height: 1.2; }

            /* Sidebar */
            .sidebar { padding: 22px 18px; gap: 22px; }
            .sidebar-progress { background: none; border: 0; border-radius: 0; padding: 0; }
            .sidebar-progress-label, .sidebar-section-label { font-size: 11px; font-weight: 600; letter-spacing: .08em; color: var(--text-3); margin-bottom: 10px; }
            /* progress bar becomes a hairline under the top bar */
            .progress-bar-track { position: fixed; top: var(--timer-h); left: 0; right: 0; height: 2px; margin: 0; border-radius: 0; background: var(--border); z-index: 1001; }
            .progress-bar-fill { background: var(--teal); border-radius: 0; }
            .progress-fraction { font-size: 13px; font-weight: 400; color: var(--text-2); }
            .progress-fraction span { color: var(--text-2); font-weight: 400; }
            .progress-fraction #answeredCount { color: var(--text-1); font-weight: 600; }
            .sidebar-legend { flex-direction: row; flex-wrap: wrap; gap: 6px 14px; }
            .legend-item { gap: 6px; }
            .legend-dot { width: 8px; height: 8px; border-radius: 2px; }
            .ld-unanswered { background: none; border: 1px solid var(--border-strong); }
            .ld-answered   { background: rgba(255,255,255,0.14); border: 0; }
            .ld-current    { background: none; border: 1px solid var(--teal); }
            .ld-flagged    { background: var(--orange); border: 0; border-radius: 50%; }
            .palette-grid { grid-template-columns: repeat(4, 1fr); }
            .p-item { aspect-ratio: auto; height: 36px; position: relative; border-radius: 6px; font-size: 13px; font-weight: 500; background: none; border: 1px solid var(--border); font-variant-numeric: tabular-nums; }
            .p-item:hover { transform: none; background: none; border-color: var(--border-strong); color: var(--text-1); }
            .p-item.answered { background: rgba(255,255,255,0.06); border-color: transparent; color: var(--text-1); }
            .p-item.current, .p-item.answered.current { background: rgba(79,209,197,0.09); border-color: var(--teal); color: var(--teal); box-shadow: none; }
            .p-item.flagged { border-color: var(--border) !important; color: var(--text-2) !important; }
            .p-item.flagged.answered { border-color: transparent !important; color: var(--text-1) !important; }
            .p-item.flagged.current { border-color: var(--teal) !important; color: var(--teal) !important; }
            .p-item.flagged::after { content: ''; position: absolute; top: 4px; right: 4px; width: 6px; height: 6px; border-radius: 50%; background: var(--orange); }
            .sidebar-note { font-size: 11.5px; color: var(--text-3); text-align: center; margin-top: -12px; }

            /* Main column */
            .main-content { max-width: none; padding: 44px 32px 112px; }
            .main-content > form { max-width: 720px; margin: 0 auto; }
            .step-indicator { display: none; }

            /* Question (flat, no panel) */
            .question-card { background: none; border: 0; border-bottom: 1px solid var(--border); border-radius: 0; padding: 0 0 32px; margin-bottom: 32px; animation: none; }
            .question-card:hover, .question-card.active-card, .question-card.card-answered { border-color: var(--border); box-shadow: none; }
            .multi-page-mode .question-card { border-bottom: 0; padding-bottom: 0; margin-bottom: 0; }
            .q-toprow { margin-bottom: 22px; }
            .q-number { font-size: 12px; font-weight: 500; letter-spacing: .08em; color: var(--text-3); }
            .pts-badge { background: none; color: var(--text-2); border: 1px solid var(--border); padding: 2px 8px; font-size: 11.5px; font-weight: 400; }
            .flag-btn { width: auto; height: auto; padding: 5px 10px; gap: 6px; border-radius: 6px; font-family: var(--font); font-size: 12px; color: var(--text-2); background: none; border: 1px solid var(--border); }
            .flag-btn::after { content: 'Flag for review'; }
            .flag-btn.flagged::after { content: 'Flagged'; }
            .flag-btn:hover { border-color: var(--border-strong); color: var(--text-1); background: none; }
            .flag-btn.flagged, .flag-btn.flagged:hover { color: var(--orange); border-color: rgba(245,158,11,0.45); background: rgba(245,158,11,0.07); }
            .flag-btn.flagged svg { fill: currentColor; }
            .q-text { font-size: 18px; font-weight: 500; line-height: 1.55; margin-bottom: 26px; }
            .q-hint { font-size: 12.5px; font-weight: 400; color: var(--text-2); margin: -14px 0 18px; }
            .q-image { border-radius: 8px; margin-bottom: 24px; }
            .q-image:hover { transform: none; }

            /* Options: lettered keys A, B, C… */
            .choices-list { gap: 8px; counter-reset: opt; }
            .choice-item { counter-increment: opt; padding: 13px 16px; background: none; border: 1px solid var(--border); border-radius: 8px; transition: border-color .12s, background .12s; }
            .choice-item:hover { background: rgba(255,255,255,0.02); border-color: var(--border-strong); transform: none; }
            .choice-radio { width: 26px; height: 26px; border-radius: 6px; border: 1px solid var(--border-strong); font-size: 12px; font-weight: 600; color: var(--text-2); }
            .choice-radio::before { content: counter(opt, upper-alpha); }
            .choice-radio::after { display: none; }
            .choice-checkbox { border-radius: 5px; }
            .choice-item.selected { background: rgba(79,209,197,0.09); border-color: var(--teal); }
            .choice-item.selected .choice-radio { background: var(--teal); border-color: var(--teal); color: #06201d; }
            .choice-item.selected .choice-checkbox::before { content: '\2713'; }
            .choice-text { font-size: 15px; font-weight: 400; line-height: 1.45; }
            .choice-item.selected .choice-text { color: var(--text-1); font-weight: 400; }

            /* Open answer + fill-in-the-blank */
            .open-answer-box { min-height: 200px; background: none; border: 1px solid var(--border); border-radius: 8px; }
            .open-answer-box:focus { background: none; border-color: var(--teal); }
            .open-answer-counter { color: var(--text-3); }
            .fitb-sentence { font-size: 17px; }
            .fitb-input { background: rgba(255,255,255,0.03); border-radius: 6px; }
            .fitb-chip { background: none; border-color: var(--border-strong); color: var(--text-1); font-weight: 500; border-radius: 6px; }
            .fitb-chip:hover:not(.used) { border-color: var(--teal); color: var(--teal); }
            .fitb-chip.used { background: none; color: var(--text-3); border-color: var(--border); }

            /* Footer navigation bar */
            .nav-bar { position: fixed; left: var(--sidebar-w); right: 0; bottom: 0; height: 64px; margin: 0; padding: 0 max(32px, calc((100% - var(--sidebar-w) - 720px) / 2)); background: var(--surface); border-top: 1px solid var(--border); align-items: center; justify-content: space-between; z-index: 50; }
            .nav-btn { flex: none; padding: 9px 18px; font-size: 13px; font-weight: 500; border-radius: 6px; gap: 6px; background: none; border: 1px solid var(--border-strong); color: var(--text-1); }
            #prevBtn { background: none; color: var(--text-1); }
            #prevBtn:hover { background: rgba(255,255,255,0.04); color: var(--text-1); }
            #nextBtn { background: var(--teal); border-color: var(--teal); color: #06201d; font-weight: 600; margin-left: auto; }
            #nextBtn:hover { background: var(--teal); filter: brightness(1.08); }

            /* Submit */
            .submit-btn { background: var(--teal); box-shadow: none; border-radius: 6px; padding: 10px 20px; font-size: 13px; font-weight: 600; letter-spacing: 0; }
            .submit-btn:hover { opacity: 1; transform: none; box-shadow: none; filter: brightness(1.08); }
            .sidebar .submit-btn { width: 100%; }
            #mainSubmitAlt { width: fit-content; margin: 0 0 0 auto; }
            #mainSubmit { position: fixed; bottom: 12px; right: max(32px, calc((100% - var(--sidebar-w) - 720px) / 2)); width: auto; margin: 0; z-index: 60; }

            /* Modals + toast */
            .modal-overlay { background: rgba(0,0,0,0.6); backdrop-filter: none; }
            .modal-box { border-radius: 10px; padding: 24px; max-width: 380px; text-align: left; box-shadow: none; border-color: var(--border-strong); animation: none; }
            .modal-icon { display: none; }
            .modal-title { font-size: 16px; font-weight: 600; }
            .modal-body { font-size: 13px; margin-bottom: 20px; }
            .modal-actions { justify-content: flex-end; }
            .modal-btn { flex: none; padding: 9px 18px; border-radius: 6px; font-size: 13px; font-weight: 500; }
            .modal-btn.primary { background: var(--teal); color: #06201d; font-weight: 600; }
            .modal-btn.primary:hover { background: var(--teal); filter: brightness(1.08); }
            .modal-btn.secondary { background: none; border: 1px solid var(--border-strong); }
            .toast { border-radius: 6px; font-size: 13px; font-weight: 600; box-shadow: none; }
        }
    </style>
<?php $learnerThemeCss = 'take_quiz_light.css'; require __DIR__ . '/includes/learner_theme_head.php'; ?>
<script>
function getCsrfToken() {
    const meta = document.querySelector('meta[name="csrf-token"]');
    return meta ? meta.getAttribute('content') : '';
}
</script></head>
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
        <div class="timer-text"><small>Time remaining</small><span id="timer-display">--:--</span></div>
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
        <div class="sidebar-note">Answers save automatically</div>
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
            <input type="hidden" name="csrf_token" value="<?= htmlspecialchars($_SESSION['csrf_token']) ?>">
            <input type="hidden" name="queue_user" value="<?= htmlspecialchars($userEmail) ?>">
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

                <?php if (!empty($q['image'])): ?>
                    <img src="<?= htmlspecialchars($q['image']) ?>" class="q-image" alt="Question image"
                         onclick="openLightbox(this)">
                <?php endif; ?>

                <?php if (($q['question_type'] ?? 'mcq') === 'fill_in_blank'):
                    $fitb = $q['fitb'] ?? ['sub_type' => 'free_type', 'blanks' => [], 'distractors' => []];
                    $fitbAnswers = decode_fitb_answer_map($savedAnswers[$qid] ?? '');
                    $fitbSubType = $fitb['sub_type'] ?? 'free_type';
                ?>
                <div class="fitb-sentence" data-fitb-sub-type="<?= htmlspecialchars($fitbSubType) ?>">
                    <?= render_fitb_sentence($q['text'], (int)$qid, $fitbAnswers, $fitbSubType) ?>
                </div>
                <?php if ($fitbSubType === 'word_bank'): ?>
                    <div class="fitb-word-bank" data-question-id="<?= $qid ?>">
                        <?php foreach (build_word_bank($fitb) as $word): ?>
                            <button type="button" class="fitb-chip" data-word="<?= htmlspecialchars($word) ?>"><?= htmlspecialchars($word) ?></button>
                        <?php endforeach; ?>
                    </div>
                <?php endif; ?>
                <?php elseif (($q['question_type'] ?? 'mcq') === 'open_ended'): ?>
                <p class="q-text"><?= htmlspecialchars($q['text']) ?></p>
                <textarea class="open-answer-box"
                          name="open_answers[<?= $qid ?>]"
                          maxlength="5000"
                          placeholder="Type your answer here..."
                          data-question-index="<?= $qNum ?>"><?= htmlspecialchars($savedAnswers[$qid] ?? '') ?></textarea>
                <div class="open-answer-counter" id="open-counter-<?= $qid ?>">
                    <?= strlen((string)($savedAnswers[$qid] ?? '')) ?> / 5000
                </div>
                <?php elseif (($q['question_type'] ?? 'mcq') === 'multiple_answer'):
                    $savedMultipleAnswers = json_decode((string)($savedAnswers[$qid] ?? '[]'), true);
                    $savedMultipleAnswers = is_array($savedMultipleAnswers) ? array_map('intval', $savedMultipleAnswers) : [];
                    $selectExactly = (int)($q['multiple_answer']['select_exactly'] ?? 0);
                ?>
                <p class="q-text"><?= htmlspecialchars($q['text']) ?></p>
                <div class="q-hint">
                    <?= $selectExactly > 0 ? 'Select exactly ' . $selectExactly . ' answers.' : 'Select all that apply.' ?>
                </div>
                <div class="choices-list">
                    <?php foreach ($q['choices'] as $ci => $choice): ?>
                    <label class="choice-item <?= in_array((int)$choice['id'], $savedMultipleAnswers, true) ? 'selected' : '' ?>" id="choice-<?= $qid ?>-<?= $choice['id'] ?>">
                        <input type="checkbox"
                               name="multiple_answers[<?= $qid ?>][]"
                               value="<?= $choice['id'] ?>"
                               <?= in_array((int)$choice['id'], $savedMultipleAnswers, true) ? 'checked' : '' ?>>
                        <div class="choice-radio choice-checkbox"></div>
                        <span class="choice-text"><?= htmlspecialchars($choice['text']) ?></span>
                    </label>
                    <?php endforeach; ?>
                </div>
                <?php else: ?>
                <p class="q-text"><?= htmlspecialchars($q['text']) ?></p>
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
                <?php endif; ?>
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
            <button type="button" class="submit-btn" id="mainSubmitAlt" onclick="submitQuiz()">
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
            if (IS_LINEAR) {
    document.querySelectorAll('.p-item').forEach(item => {
        item.style.cursor = 'default';
        item.title = 'Linear mode — navigation locked';
    });
}
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
    // Linear mode: palette is read-only, no jumping allowed at all
    if (IS_LINEAR) return;

    trackSpeed();
    if (LAYOUT === 'multi_page') {
        currentStep = n;
        showQuestion(n);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
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

    function onMultipleAnswerChange(checkbox) {
        const card = checkbox.closest('.question-card');
        if (!card) return;
        const checkedBoxes = Array.from(card.querySelectorAll('input[type="checkbox"][name^="multiple_answers["]:checked'));
        card.querySelectorAll('.choice-item').forEach(li => li.classList.remove('selected'));
        checkedBoxes.forEach(box => box.closest('.choice-item').classList.add('selected'));
        if (checkedBoxes.length > 0) card.classList.add('card-answered');
        else card.classList.remove('card-answered');
        saveAnswers();
        autoSave(card.getAttribute('data-question-id'), null);
        updatePalette();
        updateProgress();
    }

    function updateAllCardStates() {
        questions.forEach(card => {
            const qid = card.getAttribute('data-question-id');
            const checked = card.querySelector('input[type="radio"]:checked');
            const multiChecked = card.querySelector('input[type="checkbox"][name^="multiple_answers["]:checked');
            const textAnswer = card.querySelector('.open-answer-box');
            const fitbInputs = Array.from(card.querySelectorAll('.fitb-input'));
            const fitbAnswered = fitbInputs.length > 0 && fitbInputs.every(input => input.value.trim().length > 0);
            if (checked || multiChecked || (textAnswer && textAnswer.value.trim().length > 0) || fitbAnswered) {
                card.classList.add('card-answered');
                if (checked) checked.closest('.choice-item').classList.add('selected');
                card.querySelectorAll('input[type="checkbox"][name^="multiple_answers["]:checked').forEach(box => box.closest('.choice-item').classList.add('selected'));
            }
        });
    }

    // ── LOAD ANSWERS ─────────────────────────────────────────────────────────
    function loadAnswers() {
        const local = JSON.parse(sessionStorage.getItem('quiz_' + QUIZ_ID + '_' + '<?= $userEmail ?>') || '{}');
        const merged = { ...local, ...DB_ANSWERS };

        Object.entries(merged).forEach(([qid, cid]) => {
            const textAnswer = document.querySelector(`textarea[name="open_answers[${qid}]"]`);
            if (textAnswer) {
                textAnswer.value = cid;
                updateOpenCounter(textAnswer);
                if (String(cid).trim().length > 0) textAnswer.closest('.question-card').classList.add('card-answered');
                return;
            }
            const fitbInputs = document.querySelectorAll(`input[name^="fitb_answers[${qid}]"]`);
            if (fitbInputs.length > 0) {
                let map = {};
                try { map = typeof cid === 'string' ? JSON.parse(cid) : cid; } catch (e) { map = {}; }
                fitbInputs.forEach(input => {
                    const blankIndex = input.dataset.blankIndex;
                    input.value = map[blankIndex] || '';
                });
                const card = fitbInputs[0].closest('.question-card');
                updateFitbCardState(card);
                syncFitbChips(card);
                return;
            }
            const multiInputs = document.querySelectorAll(`input[name="multiple_answers[${qid}][]"]`);
            if (multiInputs.length > 0) {
                let values = [];
                try { values = typeof cid === 'string' ? JSON.parse(cid) : cid; } catch (e) { values = []; }
                values = Array.isArray(values) ? values.map(String) : [];
                multiInputs.forEach(input => {
                    input.checked = values.includes(String(input.value));
                    input.closest('.choice-item').classList.toggle('selected', input.checked);
                });
                if (values.length > 0) multiInputs[0].closest('.question-card').classList.add('card-answered');
                return;
            }
            const radio = document.querySelector(`input[name="answers[${qid}]"][value="${cid}"]`);
            if (radio) {
                radio.checked = true;
                radio.closest('.choice-item').classList.add('selected');
                radio.closest('.question-card').classList.add('card-answered');
            }
        });

        // Restore flags
        const flags = JSON.parse(sessionStorage.getItem('flags_' + QUIZ_ID + '_' + '<?= $userEmail ?>') || '[]');
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
        document.querySelectorAll('.open-answer-box').forEach(t => {
            const m = t.name.match(/open_answers\[(\d+)\]/);
            if (m && t.value.trim().length > 0) obj[m[1]] = t.value;
        });
        document.querySelectorAll('.question-card').forEach(card => {
            const multiInputs = Array.from(card.querySelectorAll('input[type="checkbox"][name^="multiple_answers["]:checked'));
            if (multiInputs.length > 0) {
                const qid = card.getAttribute('data-question-id');
                obj[qid] = multiInputs.map(input => input.value);
                return;
            }
            const inputs = Array.from(card.querySelectorAll('.fitb-input'));
            if (inputs.length === 0) return;
            const qid = card.getAttribute('data-question-id');
            const map = {};
            let hasAny = false;
            inputs.forEach(input => {
                map[input.dataset.blankIndex] = input.value;
                if (input.value.trim().length > 0) hasAny = true;
            });
            if (hasAny) obj[qid] = map;
        });
        sessionStorage.setItem('quiz_' + QUIZ_ID + '_' + '<?= $userEmail ?>', JSON.stringify(obj));
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
        if (questionId && choiceId === null) {
            const textarea = document.querySelector(`.question-card[data-question-id="${questionId}"] .open-answer-box`);
            if (textarea) {
                fd.append('question_id', questionId);
                fd.append('answer_text', textarea.value);
            }
            const fitbInputs = document.querySelectorAll(`.question-card[data-question-id="${questionId}"] .fitb-input`);
            if (fitbInputs.length > 0) {
                const map = {};
                fitbInputs.forEach(input => {
                    map[input.dataset.blankIndex] = input.value.slice(0, 200);
                });
                fd.append('question_id', questionId);
                fd.append('fitb_answers', JSON.stringify(map));
            }
            const multipleInputs = document.querySelectorAll(`.question-card[data-question-id="${questionId}"] input[type="checkbox"][name^="multiple_answers["]`);
            if (multipleInputs.length > 0) {
                const choiceIds = Array.from(multipleInputs)
                    .filter(input => input.checked)
                    .map(input => parseInt(input.value, 10))
                    .filter(Number.isInteger);
                fd.append('question_id', questionId);
                fd.append('selected_choice_ids', JSON.stringify(choiceIds));
            }
        }
        fetch('save_progress.php', { method: 'POST', headers: { 'X-CSRF-Token': getCsrfToken(), 'X-iSkool-Queue-User': <?= json_encode($userEmail) ?> }, body: fd })
            .catch(e => console.warn('Save failed', e));
    }

    // ── PALETTE ──────────────────────────────────────────────────────────────
    function updatePalette() {
        questions.forEach((card, i) => {
            const qid = card.getAttribute('data-question-id');
            const textAnswer = card.querySelector('.open-answer-box');
            const fitbInputs = Array.from(card.querySelectorAll('.fitb-input'));
            const fitbAnswered = fitbInputs.length > 0 && fitbInputs.every(input => input.value.trim().length > 0);
            const answered = card.querySelector('input[type="radio"]:checked') || card.querySelector('input[type="checkbox"][name^="multiple_answers["]:checked') || (textAnswer && textAnswer.value.trim().length > 0) || fitbAnswered;
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
        const textCount = Array.from(document.querySelectorAll('.open-answer-box')).filter(t => t.value.trim().length > 0).length;
        const fitbCount = Array.from(document.querySelectorAll('.question-card')).filter(card => {
            const inputs = Array.from(card.querySelectorAll('.fitb-input'));
            return inputs.length > 0 && inputs.every(input => input.value.trim().length > 0);
        }).length;
        const multiCount = Array.from(document.querySelectorAll('.question-card')).filter(card => card.querySelector('input[type="checkbox"][name^="multiple_answers["]:checked')).length;
        const count = document.querySelectorAll('input[type="radio"]:checked').length + multiCount + textCount + fitbCount;
        const pct   = TOTAL_Q > 0 ? Math.round((count / TOTAL_Q) * 100) : 0;
        if (progressFill) progressFill.style.width = pct + '%';
        if (answeredEl)   answeredEl.textContent = count;
    }

    // ── FLAG ─────────────────────────────────────────────────────────────────
    function toggleFlag(btn, qid) {
        btn.classList.toggle('flagged');
        const flags = JSON.parse(sessionStorage.getItem('flags_' + QUIZ_ID + '_' + '<?= $userEmail ?>') || '[]');
        if (btn.classList.contains('flagged')) {
            if (!flags.includes(qid)) flags.push(qid);
        } else {
            const idx = flags.indexOf(qid);
            if (idx > -1) flags.splice(idx, 1);
        }
        sessionStorage.setItem('flags_' + QUIZ_ID + '_' + '<?= $userEmail ?>', JSON.stringify(flags));
        updatePalette();
    }

    // ── SUBMIT ───────────────────────────────────────────────────────────────
    function submitQuiz() {
        const textCount = Array.from(document.querySelectorAll('.open-answer-box')).filter(t => t.value.trim().length > 0).length;
        const fitbCount = Array.from(document.querySelectorAll('.question-card')).filter(card => {
            const inputs = Array.from(card.querySelectorAll('.fitb-input'));
            return inputs.length > 0 && inputs.every(input => input.value.trim().length > 0);
        }).length;
        const multiCount = Array.from(document.querySelectorAll('.question-card')).filter(card => card.querySelector('input[type="checkbox"][name^="multiple_answers["]:checked')).length;
        const count = document.querySelectorAll('input[type="radio"]:checked').length + multiCount + textCount + fitbCount;
        document.getElementById('smAnswered').textContent = count;
        document.getElementById('submitModal').classList.add('show');
    }

    function updateOpenCounter(textarea) {
        const card = textarea.closest('.question-card');
        const qid = card.getAttribute('data-question-id');
        const counter = document.getElementById(`open-counter-${qid}`);
        if (counter) counter.textContent = `${textarea.value.length} / 5000`;
    }

    function onOpenAnswerInput(textarea, qIndex) {
        const card = textarea.closest('.question-card');
        updateOpenCounter(textarea);
        if (textarea.value.trim().length > 0) card.classList.add('card-answered');
        else card.classList.remove('card-answered');
        saveAnswers();
        autoSave(card.getAttribute('data-question-id'), null);
        updatePalette();
        updateProgress();
    }

    document.addEventListener('input', function(e) {
        if (e.target.classList.contains('open-answer-box')) {
            onOpenAnswerInput(e.target, parseInt(e.target.dataset.questionIndex, 10));
            return;
        }
        if (e.target.classList.contains('fitb-input')) {
            const card = e.target.closest('.question-card');
            updateFitbCardState(card);
            syncFitbChips(card);
            saveAnswers();
            autoSave(card.getAttribute('data-question-id'), null);
            updatePalette();
            updateProgress();
        }
    });

    document.addEventListener('change', function(e) {
        if (e.target.matches('input[type="checkbox"][name^="multiple_answers["]')) {
            onMultipleAnswerChange(e.target);
        }
    });

    function updateFitbCardState(card) {
        if (!card) return;
        const inputs = Array.from(card.querySelectorAll('.fitb-input'));
        if (inputs.length > 0 && inputs.every(input => input.value.trim().length > 0)) card.classList.add('card-answered');
        else card.classList.remove('card-answered');
    }

    function syncFitbChips(card) {
        if (!card) return;
        const used = Array.from(card.querySelectorAll('.fitb-input')).map(input => input.value.trim());
        card.querySelectorAll('.fitb-chip').forEach(chip => {
            chip.classList.toggle('used', used.includes(chip.dataset.word));
        });
    }

    let selectedFitbInput = null;
    document.addEventListener('focusin', function(e) {
        if (!e.target.classList.contains('fitb-input')) return;
        selectedFitbInput = e.target;
        document.querySelectorAll('.fitb-input.selected').forEach(input => input.classList.remove('selected'));
        e.target.classList.add('selected');
    });

    document.addEventListener('click', function(e) {
        const chip = e.target.closest('.fitb-chip');
        if (!chip || chip.classList.contains('used')) return;
        const card = chip.closest('.question-card');
        const target = selectedFitbInput && selectedFitbInput.closest('.question-card') === card
            ? selectedFitbInput
            : Array.from(card.querySelectorAll('.fitb-input')).find(input => input.value.trim() === '');
        if (!target) return;
        target.value = chip.dataset.word;
        target.dispatchEvent(new Event('input', { bubbles: true }));
    });

    document.addEventListener('dblclick', function(e) {
        if (!e.target.classList.contains('fitb-word-slot')) return;
        e.target.value = '';
        e.target.dispatchEvent(new Event('input', { bubbles: true }));
    });

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
// Track whether the page was hidden (tab switch) vs fully blurred (exit)
let _tabHiddenAt   = null;   // timestamp when tab went hidden
let _blurredAt     = null;   // timestamp when window lost focus
const TAB_EXIT_THRESHOLD_MS = 2000; // if blur fires >2000ms after hide, treat as window exit

function getCurrentQuestionId() {
    // For multi_page: currentStep is always the visible question index
    // questions[] are the DOM cards with data-question-id = real DB question ID
    if (LAYOUT === 'multi_page' || IS_LINEAR) {
        return questions[currentStep]?.getAttribute('data-question-id') ?? null;
    }
    // Single page: find the card closest to the top of the viewport
    const closest = Array.from(questions).reduce((prev, curr) =>
        Math.abs(curr.getBoundingClientRect().top) < Math.abs(prev.getBoundingClientRect().top)
            ? curr : prev
    );
    return closest.getAttribute('data-question-id') ?? null;
}

function logIntegrity(eventType) {
    if (isSubmitting) return;

    // Only log multi_page — single page tracking is unreliable
    if (LAYOUT !== 'multi_page' && !IS_LINEAR) return;

    const activeQid = getCurrentQuestionId();
    if (!activeQid) return;

    const fd = new FormData();
    fd.append('quiz_id',            QUIZ_ID);
    fd.append('event_type',         eventType);
    fd.append('layout_mode',        LAYOUT);
    fd.append('active_question_id', activeQid);
    fd.append('csrf_token',         getCsrfToken());

    // sendBeacon ensures the request fires even when the page is unloading
    navigator.sendBeacon('log_integrity_event.php', fd);
}

// ── TAB VISIBILITY CHANGE ────────────────────────────────────────────────
// Fires when the learner switches to another browser tab
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
        _tabHiddenAt = Date.now();
        logIntegrity('tab_switch');
    } else {
        // Tab became visible again — reset
        _tabHiddenAt = null;
    }
});

// ── WINDOW BLUR ──────────────────────────────────────────────────────────
// Fires when the learner Alt-Tabs or clicks outside the browser entirely.
// We distinguish this from a tab switch by checking timing.
window.addEventListener('blur', () => {
    _blurredAt = Date.now();
    const msSinceHide = _tabHiddenAt ? (_blurredAt - _tabHiddenAt) : Infinity;

    if (msSinceHide > TAB_EXIT_THRESHOLD_MS) {
        logIntegrity('quiz_exit');
        _tabHiddenAt = null;
    }
});

// ── PAGE UNLOAD / NAVIGATION AWAY ────────────────────────────────────────
// Catches the learner closing the tab, refreshing, or navigating away entirely
window.addEventListener('pagehide', () => {
    if (isSubmitting) return;
    logIntegrity('quiz_exit');
});

// ── RAPID NAVIGATION ─────────────────────────────────────────────────────
// Detects unusually fast flipping through questions (possible photo-taking)
let lastActionTime = Date.now();

function trackSpeed() {
    const now     = Date.now();
    const elapsed = (now - lastActionTime) / 1000; // seconds
    if (elapsed < 2) {
        logIntegrity('rapid_navigation');
    }
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