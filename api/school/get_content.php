<?php
/**
 * iSkool School Dashboard — Get Content API
 * Returns quizzes, assignments, resources across the school
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
if ($row = $res->fetch_assoc()) $yearId = $row['id'];
$yearCond = $yearId ? "AND academic_year_id = $yearId" : "";

// ── QUIZZES ──
$quizzes = [];
$qRes = $conn->query("
    SELECT q.id, q.title, q.term_number, q.is_summative, q.weight_percent,
           q.created_at, q.created_by,
           u.name, u.surname,
           c.name class_name, c.id class_id,
           COUNT(qr.id) submissions,
           ROUND(AVG(qr.score / qr.total * 100), 1) avg_pct
    FROM quizzes q
    JOIN users u ON u.email = q.created_by
    JOIN classes c ON c.id = q.class_id
    LEFT JOIN quiz_results qr ON qr.quiz_id = q.id
    GROUP BY q.id
    ORDER BY q.created_at DESC
");
while ($row = $qRes->fetch_assoc()) {
    $quizzes[] = [
        'id'           => $row['id'],
        'title'        => $row['title'],
        'term'         => $row['term_number'],
        'is_summative' => (bool)$row['is_summative'],
        'weight'       => $row['weight_percent'],
        'created_at'   => $row['created_at'],
        'teacher_name' => trim($row['name'] . ' ' . $row['surname']),
        'teacher_email'=> $row['created_by'],
        'class_name'   => $row['class_name'],
        'class_id'     => $row['class_id'],
        'submissions'  => (int)$row['submissions'],
        'avg_pct'      => $row['avg_pct'],
        'type'         => 'quiz',
    ];
}

// ── ASSIGNMENTS ──
$assignments = [];
$aRes = $conn->query("
    SELECT a.id, a.title, a.description, a.due_date,
           a.created_at, a.created_by,
           u.name, u.surname,
           c.name class_name, c.id class_id,
           COUNT(s.id) submissions
    FROM assignments a
    JOIN users u ON u.email = a.created_by
    JOIN classes c ON c.id = a.class_id
    LEFT JOIN submissions s ON s.assignment_id = a.id
    GROUP BY a.id
    ORDER BY a.created_at DESC
");
while ($row = $aRes->fetch_assoc()) {
    $assignments[] = [
        'id'           => $row['id'],
        'title'        => $row['title'],
        'description'  => $row['description'],
        'due_date'     => $row['due_date'],
        'created_at'   => $row['created_at'],
        'teacher_name' => trim($row['name'] . ' ' . $row['surname']),
        'teacher_email'=> $row['created_by'],
        'class_name'   => $row['class_name'],
        'class_id'     => $row['class_id'],
        'submissions'  => (int)$row['submissions'],
        'type'         => 'assignment',
    ];
}

// ── RESOURCES ──
$resources = [];
$rRes = $conn->query("
    SELECT r.id, r.title, r.filename,
           r.uploaded_at, r.uploaded_by,
           u.name, u.surname,
           c.name class_name, c.id class_id
    FROM resources r
    JOIN users u ON u.email = r.uploaded_by
    JOIN classes c ON c.id = r.class_id
    ORDER BY r.uploaded_at DESC
");
while ($row = $rRes->fetch_assoc()) {
    // Derive file type from filename extension
    $ext = strtolower(pathinfo($row['filename'], PATHINFO_EXTENSION));
    $resources[] = [
        'id'           => $row['id'],
        'title'        => $row['title'],
        'file_type'    => $ext ?: 'file',
        'file_url'     => $row['filename'],
        'created_at'   => $row['uploaded_at'],
        'teacher_name' => trim($row['name'] . ' ' . $row['surname']),
        'teacher_email'=> $row['uploaded_by'],
        'class_name'   => $row['class_name'],
        'class_id'     => $row['class_id'],
        'type'         => 'resource',
    ];
}

// ── FILTER OPTIONS ──
$classes = [];
$cRes = $conn->query("SELECT id, name FROM classes ORDER BY name ASC");
while ($c = $cRes->fetch_assoc()) $classes[] = $c;

$teachers = [];
$tRes = $conn->query("
    SELECT DISTINCT email, name, surname FROM users
    WHERE role = 'teacher' AND is_deleted = 0
    ORDER BY surname ASC
");
while ($t = $tRes->fetch_assoc()) {
    $teachers[] = ['email' => $t['email'], 'name' => trim($t['name'] . ' ' . $t['surname'])];
}

// ── SUMMARY ──
$totalQuizzes      = count($quizzes);
$totalAssignments  = count($assignments);
$totalResources    = count($resources);
$summativeCount    = count(array_filter($quizzes, fn($q) => $q['is_summative']));

echo json_encode([
    'quizzes'          => $quizzes,
    'assignments'      => $assignments,
    'resources'        => $resources,
    'classes'          => $classes,
    'teachers'         => $teachers,
    'total_quizzes'    => $totalQuizzes,
    'total_assignments'=> $totalAssignments,
    'total_resources'  => $totalResources,
    'summative_count'  => $summativeCount,
]);