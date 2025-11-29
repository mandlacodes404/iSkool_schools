<?php
session_start();
require_once 'config.php';

// Ensure user is logged in
$userId = $_SESSION['user_id'] ?? 0;
$schoolId = $_SESSION['school_id'] ?? 0;
if (!$userId || !$schoolId) exit('0');

// Get POST data safely
$achieverId = intval($_POST['achiever_id'] ?? 0);
if ($achieverId <= 0) exit('0');

// Check if achiever belongs to the same school
$stmt = $conn->prepare("SELECT id FROM top_achievers WHERE id=? AND school_id=?");
$stmt->bind_param("ii", $achieverId, $schoolId);
$stmt->execute();
$res = $stmt->get_result();
if ($res->num_rows === 0) exit('0'); // Achiever not found or wrong school
$stmt->close();

// Check if user already liked this achiever
$stmt = $conn->prepare("SELECT id FROM achiever_likes WHERE achiever_id=? AND user_id=?");
$stmt->bind_param("ii", $achieverId, $userId);
$stmt->execute();
$res = $stmt->get_result();

if ($res->num_rows > 0) {
    // Already liked → remove like
    $likeId = $res->fetch_assoc()['id'];
    $stmt->close();
    $stmt = $conn->prepare("DELETE FROM achiever_likes WHERE id=?");
    $stmt->bind_param("i", $likeId);
    $stmt->execute();
    $stmt->close();
} else {
    // Not liked → insert like
    $stmt->close();
    $stmt = $conn->prepare("INSERT INTO achiever_likes (achiever_id, user_id) VALUES (?, ?)");
    $stmt->bind_param("ii", $achieverId, $userId);
    $stmt->execute();
    $stmt->close();
}

// Return updated likes count
$stmt = $conn->prepare("SELECT COUNT(*) AS cnt FROM achiever_likes WHERE achiever_id=?");
$stmt->bind_param("i", $achieverId);
$stmt->execute();
$res = $stmt->get_result()->fetch_assoc();
echo intval($res['cnt']);
$stmt->close();
?>
