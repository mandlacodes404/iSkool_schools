<?php
require_once __DIR__ . '/../../auth/session_guard.php';
require_once __DIR__ . '/../../auth/csrf_helper.php';
require_once dirname(__DIR__, 2) . '/config.php';

header('Content-Type: application/json');

if (!isset($_SESSION['email']) || $_SESSION['role'] !== 'teacher') {
    echo json_encode(['status' => 'error', 'message' => 'Unauthorized']);
    exit();
}

verify_csrf_token();

$input = json_decode(file_get_contents('php://input'), true);
$quiz_id = (int)($input['quiz_id'] ?? 0);

if ($quiz_id < 1) {
    echo json_encode(['status' => 'error', 'message' => 'Invalid quiz selected.']);
    exit();
}

$stmt = $conn->prepare("SELECT created_by FROM quizzes WHERE id = ? LIMIT 1");
$stmt->bind_param("i", $quiz_id);
$stmt->execute();
$quiz = $stmt->get_result()->fetch_assoc();
$stmt->close();

if (!$quiz || $quiz['created_by'] !== $_SESSION['email']) {
    echo json_encode(['status' => 'error', 'message' => 'You do not own this quiz.']);
    exit();
}

$attemptStmt = $conn->prepare("
    SELECT
        (SELECT COUNT(*) FROM quiz_attempts WHERE quiz_id = ?) AS attempts,
        (SELECT COUNT(*) FROM quiz_results WHERE quiz_id = ?) AS results
");
$attemptStmt->bind_param("ii", $quiz_id, $quiz_id);
$attemptStmt->execute();
$counts = $attemptStmt->get_result()->fetch_assoc();
$attemptStmt->close();

if ((int)$counts['attempts'] > 0 || (int)$counts['results'] > 0) {
    echo json_encode([
        'status' => 'error',
        'message' => 'This quiz has learner attempts or results and cannot be deleted. You can close it instead.'
    ]);
    exit();
}

$image_paths = [];
$question_ids = [];
$questionStmt = $conn->prepare("SELECT id, image_path FROM quizquestions WHERE quiz_id = ?");
$questionStmt->bind_param("i", $quiz_id);
$questionStmt->execute();
$questionResult = $questionStmt->get_result();
while ($row = $questionResult->fetch_assoc()) {
    $question_ids[] = (int)$row['id'];
    if (!empty($row['image_path'])) {
        $image_paths[] = $row['image_path'];
    }
}
$questionStmt->close();

try {
    $conn->begin_transaction();

    $deleteChoices = $conn->prepare("DELETE c FROM choices c INNER JOIN quizquestions q ON c.question_id = q.id WHERE q.quiz_id = ?");
    $deleteChoices->bind_param("i", $quiz_id);
    if (!$deleteChoices->execute()) {
        throw new RuntimeException("Choice delete failed: " . $deleteChoices->error);
    }
    $deleteChoices->close();

    $deleteQuestions = $conn->prepare("DELETE FROM quizquestions WHERE quiz_id = ?");
    $deleteQuestions->bind_param("i", $quiz_id);
    if (!$deleteQuestions->execute()) {
        throw new RuntimeException("Question delete failed: " . $deleteQuestions->error);
    }
    $deleteQuestions->close();

    $deleteIntegrity = $conn->prepare("DELETE FROM quiz_integrity_logs WHERE quiz_id = ?");
    $deleteIntegrity->bind_param("i", $quiz_id);
    if (!$deleteIntegrity->execute()) {
        throw new RuntimeException("Integrity delete failed: " . $deleteIntegrity->error);
    }
    $deleteIntegrity->close();

    $deleteAnswers = $conn->prepare("DELETE FROM user_answers WHERE quiz_id = ? OR question_id IN (SELECT id FROM quizquestions WHERE quiz_id = ?)");
    $deleteAnswers->bind_param("ii", $quiz_id, $quiz_id);
    if (!$deleteAnswers->execute()) {
        throw new RuntimeException("Answer delete failed: " . $deleteAnswers->error);
    }
    $deleteAnswers->close();

    if (!empty($question_ids)) {
        $placeholders = implode(',', array_fill(0, count($question_ids), '?'));
        $types = str_repeat('i', count($question_ids));
        $deleteLegacyAnswers = $conn->prepare("DELETE FROM user_answers WHERE question_id IN ($placeholders)");
        $deleteLegacyAnswers->bind_param($types, ...$question_ids);
        if (!$deleteLegacyAnswers->execute()) {
            throw new RuntimeException("Legacy answer delete failed: " . $deleteLegacyAnswers->error);
        }
        $deleteLegacyAnswers->close();
    }

    $deleteQuiz = $conn->prepare("DELETE FROM quizzes WHERE id = ? AND created_by = ?");
    $deleteQuiz->bind_param("is", $quiz_id, $_SESSION['email']);
    if (!$deleteQuiz->execute()) {
        throw new RuntimeException("Quiz delete failed: " . $deleteQuiz->error);
    }
    $deleteQuiz->close();

    $conn->commit();
} catch (Throwable $e) {
    $conn->rollback();
    error_log("Quiz delete failed: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => 'An error occurred. Please try again.']);
    exit();
}

foreach ($image_paths as $image_path) {
    $full_path = dirname(__DIR__, 2) . '/' . ltrim($image_path, '/\\');
    if (is_file($full_path) && strpos(realpath($full_path), realpath(dirname(__DIR__, 2))) === 0) {
        @unlink($full_path);
    }
}

echo json_encode(['status' => 'success', 'data' => ['deleted' => true]]);
