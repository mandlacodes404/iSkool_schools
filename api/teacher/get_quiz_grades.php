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

// Get quiz title and class_id
$quizStmt = $conn->prepare("SELECT title, class_id FROM quizzes WHERE id = ?");
$quizStmt->bind_param("i", $quiz_id);
$quizStmt->execute();
$quiz = $quizStmt->get_result()->fetch_assoc();
$quizStmt->close();

if (!$quiz) {
    echo json_encode(['error' => 'Quiz not found']);
    exit();
}

// Get current academic year
$yearResult      = $conn->query("SELECT id FROM academic_years WHERE is_current = 1 LIMIT 1");
if ($yearResult->num_rows === 0) {
    $yearResult  = $conn->query("SELECT id FROM academic_years ORDER BY id DESC LIMIT 1");
}
$current_year_id = (int)$yearResult->fetch_assoc()['id'];

// Get all learners in the class with their scores
$stmt = $conn->prepare("
    SELECT u.name, u.surname, u.email,
           qr.score, qr.total
    FROM users u
    JOIN class_students cs ON cs.student_email = u.email
    LEFT JOIN quiz_results qr ON qr.user_email = u.email AND qr.quiz_id = ?
    WHERE cs.class_id = ?
      AND cs.academic_year_id = ?
      AND u.role = 'learner'
    ORDER BY u.surname ASC, u.name ASC
");
$stmt->bind_param("iii", $quiz_id, $quiz['class_id'], $current_year_id);
$stmt->execute();
$rows = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
$stmt->close();

$learners = [];
foreach ($rows as $row) {
    $score      = $row['score'] ?? null;
    $total      = $row['total'] ?? null;
    $percentage = ($score !== null && $total > 0)
        ? number_format($score / $total * 100, 1) . '%'
        : null;

    $learners[] = [
        'name'       => $row['name'] . ' ' . $row['surname'],
        'email'      => $row['email'],
        'score'      => $score,
        'total'      => $total,
        'percentage' => $percentage
    ];
}

echo json_encode([
    'quiz_id'    => $quiz_id,
    'quiz_title' => $quiz['title'],
    'learners'   => $learners
]);