<?php
session_start();
require_once '../config.php';

header('Content-Type: application/json');

$quizId = intval($_GET['quiz_id'] ?? 0);
$userEmail = $_SESSION['email'] ?? '';

// ... (Use the same SELECT logic from your original PHP file here) ...

echo json_encode([
    'title' => $quizTitle,
    'duration' => $duration,
    'attemptLimit' => $attemptLimit,
    'isContinuing' => ($attemptStatus === 'in_progress')
]);