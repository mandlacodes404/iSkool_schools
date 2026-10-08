<?php
/** Database-backed authentication throttling. Identifiers are hashed before storage. */

function auth_rate_limit_log($message) {
    error_log('[auth_rate_limit] ' . $message);
}

function auth_rate_limit_bootstrap($conn) {
    static $table_ready = null;

    if ($table_ready !== null) {
        return $table_ready;
    }

    $sql = "CREATE TABLE IF NOT EXISTS auth_rate_limits (
        action_type VARCHAR(32) NOT NULL,
        limit_scope VARCHAR(16) NOT NULL,
        identifier_hash CHAR(64) NOT NULL,
        attempt_count INT UNSIGNED NOT NULL DEFAULT 0,
        window_started_at DATETIME NOT NULL,
        PRIMARY KEY (action_type, limit_scope, identifier_hash),
        INDEX idx_auth_rate_limits_window (window_started_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4";

    if (!$conn->query($sql)) {
        auth_rate_limit_log('Could not create auth_rate_limits table: ' . $conn->error);
        $table_ready = false;
        return false;
    }

    $table_ready = true;
    return true;
}

function auth_rate_limit_identifier_hash($identifier) {
    return hash('sha256', strtolower((string) $identifier));
}

function auth_rate_limit_is_blocked($conn, $action_type, $limit_scope, $identifier, $max_attempts, $window_seconds) {
    if (!auth_rate_limit_bootstrap($conn)) {
        return false;
    }

    $identifier_hash = auth_rate_limit_identifier_hash($identifier);
    $stmt = $conn->prepare('SELECT attempt_count, UNIX_TIMESTAMP(window_started_at) FROM auth_rate_limits WHERE action_type = ? AND limit_scope = ? AND identifier_hash = ?');
    if (!$stmt) {
        auth_rate_limit_log('Could not read authentication rate limit: ' . $conn->error);
        return false;
    }

    $stmt->bind_param('sss', $action_type, $limit_scope, $identifier_hash);
    if (!$stmt->execute()) {
        auth_rate_limit_log('Could not query authentication rate limit: ' . $stmt->error);
        $stmt->close();
        return false;
    }

    $stmt->bind_result($attempt_count, $window_started_at);
    $has_row = $stmt->fetch();
    $stmt->close();

    if (!$has_row || (time() - (int) $window_started_at) >= $window_seconds) {
        return false;
    }

    return (int) $attempt_count >= $max_attempts;
}

function auth_rate_limit_record_attempt($conn, $action_type, $limit_scope, $identifier, $window_seconds) {
    if (!auth_rate_limit_bootstrap($conn)) {
        return;
    }

    $identifier_hash = auth_rate_limit_identifier_hash($identifier);
    $sql = 'INSERT INTO auth_rate_limits (action_type, limit_scope, identifier_hash, attempt_count, window_started_at)
            VALUES (?, ?, ?, 1, NOW())
            ON DUPLICATE KEY UPDATE
                attempt_count = IF(TIMESTAMPDIFF(SECOND, window_started_at, NOW()) >= ?, 1, attempt_count + 1),
                window_started_at = IF(TIMESTAMPDIFF(SECOND, window_started_at, NOW()) >= ?, NOW(), window_started_at)';
    $stmt = $conn->prepare($sql);
    if (!$stmt) {
        auth_rate_limit_log('Could not prepare authentication rate-limit update: ' . $conn->error);
        return;
    }

    $stmt->bind_param('sssii', $action_type, $limit_scope, $identifier_hash, $window_seconds, $window_seconds);
    if (!$stmt->execute()) {
        auth_rate_limit_log('Could not update authentication rate limit: ' . $stmt->error);
    }
    $stmt->close();
}

function auth_rate_limit_clear($conn, $action_type, $limit_scope, $identifier) {
    if (!auth_rate_limit_bootstrap($conn)) {
        return;
    }

    $identifier_hash = auth_rate_limit_identifier_hash($identifier);
    $stmt = $conn->prepare('DELETE FROM auth_rate_limits WHERE action_type = ? AND limit_scope = ? AND identifier_hash = ?');
    if (!$stmt) {
        auth_rate_limit_log('Could not prepare authentication rate-limit clear: ' . $conn->error);
        return;
    }

    $stmt->bind_param('sss', $action_type, $limit_scope, $identifier_hash);
    if (!$stmt->execute()) {
        auth_rate_limit_log('Could not clear authentication rate limit: ' . $stmt->error);
    }
    $stmt->close();
}

function auth_rate_limit_client_ip() {
    $ip = $_SERVER['REMOTE_ADDR'] ?? '';
    return filter_var($ip, FILTER_VALIDATE_IP) ? $ip : 'unknown';
}
?>
