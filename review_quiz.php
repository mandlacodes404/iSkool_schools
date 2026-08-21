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
?>

<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Review: <?= htmlspecialchars($quizInfo['title']) ?></title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.2/css/all.min.css" />
    <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@600&display=swap" rel="stylesheet">
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
    </style>
</head>
<body>

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
</div>

</body>
</html>