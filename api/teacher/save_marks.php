<?php
require_once __DIR__ . '/../../auth/session_guard.php';
require_once __DIR__ . '/../../auth/csrf_helper.php';
require_once dirname(__DIR__, 2) . '/config.php';

header('Content-Type: application/json');

if (!isset($_SESSION['email']) || $_SESSION['role'] !== 'teacher') {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'Unauthorized']);
    exit();
}

verify_csrf_token();

$quiz_id = (int)($_POST['quiz_id'] ?? 0);
$result_id = (int)($_POST['result_id'] ?? 0);
$user_email = trim((string)($_POST['user_email'] ?? ''));
$score = filter_var($_POST['score'] ?? null, FILTER_VALIDATE_FLOAT);
$total = filter_var($_POST['total'] ?? null, FILTER_VALIDATE_FLOAT);

if ($quiz_id <= 0 || $user_email === '' || $score === false || $total === false || $score < 0 || $total <= 0 || $score > $total) {
    echo json_encode(['success' => false, 'error' => 'Score must be between 0 and the total.']);
    exit();
}

try {
    $conn->begin_transaction();

    $quizStmt = $conn->prepare(
        'SELECT id, class_id, academic_year_id, is_manual
         FROM quizzes WHERE id = ? AND created_by = ? LIMIT 1 FOR UPDATE'
    );
    $quizStmt->bind_param('is', $quiz_id, $_SESSION['email']);
    $quizStmt->execute();
    $quiz = $quizStmt->get_result()->fetch_assoc();
    $quizStmt->close();

    if (!$quiz) {
        throw new RuntimeException('Quiz not found.');
    }

    $class_id = (int)$quiz['class_id'];
    $academic_year_id = (int)$quiz['academic_year_id'];
    if ($class_id <= 0 || $academic_year_id <= 0) {
        throw new RuntimeException('Quiz has no valid class or academic year.');
    }

    $rosterStmt = $conn->prepare(
        'SELECT 1 FROM class_students
         WHERE student_email = ? AND class_id = ? AND academic_year_id = ? LIMIT 1'
    );
    $rosterStmt->bind_param('sii', $user_email, $class_id, $academic_year_id);
    $rosterStmt->execute();
    $isEnrolled = $rosterStmt->get_result()->num_rows === 1;
    $rosterStmt->close();
    if (!$isEnrolled) {
        throw new RuntimeException('Learner is not enrolled in this class for the quiz year.');
    }

    if ($result_id > 0) {
        // A normal result is identified by its immutable primary key. This
        // cannot rewrite a learner's other attempts at the same quiz.
        $resultCheckStmt = $conn->prepare(
            'SELECT id FROM quiz_results
             WHERE id = ? AND quiz_id = ? AND user_email = ? AND academic_year_id = ?
             LIMIT 1 FOR UPDATE'
        );
        $resultCheckStmt->bind_param('iisi', $result_id, $quiz_id, $user_email, $academic_year_id);
        $resultCheckStmt->execute();
        $resultExists = $resultCheckStmt->get_result()->num_rows === 1;
        $resultCheckStmt->close();
        if (!$resultExists) {
            throw new RuntimeException('Result not found for this learner and quiz.');
        }

        $resultStmt = $conn->prepare(
            'UPDATE quiz_results
             SET score = ?, total = ?, submitted_at = NOW()
             WHERE id = ? AND quiz_id = ? AND user_email = ? AND academic_year_id = ?'
        );
        $resultStmt->bind_param('ddiisi', $score, $total, $result_id, $quiz_id, $user_email, $academic_year_id);
        $resultStmt->execute();
        $resultStmt->close();
    } elseif ((int)$quiz['is_manual'] === 1) {
        // Only an explicitly manual assessment may create a result without an
        // attempt. uq_quiz_results_manual makes this idempotent.
        $resultStmt = $conn->prepare(
            'INSERT INTO quiz_results
                (user_email, quiz_id, score, total, time_taken, submitted_at, academic_year_id)
             VALUES (?, ?, ?, ?, 0, NOW(), ?)
             ON DUPLICATE KEY UPDATE
                score = VALUES(score), total = VALUES(total), submitted_at = NOW(),
                academic_year_id = VALUES(academic_year_id)'
        );
        $resultStmt->bind_param('sidii', $user_email, $quiz_id, $score, $total, $academic_year_id);
        $resultStmt->execute();
        $resultStmt->close();
    } else {
        throw new RuntimeException('Select a specific submitted attempt to edit its mark.');
    }

    $conn->commit();
    echo json_encode(['success' => true]);
} catch (Throwable $e) {
    $conn->rollback();
    error_log('save_marks failed: ' . $e->getMessage());
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
