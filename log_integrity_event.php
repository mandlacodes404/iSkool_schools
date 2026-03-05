<?php
session_start();
require_once 'config.php';

if (!isset($_SESSION['email']) || $_SESSION['role'] !== 'learner') {
    http_response_code(403);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $quiz_id            = intval($_POST['quiz_id'] ?? 0);
    $event_type         = $_POST['event_type'] ?? 'unknown';
    $layout_mode        = $_POST['layout_mode'] ?? 'single_page';
    $active_question_id = !empty($_POST['active_question_id']) ? intval($_POST['active_question_id']) : null;
    $user_email         = $_SESSION['email'];

    // Only log meaningful event types
    $allowed_events = ['tab_switch', 'quiz_exit', 'rapid_navigation'];
    if (!in_array($event_type, $allowed_events)) {
        exit;
    }

    // Only log multi_page events (single_page tracking is imprecise)
    if ($layout_mode !== 'multi_page') {
        exit;
    }

    if ($quiz_id > 0) {
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