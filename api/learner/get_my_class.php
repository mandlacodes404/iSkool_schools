<?php
/**
 * api/learner/get_my_class.php
 * Returns the class the logged-in learner has joined, and the school
 * name — even if the learner hasn't joined a class yet. When there's
 * no class, `id`/`name` are null but `school_name` is still populated.
 */
require_once __DIR__ . '/../../auth/session_guard.php';
require_once dirname(__DIR__, 2) . '/config.php';

header('Content-Type: application/json');

if (!isset($_SESSION['email']) || $_SESSION['role'] !== 'learner') {
    echo json_encode(null);
    exit();
}

$learnerEmail = $_SESSION['email'];

// Get current academic year
$yearRow = $conn->query("SELECT id FROM academic_years WHERE is_current = 1 LIMIT 1")->fetch_assoc();
$yearId  = $yearRow ? (int)$yearRow['id'] : 0;

// Find the class the learner has joined
if ($yearId > 0) {
    $stmt = $conn->prepare("
        SELECT c.id, c.name
        FROM class_students cs
        JOIN classes c ON c.id = cs.class_id
        WHERE cs.student_email = ? AND cs.academic_year_id = ?
        LIMIT 1
    ");
    $stmt->bind_param("si", $learnerEmail, $yearId);
} else {
    $stmt = $conn->prepare("
        SELECT c.id, c.name
        FROM class_students cs
        JOIN classes c ON c.id = cs.class_id
        WHERE cs.student_email = ?
        LIMIT 1
    ");
    $stmt->bind_param("s", $learnerEmail);
}

$stmt->execute();
$row = $stmt->get_result()->fetch_assoc();
$stmt->close();

// No class joined yet — still return school/learner info so the UI can
// show the school name without a class attached, instead of bailing
// out with a bare null.
if (!$row) {
    $row = ['id' => null, 'name' => null];
}

// Learner name/surname
$nameStmt = $conn->prepare("SELECT name, surname FROM users WHERE email = ? LIMIT 1");
$nameStmt->bind_param("s", $learnerEmail);
$nameStmt->execute();
$nameRow = $nameStmt->get_result()->fetch_assoc();
$nameStmt->close();

$row['learner_name']    = $nameRow['name'] ?? '';
$row['learner_surname'] = $nameRow['surname'] ?? '';

// School name
$schoolName = 'My School'; // fallback only
$schoolResult = $conn->query("SELECT setting_value FROM school_name WHERE setting_key = 'school_name' LIMIT 1");
if ($schoolRow = $schoolResult->fetch_assoc()) {
    $schoolName = $schoolRow['setting_value'];
}
$row['school_name'] = $schoolName;

echo json_encode($row);