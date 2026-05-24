<?php
header("Content-Type: application/json");

require_once __DIR__ . '/../../auth/session_guard.php';
require_once dirname(__DIR__, 2) . '/config.php';

if (!isset($_SESSION['email']) || $_SESSION['role'] !== 'learner') {
    echo json_encode(["error" => "Unauthorized"]);
    exit();
}

$studentEmail = $_SESSION['email'];

// Get current academic year
$currentYearResult = $conn->query("SELECT id FROM academic_years WHERE is_current = 1 LIMIT 1");
if ($currentYearResult->num_rows === 0) {
    echo json_encode(["error" => "No active academic year"]);
    exit();
}
$current_academic_year_id = (int)$currentYearResult->fetch_assoc()['id'];

// Step 1: Get joined classes
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

// Step 2: Fetch quizzes with Attempt Status (Match origin logic)
$placeholders = implode(',', array_fill(0, count($joinedClassIds), '?'));
// Added 's' at the start for studentEmail and 'i' at the end for academic_year_id
$types = 's' . str_repeat('i', count($joinedClassIds)) . 'i';

$stmt = $conn->prepare("
    SELECT 
        q.id,
        q.title AS quiz_title,
        q.duration,
        q.start_time,
        q.status AS quiz_db_status,
        q.is_summative,
        COALESCE(ts.subject_name, CONCAT(COALESCE(u.title,''), ' ', COALESCE(u.surname,'Teacher'))) AS display_group,
        qa.status AS attempt_status
    FROM quizzes q
    LEFT JOIN users u ON q.created_by = u.email AND u.role = 'teacher'
    LEFT JOIN teacher_subjects ts ON ts.teacher_email = q.created_by AND ts.class_id = q.class_id
    LEFT JOIN quiz_attempts qa ON qa.quiz_id = q.id AND qa.user_email = ?
    WHERE q.class_id IN ($placeholders)
      AND q.academic_year_id = ?
    ORDER BY display_group ASC, q.start_time DESC
");

// Merge parameters: Email first, then class IDs, then Academic Year ID
$bind_params = array_merge([$studentEmail], $joinedClassIds, [$current_academic_year_id]);
$stmt->bind_param($types, ...$bind_params);
$stmt->execute();
$quizzesResult = $stmt->get_result();
$stmt->close();

$groupedQuizzes = [];
$currentTime = date('Y-m-d H:i:s');

while ($row = $quizzesResult->fetch_assoc()) {
    $group = trim($row['display_group'] ?? 'Unknown Teacher');
    $group = ($group === '' || $group === 'Teacher') ? 'Unknown Teacher' : $group;

    $groupedQuizzes[$group][] = [
        'id'             => $row['id'],
        'title'          => $row['quiz_title'],
        'duration'       => $row['duration'],
        'start_time'     => $row['start_time'],
        'status'         => $row['quiz_db_status'] ?? 'Open',
        'is_summative'   => !empty($row['is_summative']),
        'attempt_status' => $row['attempt_status'], // Now included!
        'current_time'   => $currentTime
    ];
}

echo json_encode($groupedQuizzes);
