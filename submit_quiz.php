<?php
ob_start();
error_reporting(E_ALL);
ini_set('display_errors', 1);
ini_set('log_errors', 1);
ini_set('error_log', 'php_errors.log');

require_once __DIR__ . '/auth/session_guard.php';
require_once __DIR__ . '/auth/csrf_helper.php';
require_once 'config.php';

// 1. Security Check
if ($_SERVER['REQUEST_METHOD'] !== 'POST' || !isset($_SESSION['email']) || $_SESSION['role'] !== 'learner' || !isset($_POST['quiz_id'])) {
    header("Location: index.php");
    exit();
}

verify_csrf_token();

// === Fetch current academic year ===
$currentYearResult = $conn->query("SELECT id FROM academic_years WHERE is_current = 1 LIMIT 1");
if ($currentYearResult->num_rows === 0) {
    die("No active academic year set. Contact your admin.");
}
$current_academic_year_id = (int)$currentYearResult->fetch_assoc()['id'];

$quizId    = intval($_POST['quiz_id']);
$userEmail = $_SESSION['email'];

// 2. Fetch Quiz Metadata
$quizStmt = $conn->prepare("SELECT title, publish_marks, status, start_time, class_id, academic_year_id, has_open_ended FROM quizzes WHERE id = ?");
$quizStmt->bind_param("i", $quizId);
$quizStmt->execute();
$quiz = $quizStmt->get_result()->fetch_assoc();
if (!$quiz) { header("Location: learner_dashboard.php"); exit(); }

$quizTitle    = $quiz['title'];
$publishMarks = (int)$quiz['publish_marks'];
$status       = $quiz['status'] ?? 'Open';
$quizStartTime = $quiz['start_time'] ?? null;
$quizClassId = (int)$quiz['class_id'];
$quizAcademicYearId = (int)($quiz['academic_year_id'] ?? $current_academic_year_id);
$hasOpenEnded = (int)($quiz['has_open_ended'] ?? 0);
$quizStmt->close();
if ($quizAcademicYearId <= 0) {
    $quizAcademicYearId = $current_academic_year_id;
}

// 3. Verify availability and learner membership server-side
$quizStartTimestamp = !empty($quizStartTime) ? strtotime($quizStartTime) : null;
$currentServerTime = time();
$isQuizAvailable = false;
if ($status === 'Open') {
    $isQuizAvailable = !$quizStartTimestamp || $currentServerTime >= $quizStartTimestamp;
} elseif ($status === 'Scheduled') {
    $isQuizAvailable = $quizStartTimestamp && $currentServerTime >= $quizStartTimestamp;
}
if (!$isQuizAvailable) {
    render_page("closed", $quizTitle, 0, 0, null);
    exit();
}

