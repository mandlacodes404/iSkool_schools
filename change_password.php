<?php
/**
 * change_password.php
 *
 * Signed-in password change, called by fetch() from the learner settings.
 * Always answers with JSON:
 *   { "success": true }
 *   { "success": false, "error": "...", "field": "current_password" | "new_password" (optional) }
 *
 * Follows the same rules as the reset flow: 8+ characters, password_hash(), and every remembered
 * device and pending reset link for the account is cleared in one transaction.
 */

header('Content-Type: application/json');

function pw_fail(string $message, int $status = 200, string $field = ''): void
{
    if ($status !== 200) http_response_code($status);
    $out = ['success' => false, 'error' => $message];
    if ($field !== '') $out['field'] = $field;
    echo json_encode($out);
    exit();
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    pw_fail('Method not allowed.', 405);
}

require_once __DIR__ . '/auth/session_guard.php';
require_once __DIR__ . '/auth/csrf_helper.php';
require_once 'config.php';
require_once __DIR__ . '/auth/rate_limit_functions.php';

if (!isset($_SESSION['email'])) {
    pw_fail('Your session has ended. Please sign in again.', 403);
}

verify_csrf_token();

$email    = strtolower(trim($_SESSION['email']));
$current  = $_POST['current_password'] ?? '';
$new      = $_POST['new_password'] ?? '';
$confirm  = $_POST['confirm_password'] ?? '';

if (!is_string($current) || !is_string($new) || !is_string($confirm) || $current === '') {
    pw_fail('Enter your current password.', 200, 'current_password');
}
if (strlen($new) < 8) {
    pw_fail('Your new password must be at least 8 characters long.', 200, 'new_password');
}
// bcrypt (PASSWORD_DEFAULT) silently ignores everything after 72 bytes, so refuse longer ones instead of pretending
if (strlen($new) > 72) {
    pw_fail('Your new password must be 72 characters or fewer.', 200, 'new_password');
}
if (!hash_equals($new, $confirm)) {
    pw_fail('The two new passwords don\'t match.', 200, 'new_password');
}
if (hash_equals($current, $new)) {
    pw_fail('Your new password must be different from your current one.', 200, 'new_password');
}

// Wrong current passwords are limited, so a stolen open session can't be used to guess the real password.
$client_ip = auth_rate_limit_client_ip();
$window    = 15 * 60;
if (auth_rate_limit_is_blocked($conn, 'change_password', 'account', $email, 5, $window) ||
    auth_rate_limit_is_blocked($conn, 'change_password', 'ip', $client_ip, 20, $window)) {
    pw_fail('Too many attempts. Please wait a few minutes and try again.', 429);
}

$stmt = $conn->prepare("SELECT password FROM users WHERE email = ? AND is_deleted = 0 LIMIT 1");
$stmt->bind_param("s", $email);
$stmt->execute();
$stmt->bind_result($stored_hash);
$found = $stmt->fetch();
$stmt->close();

if (!$found) {
    pw_fail('We couldn\'t find your account. Please sign in again.', 403);
}

if (!password_verify($current, (string)$stored_hash)) {
    auth_rate_limit_record_attempt($conn, 'change_password', 'account', $email, $window);
    auth_rate_limit_record_attempt($conn, 'change_password', 'ip', $client_ip, $window);
    pw_fail('That isn\'t your current password.', 200, 'current_password');
}

try {
    if (!$conn->begin_transaction()) {
        throw new RuntimeException('Could not start the password change.');
    }

    $new_hash = password_hash($new, PASSWORD_DEFAULT);
    $update   = $conn->prepare("UPDATE users SET password = ? WHERE email = ? AND is_deleted = 0");
    if (!$update) throw new RuntimeException('Could not prepare the password update.');
    $update->bind_param("ss", $new_hash, $email);
    if (!$update->execute()) throw new RuntimeException('Could not update the password.');
    $update->close();

    // Any reset link sent earlier is now useless, and remembered devices must sign in with the new password.
    $resets = $conn->prepare("DELETE FROM password_resets WHERE email = ?");
    if (!$resets) throw new RuntimeException('Could not prepare reset-link cleanup.');
    $resets->bind_param("s", $email);
    if (!$resets->execute()) throw new RuntimeException('Could not clear reset links.');
    $resets->close();

    $tokens = $conn->prepare("DELETE FROM user_tokens WHERE user_email = ?");
    if (!$tokens) throw new RuntimeException('Could not prepare remembered-device cleanup.');
    $tokens->bind_param("s", $email);
    if (!$tokens->execute()) throw new RuntimeException('Could not clear remembered devices.');
    $tokens->close();

    if (!$conn->commit()) throw new RuntimeException('Could not finish the password change.');
} catch (Throwable $e) {
    $conn->rollback();
    error_log('[change_password] ' . $e->getMessage());
    pw_fail('We couldn\'t update your password. Please try again.', 500);
}

// New credentials, new session id (keeps the learner signed in on this device)
session_regenerate_id(true);

echo json_encode(['success' => true]);
