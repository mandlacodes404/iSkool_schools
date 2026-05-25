<?php
require_once __DIR__ . '/auth/session_guard.php';
require_once __DIR__ . '/auth/csrf_helper.php';
require_once 'config.php';

if (!isset($_SESSION['email']) || $_SESSION['role'] !== 'learner') {
    http_response_code(403);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    verify_csrf_token();

    $quiz_id            = intval($_POST['quiz_id'] ?? 0);
    $event_type         = $_POST['event_type'] ?? 'unknown';
    $layout_mode        = $_POST['layout_mode'] ?? 'single_page';
    $active_question_id = !empty($_POST['active_question_id']) ? intval($_POST['active_question_id']) : null;
    $user_email         = $_SESSION['email'];

    // Only log meaningful event types
    $allowed_events = ['tab_hidden', 'window_blur', 'tab_switch', 'quiz_exit', 'rapid_navigation'];
    if (!in_array($event_type, $allowed_events)) {
        exit;
    }

    // Only log multi_page events (single_page tracking is imprecise)
    if ($layout_mode !== 'multi_page') {
        exit;
    }

    if ($quiz_id > 0) {
        $attemptStmt = $conn->prepare("
            SELECT 1
            FROM quiz_attempts
            WHERE quiz_id = ?
              AND user_email = ?
              AND status = 'in_progress'
            LIMIT 1
        ");
        $attemptStmt->bind_param("is", $quiz_id, $user_email);
        $attemptStmt->execute();
        $hasActiveAttempt = $attemptStmt->get_result()->num_rows > 0;
        $attemptStmt->close();
        if (!$hasActiveAttempt) {
            exit;
        }

        if ($active_question_id !== null) {
            $questionStmt = $conn->prepare("SELECT 1 FROM quizquestions WHERE id = ? AND quiz_id = ? LIMIT 1");
            $questionStmt->bind_param("ii", $active_question_id, $quiz_id);
            $questionStmt->execute();
            $validQuestion = $questionStmt->get_result()->num_rows > 0;
            $questionStmt->close();
            if (!$validQuestion) {
                exit;
            }
        }

        $dupeStmt = $conn->prepare("
            SELECT 1
            FROM quiz_integrity_logs
            WHERE quiz_id = ?
              AND user_email = ?
              AND event_type = ?
              AND occurred_at > NOW() - INTERVAL 3 SECOND
            LIMIT 1
        ");
        $dupeStmt->bind_param("iss", $quiz_id, $user_email, $event_type);
        $dupeStmt->execute();
        $isDuplicate = $dupeStmt->get_result()->num_rows > 0;
        $dupeStmt->close();
        if ($isDuplicate) {
            exit;
        }

        $stmt = $conn->prepare("
            INSERT INTO quiz_integrity_logs 
            (quiz_id, user_email, event_type, layout_mode, active_question_id) 
            VALUES (?, ?, ?, ?, ?)
        ");
        $stmt->bind_param("isssi",
            $quiz_id,
            $user_email,
            $event_type,
            $layout_mode,
            $active_question_id
        );
        if (!$stmt->execute()) {
            error_log("Integrity Log Error: " . $stmt->error);
        }
        $stmt->close();
    }
}
?>
