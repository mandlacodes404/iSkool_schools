<?php
require_once __DIR__ . '/../../auth/session_guard.php';
require_once dirname(__DIR__, 2) . '/config.php';

header('Content-Type: application/json');

if (!isset($_SESSION['email']) || $_SESSION['role'] !== 'teacher') {
    echo json_encode(['error' => 'Unauthorized']); exit();
}

$email = $_SESSION['email'];

// ── Academic Year ──
$yearRes = $conn->query("SELECT id FROM academic_years WHERE is_current = 1 LIMIT 1");
if ($yearRes->num_rows === 0) { echo json_encode(['error' => 'No active year']); exit(); }
$yearId = (int)$yearRes->fetch_assoc()['id'];

// ── All Classes (same as get_classes.php — no year filter) ──
$classStmt = $conn->prepare("SELECT id, name FROM classes ORDER BY name ASC");
$classStmt->execute();
$classRows = $classStmt->get_result()->fetch_all(MYSQLI_ASSOC);
$classStmt->close();

// ── SBOs created by this teacher ──
$stmt = $conn->prepare("
    SELECT
        sb.id,
        sb.class_id,
        sb.term_number,
        sb.subject_name,
        sb.topics,
        sb.assessments,
        sb.notes,
        sb.updated_at,
        c.name AS class_name
    FROM subject_briefs sb
    JOIN classes c ON sb.class_id = c.id
    WHERE sb.created_by = ?
      AND sb.academic_year_id = ?
    ORDER BY c.name ASC, sb.term_number ASC, sb.subject_name ASC
");
$stmt->bind_param("si", $email, $yearId);
$stmt->execute();
$rows = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
$stmt->close();

$briefs = [];
foreach ($rows as $row) {
    $briefs[] = [
        'id'          => (int)$row['id'],
        'class_id'    => (int)$row['class_id'],
        'class_name'  => $row['class_name'],
        'term'        => (int)$row['term_number'],
        'subject'     => $row['subject_name'],
        'topics'      => json_decode($row['topics'], true)      ?? [],
        'assessments' => json_decode($row['assessments'], true) ?? [],
        'notes'       => $row['notes'],
        'updated_at'  => $row['updated_at'],
    ];
}

echo json_encode([
    'classes' => $classRows,
    'briefs'  => $briefs
]);