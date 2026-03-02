<?php
session_start();
require_once dirname(__DIR__, 2) . '/config.php';

header('Content-Type: application/json');

if (!isset($_SESSION['email']) || $_SESSION['role'] !== 'learner') {
    echo json_encode(['error' => 'Unauthorized']);
    exit();
}

$learner_email = $_SESSION['email'];

// 1. Get current active academic year
$currentYearResult = $conn->query("SELECT id FROM academic_years WHERE is_current = 1 LIMIT 1");
$current_year_id = ($currentYearResult->num_rows > 0) ? (int)$currentYearResult->fetch_assoc()['id'] : 0;

// 2. Get learner's class ID
$classQuery = $conn->prepare("SELECT class_id FROM class_students WHERE student_email = ? AND academic_year_id = ? LIMIT 1");
$classQuery->bind_param("si", $learner_email, $current_year_id);
$classQuery->execute();
$class_id = $classQuery->get_result()->fetch_assoc()['class_id'] ?? null;
$classQuery->close();

if (!$class_id) {
    echo json_encode([]);
    exit();
}

// 3. Fetch discussions with reply counts in a single query
$stmt = $conn->prepare("
    SELECT 
        d.id, 
        d.title, 
        d.initial_message, 
        d.created_at,
        CASE WHEN d.creator_anonymous = 1 THEN 'A classmate' ELSE COALESCE(u.name, 'Learner') END AS creator_display,
        (SELECT COUNT(*) FROM discussion_replies WHERE discussion_id = d.id) AS reply_count
    FROM class_discussions d
    LEFT JOIN users u ON d.creator_email = u.email
    WHERE d.class_id = ? 
      AND d.academic_year_id = ?
    ORDER BY d.created_at DESC
");

$stmt->bind_param("ii", $class_id, $current_year_id);
$stmt->execute();
$result = $stmt->get_result();

$discussions = [];
while ($row = $result->fetch_assoc()) {
    $row['display_date'] = date('M j, Y', strtotime($row['created_at']));
    // Snip message for preview
    $row['preview'] = (strlen($row['initial_message']) > 150) 
        ? substr($row['initial_message'], 0, 150) . '...' 
        : $row['initial_message'];
    $discussions[] = $row;
}

echo json_encode($discussions);