<?php
require_once __DIR__ . '/auth/session_guard.php';
require_once __DIR__ . '/auth/csrf_helper.php';
require_once 'config.php';

header('Content-Type: application/json');

verify_csrf_token();

// Get the JSON data sent from the dashboard
$input = json_decode(file_get_contents('php://input'), true);

if (!isset($input['subscription'])) {
    echo json_encode(['success' => false, 'message' => 'No subscription data']);
    exit;
}

$email = $_SESSION['email'] ?? '';
$endpoint = $input['subscription']['endpoint'] ?? '';
$p256dh = $input['subscription']['keys']['p256dh'] ?? '';
$auth = $input['subscription']['keys']['auth'] ?? '';

if (!$email || !$endpoint || !$p256dh || !$auth) {
    echo json_encode(['success' => false, 'message' => 'Missing fields']);
    exit;
}

// Save or Update the subscription in the DB
$sql = "INSERT INTO user_subscriptions (user_email, endpoint, p256dh, auth) 
        VALUES (?, ?, ?, ?) 
        ON DUPLICATE KEY UPDATE
            p256dh = VALUES(p256dh),
            auth = VALUES(auth),
            created_at = CURRENT_TIMESTAMP";

$stmt = $conn->prepare($sql);
$stmt->bind_param("ssss", $email, $endpoint, $p256dh, $auth);

if ($stmt->execute()) {
    echo json_encode(['success' => true, 'message' => 'Subscription saved to database']);
} else {
    echo json_encode(['success' => false, 'message' => 'Database error']);
}
?>
