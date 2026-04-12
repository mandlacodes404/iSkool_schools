<?php
/**
 * iSkool — api/teacher/get_announcements.php
 * Role: teacher
 * Returns:
 *   [
 *     {
 *       "class_name": "From School",   // school-wide group (always first if any exist)
 *       "is_school": true,
 *       "items": [ { id, title, message, created_at, display_date } ]
 *     },
 *     {
 *       "class_name": "Grade 10A",
 *       "is_school": false,
 *       "items": [ ... ]
 *     },
 *     ...
 *   ]
 *
 * "From School" group = school-wide announcements sent by admin (class_id IS NULL)
 *   that target teachers or everyone.
 * Other groups = the teacher's own class-level announcements, grouped by class.
 */

session_start();
require_once dirname(__DIR__, 2) . '/config.php';

header('Content-Type: application/json');

if (!isset($_SESSION['email']) || $_SESSION['role'] !== 'teacher') {
    echo json_encode(['error' => 'Unauthorized']);
    exit();
}

$email = $_SESSION['email'];

// ── Active academic year ──
$yearRes = $conn->query("SELECT id FROM academic_years WHERE is_current = 1 LIMIT 1");
if (!$yearRes || $yearRes->num_rows === 0) {
    echo json_encode(['error' => 'No active academic year']);
    exit();
}
$current_academic_year_id = (int)$yearRes->fetch_assoc()['id'];

$result = [];

// ══════════════════════════════════════
// 1. SCHOOL-WIDE ANNOUNCEMENTS FROM ADMIN
//    target_role IN ('all', 'teachers'), class_id IS NULL
// ══════════════════════════════════════
$schoolStmt = $conn->prepare("
    SELECT
        a.id,
        a.title,
        a.message,
        a.created_at
    FROM announcements a
    WHERE a.class_id IS NULL
      AND a.academic_year_id = ?
      AND a.target_role IN ('all', 'teachers')
    ORDER BY a.created_at DESC
");
$schoolStmt->bind_param("i", $current_academic_year_id);
$schoolStmt->execute();
$schoolRes = $schoolStmt->get_result();

$schoolItems = [];
while ($row = $schoolRes->fetch_assoc()) {
    $schoolItems[] = [
        'id'           => (int)$row['id'],
        'title'        => $row['title']   ?? '(No Title)',
        'message'      => $row['message'] ?? '',
        'created_at'   => $row['created_at'],
        'display_date' => date('d M Y, H:i', strtotime($row['created_at'])),
    ];
}
$schoolStmt->close();

// Only include the school group if there are any
if (!empty($schoolItems)) {
    $result[] = [
        'class_name' => 'From School',
        'is_school'  => true,
        'items'      => $schoolItems,
    ];
}

// ══════════════════════════════════════
// 2. TEACHER'S OWN CLASS ANNOUNCEMENTS
//    grouped by class
// ══════════════════════════════════════
$teacherStmt = $conn->prepare("
    SELECT
        a.id,
        a.title,
        a.message,
        a.created_at,
        c.id   AS class_id,
        c.name AS class_name
    FROM announcements a
    JOIN classes c ON a.class_id = c.id
    WHERE a.created_by = ?
      AND a.academic_year_id = ?
    ORDER BY a.created_at DESC
");
$teacherStmt->bind_param("si", $email, $current_academic_year_id);
$teacherStmt->execute();
$teacherRes = $teacherStmt->get_result();

$classGroups = [];
while ($row = $teacherRes->fetch_assoc()) {
    $cid = $row['class_id'];
    if (!isset($classGroups[$cid])) {
        $classGroups[$cid] = [
            'class_name' => $row['class_name'],
            'is_school'  => false,
            'items'      => [],
        ];
    }
    $classGroups[$cid]['items'][] = [
        'id'           => (int)$row['id'],
        'title'        => $row['title']   ?? '(No Title)',
        'message'      => $row['message'] ?? '',
        'created_at'   => $row['created_at'],
        'display_date' => date('d M Y, H:i', strtotime($row['created_at'])),
    ];
}
$teacherStmt->close();

// Merge class groups into result
foreach ($classGroups as $group) {
    $result[] = $group;
}

echo json_encode($result);