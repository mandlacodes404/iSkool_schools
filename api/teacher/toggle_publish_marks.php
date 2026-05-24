<?php
require_once __DIR__ . '/../../auth/session_guard.php';
require_once dirname(__DIR__, 2) . '/config.php';

header('Content-Type: application/json');

if (!isset($_SESSION['email']) || $_SESSION['role'] !== 'teacher') {
    echo json_encode(['success' => false, 'message' => 'Unauthorized']);
    exit();
}

$data   = json_decode(file_get_contents('php://input'), true);
$quizId = (int)($data['quiz_id'] ?? 0);
$email  = $_SESSION['email'];

if ($quizId <= 0) {
    echo json_encode(['success' => false, 'message' => 'Invalid quiz ID']);
    exit();
}

$stmt = $conn->prepare("
    SELECT q.publish_marks FROM quizzes q
    INNER JOIN classes c ON q.class_id = c.id
    WHERE q.id = ? AND q.created_by = ?
");
$stmt->bind_param("is", $quizId, $email);
$stmt->execute();
$stmt->bind_result($currentPublish);
if (!$stmt->fetch()) {
    $stmt->close();
    echo json_encode(['success' => false, 'message' => 'Quiz not found']);
    exit();
}
$stmt->close();

$newPublish = $currentPublish ? 0 : 1;
$update     = $conn->prepare("UPDATE quizzes SET publish_marks = ? WHERE id = ?");
$update->bind_param("ii", $newPublish, $quizId);
$update->execute();
$update->close();

echo json_encode(['success' => true, 'newStatus' => $newPublish]);