$memberStmt = $conn->prepare("
    SELECT 1
    FROM class_students
    WHERE student_email = ?
      AND class_id = ?
      AND academic_year_id = ?
    LIMIT 1
");
$memberStmt->bind_param("sii", $userEmail, $quizClassId, $quizAcademicYearId);
$memberStmt->execute();
$isMember = $memberStmt->get_result()->num_rows > 0;
$memberStmt->close();
if (!$isMember) {
    die("You are not authorized to submit this quiz.");
}

// 4. Use server-side attempt start time only
$conn->begin_transaction();
$attemptStmt = $conn->prepare("
    SELECT attempt_id, start_time, status
    FROM quiz_attempts
    WHERE user_email = ? AND quiz_id = ? AND status != 'submitted'
    ORDER BY attempt_number DESC, attempt_id DESC
    LIMIT 1
    FOR UPDATE
");
$attemptStmt->bind_param("si", $userEmail, $quizId);
$attemptStmt->execute();
$attempt = $attemptStmt->get_result()->fetch_assoc();
$attemptStmt->close();
if (!$attempt || empty($attempt['start_time'])) {
    $conn->rollback();
    die("Invalid quiz attempt.");
}
$attemptId = (int)$attempt['attempt_id'];
$timeTaken = max(0, time() - strtotime($attempt['start_time']));

// 5. Prevent Double Submissions
$checkStmt = $conn->prepare("SELECT id FROM quiz_results WHERE attempt_id = ? FOR UPDATE");
$checkStmt->bind_param("i", $attemptId);
$checkStmt->execute();
if ($checkStmt->get_result()->num_rows > 0) {
    $checkStmt->close();
    $conn->rollback();
    header("Location: learner_dashboard.php");
    exit();
}
$checkStmt->close();

// Fetch Correct Answers
$sql  = "SELECT q.id as qid, q.points, c.id as cid, c.is_correct FROM quizquestions q 
         JOIN choices c ON q.id = c.question_id WHERE q.quiz_id = ? AND q.question_type = 'mcq'";
$stmt = $conn->prepare($sql);
$stmt->bind_param("i", $quizId);
$stmt->execute();
$res = $stmt->get_result();

$correctAnswers       = [];
$validChoices         = [];
$totalPointsAvailable = 0;
while ($row = $res->fetch_assoc()) {
    $validChoices[(int)$row['qid']][(int)$row['cid']] = true;
    if ((int)$row['is_correct'] === 1) {
        $correctAnswers[(int)$row['qid']] = ['cid' => (int)$row['cid'], 'pts' => (int)$row['points']];
    }
}
$stmt->close();

$totalStmt = $conn->prepare("SELECT COALESCE(SUM(points), 0) AS total_points FROM quizquestions WHERE quiz_id = ?");
$totalStmt->bind_param("i", $quizId);
$totalStmt->execute();
$totalPointsAvailable = (int)$totalStmt->get_result()->fetch_assoc()['total_points'];
$totalStmt->close();

$questionCountStmt = $conn->prepare("SELECT COUNT(*) AS total_questions FROM quizquestions WHERE quiz_id = ?");
$questionCountStmt->bind_param("i", $quizId);
$questionCountStmt->execute();
$totalQuestions = (int)$questionCountStmt->get_result()->fetch_assoc()['total_questions'];
$questionCountStmt->close();

$openQuestionIds = [];
$openQuestionStmt = $conn->prepare("SELECT id FROM quizquestions WHERE quiz_id = ? AND question_type = 'open_ended'");
$openQuestionStmt->bind_param("i", $quizId);
$openQuestionStmt->execute();
$openQuestionRows = $openQuestionStmt->get_result()->fetch_all(MYSQLI_ASSOC);
$openQuestionStmt->close();
foreach ($openQuestionRows as $openQuestionRow) {
    $openQuestionIds[(int)$openQuestionRow['id']] = true;
}

$fitbQuestions = [];
$fitbStmt = $conn->prepare("
    SELECT q.id AS question_id, q.points, fq.scoring_mode,
           fb.blank_index, fb.accepted_answers_json, fb.case_sensitive
    FROM quizquestions q
    JOIN fitb_questions fq ON fq.question_id = q.id
    JOIN fitb_blanks fb ON fb.question_id = q.id
    WHERE q.quiz_id = ? AND q.question_type = 'fill_in_blank'
    ORDER BY q.id ASC, fb.blank_index ASC
");
$fitbStmt->bind_param("i", $quizId);
$fitbStmt->execute();
$fitbRows = $fitbStmt->get_result()->fetch_all(MYSQLI_ASSOC);
$fitbStmt->close();
foreach ($fitbRows as $fitbRow) {
    $qid = (int)$fitbRow['question_id'];
    if (!isset($fitbQuestions[$qid])) {
        $fitbQuestions[$qid] = [
            'points' => (float)$fitbRow['points'],
            'scoring_mode' => in_array($fitbRow['scoring_mode'], ['partial', 'all_or_nothing'], true) ? $fitbRow['scoring_mode'] : 'partial',
            'blanks' => []
        ];
    }
    $answers = json_decode($fitbRow['accepted_answers_json'] ?? '[]', true);
    $fitbQuestions[$qid]['blanks'][(int)$fitbRow['blank_index']] = [
        'accepted_answers' => is_array($answers) ? $answers : [],
        'case_sensitive' => (int)$fitbRow['case_sensitive']
    ];
}

$multipleAnswerQuestions = [];
$maStmt = $conn->prepare("
    SELECT q.id AS question_id, q.points, maq.scoring_mode, c.id AS choice_id, c.is_correct
    FROM quizquestions q
    JOIN multiple_answer_questions maq ON maq.question_id = q.id
    JOIN choices c ON c.question_id = q.id
    WHERE q.quiz_id = ? AND q.question_type = 'multiple_answer'
    ORDER BY q.id ASC, c.id ASC
");
$maStmt->bind_param("i", $quizId);
$maStmt->execute();
$maRows = $maStmt->get_result()->fetch_all(MYSQLI_ASSOC);
$maStmt->close();
foreach ($maRows as $maRow) {
    $qid = (int)$maRow['question_id'];
    if (!isset($multipleAnswerQuestions[$qid])) {
        $multipleAnswerQuestions[$qid] = [
            'points' => (float)$maRow['points'],
            'scoring_mode' => in_array($maRow['scoring_mode'], ['exact_match', 'partial_penalty'], true) ? $maRow['scoring_mode'] : 'exact_match',
            'correct_choice_ids' => [],
            'valid_choice_ids' => []
        ];
    }
    $choiceId = (int)$maRow['choice_id'];
    $multipleAnswerQuestions[$qid]['valid_choice_ids'][$choiceId] = true;
    if ((int)$maRow['is_correct'] === 1) {
        $multipleAnswerQuestions[$qid]['correct_choice_ids'][$choiceId] = true;
    }
}

// 6. Consolidate Answers (POST + Database Fallback)
$finalAnswers = isset($_POST['answers']) && is_array($_POST['answers']) ? $_POST['answers'] : [];
$finalOpenAnswers = isset($_POST['open_answers']) && is_array($_POST['open_answers']) ? $_POST['open_answers'] : [];
$finalFitbAnswers = isset($_POST['fitb_answers']) && is_array($_POST['fitb_answers']) ? $_POST['fitb_answers'] : [];
$finalMultipleAnswers = isset($_POST['multiple_answers']) && is_array($_POST['multiple_answers']) ? $_POST['multiple_answers'] : [];
$savedStmt = $conn->prepare("SELECT question_id, selected_choice_id, answer_text FROM user_answers WHERE attempt_id = ?");
$savedStmt->bind_param("i", $attemptId);
$savedStmt->execute();
$savedRes = $savedStmt->get_result();
while ($sRow = $savedRes->fetch_assoc()) {
    $savedQid = (int)$sRow['question_id'];
    if ($sRow['answer_text'] !== null) {
        if (isset($fitbQuestions[$savedQid]) && !array_key_exists($savedQid, $finalFitbAnswers)) {
            $decoded = json_decode($sRow['answer_text'], true);
            $finalFitbAnswers[$savedQid] = is_array($decoded) ? $decoded : [];
        } elseif (isset($multipleAnswerQuestions[$savedQid]) && !array_key_exists($savedQid, $finalMultipleAnswers)) {
            $decoded = json_decode($sRow['answer_text'], true);
            $finalMultipleAnswers[$savedQid] = is_array($decoded) ? $decoded : [];
        } elseif (!isset($fitbQuestions[$savedQid]) && !array_key_exists($savedQid, $finalOpenAnswers)) {
            $finalOpenAnswers[$savedQid] = $sRow['answer_text'];
        }
    } elseif (!array_key_exists($savedQid, $finalAnswers)) {
        $finalAnswers[$savedQid] = $sRow['selected_choice_id'];
    }
}
$savedStmt->close();

// 7. Scoring
$earnedScore = 0;
foreach ($correctAnswers as $qid => $data) {
    $submittedChoiceId = isset($finalAnswers[$qid]) ? (int)$finalAnswers[$qid] : null;
    if ($submittedChoiceId !== null && isset($validChoices[$qid][$submittedChoiceId]) && $submittedChoiceId === $data['cid']) {
        $earnedScore += $data['pts'];
    }
}

foreach ($fitbQuestions as $qid => $fitbQuestion) {
    $submittedBlanks = $finalFitbAnswers[$qid] ?? [];
    if (is_string($submittedBlanks)) {
        $decoded = json_decode($submittedBlanks, true);
        $submittedBlanks = is_array($decoded) ? $decoded : [];
    }
    if (!is_array($submittedBlanks)) {
        $submittedBlanks = [];
    }

    $blankCount = count($fitbQuestion['blanks']);
    if ($blankCount === 0) {
        continue;
    }

    $correctCount = 0;
    foreach ($fitbQuestion['blanks'] as $blankIndex => $blank) {
        $learnerAnswer = trim((string)($submittedBlanks[(string)$blankIndex] ?? $submittedBlanks[$blankIndex] ?? ''));
        foreach ($blank['accepted_answers'] as $acceptedAnswer) {
            $acceptedAnswer = trim((string)$acceptedAnswer);
            if ($blank['case_sensitive'] === 1) {
                $isCorrect = $learnerAnswer === $acceptedAnswer;
            } else {
                $isCorrect = mb_strtolower($learnerAnswer) === mb_strtolower($acceptedAnswer);
            }
            if ($isCorrect) {
                $correctCount++;
                break;
            }
        }
    }

    if ($fitbQuestion['scoring_mode'] === 'all_or_nothing') {
        if ($correctCount === $blankCount) {
            $earnedScore += $fitbQuestion['points'];
        }
    } else {
        $earnedScore += ($fitbQuestion['points'] / $blankCount) * $correctCount;
    }
}

foreach ($multipleAnswerQuestions as $qid => $maQuestion) {
    $submittedChoiceIds = $finalMultipleAnswers[$qid] ?? [];
    if (is_string($submittedChoiceIds)) {
        $decoded = json_decode($submittedChoiceIds, true);
        $submittedChoiceIds = is_array($decoded) ? $decoded : [];
    }
    if (!is_array($submittedChoiceIds)) {
        $submittedChoiceIds = [];
    }

    $selectedSet = [];
    foreach ($submittedChoiceIds as $choiceId) {
        $choiceId = (int)$choiceId;
        if (isset($maQuestion['valid_choice_ids'][$choiceId])) {
            $selectedSet[$choiceId] = true;
        }
    }

    $correctSet = $maQuestion['correct_choice_ids'];
    if ($maQuestion['scoring_mode'] === 'exact_match') {
        if (count($selectedSet) === count($correctSet) && empty(array_diff_key($selectedSet, $correctSet)) && empty(array_diff_key($correctSet, $selectedSet))) {
            $earnedScore += $maQuestion['points'];
        }
        continue;
    }

    $correctCount = count($correctSet);
    if ($correctCount === 0) {
        continue;
    }
    $pointsPerChoice = $maQuestion['points'] / $correctCount;
    $questionScore = 0;
    foreach ($selectedSet as $choiceId => $_) {
        $questionScore += isset($correctSet[$choiceId]) ? $pointsPerChoice : -$pointsPerChoice;
    }
    $earnedScore += max(0, $questionScore);
}

// 8. DATABASE UPDATES (Transaction-style)
try {
    // A. Insert Result Record
    $insRes = $conn->prepare("
        INSERT INTO quiz_results (
            user_email, quiz_id, attempt_id, score, total, time_taken, submitted_at, academic_year_id
        ) VALUES (?, ?, ?, ?, ?, ?, NOW(), ?)
    ");
    $insRes->bind_param("siiddii", $userEmail, $quizId, $attemptId, $earnedScore, $totalPointsAvailable, $timeTaken, $current_academic_year_id);
    $insRes->execute();
    $resultId = $insRes->insert_id;

    // B. Link/Update user_answers with the Result ID
    if (!empty($finalAnswers)) {
        $ansQuery = "INSERT INTO user_answers (user_email, quiz_id, attempt_id, question_id, selected_choice_id, answer_text, result_id) 
                     VALUES (?, ?, ?, ?, ?, NULL, ?) 
                     ON DUPLICATE KEY UPDATE selected_choice_id = VALUES(selected_choice_id), answer_text = NULL, result_id = VALUES(result_id)";
        $ansStmt = $conn->prepare($ansQuery);
        foreach ($finalAnswers as $qid => $cid) {
            $qid = (int)$qid;
            $cid = (int)$cid;
            if (!isset($validChoices[$qid][$cid])) {
                continue;
            }
            $ansStmt->bind_param("siiiii", $userEmail, $quizId, $attemptId, $qid, $cid, $resultId);
            $ansStmt->execute();
        }
        $ansStmt->close();
    }
    if (!empty($finalOpenAnswers)) {
        $openAnsQuery = "INSERT INTO user_answers (user_email, quiz_id, attempt_id, question_id, selected_choice_id, answer_text, result_id)
                         VALUES (?, ?, ?, ?, NULL, ?, ?)
                         ON DUPLICATE KEY UPDATE selected_choice_id = NULL, answer_text = VALUES(answer_text), result_id = VALUES(result_id)";
        $openAnsStmt = $conn->prepare($openAnsQuery);
        foreach ($finalOpenAnswers as $qid => $answerText) {
            $qid = (int)$qid;
            if (!isset($openQuestionIds[$qid])) {
                continue;
            }
            $answerText = substr(trim((string)$answerText), 0, 5000);
            $openAnsStmt->bind_param("siiisi", $userEmail, $quizId, $attemptId, $qid, $answerText, $resultId);
            $openAnsStmt->execute();
        }
        $openAnsStmt->close();
    }
    if (!empty($finalFitbAnswers)) {
        $fitbAnsQuery = "INSERT INTO user_answers (user_email, quiz_id, attempt_id, question_id, selected_choice_id, answer_text, result_id)
                         VALUES (?, ?, ?, ?, NULL, ?, ?)
                         ON DUPLICATE KEY UPDATE selected_choice_id = NULL, answer_text = VALUES(answer_text), result_id = VALUES(result_id)";
        $fitbAnsStmt = $conn->prepare($fitbAnsQuery);
        foreach ($finalFitbAnswers as $qid => $answers) {
            $qid = (int)$qid;
            if (!isset($fitbQuestions[$qid])) {
                continue;
            }
            $cleanAnswers = [];
            foreach ((array)$answers as $blankIndex => $answerText) {
                $index = (int)$blankIndex;
                if ($index < 1) {
                    continue;
                }
                $cleanAnswers[(string)$index] = substr(trim((string)$answerText), 0, 200);
            }
            $fitbAnswerText = json_encode($cleanAnswers);
            $fitbAnsStmt->bind_param("siiisi", $userEmail, $quizId, $attemptId, $qid, $fitbAnswerText, $resultId);
            $fitbAnsStmt->execute();
        }
        $fitbAnsStmt->close();
    }
    if (!empty($finalMultipleAnswers)) {
        $maAnsQuery = "INSERT INTO user_answers (user_email, quiz_id, attempt_id, question_id, selected_choice_id, answer_text, result_id)
                       VALUES (?, ?, ?, ?, NULL, ?, ?)
                       ON DUPLICATE KEY UPDATE selected_choice_id = NULL, answer_text = VALUES(answer_text), result_id = VALUES(result_id)";
        $maAnsStmt = $conn->prepare($maAnsQuery);
        foreach ($finalMultipleAnswers as $qid => $choiceIds) {
            $qid = (int)$qid;
            if (!isset($multipleAnswerQuestions[$qid])) {
                continue;
            }
            if (is_string($choiceIds)) {
                $decoded = json_decode($choiceIds, true);
                $choiceIds = is_array($decoded) ? $decoded : [];
            }
            $cleanChoiceIds = [];
            foreach ((array)$choiceIds as $choiceId) {
                $choiceId = (int)$choiceId;
                if (isset($multipleAnswerQuestions[$qid]['valid_choice_ids'][$choiceId]) && !in_array($choiceId, $cleanChoiceIds, true)) {
                    $cleanChoiceIds[] = $choiceId;
                }
            }
            sort($cleanChoiceIds);
            $maAnswerText = json_encode($cleanChoiceIds);
            $maAnsStmt->bind_param("siiisi", $userEmail, $quizId, $attemptId, $qid, $maAnswerText, $resultId);
            $maAnsStmt->execute();
        }
        $maAnsStmt->close();
    }

    if ($hasOpenEnded === 1) {
        $gradeStmt = $conn->prepare("
            INSERT INTO open_ended_grades (attempt_id, question_id, user_email, quiz_id, score, feedback, graded_by)
            VALUES (?, ?, ?, ?, 0, NULL, NULL)
            ON DUPLICATE KEY UPDATE quiz_id = VALUES(quiz_id)
        ");
        foreach (array_keys($openQuestionIds) as $openQuestionId) {
            $gradeStmt->bind_param("iisi", $attemptId, $openQuestionId, $userEmail, $quizId);
            $gradeStmt->execute();
        }
        $gradeStmt->close();
    }

    // C. Update Attempt Status
    $updAtt = $conn->prepare("UPDATE quiz_attempts SET status = 'submitted', current_step = ? WHERE attempt_id = ?");
    $updAtt->bind_param("ii", $totalQuestions, $attemptId);
    $updAtt->execute();

    $conn->commit();
} catch (Exception $e) {
    $conn->rollback();
    error_log("Submission Error: " . $e->getMessage());
    die("An error occurred while saving your results.");
}

// 9. Render Final Page
if ($hasOpenEnded === 1) {
    render_page("open_pending", $quizTitle, 0, $totalPointsAvailable, $timeTaken);
} elseif ($publishMarks === 0) {
    render_page("pending", $quizTitle, $earnedScore, $totalPointsAvailable, $timeTaken);
} else {
    render_page("result", $quizTitle, $earnedScore, $totalPointsAvailable, $timeTaken);
}

// ─────────────────────────────────────────────────────────────────────────────
// RENDER FUNCTION — Platform-consistent styling
// ─────────────────────────────────────────────────────────────────────────────
function render_page($type, $quizTitle, $score, $total, $timeTaken) {
    $percentage  = ($total > 0) ? round(($score / $total) * 100) : 0;
    $timeStr     = $timeTaken ? floor($timeTaken / 60) . "m " . ($timeTaken % 60) . "s" : null;

    // Score circle maths: r=54 → circumference = 2π×54 ≈ 339.3
    $circumference = 339.3;
    $offset        = $circumference - ($percentage / 100) * $circumference;

    // Colour based on percentage
    if ($percentage >= 80)      $scoreColor = '#22c55e';
    elseif ($percentage >= 60)  $scoreColor = '#4fd1c5';
    elseif ($percentage >= 40)  $scoreColor = '#f59e0b';
    else                        $scoreColor = '#f85149';
    ?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>
        <?php
        if ($type === 'closed')  echo 'Quiz Closed';
        elseif ($type === 'pending' || $type === 'open_pending') echo 'Submitted!';
        else echo 'Quiz Result';
        ?>
    </title>
    <link rel="icon" type="image/svg+xml" href="/icon.svg?v=1.2">
    <link href="https://fonts.googleapis.com/css2?family=Nunito:ital,wght@0,400;0,600;0,700;0,800;0,900&display=swap" rel="stylesheet">
    <style>
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        :root {
            --bg:          #0d1117;
            --surface:     #161b22;
            --surface2:    #1c2128;
            --border:      rgba(255,255,255,0.07);
            --text:        #e2e8f0;
            --muted:       #8b949e;
            --teal:        #4fd1c5;
            --teal-dim:    rgba(79,209,197,0.12);
            --teal-glow:   rgba(79,209,197,0.25);
            --score-color: <?= $scoreColor ?>;
            --radius:      16px;
        }

        body {
            font-family: 'Nunito', sans-serif;
            background: var(--bg);
            color: var(--text);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 24px;
        }

        /* ── CARD ─────────────────────────────────────────── */
        .card {
            background: var(--surface);
            border: 1px solid var(--border);
            border-radius: 24px;
            width: 100%;
            max-width: 420px;
            overflow: hidden;
            box-shadow: 0 24px 64px rgba(0,0,0,0.5);
            animation: cardIn 0.4s cubic-bezier(0.34,1.56,0.64,1) both;
        }

        @keyframes cardIn {
            from { opacity: 0; transform: translateY(24px) scale(0.97); }
            to   { opacity: 1; transform: translateY(0)    scale(1);    }
        }

        /* ── TOP ACCENT BAR ───────────────────────────────── */
        .card-bar {
            height: 4px;
            width: 100%;
        }
        .card-bar.result  { background: linear-gradient(90deg, var(--score-color), transparent); }
        .card-bar.pending { background: linear-gradient(90deg, var(--teal), transparent); }
        .card-bar.closed  { background: linear-gradient(90deg, #f85149, transparent); }

        /* ── HEADER ───────────────────────────────────────── */
        .card-header {
            padding: 28px 28px 20px;
            text-align: center;
            border-bottom: 1px solid var(--border);
        }

        .quiz-label {
            font-size: 11px;
            font-weight: 800;
            letter-spacing: 1.5px;
            text-transform: uppercase;
            color: var(--muted);
            margin-bottom: 6px;
        }

        .quiz-title {
            font-size: 17px;
            font-weight: 800;
            color: var(--text);
            line-height: 1.3;
        }

        /* ── SCORE CIRCLE ─────────────────────────────────── */
        .score-section {
            padding: 32px 28px 24px;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 20px;
        }

        .circle-wrap {
            position: relative;
            width: 140px;
            height: 140px;
        }

        .circle-svg {
            transform: rotate(-90deg);
            display: block;
        }

        .circle-track {
            fill: none;
            stroke: rgba(255,255,255,0.06);
            stroke-width: 10;
        }

        .circle-fill {
            fill: none;
            stroke: var(--score-color);
            stroke-width: 10;
            stroke-linecap: round;
            stroke-dasharray: <?= $circumference ?>;
            stroke-dashoffset: <?= $circumference ?>; /* starts empty */
            transition: stroke-dashoffset 1.2s cubic-bezier(0.4,0,0.2,1);
        }

        .circle-text {
            position: absolute;
            inset: 0;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 2px;
        }

        .circle-pct {
            font-size: 32px;
            font-weight: 900;
            color: var(--score-color);
            line-height: 1;
        }

        .circle-sub {
            font-size: 12px;
            color: var(--muted);
            font-weight: 600;
        }

        /* ── STATS ROW ────────────────────────────────────── */
        .stats-row {
            display: flex;
            gap: 10px;
            width: 100%;
        }

        .stat-box {
            flex: 1;
            background: var(--surface2);
            border: 1px solid var(--border);
            border-radius: 12px;
            padding: 14px 10px;
            text-align: center;
        }

        .stat-val {
            font-size: 20px;
            font-weight: 900;
            color: var(--text);
            line-height: 1;
            margin-bottom: 4px;
        }

        .stat-lbl {
            font-size: 11px;
            color: var(--muted);
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.8px;
        }

        /* ── PENDING / CLOSED STATE ───────────────────────── */
        .state-section {
            padding: 36px 28px 28px;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 14px;
            text-align: center;
        }

        .state-icon {
            width: 72px;
            height: 72px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .state-icon.pending { background: var(--teal-dim); }
        .state-icon.closed  { background: rgba(248,81,73,0.1); }

        .state-title {
            font-size: 22px;
            font-weight: 900;
            color: var(--text);
        }

        .state-msg {
            font-size: 14px;
            color: var(--muted);
            line-height: 1.6;
            max-width: 300px;
        }

        /* ── COUNTDOWN ────────────────────────────────────── */
        .countdown-section {
            padding: 20px 28px 28px;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 10px;
            border-top: 1px solid var(--border);
        }

        .countdown-ring {
            position: relative;
            width: 56px;
            height: 56px;
        }

        .countdown-ring svg {
            transform: rotate(-90deg);
            display: block;
        }

        .ring-track {
            fill: none;
            stroke: rgba(255,255,255,0.06);
            stroke-width: 4;
        }

        .ring-fill {
            fill: none;
            stroke: var(--teal);
            stroke-width: 4;
            stroke-linecap: round;
            stroke-dasharray: 138.2;
            stroke-dashoffset: 0;
            transition: stroke-dashoffset 1s linear;
        }

        .ring-num {
            position: absolute;
            inset: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 15px;
            font-weight: 900;
            color: var(--teal);
        }

        .countdown-text {
            font-size: 12px;
            color: var(--muted);
            font-weight: 700;
            letter-spacing: 0.5px;
        }

        /* ── CLOSED ONLY: no countdown ───────────────────── */
        .back-btn {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            margin-top: 8px;
            padding: 12px 24px;
            background: var(--teal-dim);
            color: var(--teal);
            border: 1px solid rgba(79,209,197,0.3);
            border-radius: 10px;
            font-family: 'Nunito', sans-serif;
            font-size: 14px;
            font-weight: 800;
            cursor: pointer;
            text-decoration: none;
            transition: background 0.2s;
        }
        .back-btn:hover { background: rgba(79,209,197,0.2); }
    </style>
</head>
<body>

<?php if ($type === 'result'): ?>
<!-- ═══════════════════════════════════════════════
     RESULT — score published
═══════════════════════════════════════════════ -->
<div class="card">
    <div class="card-bar result"></div>

    <div class="card-header">
        <div class="quiz-label">Quiz Complete</div>
        <div class="quiz-title"><?= htmlspecialchars($quizTitle) ?></div>
    </div>

    <div class="score-section">
        <!-- Animated circle -->
        <div class="circle-wrap">
            <svg class="circle-svg" width="140" height="140" viewBox="0 0 140 140">
                <circle class="circle-track" cx="70" cy="70" r="54"/>
                <circle class="circle-fill"  cx="70" cy="70" r="54" id="scoreFill"/>
            </svg>
            <div class="circle-text">
                <span class="circle-pct" id="percDisplay">0%</span>
                <span class="circle-sub"><?= $score ?> / <?= $total ?> pts</span>
            </div>
        </div>

        <!-- Stats -->
        <div class="stats-row">
            <div class="stat-box">
                <div class="stat-val" style="color:var(--score-color);"><?= $score ?></div>
                <div class="stat-lbl">Points</div>
            </div>
            <div class="stat-box">
                <div class="stat-val"><?= $total ?></div>
                <div class="stat-lbl">Total</div>
            </div>
            <?php if ($timeStr): ?>
            <div class="stat-box">
                <div class="stat-val" style="font-size:15px;"><?= $timeStr ?></div>
                <div class="stat-lbl">Time</div>
            </div>
            <?php endif; ?>
        </div>
    </div>

    <!-- Countdown -->
    <div class="countdown-section">
        <div class="countdown-ring">
            <svg width="56" height="56" viewBox="0 0 56 56">
                <circle class="ring-track" cx="28" cy="28" r="22"/>
                <circle class="ring-fill"  cx="28" cy="28" r="22" id="ringFill"/>
            </svg>
            <div class="ring-num" id="ringNum">10</div>
        </div>
        <div class="countdown-text">Saving to Grades…</div>
    </div>
</div>

<?php elseif ($type === 'pending' || $type === 'open_pending'): ?>
<!-- ═══════════════════════════════════════════════
     PENDING — marks not published yet
═══════════════════════════════════════════════ -->
<div class="card">
    <div class="card-bar pending"></div>

    <div class="card-header">
        <div class="quiz-label">Submitted</div>
        <div class="quiz-title"><?= htmlspecialchars($quizTitle) ?></div>
    </div>

    <div class="state-section">
        <div class="state-icon pending">
            <svg viewBox="0 0 24 24" width="32" height="32" stroke="#4fd1c5" stroke-width="2" fill="none">
                <rect x="3" y="11" width="18" height="11" rx="2"/>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
        </div>
        <div class="state-title">Marks Pending</div>
        <div class="state-msg">
            <?php if ($type === 'open_pending'): ?>
            Your responses have been submitted. Your teacher will review and release your marks once all responses have been graded.
            <?php else: ?>
            Your answers have been saved. Your teacher will publish the results soon.
            <?php endif; ?>
        </div>
        <?php if ($timeStr): ?>
        <div style="font-size:13px;color:var(--muted);">Time taken: <strong style="color:var(--text);"><?= $timeStr ?></strong></div>
        <?php endif; ?>
    </div>

    <div class="countdown-section">
        <div class="countdown-ring">
            <svg width="56" height="56" viewBox="0 0 56 56">
                <circle class="ring-track" cx="28" cy="28" r="22"/>
                <circle class="ring-fill"  cx="28" cy="28" r="22" id="ringFill"/>
            </svg>
            <div class="ring-num" id="ringNum">10</div>
        </div>
        <div class="countdown-text">Returning to Grades…</div>
    </div>
</div>

<?php else: ?>
<!-- ═══════════════════════════════════════════════
     CLOSED — quiz no longer accepting submissions
═══════════════════════════════════════════════ -->
<div class="card">
    <div class="card-bar closed"></div>

    <div class="card-header">
        <div class="quiz-label">Unavailable</div>
        <div class="quiz-title"><?= htmlspecialchars($quizTitle) ?></div>
    </div>

    <div class="state-section">
        <div class="state-icon closed">
            <svg viewBox="0 0 24 24" width="32" height="32" stroke="#f85149" stroke-width="2" fill="none">
                <circle cx="12" cy="12" r="10"/>
                <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
            </svg>
        </div>
        <div class="state-title">Quiz Closed</div>
        <div class="state-msg">
            This quiz is no longer accepting submissions.
        </div>
        <button class="back-btn" onclick="goToGrades()">
            <svg viewBox="0 0 24 24" width="15" height="15" stroke="currentColor" stroke-width="2.5" fill="none">
                <line x1="19" y1="12" x2="5" y2="12"/>
                <polyline points="12 19 5 12 12 5"/>
            </svg>
            Back to Grades
        </button>
    </div>
</div>

<?php endif; ?>

<script>
// ── SHARED: navigate to grades (works inside iframe or standalone) ─────────
function goToGrades() {
    if (window.parent && window.parent !== window &&
        typeof window.parent.fetchGrades === 'function') {
        // Inside learner dashboard iframe
        try { window.parent.sessionStorage.setItem('lastLearnerPage', 'grades'); } catch(e) {}
        window.parent.fetchGrades();
        if (typeof window.parent.setActive === 'function') {
            window.parent.setActive('grades');
        }
        if (typeof window.parent.configureHeader === 'function') {
            window.parent.configureHeader({ title: 'My Grades', mode: 'standard' });
        }
        // Invalidate cache so grades refreshes with latest result
        window.parent.learnerGradesCache = null;
    } else {
        // Standalone / direct access fallback
        window.location.href = 'learner_dashboard.php';
    }
}

<?php if ($type !== 'closed'): ?>
// ── COUNTDOWN + SCORE ANIMATION ──────────────────────────────────────────
(function() {
    const TOTAL    = 10;
    const ringFill = document.getElementById('ringFill');
    const ringNum  = document.getElementById('ringNum');
    // r=22 → circumference = 2π×22 ≈ 138.2
    const CIRC     = 138.2;
    let timeLeft   = TOTAL;

    <?php if ($type === 'result'): ?>
    // Animate score circle after a short delay
    const TARGET_OFFSET = <?= $offset ?>;
    const TARGET_PCT    = <?= $percentage ?>;
    const percDisplay   = document.getElementById('percDisplay');
    const scoreFill     = document.getElementById('scoreFill');

    setTimeout(() => {
        scoreFill.style.strokeDashoffset = TARGET_OFFSET;
        // Count up percentage text
        let cur = 0;
        const step = Math.ceil(TARGET_PCT / 40);
        const counter = setInterval(() => {
            cur = Math.min(cur + step, TARGET_PCT);
            percDisplay.textContent = cur + '%';
            if (cur >= TARGET_PCT) clearInterval(counter);
        }, 30);
    }, 300);
    <?php endif; ?>

    // Countdown tick
    const tick = setInterval(() => {
        timeLeft--;
        if (ringNum)  ringNum.textContent = timeLeft;

        // Drain the ring clockwise
        const progress  = (TOTAL - timeLeft) / TOTAL;
        const newOffset = CIRC * (1 - progress);
        if (ringFill) ringFill.style.strokeDashoffset = newOffset;

        if (timeLeft <= 0) {
            clearInterval(tick);
            goToGrades();
        }
    }, 1000);
})();
<?php endif; ?>
</script>

</body>
</html>
    <?php
}
