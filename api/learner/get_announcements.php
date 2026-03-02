<?php
session_start();
require_once dirname(__DIR__, 2) . '/config.php';

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

// 3. Fetch announcements
$stmt = $conn->prepare("
    SELECT 
        a.title,
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
$result = $stmt->get_result();

$groupedAnnouncements = [];
while ($row = $result->fetch_assoc()) {
    $teacher = trim($row['teacher_display']) ?: 'Unknown Teacher';
    
    $groupedAnnouncements[$teacher][] = [
        'title'      => $row['title'] ?? '(No Title)',
        'message'    => $row['message'] ?? '(No Message)',
        'created_at' => $row['created_at'],
        'display_date' => date('F j, Y, g:i a', strtotime($row['created_at']))
    ];
}

echo json_encode($groupedAnnouncements);