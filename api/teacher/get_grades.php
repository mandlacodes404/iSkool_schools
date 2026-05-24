<?php
require_once __DIR__ . '/../../auth/session_guard.php';
require_once dirname(__DIR__, 2) . '/config.php';

header('Content-Type: application/json');

if (!isset($_SESSION['email']) || $_SESSION['role'] !== 'teacher') {
    echo json_encode(['error' => 'Unauthorized']);
    exit();
}

$email = $_SESSION['email'];

$yearResult = $conn->query("SELECT id FROM academic_years WHERE is_current = 1 LIMIT 1");
if ($yearResult->num_rows === 0) {
    $yearResult = $conn->query("SELECT id FROM academic_years ORDER BY id DESC LIMIT 1");
}
$current_year_id = (int)$yearResult->fetch_assoc()['id'];

$stmt = $conn->prepare("
    SELECT q.id, q.title, q.created_at, q.term_number,
           c.id AS class_id, c.name AS class_name
    FROM quizzes q
    JOIN classes c ON q.class_id = c.id
    WHERE q.created_by = ?
      AND q.academic_year_id = ?
    ORDER BY q.term_number ASC, c.name ASC, q.created_at DESC
");
$stmt->bind_param("si", $email, $current_year_id);
$stmt->execute();
$rows = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
$stmt->close();

$grouped = [];
foreach ($rows as $row) {
    $term = (int)$row['term_number'];
    $cid  = $row['class_id'];

    if (!isset($grouped[$term])) {
        $grouped[$term] = ['term' => $term, 'classes' => []];
    }
    if (!isset($grouped[$term]['classes'][$cid])) {
        $grouped[$term]['classes'][$cid] = [
            'class_name' => $row['class_name'],
            'quizzes'    => []
        ];
    }
    $grouped[$term]['classes'][$cid]['quizzes'][] = [
        'id'         => $row['id'],
        'title'      => $row['title'],
        'created_at' => $row['created_at']
            ? date('d M Y', strtotime($row['created_at']))
            : ''
    ];
}

ksort($grouped);

// Re-index for JSON
$output = [];
foreach ($grouped as $term => $termData) {
    $classes = [];
    foreach ($termData['classes'] as $classData) {
        $classes[] = $classData;
    }
    $output[] = ['term' => $term, 'classes' => $classes];
}

echo json_encode($output);