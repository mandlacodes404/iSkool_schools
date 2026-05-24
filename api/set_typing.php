<?php
require_once __DIR__ . '/../auth/session_guard.php';
require_once __DIR__ . '/../auth/csrf_helper.php';
require_once dirname(__DIR__) . '/config.php';

header('Content-Type: application/json');

if (!isset($_SESSION['email'])) {
    echo json_encode(['error' => 'Unauthorized']);
    exit();
}

verify_csrf_token();

$email = $_SESSION['email'];
$disc_id = (int)($_POST['discussion_id'] ?? 0);

if (!$disc_id) {
    echo json_encode(['error' => 'Missing discussion_id']);
    exit();
}

// Upsert — insert or update timestamp
$stmt = $conn->prepare("
    INSERT INTO discussion_typing (discussion_id, user_email, updated_at)
    VALUES (?, ?, NOW())
    ON DUPLICATE KEY UPDATE updated_at = NOW()
");
$stmt->bind_param("is", $disc_id, $email);
$stmt->execute();
$stmt->close();

echo json_encode(['ok' => true]);
