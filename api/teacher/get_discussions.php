<?php
ini_set('display_errors', 0);
ini_set('log_errors', 1);
error_reporting(E_ALL);

if (session_status() === PHP_SESSION_NONE) session_start();
ob_start();
header('Content-Type: application/json');
require_once 'config.php';

if (!isset($_SESSION['email']) || $_SESSION['role'] !== 'teacher') {
    echo json_encode(['error' => 'Unauthorized']);
    ob_end_flush(); exit();
}

$teacher_email = $_SESSION['email'];

// Current academic year
$current_academic_year_id = null;
$result = $conn->query("SELECT id FROM academic_years WHERE is_current = 1 LIMIT 1");
if ($row = $result->fetch_assoc()) {
    $current_academic_year_id = $row['id'];
}

if (!$current_academic_year_id) {
    echo json_encode(['error' => 'No active academic year']);
    ob_end_flush(); exit();
}

// ── Discussions tagged to this teacher ──
$stmt = $conn->prepare("
    SELECT d.*, c.name as class_name, COUNT(r.id) as reply_count
    FROM class_discussions d
    JOIN discussion_teachers dt ON d.id = dt.discussion_id
    JOIN classes c ON d.class_id = c.id
    LEFT JOIN discussion_replies r ON d.id = r.discussion_id
    WHERE dt.teacher_email = ? 
    AND d.academic_year_id = ? 
    GROUP BY d.id
    ORDER BY d.created_at DESC
");

// Check if prepare failed
if (!$stmt) {
    echo json_encode(['error' => 'Query prepare failed: ' . $conn->error]);
    ob_end_flush(); exit();
}

$stmt->bind_param("si", $teacher_email, $current_academic_year_id);

if (!$stmt->execute()) {
    echo json_encode(['error' => 'Query execute failed: ' . $stmt->error]);
    ob_end_flush(); exit();
}

$rows = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
$stmt->close();

$discussions = [];
foreach ($rows as $d) {
    $discussions[] = [
        'id'          => $d['id'],
        'title'       => $d['title'],
        'class_name'  => $d['class_name'],
        'reply_count' => (int)$d['reply_count'],
        'created_at'  => date('M j, Y', strtotime($d['created_at']))
    ];
}

// ── Reports ──
$rptStmt = $conn->prepare("
    SELECT dr.*, d.title, r.message as reply_text, u.name as reporter_name
    FROM discussion_reports dr
    LEFT JOIN class_discussions d ON dr.discussion_id = d.id
    LEFT JOIN discussion_replies r ON dr.reply_id = r.id
    LEFT JOIN users u ON dr.reporter_email = u.email
    WHERE d.academic_year_id = ? 
    AND d.id IN (SELECT discussion_id FROM discussion_teachers WHERE teacher_email = ?)
    ORDER BY dr.reported_at DESC
");

// Check if prepare failed
if (!$rptStmt) {
    echo json_encode(['error' => 'Reports query prepare failed: ' . $conn->error]);
    ob_end_flush(); exit();
}

$rptStmt->bind_param("is", $current_academic_year_id, $teacher_email);

if (!$rptStmt->execute()) {
    echo json_encode(['error' => 'Reports query execute failed: ' . $rptStmt->error]);
    ob_end_flush(); exit();
}

$rptRows = $rptStmt->get_result()->fetch_all(MYSQLI_ASSOC);
$rptStmt->close();

$reports = [];
foreach ($rptRows as $rep) {
    $reports[] = [
        'reason'        => ucfirst(str_replace('_', ' ', $rep['reason'])),
        'reporter_name' => $rep['reporter_name'] ?? 'Learner',
        'reply_text'    => $rep['reply_text'] ?? null,
        'title'         => $rep['title'] ?? null,
        'comment'       => $rep['comment'] ?? null
    ];
}

echo json_encode([
    'discussions' => $discussions,
    'reports'     => $reports
]);
ob_end_flush();
?>