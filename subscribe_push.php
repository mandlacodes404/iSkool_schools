<?php
// subscribe_push.php - temporary test version
header('Content-Type: application/json');

$input = json_decode(file_get_contents('php://input'), true);

file_put_contents('push_test.log', print_r($input, true)); // logs what we receive

echo json_encode(['success' => true, 'message' => 'Subscription received and logged']);
?>