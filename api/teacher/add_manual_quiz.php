<?php
require_once __DIR__ . '/../../auth/session_guard.php';
require_once __DIR__ . '/../../auth/csrf_helper.php';
require_once dirname(__DIR__, 2) . '/config.php';
require_once dirname(__DIR__, 2) . '/includes/teacher_class_access.php';

header('Content-Type: application/json');

if (!isset($_SESSION['email']) || $_SESSION['role'] !== 'teacher') {
    echo json_encode(['status' => 'error', 'message' => 'Unauthorized', 'success' => false, 'error' => 'Unauthorized']);
    exit();
}

verify_csrf_token();

$email = $_SESSION['email'];

$yearResult = $conn->query("SELECT id FROM academic_years WHERE is_current = 1 LIMIT 1");
if ($yearResult->num_rows === 0) {
    $yearResult = $conn->query("SELECT id FROM academic_years ORDER BY id DESC LIMIT 1");
}
$current_year_id = (int)$yearResult->fetch_assoc()['id'];

$termResult   = $conn->query("SELECT current_global_term FROM platform_settings LIMIT 1");
$current_term = $termResult ? (int)$termResult->fetch_assoc()['current_global_term'] : 1;

$title          = trim($_POST['title'] ?? '');
$class_id       = (int)($_POST['class_id'] ?? 0);
$is_summative   = isset($_POST['is_summative']) ? 1 : 0;
$weight_percent = $is_summative && !empty($_POST['weight_percent'])
    ? floatval($_POST['weight_percent'])
    : null;

if (empty($title) || $class_id <= 0) {
    echo json_encode(['status' => 'error', 'message' => 'Please fill in all required fields.', 'success' => false, 'error' => 'Please fill in all required fields.']);
    exit();
}

$classCheckStmt = $conn->prepare("SELECT id FROM classes WHERE id = ? LIMIT 1");
$classCheckStmt->bind_param("i", $class_id);
$classCheckStmt->execute();
$classExists = $classCheckStmt->get_result()->num_rows > 0;
$classCheckStmt->close();
if (!$classExists) {
    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => 'Invalid class selected.', 'success' => false, 'error' => 'Invalid class selected.']);
    exit();
}
if (!teacher_has_class_access($conn, $email, $class_id)) {
    http_response_code(403);
    echo json_encode(['status' => 'error', 'message' => 'You do not have access to this class.', 'success' => false, 'error' => 'You do not have access to this class.']);
    exit();
}

$insert = $conn->prepare("
    INSERT INTO quizzes 
    (title, class_id, created_by, is_summative, weight_percent, duration, publish_marks,
     is_manual, academic_year_id, term_number, created_at, status)
    VALUES (?, ?, ?, ?, ?, 0, 0, 1, ?, ?, NOW(), 'Closed')
");
$insert->bind_param(
    "sisidii",
    $title,
    $class_id,
    $email,
    $is_summative,
    $weight_percent,
    $current_year_id,
    $current_term
);

if ($insert->execute()) {
    echo json_encode(['status' => 'success', 'data' => ['created' => true], 'success' => true]);
} else {
    error_log("Manual quiz insert failed: " . $insert->error);
    echo json_encode(['status' => 'error', 'message' => 'An error occurred. Please try again.', 'success' => false, 'error' => 'An error occurred. Please try again.']);
}
$insert->close();
