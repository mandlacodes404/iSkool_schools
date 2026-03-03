<?php
session_start();
require_once dirname(__DIR__) . '/config.php';

header('Content-Type: application/json');

if (!isset($_SESSION['email'])) {
    echo json_encode(['count' => 0]);
    exit();
}

$email   = $_SESSION['email'];
$disc_id = (int)($_GET['discussion_id'] ?? 0);

if (!$disc_id) {
    echo json_encode(['count' => 0]);
    exit();
}

// Count others typing in last 5 seconds (exclude self)
$stmt = $conn->prepare("
    SELECT COUNT(*) as cnt
    FROM discussion_typing
    WHERE discussion_id = ?
      AND user_email != ?
      AND updated_at >= NOW() - INTERVAL 5 SECOND
");
$stmt->bind_param("is", $disc_id, $email);
$stmt->execute();
$count = (int)$stmt->get_result()->fetch_assoc()['cnt'];
$stmt->close();

echo json_encode(['count' => $count]);
