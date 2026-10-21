<?php
/**
 * api/parent/get_syllabus.php?child={users.id}
 * The subject briefs (syllabus) for one linked child's class this year: topics, how each subject is assessed and the
 * teacher's note, term by term (GET, parent only). The same content the learner sees on their Syllabus page.
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
$child_id = (int) ($_GET['child'] ?? 0);

try {
    $child = parent_find_child($conn, $parent_email, $child_id);
    if ($child === null) {
        http_response_code(404);
        echo json_encode(['success' => false, 'error' => 'Child not found']);
        exit;
    }

    $year_id = parent_current_year_id($conn);
    if ($year_id <= 0) {
        echo json_encode(['success' => false, 'error' => 'No active academic year']);
        exit;
    }

    $briefs = parent_fetch_syllabus($conn, $child['email'], $year_id);

    $terms = array_values(array_unique(array_column($briefs, 'term')));
    sort($terms);

    $class_name = null;
    foreach (parent_list_children($conn, $parent_email, $year_id) as $c) {
        if ($c['id'] === (int) $child['id']) {
            $class_name = $c['class_name'];
            break;
        }
    }

    echo json_encode([
        'success' => true,
        'data'    => [
            'child'        => [
                'id'         => (int) $child['id'],
                'name'       => parent_full_name($child['name'], $child['surname']),
                'first_name' => trim((string) $child['name']),
                'class_name' => $class_name,
            ],
            'current_term' => parent_current_term($conn),
            'terms'        => $terms,
            'briefs'       => $briefs,
        ],
    ]);
} catch (Throwable $e) {
    error_log('parent get_syllabus failed: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Something went wrong. Please try again.']);
}
