<?php
/**
 * api/parent/get_report.php?child={users.id}&term={1-4}
 * The progress report for one linked child and one term: a mark and level for each subject, the change since the
 * term before, and the marked work behind each mark (GET, parent only). Only published marks are included.
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
        // The page shows "the school year is not set up yet" for this code, not a connection error
        echo json_encode(['success' => false, 'code' => 'no_year', 'error' => 'No active academic year']);
        exit;
    }

    $current_term = parent_current_term($conn);
    $term = (int) ($_GET['term'] ?? $current_term);
    if ($term < 1 || $term > 4) {
        $term = $current_term;
    }

    $by_subject = parent_fetch_published_results($conn, $child['email'], $year_id);
    $rows = parent_subject_marks($by_subject, $term);

    $subjects = [];
    foreach ($rows as $row) {
        $work = [];
        foreach ($row['quizzes'] as $q) {
            if ((int) $q['term_number'] !== $term) {
                continue;
            }
            $summative = !empty($q['is_summative']);
            $work[] = [
                'title'     => (string) $q['quiz_title'],
                'date'      => parent_date_parts((string) $q['submitted_at'])['label'],
                'pct'       => ((float) $q['total']) > 0 ? (int) round(((float) $q['score'] / (float) $q['total']) * 100) : null,
                'summative' => $summative,
                'weight'    => $summative ? (float) $q['weight_percent'] : null,
            ];
        }
        $subjects[] = [
            'name'     => $row['name'],
            'mark'     => $row['mark'],
            'level'    => parent_mark_level($row['mark']),
            'delta'    => $row['delta'],
            'assessed' => $row['mark'] !== null ? (int) round($row['term']['assessed']) : null,
            'work'     => $work,
        ];
    }

    $average = parent_average(array_column($rows, 'mark'));
    $prev_average = $term > 1 ? parent_average(array_column($rows, 'prev_mark')) : null;

    // Which terms have anything to show (for the term buttons)
    $terms_with_marks = [];
    for ($t = 1; $t <= 4; $t++) {
        foreach ($by_subject as $quizzes) {
            if (parent_term_mark($quizzes, $t)['pct'] !== null) {
                $terms_with_marks[] = $t;
                break;
            }
        }
    }

    $class_name = null;
    foreach (parent_list_children($conn, $parent_email, $year_id) as $c) {
        if ($c['id'] === (int) $child['id']) {
            $class_name = $c['class_name'];
            break;
        }
    }

    // Highest and lowest mark this term
    $marked = array_values(array_filter($subjects, function ($s) {
        return $s['mark'] !== null;
    }));
    $highest = null;
    $lowest = null;
    foreach ($marked as $s) {
        if ($highest === null || $s['mark'] > $highest['mark']) {
            $highest = $s;
        }
        if ($lowest === null || $s['mark'] < $lowest['mark']) {
            $lowest = $s;
        }
    }

    echo json_encode([
        'success' => true,
        'data'    => [
            'child'            => [
                'id'         => (int) $child['id'],
                'name'       => parent_full_name($child['name'], $child['surname']),
                'first_name' => trim((string) $child['name']),
                'class_name' => $class_name,
            ],
            'term'             => $term,
            'current_term'     => $current_term,
            'prev_term'        => $term > 1 ? $term - 1 : null,
            'terms_with_marks' => $terms_with_marks,
            'average'          => $average,
            'change'           => ($average !== null && $prev_average !== null) ? $average - $prev_average : null,
            'highest'          => $highest ? ['name' => $highest['name'], 'mark' => $highest['mark']] : null,
            'lowest'           => ($lowest && count($marked) > 1) ? ['name' => $lowest['name'], 'mark' => $lowest['mark']] : null,
            'subjects'         => $subjects,
        ],
    ]);
} catch (Throwable $e) {
    error_log('parent get_report failed: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Something went wrong. Please try again.']);
}
