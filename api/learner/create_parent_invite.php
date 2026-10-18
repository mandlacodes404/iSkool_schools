<?php
/**
 * api/learner/create_parent_invite.php
 * A learner creates a one-use invite link for a parent (POST, learner only).
 * Returns the raw code once; only its SHA-256 hash is stored. The page builds the link itself
 * (origin + /parent_link.php?code=...), so nothing here depends on BASE_URL.
 */

require_once __DIR__ . '/../../auth/session_guard.php';
require_once __DIR__ . '/../../auth/csrf_helper.php';
require_once __DIR__ . '/../../auth/rate_limit_functions.php';
require_once __DIR__ . '/../../auth/parent_invite_functions.php';
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

// At most 10 new invites per learner per hour.
$window_seconds = 3600;
if (auth_rate_limit_is_blocked($conn, 'parent_invite_create', 'account', $learner_email, 10, $window_seconds)) {
    http_response_code(429);
    echo json_encode(['success' => false, 'error' => 'You have created a lot of invites. Please try again in a while.']);
    exit;
}

try {
    $now_ts  = time();
    $now     = date('Y-m-d H:i:s', $now_ts);
    $keep_before = date('Y-m-d H:i:s', $now_ts - PARENT_INVITE_USED_KEEP_SECONDS);

    // Housekeeping: drop this learner's expired invites and used invites older than 30 days.
    $cleanup = $conn->prepare(
        'DELETE FROM parent_invites
         WHERE learner_email = ?
           AND ((used_at IS NULL AND expires_at <= ?) OR (used_at IS NOT NULL AND used_at <= ?))'
    );
    $cleanup->bind_param('sss', $learner_email, $now, $keep_before);
    $cleanup->execute();
    $cleanup->close();

    // Cap the number of unused invites that are still open.
    $count_stmt = $conn->prepare(
        'SELECT COUNT(*) FROM parent_invites WHERE learner_email = ? AND used_at IS NULL AND expires_at > ?'
    );
    $count_stmt->bind_param('ss', $learner_email, $now);
    $count_stmt->execute();
    $count_stmt->bind_result($open_invites);
    $count_stmt->fetch();
    $count_stmt->close();

    if ((int) $open_invites >= PARENT_INVITE_MAX_OPEN) {
        http_response_code(409);
        echo json_encode([
            'success' => false,
            'error'   => 'You already have ' . PARENT_INVITE_MAX_OPEN . ' unused invite links. Use one, or wait for them to expire.'
        ]);
        exit;
    }

    $code       = parent_invite_generate_code();
    $code_hash  = parent_invite_hash($code);
    $expires_at = parent_invite_expiry($now_ts);

    $insert = $conn->prepare(
        'INSERT INTO parent_invites (learner_email, code_hash, expires_at, created_at) VALUES (?, ?, ?, ?)'
    );
    $insert->bind_param('ssss', $learner_email, $code_hash, $expires_at, $now);
    $insert->execute();
    $insert->close();

    auth_rate_limit_record_attempt($conn, 'parent_invite_create', 'account', $learner_email, $window_seconds);

    echo json_encode([
        'success'    => true,
        'code'       => $code,
        'expires_at' => $expires_at,
        'expires_in_hours' => (int) (PARENT_INVITE_TTL_SECONDS / 3600),
    ]);
} catch (Throwable $e) {
    error_log('create_parent_invite failed: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Could not create the invite link. Please try again.']);
}
