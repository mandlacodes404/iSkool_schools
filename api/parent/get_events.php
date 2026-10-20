<?php
/**
 * api/parent/get_events.php
 * The Events feed: what is coming up for all of the signed-in parent's linked children, earliest first (GET, parent
 * only). Assignment due dates, quizzes not yet taken and class events (tests, exams, holidays, school events).
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
$days_ahead = 120;
$item_limit = 80;
$today = date('Y-m-d');

try {
    $year_id = parent_current_year_id($conn);
    if ($year_id <= 0) {
        echo json_encode(['success' => false, 'code' => 'no_year', 'error' => 'No active academic year']);
        exit;
    }

    $children = parent_list_children($conn, $parent_email, $year_id);
    if (!$children) {
        echo json_encode(['success' => true, 'data' => ['children' => 0, 'today' => $today, 'items' => [], 'more' => false]]);
        exit;
    }

    $feed = parent_fetch_events($conn, $parent_email, $year_id, $today, $days_ahead, $item_limit);

    echo json_encode([
        'success' => true,
        'data'    => [
            'children' => count($children),
            'today'    => $today,
            'items'    => $feed['items'],
            'more'     => $feed['more'],
        ],
    ]);
} catch (Throwable $e) {
    error_log('parent get_events failed: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Something went wrong. Please try again.']);
}
