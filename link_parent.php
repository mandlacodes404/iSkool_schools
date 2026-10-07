<?php
require_once __DIR__ . '/auth/session_guard.php';
require_once __DIR__ . '/auth/csrf_helper.php';
require_once 'config.php';

header('Content-Type: application/json');

if (!isset($_SESSION['email']) || $_SESSION['role'] !== 'learner') {
    echo json_encode(['success' => false, 'error' => 'Unauthorized']);
    exit;
}

verify_csrf_token();

$learnerEmail = $_SESSION['email'];
$parentEmail  = $_POST['parent_email'] ?? '';
$classId      = intval($_POST['class_id'] ?? 0);

if (!$parentEmail || !$classId) {
    echo json_encode(['success' => false, 'error' => 'Missing data']);
    exit;
}

// Verify the learner belongs to the submitted class.
$learnerClassStmt = $conn->prepare("
    SELECT 1
    FROM class_students
    WHERE class_id = ? AND student_email = ?
    LIMIT 1
");
$learnerClassStmt->bind_param('is', $classId, $learnerEmail);
$learnerClassStmt->execute();
if ($learnerClassStmt->get_result()->num_rows === 0) {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'Learner not in class']);
    exit;
}
$learnerClassStmt->close();

// Verify parent is in the same class
$chk = $conn->prepare("
    SELECT 1 FROM parent_classes pc
    JOIN users u ON pc.parent_email = u.email
    WHERE pc.class_id = ? AND pc.parent_email = ? AND u.role = 'parent'
");
$chk->bind_param('is', $classId, $parentEmail);
$chk->execute();
if ($chk->get_result()->num_rows === 0) {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'Parent not in class']);
    exit;
}
$chk->close();

// Insert or update link
$stmt = $conn->prepare("
    INSERT INTO parent_links (learner_email, parent_email, class_id)
    VALUES (?, ?, ?)
    ON DUPLICATE KEY UPDATE parent_email = VALUES(parent_email)
");
$stmt->bind_param('ssi', $learnerEmail, $parentEmail, $classId);

echo $stmt->execute()
    ? json_encode(['success' => true])
    : json_encode(['success' => false, 'error' => 'Database error']);

$stmt->close();
?>
