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
$stmt = $conn->prepare("SELECT title, duration, attempt_limit, layout_mode, class_id, academic_year_id FROM quizzes WHERE id = ?");
$stmt->bind_param("i", $quizId);
$stmt->execute();
$quiz = $stmt->get_result()->fetch_assoc();
$stmt->close();

if (!$quiz) {
    echo json_encode(['error' => 'Quiz not found']);
    exit();
}

$quizTitle = $quiz['title'];
$duration = $quiz['duration'];
$attemptLimit = $quiz['attempt_limit'];
$layoutMode = $quiz['layout_mode'];
$classId = (int)$quiz['class_id'];
$academicYearId = (int)$quiz['academic_year_id'];

if ($academicYearId <= 0) {
    $currentYearResult = $conn->query("SELECT id FROM academic_years WHERE is_current = 1 LIMIT 1");
    if ($currentYearResult && $row = $currentYearResult->fetch_assoc()) {
        $academicYearId = (int)$row['id'];
    }
}

$memberStmt = $conn->prepare("
    SELECT 1
    FROM class_students
    WHERE student_email = ?
      AND class_id = ?
      AND academic_year_id = ?
    LIMIT 1
");
$memberStmt->bind_param("sii", $userEmail, $classId, $academicYearId);
$memberStmt->execute();
$isMember = $memberStmt->get_result()->num_rows > 0;
$memberStmt->close();
if (!$isMember) {
    echo json_encode(['error' => 'Unauthorized access']);
    exit();
}

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
