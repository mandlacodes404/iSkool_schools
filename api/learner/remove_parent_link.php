<?php
/**
 * api/learner/remove_parent_link.php
 * A learner removes one of their own parent links (POST, learner only). The row must belong to this learner.
 */

require_once __DIR__ . '/../../auth/session_guard.php';
require_once __DIR__ . '/../../auth/csrf_helper.php';
require_once dirname(__DIR__, 2) . '/config.php';

header('Content-Type: application/json');

if (!isset($_SESSION['email']) || ($_SESSION['role'] ?? '') !== 'learner') {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'Unauthorized']);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method not allowed']);
    exit;
}

verify_csrf_token();

$learner_email = $_SESSION['email'];
$link_id       = (int) ($_POST['id'] ?? 0);

if ($link_id <= 0) {
    echo json_encode(['success' => false, 'error' => 'Missing data']);
    exit;
}

try {
    $stmt = $conn->prepare('DELETE FROM parent_links WHERE id = ? AND learner_email = ?');
    $stmt->bind_param('is', $link_id, $learner_email);
    $stmt->execute();
    $removed = $stmt->affected_rows;
    $stmt->close();

    if ($removed !== 1) {
        http_response_code(404);
        echo json_encode(['success' => false, 'error' => 'That parent link was not found.']);
        exit;
    }

    echo json_encode(['success' => true]);
} catch (Throwable $e) {
    error_log('remove_parent_link failed: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Could not remove the parent link. Please try again.']);
}
