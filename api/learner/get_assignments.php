<?php
header("Content-Type: application/json");
header("Access-Control-Allow-Origin: " . (isset($_SERVER['HTTPS']) ? "https" : "http") . "://" . $_SERVER['HTTP_HOST']);

session_start();
require_once dirname(__DIR__, 2) . '/config.php';

if (!isset($_SESSION['email']) || $_SESSION['role'] !== 'learner') {
    http_response_code(401);
    echo json_encode(["error" => "Unauthorized"]);
    exit();
}

$studentEmail = $_SESSION['email'];
$currentDateTime = date('Y-m-d H:i:s');

// 1. Get Academic Year
$yearRes = $conn->query("SELECT id FROM academic_years WHERE is_current = 1 LIMIT 1");
$current_academic_year_id = (int)$yearRes->fetch_assoc()['id'];

// 2. Get Assignments with Submission Status
$sql = "
    SELECT DISTINCT
        a.id, a.title, a.description, a.due_date, a.file_url,
        c.name AS class_name,
        CONCAT(COALESCE(u.title,''), ' ', COALESCE(u.surname,'Teacher')) AS teacher_display,
        s.file_url AS submission_url
    FROM assignments a
    JOIN classes c ON a.class_id = c.id
    JOIN class_students cs ON a.class_id = cs.class_id AND cs.academic_year_id = ?
    LEFT JOIN users u ON a.created_by = u.email
    LEFT JOIN submissions s ON a.id = s.assignment_id AND s.student_email = ?
    WHERE cs.student_email = ? 
      AND a.academic_year_id = ?
    ORDER BY a.due_date ASC
";

$stmt = $conn->prepare($sql);
// We now have 4 parameters: academic_year_id, student_email, student_email, academic_year_id
$stmt->bind_param("issi", $current_academic_year_id, $studentEmail, $studentEmail, $current_academic_year_id);
$stmt->execute();
$result = $stmt->get_result();

$grouped = [];
while ($row = $result->fetch_assoc()) {
    $isPastDue = (!empty($row['due_date']) && $row['due_date'] < $currentDateTime);
    
    $grouped[$row['teacher_display']][] = [
        'id' => $row['id'],
        'title' => $row['title'],
        'description' => $row['description'],
        'due_date' => $row['due_date'] ? date('M j, Y, g:i A', strtotime($row['due_date'])) : 'No Due Date',
        'is_past_due' => $isPastDue,
        'teacher_file' => $row['file_url'],
        'submission_file' => $row['submission_url'],
        'class_name' => $row['class_name']
    ];
}
echo json_encode($grouped);