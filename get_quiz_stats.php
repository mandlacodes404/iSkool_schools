<?php
session_start();
require_once 'config.php';

if (!isset($_SESSION['email']) || !isset($_GET['quiz_id'])) {
    echo json_encode(['error' => 'Unauthorized']);
    exit();
}

$quiz_id = (int)$_GET['quiz_id'];
$user_email = $_SESSION['email'];

// 1. Get the user's specific score for the circle
$userStmt = $conn->prepare("SELECT score, total FROM quiz_results WHERE quiz_id = ? AND user_email = ? LIMIT 1");
$userStmt->bind_param("is", $quiz_id, $user_email);
$userStmt->execute();
$userRes = $userStmt->get_result()->fetch_assoc();

if (!$userRes) {
    echo json_encode(['error' => 'No result found']);
    exit();
}

$userPercent = round(($userRes['score'] / $userRes['total']) * 100);
$scoreDisplay = $userRes['score'] . " / " . $userRes['total'];

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