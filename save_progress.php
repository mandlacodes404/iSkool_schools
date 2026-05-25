<?php
require_once __DIR__ . '/auth/session_guard.php';
require_once __DIR__ . '/auth/csrf_helper.php';
require_once 'config.php';

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_SESSION['email']) && ($_SESSION['role'] ?? '') === 'learner') {
    verify_csrf_token();

    $email = $_SESSION['email'];
    $quizId = intval($_POST['quiz_id']);
    
    // We make these optional so the file can be used for JUST saving an answer 
    // or JUST updating the step/bookmark.
    $questionId = isset($_POST['question_id']) ? intval($_POST['question_id']) : null;
    $choiceId = isset($_POST['choice_id']) ? intval($_POST['choice_id']) : null;
    $answerText = isset($_POST['answer_text']) ? trim((string)$_POST['answer_text']) : null;
    $currentStep = isset($_POST['current_step']) ? intval($_POST['current_step']) : null;

    $accessStmt = $conn->prepare("
        SELECT 1
        FROM quizzes q
        JOIN class_students cs
         ON cs.class_id = q.class_id
         AND cs.academic_year_id = COALESCE(
             q.academic_year_id,
             (SELECT id FROM academic_years WHERE is_current = 1 LIMIT 1)
         )
         AND cs.student_email = ?
        WHERE q.id = ?
        LIMIT 1
    ");
    $accessStmt->bind_param("si", $email, $quizId);
    $accessStmt->execute();
    $hasAccess = $accessStmt->get_result()->num_rows > 0;
    $accessStmt->close();
    if (!$hasAccess) {
        echo json_encode(['status' => 'success']);
        exit;
    }

    $attemptStmt = $conn->prepare("
        SELECT attempt_id
        FROM quiz_attempts
        WHERE user_email = ?
          AND quiz_id = ?
          AND status = 'in_progress'
        ORDER BY attempt_number DESC, attempt_id DESC
        LIMIT 1
    ");
    $attemptStmt->bind_param("si", $email, $quizId);
    $attemptStmt->execute();
    $attempt = $attemptStmt->get_result()->fetch_assoc();
    $attemptStmt->close();
    if (!$attempt) {
        echo json_encode(['status' => 'success']);
        exit;
    }
    $attemptId = (int)$attempt['attempt_id'];

    $questionType = null;
    if ($questionId !== null) {
        $questionStmt = $conn->prepare("SELECT question_type FROM quizquestions WHERE id = ? AND quiz_id = ? LIMIT 1");
        $questionStmt->bind_param("ii", $questionId, $quizId);
        $questionStmt->execute();
        $questionRow = $questionStmt->get_result()->fetch_assoc();
        $questionStmt->close();
        if (!$questionRow) {
            echo json_encode(['status' => 'success']);
            exit;
        }
        $questionType = $questionRow['question_type'] ?? 'mcq';

        if ($questionType === 'open_ended') {
            if ($answerText !== null && strlen($answerText) > 5000) {
                $answerText = substr($answerText, 0, 5000);
            }
            $choiceId = null;
        } elseif ($choiceId !== null) {
            $validAnswerStmt = $conn->prepare("
                SELECT 1
                FROM choices
                WHERE question_id = ?
                  AND id = ?
                LIMIT 1
            ");
            $validAnswerStmt->bind_param("ii", $questionId, $choiceId);
            $validAnswerStmt->execute();
            $validAnswer = $validAnswerStmt->get_result()->num_rows > 0;
            $validAnswerStmt->close();
            if (!$validAnswer) {
                echo json_encode(['status' => 'success']);
                exit;
            }
            $answerText = null;
        }
    }

    $conn->begin_transaction();

    try {
        // 1. Save the Answer (if provided)
        if ($questionId !== null && ($choiceId !== null || $answerText !== null)) {
            $stmt = $conn->prepare("
                INSERT INTO user_answers (user_email, quiz_id, attempt_id, question_id, selected_choice_id, answer_text) 
                VALUES (?, ?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE selected_choice_id = VALUES(selected_choice_id), answer_text = VALUES(answer_text)
            ");
            $stmt->bind_param("siiiis", $email, $quizId, $attemptId, $questionId, $choiceId, $answerText);
            $stmt->execute();
            $stmt->close();
        }

        // 2. Update the Bookmark/Step (if provided)
        if ($currentStep !== null) {
            $stmtStep = $conn->prepare("
                UPDATE quiz_attempts 
                SET current_step = ? 
                WHERE attempt_id = ? AND status = 'in_progress'
            ");
            $stmtStep->bind_param("ii", $currentStep, $attemptId);
            $stmtStep->execute();
            $stmtStep->close();
        }

        $conn->commit();
        echo json_encode(['status' => 'success', 'debug_step' => $currentStep]);

    } catch (Exception $e) {
        $conn->rollback();
        error_log("Save progress failed: " . $e->getMessage());
        echo json_encode(['status' => 'error', 'message' => 'Database update failed']);
    }
    exit;
} else {
    echo json_encode(['status' => 'error', 'message' => 'Unauthorized or invalid request']);
}
