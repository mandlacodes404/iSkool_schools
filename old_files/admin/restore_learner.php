<?php
session_start();
require_once 'config.php';

if (!isset($_SESSION['school_admin'])) {
    header("Location: index.php");
    exit();
}

if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['user_id'])) {
    $userId = intval($_POST['user_id']);

    // Restore the learner — safely targets only learners
    $stmt = $conn->prepare("UPDATE users SET is_deleted = 0 WHERE id = ? AND role = 'learner'");
    $stmt->bind_param("i", $userId);
    
    if ($stmt->execute()) {
        $_SESSION['success_message'] = "Learner restored successfully.";
    } else {
        $_SESSION['error_message'] = "Failed to restore learner.";
    }
    
    $stmt->close();
}

header("Location: deleted_learners.php");
exit();