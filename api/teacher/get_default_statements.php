<?php
session_start();
require_once dirname(__DIR__, 2) . '/config.php';

header('Content-Type: application/json');

if (!isset($_SESSION['email']) || $_SESSION['role'] !== 'teacher') {
    echo json_encode([]);
    exit();
}

$result = $conn->query("
    SELECT statement FROM evaluation_statements 
    WHERE evaluation_id = 1 
    ORDER BY order_num ASC
");

$statements = [];
while ($row = $result->fetch_assoc()) {
    $statements[] = $row['statement'];
}

echo json_encode($statements);