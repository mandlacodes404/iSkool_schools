<?php
session_start();
include("config.php");

if (!isset($_SESSION['email']) || $_SESSION['role'] !== 'teacher') {
    http_response_code(403);
    echo json_encode(['success' => false, 'message' => 'Unauthorized access']);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);
$quiz_id = isset($input['quiz_id']) ? intval($input['quiz_id']) : 0;
$new_status = isset($input['status']) ? $input['status'] : '';

if ($quiz_id < 1 || !in_array($new_status, ['Open', 'Closed'])) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Invalid quiz ID or status']);
    exit;
}

// Verify the teacher owns the quiz
$stmt = $conn->prepare("SELECT created_by FROM quizzes WHERE id = ?");
$stmt->bind_param("i", $quiz_id);
$stmt->execute();
$result = $stmt->get_result();
if ($result->num_rows === 0 || $result->fetch_assoc()['created_by'] !== $_SESSION['email']) {
    http_response_code(403);
    echo json_encode(['success' => false, 'message' => 'You do not own this quiz']);
    exit;
}
$stmt->close();

// Update quiz status
$stmt = $conn->prepare("UPDATE quizzes SET status = ? WHERE id = ?");
$stmt->bind_param("si", $new_status, $quiz_id);
$success = $stmt->execute();
$stmt->close();

if ($success) {
    echo json_encode(['success' => true, 'newStatus' => $new_status]);
} else {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Failed to update quiz status']);
}
exit;