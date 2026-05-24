<?php
/**
 * api/learner/get_learner_profile.php
 *
 * Returns the logged-in learner's editable profile fields.
 * Called by loadLearnerPersonalInfo() in learner_dashboard.php
 *
 * Response: { "success": true, "profile": { ...fields } }
 *        or { "success": false, "error": "..." }
 */

header('Content-Type: application/json');

require_once __DIR__ . '/../../auth/session_guard.php';
require_once __DIR__ . '/../../config.php';

// Auth guard
if (!isset($_SESSION['email']) || $_SESSION['role'] !== 'learner') {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'Not authorised']);
    exit();
}

$email = $_SESSION['email'];

$stmt = $conn->prepare("
    SELECT
        date_of_birth,
        id_number,
        address,
        guardian_name,
        guardian_relationship,
        guardian_phone,
        guardian_email,
        emergency_contact_name,
        emergency_contact_phone,
        medical_notes,
        profile_status
    FROM users
    WHERE email = ?
    LIMIT 1
");

if (!$stmt) {
    echo json_encode(['success' => false, 'error' => 'Query preparation failed']);
    exit();
}

$stmt->bind_param("s", $email);
$stmt->execute();
$result = $stmt->get_result();

if ($row = $result->fetch_assoc()) {
    echo json_encode(['success' => true, 'profile' => $row]);
} else {
    echo json_encode(['success' => false, 'error' => 'User not found']);
}

$stmt->close();
exit();