<?php
if (session_status() === PHP_SESSION_NONE) session_start();
header('Content-Type: application/json');
require_once dirname(__DIR__, 2) . '/config.php';

if (!isset($_SESSION['email']) || $_SESSION['role'] !== 'learner') {
    echo json_encode(['error' => 'Unauthorized']); exit();
}

$email = $_SESSION['email'];

// ── Academic Year ──
$yearRes = $conn->query("SELECT id FROM academic_years WHERE is_current = 1 LIMIT 1");
if ($yearRes->num_rows === 0) { echo json_encode(['error' => 'No active year']); exit(); }
$yearId = (int)$yearRes->fetch_assoc()['id'];

// ── Learner's Class ──
$classStmt = $conn->prepare("
    SELECT class_id FROM class_students
    WHERE student_email = ? AND academic_year_id = ? LIMIT 1
");
$classStmt->bind_param("si", $email, $yearId);
$classStmt->execute();
$classRow = $classStmt->get_result()->fetch_assoc();
$classStmt->close();

if (!$classRow) {
    echo json_encode(['briefs' => []]); exit();
}
$classId = (int)$classRow['class_id'];

// ── Current Term ──
$termRes     = $conn->query("SELECT current_global_term FROM platform_settings LIMIT 1");
$currentTerm = $termRes ? (int)$termRes->fetch_assoc()['current_global_term'] : 1;

// ── Fetch all SBOs for this class ──
$stmt = $conn->prepare("
    SELECT
        sb.id,
        sb.term_number,
        sb.subject_name,
        sb.topics,
        sb.assessments,
        sb.notes,
        sb.updated_at,
        CONCAT(COALESCE(u.title,''), ' ', u.surname) AS teacher_name
    FROM subject_briefs sb
    JOIN users u ON sb.created_by = u.email
    WHERE sb.class_id = ?
      AND sb.academic_year_id = ?
    ORDER BY sb.term_number ASC, sb.subject_name ASC
");
$stmt->bind_param("ii", $classId, $yearId);
$stmt->execute();
$rows = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
$stmt->close();

// ── Parse JSON fields ──
$briefs = [];
foreach ($rows as $row) {
    $briefs[] = [
        'id'           => (int)$row['id'],
        'term'         => (int)$row['term_number'],
        'subject'      => $row['subject_name'],
        'teacher'      => trim($row['teacher_name']),
        'topics'       => json_decode($row['topics'], true)      ?? [],
        'assessments'  => json_decode($row['assessments'], true) ?? [],
        'notes'        => $row['notes'],
        'updated_at'   => $row['updated_at'],
    ];
}

echo json_encode(['briefs' => $briefs, 'current_term' => $currentTerm]);