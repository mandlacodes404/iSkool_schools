<?php
/**
 * iSkool School Dashboard — Create Class
 * POST: { name: "Grade 8A" }
 */
ob_start();
error_reporting(E_ALL);
ini_set('display_errors', 0);
require_once __DIR__ . '/../../auth/session_guard.php';
require_once '../../config.php';

header('Content-Type: application/json');

if (!isset($_SESSION['email']) || !in_array($_SESSION['role'], ['school_admin', 'admin'])) {
    http_response_code(403);
    echo json_encode(['error' => 'Unauthorized']);
    exit();
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit();
}

$data = json_decode(file_get_contents('php://input'), true);
$name = trim($data['name'] ?? '');

if ($name === '') {
    http_response_code(400);
    echo json_encode(['error' => 'Class name is required']);
    exit();
}

// Check for duplicate
$check = $conn->prepare("SELECT id FROM classes WHERE name = ?");
$check->bind_param("s", $name);
$check->execute();
$check->store_result();

if ($check->num_rows > 0) {
    http_response_code(409);
    echo json_encode(['error' => 'A class with this name already exists']);
    exit();
}
$check->close();

$createdBy = $_SESSION['email'];
$subject   = 'General';

$stmt = $conn->prepare("INSERT INTO classes (name, subject, created_by) VALUES (?, ?, ?)");
$stmt->bind_param("sss", $name, $subject, $createdBy);

if ($stmt->execute()) {
    echo json_encode([
        'success' => true,
        'class'   => [
            'id'         => (int)$conn->insert_id,
            'name'       => $name,
            'created_by' => $createdBy,
        ]
    ]);
} else {
    http_response_code(500);
    echo json_encode(['error' => 'Failed to create class']);
}

$stmt->close();