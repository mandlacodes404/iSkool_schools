<?php
/**
 * iSkool School Dashboard — Get Announcements API
 */
ob_start();
error_reporting(E_ALL);
ini_set('display_errors', 0);
session_start();
require_once '../../config.php';

if (!isset($_SESSION['email']) || !in_array($_SESSION['role'], ['school_admin', 'admin'])) {
    http_response_code(403);
    echo json_encode(['error' => 'Unauthorized']);
    exit();
}

header('Content-Type: application/json');

$yearId = 0;
$res = $conn->query("SELECT id FROM academic_years WHERE is_current = 1 LIMIT 1");
if ($row = $res->fetch_assoc()) $yearId = $row['id'];

// ── Filters from GET params ──
$filterClass   = (int)($_GET['class_id']    ?? 0);
$filterTerm    = (int)($_GET['term']        ?? 0);
$filterSendTo  = trim($_GET['send_to']      ?? '');
$filterTeacher = trim($_GET['teacher_email']?? '');

// ── Build WHERE ──
$where = ["1=1"];
if ($yearId)        $where[] = "a.academic_year_id = $yearId";
if ($filterClass)   $where[] = "a.class_id = $filterClass";
if ($filterTerm)    $where[] = "a.term_number = $filterTerm";
if ($filterSendTo)  $where[] = "a.send_to = '" . $conn->real_escape_string($filterSendTo) . "'";
if ($filterTeacher) $where[] = "a.created_by = '" . $conn->real_escape_string($filterTeacher) . "'";

$whereSQL = implode(' AND ', $where);

// ── Fetch announcements ──
$announcements = [];
$aRes = $conn->query("
    SELECT a.id, a.title, a.message, a.created_at,
           a.term_number, a.send_to, a.target_role,
           a.created_by,
           u.name, u.surname, u.profile_pic,
           c.name class_name, c.id class_id
    FROM announcements a
    JOIN users u ON u.email = a.created_by
    LEFT JOIN classes c ON c.id = a.class_id
    WHERE $whereSQL
    ORDER BY a.created_at DESC
");

while ($row = $aRes->fetch_assoc()) {
    $announcements[] = [
        'id'          => $row['id'],
        'title'       => $row['title'],
        'message'     => $row['message'],
        'created_at'  => $row['created_at'],
        'term'        => $row['term_number'],
        'send_to'     => $row['send_to'],
        'target_role' => $row['target_role'],
        'teacher_name'=> trim($row['name'] . ' ' . $row['surname']),
        'teacher_email'=> $row['created_by'],
        'profile_pic' => $row['profile_pic'],
        'class_name'  => $row['class_name'] ?? 'All Classes',
        'class_id'    => $row['class_id'],
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
    " . ($yearId ? "WHERE a.academic_year_id = $yearId" : "") . "
    ORDER BY u.surname ASC
");
while ($t = $tRes->fetch_assoc()) {
    $teachers[] = [
        'email' => $t['email'],
        'name'  => trim($t['name'] . ' ' . $t['surname']),
    ];
}

// ── Summary stats ──
$totalRes = $conn->query("
    SELECT COUNT(*) total,
           SUM(send_to = 'learners') for_learners,
           SUM(send_to = 'parents') for_parents
    FROM announcements
    " . ($yearId ? "WHERE academic_year_id = $yearId" : "") . "
")->fetch_assoc();

echo json_encode([
    'announcements' => $announcements,
    'classes'       => $classes,
    'teachers'      => $teachers,
    'total'         => (int)$totalRes['total'],
    'for_learners'  => (int)$totalRes['for_learners'],
    'for_parents'   => (int)$totalRes['for_parents'],
]);