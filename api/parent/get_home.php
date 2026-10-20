<?php
/**
 * api/parent/get_home.php?child={users.id}
 * The Home screen for one linked child: summary, subject marks, what is coming up and the latest news (GET, parent only).
 * Only marks the teacher has published are included.
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

    $term = parent_current_term($conn);
    $learner_email = $child['email'];
    $school = parent_school_info($conn, dirname(__DIR__, 2));

    // Marks
    $subjects = parent_subject_marks(parent_fetch_published_results($conn, $learner_email, $year_id), $term);
    $average = parent_average(array_column($subjects, 'mark'));
    $prev_average = $term > 1 ? parent_average(array_column($subjects, 'prev_mark')) : null;
    $change = ($average !== null && $prev_average !== null) ? $average - $prev_average : null;

    $summary = parent_build_summary(
        trim((string) $child['name']),
        $average,
        $prev_average,
        array_map(function ($s) {
            return ['name' => $s['name'], 'mark' => $s['mark'], 'delta' => $s['delta']];
        }, $subjects)
    );

    // Class name for the eyebrow line
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
            'child'     => [
                'id'         => (int) $child['id'],
                'name'       => parent_full_name($child['name'], $child['surname']),
                'first_name' => trim((string) $child['name']),
                'class_name' => $class_name,
            ],
            'term'      => $term,
            'prev_term' => $term > 1 ? $term - 1 : null,
            'average'   => $average,
            'change'    => $change,
            'headline'  => $summary['headline'],
            'note'      => $summary['note'],
            'subjects'  => array_map(function ($s) {
                return ['name' => $s['name'], 'mark' => $s['mark'], 'delta' => $s['delta']];
            }, $subjects),
            'upcoming'  => parent_fetch_upcoming($conn, $learner_email, $year_id, date('Y-m-d 00:00:00'), 45, 4),
            'news'      => parent_fetch_news($conn, $learner_email, $year_id, $school['name'], 3),
        ],
    ]);
} catch (Throwable $e) {
    error_log('parent get_home failed: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Something went wrong. Please try again.']);
}
