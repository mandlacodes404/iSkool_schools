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
           q.shuffle_questions, q.is_linear, c.name AS class_name
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
    SELECT id, question_text, image_path, points
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
        'choices' => array_map(function ($choice) {
            return [
                'id' => (int)$choice['id'],
                'choice_text' => $choice['choice_text'],
                'is_correct' => (int)$choice['is_correct']
            ];
        }, $choices)
    ];
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
$quiz['start_time_local'] = $quiz['start_time'] ? date('Y-m-d\TH:i', strtotime($quiz['start_time'])) : '';

echo json_encode([
    'status' => 'success',
    'data' => [
        'quiz' => $quiz,
        'questions' => $questions,
        'has_attempts' => $has_attempts,
        'locked_message' => $has_attempts
            ? 'This quiz already has learner attempts. Questions, choices, points, layout mode, shuffle questions, and linear progression are locked to protect existing attempts.'
            : ''
    ]
]);
