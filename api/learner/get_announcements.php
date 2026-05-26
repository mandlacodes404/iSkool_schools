<?php
/**
 * iSkool — api/learner/get_announcements.php
 * Role: learner
 * Returns:
 *   {
 *     "school": [ { title, message, created_at, display_date } ],
 *     "teachers": { "Mr A. Smith": [ {...}, ... ], ... }
 *   }
 *
 * "school" = school-wide announcements sent by admin (class_id IS NULL, target_role IN ('all','learners'))
 * "teachers" = class-level announcements grouped by teacher display name
 */

require_once __DIR__ . '/../../auth/session_guard.php';
require_once dirname(__DIR__, 2) . '/config.php';

header('Content-Type: application/json');

if (!isset($_SESSION['email']) || $_SESSION['role'] !== 'learner') {
    echo json_encode(['error' => 'Unauthorized']);
    exit();
}

$email = $_SESSION['email'];

// ── Active academic year ──
$yearRes = $conn->query("SELECT id FROM academic_years WHERE is_current = 1 LIMIT 1");
$current_academic_year_id = ($yearRes && $yearRes->num_rows > 0)
    ? (int)$yearRes->fetch_assoc()['id']
    : 0;

// ── Learner's class ──
$classQuery = $conn->prepare("
    SELECT class_id FROM class_students
    WHERE student_email = ? AND academic_year_id = ? LIMIT 1
");
$classQuery->bind_param("si", $email, $current_academic_year_id);
$classQuery->execute();
$classQuery->bind_result($classId);
$classQuery->fetch();
$classQuery->close();

// ══════════════════════════════════════
// 1. SCHOOL-WIDE ANNOUNCEMENTS
//    class_id IS NULL, target audience includes learners
// ══════════════════════════════════════
$schoolAnnouncements = [];

// ── Get school name for sender label ──
$schoolName = 'School Admin';
$snRes = $conn->query("SELECT setting_value FROM school_name WHERE setting_key = 'school_name' LIMIT 1");
if ($snRes && $snRow = $snRes->fetch_assoc()) {
    $schoolName = trim($snRow['setting_value']) ?: 'School Admin';
}

$schoolStmt = $conn->prepare("
    SELECT
        a.id,
        a.title,
        a.message,
        a.created_at,
        a.target_role
    FROM announcements a
    WHERE a.class_id IS NULL
      AND a.academic_year_id = ?
      AND a.target_role IN ('all', 'learners')
    ORDER BY a.created_at DESC
");
$schoolStmt->bind_param("i", $current_academic_year_id);
$schoolStmt->execute();
$schoolRes = $schoolStmt->get_result();

while ($row = $schoolRes->fetch_assoc()) {
    $schoolAnnouncements[] = [
        'id'           => (int)$row['id'],
        'title'        => $row['title']   ?? '(No Title)',
        'message'      => $row['message'] ?? '',
        'created_at'   => $row['created_at'],
        'display_date' => date('j M \a\t H:i', strtotime($row['created_at'])),
        'sender'       => $schoolName,
    ];
}
$schoolStmt->close();

// ══════════════════════════════════════
// 2. TEACHER ANNOUNCEMENTS (class-level)
//    grouped by teacher display name
// ══════════════════════════════════════
$teacherGrouped = [];

if ($classId) {
    $teacherStmt = $conn->prepare("
        SELECT
            a.id,
            a.title,
            a.message,
            a.created_at,
            CONCAT(
                COALESCE(u.title, ''), ' ',
                COALESCE(u.surname, 'Teacher')
            ) AS teacher_display
        FROM announcements a
        LEFT JOIN users u ON a.created_by = u.email AND u.role = 'teacher'
        WHERE a.class_id = ?
          AND a.academic_year_id = ?
          AND a.send_to = 'learners'
        ORDER BY a.created_at DESC
    ");
    $teacherStmt->bind_param("ii", $classId, $current_academic_year_id);
    $teacherStmt->execute();
    $teacherRes = $teacherStmt->get_result();

    while ($row = $teacherRes->fetch_assoc()) {
        $teacher = trim($row['teacher_display']) ?: 'Unknown Teacher';
        $teacherGrouped[$teacher][] = [
            'id'           => (int)$row['id'],
            'title'        => $row['title']   ?? '(No Title)',
            'message'      => $row['message'] ?? '',
            'created_at'   => $row['created_at'],
            'display_date' => date('j M \a\t H:i', strtotime($row['created_at'])),
        ];
    }
    $teacherStmt->close();
}

echo json_encode([
    'school_wide' => $schoolAnnouncements,
    'teacher'     => $teacherGrouped,
]);