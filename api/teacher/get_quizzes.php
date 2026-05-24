<?php
require_once __DIR__ . '/../../auth/session_guard.php';
require_once dirname(__DIR__, 2) . '/config.php';

header('Content-Type: application/json');

if (!isset($_SESSION['email']) || $_SESSION['role'] !== 'teacher') {
    echo json_encode(['error' => 'Unauthorized']);
    exit();
}

$email = $_SESSION['email'];

$yearResult = $conn->query("SELECT id, name FROM academic_years WHERE is_current = 1 LIMIT 1");
$yearRow    = $yearResult->fetch_assoc();
$current_year_id   = (int)$yearRow['id'];
$current_year_name = $yearRow['name'];

$termResult   = $conn->query("SELECT current_global_term FROM platform_settings LIMIT 1");
$current_term = (int)$termResult->fetch_assoc()['current_global_term'];

$stmt = $conn->prepare("
    SELECT q.id, q.title, q.duration, q.publish_marks, q.start_time, q.status, q.term_number,
           c.id AS class_id, c.name AS class_name
    FROM quizzes q
    INNER JOIN classes c ON q.class_id = c.id
    WHERE q.created_by = ?
      AND q.academic_year_id = ?
    ORDER BY q.term_number ASC, c.name ASC, q.start_time DESC
");
$stmt->bind_param("si", $email, $current_year_id);
$stmt->execute();
$rows = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
$stmt->close();

$terms = [];
foreach ($rows as $row) {
    $term     = (int)$row['term_number'];
    $class_id = $row['class_id'];

    if (!isset($terms[$term])) {
        $terms[$term] = ['term' => $term, 'classes' => []];
    }
    if (!isset($terms[$term]['classes'][$class_id])) {
        $terms[$term]['classes'][$class_id] = [
            'class_name' => $row['class_name'],
            'quizzes'    => []
        ];
    }
    $terms[$term]['classes'][$class_id]['quizzes'][] = [
        'id'            => $row['id'],
        'title'         => $row['title'],
        'duration'      => $row['duration'],
        'publish_marks' => (int)$row['publish_marks'],
        'start_time'    => $row['start_time']
            ? date('d M Y, g:i A', strtotime($row['start_time']))
            : 'Not set',
        'status'        => $row['status'] ?? 'Closed'
    ];
}
ksort($terms);

$output = [];
foreach ($terms as $term => $data) {
    $classes = array_values($data['classes']);
    $output[] = ['term' => $term, 'classes' => $classes];
}

echo json_encode([
    'terms'        => $output,
    'current_term' => $current_term,
    'year_name'    => $current_year_name
]);