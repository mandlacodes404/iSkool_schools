<?php
/**
 * api/parent/get_news.php
 * The News feed: school-wide announcements and the teacher announcements sent to parents, across all of the signed-in
 * parent's linked children, newest first (GET, parent only). A school-wide announcement appears once, not once per child.
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
$feed_limit = 60;

try {
    $year_id = parent_current_year_id($conn);
    if ($year_id <= 0) {
        echo json_encode(['success' => false, 'code' => 'no_year', 'error' => 'No active academic year']);
        exit;
    }

    // A parent with no linked child sees nothing here, not even the school's announcements
    $children = parent_list_children($conn, $parent_email, $year_id);
    if (!$children) {
        echo json_encode(['success' => true, 'data' => ['children' => 0, 'items' => [], 'more' => false]]);
        exit;
    }

    $school = parent_school_info($conn, dirname(__DIR__, 2));
    $feed = parent_fetch_feed($conn, $parent_email, $year_id, $school['name'], $feed_limit);

    echo json_encode([
        'success' => true,
        'data'    => [
            'children' => count($children),
            'items'    => $feed['items'],
            'more'     => $feed['more'],
        ],
    ]);
} catch (Throwable $e) {
    error_log('parent get_news failed: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Something went wrong. Please try again.']);
}
