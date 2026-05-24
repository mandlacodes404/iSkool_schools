<?php
header("Content-Type: application/json");

require_once __DIR__ . '/../../auth/session_guard.php';
require_once __DIR__ . '/../../auth/csrf_helper.php';
require_once dirname(__DIR__) . '/config.php';

if (!isset($_SESSION['email']) || $_SESSION['role'] !== 'learner') {
    echo json_encode(["success" => false]);
    exit();
}

verify_csrf_token();

$learnerEmail = $_SESSION['email'];
$classId = (int)$_POST['class_id'] ?? 0;

if ($classId <= 0) {
    echo json_encode(["success" => false]);
    exit();
}

$currentYearResult = $conn->query("SELECT id FROM academic_years WHERE is_current = 1 LIMIT 1");
$currentYearId = $currentYearResult->num_rows > 0 ? (int)$currentYearResult->fetch_assoc()['id'] : 0;

$check = $conn->prepare("SELECT 1 FROM class_students WHERE student_email = ? AND class_id = ?");
if ($currentYearId > 0) {
    $check->bind_param("sii", $learnerEmail, $classId, $currentYearId);
} else {
    $check->bind_param("si", $learnerEmail, $classId);
}
$check->execute();
if ($check->get_result()->num_rows > 0) {
    echo json_encode(["success" => true]); // already joined
    exit();
}

$insert = $currentYearId > 0 
    ? $conn->prepare("INSERT INTO class_students (student_email, class_id, academic_year_id) VALUES (?, ?, ?)")
    : $conn->prepare("INSERT INTO class_students (student_email, class_id) VALUES (?, ?)");

if ($currentYearId > 0) {
    $insert->bind_param("sii", $learnerEmail, $classId, $currentYearId);
} else {
    $insert->bind_param("si", $learnerEmail, $classId);
}

$success = $insert->execute();
echo json_encode(["success" => $success]);
?>