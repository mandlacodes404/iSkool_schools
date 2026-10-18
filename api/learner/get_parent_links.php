<?php
/**
 * api/learner/get_parent_links.php
 * The parents linked to the logged-in learner, plus how many invite links are still open (GET, learner only).
 */

require_once __DIR__ . '/../../auth/session_guard.php';
require_once __DIR__ . '/../../auth/parent_invite_functions.php';
require_once dirname(__DIR__, 2) . '/config.php';

header('Content-Type: application/json');

if (!isset($_SESSION['email']) || ($_SESSION['role'] ?? '') !== 'learner') {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'Unauthorized']);
    exit;
}

$learner_email = $_SESSION['email'];

try {
    $stmt = $conn->prepare(
        "SELECT pl.id, u.name, u.surname
         FROM parent_links pl
         JOIN users u ON u.email = pl.parent_email AND u.role = 'parent' AND u.is_deleted = 0
         WHERE pl.learner_email = ?
         ORDER BY u.name, u.surname"
    );
    $stmt->bind_param('s', $learner_email);
    $stmt->execute();
    $result = $stmt->get_result();

    $parents = [];
    while ($row = $result->fetch_assoc()) {
        $parents[] = [
            'id'   => (int) $row['id'],
            'name' => parent_invite_display_name($row['name'], $row['surname']),
        ];
    }
    $stmt->close();

    $now = date('Y-m-d H:i:s');
    $open_stmt = $conn->prepare(
        'SELECT COUNT(*) FROM parent_invites WHERE learner_email = ? AND used_at IS NULL AND expires_at > ?'
    );
    $open_stmt->bind_param('ss', $learner_email, $now);
    $open_stmt->execute();
    $open_stmt->bind_result($open_invites);
    $open_stmt->fetch();
    $open_stmt->close();

    echo json_encode([
        'success' => true,
        'data'    => [
            'parents'      => $parents,
            'open_invites' => (int) $open_invites,
            'max_open'     => PARENT_INVITE_MAX_OPEN,
        ],
    ]);
} catch (Throwable $e) {
    error_log('get_parent_links failed: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Could not load your parent links.']);
}
