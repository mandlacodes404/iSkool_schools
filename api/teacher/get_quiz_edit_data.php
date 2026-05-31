<?php
require_once __DIR__ . '/../../auth/session_guard.php';
require_once __DIR__ . '/../../auth/csrf_helper.php';
require_once dirname(__DIR__, 2) . '/config.php';

header('Content-Type: application/json');

if (!isset($_SESSION['email']) || $_SESSION['role'] !== 'teacher') {
    echo json_encode(['status' => 'error', 'message' => 'Unauthorized']);
    exit();
}

verify_csrf_token();

$quiz_id = (int)($_GET['quiz_id'] ?? 0);
if ($quiz_id < 1) {
    echo json_encode(['status' => 'error', 'message' => 'Invalid quiz selected.']);
    exit();
}

$stmt = $conn->prepare("
    SELECT q.id, q.title, q.duration, q.publish_marks, q.class_id, q.attempt_limit,
           q.start_time, q.status, q.is_summative, q.weight_percent, q.layout_mode,
           q.shuffle_questions, q.is_linear, q.has_open_ended, c.name AS class_name
    FROM quizzes q
    INNER JOIN classes c ON q.class_id = c.id
    WHERE q.id = ? AND q.created_by = ?
    LIMIT 1
");
$stmt->bind_param("is", $quiz_id, $_SESSION['email']);
$stmt->execute();
$quiz = $stmt->get_result()->fetch_assoc();
$stmt->close();

if (!$quiz) {
    echo json_encode(['status' => 'error', 'message' => 'You do not own this quiz.']);
    exit();
}

$attemptStmt = $conn->prepare("SELECT 1 FROM quiz_attempts WHERE quiz_id = ? LIMIT 1");
$attemptStmt->bind_param("i", $quiz_id);
$attemptStmt->execute();
$has_attempts = $attemptStmt->get_result()->num_rows > 0;
$attemptStmt->close();

$questionsStmt = $conn->prepare("
    SELECT id, question_text, image_path, points, question_type
    FROM quizquestions
    WHERE quiz_id = ?
    ORDER BY id ASC
");
$questionsStmt->bind_param("i", $quiz_id);
$questionsStmt->execute();
$questionsResult = $questionsStmt->get_result();

$choicesStmt = $conn->prepare("
    SELECT id, choice_text, is_correct
    FROM choices
    WHERE question_id = ?
    ORDER BY id ASC
");

$questions = [];
while ($question = $questionsResult->fetch_assoc()) {
    $question_id = (int)$question['id'];
    $choicesStmt->bind_param("i", $question_id);
    $choicesStmt->execute();
    $choices = $choicesStmt->get_result()->fetch_all(MYSQLI_ASSOC);

    $questions[] = [
        'id' => $question_id,
        'question_text' => $question['question_text'],
        'image_path' => $question['image_path'],
        'points' => (int)$question['points'],
        'question_type' => in_array($question['question_type'] ?? 'mcq', ['mcq', 'multiple_answer', 'open_ended', 'fill_in_blank'], true) ? $question['question_type'] : 'mcq',
        'choices' => array_map(function ($choice) {
            return [
                'id' => (int)$choice['id'],
                'choice_text' => $choice['choice_text'],
                'is_correct' => (int)$choice['is_correct']
            ];
        }, $choices)
    ];

    if (($questions[count($questions) - 1]['question_type'] ?? 'mcq') === 'fill_in_blank') {
        $fitbStmt = $conn->prepare("SELECT sub_type, scoring_mode, distractors_json FROM fitb_questions WHERE question_id = ? LIMIT 1");
        $fitbStmt->bind_param("i", $question_id);
        $fitbStmt->execute();
        $fitbMeta = $fitbStmt->get_result()->fetch_assoc();
        $fitbStmt->close();

        $blankStmt = $conn->prepare("SELECT blank_index, accepted_answers_json, case_sensitive FROM fitb_blanks WHERE question_id = ? ORDER BY blank_index ASC");
        $blankStmt->bind_param("i", $question_id);
        $blankStmt->execute();
        $blankRows = $blankStmt->get_result()->fetch_all(MYSQLI_ASSOC);
        $blankStmt->close();

        $questions[count($questions) - 1]['fitb'] = [
            'sub_type' => in_array($fitbMeta['sub_type'] ?? '', ['free_type', 'word_bank'], true) ? $fitbMeta['sub_type'] : 'free_type',
            'scoring_mode' => in_array($fitbMeta['scoring_mode'] ?? '', ['partial', 'all_or_nothing'], true) ? $fitbMeta['scoring_mode'] : 'partial',
            'distractors' => json_decode($fitbMeta['distractors_json'] ?? '[]', true) ?: [],
            'blanks' => array_map(function ($blank) {
                return [
                    'blank_index' => (int)$blank['blank_index'],
                    'accepted_answers' => json_decode($blank['accepted_answers_json'] ?? '[]', true) ?: [],
                    'case_sensitive' => (int)$blank['case_sensitive']
                ];
            }, $blankRows)
        ];
    }
    if (($questions[count($questions) - 1]['question_type'] ?? 'mcq') === 'multiple_answer') {
        $maStmt = $conn->prepare("SELECT scoring_mode, select_exactly FROM multiple_answer_questions WHERE question_id = ? LIMIT 1");
        $maStmt->bind_param("i", $question_id);
        $maStmt->execute();
        $maMeta = $maStmt->get_result()->fetch_assoc();
        $maStmt->close();
        $selectExactly = $maMeta['select_exactly'] ?? null;

        $questions[count($questions) - 1]['multiple_answer'] = [
            'scoring_mode' => in_array($maMeta['scoring_mode'] ?? '', ['exact_match', 'partial_penalty'], true) ? $maMeta['scoring_mode'] : 'exact_match',
            'select_exactly' => $selectExactly === null ? null : (int)$selectExactly
        ];
    }
}
$questionsStmt->close();
$choicesStmt->close();

$quiz['id'] = (int)$quiz['id'];
$quiz['duration'] = (int)$quiz['duration'];
$quiz['publish_marks'] = (int)$quiz['publish_marks'];
$quiz['class_id'] = (int)$quiz['class_id'];
$quiz['attempt_limit'] = (int)$quiz['attempt_limit'];
$quiz['is_summative'] = (int)$quiz['is_summative'];
$quiz['weight_percent'] = $quiz['weight_percent'] === null ? null : (float)$quiz['weight_percent'];
$quiz['status'] = in_array($quiz['status'], ['Scheduled', 'Open', 'Closed'], true) ? $quiz['status'] : 'Closed';
$quiz['layout_mode'] = in_array($quiz['layout_mode'], ['single_page', 'multi_page'], true) ? $quiz['layout_mode'] : 'single_page';
$quiz['shuffle_questions'] = (int)$quiz['shuffle_questions'];
$quiz['is_linear'] = (int)$quiz['is_linear'];
$quiz['has_open_ended'] = (int)$quiz['has_open_ended'];
$quiz['start_time_local'] = $quiz['start_time'] ? date('Y-m-d\TH:i', strtotime($quiz['start_time'])) : '';

echo json_encode([
    'status' => 'success',
    'data' => [
        'quiz' => $quiz,
        'questions' => $questions,
        'has_attempts' => $has_attempts,
        'locked_message' => $has_attempts
            ? 'This quiz already has learner attempts. Questions, question types, choices, points, layout mode, shuffle questions, and linear progression are locked to protect existing attempts.'
            : ''
    ]
]);
