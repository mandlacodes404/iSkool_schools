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

$email = $_SESSION['email'];
$id    = (int)($_POST['id'] ?? 0);

if ($id <= 0) {
    echo json_encode(['success' => false, 'error' => 'Invalid evaluation ID']);
    exit();
}

// Ownership check. This also naturally blocks deleting the system default
// evaluation template (created_by = 'system'), since no teacher email matches it.
$stmt = $conn->prepare("SELECT id FROM teacher_evaluations WHERE id = ? AND created_by = ?");
$stmt->bind_param("is", $id, $email);
$stmt->execute();
$evaluation = $stmt->get_result()->fetch_assoc();
$stmt->close();

if (!$evaluation) {
    echo json_encode(['success' => false, 'error' => 'Evaluation not found']);
    exit();
}

// Block delete if learners have already responded — same approach as
// assignments: the teacher must be told clearly why, rather than losing
// anonymous feedback data silently.
$respCheck = $conn->prepare("SELECT COUNT(*) AS cnt FROM evaluation_responses WHERE evaluation_id = ?");
$respCheck->bind_param("i", $id);
$respCheck->execute();
$respCount = (int)$respCheck->get_result()->fetch_assoc()['cnt'];
$respCheck->close();

if ($respCount > 0) {
    echo json_encode([
        'success' => false,
        'error'   => 'This evaluation can\'t be deleted because ' . $respCount . ' learner' . ($respCount === 1 ? ' has' : 's have') . ' already responded to it.'
    ]);
    exit();
}

// Safe to delete — no responses means no evaluation_answers either (those
// hang off responses, not statements, so there's nothing there to clean up).
// Remove the evaluation's own statements first, then the evaluation row.
$delStatements = $conn->prepare("DELETE FROM evaluation_statements WHERE evaluation_id = ?");
$delStatements->bind_param("i", $id);
$delStatements->execute();
$delStatements->close();

$del = $conn->prepare("DELETE FROM teacher_evaluations WHERE id = ? AND created_by = ?");
$del->bind_param("is", $id, $email);
$del->execute();
$del->close();

echo json_encode(['success' => true]);
