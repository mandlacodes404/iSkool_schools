<?php
session_start();
require_once 'config.php';

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_SESSION['email'])) {
    $email = $_SESSION['email'];
    $quizId = intval($_POST['quiz_id']);
    
    // We make these optional so the file can be used for JUST saving an answer 
    // or JUST updating the step/bookmark.
    $questionId = isset($_POST['question_id']) ? intval($_POST['question_id']) : null;
    $choiceId = isset($_POST['choice_id']) ? intval($_POST['choice_id']) : null;
    $currentStep = isset($_POST['current_step']) ? intval($_POST['current_step']) : null;

    $conn->begin_transaction();

    try {
        // 1. Save the Answer (if provided)
        if ($questionId !== null && $choiceId !== null) {
            $stmt = $conn->prepare("
                INSERT INTO user_answers (user_email, quiz_id, question_id, selected_choice_id) 
                VALUES (?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE selected_choice_id = VALUES(selected_choice_id)
            ");
            $stmt->bind_param("siii", $email, $quizId, $questionId, $choiceId);
            $stmt->execute();
            $stmt->close();
        }

        // 2. Update the Bookmark/Step (if provided)
        if ($currentStep !== null) {
            $stmtStep = $conn->prepare("
                UPDATE quiz_attempts 
                SET current_step = ? 
                WHERE user_email = ? AND quiz_id = ? AND status = 'in_progress'
            ");
            $stmtStep->bind_param("isi", $currentStep, $email, $quizId);
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