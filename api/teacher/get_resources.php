<?php
session_start();
require_once dirname(__DIR__, 2) . '/config.php';

header('Content-Type: application/json');

if (!isset($_SESSION['email']) || $_SESSION['role'] !== 'teacher') {
    echo json_encode(['error' => 'Unauthorized']);
    exit();
}

$email = $_SESSION['email'];

$yearResult = $conn->query("SELECT id FROM academic_years WHERE is_current = 1 LIMIT 1");
if ($yearResult->num_rows === 0) {
    echo json_encode(['error' => 'No active academic year']);
    exit();
}
$current_year_id = (int)$yearResult->fetch_assoc()['id'];

$stmt = $conn->prepare("
    SELECT r.id, r.title, r.filename, r.uploaded_at,
           c.id AS class_id, c.name AS class_name
    FROM resources r
    JOIN classes c ON r.class_id = c.id
    WHERE r.uploaded_by = ?
      AND r.academic_year_id = ?
    ORDER BY c.name ASC, r.uploaded_at DESC
");
$stmt->bind_param("si", $email, $current_year_id);
$stmt->execute();
$rows = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
$stmt->close();

$grouped = [];
foreach ($rows as $row) {
    $cid = $row['class_id'];
    if (!isset($grouped[$cid])) {
        $grouped[$cid] = [
            'class_name' => $row['class_name'],
            'items'      => []
        ];
    }
    $ext = strtolower(pathinfo($row['filename'], PATHINFO_EXTENSION));
    $grouped[$cid]['items'][] = [
        'id'          => $row['id'],
        'title'       => $row['title'],
        'filename'    => $row['filename'],
        'ext'         => $ext,
        'uploaded_at' => date('d M Y, H:i', strtotime($row['uploaded_at']))
    ];
}

echo json_encode(array_values($grouped));