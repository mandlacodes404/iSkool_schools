<?php
session_start();
require_once 'config.php';

// Only log if the user is a learner and logged in
if (!isset($_SESSION['email']) || $_SESSION['role'] !== 'learner') {
    http_response_code(403);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $quiz_id = intval($_POST['quiz_id'] ?? 0);
    $event_type = $_POST['event_type'] ?? 'tab_hidden';
    $user_email = $_SESSION['email'];

    if ($quiz_id > 0) {
        $stmt = $conn->prepare("INSERT INTO quiz_integrity_logs (quiz_id, user_email, event_type) VALUES (?, ?, ?)");
        $stmt->bind_param("iss", $quiz_id, $user_email, $event_type);
        
        if (!$stmt->execute()) {
            error_log("Integrity Log Error: " . $stmt->error);
        }
        $stmt->close();
    }
}
?>