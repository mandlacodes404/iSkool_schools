<?php
/**
 * api/learner/get_my_class.php
 * Returns the class the logged-in learner has joined (or null if none).
 */
require_once __DIR__ . '/../../auth/session_guard.php';
require_once dirname(__DIR__, 2) . '/config.php';

header('Content-Type: application/json');

if (!isset($_SESSION['email']) || $_SESSION['role'] !== 'learner') {
    echo json_encode(null);
    exit();
}

$learnerEmail = $_SESSION['email'];

// Get current academic year
$yearRow = $conn->query("SELECT id FROM academic_years WHERE is_current = 1 LIMIT 1")->fetch_assoc();
$yearId  = $yearRow ? (int)$yearRow['id'] : 0;

// Find the class the learner has joined
if ($yearId > 0) {
    $stmt = $conn->prepare("
        SELECT c.id, c.name
        FROM class_students cs
        JOIN classes c ON c.id = cs.class_id
        WHERE cs.student_email = ? AND cs.academic_year_id = ?
        LIMIT 1
    ");
    $stmt->bind_param("si", $learnerEmail, $yearId);
} else {
    $stmt = $conn->prepare("
        SELECT c.id, c.name
        FROM class_students cs
        JOIN classes c ON c.id = cs.class_id
        WHERE cs.student_email = ?
        LIMIT 1
    ");
    $stmt->bind_param("s", $learnerEmail);
}

$stmt->execute();
$row = $stmt->get_result()->fetch_assoc();
$stmt->close();

echo json_encode($row ?: null);