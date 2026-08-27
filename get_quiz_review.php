<?php
/**
 * iSkool - Quiz Review API Endpoint
 *
 * JSON port of review_quiz.php. All data-fetch and scoring logic below is
 * copied verbatim from review_quiz.php (same queries, same scoring rules,
 * same access control) -- only the output stage changed, from an HTML
 * page render to a json_encode response, so grades.js can fetch this and
 * render the review inside the app's own mobile sheet (.pr-modal-sheet)
 * instead of loading review_quiz.php in an <iframe>.
 *
 * review_quiz.php itself is untouched and still works standalone; this
 * file does not replace it on disk, it's a new, separate endpoint.
 */
session_start();
include("config.php");
header('Content-Type: application/json');

// 1. Security Check
if (!isset($_SESSION['email'])) {
    http_response_code(401);
    echo json_encode(['error' => 'not_authenticated']);
    exit();
}

if (!isset($_GET['result_id'])) {
    http_response_code(400);
    echo json_encode(['error' => 'invalid_request', 'message' => 'Invalid review request.']);
    exit();
}

$resultId = intval($_GET['result_id']);
$loggedInEmail = $_SESSION['email'];
$userRole = $_SESSION['role'] ?? 'learner';

// 2. Optimized Data Fetch (Combined results, quiz info, questions, and choices)
// -- identical to review_quiz.php --
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

if (!$quizInfo) {
    http_response_code(404);
    echo json_encode(['error' => 'not_found', 'message' => 'Review data not found.']);
    exit();
}

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
        http_response_code(403);
        echo json_encode(['error' => 'access_denied', 'message' => 'Access denied. You can only view your own results.']);
        exit();
    }

    if ((int)$quizInfo['publish_marks'] === 0) {
        // Same "not published" gate as review_quiz.php, but as a JSON
        // response instead of a standalone HTML page -- grades.js renders
        // its own "not published" state inside the sheet from this.
        echo json_encode([
            'published' => false,
            'message' => 'Your teacher has not released the marks for this quiz yet.'
        ]);
        exit();
    }
}

$percentage = ($quizInfo['total'] > 0) ? round(($quizInfo['score'] / $quizInfo['total']) * 100) : 0;

function format_review_points($value): string {
    $formatted = number_format((float)$value, 2, '.', '');
    return rtrim(rtrim($formatted, '0'), '.');
}

// 4. Shape the response.
// Re-key $questions from a qid-indexed map to a plain sequential list (order
// already guaranteed by "ORDER BY qq.id ASC" in the main query), and format
// the points fields the same way review_quiz.php's template did inline.
$questionsOut = [];
foreach ($questions as $q) {
    $out = [
        'text' => $q['text'],
        'image' => $q['image'],
        'question_type' => $q['question_type'],
        'points_possible' => (float)$q['points_possible'],
        'points_possible_display' => format_review_points($q['points_possible']),
        'points_earned' => (float)$q['points_earned'],
        'points_earned_display' => format_review_points($q['points_earned']),
        'choices' => array_map(function ($c) use ($quizInfo) {
            return [
                'id' => (int)$c['id'],
                'text' => $c['text'],
                // Only ever tell the client which choice is correct once
                // marks are published -- mirrors the show/hide logic that
                // used to live in the PHP template itself.
                'is_correct' => ((int)$quizInfo['publish_marks'] === 1) ? ((int)$c['is_correct'] === 1) : null
            ];
        }, $q['choices']),
        'selected_choice_id' => $q['selected'] !== null ? (int)$q['selected'] : null,
        'answer_text' => $q['answer_text'],
    ];

    if ($q['question_type'] === 'fill_in_blank' && !empty($q['fitb'])) {
        $out['fitb'] = [
            'sub_type' => $q['fitb']['sub_type'],
            'scoring_mode' => $q['fitb']['scoring_mode'],
            'blanks' => array_map(function ($b) use ($quizInfo) {
                return [
                    'blank_index' => $b['blank_index'],
                    'learner_answer' => $b['learner_answer'],
                    'is_correct' => $b['is_correct'],
                    // Accepted answers are only meaningful/shown once marks
                    // are published, same rule as review_quiz.php.
                    'accepted_answers' => ((int)$quizInfo['publish_marks'] === 1) ? $b['accepted_answers'] : []
                ];
            }, $q['fitb']['blanks'])
        ];
    }

    if ($q['question_type'] === 'open_ended') {
        $out['open_ended'] = [
            'grade' => $q['grade'] ? [
                'score' => (float)$q['grade']['score'],
                'feedback' => $q['grade']['feedback'],
                'graded_by' => $q['grade']['graded_by'],
                'graded_at' => $q['grade']['graded_at']
            ] : null,
            'pending' => empty($q['grade'])
        ];
    }

    if ($q['question_type'] === 'multiple_answer' && !empty($q['multiple_answer'])) {
        $ma = $q['multiple_answer'];
        $out['multiple_answer'] = [
            'scoring_mode' => $ma['scoring_mode'],
            'select_exactly' => $ma['select_exactly'],
            'selected_choice_ids' => array_map('intval', $ma['selected_choice_ids']),
            'points_added' => (float)$ma['points_added'],
            'points_added_display' => format_review_points($ma['points_added']),
            'points_deducted' => (float)$ma['points_deducted'],
            'points_deducted_display' => format_review_points($ma['points_deducted']),
            'correct_selected_count' => (int)$ma['correct_selected_count'],
            'wrong_selected_count' => (int)$ma['wrong_selected_count'],
            // Same visibility rule as the PHP template's $showDeduction.
            'show_deduction' => (int)$quizInfo['publish_marks'] === 1
                && $ma['scoring_mode'] === 'partial_penalty'
                && (float)$ma['points_deducted'] > 0
                && (int)$ma['wrong_selected_count'] > 0
        ];
    }

    $questionsOut[] = $out;
}

echo json_encode([
    'published' => true,
    'quiz' => [
        'result_id' => $resultId,
        'title' => $quizInfo['title'],
        'score' => (float)$quizInfo['score'],
        'total' => (float)$quizInfo['total'],
        'percentage' => (int)$percentage,
        'submitted_at' => $quizInfo['submitted_at'],
        'submitted_at_display' => date("d M Y", strtotime($quizInfo['submitted_at'])),
        'publish_marks' => (int)$quizInfo['publish_marks'] === 1
    ],
    'questions' => $questionsOut
]);
