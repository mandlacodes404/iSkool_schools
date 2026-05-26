<?php
require_once __DIR__ . '/../../auth/session_guard.php';
require_once __DIR__ . '/../../auth/csrf_helper.php';
require_once dirname(__DIR__, 2) . '/config.php';

header('Content-Type: application/json');

if (!isset($_SESSION['email']) || $_SESSION['role'] !== 'teacher') {
    echo json_encode(['status' => 'error', 'success' => false, 'message' => 'Unauthorized']);
    exit();
}

verify_csrf_token();

$data   = json_decode(file_get_contents('php://input'), true);
$quizId = (int)($data['quiz_id'] ?? 0);
$email  = $_SESSION['email'];

if ($quizId <= 0) {
    echo json_encode(['status' => 'error', 'success' => false, 'message' => 'Invalid quiz ID']);
    exit();
}

$stmt = $conn->prepare("
    SELECT q.publish_marks, q.has_open_ended FROM quizzes q
    INNER JOIN classes c ON q.class_id = c.id
    WHERE q.id = ? AND q.created_by = ?
");
$stmt->bind_param("is", $quizId, $email);
$stmt->execute();
$stmt->bind_result($currentPublish, $hasOpenEnded);
if (!$stmt->fetch()) {
    $stmt->close();
    echo json_encode(['status' => 'error', 'success' => false, 'message' => 'Quiz not found']);
    exit();
}
$stmt->close();

$newPublish = $currentPublish ? 0 : 1;

if ($newPublish === 1 && (int)$hasOpenEnded === 1) {
    $ungradedStmt = $conn->prepare("
        SELECT COUNT(DISTINCT user_email) AS ungraded_count
        FROM (
            SELECT qa.attempt_id, qa.user_email
            FROM quiz_attempts qa
            INNER JOIN quizquestions qq
                ON qq.quiz_id = qa.quiz_id
               AND qq.question_type = 'open_ended'
            LEFT JOIN open_ended_grades og
                ON og.attempt_id = qa.attempt_id
               AND og.question_id = qq.id
            WHERE qa.quiz_id = ?
              AND qa.status = 'submitted'
            GROUP BY qa.attempt_id
            HAVING SUM(CASE WHEN og.graded_by IS NULL THEN 1 ELSE 0 END) > 0
        ) pending
    ");
    $ungradedStmt->bind_param("i", $quizId);
    $ungradedStmt->execute();
    $ungradedCount = (int)($ungradedStmt->get_result()->fetch_assoc()['ungraded_count'] ?? 0);
    $ungradedStmt->close();

    if ($ungradedCount > 0) {
        echo json_encode([
            'status' => 'error',
            'success' => false,
            'message' => $ungradedCount . ' learner(s) still have ungraded open-ended responses. Grade all responses before releasing marks.',
            'ungraded_count' => $ungradedCount
        ]);
        exit();
    }
}

$update     = $conn->prepare("UPDATE quizzes SET publish_marks = ? WHERE id = ?");
$update->bind_param("ii", $newPublish, $quizId);
$update->execute();
$update->close();

echo json_encode([
    'status' => 'success',
    'success' => true,
    'data' => ['newStatus' => $newPublish],
    'newStatus' => $newPublish
]);
