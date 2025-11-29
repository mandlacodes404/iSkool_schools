<?php
session_start();
require_once 'config.php';

// Ensure user is logged in
$userId = $_SESSION['user_id'] ?? 0;
$schoolId = $_SESSION['school_id'] ?? 0;
if (!$userId || !$schoolId) exit('0');

// Get POST data safely
$achieverId = intval($_POST['achiever_id'] ?? 0);
$comment = trim($_POST['comment'] ?? '');
if ($achieverId <= 0 || $comment === '') exit('0');

// Check if achiever belongs to the same school
$stmt = $conn->prepare("SELECT id FROM top_achievers WHERE id=? AND school_id=?");
$stmt->bind_param("ii", $achieverId, $schoolId);
$stmt->execute();
$res = $stmt->get_result();
if ($res->num_rows === 0) exit('0'); // Achiever not found or wrong school
$stmt->close();

// Insert the comment
$stmt = $conn->prepare("INSERT INTO achiever_comments (achiever_id, user_id, comment) VALUES (?, ?, ?)");
$stmt->bind_param("iis", $achieverId, $userId, $comment);
$stmt->execute();
$stmt->close();

// Return updated comments count
$stmt = $conn->prepare("SELECT COUNT(*) AS cnt FROM achiever_comments WHERE achiever_id=?");
$stmt->bind_param("i", $achieverId);
$stmt->execute();
$res = $stmt->get_result()->fetch_assoc();
echo intval($res['cnt']);
$stmt->close();
?>
