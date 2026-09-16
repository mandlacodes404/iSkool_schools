<?php
require_once __DIR__ . '/../../auth/session_guard.php';
header('Content-Type: application/json');
require_once dirname(__DIR__, 2) . '/config.php';

if (!isset($_SESSION['email']) || $_SESSION['role'] !== 'teacher') {
    echo json_encode(['error' => 'Unauthorized']); exit();
}

$email = $_SESSION['email'];

$yearResult = $conn->query("SELECT id FROM academic_years WHERE is_current = 1 LIMIT 1");
$current_year_id = (int)$yearResult->fetch_assoc()['id'];

if (!$current_year_id) {
    echo json_encode(['error' => 'No active academic year']); exit();
}

// A teacher's classes come from teacher_subjects (which class + which
// subject they teach), joined to classes for the display name, with a
// learner count from class_students scoped to the current academic year.
$stmt = $conn->prepare("
    SELECT
        c.id,
        c.name,
        ts.subject_name,
        (SELECT COUNT(*) FROM class_students cs
         WHERE cs.class_id = c.id AND cs.academic_year_id = ?) AS learner_count
    FROM teacher_subjects ts
    JOIN classes c ON ts.class_id = c.id
    WHERE ts.teacher_email = ?
    ORDER BY c.name ASC
");
$stmt->bind_param("is", $current_year_id, $email);
$stmt->execute();
$res = $stmt->get_result();

$classes = [];
while ($row = $res->fetch_assoc()) {
    $classes[] = [
        'id'            => (int)$row['id'],
        'name'          => $row['name'],
        'subject_name'  => $row['subject_name'],
        'learner_count' => (int)$row['learner_count'],
    ];
}
$stmt->close();

echo json_encode(['classes' => $classes]);
