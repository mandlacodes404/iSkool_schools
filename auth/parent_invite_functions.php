<?php
/**
 * Helpers for parent invite links. Pure functions only (no database access) so they are easy to test.
 * Used by api/learner/create_parent_invite.php, api/parent/redeem_parent_invite.php, parent_link.php and dashboard.php.
 */

const PARENT_INVITE_TTL_SECONDS = 172800;   // an invite works for 48 hours
const PARENT_INVITE_MAX_OPEN    = 5;        // unused, unexpired invites one learner can hold at once
const PARENT_INVITE_USED_KEEP_SECONDS = 2592000; // used invites are kept for 30 days, then cleaned up

/** A new random invite code: 32 hex characters (128 bits). Only its hash is stored. */
function parent_invite_generate_code(): string
{
    return bin2hex(random_bytes(16));
}

/** True only for a string shaped like a code from parent_invite_generate_code(). \z, not $, so a trailing newline fails. */
function parent_invite_is_valid_code_format($code): bool
{
    return is_string($code) && preg_match('/^[a-f0-9]{32}\z/', $code) === 1;
}

/** The value stored in parent_invites.code_hash. */
function parent_invite_hash(string $code): string
{
    return hash('sha256', $code);
}

/** Expiry timestamp (server time, same format the database stores) for an invite created now. */
function parent_invite_expiry(?int $now = null): string
{
    return date('Y-m-d H:i:s', ($now ?? time()) + PARENT_INVITE_TTL_SECONDS);
}

/** True if the stored expires_at is in the past (or cannot be read). */
function parent_invite_is_expired(string $expires_at, ?int $now = null): bool
{
    $ts = strtotime($expires_at);
    return $ts === false || $ts <= ($now ?? time());
}

/** "Thandi Mokoena" from name + surname, ignoring empty parts. */
function parent_invite_display_name($name, $surname): string
{
    return trim(trim((string) $name) . ' ' . trim((string) $surname));
}
