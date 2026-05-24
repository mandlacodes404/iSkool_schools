<?php
/**
 * iSkool School Dashboard — Get Announcements API
 * api/school/get_announcements.php
 *
 * Returns ALL announcements — both teacher class-level ones AND
 * school-wide ones sent by admin (class_id IS NULL).
 * Also returns filter options and summary stats.
 */
ob_start();
error_reporting(E_ALL);
ini_set('display_errors', 0);
require_once __DIR__ . '/../../auth/session_guard.php';
require_once '../../config.php';

if (!isset($_SESSION['email']) || !in_array($_SESSION['role'], ['school_admin', 'admin'])) {
    http_response_code(403);
    echo json_encode(['error' => 'Unauthorized']);
    exit();
}

header('Content-Type: application/json');

$yearId = 0;
$res = $conn->query("SELECT id FROM academic_years WHERE is_current = 1 LIMIT 1");
if ($row = $res->fetch_assoc()) $yearId = (int)$row['id'];

// ── Filters from GET params ──
$filterClass   = (int)($_GET['class_id']     ?? 0);
$filterTerm    = (int)($_GET['term']         ?? 0);
$filterSendTo  = trim($_GET['send_to']       ?? '');
$filterTeacher = trim($_GET['teacher_email'] ?? '');

// ── Build WHERE ──
$where = ["1=1"];
if ($yearId)        $where[] = "a.academic_year_id = $yearId";
if ($filterClass)   $where[] = "a.class_id = $filterClass";
if ($filterTerm)    $where[] = "a.term_number = $filterTerm";
if ($filterSendTo)  $where[] = "a.send_to = '" . $conn->real_escape_string($filterSendTo) . "'";
if ($filterTeacher) $where[] = "a.created_by = '" . $conn->real_escape_string($filterTeacher) . "'";

$whereSQL = implode(' AND ', $where);

// ── Fetch announcements ──
// LEFT JOIN users — school-wide rows are created by admin (not necessarily role='teacher')
// LEFT JOIN classes — school-wide rows have class_id IS NULL so c.name will be NULL
$announcements = [];
$aRes = $conn->query("
    SELECT
        a.id, a.title, a.message, a.created_at,
        a.term_number, a.send_to, a.target_role,
        a.created_by, a.class_id,
        u.name, u.surname, u.profile_pic, u.role AS creator_role,
        c.name AS class_name, c.id AS cid
    FROM announcements a
    LEFT JOIN users u ON u.email = a.created_by
    LEFT JOIN classes c ON c.id = a.class_id
    WHERE $whereSQL
    ORDER BY a.created_at DESC
");

while ($row = $aRes->fetch_assoc()) {
    $announcements[] = [
        'id'            => (int)$row['id'],
        'title'         => $row['title'],
        'message'       => $row['message'],
        'created_at'    => $row['created_at'],
        'term'          => (int)$row['term_number'],
        'send_to'       => $row['send_to'],
        'target_role'   => $row['target_role'],
        'teacher_name'  => trim(($row['name'] ?? '') . ' ' . ($row['surname'] ?? '')),
        'teacher_email' => $row['created_by'],
        'profile_pic'   => $row['profile_pic'] ?? null,
        'creator_role'  => $row['creator_role'] ?? 'school_admin',
        // class_name is NULL for school-wide; frontend checks class_id to determine type
        'class_name'    => $row['class_name'] ?? null,
        'class_id'      => $row['cid'] ? (int)$row['cid'] : null,
    ];
}

// ── Filter options ──
$classes = [];
$cRes = $conn->query("SELECT id, name FROM classes ORDER BY name ASC");
while ($c = $cRes->fetch_assoc()) $classes[] = $c;

$teachers = [];
$tRes = $conn->query("
    SELECT DISTINCT u.email, u.name, u.surname
    FROM announcements a
    JOIN users u ON u.email = a.created_by
    WHERE u.role = 'teacher'
    " . ($yearId ? "AND a.academic_year_id = $yearId" : "") . "
    ORDER BY u.surname ASC
");
while ($t = $tRes->fetch_assoc()) {
    $teachers[] = [
        'email' => $t['email'],
        'name'  => trim($t['name'] . ' ' . $t['surname']),
    ];
}

// ── Summary stats ──
// total = all announcements this year
// for_learners = class-level send_to='learners' + school-wide targeting learners/all
// for_parents  = class-level send_to='parents'
// school_wide  = class_id IS NULL (admin broadcasts)
$statsRes = $conn->query("
    SELECT
        COUNT(*)                                                          AS total,
        SUM(class_id IS NOT NULL AND send_to = 'learners')               AS for_learners,
        SUM(class_id IS NOT NULL AND send_to = 'parents')                AS for_parents,
        SUM(class_id IS NULL)                                            AS school_wide
    FROM announcements
    " . ($yearId ? "WHERE academic_year_id = $yearId" : "") . "
")->fetch_assoc();

echo json_encode([
    'announcements' => $announcements,
    'classes'       => $classes,
    'teachers'      => $teachers,
    'total'         => (int)$statsRes['total'],
    'for_learners'  => (int)$statsRes['for_learners'],
    'for_parents'   => (int)$statsRes['for_parents'],
    'school_wide'   => (int)$statsRes['school_wide'],
]);

ob_end_flush();