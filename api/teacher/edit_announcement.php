<?php
/**
 * iSkool — api/teacher/edit_announcement.php
 * Role: teacher
 *
 * Lets a teacher edit the title/message of an announcement THEY created
 * for one of THEIR classes. School-wide announcements (class_id IS NULL,
 * created by admin) can never be edited from here.
 *
 * On the first edit only, the pre-edit message is snapshotted into
 * `original_message` and `edited_at` is stamped. Later edits update
 * `message`/`edited_at` again but leave `original_message` alone, so it
 * always holds the version learners originally saw — this is what the
 * learner-side view diffs against to highlight what changed.
 *
 * POST params: id, title, message
 * Response: { success: true } or { success: false, error }
 */

require_once __DIR__ . '/../../auth/session_guard.php';
require_once __DIR__ . '/../../auth/csrf_helper.php';
require_once dirname(__DIR__, 2) . '/config.php';

header('Content-Type: application/json');

if (!isset($_SESSION['email']) || $_SESSION['role'] !== 'teacher') {
    echo json_encode(['success' => false, 'error' => 'Unauthorized']);
    exit();
}

verify_csrf_token();

$email = $_SESSION['email'];

$id      = (int)($_POST['id'] ?? 0);
$title   = trim($_POST['title'] ?? '');
$message = trim($_POST['message'] ?? '');

if ($id <= 0 || empty($title) || empty($message)) {
    echo json_encode(['success' => false, 'error' => 'Please fill in all fields.']);
    exit();
}

// Fetch the announcement and confirm it belongs to this teacher and is a
// class-level announcement (never allow editing school-wide/admin ones).
$stmt = $conn->prepare("
    SELECT message, original_message
    FROM announcements
    WHERE id = ? AND created_by = ? AND class_id IS NOT NULL
    LIMIT 1
");
$stmt->bind_param("is", $id, $email);
$stmt->execute();
$existing = $stmt->get_result()->fetch_assoc();
$stmt->close();

if (!$existing) {
    echo json_encode(['success' => false, 'error' => 'Announcement not found or you do not have permission to edit it.']);
    exit();
}

// Only snapshot the original message the first time this announcement is edited.
if ($existing['original_message'] === null) {
    $updateStmt = $conn->prepare("
        UPDATE announcements
        SET title = ?, message = ?, original_message = ?, edited_at = NOW()
        WHERE id = ?
    ");
    $updateStmt->bind_param("sssi", $title, $message, $existing['message'], $id);
} else {
    $updateStmt = $conn->prepare("
        UPDATE announcements
        SET title = ?, message = ?, edited_at = NOW()
        WHERE id = ?
    ");
    $updateStmt->bind_param("ssi", $title, $message, $id);
}
$updateStmt->execute();
$updateStmt->close();

echo json_encode(['success' => true]);
