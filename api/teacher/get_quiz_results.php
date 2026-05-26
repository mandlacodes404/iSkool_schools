<?php
require_once __DIR__ . '/../../auth/session_guard.php';
require_once __DIR__ . '/../../auth/csrf_helper.php';
require_once dirname(__DIR__, 2) . '/config.php';

header('Content-Type: application/json');

if (!isset($_SESSION['email']) || $_SESSION['role'] !== 'teacher') {
    echo json_encode(['status' => 'error', 'message' => 'Unauthorized', 'error' => 'Unauthorized']);
    exit();
}

verify_csrf_token();

$quiz_id = (int)($_GET['quiz_id'] ?? 0);
if ($quiz_id <= 0) {
    echo json_encode(['status' => 'error', 'message' => 'Invalid quiz ID', 'error' => 'Invalid quiz ID']);
    exit();
}

// Verify ownership
$titleStmt = $conn->prepare("SELECT title, has_open_ended, publish_marks FROM quizzes WHERE id = ? AND created_by = ?");
$titleStmt->bind_param("is", $quiz_id, $_SESSION['email']);
$titleStmt->execute();
$quiz = $titleStmt->get_result()->fetch_assoc();
$titleStmt->close();

if (!$quiz) {
    echo json_encode(['status' => 'error', 'message' => 'Quiz not found', 'error' => 'Quiz not found']);
    exit();
}

$stmt = $conn->prepare("
    SELECT qr.id AS result_id,
           u.name AS student_name,
           u.surname AS student_surname,
           qr.score, qr.total, qr.time_taken, qr.submitted_at, qr.attempt_id, qr.user_email
    FROM quiz_results qr
    JOIN users u ON qr.user_email = u.email
    WHERE qr.quiz_id = ?
    ORDER BY qr.submitted_at DESC
");
$stmt->bind_param("i", $quiz_id);
$stmt->execute();
$rows = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
$stmt->close();

$results = [];
$quiz_fully_graded = true;
foreach ($rows as $row) {
    $minutes = floor($row['time_taken'] / 60);
    $secs    = $row['time_taken'] % 60;
    $openEnded = [];
    $is_fully_graded = true;
    if ((int)($quiz['has_open_ended'] ?? 0) === 1) {
        $openStmt = $conn->prepare("
            SELECT qq.id AS question_id, qq.question_text, qq.points, ua.answer_text,
                   og.score AS grade_score, og.feedback, og.graded_by, og.graded_at
            FROM quizquestions qq
            LEFT JOIN user_answers ua
              ON ua.question_id = qq.id
             AND ua.attempt_id = ?
            LEFT JOIN open_ended_grades og
              ON og.question_id = qq.id
             AND og.attempt_id = ?
            WHERE qq.quiz_id = ?
              AND qq.question_type = 'open_ended'
            ORDER BY qq.id ASC
        ");
        $attempt_id = (int)$row['attempt_id'];
        $openStmt->bind_param("iii", $attempt_id, $attempt_id, $quiz_id);
        $openStmt->execute();
        $openRows = $openStmt->get_result()->fetch_all(MYSQLI_ASSOC);
        $openStmt->close();

        foreach ($openRows as $openRow) {
            $graded = !empty($openRow['graded_by']);
            if (!$graded) {
                $is_fully_graded = false;
            }
            $openEnded[] = [
                'question_id' => (int)$openRow['question_id'],
                'question_text' => $openRow['question_text'],
                'points' => (int)$openRow['points'],
                'answer_text' => $openRow['answer_text'] ?? '',
                'grade' => $graded ? [
                    'score' => $openRow['grade_score'],
                    'feedback' => $openRow['feedback'],
                    'graded_by' => $openRow['graded_by'],
                    'graded_at' => $openRow['graded_at']
                ] : null
            ];
        }
        if (!$is_fully_graded) {
            $quiz_fully_graded = false;
        }
    }

    $results[] = [
        'result_id'    => $row['result_id'],
        'attempt_id'   => (int)$row['attempt_id'],
        'user_email'   => $row['user_email'],
        'name'         => $row['student_name'] . ' ' . $row['student_surname'],
        'score'        => $row['score'],
        'total'        => $row['total'],
        'percentage'   => $row['total'] > 0
            ? number_format($row['score'] / $row['total'] * 100, 1) . '%'
            : 'N/A',
        'time_taken'   => "{$minutes}m {$secs}s",
        'submitted_at' => date('d M Y, g:i a', strtotime($row['submitted_at'])),
        'open_ended' => $openEnded,
        'is_fully_graded' => $is_fully_graded
    ];
}

echo json_encode([
    'status' => 'success',
    'data' => [
        'quiz_id'    => $quiz_id,
        'quiz_title' => $quiz['title'],
        'has_open_ended' => (int)($quiz['has_open_ended'] ?? 0),
        'publish_marks' => (int)($quiz['publish_marks'] ?? 0),
        'quiz_fully_graded' => $quiz_fully_graded,
        'results'    => $results
    ],
    'quiz_id'    => $quiz_id,
    'quiz_title' => $quiz['title'],
    'has_open_ended' => (int)($quiz['has_open_ended'] ?? 0),
    'publish_marks' => (int)($quiz['publish_marks'] ?? 0),
    'quiz_fully_graded' => $quiz_fully_graded,
    'results'    => $results
]);
