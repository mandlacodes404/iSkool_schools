<?php
require_once __DIR__ . '/../../auth/session_guard.php';
require_once __DIR__ . '/../../auth/csrf_helper.php';
require_once dirname(__DIR__, 2) . '/config.php';

header('Content-Type: application/json');

if (!isset($_SESSION['email']) || $_SESSION['role'] !== 'teacher') {
    echo json_encode(['success' => false, 'message' => 'Unauthorized']);
    exit();
}

verify_csrf_token();

$input      = json_decode(file_get_contents('php://input'), true);
$quiz_id    = (int)($input['quiz_id'] ?? 0);
$new_status = $input['status'] ?? '';

if ($quiz_id < 1 || !in_array($new_status, ['Open', 'Closed'])) {
    echo json_encode(['success' => false, 'message' => 'Invalid data']);
    exit();
}

$stmt = $conn->prepare("SELECT created_by FROM quizzes WHERE id = ?");
$stmt->bind_param("i", $quiz_id);
$stmt->execute();
$row = $stmt->get_result()->fetch_assoc();
$stmt->close();

if (!$row || $row['created_by'] !== $_SESSION['email']) {
    echo json_encode(['success' => false, 'message' => 'You do not own this quiz']);
    exit();
}

$stmt = $conn->prepare("UPDATE quizzes SET status = ? WHERE id = ?");
$stmt->bind_param("si", $new_status, $quiz_id);
$stmt->execute();
$stmt->close();

echo json_encode(['success' => true, 'newStatus' => $new_status]);