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
    echo json_encode(['success' => false, 'error' => 'Invalid assignment ID']);
    exit();
}

// Ownership check — created_by is the reliable field (teacher_id is not
// populated correctly in the data), same pattern as resources/announcements.
$stmt = $conn->prepare("SELECT file_url FROM assignments WHERE id = ? AND created_by = ?");
$stmt->bind_param("is", $id, $email);
$stmt->execute();
$assignment = $stmt->get_result()->fetch_assoc();
$stmt->close();

if (!$assignment) {
    echo json_encode(['success' => false, 'error' => 'Assignment not found']);
    exit();
}

// Block delete if learners have already submitted — teacher must be told
// clearly why, rather than the delete silently failing or removing work.
$subCheck = $conn->prepare("SELECT COUNT(*) AS cnt FROM submissions WHERE assignment_id = ?");
$subCheck->bind_param("i", $id);
$subCheck->execute();
$subCount = (int)$subCheck->get_result()->fetch_assoc()['cnt'];
$subCheck->close();

if ($subCount > 0) {
    echo json_encode([
        'success' => false,
        'error'   => 'This assignment can\'t be deleted because ' . $subCount . ' learner' . ($subCount === 1 ? ' has' : 's have') . ' already submitted work for it.'
    ]);
    exit();
}

// Safe to delete — remove the assignment's own attachment file, if any.
if (!empty($assignment['file_url'])) {
    $filePath = dirname(__DIR__, 2) . '/uploads/' . $assignment['file_url'];
    if (file_exists($filePath)) {
        unlink($filePath);
    }
}

$del = $conn->prepare("DELETE FROM assignments WHERE id = ? AND created_by = ?");
$del->bind_param("is", $id, $email);
$del->execute();
$del->close();

echo json_encode(['success' => true]);
