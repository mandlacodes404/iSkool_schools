<?php
require_once __DIR__ . '/../../auth/session_guard.php';
require_once __DIR__ . '/../../auth/csrf_helper.php';
require_once dirname(__DIR__, 2) . '/config.php';

header('Content-Type: application/json');

if (!isset($_SESSION['email']) || $_SESSION['role'] !== 'learner') {
    http_response_code(401);
    echo json_encode(['error' => 'Unauthorized']);
    exit();
}

verify_csrf_token();

$learner_email = $_SESSION['email'];
$discussion_id = (int)($_POST['discussion_id'] ?? 0);
$reply_id = (int)($_POST['reply_id'] ?? 0);
$reason = $_POST['reason'] ?? '';
$comment = trim($_POST['comment'] ?? '');
$allowed_reasons = ['bullying', 'inappropriate', 'off_topic', 'spam', 'other'];

if (!$discussion_id || !$reply_id || !in_array($reason, $allowed_reasons, true)) {
    http_response_code(422);
    echo json_encode(['error' => 'Invalid report details.']);
    exit();
}

if (mb_strlen($comment) > 2000) {
    http_response_code(422);
    echo json_encode(['error' => 'Your comment must be 2,000 characters or fewer.']);
    exit();
}

$year_stmt = $conn->prepare('SELECT id FROM academic_years WHERE is_current = 1 LIMIT 1');
$year_stmt->execute();
$year = $year_stmt->get_result()->fetch_assoc();
$year_stmt->close();
$academic_year_id = (int)($year['id'] ?? 0);

if (!$academic_year_id) {
    http_response_code(409);
    echo json_encode(['error' => 'No active academic year.']);
    exit();
}

// A learner may report only a reply in a discussion belonging to their current class.
$access_stmt = $conn->prepare(
    'SELECT 1
     FROM class_discussions d
     INNER JOIN discussion_replies r ON r.discussion_id = d.id AND r.id = ?
     INNER JOIN class_students cs ON cs.class_id = d.class_id
        AND cs.student_email = ? AND cs.academic_year_id = ?
     WHERE d.id = ? AND d.academic_year_id = ?
     LIMIT 1'
);
$access_stmt->bind_param('isiii', $reply_id, $learner_email, $academic_year_id, $discussion_id, $academic_year_id);
$access_stmt->execute();
$has_access = $access_stmt->get_result()->num_rows === 1;
$access_stmt->close();

if (!$has_access) {
    http_response_code(403);
    echo json_encode(['error' => 'You cannot report this reply.']);
    exit();
}

// Treat a retry of the same report as successful rather than creating duplicates.
$existing_stmt = $conn->prepare(
    'SELECT id FROM discussion_reports
     WHERE discussion_id = ? AND reply_id = ? AND reporter_email = ?
     LIMIT 1'
);
$existing_stmt->bind_param('iis', $discussion_id, $reply_id, $learner_email);
$existing_stmt->execute();
$already_reported = $existing_stmt->get_result()->num_rows > 0;
$existing_stmt->close();

if ($already_reported) {
    echo json_encode(['success' => true, 'already_reported' => true]);
    exit();
}

$insert_stmt = $conn->prepare(
    'INSERT INTO discussion_reports
     (discussion_id, reply_id, academic_year_id, reporter_email, reason, comment)
     VALUES (?, ?, ?, ?, ?, ?)'
);
$insert_stmt->bind_param(
    'iiisss',
    $discussion_id,
    $reply_id,
    $academic_year_id,
    $learner_email,
    $reason,
    $comment
);

if (!$insert_stmt->execute()) {
    $insert_stmt->close();
    http_response_code(500);
    echo json_encode(['error' => 'Unable to submit the report.']);
    exit();
}

$insert_stmt->close();
echo json_encode(['success' => true]);
