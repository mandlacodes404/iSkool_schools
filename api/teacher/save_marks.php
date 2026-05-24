<?php
require_once __DIR__ . '/../../auth/session_guard.php';
require_once __DIR__ . '/../../auth/csrf_helper.php';
require_once dirname(__DIR__, 2) . '/config.php';

header('Content-Type: application/json');

if (!isset($_SESSION['email']) || $_SESSION['role'] !== 'teacher') {
    echo json_encode(['success' => false, 'error' => 'Unauthorized']);
    exit();
}

verify_csrf_token();

$quiz_id    = (int)($_POST['quiz_id'] ?? 0);
$user_email = trim($_POST['user_email'] ?? '');
$score      = floatval($_POST['score'] ?? 0);
$total      = floatval($_POST['total'] ?? 0);

if ($quiz_id <= 0 || empty($user_email)) {
    echo json_encode(['success' => false, 'error' => 'Invalid data']);
    exit();
}

// Check if record exists
$check = $conn->prepare("SELECT id FROM quiz_results WHERE quiz_id = ? AND user_email = ?");
$check->bind_param("is", $quiz_id, $user_email);
$check->execute();
$exists = $check->get_result()->num_rows > 0;
$check->close();

if ($exists) {
    $stmt = $conn->prepare("
        UPDATE quiz_results 
        SET score = ?, total = ?, submitted_at = NOW() 
        WHERE quiz_id = ? AND user_email = ?
    ");
    $stmt->bind_param("ddis", $score, $total, $quiz_id, $user_email);
} else {
    $stmt = $conn->prepare("
        INSERT INTO quiz_results (quiz_id, user_email, score, total, submitted_at, time_taken)
        VALUES (?, ?, ?, ?, NOW(), 0)
    ");
    $stmt->bind_param("isdd", $quiz_id, $user_email, $score, $total);
}

if ($stmt->execute()) {
    echo json_encode(['success' => true]);
} else {
    echo json_encode(['success' => false, 'error' => 'Failed to save marks']);
}
$stmt->close();