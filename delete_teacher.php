<?php
session_start();
require_once 'config.php';

// Only allow school admins
if (!isset($_SESSION['school_admin'])) {
    header("Location: index.php");
    exit();
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $userId = intval($_POST['user_id']);

    // Verify this is a teacher and not already deleted
    $stmtCheck = $conn->prepare("SELECT id FROM users WHERE id = ? AND role = 'teacher' AND is_deleted = 0");
    $stmtCheck->bind_param("i", $userId);
    $stmtCheck->execute();
    $stmtCheck->store_result();

    if ($stmtCheck->num_rows === 1) {
        // Soft delete by setting is_deleted = 1
        $stmtDelete = $conn->prepare("UPDATE users SET is_deleted = 1 WHERE id = ?");
        $stmtDelete->bind_param("i", $userId);
        if ($stmtDelete->execute()) {
            $_SESSION['success_message'] = "Teacher removed successfully.";
        } else {
            $_SESSION['error_message'] = "Failed to remove teacher. Please try again.";
        }
        $stmtDelete->close();
    } else {
        $_SESSION['error_message'] = "Teacher not found or already removed.";
    }
    $stmtCheck->close();
} else {
    $_SESSION['error_message'] = "Invalid request method.";
}

header("Location: manage_teachers.php");
exit();