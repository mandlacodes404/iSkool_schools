<?php
/**
 * iSkool School Dashboard — Get Teacher Analytics API
 * Mirrors api/teacher/get_analytics.php but for admin view
 * Takes teacher_email as POST param instead of using session
 */
ob_start();
error_reporting(E_ALL);
ini_set('display_errors', 0);
require_once __DIR__ . '/../../auth/session_guard.php';
require_once __DIR__ . '/../../auth/csrf_helper.php';
require_once '../../config.php';

if (!isset($_SESSION['email']) || !in_array($_SESSION['role'], ['school_admin', 'admin'])) {
    http_response_code(403);
    echo json_encode(['error' => 'Unauthorized']);
    exit();
}

verify_csrf_token();

header('Content-Type: application/json');

$teacherEmail = trim($_POST['teacher_email'] ?? '');
if (!$teacherEmail) { echo json_encode(['error' => 'Missing teacher_email']); exit(); }

// Current academic year
$yearResult      = $conn->query("SELECT id FROM academic_years WHERE is_current = 1 LIMIT 1");
$current_year_id = (int)($yearResult->fetch_assoc()['id'] ?? 0);

// Current term from platform_settings
$termResult   = $conn->query("SELECT current_global_term FROM platform_settings LIMIT 1");
$termRow      = $termResult ? $termResult->fetch_assoc() : null;
$current_term = $termRow ? (int)$termRow['current_global_term'] : (function() {
    $m = (int)date('n');
    return $m <= 3 ? 1 : ($m <= 6 ? 2 : ($m <= 9 ? 3 : 4));
})();

// Get distinct class+term combos where teacher has summative quizzes
$sql = "
    SELECT DISTINCT
        q.class_id,
        c.name AS class_name,
        q.term_number,
        COUNT(DISTINCT CASE WHEN u.is_deleted = 0 THEN cs.student_email END) AS student_count
    FROM quizzes q
    JOIN classes c ON q.class_id = c.id
    LEFT JOIN class_students cs ON cs.class_id = q.class_id
    LEFT JOIN users u ON cs.student_email = u.email AND u.role = 'learner'
    WHERE q.created_by = ?
      AND q.is_summative = 1
      AND q.publish_marks = 1
      AND q.academic_year_id = ?
      AND (u.is_deleted = 0 OR u.is_deleted IS NULL)
    GROUP BY q.class_id, c.name, q.term_number
    ORDER BY q.term_number ASC, c.name ASC
";

$stmt = $conn->prepare($sql);
$stmt->bind_param("si", $teacherEmail, $current_year_id);
$stmt->execute();
$result = $stmt->get_result();
$rows   = $result ? $result->fetch_all(MYSQLI_ASSOC) : [];
$stmt->close();

$grouped   = [];
$class_ids = [];

foreach ($rows as $row) {
    $term     = (int)$row['term_number'];
    $class_id = (int)$row['class_id'];

    if (!isset($grouped[$term])) {
        $grouped[$term] = ['term' => $term, 'classes' => []];
    }
    if (!isset($grouped[$term]['classes'][$class_id])) {
        $grouped[$term]['classes'][$class_id] = [
            'id'            => $class_id,
            'name'          => $row['class_name'],
            'student_count' => (int)$row['student_count'],
            'subject'       => null,
        ];
        $class_ids[] = $class_id;
    }
}

ksort($grouped);

// Fetch custom subjects for this teacher
if (!empty($class_ids)) {
    $placeholders = implode(',', array_fill(0, count($class_ids), '?'));
    $types        = 's' . str_repeat('i', count($class_ids));
    $params       = array_merge([$teacherEmail], $class_ids);

    $subjectSql = "SELECT class_id, subject_name FROM teacher_subjects WHERE teacher_email = ? AND class_id IN ("
        . $placeholders .
        ")";
    $stmt = $conn->prepare($subjectSql);
    $refs = [];
    foreach ($params as $k => $v) $refs[$k] = &$params[$k];
    array_unshift($refs, $types);
    call_user_func_array([$stmt, 'bind_param'], $refs);
    $stmt->execute();
    $subjectRows = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
    $stmt->close();

    $subjects = [];
    foreach ($subjectRows as $s) $subjects[$s['class_id']] = $s['subject_name'];

    foreach ($grouped as &$termData) {
        foreach ($termData['classes'] as &$class) {
            $class['subject'] = $subjects[$class['id']] ?? null;
        }
    }
}

$output = [];
foreach ($grouped as $termData) {
    $output[] = [
        'term'    => $termData['term'],
        'classes' => array_values($termData['classes']),
    ];
}

echo json_encode([
    'terms'         => $output,
    'current_term'  => $current_term,
    'teacher_email' => $teacherEmail,
]);
