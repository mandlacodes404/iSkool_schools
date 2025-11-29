<?php
session_start();
require_once 'config.php';

if (!isset($_SESSION['school_admin'])) {
    header("Location: index.php");
    exit();
}

if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['user_id'])) {
    $userId = intval($_POST['user_id']);

    // Set is_deleted back to 0
    $stmt = $conn->prepare("UPDATE users SET is_deleted = 0 WHERE id = ? AND role = 'user'");
    $stmt->bind_param("i", $userId);
    $stmt->execute();
}

header("Location: deleted_learners.php");
exit();
