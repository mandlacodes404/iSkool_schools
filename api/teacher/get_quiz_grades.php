<?php
require_once __DIR__ . '/../../auth/session_guard.php';
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

// A result inherits its academic year from its quiz. Never read the global
// current year here: teachers must be able to review historical assessments.
$quizStmt = $conn->prepare("SELECT title, class_id, academic_year_id, is_manual FROM quizzes WHERE id = ? AND created_by = ?");
$quizStmt->bind_param("is", $quiz_id, $_SESSION['email']);
$quizStmt->execute();
$quiz = $quizStmt->get_result()->fetch_assoc();
$quizStmt->close();

if (!$quiz) {
    http_response_code(403);
    echo json_encode(['error' => 'Quiz not found']);
    exit();
}

// Get all learners in the quiz-year roster with one explicit result identity.
// Manual assessments use their single no-attempt result; normal assessments
// expose the latest attempt only, and edits carry that exact result ID.
$stmt = $conn->prepare("
    SELECT u.name, u.surname, u.email,
           qr.id AS result_id, qr.score, qr.total
    FROM users u
    JOIN class_students cs ON cs.student_email = u.email
    LEFT JOIN quiz_results qr ON qr.id = (
        SELECT qri.id
        FROM quiz_results qri
        WHERE qri.user_email = u.email
          AND qri.quiz_id = ?
          AND qri.academic_year_id = ?
          AND (qri.attempt_id IS NULL OR ? = 0)
        ORDER BY qri.submitted_at DESC, qri.id DESC
        LIMIT 1
    )
    WHERE cs.class_id = ?
      AND cs.academic_year_id = ?
      AND u.role = 'learner'
    ORDER BY u.surname ASC, u.name ASC
");
$quiz_year_id = (int)$quiz['academic_year_id'];
$is_manual = (int)$quiz['is_manual'];
$stmt->bind_param("iiiii", $quiz_id, $quiz_year_id, $is_manual, $quiz['class_id'], $quiz_year_id);
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
        'result_id'  => $row['result_id'] !== null ? (int)$row['result_id'] : null,
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
