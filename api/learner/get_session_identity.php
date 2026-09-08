<?php
require_once __DIR__ . '/../../auth/session_guard.php';

header('Content-Type: application/json');

if (!isset($_SESSION['email']) || $_SESSION['role'] !== 'learner') {
    http_response_code(401);
    echo json_encode(['error' => 'Unauthorized']);
    exit();
}

echo json_encode(['email' => $_SESSION['email']]);
