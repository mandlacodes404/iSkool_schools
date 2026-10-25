<?php
/**
 * Who is signed in on this phone right now. The service worker asks before it re-sends a teacher's marks that were
 * saved without signal: marks saved by one teacher must never be sent as another teacher who signed in on the same
 * phone later. (The learner app has the same check, api/learner/get_session_identity.php.)
 *
 * It also hands back the current CSRF token. A save that waited on the phone carries the token of the session it was
 * made in, and that session may have ended and been replaced by a new sign-in by the time it is sent. The reply goes
 * only to the signed-in teacher's own browser (same origin, the session cookie is SameSite=Strict).
 */
require_once __DIR__ . '/../../auth/session_guard.php';

header('Content-Type: application/json');
header('Cache-Control: no-store');

if (!isset($_SESSION['email']) || ($_SESSION['role'] ?? '') !== 'teacher') {
    http_response_code(401);
    echo json_encode(['error' => 'Unauthorized']);
    exit();
}

echo json_encode(['email' => $_SESSION['email'], 'csrf_token' => $_SESSION['csrf_token'] ?? '']);
