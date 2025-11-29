<?php
session_start();
require_once 'config.php';

header('Content-Type: application/json');

if (!isset($_SESSION['email']) || $_SESSION['role'] !== 'user') {
    echo json_encode(['success' => false, 'message' => 'Not logged in']);
    exit;
}

$learnerEmail = $_SESSION['email'];

// Remove file from server if exists
$stmt = $conn->prepare("SELECT profile_picture FROM users WHERE email = ?");
$stmt->bind_param("s", $learnerEmail);
$stmt->execute();
$result = $stmt->get_result();
$profile = $result->fetch_assoc()['profile_picture'];
$stmt->close();

if ($profile && $profile !== 'default.png') {
    $filePath = "uploads/learners/" . $profile;
    if (file_exists($filePath)) unlink($filePath);
}

// Update DB
$stmt = $conn->prepare("UPDATE users SET profile_picture = 'default.png' WHERE email = ?");
$stmt->bind_param("s", $learnerEmail);
$stmt->execute();
$stmt->close();

echo json_encode(['success' => true]);
