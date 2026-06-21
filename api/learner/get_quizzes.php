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
// Two student email params are used by the latest-attempt derived table and join.
$types = 'ss' . str_repeat('i', count($joinedClassIds)) . 'i';

$stmt = $conn->prepare("
    SELECT 
        q.id,
        q.title AS quiz_title,
        q.duration,
        q.start_time,
        q.status AS quiz_db_status,
        q.publish_marks,
        q.is_summative,
        COALESCE(ts.subject_name, CONCAT(COALESCE(u.title,''), ' ', COALESCE(u.surname,'Teacher'))) AS display_group,
        TRIM(CONCAT(COALESCE(u.title,''), ' ', COALESCE(u.surname,'Teacher'))) AS teacher_display,
        qa.status AS attempt_status,
        COALESCE(qq.question_count, 0) AS question_count,
        COALESCE(qq.total_points, 0)   AS total_points
    FROM quizzes q
    LEFT JOIN users u ON q.created_by = u.email AND u.role = 'teacher'
    LEFT JOIN teacher_subjects ts ON ts.teacher_email = q.created_by AND ts.class_id = q.class_id
    LEFT JOIN (
        SELECT qa1.quiz_id, qa1.user_email, qa1.status
        FROM quiz_attempts qa1
        INNER JOIN (
            SELECT quiz_id, user_email, MAX(attempt_id) AS latest_attempt_id
            FROM quiz_attempts
            WHERE user_email = ?
            GROUP BY quiz_id, user_email
        ) latest ON latest.latest_attempt_id = qa1.attempt_id
    ) qa ON qa.quiz_id = q.id AND qa.user_email = ?
    LEFT JOIN (
        SELECT quiz_id,
               COUNT(*) AS question_count,
               SUM(points) AS total_points
        FROM quizquestions
        GROUP BY quiz_id
    ) qq ON qq.quiz_id = q.id
    WHERE q.class_id IN ($placeholders)
      AND q.academic_year_id = ?
    ORDER BY display_group ASC, q.start_time DESC
");

// Merge parameters: email twice, then class IDs, then Academic Year ID
$bind_params = array_merge([$studentEmail, $studentEmail], $joinedClassIds, [$current_academic_year_id]);
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
        'publish_marks'  => (int)($row['publish_marks'] ?? 0),
        'is_summative'   => !empty($row['is_summative']),
        'teacher'        => trim($row['teacher_display'] ?? '') ?: 'Unknown Teacher',
        'attempt_status'  => $row['attempt_status'],
        'question_count'  => (int)$row['question_count'],
        'total_points'    => (int)$row['total_points'],
        'current_time'    => $currentTime
    ];
}

echo json_encode($groupedQuizzes);
