<?php
session_start();
include("config.php");

if (!isset($_SESSION['email']) || $_SESSION['role'] !== 'teacher') {
    http_response_code(403);
    echo json_encode(['success' => false, 'message' => 'Unauthorized']);
    exit();
}

$email = $_SESSION['email'];

$data = json_decode(file_get_contents('php://input'), true);
$quizId = intval($data['quiz_id'] ?? 0);

if ($quizId <= 0) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Invalid quiz ID']);
    exit();
}

// Check if this quiz belongs to this teacher
$stmt = $conn->prepare("
    SELECT q.publish_marks 
    FROM quizzes q
    INNER JOIN classes c ON q.class_id = c.id
    WHERE q.id = ? AND q.created_by = ?
");
$stmt->bind_param("is", $quizId, $email);
$stmt->execute();
$stmt->bind_result($currentPublish);
if (!$stmt->fetch()) {
    $stmt->close();
    http_response_code(404);
    echo json_encode(['success' => false, 'message' => 'Quiz not found']);
    exit();
}
$stmt->close();

// Toggle the publish_marks value
$newPublish = $currentPublish ? 0 : 1;

$update = $conn->prepare("UPDATE quizzes SET publish_marks = ? WHERE id = ?");
$update->bind_param("ii", $newPublish, $quizId);
$update->execute();
$update->close();

echo json_encode(['success' => true, 'newStatus' => $newPublish]);
