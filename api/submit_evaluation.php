<?php
session_start();
require_once '../config.php';

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST' || !isset($_SESSION['email'])) {
    echo json_encode(['success' => false, 'message' => 'Invalid request']); exit;
}

$learner_email = $_SESSION['email'];
$eval_id = (int)$_POST['eval_id'];
$comments = trim($_POST['comments'] ?? '');

// Get class_id
$yearRes = $conn->query("SELECT id FROM academic_years WHERE is_current = 1 LIMIT 1");
$academic_id = $yearRes->fetch_assoc()['id'];
$classStmt = $conn->prepare("SELECT class_id FROM class_students WHERE student_email = ? AND academic_year_id = ?");
$classStmt->bind_param("si", $learner_email, $academic_id);
$classStmt->execute();
$class_id = $classStmt->get_result()->fetch_assoc()['class_id'];

$hash = hash('sha256', $learner_email . $eval_id . 'salt123');

// Check duplicate
$check = $conn->prepare("SELECT 1 FROM evaluation_responses WHERE evaluation_id = ? AND unique_hash = ?");
$check->bind_param("is", $eval_id, $hash);
$check->execute();
if ($check->get_result()->num_rows > 0) {
    echo json_encode(['success' => false, 'message' => 'Already submitted.']); exit;
}

// Insert Response
$stmt = $conn->prepare("INSERT INTO evaluation_responses (evaluation_id, class_id, comments, unique_hash) VALUES (?, ?, ?, ?)");
$stmt->bind_param("iiss", $eval_id, $class_id, $comments, $hash);
$stmt->execute();
$response_id = $stmt->insert_id;

// Insert Answers
$ansStmt = $conn->prepare("INSERT INTO evaluation_answers (response_id, statement_id, answer) VALUES (?, ?, ?)");
foreach ($_POST['answer'] ?? [] as $stmt_id => $answer) {
    $stmt_id = (int)$stmt_id;
    $ansStmt->bind_param("iis", $response_id, $stmt_id, $answer);
    $ansStmt->execute();
}

echo json_encode(['success' => true]);