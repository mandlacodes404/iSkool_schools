<?php
session_start();
require_once 'config.php';

if (!isset($_SESSION['school_admin'])) {
    http_response_code(403);
    echo json_encode([]);
    exit();
}

$schoolId = $_SESSION['school_id'];

$term = $_GET['term'] ?? '';
$term = trim($term);

if ($term === '') {
    echo json_encode([]);
    exit();
}

// Prepare query to search learners and their classes by partial name
$sql = "
SELECT users.name, classes.name AS class_name
FROM users
LEFT JOIN class_students ON users.email = class_students.student_email
LEFT JOIN classes ON class_students.class_id = classes.id
WHERE users.school_id = ? AND users.role = 'user' AND users.name LIKE CONCAT('%', ?, '%')
ORDER BY users.name ASC
LIMIT 10
";

$stmt = $conn->prepare($sql);
$stmt->bind_param("is", $schoolId, $term);
$stmt->execute();
$result = $stmt->get_result();

$suggestions = [];
while ($row = $result->fetch_assoc()) {
    $suggestions[] = [
        'label' => $row['name'] . " (" . ($row['class_name'] ?: "Unassigned") . ")",
        'value' => $row['name'],
    ];
}

header('Content-Type: application/json');
echo json_encode($suggestions);
