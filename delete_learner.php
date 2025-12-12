<?php
session_start();
require_once 'config.php';

// Ensure only school_admin can perform this action
if (!isset($_SESSION['school_admin'])) {
    header("Location: index.php");
    exit();
}

if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['user_id'])) {
    $userId = intval($_POST['user_id']);

    // Perform soft delete — now correctly targets learners only
    $stmt = $conn->prepare("UPDATE users SET is_deleted = 1 WHERE id = ? AND role = 'learner'");
    $stmt->bind_param("i", $userId);

    if ($stmt->execute()) {
        $_SESSION['success_message'] = "Learner removed successfully.";
    } else {
        $_SESSION['error_message'] = "Failed to remove learner.";
    }

    $stmt->close();
}

// Redirect back to manage page
header("Location: manage_learners.php");
exit();