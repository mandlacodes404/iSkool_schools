<?php
session_start();
require_once dirname(__DIR__, 2) . '/config.php';

header('Content-Type: application/json');

if (!isset($_SESSION['email']) || $_SESSION['role'] !== 'teacher') {
    echo json_encode(['error' => 'Unauthorized']);
    exit();
}

$quiz_id = (int)($_GET['quiz_id'] ?? 0);
if ($quiz_id <= 0) {
    echo json_encode(['error' => 'Invalid quiz ID']);
    exit();
}

// Verify ownership
$titleStmt = $conn->prepare("SELECT title FROM quizzes WHERE id = ? AND created_by = ?");
$titleStmt->bind_param("is", $quiz_id, $_SESSION['email']);
$titleStmt->execute();
$quiz = $titleStmt->get_result()->fetch_assoc();
$titleStmt->close();

if (!$quiz) {
    echo json_encode(['error' => 'Quiz not found']);
    exit();
}

$stmt = $conn->prepare("
    SELECT qr.id AS result_id,
           u.name AS student_name,
           u.surname AS student_surname,
           qr.score, qr.total, qr.time_taken, qr.submitted_at
    FROM quiz_results qr
    JOIN users u ON qr.user_email = u.email
    WHERE qr.quiz_id = ?
    ORDER BY qr.submitted_at DESC
");
$stmt->bind_param("i", $quiz_id);
$stmt->execute();
$rows = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
$stmt->close();

$results = [];
foreach ($rows as $row) {
    $minutes = floor($row['time_taken'] / 60);
    $secs    = $row['time_taken'] % 60;
    $results[] = [
        'result_id'    => $row['result_id'],
        'name'         => $row['student_name'] . ' ' . $row['student_surname'],
        'score'        => $row['score'],
        'total'        => $row['total'],
        'percentage'   => $row['total'] > 0
            ? number_format($row['score'] / $row['total'] * 100, 1) . '%'
            : 'N/A',
        'time_taken'   => "{$minutes}m {$secs}s",
        'submitted_at' => date('d M Y, g:i a', strtotime($row['submitted_at']))
    ];
}

echo json_encode([
    'quiz_id'    => $quiz_id,
    'quiz_title' => $quiz['title'],
    'results'    => $results
]);