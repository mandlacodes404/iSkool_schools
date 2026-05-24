<?php
require_once __DIR__ . '/../../auth/session_guard.php';
require_once __DIR__ . '/../../auth/csrf_helper.php';
header('Content-Type: application/json');
require_once dirname(__DIR__, 2) . '/config.php';

if (!isset($_SESSION['email']) || $_SESSION['role'] !== 'teacher') {
    echo json_encode(['error' => 'Unauthorized']); exit();
}

verify_csrf_token();

$email = $_SESSION['email'];
$data  = json_decode(file_get_contents('php://input'), true);

$title = trim($data['title'] ?? '');
$date  = trim($data['date']  ?? '');

if (!$title || !$date) {
    echo json_encode(['error' => 'Title and date are required']); exit();
}

$stmt = $conn->prepare("
    INSERT INTO teacher_reminders (user_email, title, event_date)
    VALUES (?, ?, ?)
");
$stmt->bind_param("sss", $email, $title, $date);
$stmt->execute();
$id = $stmt->insert_id;
$stmt->close();

echo json_encode(['success' => true, 'id' => $id]);
?>