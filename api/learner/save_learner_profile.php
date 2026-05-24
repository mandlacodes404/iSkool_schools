<?php
/**
 * api/learner/save_learner_profile.php
 *
 * Saves the learner's personal information fields.
 * Called by saveLearnerPersonalInfo() in learner_dashboard.php
 *
 * Accepts POST fields:
 *   date_of_birth, id_number, address,
 *   guardian_name, guardian_relationship, guardian_phone, guardian_email,
 *   emergency_contact_name, emergency_contact_phone, medical_notes
 *
 * Response: { "success": true }
 *        or { "success": false, "error": "..." }
 */

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method not allowed']);
    exit();
}

require_once __DIR__ . '/../../auth/session_guard.php';
require_once __DIR__ . '/../../auth/csrf_helper.php';
require_once __DIR__ . '/../../config.php';

// Auth guard
if (!isset($_SESSION['email']) || $_SESSION['role'] !== 'learner') {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'Not authorised']);
    exit();
}

verify_csrf_token();

$email = $_SESSION['email'];

// Sanitise inputs
$date_of_birth           = trim($_POST['date_of_birth']           ?? '');
$id_number               = trim($_POST['id_number']               ?? '');
$address                 = trim($_POST['address']                 ?? '');
$guardian_name           = trim($_POST['guardian_name']           ?? '');
$guardian_relationship   = trim($_POST['guardian_relationship']   ?? '');
$guardian_phone          = trim($_POST['guardian_phone']          ?? '');
$guardian_email          = trim($_POST['guardian_email']          ?? '');
$emergency_contact_name  = trim($_POST['emergency_contact_name']  ?? '');
$emergency_contact_phone = trim($_POST['emergency_contact_phone'] ?? '');
$medical_notes           = trim($_POST['medical_notes']           ?? '');

// Basic validation
if (!empty($date_of_birth) && !preg_match('/^\d{4}-\d{2}-\d{2}$/', $date_of_birth)) {
    echo json_encode(['success' => false, 'error' => 'Invalid date of birth format']);
    exit();
}

if (!empty($id_number) && !preg_match('/^\d{6,13}$/', $id_number)) {
    echo json_encode(['success' => false, 'error' => 'ID number must be 6–13 digits']);
    exit();
}

if (!empty($guardian_email) && !filter_var($guardian_email, FILTER_VALIDATE_EMAIL)) {
    echo json_encode(['success' => false, 'error' => 'Guardian email address is not valid']);
    exit();
}

// Nullify empty date (MySQL doesn't accept empty string for DATE columns)
$dob = !empty($date_of_birth) ? $date_of_birth : null;

// Calculate profile_status — complete if all 10 fields are filled
$allFields = [
    $date_of_birth, $id_number, $address,
    $guardian_name, $guardian_relationship, $guardian_phone, $guardian_email,
    $emergency_contact_name, $emergency_contact_phone, $medical_notes
];
$profileStatus = (count(array_filter($allFields, fn($f) => $f !== '')) === count($allFields))
    ? 'complete'
    : 'incomplete';

$stmt = $conn->prepare("
    UPDATE users SET
        date_of_birth           = ?,
        id_number               = ?,
        address                 = ?,
        guardian_name           = ?,
        guardian_relationship   = ?,
        guardian_phone          = ?,
        guardian_email          = ?,
        emergency_contact_name  = ?,
        emergency_contact_phone = ?,
        medical_notes           = ?,
        profile_status          = ?
    WHERE email = ?
");

if (!$stmt) {
    echo json_encode(['success' => false, 'error' => 'Query preparation failed']);
    exit();
}

// MySQLi bind_param with nullable date — assign null to variable first
$stmt->bind_param(
    "ssssssssssss",
    $dob,
    $id_number,
    $address,
    $guardian_name,
    $guardian_relationship,
    $guardian_phone,
    $guardian_email,
    $emergency_contact_name,
    $emergency_contact_phone,
    $medical_notes,
    $profileStatus,
    $email
);

if ($stmt->execute()) {
    echo json_encode(['success' => true, 'profile_status' => $profileStatus]);
} else {
    echo json_encode(['success' => false, 'error' => 'Failed to save profile. Please try again.']);
}

$stmt->close();
exit();