<?php
/**
 * iSkool School Dashboard — Soft Delete Learner
 */
ob_start();
error_reporting(E_ALL);
ini_set('display_errors', 0);
session_start();
require_once '../../config.php';

if (!isset($_SESSION['email']) || !in_array($_SESSION['role'], ['school_admin', 'admin'])) {
    http_response_code(403);
    echo json_encode(['error' => 'Unauthorized']);
    exit();
}

header('Content-Type: application/json');

$learnerId = (int)($_POST['learner_id'] ?? 0);
if (!$learnerId) { echo json_encode(['error' => 'Missing learner_id']); exit(); }

$stmt = $conn->prepare("UPDATE users SET is_deleted = 1 WHERE id = ? AND role = 'learner'");
$stmt->bind_param("i", $learnerId);
$stmt->execute();

if ($stmt->affected_rows > 0) {
    echo json_encode(['success' => true]);
} else {
    echo json_encode(['error' => 'Learner not found or already deleted']);
}