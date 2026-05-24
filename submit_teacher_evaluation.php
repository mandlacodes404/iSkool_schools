<?php
require_once __DIR__ . '/auth/session_guard.php';
require_once __DIR__ . '/auth/csrf_helper.php';
require_once 'config.php';

if (!isset($_SESSION['email']) || $_SESSION['role'] !== 'user') {
    header("Location: index.php");
    exit();
}

$learnerEmail = $_SESSION['email'];

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    verify_csrf_token();

    $evaluation_id = intval($_POST['evaluation_id']);
    $rating = intval($_POST['rating']);
    $feedback = trim($_POST['feedback']);

    // Check if already submitted
    $check = $conn->prepare("SELECT id FROM teacher_evaluation_responses WHERE evaluation_id = ? AND learner_email = ?");
    $check->bind_param("is", $evaluation_id, $learnerEmail);
    $check->execute();
    $hasSubmitted = $check->get_result()->num_rows > 0;
    $check->close();

    if (!$hasSubmitted && $rating >= 1 && $rating <= 5) {
        $stmt = $conn->prepare("INSERT INTO teacher_evaluation_responses (evaluation_id, learner_email, rating, feedback) VALUES (?, ?, ?, ?)");
        $stmt->bind_param("isis", $evaluation_id, $learnerEmail, $rating, $feedback);
        $stmt->execute();
        $stmt->close();
    }
}

header("Location: take_teacher_evaluation.php");
exit();
