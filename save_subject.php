<?php
// save_subject.php
session_start();
include("config.php");

if (!isset($_SESSION['email']) || $_SESSION['role'] !== 'teacher') {
    echo json_encode(['success' => false, 'message' => 'Unauthorized']);
    exit();
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST' || !isset($_POST['class_id']) || !isset($_POST['subject_name'])) {
    echo json_encode(['success' => false, 'message' => 'Invalid request']);
    exit();
}

$teacher_email = $_SESSION['email'];
$class_id = intval($_POST['class_id']);
$subject_name = trim($_POST['subject_name']);

if (empty($subject_name)) {
    echo json_encode(['success' => false, 'message' => 'Subject name cannot be empty']);
    exit();
}

// Clean and format: "english hl" → "English Hl"
$subject_name = ucwords(strtolower($subject_name));

// Insert or update (UPSERT)
$sql = "INSERT INTO teacher_subjects (teacher_email, class_id, subject_name) 
        VALUES (?, ?, ?) 
        ON DUPLICATE KEY UPDATE subject_name = ?, updated_at = CURRENT_TIMESTAMP";

$stmt = $conn->prepare($sql);
$stmt->bind_param("siss", $teacher_email, $class_id, $subject_name, $subject_name);

if ($stmt->execute()) {
    echo json_encode(['success' => true, 'subject_name' => $subject_name]);
} else {
    echo json_encode(['success' => false, 'message' => 'Database error']);
}

$stmt->close();
?>