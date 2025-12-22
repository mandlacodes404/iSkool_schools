<?php
header("Access-Control-Allow-Origin: http://localhost:3000"); // Remove in production
header("Content-Type: application/json");

session_start();
require_once dirname(__DIR__) . '/config.php'; // Adjust if config is deeper

if (!isset($_SESSION['email'])) {
    echo json_encode(["error" => "Unauthorized"]);
    exit();
}

$viewerEmail = $_SESSION['email'];
$viewerRole = $_SESSION['role'] ?? '';
$targetEmail = $viewerEmail;

// Parent viewing linked learner
if ($viewerRole === 'parent' && isset($_GET['learner'])) {
    $requestedEmail = filter_var($_GET['learner'], FILTER_VALIDATE_EMAIL);
    if ($requestedEmail) {
        $stmt = $conn->prepare("SELECT 1 FROM parent_links WHERE parent_email = ? AND learner_email = ?");
        $stmt->bind_param("ss", $viewerEmail, $requestedEmail);
        $stmt->execute();
        if ($stmt->get_result()->num_rows === 1) {
            $targetEmail = $requestedEmail;
        }
        $stmt->close();
    }
}

// Get current academic year
$currentYearResult = $conn->query("SELECT id FROM academic_years WHERE is_current = 1 LIMIT 1");
if ($currentYearResult->num_rows === 0) {
    echo json_encode(["error" => "No active year"]);
    exit();
}
$current_academic_year_id = (int)$currentYearResult->fetch_assoc()['id'];

// Current term
$current_global_term = 4;
$termStmt = $conn->query("SELECT current_global_term FROM platform_settings LIMIT 1");
if ($termRow = $termStmt->fetch_assoc()) {
    $current_global_term = (int)$termRow['current_global_term'];
}

// View term
$view_term = isset($_GET['view_term']) && in_array($_GET['view_term'], [1,2,3,4]) ? (int)$_GET['view_term'] : $current_global_term;

$sql = "
    SELECT DISTINCT 
        r.id AS result_id, r.score, r.total, r.submitted_at, r.time_taken,
        q.id AS quiz_id, q.title AS quiz_title, q.duration, q.publish_marks,
        q.is_summative, q.weight_percent, q.term_number,
        COALESCE(ts.subject_name, CONCAT(COALESCE(u.title,''), ' ', COALESCE(u.surname,'Unknown'))) AS display_group
    FROM quiz_results r
    JOIN quizzes q ON r.quiz_id = q.id
    JOIN class_students cs ON q.class_id = cs.class_id AND cs.student_email = ? AND cs.academic_year_id = ?
    LEFT JOIN teacher_subjects ts ON ts.teacher_email = q.created_by AND ts.class_id = q.class_id
    LEFT JOIN users u ON q.created_by = u.email AND u.role = 'teacher'
    WHERE r.user_email = ? AND q.academic_year_id = ?
    ORDER BY display_group ASC, r.submitted_at DESC
";

$stmt = $conn->prepare($sql);
$stmt->bind_param("ssii", $targetEmail, $current_academic_year_id, $targetEmail, $current_academic_year_id);
$stmt->execute();
$result = $stmt->get_result();

$groupedResults = [];
while ($row = $result->fetch_assoc()) {
    $group = trim($row['display_group'] ?? 'Unknown Subject');
    $group = $group === '' ? 'Unknown Subject' : $group;
    $groupedResults[$group][] = $row;
}
$stmt->close();

echo json_encode([
    'groupedResults' => $groupedResults,
    'current_term' => $current_global_term,
    'view_term' => $view_term,
    'viewer_role' => $viewerRole,
    'target_email' => $targetEmail
]);
?>