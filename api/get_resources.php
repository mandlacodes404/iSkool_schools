<?php
session_start();
require_once '../config.php';

header('Content-Type: application/json');

if (!isset($_SESSION['email']) || $_SESSION['role'] !== 'learner') {
    echo json_encode(['error' => 'Unauthorized']);
    exit();
}

$email = $_SESSION['email'];

// 1. Get current active academic year
$currentYearResult = $conn->query("SELECT id FROM academic_years WHERE is_current = 1 LIMIT 1");
$current_academic_year_id = ($currentYearResult->num_rows > 0) ? (int)$currentYearResult->fetch_assoc()['id'] : 0;

// 2. Get learner's class ID
$classQuery = $conn->prepare("
    SELECT class_id FROM class_students 
    WHERE student_email = ? AND academic_year_id = ? LIMIT 1
");
$classQuery->bind_param("si", $email, $current_academic_year_id);
$classQuery->execute();
$classQuery->bind_result($classId);
$classQuery->fetch();
$classQuery->close();

if (!$classId) {
    echo json_encode([]);
    exit();
}

// 3. Fetch resources
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
    ORDER BY r.uploaded_at DESC
");
$stmt->bind_param("ii", $classId, $current_academic_year_id);
$stmt->execute();
$result = $stmt->get_result();

$groupedResources = [];
while ($row = $result->fetch_assoc()) {
    $teacher = trim($row['teacher_display']) ?: 'Unknown Teacher';
    $fileExt = strtolower(pathinfo($row['filename'], PATHINFO_EXTENSION));
    
    $groupedResources[$teacher][] = [
        'id'          => $row['id'],
        'title'       => $row['resource_title'],
        'filename'    => $row['filename'],
        'uploaded_at' => date("F j, Y", strtotime($row['uploaded_at'])),
        'ext'         => $fileExt,
        'path'        => 'resources/' . rawurlencode($row['filename'])
    ];
}

echo json_encode($groupedResources);