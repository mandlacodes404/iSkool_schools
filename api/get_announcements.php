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

$classStmt = $conn->prepare("SELECT class_id FROM class_students WHERE student_email = ? AND academic_year_id = ? LIMIT 1");
$classStmt->bind_param("si", $email, $current_academic_year_id);
$classStmt->execute();
$classResult = $classStmt->get_result();

if ($classResult->num_rows === 0) {
    echo json_encode([]);
    exit();
}
$classId = (int)$classResult->fetch_assoc()['class_id'];
$classStmt->close();

$stmt = $conn->prepare("
    SELECT 
        a.title AS announcement_title,
        a.message, 
        a.created_at, 
        CONCAT(COALESCE(u.title,''), ' ', COALESCE(u.surname,'Teacher')) AS teacher_display
    FROM announcements a
    LEFT JOIN users u ON a.created_by = u.email AND u.role = 'teacher'
    WHERE a.class_id = ? 
      AND a.academic_year_id = ?
      AND a.send_to = 'learners'
    ORDER BY a.created_at DESC
");
$stmt->bind_param("ii", $classId, $current_academic_year_id);
$stmt->execute();
$announcements = $stmt->get_result();

$groupedAnnouncements = [];
while ($row = $announcements->fetch_assoc()) {
    $teacher = trim($row['teacher_display']);
    $teacher = $teacher === '' ? 'Unknown Teacher' : $teacher;
    $groupedAnnouncements[$teacher][] = $row;
}
$stmt->close();

echo json_encode($groupedAnnouncements);
?>