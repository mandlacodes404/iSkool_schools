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
    echo json_encode(['success' => false, 'error' => 'Invalid syllabus brief ID']);
    exit();
}

// created_by is the ownership check — same pattern as resources/announcements/assignments.
// subject_briefs has no child tables (topics/assessments are JSON columns on the row
// itself), so this is a clean single-row delete with no cascade concerns.
$del = $conn->prepare("DELETE FROM subject_briefs WHERE id = ? AND created_by = ?");
$del->bind_param("is", $id, $email);
$del->execute();

if ($del->affected_rows === 0) {
    $del->close();
    echo json_encode(['success' => false, 'error' => 'Syllabus brief not found']);
    exit();
}
$del->close();

echo json_encode(['success' => true]);
