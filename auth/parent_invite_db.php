<?php
/**
 * Database helpers for parent invites, used where a parent account is created from an invite (auth/register_ajax.php).
 * The pure helpers (code format, hash, expiry, display name) are in auth/parent_invite_functions.php.
 */

require_once __DIR__ . '/parent_invite_functions.php';

/**
 * The open invite for a code, or null when the code is not a code, is unknown, was used, has expired, or its learner
 * is gone. The reason is deliberately not returned, so callers can give one message for every bad code.
 *
 * @return array{id:int, learner_email:string, learner_name:string}|null
 */
function parent_invite_find_open(mysqli $conn, string $code): ?array
{
    if (!parent_invite_is_valid_code_format($code)) {
        return null;
    }

    $code_hash = parent_invite_hash($code);
    $stmt = $conn->prepare('SELECT id, learner_email, expires_at, used_at FROM parent_invites WHERE code_hash = ? LIMIT 1');
    $stmt->bind_param('s', $code_hash);
    $stmt->execute();
    $invite = $stmt->get_result()->fetch_assoc();
    $stmt->close();

    if (!$invite || $invite['used_at'] !== null || parent_invite_is_expired($invite['expires_at'])) {
        return null;
    }

    $l_stmt = $conn->prepare("SELECT name, surname FROM users WHERE email = ? AND role = 'learner' AND is_deleted = 0 LIMIT 1");
    $l_stmt->bind_param('s', $invite['learner_email']);
    $l_stmt->execute();
    $learner = $l_stmt->get_result()->fetch_assoc();
    $l_stmt->close();

    if (!$learner) {
        return null;
    }

    return [
        'id'            => (int) $invite['id'],
        'learner_email' => $invite['learner_email'],
        'learner_name'  => parent_invite_display_name($learner['name'], $learner['surname']),
    ];
}

/**
 * Claims an invite for a parent. Only one caller can flip used_at from NULL, so two people using the same link at the
 * same moment cannot both get it. True when this call got it. Call it inside a transaction.
 */
function parent_invite_claim(mysqli $conn, int $invite_id, string $parent_email): bool
{
    $used_at = date('Y-m-d H:i:s');
    $claim = $conn->prepare('UPDATE parent_invites SET used_at = ?, used_by = ? WHERE id = ? AND used_at IS NULL');
    $claim->bind_param('ssi', $used_at, $parent_email, $invite_id);
    $claim->execute();
    $claimed = $claim->affected_rows === 1;
    $claim->close();

    return $claimed;
}

/** Links a parent to a learner. The unique (parent_email, learner_email) key makes a repeat a no-op. */
function parent_invite_link(mysqli $conn, string $parent_email, string $learner_email): void
{
    $link = $conn->prepare('INSERT IGNORE INTO parent_links (parent_email, learner_email, class_id) VALUES (?, ?, NULL)');
    $link->bind_param('ss', $parent_email, $learner_email);
    $link->execute();
    $link->close();
}
