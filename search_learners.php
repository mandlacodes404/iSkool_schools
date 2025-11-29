<?php
include("config.php");

$term = $_GET['term'] ?? '';
$quizId = intval($_GET['quiz_id'] ?? 0);

if (empty($term) || !$quizId) {
    echo json_encode([]);
    exit();
}

// Get class_id for the quiz
$stmtQuiz = $conn->prepare("SELECT class_id FROM quizzes WHERE id = ?");
$stmtQuiz->bind_param("i", $quizId);
$stmtQuiz->execute();
$resultQuiz = $stmtQuiz->get_result();
if ($resultQuiz->num_rows === 0) {
    echo json_encode([]);
    exit();
}
$classId = $resultQuiz->fetch_assoc()['class_id'];
$stmtQuiz->close();

// Search learners by name
$stmt = $conn->prepare("
    SELECT u.name
    FROM users u
    JOIN class_students cs ON cs.student_email = u.email
    WHERE cs.class_id = ? AND u.role = 'user' AND u.name LIKE ?
    ORDER BY u.name ASC
    LIMIT 10
");
$like = '%' . $term . '%';
$stmt->bind_param("is", $classId, $like);
$stmt->execute();
$result = $stmt->get_result();

$names = [];
while ($row = $result->fetch_assoc()) {
    $names[] = $row['name'];
}
$stmt->close();

header('Content-Type: application/json');
echo json_encode($names);
?>