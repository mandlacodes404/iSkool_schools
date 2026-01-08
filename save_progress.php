<?php
session_start();
require_once 'config.php';

if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_SESSION['email'])) {
    $email = $_SESSION['email'];
    $quizId = intval($_POST['quiz_id']);
    $questionId = intval($_POST['question_id']);
    $choiceId = intval($_POST['choice_id']);

    // This updates the choice if it exists, or inserts a new row if it doesn't
    $stmt = $conn->prepare("
        INSERT INTO user_answers (user_email, quiz_id, question_id, selected_choice_id) 
        VALUES (?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE selected_choice_id = VALUES(selected_choice_id)
    ");
    
    $stmt->bind_param("siii", $email, $quizId, $questionId, $choiceId);
    
    if ($stmt->execute()) {
        echo json_encode(['status' => 'success']);
    } else {
        echo json_encode(['status' => 'error', 'message' => $conn->error]);
    }
    exit;
}