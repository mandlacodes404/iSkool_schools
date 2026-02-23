<?php
session_start();
require_once dirname(__DIR__, 2) . '/config.php';

header('Content-Type: application/json');

if (!isset($_SESSION['email']) || $_SESSION['role'] !== 'teacher') {
    echo json_encode(['success' => false, 'error' => 'Unauthorized']);
    exit();
}

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
    echo json_encode(['success' => false, 'error' => 'Please fill in all required fields.']);
    exit();
}

$insert = $conn->prepare("
    INSERT INTO quizzes 
    (title, class_id, created_by, is_summative, weight_percent, duration, publish_marks,
     academic_year_id, term_number, created_at, status)
    VALUES (?, ?, ?, ?, ?, 0, 0, ?, ?, NOW(), 'Closed')
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
    echo json_encode(['success' => true]);
} else {
    echo json_encode(['success' => false, 'error' => 'Failed to add quiz.']);
}
$insert->close();