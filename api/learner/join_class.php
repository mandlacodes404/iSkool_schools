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

$classCheck = $conn->prepare("SELECT 1 FROM classes WHERE id = ? LIMIT 1");
$classCheck->bind_param("i", $classId);
$classCheck->execute();
if ($classCheck->get_result()->num_rows === 0) {
    echo json_encode(["success" => false, "error" => "Class not found."]);
    exit();
}
$classCheck->close();

if ($currentYearId <= 0) {
    echo json_encode(["success" => false, "error" => "No active academic year."]);
    exit();
}

// Learners have one active class at a time. A different class requires a
// school-side transfer rather than silently replacing their enrolment.
$check = $conn->prepare("SELECT class_id FROM class_students WHERE student_email = ? AND academic_year_id = ? LIMIT 1");
$check->bind_param("si", $learnerEmail, $currentYearId);
$check->execute();
$existing = $check->get_result()->fetch_assoc();
$check->close();

if ($existing && (int)$existing['class_id'] === $classId) {
    echo json_encode(["success" => true]); // already joined
    exit();
}
if ($existing) {
    echo json_encode(["success" => false, "error" => "You are already enrolled in a class for this academic year."]);
    exit();
}

$insert = $conn->prepare("INSERT INTO class_students (student_email, class_id, academic_year_id) VALUES (?, ?, ?)");
$insert->bind_param("sii", $learnerEmail, $classId, $currentYearId);

$success = $insert->execute();
if (!$success && $conn->errno === 1062) {
    // Another request may have joined the same class between the read and the
    // insert. Treat only that exact race as idempotent.
    $raceCheck = $conn->prepare("SELECT class_id FROM class_students WHERE student_email = ? AND academic_year_id = ? LIMIT 1");
    $raceCheck->bind_param("si", $learnerEmail, $currentYearId);
    $raceCheck->execute();
    $raceRow = $raceCheck->get_result()->fetch_assoc();
    $raceCheck->close();
    $success = $raceRow && (int)$raceRow['class_id'] === $classId;
}
echo json_encode($success
    ? ["success" => true]
    : ["success" => false, "error" => "You are already enrolled in a class for this academic year."]
);
?>
