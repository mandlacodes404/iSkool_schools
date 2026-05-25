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

$attempt_id = (int)($_POST['attempt_id'] ?? 0);
$question_id = (int)($_POST['question_id'] ?? 0);
$score_raw = $_POST['score'] ?? null;
$feedback = trim((string)($_POST['feedback'] ?? ''));
$teacher_email = $_SESSION['email'];

if ($attempt_id <= 0 || $question_id <= 0 || $score_raw === null || $score_raw === '') {
    echo json_encode(['status' => 'error', 'message' => 'Missing grading details.']);
    exit();
}

$score = filter_var($score_raw, FILTER_VALIDATE_FLOAT);
if ($score === false) {
    echo json_encode(['status' => 'error', 'message' => 'Score must be a valid number.']);
    exit();
}

try {
    $conn->begin_transaction();

    $verifyStmt = $conn->prepare("
        SELECT qa.quiz_id, qa.user_email, qq.points
        FROM quiz_attempts qa
        INNER JOIN quizzes q ON q.id = qa.quiz_id
        INNER JOIN quizquestions qq ON qq.id = ? AND qq.quiz_id = q.id
        WHERE qa.attempt_id = ?
          AND q.created_by = ?
          AND qq.question_type = 'open_ended'
        LIMIT 1
    ");
    $verifyStmt->bind_param("iis", $question_id, $attempt_id, $teacher_email);
    $verifyStmt->execute();
    $details = $verifyStmt->get_result()->fetch_assoc();
    $verifyStmt->close();

    if (!$details) {
        $conn->rollback();
        echo json_encode(['status' => 'error', 'message' => 'Open-ended answer not found.']);
        exit();
    }

    $max_points = (float)$details['points'];
    if ($score < 0 || $score > $max_points) {
        $conn->rollback();
        echo json_encode(['status' => 'error', 'message' => 'Score must be between 0 and ' . rtrim(rtrim(number_format($max_points, 2, '.', ''), '0'), '.') . '.']);
        exit();
    }

    $quiz_id = (int)$details['quiz_id'];
    $learner_email = $details['user_email'];

    $gradeStmt = $conn->prepare("
        INSERT INTO open_ended_grades (attempt_id, question_id, user_email, quiz_id, score, feedback, graded_by, graded_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
        ON DUPLICATE KEY UPDATE
            score = VALUES(score),
            feedback = VALUES(feedback),
            graded_by = VALUES(graded_by),
            graded_at = NOW()
    ");
    $gradeStmt->bind_param("iisidss", $attempt_id, $question_id, $learner_email, $quiz_id, $score, $feedback, $teacher_email);
    $gradeStmt->execute();
    $gradeStmt->close();

    $mcqStmt = $conn->prepare("
        SELECT COALESCE(SUM(qq.points), 0) AS mcq_score
        FROM user_answers ua
        INNER JOIN quizquestions qq ON qq.id = ua.question_id AND qq.question_type = 'mcq'
        INNER JOIN choices c ON c.id = ua.selected_choice_id
            AND c.question_id = qq.id
            AND c.is_correct = 1
        WHERE ua.attempt_id = ?
    ");
    $mcqStmt->bind_param("i", $attempt_id);
    $mcqStmt->execute();
    $mcq_score = (float)($mcqStmt->get_result()->fetch_assoc()['mcq_score'] ?? 0);
    $mcqStmt->close();

    $openStmt = $conn->prepare("SELECT COALESCE(SUM(score), 0) AS open_score FROM open_ended_grades WHERE attempt_id = ?");
    $openStmt->bind_param("i", $attempt_id);
    $openStmt->execute();
    $open_score = (float)($openStmt->get_result()->fetch_assoc()['open_score'] ?? 0);
    $openStmt->close();

    $updated_total = $mcq_score + $open_score;
    $resultStmt = $conn->prepare("UPDATE quiz_results SET score = ? WHERE attempt_id = ? AND quiz_id = ?");
    $resultStmt->bind_param("dii", $updated_total, $attempt_id, $quiz_id);
    $resultStmt->execute();
    $resultStmt->close();

    $conn->commit();

    echo json_encode([
        'status' => 'success',
        'data' => [
            'updated_total_score' => $updated_total,
            'score' => $score,
            'question_id' => $question_id,
            'attempt_id' => $attempt_id
        ]
    ]);
} catch (Throwable $e) {
    if ($conn->errno === 0) {
        // Keep rollback best-effort without exposing transaction state.
    }
    $conn->rollback();
    error_log('grade_open_ended error: ' . $e->getMessage());
    echo json_encode(['status' => 'error', 'message' => 'Unable to save open-ended grade.']);
}
