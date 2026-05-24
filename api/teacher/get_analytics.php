<?php
require_once __DIR__ . '/../../auth/session_guard.php';
require_once dirname(__DIR__, 2) . '/config.php';

header('Content-Type: application/json');

if (!isset($_SESSION['email']) || $_SESSION['role'] !== 'teacher') {
    echo json_encode(['error' => 'Unauthorized']);
    exit();
}

$email = $_SESSION['email'];

$yearResult      = $conn->query("SELECT id FROM academic_years WHERE is_current = 1 LIMIT 1");
$current_year_id = (int)$yearResult->fetch_assoc()['id'];

$termResult   = $conn->query("SELECT current_global_term FROM platform_settings LIMIT 1");
$current_term = (int)$termResult->fetch_assoc()['current_global_term'];

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
$stmt->bind_param("si", $email, $current_year_id);
$stmt->execute();
$rows = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
$stmt->close();

$grouped = [];
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
            'subject'       => null
        ];
        $class_ids[] = $class_id;
    }
}

ksort($grouped);

// Fetch custom subjects
if (!empty($class_ids)) {
    $placeholders = implode(',', array_fill(0, count($class_ids), '?'));
    $types        = 's' . str_repeat('i', count($class_ids));
    $params       = array_merge([$email], $class_ids);

    $sql  = "SELECT class_id, subject_name FROM teacher_subjects 
             WHERE teacher_email = ? AND class_id IN ($placeholders)";
    $stmt = $conn->prepare($sql);
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
        'classes' => array_values($termData['classes'])
    ];
}

echo json_encode([
    'terms'        => $output,
    'current_term' => $current_term
]);