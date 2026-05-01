<?php
/**
 * iSkool School Dashboard — Classes API
 * Returns class list (id, name, created_by only)
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

$classes = [];
$result  = $conn->query("SELECT id, name, created_by FROM classes ORDER BY name ASC");

while ($row = $result->fetch_assoc()) {
    $classes[] = [
        'id'         => (int)$row['id'],
        'name'       => $row['name'],
        'created_by' => $row['created_by'],
    ];
}

echo json_encode(['classes' => $classes]);