<?php
session_start();
require_once 'config.php';

if (!isset($_SESSION['email']) || $_SESSION['role'] !== 'user') {
    header("Location: login.php");
    exit;
}

$learnerEmail = $_SESSION['email'];

// Fetch current profile picture
$stmt = $conn->prepare("SELECT profile_picture FROM users WHERE email = ?");
$stmt->bind_param("s", $learnerEmail);
$stmt->execute();
$result = $stmt->get_result();
$currentPicture = 'default.png';

if ($result->num_rows > 0) {
    $row = $result->fetch_assoc();
    $currentPicture = $row['profile_picture'] ?: 'default.png';
}
$stmt->close();

// Delete file if it's not the default
if ($currentPicture !== 'default.png') {
    $filePath = "uploads/learners/" . $currentPicture;
    if (file_exists($filePath)) {
        unlink($filePath);
    }
}

// Reset profile picture in DB
$stmt = $conn->prepare("UPDATE users SET profile_picture = 'default.png' WHERE email = ?");
$stmt->bind_param("s", $learnerEmail);
$stmt->execute();
$stmt->close();

// Redirect back to dashboard
header("Location: learner_dashboard.php");
exit;
?>

