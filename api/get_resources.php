<?php
header("Access-Control-Allow-Origin: http://localhost:3000");
header("Content-Type: application/json");

session_start();
require_once dirname(__DIR__) . '/config.php';

if (!isset($_SESSION['email']) || $_SESSION['role'] !== 'learner') {
    echo json_encode(["error" => "Unauthorized"]);
    exit();
}

$email = $_SESSION['email'];

$currentYearResult = $conn->query("SELECT id FROM academic_years WHERE is_current = 1 LIMIT 1");
if ($currentYearResult->num_rows === 0) {
    echo json_encode(["error" => "No active year"]);
    exit();
}
$current_academic_year_id = (int)$currentYearResult->fetch_assoc()['id'];

$classQuery = $conn->prepare("SELECT class_id FROM class_students WHERE student_email = ? AND academic_year_id = ? LIMIT 1");
$classQuery->bind_param("si", $email, $current_academic_year_id);
$classQuery->execute();
$classQuery->bind_result($classId);
$classQuery->fetch();
$classQuery->close();

if (!$classId) {
    echo json_encode(["message" => "You haven't joined a class yet."]);
    exit();
}

$stmt = $conn->prepare("
    SELECT 
        r.id, 
        r.title AS resource_title,
        r.filename, 
        r.uploaded_at,
        CONCAT(COALESCE(u.title,''), ' ', COALESCE(u.surname,'Teacher')) AS teacher_display
    FROM resources r
    LEFT JOIN users u ON r.uploaded_by = u.email AND u.role = 'teacher'
    WHERE r.class_id = ? AND r.academic_year_id = ?
    ORDER BY r.uploaded_at DESC, u.surname ASC
");
$stmt->bind_param("ii", $classId, $current_academic_year_id);
$stmt->execute();
$resources = $stmt->get_result();

$groupedResources = [];
while ($row = $resources->fetch_assoc()) {
    $teacher = trim($row['teacher_display']);
    $teacher = $teacher === '' ? 'Unknown Teacher' : $teacher;
    $groupedResources[$teacher][] = [
        'id' => $row['id'],
        'title' => $row['resource_title'],
        'filename' => $row['filename'],
        'uploaded_at' => $row['uploaded_at']
    ];
}
$stmt->close();

echo json_encode($groupedResources);
?>