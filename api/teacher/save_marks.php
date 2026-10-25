<?php
require_once __DIR__ . '/../../auth/session_guard.php';
require_once __DIR__ . '/../../auth/csrf_helper.php';
require_once dirname(__DIR__, 2) . '/config.php';
require_once dirname(__DIR__, 2) . '/includes/marks_guard.php';

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

// A save that waited on the teacher's phone for signal is sent again by the service worker with the marks the teacher
// saw when they pressed Save. It is applied only if the marks are still those (includes/marks_guard.php). An ordinary
// online save has no such baseline, so $expected stays null and nothing below changes for it.
$expected = marks_is_queued_replay($_SERVER) ? marks_parse_expected($_POST) : null;

if ($quiz_id <= 0 || empty($user_email)) {
    echo json_encode(['success' => false, 'error' => 'Invalid data']);
    exit();
}

$ownerStmt = $conn->prepare("SELECT id FROM quizzes WHERE id = ? AND created_by = ? LIMIT 1");
$ownerStmt->bind_param("is", $quiz_id, $_SESSION['email']);
$ownerStmt->execute();
$ownsQuiz = $ownerStmt->get_result()->num_rows > 0;
$ownerStmt->close();
if (!$ownsQuiz) {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'Quiz not found']);
    exit();
}

// Check if record exists. A guarded save reads the row under a lock, so the marks cannot change between the check and the write.
if ($expected !== null) {
    $conn->begin_transaction();
}
$check = $conn->prepare("SELECT score, total FROM quiz_results WHERE quiz_id = ? AND user_email = ?" . ($expected !== null ? " FOR UPDATE" : ""));
$check->bind_param("is", $quiz_id, $user_email);
$check->execute();
$currentRow = $check->get_result()->fetch_assoc();
$check->close();
$exists = is_array($currentRow);

if ($expected !== null) {
    $currentScore = ($exists && $currentRow['score'] !== null) ? (float)$currentRow['score'] : null;
    $currentTotal = ($exists && $currentRow['total'] !== null) ? (float)$currentRow['total'] : null;
    if (marks_already_saved($currentScore, $currentTotal, $score, $total)) {
        $conn->rollback();
        echo json_encode(['success' => true, 'unchanged' => true, 'quiz_id' => $quiz_id, 'user_email' => $user_email]);
        exit();
    }
    if (marks_conflict($currentScore, $currentTotal, $expected['score'], $expected['total'])) {
        $conn->rollback();
        http_response_code(409);
        echo json_encode([
            'success'       => false,
            'conflict'      => true,
            'error'         => 'These marks changed after you saved them on your phone, so your saved marks were not applied.',
            'quiz_id'       => $quiz_id,
            'user_email'    => $user_email,
            'current_score' => $currentScore,
            'current_total' => $currentTotal,
        ]);
        exit();
    }
}

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

$saved = $stmt->execute();
if ($expected !== null) {
    $saved ? $conn->commit() : $conn->rollback();
}
if ($saved) {
    echo json_encode(['success' => true, 'quiz_id' => $quiz_id, 'user_email' => $user_email]);
} else {
    echo json_encode(['success' => false, 'error' => 'Failed to save marks']);
}
$stmt->close();
