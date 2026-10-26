<?php
/**
 * api/parent/redeem_parent_invite.php
 * A logged-in parent accepts a learner's invite code and is linked to that learner (POST, parent only).
 *
 * - The code is hashed and looked up; a code can be used once and expires after 48 hours.
 * - Every "not valid" reason (unknown, used, expired) gets the same message, so codes cannot be probed.
 * - Wrong codes are rate limited per parent account and per IP.
 * - The invite is claimed with an atomic UPDATE inside a transaction, so two taps cannot both succeed.
 */

require_once __DIR__ . '/../../auth/session_guard.php';
require_once __DIR__ . '/../../auth/csrf_helper.php';
require_once __DIR__ . '/../../auth/rate_limit_functions.php';
require_once __DIR__ . '/../../auth/parent_invite_functions.php';
require_once dirname(__DIR__, 2) . '/config.php';

header('Content-Type: application/json');

if (!isset($_SESSION['email']) || ($_SESSION['role'] ?? '') !== 'parent') {
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

$parent_email = $_SESSION['email'];
$client_ip    = auth_rate_limit_client_ip();
$window       = 15 * 60;
$invalid_msg  = 'This invite link is not valid or has expired. Ask your child to create a new one.';

if (auth_rate_limit_is_blocked($conn, 'parent_invite_redeem', 'account', $parent_email, 10, $window) ||
    auth_rate_limit_is_blocked($conn, 'parent_invite_redeem', 'ip', $client_ip, 30, $window)) {
    http_response_code(429);
    echo json_encode(['success' => false, 'error' => 'Too many attempts. Please wait a few minutes and try again.']);
    exit;
}

$code = trim((string) ($_POST['code'] ?? ''));

$reject = function () use ($conn, $parent_email, $client_ip, $window, $invalid_msg) {
    auth_rate_limit_record_attempt($conn, 'parent_invite_redeem', 'account', $parent_email, $window);
    auth_rate_limit_record_attempt($conn, 'parent_invite_redeem', 'ip', $client_ip, $window);
    echo json_encode(['success' => false, 'error' => $invalid_msg]);
    exit;
};

if (!parent_invite_is_valid_code_format($code)) {
    $reject();
}

$in_transaction = false;

try {
    $code_hash = parent_invite_hash($code);

    $stmt = $conn->prepare('SELECT id, learner_email, expires_at, used_at FROM parent_invites WHERE code_hash = ? LIMIT 1');
    $stmt->bind_param('s', $code_hash);
    $stmt->execute();
    $invite = $stmt->get_result()->fetch_assoc();
    $stmt->close();

    if (!$invite || $invite['used_at'] !== null || parent_invite_is_expired($invite['expires_at'])) {
        $reject();
    }

    // The learner must still exist as an active learner account.
    $learner_stmt = $conn->prepare("SELECT name, surname FROM users WHERE email = ? AND role = 'learner' AND is_deleted = 0 LIMIT 1");
    $learner_stmt->bind_param('s', $invite['learner_email']);
    $learner_stmt->execute();
    $learner = $learner_stmt->get_result()->fetch_assoc();
    $learner_stmt->close();

    if (!$learner) {
        $reject();
    }

    $conn->begin_transaction();
    $in_transaction = true;

    // Claim the invite. Only one request can flip used_at from NULL.
    $used_at = date('Y-m-d H:i:s');
    $claim = $conn->prepare('UPDATE parent_invites SET used_at = ?, used_by = ? WHERE id = ? AND used_at IS NULL');
    $invite_id = (int) $invite['id'];
    $claim->bind_param('ssi', $used_at, $parent_email, $invite_id);
    $claim->execute();
    $claimed = $claim->affected_rows;
    $claim->close();

    if ($claimed !== 1) {
        $conn->rollback();
        $in_transaction = false;
        $reject();
    }

    // Link parent and learner. The unique (parent_email, learner_email) key makes a repeat a no-op.
    $link = $conn->prepare('INSERT IGNORE INTO parent_links (parent_email, learner_email, class_id) VALUES (?, ?, NULL)');
    $link->bind_param('ss', $parent_email, $invite['learner_email']);
    $link->execute();
    $newly_linked = $link->affected_rows === 1;
    $link->close();

    $conn->commit();
    $in_transaction = false;

    auth_rate_limit_clear($conn, 'parent_invite_redeem', 'account', $parent_email);

    echo json_encode([
        'success'        => true,
        'learner_name'   => parent_invite_display_name($learner['name'], $learner['surname']),
        'already_linked' => !$newly_linked,
    ]);
} catch (Throwable $e) {
    if ($in_transaction) {
        try { $conn->rollback(); } catch (Throwable $ignored) {}
    }
    error_log('redeem_parent_invite failed: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Could not link your account. Please try again.']);
}
