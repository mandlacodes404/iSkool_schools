<?php
require_once __DIR__ . '/../../auth/session_guard.php';
require_once __DIR__ . '/../../auth/csrf_helper.php';
header('Content-Type: application/json');
require_once dirname(__DIR__, 2) . '/config.php';

if (!isset($_SESSION['email']) || $_SESSION['role'] !== 'teacher') {
    echo json_encode(['success' => false, 'error' => 'Unauthorized']); exit();
}

$email = $_SESSION['email'];
$input = json_decode(file_get_contents('php://input'), true);

verify_csrf_token();

$class_id     = isset($input['class_id']) ? (int)$input['class_id'] : 0;
$subject_name = isset($input['subject_name']) ? trim($input['subject_name']) : '';

if (!$class_id) {
    echo json_encode(['success' => false, 'error' => 'Please select a class.']); exit();
}
if ($subject_name === '') {
    echo json_encode(['success' => false, 'error' => 'Please enter a subject.']); exit();
}

// Confirm the class actually exists (defends against a tampered class_id).
$stmt = $conn->prepare("SELECT id FROM classes WHERE id = ?");
$stmt->bind_param("i", $class_id);
$stmt->execute();
if ($stmt->get_result()->num_rows === 0) {
    $stmt->close();
    echo json_encode(['success' => false, 'error' => 'Class not found.']); exit();
}
$stmt->close();

// One row per (teacher_email, class_id) — if the teacher already has a
// subject set for this class, update it; otherwise insert. This is the
// same table both "+ Add class" and "+ Add subject" write to, since
// adding a class with a subject and naming a subject for an
// already-listed class are the same underlying operation.
$stmt = $conn->prepare("SELECT id FROM teacher_subjects WHERE teacher_email = ? AND class_id = ?");
$stmt->bind_param("si", $email, $class_id);
$stmt->execute();
$existing = $stmt->get_result()->fetch_assoc();
$stmt->close();

if ($existing) {
    $stmt = $conn->prepare("UPDATE teacher_subjects SET subject_name = ? WHERE id = ?");
    $stmt->bind_param("si", $subject_name, $existing['id']);
} else {
    $stmt = $conn->prepare("INSERT INTO teacher_subjects (teacher_email, class_id, subject_name) VALUES (?, ?, ?)");
    $stmt->bind_param("sis", $email, $class_id, $subject_name);
}

if ($stmt->execute()) {
    echo json_encode(['success' => true]);
} else {
    echo json_encode(['success' => false, 'error' => 'Failed to save.']);
}
$stmt->close();
