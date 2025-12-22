<?php
header("Access-Control-Allow-Origin: http://localhost:3000");
header("Content-Type: application/json");

session_start();
require_once dirname(__DIR__) . '/config.php';

if (!isset($_SESSION['email']) || $_SESSION['role'] !== 'learner') {
    echo json_encode(["error" => "Unauthorized"]);
    exit();
}

$studentEmail = $_SESSION['email'];

// Get current academic year
$currentYearResult = $conn->query("SELECT id FROM academic_years WHERE is_current = 1 LIMIT 1");
if ($currentYearResult->num_rows === 0) {
    echo json_encode(["error" => "No active year"]);
    exit();
}
$current_academic_year_id = (int)$currentYearResult->fetch_assoc()['id'];

// Get joined classes
$stmt = $conn->prepare("
    SELECT DISTINCT class_id 
    FROM class_students 
    WHERE student_email = ? 
      AND academic_year_id = ?
");
$stmt->bind_param("si", $studentEmail, $current_academic_year_id);
$stmt->execute();
$result = $stmt->get_result();
$joinedClassIds = [];
while ($row = $result->fetch_assoc()) {
    $joinedClassIds[] = (int)$row['class_id'];
}
$stmt->close();

if (empty($joinedClassIds)) {
    echo json_encode([]);
    exit();
}

// Fetch assignments
$placeholders = implode(',', array_fill(0, count($joinedClassIds), '?'));
$types = str_repeat('i', count($joinedClassIds)) . 'i';

$sql = "
    SELECT 
        a.id,
        a.title AS assignment_title,
        a.description,
        a.due_date,
        a.file_url,
        c.name AS class_name,
        CONCAT(COALESCE(u.title,''), ' ', COALESCE(u.surname,'Teacher')) AS teacher_display
    FROM assignments a
    JOIN classes c ON a.class_id = c.id
    LEFT JOIN users u ON a.created_by = u.email AND u.role = 'teacher'
    WHERE a.class_id IN ($placeholders)
      AND a.academic_year_id = ?
    ORDER BY a.due_date ASC, u.surname ASC
";

$stmt = $conn->prepare($sql);
$bind_params = $joinedClassIds;
$bind_params[] = $current_academic_year_id;
$stmt->bind_param($types, ...$bind_params);
$stmt->execute();
$assignments = $stmt->get_result();
$stmt->close();

// Group by teacher
$groupedAssignments = [];
while ($row = $assignments->fetch_assoc()) {
    $teacher = trim($row['teacher_display']);
    if (empty($teacher)) $teacher = 'Unknown Teacher';
    $groupedAssignments[$teacher][] = $row;
}

echo json_encode($groupedAssignments);
?>