<?php
session_start();
require_once 'config.php';

// Set header to JSON so the JavaScript can read the response easily
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_SESSION['email'])) {
    $email = $_SESSION['email'];
    $quizId = intval($_POST['quiz_id']);
    $questionId = intval($_POST['question_id']);
    $choiceId = intval($_POST['choice_id']);

    // Added 'updated_at' if you have that column, otherwise the original query is fine
    $stmt = $conn->prepare("
        INSERT INTO user_answers (user_email, quiz_id, question_id, selected_choice_id) 
        VALUES (?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE selected_choice_id = VALUES(selected_choice_id)
    ");
    
    $stmt->bind_param("siii", $email, $quizId, $questionId, $choiceId);
    
    if ($stmt->execute()) {
        echo json_encode(['status' => 'success']);
    } else {
        // Log error for the dev, but send a generic error to the client
        error_log("Save progress failed: " . $conn->error);
        echo json_encode(['status' => 'error', 'message' => 'Database update failed']);
    }
    $stmt->close();
    exit;
} else {
    echo json_encode(['status' => 'error', 'message' => 'Unauthorized or invalid request']);
}