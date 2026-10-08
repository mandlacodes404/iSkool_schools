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

if ($_SERVER['REQUEST_METHOD'] !== 'POST' || !isset($_POST['class_id'], $_POST['subject_name'])) {
    echo json_encode(['success' => false, 'message' => 'Invalid request']);
    exit();
}

$teacher_email = $_SESSION['email'];
$class_id      = (int)$_POST['class_id'];
$subject_name  = ucwords(strtolower(trim($_POST['subject_name'])));

if (empty($subject_name)) {
    echo json_encode(['success' => false, 'message' => 'Subject name cannot be empty']);
    exit();
}

// Teachers may link themselves to an existing class, but a tampered request
// must not create an orphaned teacher_subjects relationship.
$classStmt = $conn->prepare('SELECT 1 FROM classes WHERE id = ? LIMIT 1');
$classStmt->bind_param('i', $class_id);
$classStmt->execute();
$classExists = $classStmt->get_result()->num_rows === 1;
$classStmt->close();
if (!$classExists) {
    echo json_encode(['success' => false, 'message' => 'Class not found']);
    exit();
}

$stmt = $conn->prepare("
    INSERT INTO teacher_subjects (teacher_email, class_id, subject_name)
    VALUES (?, ?, ?)
    ON DUPLICATE KEY UPDATE subject_name = ?, updated_at = CURRENT_TIMESTAMP
");
$stmt->bind_param("siss", $teacher_email, $class_id, $subject_name, $subject_name);

if ($stmt->execute()) {
    echo json_encode(['success' => true, 'subject_name' => $subject_name]);
} else {
    echo json_encode(['success' => false, 'message' => 'Database error']);
}
$stmt->close();
