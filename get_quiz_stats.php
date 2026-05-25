<?php
session_start();
require_once 'config.php';

if (!isset($_SESSION['email']) || !isset($_GET['quiz_id'])) {
    echo json_encode(['error' => 'Unauthorized']);
    exit();
}

$quiz_id = (int)$_GET['quiz_id'];
$user_email = $_SESSION['email'];
$role = $_SESSION['role'] ?? '';

if (!in_array($role, ['learner', 'teacher'], true)) {
    http_response_code(403);
    echo json_encode(['error' => 'Forbidden']);
    exit();
}

if ($role === 'teacher') {
    $accessStmt = $conn->prepare("SELECT 1 FROM quizzes WHERE id = ? AND created_by = ? LIMIT 1");
    $accessStmt->bind_param("is", $quiz_id, $user_email);
    $accessStmt->execute();
    $hasAccess = $accessStmt->get_result()->num_rows > 0;
    $accessStmt->close();
    if (!$hasAccess) {
        http_response_code(403);
        echo json_encode(['error' => 'Forbidden']);
        exit();
    }
    $userPercent = null;
    $scoreDisplay = '';
} else {
    $userStmt = $conn->prepare("
        SELECT r.score, r.total
        FROM quiz_results r
        JOIN quizzes q ON q.id = r.quiz_id
        WHERE r.quiz_id = ?
          AND r.user_email = ?
          AND q.publish_marks = 1
        LIMIT 1
    ");
    $userStmt->bind_param("is", $quiz_id, $user_email);
    $userStmt->execute();
    $userRes = $userStmt->get_result()->fetch_assoc();
    $userStmt->close();

    if (!$userRes) {
        http_response_code(403);
        echo json_encode(['error' => 'Forbidden']);
        exit();
    }

    $userPercent = round(($userRes['score'] / $userRes['total']) * 100);
    $scoreDisplay = $userRes['score'] . " / " . $userRes['total'];
}

// 2. Get Class Statistics (Min, Max, Avg)
// We calculate percentage for everyone first, then get the stats
$statsSql = "
    SELECT 
        MIN((score / total) * 100) as min_score,
        MAX((score / total) * 100) as max_score,
        AVG((score / total) * 100) as avg_score
    FROM quiz_results 
    WHERE quiz_id = ?
";

$statsStmt = $conn->prepare($statsSql);
$statsStmt->bind_param("i", $quiz_id);
$statsStmt->execute();
$statsRes = $statsStmt->get_result()->fetch_assoc();

echo json_encode([
    'user_score' => $userPercent,
    'score_out_of' => $scoreDisplay,
    'min' => round($statsRes['min_score'] ?? 0),
    'max' => round($statsRes['max_score'] ?? 0),
    'avg' => round($statsRes['avg_score'] ?? 0)
]);
