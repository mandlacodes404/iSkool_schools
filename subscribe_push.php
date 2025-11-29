<?php
session_start();
require 'config.php';

// Check if the user is logged in
if (!isset($_SESSION['user_id'])) {
    http_response_code(403);
    echo json_encode(['status' => 'error', 'message' => 'User not logged in']);
    exit;
}

// Read the subscription object sent from the browser
$input = json_decode(file_get_contents('php://input'), true);

if (!isset($input['subscription'])) {
    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => 'No subscription provided']);
    exit;
}

// Validate subscription structure
$subscription = $input['subscription'];
if (!isset($subscription['endpoint']) || !isset($subscription['keys'])) {
    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => 'Invalid subscription format']);
    exit;
}

$subscription = json_encode($input['subscription']);

// Log for debugging
error_log("Received subscription for user_id: {$_SESSION['user_id']}, Subscription: $subscription");

// Save the subscription in the database (avoid duplicates)
$stmt = $conn->prepare("
    INSERT INTO push_subscriptions (user_id, subscription) 
    VALUES (?, ?) 
    ON DUPLICATE KEY UPDATE subscription = ?
");
$stmt->bind_param("iss", $_SESSION['user_id'], $subscription, $subscription);
if ($stmt->execute()) {
    echo json_encode(['status' => 'success']);
} else {
    http_response_code(500);
    error_log("Database error: " . $conn->error);
    echo json_encode(['status' => 'error', 'message' => 'Database error']);
}

