<?php
require_once __DIR__ . '/../../auth/session_guard.php';
require_once dirname(__DIR__, 2) . '/config.php';

header('Content-Type: application/json');

if (!isset($_SESSION['email']) || $_SESSION['role'] !== 'teacher') {
    echo json_encode(['success' => false, 'error' => 'Unauthorized']);
    exit();
}

$email = $_SESSION['email'];
$id    = (int)($_POST['id'] ?? 0);

if ($id <= 0) {
    echo json_encode(['success' => false, 'error' => 'Invalid resource ID']);
    exit();
}

$stmt = $conn->prepare("SELECT filename FROM resources WHERE id = ? AND uploaded_by = ?");
$stmt->bind_param("is", $id, $email);
$stmt->execute();
$row = $stmt->get_result()->fetch_assoc();
$stmt->close();

if (!$row) {
    echo json_encode(['success' => false, 'error' => 'Resource not found']);
    exit();
}

$filePath = dirname(__DIR__, 2) . '/resources/' . $row['filename'];
if (file_exists($filePath)) {
    unlink($filePath);
}

$del = $conn->prepare("DELETE FROM resources WHERE id = ? AND uploaded_by = ?");
$del->bind_param("is", $id, $email);
$del->execute();
$del->close();

echo json_encode(['success' => true]);