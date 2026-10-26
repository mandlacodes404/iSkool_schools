<?php
/**
 * api/parent/get_children.php
 * Everything the parent app needs to draw its frame: who the parent is, the school, and the linked children (GET, parent only).
 * Children are identified by users.id; learner email addresses are never sent to the parent.
 */

require_once __DIR__ . '/../../auth/session_guard.php';
require_once __DIR__ . '/../../auth/parent_app_functions.php';
require_once dirname(__DIR__, 2) . '/config.php';

header('Content-Type: application/json');
header('Cache-Control: no-store');

if (!isset($_SESSION['email']) || ($_SESSION['role'] ?? '') !== 'parent') {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'Unauthorized']);
    exit;
}

$parent_email = $_SESSION['email'];

try {
    $stmt = $conn->prepare("SELECT name, surname FROM users WHERE email = ? AND role = 'parent' LIMIT 1");
    $stmt->bind_param('s', $parent_email);
    $stmt->execute();
    $me = $stmt->get_result()->fetch_assoc();
    $stmt->close();

    $parent_name = $me ? parent_full_name($me['name'], $me['surname']) : '';
    $year_id = parent_current_year_id($conn);

    echo json_encode([
        'success' => true,
        'data'    => [
            'parent'   => [
                'name'     => $parent_name !== '' ? $parent_name : 'Parent',
                'email'    => $parent_email,
                'initials' => $parent_name !== '' ? parent_person_initials($me['name'], $me['surname']) : 'P',
            ],
            'school'   => parent_school_info($conn, dirname(__DIR__, 2)),
            'term'     => parent_current_term($conn),
            // Linked children are listed even when the school has not marked a year as current (their class name is
            // then null). Home and Report answer with code "no_year" in that case, so the page can say so.
            'children' => parent_list_children($conn, $parent_email, $year_id),
        ],
    ]);
} catch (Throwable $e) {
    error_log('parent get_children failed: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Something went wrong. Please try again.']);
}
