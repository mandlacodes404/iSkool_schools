<?php
session_start();
require_once 'config.php';

$userId = $_SESSION['user_id'] ?? 0;
$schoolId = $_SESSION['school_id'] ?? 0;
if (!$userId || !$schoolId) {
    echo json_encode([]);
    exit();
}

$achieverId = intval($_POST['achiever_id'] ?? 0);
if ($achieverId <= 0) {
    echo json_encode([]);
    exit();
}

// Verify achiever belongs to the same school
$stmt = $conn->prepare("SELECT id FROM top_achievers WHERE id=? AND school_id=?");
$stmt->bind_param("ii", $achieverId, $schoolId);
$stmt->execute();
$res = $stmt->get_result();
if ($res->num_rows === 0) {
    echo json_encode([]);
    exit();
}
$stmt->close();

// Fetch comments with user names
$stmt = $conn->prepare("
    SELECT c.comment, u.full_name 
    FROM achiever_comments c
    JOIN users u ON u.id = c.user_id
    WHERE c.achiever_id=?
    ORDER BY c.created_at ASC
");
$stmt->bind_param("i", $achieverId);
$stmt->execute();
$result = $stmt->get_result();

$comments = [];
while ($row = $result->fetch_assoc()) {
    $comments[] = [
        'user' => $row['full_name'],
        'comment' => $row['comment']
    ];
}

$stmt->close();

header('Content-Type: application/json');
echo json_encode($comments);
exit();
?>
