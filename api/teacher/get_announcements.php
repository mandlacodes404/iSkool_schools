<?php
session_start();
require_once dirname(__DIR__, 2) . '/config.php';

header('Content-Type: application/json');

if (!isset($_SESSION['email']) || $_SESSION['role'] !== 'teacher') {
    echo json_encode(['error' => 'Unauthorized']);
    exit();
}

$email = $_SESSION['email'];

$currentYearResult = $conn->query("SELECT id FROM academic_years WHERE is_current = 1 LIMIT 1");
if ($currentYearResult->num_rows === 0) {
    echo json_encode(['error' => 'No active academic year']);
    exit();
}
$current_academic_year_id = (int)$currentYearResult->fetch_assoc()['id'];

$stmt = $conn->prepare("
    SELECT 
        a.id, a.title, a.message, a.created_at,
        c.id AS class_id, c.name AS class_name
    FROM announcements a
    JOIN classes c ON a.class_id = c.id
    WHERE a.created_by = ?
      AND a.academic_year_id = ?
    ORDER BY a.created_at DESC
");
$stmt->bind_param("si", $email, $current_academic_year_id);
$stmt->execute();
$result = $stmt->get_result();

$grouped = [];
while ($row = $result->fetch_assoc()) {
    $cid = $row['class_id'];
    if (!isset($grouped[$cid])) {
        $grouped[$cid] = [
            'class_name' => $row['class_name'],
            'items'      => []
        ];
    }
    $grouped[$cid]['items'][] = [
        'id'         => $row['id'],
        'title'      => $row['title'],
        'message'    => $row['message'],
        'created_at' => $row['created_at'],
        'display_date' => date('d M Y, H:i', strtotime($row['created_at']))
    ];
}
$stmt->close();

echo json_encode(array_values($grouped));