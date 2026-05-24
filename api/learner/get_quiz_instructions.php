<?php
require_once __DIR__ . '/../../auth/session_guard.php';
require_once dirname(__DIR__, 2) . '/config.php';

header('Content-Type: application/json');

// Check authorization
if (!isset($_SESSION['email']) || $_SESSION['role'] !== 'learner' || !isset($_GET['quiz_id'])) {
    echo json_encode(['error' => 'Unauthorized access']);
    exit();
}

$quizId = intval($_GET['quiz_id']);
$userEmail = $_SESSION['email'];

// 1. Fetch quiz info — now includes layout_mode
$stmt = $conn->prepare("SELECT title, duration, attempt_limit, layout_mode FROM quizzes WHERE id = ?");
$stmt->bind_param("i", $quizId);
$stmt->execute();
$stmt->bind_result($quizTitle, $duration, $attemptLimit, $layoutMode);
$stmt->fetch();
$stmt->close();

// 2. Check for existing attempt
$attemptStatus = '';
$stmt = $conn->prepare("SELECT status FROM quiz_attempts WHERE quiz_id = ? AND user_email = ? LIMIT 1");
$stmt->bind_param("is", $quizId, $userEmail);
$stmt->execute();
$stmt->bind_result($attemptStatus);
$stmt->fetch();
$stmt->close();

// 3. Mobile Detection
$user_agent = $_SERVER['HTTP_USER_AGENT'] ?? '';
$isMobile = preg_match("/(android|iphone|ipad|ipod|webos|windows phone|mobile)/i", $user_agent);

// 4. Return everything as JSON
echo json_encode([
    'title'        => $quizTitle,
    'duration'     => $duration,
    'attemptLimit' => $attemptLimit,
    'isContinuing' => ($attemptStatus === 'in_progress'),
    'isMobile'     => (bool)$isMobile,
    'layout_mode'  => $layoutMode ?? 'single_page',
]);
?>