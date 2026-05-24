<?php
header("Content-Type: application/json");

require_once __DIR__ . '/../../auth/session_guard.php';
require_once dirname(__DIR__, 2) . '/config.php';

if (!isset($_SESSION['email']) || $_SESSION['role'] !== 'learner') {
    echo json_encode(["error" => "Unauthorized"]);
    exit();
}

$learnerEmail = $_SESSION['email'];

$currentYearResult = $conn->query("SELECT id FROM academic_years WHERE is_current = 1 LIMIT 1");
if ($currentYearResult->num_rows === 0) {
    echo json_encode(["error" => "No active year"]);
    exit();
}
$current_academic_year_id = (int)$currentYearResult->fetch_assoc()['id'];

$classStmt = $conn->prepare("SELECT DISTINCT class_id FROM class_students WHERE student_email = ? AND academic_year_id = ?");
$classStmt->bind_param("si", $learnerEmail, $current_academic_year_id);
$classStmt->execute();
$classResult = $classStmt->get_result();

$classIds = [];
while ($row = $classResult->fetch_assoc()) {
    $classIds[] = (int)$row['class_id'];
}
$classStmt->close();

if (empty($classIds)) {
    echo json_encode([]);
    exit();
}

$placeholders = implode(',', array_fill(0, count($classIds), '?'));
$types = str_repeat('i', count($classIds)) . 'i';

$stmt = $conn->prepare("
    SELECT 
        e.id,
        e.subject AS title,
        e.description,
        u.name AS teacher_name,
        c.name AS class_name
    FROM teacher_evaluations e
    JOIN users u ON e.teacher_id = u.id AND u.role = 'teacher'
    JOIN classes c ON e.class_id = c.id
    WHERE e.class_id IN ($placeholders)
      AND e.academic_year_id = ?
      AND e.released = 1
    ORDER BY e.created_at DESC
");

$bind_params = $classIds;
$bind_params[] = $current_academic_year_id;
$stmt->bind_param($types, ...$bind_params);
$stmt->execute();
$result = $stmt->get_result();

$evaluations = [];
while ($row = $result->fetch_assoc()) {
    // Check if already submitted
    $check = $conn->prepare("SELECT 1 FROM teacher_evaluation_responses WHERE evaluation_id = ? AND learner_email = ?");
    $check->bind_param("is", $row['id'], $learnerEmail);
    $check->execute();
    $hasSubmitted = $check->get_result()->num_rows > 0;
    $check->close();

    $evaluations[] = [
        'id' => $row['id'],
        'title' => $row['title'],
        'description' => $row['description'],
        'teacher_name' => $row['teacher_name'],
        'class_name' => $row['class_name'],
        'has_submitted' => $hasSubmitted
    ];
}
$stmt->close();

echo json_encode($evaluations);
?>
