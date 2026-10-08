<?php
/**
 * iSkool - Quiz Review Page
 * * Features:
 * - Single-query data fetching for performance
 * - Role-based access control (Learner vs Teacher)
 * - "Publish Marks" check for learners
 * - Clear visual feedback for correct/incorrect choices
 */
session_start();
include("config.php");

// 1. Security Check
if (!isset($_SESSION['email'])) {
    header("Location: index.php");
    exit();
}

if (!isset($_GET['result_id'])) {
    die("Invalid review request.");
}

$resultId = intval($_GET['result_id']);
$loggedInEmail = $_SESSION['email'];
$userRole = $_SESSION['role'] ?? 'learner';

// 2. Optimized Data Fetch (Combined results, quiz info, questions, and choices)
$stmt = $conn->prepare("
    SELECT 
        r.score, r.total, r.submitted_at, r.user_email, r.attempt_id,
        q.id as quiz_id, q.title, q.publish_marks,
        qq.id AS q_id, qq.question_text, qq.image_path, qq.points, qq.question_type,
        c.id AS choice_id, c.choice_text, c.is_correct,
        ua.selected_choice_id, ua.answer_text,
        og.score AS open_score, og.feedback AS open_feedback, og.graded_by, og.graded_at
    FROM quiz_results r
    JOIN quizzes q ON r.quiz_id = q.id
    JOIN quizquestions qq ON q.id = qq.quiz_id
    LEFT JOIN choices c ON qq.id = c.question_id
    LEFT JOIN user_answers ua
        ON ua.question_id = qq.id
        AND (ua.result_id = r.id OR ua.attempt_id = r.attempt_id)
    LEFT JOIN open_ended_grades og
        ON og.question_id = qq.id
        AND og.attempt_id = r.attempt_id
    WHERE r.id = ?
    ORDER BY qq.id ASC, c.id ASC
");
$stmt->bind_param("i", $resultId);
$stmt->execute();
$res = $stmt->get_result();

$questions = [];
$quizInfo = null;

while ($row = $res->fetch_assoc()) {
    if (!$quizInfo) $quizInfo = $row;
    
    $qid = $row['q_id'];
    if (!isset($questions[$qid])) {
        $questions[$qid] = [
            'text' => $row['question_text'],
            'image' => $row['image_path'],
            'points' => (float)$row['points'],
            'points_possible' => (float)$row['points'],
            'points_earned' => 0,
            'question_type' => $row['question_type'] ?? 'mcq',
            'selected' => $row['selected_choice_id'],
            'answer_text' => $row['answer_text'] ?? '',
            'grade' => !empty($row['graded_by']) ? [
                'score' => $row['open_score'],
                'feedback' => $row['open_feedback'],
                'graded_by' => $row['graded_by'],
                'graded_at' => $row['graded_at']
            ] : null,
            'choices' => []
        ];
    }
    if ($row['choice_id'] !== null) {
        $questions[$qid]['choices'][] = [
            'id' => $row['choice_id'],
            'text' => $row['choice_text'],
            'is_correct' => $row['is_correct']
        ];
    }
}
$stmt->close();

if (!$quizInfo) die("Review data not found.");

$fitbStmt = $conn->prepare("
    SELECT fq.question_id, fq.sub_type, fq.scoring_mode,
           fb.blank_index, fb.accepted_answers_json, fb.case_sensitive
    FROM fitb_questions fq
    JOIN fitb_blanks fb ON fb.question_id = fq.question_id
    JOIN quizquestions qq ON qq.id = fq.question_id
    JOIN quiz_results r ON r.quiz_id = qq.quiz_id
    WHERE r.id = ?
    ORDER BY fq.question_id ASC, fb.blank_index ASC
");
$fitbStmt->bind_param("i", $resultId);
$fitbStmt->execute();
$fitbRows = $fitbStmt->get_result()->fetch_all(MYSQLI_ASSOC);
$fitbStmt->close();

foreach ($fitbRows as $fitbRow) {
    $qid = (int)$fitbRow['question_id'];
    if (!isset($questions[$qid]) || ($questions[$qid]['question_type'] ?? 'mcq') !== 'fill_in_blank') {
        continue;
    }
    if (!isset($questions[$qid]['fitb'])) {
        $answerMap = json_decode($questions[$qid]['answer_text'] ?? '[]', true);
        $questions[$qid]['fitb'] = [
            'sub_type' => $fitbRow['sub_type'],
            'scoring_mode' => $fitbRow['scoring_mode'],
            'learner_answers' => is_array($answerMap) ? $answerMap : [],
            'blanks' => []
        ];
    }
    $accepted = json_decode($fitbRow['accepted_answers_json'] ?? '[]', true);
    $accepted = is_array($accepted) ? $accepted : [];
    $blankIndex = (int)$fitbRow['blank_index'];
    $learnerAnswer = trim((string)($questions[$qid]['fitb']['learner_answers'][(string)$blankIndex] ?? ''));
    $isCorrect = false;
    foreach ($accepted as $acceptedAnswer) {
        $acceptedAnswer = trim((string)$acceptedAnswer);
        $isCorrect = ((int)$fitbRow['case_sensitive'] === 1)
            ? $learnerAnswer === $acceptedAnswer
            : mb_strtolower($learnerAnswer) === mb_strtolower($acceptedAnswer);
        if ($isCorrect) {
            break;
        }
    }
    $questions[$qid]['fitb']['blanks'][] = [
        'blank_index' => $blankIndex,
        'learner_answer' => $learnerAnswer,
        'accepted_answers' => $accepted,
        'is_correct' => $isCorrect
    ];
}

$maStmt = $conn->prepare("
    SELECT maq.question_id, maq.scoring_mode, maq.select_exactly
    FROM multiple_answer_questions maq
    JOIN quizquestions qq ON qq.id = maq.question_id
    JOIN quiz_results r ON r.quiz_id = qq.quiz_id
    WHERE r.id = ?
");
$maStmt->bind_param("i", $resultId);
$maStmt->execute();
$maRows = $maStmt->get_result()->fetch_all(MYSQLI_ASSOC);
$maStmt->close();

foreach ($maRows as $maRow) {
    $qid = (int)$maRow['question_id'];
    if (!isset($questions[$qid]) || ($questions[$qid]['question_type'] ?? 'mcq') !== 'multiple_answer') {
        continue;
    }
    $selectedIds = json_decode($questions[$qid]['answer_text'] ?? '[]', true);
    $selectedIds = is_array($selectedIds) ? array_map('intval', $selectedIds) : [];
    $correctIds = [];
    foreach ($questions[$qid]['choices'] as $choice) {
        if ((int)$choice['is_correct'] === 1) {
            $correctIds[(int)$choice['id']] = true;
        }
    }
    $selectedSet = array_fill_keys($selectedIds, true);
    $scoringMode = in_array($maRow['scoring_mode'] ?? '', ['exact_match', 'partial_penalty'], true) ? $maRow['scoring_mode'] : 'exact_match';
    $pointsAwarded = 0;
    $correctSelectedCount = 0;
    $wrongSelectedCount = 0;
    $pointsAdded = 0;
    $pointsDeducted = 0;
    if ($scoringMode === 'exact_match') {
        if (count($selectedSet) === count($correctIds) && empty(array_diff_key($selectedSet, $correctIds)) && empty(array_diff_key($correctIds, $selectedSet))) {
            $pointsAwarded = (float)$questions[$qid]['points'];
        }
    } else {
        $correctCount = count($correctIds);
        $pointsPerChoice = $correctCount > 0 ? ((float)$questions[$qid]['points'] / $correctCount) : 0;
        foreach ($selectedSet as $choiceId => $_) {
            if (isset($correctIds[$choiceId])) {
                $correctSelectedCount++;
                $pointsAdded += $pointsPerChoice;
            } else {
                $wrongSelectedCount++;
                $pointsDeducted += $pointsPerChoice;
            }
        }
        $pointsAwarded = max(0, $pointsAdded - $pointsDeducted);
    }
    $questions[$qid]['multiple_answer'] = [
        'scoring_mode' => $scoringMode,
        'select_exactly' => $maRow['select_exactly'] === null ? null : (int)$maRow['select_exactly'],
        'selected_choice_ids' => $selectedIds,
        'points_awarded' => $pointsAwarded,
        'correct_selected_count' => $correctSelectedCount,
        'wrong_selected_count' => $wrongSelectedCount,
        'points_added' => $pointsAdded,
        'points_deducted' => $pointsDeducted
    ];
    $questions[$qid]['points_earned'] = $pointsAwarded;
}

foreach ($questions as &$question) {
    if (($question['question_type'] ?? 'mcq') === 'mcq') {
        foreach ($question['choices'] as $choice) {
            if ((int)$choice['is_correct'] === 1 && (int)$question['selected'] === (int)$choice['id']) {
                $question['points_earned'] = (float)$question['points'];
                break;
            }
        }
    } elseif (($question['question_type'] ?? 'mcq') === 'open_ended') {
        $question['points_earned'] = isset($question['grade']['score']) ? (float)$question['grade']['score'] : 0;
    }
}
unset($question);

foreach ($questions as &$question) {
    if (($question['question_type'] ?? 'mcq') !== 'fill_in_blank' || empty($question['fitb']['blanks'])) {
        continue;
    }
    $correctCount = count(array_filter($question['fitb']['blanks'], fn($blank) => $blank['is_correct']));
    $blankCount = count($question['fitb']['blanks']);
    if (($question['fitb']['scoring_mode'] ?? 'partial') === 'all_or_nothing') {
        $question['points_earned'] = $correctCount === $blankCount ? (float)$question['points'] : 0;
    } else {
        $question['points_earned'] = $blankCount > 0 ? ((float)$question['points'] / $blankCount) * $correctCount : 0;
    }
}
unset($question);

// 3. Strict Access Control
// Fixed: Using 'learner' instead of 'user'
if ($userRole === 'learner') {
    if ($quizInfo['user_email'] !== $loggedInEmail) {
        die("Access denied. You can only view your own results.");
    }

    if ($quizInfo['publish_marks'] == 0) {
        ?>
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">
            <title>Results Not Published</title>
            <style>
                body { background:#20201f; color:#e0e6f0; font-family:sans-serif; display:flex; flex-direction:column; align-items:center; justify-content:center; height:100vh; text-align:center; margin:0; }
                h1 { color:#4fd1c5; }
                a { color:#4fd1c5; text-decoration:none; border:1px solid #4fd1c5; padding:10px 20px; border-radius:8px; margin-top:20px; }
            </style>
        </head>
        <body>
            <h1>Results Not Published</h1>
            <p>Your teacher has not released the marks for this quiz yet.</p>
            <a href="learner_dashboard.php">Back to Dashboard</a>
        </body>
        </html>
        <?php
        exit();
    }
}

$percentage = ($quizInfo['total'] > 0) ? round(($quizInfo['score'] / $quizInfo['total']) * 100) : 0;
$backLink = ($userRole === 'teacher') ? 'teacher_quizzes.php' : 'quiz_history.php';

function format_review_points($value): string {
    $formatted = number_format((float)$value, 2, '.', '');
    return rtrim(rtrim($formatted, '0'), '.');
}

// ── Desktop review layout helpers (the legacy markup below is untouched and still used on narrow screens) ──
function rv_h($s): string {
    return htmlspecialchars((string)$s, ENT_QUOTES, 'UTF-8');
}

function rv_outcome(array $q): string {
    $type = $q['question_type'] ?? 'mcq';
    if ($type === 'open_ended' && empty($q['grade'])) return 'pend';
    $earned   = (float)($q['points_earned'] ?? 0);
    $possible = (float)($q['points_possible'] ?? 0);
    if ($earned >= $possible - 0.0001) return 'ok';
    if ($earned <= 0) return 'bad';
    return 'part';
}

function rv_verdict(array $q, string $type, string $o, bool $published): string {
    if ($type === 'open_ended') {
        if ($o === 'pend') return 'Your teacher has not graded this answer yet. Your mark may change.';
        return 'Your teacher awarded <b>' . rv_h(format_review_points($q['points_earned'])) . ' of ' . rv_h(format_review_points($q['points_possible'])) . '</b> points.';
    }
    if ($type === 'fill_in_blank') {
        $blanks = $q['fitb']['blanks'] ?? [];
        $total = count($blanks);
        if ($total === 0) return 'Your answers are shown below.';
        $ok = count(array_filter($blanks, fn($b) => $b['is_correct']));
        return '<b>' . $ok . ' of ' . $total . '</b> blank' . ($total === 1 ? '' : 's') . ' correct.';
    }
    if ($type === 'multiple_answer') {
        if (!$published) return 'Your selections are shown below.';
        $selected = $q['multiple_answer']['selected_choice_ids'] ?? [];
        $totalCorrect = 0; $got = 0; $wrong = 0;
        foreach ($q['choices'] as $c) {
            $isC = ((int)$c['is_correct'] === 1);
            $isS = in_array((int)$c['id'], $selected, true);
            if ($isC) $totalCorrect++;
            if ($isC && $isS) $got++;
            if (!$isC && $isS) $wrong++;
        }
        $s = 'You found <b>' . $got . ' of ' . $totalCorrect . '</b> correct answer' . ($totalCorrect === 1 ? '' : 's');
        if ($wrong > 0) $s .= ' and selected <b>' . $wrong . ' wrong</b> option' . ($wrong === 1 ? '' : 's');
        return $s . '.';
    }
    $correct = ''; $chosen = null;
    foreach ($q['choices'] as $c) {
        if ((int)$c['is_correct'] === 1 && $correct === '') $correct = $c['text'];
        if ($q['selected'] !== null && $c['id'] == $q['selected']) $chosen = $c['text'];
    }
    if ($o === 'ok') return 'You chose the correct answer.';
    if ($chosen === null) return 'You did not answer this question. The correct answer is <b>' . rv_h($correct) . '</b>.';
    return 'You chose <b>' . rv_h($chosen) . '</b>. The correct answer is <b>' . rv_h($correct) . '</b>.';
}

$rvPublished = ((int)$quizInfo['publish_marks'] === 1);
$rvTypeLabels = ['mcq' => 'Multiple choice', 'multiple_answer' => 'Multiple answer', 'fill_in_blank' => 'Fill in the blank', 'open_ended' => 'Open-ended'];
$rvOutcomeLabels = ['ok' => 'Correct', 'part' => 'Partly correct', 'bad' => 'Incorrect', 'pend' => 'Awaiting grading'];
$rvOutcomeIcons = ['ok' => '&#10003;', 'part' => '&frac12;', 'bad' => '&#10005;', 'pend' => '&hellip;'];
$rvCounts = ['ok' => 0, 'part' => 0, 'bad' => 0, 'pend' => 0];
$rvItems = [];
$rvN = 0;
foreach ($questions as $q) {
    $rvN++;
    $o = rv_outcome($q);
    $rvCounts[$o]++;
    $rvItems[] = ['n' => $rvN, 'q' => $q, 'type' => ($q['question_type'] ?? 'mcq'), 'o' => $o];
}
$rvRingColor = $percentage >= 75 ? '#22c55e' : ($percentage >= 50 ? '#f28c38' : '#f85149');
$rvLegend = [];
foreach (['ok' => 'correct', 'part' => 'partly correct', 'bad' => 'incorrect', 'pend' => 'pending'] as $k => $label) {
    if ($rvCounts[$k] > 0) $rvLegend[] = $rvCounts[$k] . ' ' . $label;
}
$rvAttn = $rvCounts['part'] + $rvCounts['bad'] + $rvCounts['pend'];
?>

<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Review: <?= htmlspecialchars($quizInfo['title']) ?></title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.2/css/all.min.css" />
    <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@600&display=swap" rel="stylesheet">
    <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;700&display=swap" rel="stylesheet" media="(min-width: 700px)">
    <style>
        :root {
            --bg-color: #20201f;
            --card-bg: #1a202c;
            --text-color: #e0e6f0;
            --accent-color: #4fd1c5;
            --correct: #27ae60;
            --incorrect: #e74c3c;
            --border: rgba(255, 255, 255, 0.1);
        }

        body {
            margin: 0; font-family: 'Nunito', sans-serif;
            background-color: var(--bg-color); color: var(--text-color);
            padding: 20px; display: flex; flex-direction: column; align-items: center;
        }

        .container { max-width: 800px; width: 100%; }

        /* Header Score Card */
        .score-card {
            background: var(--card-bg); padding: 25px; border-radius: 12px;
            text-align: center; margin-bottom: 30px; border-bottom: 4px solid var(--accent-color);
        }

        .perc-circle {
            font-size: 40px; font-weight: bold; color: var(--accent-color);
            margin-bottom: 5px;
        }

        /* Question Box */
        .question-box {
            background: var(--card-bg); padding: 20px; border-radius: 12px;
            margin-bottom: 20px; box-shadow: 0 4px 6px rgba(0,0,0,0.3);
        }

        .question-text { font-size: 18px; margin-bottom: 15px; display: block; }

        .q-meta { font-size: 13px; opacity: 0.6; margin-bottom: 15px; }

        .choice {
            padding: 12px 15px; border-radius: 8px; margin-bottom: 8px;
            background: rgba(255,255,255,0.05); border: 1px solid var(--border);
            display: flex; align-items: center; gap: 10px; transition: 0.3s;
        }

        .choice.correct { border-color: var(--correct); background: rgba(39, 174, 96, 0.15); }
        .choice.incorrect { border-color: var(--incorrect); background: rgba(231, 76, 60, 0.15); }

        .choice i { font-size: 18px; }
        .fa-check-circle { color: var(--correct); }
        .fa-times-circle { color: var(--incorrect); }

        .badge-user {
            margin-left: auto; font-size: 11px; background: rgba(255,255,255,0.1);
            padding: 2px 8px; border-radius: 10px; opacity: 0.8;
        }

        .open-answer-box {
            background: rgba(255,255,255,0.05);
            border: 1px solid var(--border);
            border-radius: 8px;
            padding: 14px;
            line-height: 1.6;
            white-space: pre-wrap;
            margin-top: 10px;
        }

        .open-grade-box {
            background: rgba(39,174,96,0.12);
            border: 1px solid rgba(39,174,96,0.28);
            border-radius: 8px;
            padding: 12px 14px;
            margin-top: 10px;
            color: #d8f5df;
        }

        .open-pending-box {
            background: rgba(242,140,56,0.1);
            border: 1px solid rgba(242,140,56,0.28);
            border-radius: 8px;
            padding: 12px 14px;
            margin-top: 10px;
            color: #f5c38b;
        }

        .fitb-review-row {
            background: rgba(255,255,255,0.05);
            border: 1px solid var(--border);
            border-radius: 8px;
            padding: 12px 14px;
            margin-top: 10px;
        }

        .fitb-review-row.correct { border-color: var(--correct); background: rgba(39,174,96,0.13); }
        .fitb-review-row.incorrect { border-color: var(--incorrect); background: rgba(231,76,60,0.13); }
        .fitb-review-answer { font-weight: 800; color: var(--text-color); }
        .fitb-review-correct { font-size: 12px; opacity: 0.8; margin-top: 5px; }

        .back-btn {
            display: inline-block; padding: 12px 25px; background: var(--card-bg);
            color: var(--accent-color); text-decoration: none; border-radius: 8px;
            border: 1px solid var(--accent-color); font-weight: bold; transition: 0.3s;
        }

        .back-btn:hover { background: var(--accent-color); color: var(--bg-color); }

        img.q-image { max-width: 100%; border-radius: 8px; margin-bottom: 15px; border: 1px solid var(--border); }

        .review-badge { display: none; }
        .review-title { font-size: 18px; opacity: 0.8; }
        .review-meta { margin-top: 10px; font-size: 14px; }

        @media (max-width: 768px) {
            :root {
                --bg-color: #20201f;
                --card-bg: transparent;
                --text-color: #e2e8f0;
                --correct: #22c55e;
                --incorrect: #f85149;
                --border: rgba(255,255,255,0.08);
            }

            html, body {
                min-height: 100%;
                background: var(--bg-color);
            }

            body {
                display: block;
                padding: 18px 16px 96px;
                box-sizing: border-box;
                overflow-x: hidden;
            }

            .container {
                max-width: 520px;
                margin: 0 auto;
            }

            .score-card {
                background: transparent;
                border: 0;
                border-radius: 0;
                box-shadow: none;
                text-align: left;
                padding: 0 0 18px;
                margin-bottom: 8px;
                border-bottom: 1px solid rgba(255,255,255,0.07);
            }

            .review-badge {
                display: inline-flex;
                align-items: center;
                gap: 7px;
                padding: 4px 9px;
                border-radius: 6px;
                font-size: 10px;
                font-weight: 800;
                letter-spacing: 0.6px;
                text-transform: uppercase;
                margin-bottom: 12px;
                color: #c9d1d9;
                border: 1px solid rgba(255,255,255,0.1);
                background: rgba(255,255,255,0.04);
            }

            .perc-circle {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                min-width: 62px;
                height: 34px;
                padding: 0 12px;
                border-radius: 10px;
                background: rgba(79,209,197,0.08);
                border: 1px solid rgba(79,209,197,0.28);
                color: #4fd1c5;
                font-size: 18px;
                font-weight: 900;
                margin-bottom: 14px;
            }

            .review-title {
                margin: 0 0 10px;
                color: #e2e8f0;
                font-size: 21px;
                line-height: 1.28;
                font-weight: 800;
                opacity: 1;
            }

            .review-meta {
                margin-top: 0;
                color: #8b949e;
                font-size: 12px;
                line-height: 1.6;
            }

            .question-box {
                background: transparent;
                border-radius: 0;
                box-shadow: none;
                padding: 18px 0 20px;
                margin: 0;
                border-bottom: 1px solid rgba(255,255,255,0.07);
            }

            .q-meta {
                display: inline-flex;
                align-items: center;
                padding: 3px 8px;
                border-radius: 999px;
                background: rgba(255,255,255,0.04);
                border: 1px solid rgba(255,255,255,0.08);
                color: #8b949e;
                font-size: 10px;
                font-weight: 800;
                text-transform: uppercase;
                letter-spacing: 0.5px;
                opacity: 1;
                margin-bottom: 12px;
            }

            .question-text {
                color: #e2e8f0;
                font-size: 15px;
                line-height: 1.75;
                font-weight: 800;
                margin-bottom: 14px;
                overflow-wrap: anywhere;
            }

            img.q-image {
                width: 100%;
                border-radius: 10px;
                margin: 0 0 14px;
                border: 1px solid rgba(255,255,255,0.08);
            }

            .choices-list {
                display: flex;
                flex-direction: column;
                gap: 10px;
            }

            .choice {
                margin: 0;
                min-height: 44px;
                padding: 11px 13px;
                border-radius: 10px;
                background: rgba(255,255,255,0.04);
                border: 1px solid rgba(255,255,255,0.08);
                color: #c9d1d9;
                font-size: 14px;
                line-height: 1.45;
            }

            .choice.correct {
                border-color: rgba(34,197,94,0.4);
                background: rgba(34,197,94,0.09);
                color: #e2e8f0;
            }

            .choice.incorrect {
                border-color: rgba(248,81,73,0.42);
                background: rgba(248,81,73,0.09);
                color: #e2e8f0;
            }

            .choice i {
                font-size: 16px;
                flex-shrink: 0;
            }

            .badge-user {
                margin-left: auto;
                color: #4fd1c5;
                background: rgba(79,209,197,0.08);
                border: 1px solid rgba(79,209,197,0.2);
                opacity: 1;
                white-space: nowrap;
                flex-shrink: 0;
            }
        }

        /* ═══════════════════════════════════════════════
           DESKTOP REVIEW LAYOUT (>= 700px)
           Same list + detail frame as the other learner pages.
           ═══════════════════════════════════════════════ */
        .rv-desktop { display: none; }
        @media (min-width: 700px) {
            html, body { height: 100%; margin: 0; padding: 0; min-height: 0; overflow-x: hidden; overflow-y: auto; background: #0d1117; }
            body { display: block; font-weight: 400; color: #e6edf3; }
            .rv-legacy { display: none; }
            .rv-desktop { display: flex; height: 100vh; min-height: 520px; --rv-listw: 320px; }
            .rv-desktop * { box-sizing: border-box; }
            .rv-desktop button { font-family: inherit; }

            .rv-list { width: var(--rv-listw); min-width: 260px; max-width: 420px; flex-shrink: 0; display: flex; flex-direction: column; background: #12161c; border-right: 1px solid rgba(255,255,255,0.07); min-height: 0; }
            .rv-lh { padding: 14px 14px 10px; border-bottom: 1px solid rgba(255,255,255,0.07); flex-shrink: 0; }
            .rv-back { display: inline-block; margin-bottom: 12px; font-size: 13px; font-weight: 600; color: #9aa4b2; text-decoration: none; }
            .rv-back:hover { color: #4fd1c5; }
            .rv-back[hidden] { display: none; }
            .rv-sumx { display: flex; align-items: center; gap: 14px; margin-bottom: 14px; }
            .rv-stt { font-size: 14px; font-weight: 600; line-height: 1.35; }
            .rv-sts { font-size: 12px; color: #7d8794; margin-top: 2px; }
            .rv-ring { width: 56px; height: 56px; border-radius: 50%; flex-shrink: 0; display: grid; place-items: center; background: conic-gradient(var(--c) calc(var(--p) * 1%), rgba(255,255,255,0.08) 0); }
            .rv-ring i { width: 44px; height: 44px; border-radius: 50%; background: #12161c; display: grid; place-items: center; font-style: normal; font-weight: 600; font-size: 13px; }
            .rv-ob { display: flex; gap: 3px; height: 6px; border-radius: 3px; overflow: hidden; }
            .rv-ob div { height: 100%; }
            .rv-oleg { font-size: 12px; color: #7d8794; margin: 8px 0 12px; }
            .rv-chips { display: flex; flex-wrap: wrap; gap: 6px; }
            .rv-chip { height: 26px; padding: 0 10px; border-radius: 999px; border: 1px solid rgba(255,255,255,0.07); background: none; color: #9aa4b2; font-size: 12px; font-weight: 600; cursor: pointer; }
            .rv-chip:hover { color: #e6edf3; }
            .rv-chip.on { background: rgba(79,209,197,0.1); border-color: rgba(79,209,197,0.4); color: #4fd1c5; }
            .rv-rows { flex: 1; min-height: 0; overflow-y: auto; outline: none; }
            .rv-rows::-webkit-scrollbar, .rv-body::-webkit-scrollbar { width: 8px; }
            .rv-rows::-webkit-scrollbar-thumb, .rv-body::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 4px; }
            .rv-row { display: flex; align-items: center; gap: 10px; width: 100%; height: 60px; padding: 0 14px; border: 0; border-left: 3px solid transparent; background: none; color: inherit; text-align: left; cursor: pointer; }
            .rv-row[hidden] { display: none; }
            .rv-row:hover { background: rgba(255,255,255,0.04); }
            .rv-row.on { background: rgba(79,209,197,0.1); border-left-color: #4fd1c5; }
            .rv-qs { width: 26px; height: 26px; border-radius: 50%; flex-shrink: 0; display: grid; place-items: center; font-size: 11px; }
            .rv-o-ok { color: #22c55e; background: rgba(34,197,94,0.14); }
            .rv-o-bad { color: #f85149; background: rgba(248,81,73,0.14); }
            .rv-o-part { color: #f28c38; background: rgba(242,140,56,0.14); }
            .rv-o-pend { color: #7d8794; background: rgba(255,255,255,0.07); }
            .rv-ri { flex: 1; min-width: 0; }
            .rv-rt { display: block; font-size: 13px; font-weight: 600; color: #e6edf3; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
            .rv-rm { display: block; font-size: 12px; color: #7d8794; margin-top: 1px; font-weight: 400; }
            .rv-list-empty { padding: 40px 20px; text-align: center; color: #7d8794; font-size: 13px; }

            .rv-split { width: 6px; margin-left: -3px; flex-shrink: 0; cursor: col-resize; position: relative; z-index: 2; outline: none; }
            .rv-split:hover, .rv-split.drag, .rv-split:focus-visible { background: linear-gradient(90deg, transparent 2px, #4fd1c5 2px, #4fd1c5 4px, transparent 4px); }

            .rv-detail { flex: 1; min-width: 0; min-height: 0; display: flex; flex-direction: column; container-type: inline-size; }
            .rv-dh { height: 64px; display: flex; align-items: center; gap: 12px; padding: 0 28px; border-bottom: 1px solid rgba(255,255,255,0.07); flex-shrink: 0; }
            .rv-dh h2 { margin: 0; font-size: 18px; font-weight: 600; color: #e6edf3; white-space: nowrap; }
            .rv-st { display: inline-flex; align-items: center; gap: 6px; flex-shrink: 0; font-size: 11px; font-weight: 600; letter-spacing: 0.5px; text-transform: uppercase; padding: 3px 8px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.07); color: #9aa4b2; }
            .rv-st i { width: 8px; height: 8px; border-radius: 50%; display: block; }
            .rv-sp { flex: 1; }
            .rv-hr { display: flex; gap: 8px; flex-shrink: 0; }
            .rv-btn { height: 32px; padding: 0 14px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.07); background: none; color: #9aa4b2; font-size: 13px; font-weight: 600; cursor: pointer; }
            .rv-btn:hover:not(:disabled) { color: #e6edf3; background: rgba(255,255,255,0.05); }
            .rv-btn:disabled { opacity: 0.35; cursor: default; }
            .rv-btn[hidden] { display: none; }
            .rv-btn.rv-pri { background: #4fd1c5; border-color: #4fd1c5; color: #0d1117; }
            .rv-btn.rv-pri:hover { background: #38b2ac; color: #0d1117; }
            .rv-dbody { flex: 1; min-height: 0; display: flex; }
            .rv-body { flex: 1; min-width: 0; overflow-y: auto; padding: 28px; }
            .rv-read { max-width: 760px; }
            .rv-panel[hidden] { display: none; }
            .rv-qtx { font-size: 18px; font-weight: 600; line-height: 1.55; margin: 0 0 18px; overflow-wrap: anywhere; }
            .rv-img { display: block; max-width: 100%; max-height: 320px; border-radius: 10px; margin: 0 0 18px; }
            .rv-vd { padding: 12px 14px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.07); border-left-width: 3px; font-size: 14px; line-height: 1.6; margin-bottom: 16px; color: #c9d1d9; }
            .rv-vd b { color: #e6edf3; font-weight: 600; }
            .rv-vd.ok { border-left-color: #22c55e; background: rgba(34,197,94,0.06); }
            .rv-vd.bad { border-left-color: #f85149; background: rgba(248,81,73,0.06); }
            .rv-vd.part { border-left-color: #f28c38; background: rgba(242,140,56,0.06); }
            .rv-vd.pend { border-left-color: #7d8794; background: rgba(255,255,255,0.03); }
            .rv-op { display: flex; align-items: center; gap: 12px; padding: 12px 14px; border: 1px solid rgba(255,255,255,0.07); border-radius: 10px; margin-bottom: 8px; font-size: 14px; color: #c9d1d9; }
            .rv-mk { width: 18px; height: 18px; flex-shrink: 0; display: grid; place-items: center; border: 2px solid rgba(255,255,255,0.25); font-size: 10px; line-height: 1; }
            .rv-mk.r { border-radius: 50%; } .rv-mk.s { border-radius: 5px; }
            .rv-tg { margin-left: auto; flex-shrink: 0; white-space: nowrap; font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 999px; }
            .rv-op.sel { border-color: rgba(79,209,197,0.45); background: rgba(79,209,197,0.07); color: #e6edf3; }
            .rv-op.sel .rv-mk { border-color: #4fd1c5; background: #4fd1c5; color: #0d1117; }
            .rv-op.sel .rv-tg { color: #4fd1c5; background: rgba(79,209,197,0.14); }
            .rv-op.ok { border-color: rgba(34,197,94,0.45); background: rgba(34,197,94,0.07); color: #e6edf3; }
            .rv-op.ok .rv-mk { border-color: #22c55e; background: #22c55e; color: #0d1117; }
            .rv-op.ok .rv-tg { color: #22c55e; background: rgba(34,197,94,0.14); }
            .rv-op.bad { border-color: rgba(248,81,73,0.45); background: rgba(248,81,73,0.07); color: #e6edf3; }
            .rv-op.bad .rv-mk { border-color: #f85149; background: #f85149; color: #0d1117; }
            .rv-op.bad .rv-tg { color: #f85149; background: rgba(248,81,73,0.14); }
            .rv-op.miss { border-style: dashed; border-color: rgba(34,197,94,0.5); }
            .rv-op.miss .rv-tg { color: #22c55e; background: rgba(34,197,94,0.1); }
            .rv-calc { border: 1px solid rgba(255,255,255,0.07); border-radius: 10px; padding: 4px 14px; font-size: 13px; color: #c9d1d9; margin-top: 16px; }
            .rv-calc div { display: flex; justify-content: space-between; padding: 9px 0; border-bottom: 1px solid rgba(255,255,255,0.07); }
            .rv-calc div:last-child { border-bottom: 0; font-weight: 600; color: #e6edf3; }
            .rv-fr { display: grid; grid-template-columns: 70px 1fr 1fr; gap: 12px; align-items: start; padding: 12px 14px; border: 1px solid rgba(255,255,255,0.07); border-radius: 10px; margin-bottom: 8px; font-size: 14px; color: #c9d1d9; }
            .rv-fr small { display: block; font-size: 11px; color: #7d8794; margin-bottom: 3px; }
            .rv-fr .l { color: #7d8794; font-size: 12px; font-weight: 600; padding-top: 2px; }
            .rv-fr.ok { border-color: rgba(34,197,94,0.4); } .rv-fr.bad { border-color: rgba(248,81,73,0.4); }
            .rv-fr .ya { font-weight: 600; } .rv-fr.ok .ya { color: #22c55e; } .rv-fr.bad .ya { color: #f85149; }
            .rv-lab { font-size: 12px; font-weight: 600; letter-spacing: 0.5px; text-transform: uppercase; color: #7d8794; margin: 0 0 8px; }
            .rv-ans { padding: 14px 16px; border: 1px solid rgba(255,255,255,0.07); border-radius: 10px; background: #12161c; line-height: 1.7; font-size: 14px; color: #c9d1d9; overflow-wrap: anywhere; }
            .rv-aw { display: flex; align-items: center; gap: 12px; margin-top: 14px; }
            .rv-aw b { font-size: 18px; font-weight: 600; } .rv-aw span { color: #7d8794; font-size: 13px; }
            .rv-fbk { margin-top: 10px; padding: 12px 14px; border-left: 3px solid #4fd1c5; background: rgba(79,209,197,0.1); border-radius: 8px; font-size: 14px; line-height: 1.65; color: #c9d1d9; overflow-wrap: anywhere; }
            .rv-fbk small { display: block; font-size: 11px; font-weight: 600; letter-spacing: 0.5px; text-transform: uppercase; color: #4fd1c5; margin-bottom: 4px; }

            .rv-rail { width: 280px; flex-shrink: 0; border-left: 1px solid rgba(255,255,255,0.07); padding: 24px 20px; overflow-y: auto; }
            .rv-rail h4 { margin: 0 0 14px; font-size: 12px; font-weight: 600; letter-spacing: 0.6px; text-transform: uppercase; color: #7d8794; }
            .rv-rail h4.sub { margin: 28px 0 4px; }
            .rv-kv { display: flex; justify-content: space-between; gap: 10px; padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.07); font-size: 13px; }
            .rv-kv span { color: #9aa4b2; } .rv-kv b { font-weight: 600; color: #e6edf3; text-align: right; }
            .rv-more { display: block; width: 100%; text-align: left; padding: 9px 0; cursor: pointer; background: none; border: 0; border-bottom: 1px solid rgba(255,255,255,0.07); color: inherit; }
            .rv-more b { display: block; font-size: 13px; font-weight: 600; color: #e6edf3; }
            .rv-more small { color: #7d8794; font-size: 12px; }
            .rv-more:hover b { color: #4fd1c5; }
            @container (max-width: 899px) { .rv-rail { display: none; } }
            .rv-desktop :focus-visible { outline: 2px solid #4fd1c5; outline-offset: -2px; }
        }
    </style>
    <noscript><style>.rv-legacy { display: block !important; } .rv-desktop { display: none !important; }</style></noscript>
</head>
<body>

<div class="rv-legacy">
<div class="container">
    <div class="score-card">
        <div class="review-badge">
            <i class="fas fa-chart-simple"></i>
            Quiz Review
        </div>
        <div class="perc-circle"><?= $percentage ?>%</div>
        <div class="review-title">
            <?= htmlspecialchars($quizInfo['title']) ?>
        </div>
        <div class="review-meta">
            Points: <strong><?= $quizInfo['score'] ?> / <?= $quizInfo['total'] ?></strong> • 
            Date: <?= date("d M Y", strtotime($quizInfo['submitted_at'])) ?>
        </div>
    </div>

    <?php $count = 1; foreach ($questions as $q): ?>
        <div class="question-box">
            <div class="q-meta">
                Question <?= $count++ ?> - <?= htmlspecialchars(format_review_points($q['points_earned'])) ?> / <?= htmlspecialchars(format_review_points($q['points_possible'])) ?> pts
            </div>
            <strong class="question-text"><?= htmlspecialchars($q['text']) ?></strong>

            <?php if (!empty($q['image'])): ?>
                <img src="<?= htmlspecialchars($q['image']) ?>" class="q-image" alt="Question Image">
            <?php endif; ?>

            <?php if (($q['question_type'] ?? 'mcq') === 'fill_in_blank'): ?>
                <?php foreach (($q['fitb']['blanks'] ?? []) as $blank): ?>
                    <div class="fitb-review-row <?= $blank['is_correct'] ? 'correct' : 'incorrect' ?>">
                        <div>
                            <i class="fas <?= $blank['is_correct'] ? 'fa-check-circle' : 'fa-times-circle' ?>"></i>
                            Blank <?= htmlspecialchars((string)$blank['blank_index']) ?> - Your answer:
                            <span class="fitb-review-answer"><?= htmlspecialchars($blank['learner_answer'] !== '' ? $blank['learner_answer'] : 'No answer submitted.') ?></span>
                        </div>
                        <?php if ((int)$quizInfo['publish_marks'] === 1): ?>
                            <div class="fitb-review-correct">
                                Accepted answers: <?= htmlspecialchars(implode(', ', $blank['accepted_answers'])) ?>
                            </div>
                        <?php endif; ?>
                    </div>
                <?php endforeach; ?>
            <?php elseif (($q['question_type'] ?? 'mcq') === 'open_ended'): ?>
                <div class="open-answer-box">
                    <strong>Your answer:</strong><br>
                    <?= nl2br(htmlspecialchars($q['answer_text'] !== '' ? $q['answer_text'] : 'No answer submitted.')) ?>
                </div>
                <?php if (!empty($q['grade'])): ?>
                    <div class="open-grade-box">
                        <strong>Awarded:</strong>
                        <?= htmlspecialchars((string)$q['grade']['score']) ?> / <?= htmlspecialchars((string)$q['points']) ?>
                        <?php if (!empty($q['grade']['feedback'])): ?>
                            <div style="margin-top:8px;">
                                <strong>Teacher feedback:</strong><br>
                                <?= nl2br(htmlspecialchars($q['grade']['feedback'])) ?>
                            </div>
                        <?php endif; ?>
                    </div>
                <?php else: ?>
                    <div class="open-pending-box">Awaiting teacher grading.</div>
                <?php endif; ?>
            <?php elseif (($q['question_type'] ?? 'mcq') === 'multiple_answer'): ?>
            <?php
                $ma = $q['multiple_answer'] ?? [];
                $showDeduction = (int)$quizInfo['publish_marks'] === 1
                    && ($ma['scoring_mode'] ?? '') === 'partial_penalty'
                    && (float)($ma['points_deducted'] ?? 0) > 0
                    && (int)($ma['wrong_selected_count'] ?? 0) > 0;
            ?>
            <?php if ($showDeduction): ?>
                <div style="color:#f5c38b;font-size:13px;margin-bottom:12px;">
                    <?= (int)($ma['correct_selected_count'] ?? 0) ?> correct selected (+<?= htmlspecialchars(format_review_points($ma['points_added'] ?? 0)) ?>pts),
                    <?= (int)($ma['wrong_selected_count'] ?? 0) ?> wrong selected (-<?= htmlspecialchars(format_review_points($ma['points_deducted'] ?? 0)) ?>pts deducted)
                </div>
            <?php endif; ?>
            <div class="choices-list">
                <?php
                $selectedIds = $q['multiple_answer']['selected_choice_ids'] ?? [];
                foreach ($q['choices'] as $choice):
                    $isSelected = in_array((int)$choice['id'], $selectedIds, true);
                    $isCorrect = ((int)$choice['is_correct'] === 1);
                    $class = '';
                    if ((int)$quizInfo['publish_marks'] === 1 && $isCorrect) $class = 'correct';
                    elseif ((int)$quizInfo['publish_marks'] === 1 && $isSelected && !$isCorrect) $class = 'incorrect';
                ?>
                    <div class="choice <?= $class ?>">
                        <?php if ((int)$quizInfo['publish_marks'] === 1 && $isCorrect): ?>
                            <i class="fas fa-check-circle"></i>
                        <?php elseif ((int)$quizInfo['publish_marks'] === 1 && $isSelected && !$isCorrect): ?>
                            <i class="fas fa-times-circle"></i>
                        <?php else: ?>
                            <i class="far fa-square" style="opacity:0.3"></i>
                        <?php endif; ?>

                        <?= htmlspecialchars($choice['text']) ?>

                        <?php if ($isSelected): ?>
                            <span class="badge-user">Your Answer</span>
                        <?php endif; ?>
                        <?php if ((int)$quizInfo['publish_marks'] === 1 && $isCorrect): ?>
                            <span class="badge-correct">Correct</span>
                        <?php endif; ?>
                    </div>
                <?php endforeach; ?>
            </div>
            <?php else: ?>
            <div class="choices-list">
                <?php foreach ($q['choices'] as $choice): 
                    $isSelected = ($choice['id'] == $q['selected']);
                    $isCorrect = ($choice['is_correct'] == 1);
                    
                    $class = '';
                    if ($isCorrect) $class = 'correct';
                    elseif ($isSelected && !$isCorrect) $class = 'incorrect';
                ?>
                    <div class="choice <?= $class ?>">
                        <?php if ($isCorrect): ?>
                            <i class="fas fa-check-circle"></i>
                        <?php elseif ($isSelected && !$isCorrect): ?>
                            <i class="fas fa-times-circle"></i>
                        <?php else: ?>
                            <i class="far fa-circle" style="opacity:0.3"></i>
                        <?php endif; ?>

                        <?= htmlspecialchars($choice['text']) ?>

                        <?php if ($isSelected): ?>
                            <span class="badge-user">Your Answer</span>
                        <?php endif; ?>
                    </div>
                <?php endforeach; ?>
            </div>
            <?php endif; ?>
        </div>
    <?php endforeach; ?>

    <div style="text-align: center; margin-top: 40px;">
      
    </div>

</div><!-- /.container -->
</div><!-- /.rv-legacy -->

<!-- ═══ DESKTOP REVIEW LAYOUT ═══ -->
<div class="rv-desktop" id="rvRoot">
    <section class="rv-list" aria-label="Questions">
        <div class="rv-lh">
            <a class="rv-back" id="rvBack" href="<?= rv_h($backLink) ?>" hidden>&larr; Back</a>
            <div class="rv-sumx">
                <div class="rv-ring" style="--p:<?= (int)$percentage ?>;--c:<?= $rvRingColor ?>"><i><?= (int)$percentage ?>%</i></div>
                <div>
                    <div class="rv-stt"><?= rv_h($quizInfo['title']) ?></div>
                    <div class="rv-sts"><?= rv_h(format_review_points($quizInfo['score'])) ?> / <?= rv_h(format_review_points($quizInfo['total'])) ?> pts &middot; <?= rv_h(date("d M Y", strtotime($quizInfo['submitted_at']))) ?></div>
                </div>
            </div>
            <div class="rv-ob">
                <?php foreach (['ok' => '#22c55e', 'part' => '#f28c38', 'bad' => '#f85149', 'pend' => '#566172'] as $k => $color): if ($rvCounts[$k] > 0): ?>
                    <div style="flex:<?= (int)$rvCounts[$k] ?>;background:<?= $color ?>"></div>
                <?php endif; endforeach; ?>
            </div>
            <div class="rv-oleg"><?= rv_h(implode(' · ', $rvLegend)) ?></div>
            <div class="rv-chips" id="rvChips">
                <button type="button" class="rv-chip on" data-f="all">All <?= count($rvItems) ?></button>
                <button type="button" class="rv-chip" data-f="attn">Needs attention <?= (int)$rvAttn ?></button>
                <button type="button" class="rv-chip" data-f="ok">Correct <?= (int)$rvCounts['ok'] ?></button>
            </div>
        </div>
        <div class="rv-rows" id="rvRows" tabindex="0">
            <?php foreach ($rvItems as $it):
                $q = $it['q']; $o = $it['o'];
                $typeLabel = $rvTypeLabels[$it['type']] ?? 'Question';
                $pts = ($o === 'pend' ? '—' : format_review_points($q['points_earned'])) . ' / ' . format_review_points($q['points_possible']);
            ?>
                <button type="button" class="rv-row" data-q="<?= (int)$it['n'] ?>" data-o="<?= $o ?>" data-type="<?= rv_h($typeLabel) ?>" data-pts="<?= rv_h($pts) ?>">
                    <span class="rv-qs rv-o-<?= $o ?>"><?= $rvOutcomeIcons[$o] ?></span>
                    <span class="rv-ri">
                        <span class="rv-rt"><?= (int)$it['n'] ?>. <?= rv_h($q['text']) ?></span>
                        <span class="rv-rm"><?= rv_h($typeLabel) ?> &middot; <?= rv_h($pts) ?> pts</span>
                    </span>
                </button>
            <?php endforeach; ?>
        </div>
    </section>

    <div class="rv-split" id="rvSplit" role="separator" aria-orientation="vertical" aria-label="Resize question list" tabindex="0"></div>

    <section class="rv-detail" aria-label="Question review">
        <div class="rv-dh">
            <h2 id="rvTitle">Question 1 of <?= count($rvItems) ?></h2>
            <span class="rv-st"><i id="rvDot"></i><span id="rvStatus"></span></span>
            <span class="rv-sp"></span>
            <span class="rv-hr">
                <button type="button" class="rv-btn" id="rvPrev">Previous</button>
                <button type="button" class="rv-btn" id="rvNext">Next</button>
                <button type="button" class="rv-btn rv-pri" id="rvNr" hidden>Next to review</button>
            </span>
        </div>
        <div class="rv-dbody">
            <div class="rv-body" id="rvBody"><div class="rv-read">
                <?php foreach ($rvItems as $it):
                    $q = $it['q']; $o = $it['o']; $type = $it['type']; $n = (int)$it['n'];
                    $selectedIds = $q['multiple_answer']['selected_choice_ids'] ?? [];
                ?>
                <section class="rv-panel" id="rv-q-<?= $n ?>" data-q="<?= $n ?>" hidden>
                    <p class="rv-qtx"><?= rv_h($q['text']) ?></p>
                    <?php if (!empty($q['image'])): ?>
                        <img src="<?= rv_h($q['image']) ?>" class="rv-img" alt="Question image">
                    <?php endif; ?>
                    <div class="rv-vd <?= $o ?>"><?= rv_verdict($q, $type, $o, $rvPublished) ?></div>

                    <?php if ($type === 'fill_in_blank'): ?>
                        <?php foreach (($q['fitb']['blanks'] ?? []) as $blank): ?>
                            <div class="rv-fr <?= $blank['is_correct'] ? 'ok' : 'bad' ?>">
                                <span class="l">Blank <?= rv_h($blank['blank_index']) ?></span>
                                <div>
                                    <small>Your answer</small>
                                    <span class="ya"><?= $blank['is_correct'] ? '&#10003;' : '&#10005;' ?> <?= rv_h($blank['learner_answer'] !== '' ? $blank['learner_answer'] : 'No answer submitted.') ?></span>
                                </div>
                                <div>
                                    <?php if ($rvPublished): ?>
                                        <small>Accepted answers</small>
                                        <?= rv_h(implode(', ', $blank['accepted_answers'])) ?>
                                    <?php endif; ?>
                                </div>
                            </div>
                        <?php endforeach; ?>

                    <?php elseif ($type === 'open_ended'): ?>
                        <div class="rv-lab">Your answer</div>
                        <div class="rv-ans"><?= nl2br(rv_h($q['answer_text'] !== '' ? $q['answer_text'] : 'No answer submitted.')) ?></div>
                        <?php if (!empty($q['grade'])): ?>
                            <div class="rv-aw"><b><?= rv_h($q['grade']['score']) ?> / <?= rv_h($q['points']) ?></b><span>awarded</span></div>
                            <?php if (!empty($q['grade']['feedback'])): ?>
                                <div class="rv-fbk"><small>Teacher feedback</small><?= nl2br(rv_h($q['grade']['feedback'])) ?></div>
                            <?php endif; ?>
                        <?php endif; ?>

                    <?php elseif ($type === 'multiple_answer'): ?>
                        <?php foreach ($q['choices'] as $choice):
                            $isSelected = in_array((int)$choice['id'], $selectedIds, true);
                            $isCorrect  = ((int)$choice['is_correct'] === 1);
                            $cls = ''; $tag = '';
                            if ($rvPublished) {
                                if ($isCorrect && $isSelected) { $cls = 'ok';   $tag = 'Your answer · Correct'; }
                                elseif ($isSelected)           { $cls = 'bad';  $tag = 'Your answer'; }
                                elseif ($isCorrect)            { $cls = 'miss'; $tag = 'Correct answer'; }
                            } elseif ($isSelected) { $cls = 'sel'; $tag = 'Your answer'; }
                        ?>
                            <div class="rv-op <?= $cls ?>">
                                <span class="rv-mk s"><?php if ($cls === 'ok' || $cls === 'sel'): ?>&#10003;<?php elseif ($cls === 'bad'): ?>&#10005;<?php endif; ?></span>
                                <?= rv_h($choice['text']) ?>
                                <?php if ($tag !== ''): ?><span class="rv-tg"><?= rv_h($tag) ?></span><?php endif; ?>
                            </div>
                        <?php endforeach; ?>
                        <?php
                            $ma = $q['multiple_answer'] ?? [];
                            if ($rvPublished && ($ma['scoring_mode'] ?? '') === 'partial_penalty' && (float)($ma['points_deducted'] ?? 0) > 0 && (int)($ma['wrong_selected_count'] ?? 0) > 0):
                        ?>
                            <div class="rv-calc">
                                <div><span>Correct options selected</span><span>+<?= rv_h(format_review_points($ma['points_added'] ?? 0)) ?> pts</span></div>
                                <div><span>Wrong options selected</span><span>&minus;<?= rv_h(format_review_points($ma['points_deducted'] ?? 0)) ?> pts</span></div>
                                <div><span>Score for this question</span><span><?= rv_h(format_review_points($q['points_earned'])) ?> / <?= rv_h(format_review_points($q['points_possible'])) ?> pts</span></div>
                            </div>
                        <?php endif; ?>

                    <?php else: ?>
                        <?php foreach ($q['choices'] as $choice):
                            $isSelected = ($q['selected'] !== null && $choice['id'] == $q['selected']);
                            $isCorrect  = ((int)$choice['is_correct'] === 1);
                            $cls = ''; $tag = '';
                            if ($isCorrect && $isSelected) { $cls = 'ok';   $tag = 'Your answer · Correct'; }
                            elseif ($isSelected)           { $cls = 'bad';  $tag = 'Your answer'; }
                            elseif ($isCorrect)            { $cls = 'miss'; $tag = 'Correct answer'; }
                        ?>
                            <div class="rv-op <?= $cls ?>">
                                <span class="rv-mk r"><?php if ($cls === 'ok'): ?>&#10003;<?php elseif ($cls === 'bad'): ?>&#10005;<?php endif; ?></span>
                                <?= rv_h($choice['text']) ?>
                                <?php if ($tag !== ''): ?><span class="rv-tg"><?= rv_h($tag) ?></span><?php endif; ?>
                            </div>
                        <?php endforeach; ?>
                    <?php endif; ?>
                </section>
                <?php endforeach; ?>
            </div></div>
            <aside class="rv-rail" id="rvRail"></aside>
        </div>
    </section>
</div>

<script>
(function () {
    var root = document.getElementById('rvRoot');
    if (!root) return;
    var rows = [].slice.call(document.querySelectorAll('.rv-row'));
    var panels = [].slice.call(document.querySelectorAll('.rv-panel'));
    var total = rows.length, sel = 0, filter = 'all';
    var LABEL = { ok: 'Correct', part: 'Partly correct', bad: 'Incorrect', pend: 'Awaiting grading' };
    var DOT = { ok: '#22c55e', part: '#f28c38', bad: '#f85149', pend: '#7d8794' };
    function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
    function row(n) { return rows[n - 1]; }

    function nextToReview() {
        for (var i = sel + 1; i <= total; i++) if (row(i).dataset.o !== 'ok') return i;
        for (var j = 1; j < sel; j++) if (row(j).dataset.o !== 'ok') return j;
        return 0;
    }

    function show(n) {
        if (n < 1 || n > total) return;
        sel = n;
        rows.forEach(function (r) { r.classList.toggle('on', +r.dataset.q === n); });
        panels.forEach(function (p) { p.hidden = (+p.dataset.q !== n); });
        var r = row(n), o = r.dataset.o;
        document.getElementById('rvTitle').textContent = 'Question ' + n + ' of ' + total;
        document.getElementById('rvStatus').textContent = LABEL[o];
        document.getElementById('rvDot').style.background = DOT[o];
        document.getElementById('rvPrev').disabled = n === 1;
        document.getElementById('rvNext').disabled = n === total;
        var nr = nextToReview();
        document.getElementById('rvNr').hidden = !nr;
        var rail = '<h4>Details</h4>' +
            '<div class="rv-kv"><span>Type</span><b>' + esc(r.dataset.type) + '</b></div>' +
            '<div class="rv-kv"><span>Points</span><b>' + esc(r.dataset.pts) + '</b></div>' +
            '<div class="rv-kv"><span>Result</span><b>' + LABEL[o] + '</b></div>';
        var attn = rows.filter(function (x) { return x.dataset.o !== 'ok' && +x.dataset.q !== n; }).slice(0, 4);
        if (attn.length) {
            rail += '<h4 class="sub">Also needs attention</h4>' + attn.map(function (x) {
                return '<button type="button" class="rv-more" data-q="' + x.dataset.q + '"><b>Question ' + x.dataset.q + '</b><small>' + LABEL[x.dataset.o] + '</small></button>';
            }).join('');
        }
        document.getElementById('rvRail').innerHTML = rail;
        document.getElementById('rvBody').scrollTop = 0;
        if (r.scrollIntoView) r.scrollIntoView({ block: 'nearest' });
    }

    function applyFilter() {
        var any = false;
        rows.forEach(function (r) {
            var o = r.dataset.o;
            var ok = filter === 'all' || (filter === 'attn' && o !== 'ok') || (filter === 'ok' && o === 'ok');
            r.hidden = !ok;
            if (ok) any = true;
        });
        [].forEach.call(document.querySelectorAll('.rv-chip'), function (c) { c.classList.toggle('on', c.dataset.f === filter); });
        var empty = document.getElementById('rvEmpty');
        if (!any && !empty) {
            empty = document.createElement('div');
            empty.id = 'rvEmpty'; empty.className = 'rv-list-empty'; empty.textContent = 'No questions match.';
            document.getElementById('rvRows').appendChild(empty);
        } else if (any && empty) { empty.remove(); }
        if (any && row(sel).hidden) {
            var first = rows.filter(function (r) { return !r.hidden; })[0];
            if (first) show(+first.dataset.q);
        }
    }

    document.getElementById('rvRows').addEventListener('click', function (e) {
        var r = e.target.closest('.rv-row'); if (r) show(+r.dataset.q);
    });
    document.getElementById('rvRows').addEventListener('keydown', function (e) {
        if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
        var vis = rows.filter(function (r) { return !r.hidden; });
        var i = vis.indexOf(row(sel)), next = e.key === 'ArrowDown' ? Math.min(vis.length - 1, i + 1) : Math.max(0, i - 1);
        e.preventDefault();
        if (vis[next]) show(+vis[next].dataset.q);
    });
    document.getElementById('rvChips').addEventListener('click', function (e) {
        var c = e.target.closest('.rv-chip'); if (!c) return; filter = c.dataset.f; applyFilter();
    });
    document.getElementById('rvRail').addEventListener('click', function (e) {
        var m = e.target.closest('.rv-more'); if (m) show(+m.dataset.q);
    });
    document.getElementById('rvPrev').addEventListener('click', function () { show(sel - 1); });
    document.getElementById('rvNext').addEventListener('click', function () { show(sel + 1); });
    document.getElementById('rvNr').addEventListener('click', function () { var n = nextToReview(); if (n) show(n); });

    // Only needed when the page is opened on its own; inside the dashboard the header already has Back.
    if (window.self === window.top) document.getElementById('rvBack').hidden = false;

    // Resizable list, width shared with the other learner pages
    var split = document.getElementById('rvSplit');
    function clamp(w) { return Math.max(260, Math.min(420, w)); }
    function apply(w) { root.style.setProperty('--rv-listw', clamp(w) + 'px'); }
    function current() { return parseInt(getComputedStyle(root).getPropertyValue('--rv-listw'), 10) || 320; }
    function persist() { try { localStorage.setItem('lqz.listWidth', String(current())); } catch (e) {} }
    try { var saved = parseInt(localStorage.getItem('lqz.listWidth'), 10); if (saved) apply(saved); } catch (e) {}
    split.addEventListener('mousedown', function (e) {
        e.preventDefault(); split.classList.add('drag'); document.body.style.userSelect = 'none';
        var left = root.getBoundingClientRect().left;
        function move(ev) { apply(ev.clientX - left); }
        function up() { split.classList.remove('drag'); document.body.style.userSelect = ''; document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', up); persist(); }
        document.addEventListener('mousemove', move); document.addEventListener('mouseup', up);
    });
    split.addEventListener('keydown', function (e) {
        if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
        e.preventDefault(); apply(current() + (e.key === 'ArrowRight' ? 16 : -16)); persist();
    });

    if (total) show(1);
})();
</script>

</body>
</html>