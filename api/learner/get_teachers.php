<?php
session_start();
require_once dirname(__DIR__, 2) . '/config.php';

header('Content-Type: application/json');

if (!isset($_SESSION['email']) || $_SESSION['role'] !== 'learner') {
    echo json_encode([]); exit();
}

$teachers = $conn->query("
    SELECT email,
           CONCAT(COALESCE(title,''), ' ', surname, ' (', name, ')') AS display_name
    FROM users
    WHERE role = 'teacher'
    ORDER BY surname ASC
")->fetch_all(MYSQLI_ASSOC);

echo json_encode($teachers);