<?php
require_once __DIR__ . '/../../auth/session_guard.php';
header('Content-Type: application/json');
require_once dirname(__DIR__, 2) . '/config.php';

if (!isset($_SESSION['email']) || $_SESSION['role'] !== 'teacher') {
    echo json_encode(['error' => 'Unauthorized']); exit();
}

$email = $_SESSION['email'];

// Classes this teacher hasn't already linked themselves to via
// teacher_subjects. Single-school-per-database architecture (see
// classes table — no school_id column), so no school filter needed.
$stmt = $conn->prepare("
    SELECT c.id, c.name
    FROM classes c
    WHERE NOT EXISTS (
        SELECT 1 FROM teacher_subjects ts
        WHERE ts.class_id = c.id AND ts.teacher_email = ?
    )
    ORDER BY c.name ASC
");
$stmt->bind_param("s", $email);
$stmt->execute();
$res = $stmt->get_result();

$classes = [];
while ($row = $res->fetch_assoc()) {
    $classes[] = ['id' => (int)$row['id'], 'name' => $row['name']];
}
$stmt->close();

echo json_encode(['classes' => $classes]);
