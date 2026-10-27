<?php
/**
 * Helpers for the parent app (Home, Report and Syllabus). Used by api/parent/get_children.php, get_home.php, get_report.php
 * and get_syllabus.php.
 *
 * Part 1 is pure functions (no database, no session) so they are easy to test.
 * Part 2 reads the database. Every read there is scoped to ONE learner, and the endpoints only call it after
 * parent_find_child() has confirmed that learner is linked to the signed-in parent.
 *
 * Marks follow the learner app exactly (api/learner/get_progress_report.php), with one extra rule for parents:
 * a mark is only shown once the teacher has published it and any open-ended answers have been graded.
 */

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
// Part 1: pure functions
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════

/** South African achievement level (1 to 7) for a percentage, or null when there is no mark. */
function parent_mark_level($pct): ?int
{
    if ($pct === null || $pct === '') {
        return null;
    }
    $p = (float) $pct;
    if ($p >= 80) return 7;
    if ($p >= 70) return 6;
    if ($p >= 60) return 5;
    if ($p >= 50) return 4;
    if ($p >= 40) return 3;
    if ($p >= 30) return 2;
    return 1;
}

/**
 * Term mark for one subject. Same rules as calcTermMark() in api/learner/get_progress_report.php:
 * only summative quizzes of that term count, each weighted by its weight_percent (scaled down if the weights add up
 * to more than 100, shared equally if none was set).
 *
 * @param array $quizzes rows with score, total, is_summative, weight_percent, term_number (all already published)
 * @return array{pct: ?int, assessed: float, remaining: float, count: int, total_count: int}
 */
function parent_term_mark(array $quizzes, int $term): array
{
    $summative = array_values(array_filter($quizzes, function ($q) use ($term) {
        return !empty($q['is_summative']) && (int) $q['term_number'] === $term;
    }));

    if (empty($summative)) {
        return ['pct' => null, 'assessed' => 0.0, 'remaining' => 100.0, 'count' => 0, 'total_count' => 0];
    }

    $weights = array_map(function ($q) {
        return (float) ($q['weight_percent'] ?? 0);
    }, $summative);
    $total_weight = array_sum($weights);

    if ($total_weight > 100) {
        $factor = 100 / $total_weight;
        $weights = array_map(function ($w) use ($factor) {
            return $w * $factor;
        }, $weights);
        $total_weight = 100;
    } elseif ($total_weight == 0) {
        $weights = array_fill(0, count($summative), 100 / count($summative));
        $total_weight = 100;
    }

    $earned = 0;
    foreach ($summative as $i => $q) {
        $earned += $q['total'] > 0 ? round(($q['score'] / $q['total']) * ($weights[$i] ?? 0), 1) : 0;
    }

    $pct = $total_weight > 0 ? (int) round(($earned / $total_weight) * 100) : 0;

    return [
        'pct'         => $pct,
        'assessed'    => round($total_weight, 1),
        'remaining'   => round(100 - $total_weight, 1),
        'count'       => count($summative),
        'total_count' => count($summative),
    ];
}

/** Average of the subject marks that exist, rounded, or null when there are none. */
function parent_average(array $marks): ?int
{
    $values = array_values(array_filter($marks, function ($m) {
        return $m !== null;
    }));
    return count($values) > 0 ? (int) round(array_sum($values) / count($values)) : null;
}

/** "Thandi Mokoena" from name and surname, ignoring empty parts. */
function parent_full_name($name, $surname): string
{
    return trim(trim((string) $name) . ' ' . trim((string) $surname));
}

/** "Mr Dlamini" from a teacher's title and surname. */
function parent_teacher_display($title, $surname): string
{
    $label = trim(trim((string) $title) . ' ' . trim((string) $surname));
    return $label !== '' ? $label : 'Teacher';
}

/**
 * Initials of the first two words, like the learner dashboard's school logo: "Landulwazi High School" gives "LH",
 * "Landulwazi" gives "L".
 */
function parent_initials(string $text): string
{
    $words = preg_split('/\s+/', trim($text), -1, PREG_SPLIT_NO_EMPTY);
    $out = '';
    foreach (array_slice($words, 0, 2) as $word) {
        $out .= mb_strtoupper(mb_substr($word, 0, 1));
    }
    return $out !== '' ? $out : '?';
}

/** A person's initials, like the learner avatar: first letter of the name and of the surname ("Thandi", "Mokoena" gives "TM"). */
function parent_person_initials($name, $surname): string
{
    $out = mb_strtoupper(mb_substr(trim((string) $name), 0, 1)) . mb_strtoupper(mb_substr(trim((string) $surname), 0, 1));
    return $out !== '' ? $out : '?';
}

/** Weekday, day and a short label for a date or datetime, e.g. Tue / 20 / "Tue 20 Oct". */
function parent_date_parts(string $date): array
{
    $ts = strtotime($date);
    if ($ts === false) {
        return ['dow' => '', 'day' => '', 'label' => ''];
    }
    return [
        'dow'   => date('D', $ts),
        'day'   => date('j', $ts),
        'label' => date('D j M', $ts),
    ];
}

/** Plain label for an academic_events.event_type. */
function parent_event_kind(string $type): string
{
    switch ($type) {
        case 'test':    return 'Test';
        case 'exam':    return 'Exam';
        case 'holiday': return 'Holiday';
        case 'event':   return 'School event';
        default:        return 'Event';
    }
}

/**
 * Sort upcoming items by date (earliest first) and keep the first $limit.
 * Each item needs a sortable 'date' string (Y-m-d or Y-m-d H:i:s).
 */
function parent_merge_upcoming(array $items, int $limit): array
{
    usort($items, function ($a, $b) {
        return strcmp((string) $a['date'], (string) $b['date']);
    });
    return array_slice($items, 0, max(0, $limit));
}

/**
 * The calm one-line summary at the top of Home. Wording is based on the change since last term, never on the mark
 * alone, so it does not label a child "good" or "bad".
 *
 * @param array $subjects list of ['name' => string, 'mark' => ?int, 'delta' => ?int]
 * @return array{headline: string, note: string}
 */
function parent_build_summary(string $first_name, ?int $avg, ?int $prev_avg, array $subjects): array
{
    $first = trim($first_name) !== '' ? trim($first_name) : 'Your child';

    if ($avg === null) {
        return [
            'headline' => $first . ' has no published marks yet.',
            'note'     => 'Marks appear here once teachers have marked and published them.',
        ];
    }

    if ($prev_avg === null) {
        $headline = $first . "'s average so far is " . $avg . '%.';
    } else {
        $diff = $avg - $prev_avg;
        if ($diff >= 2) {
            $headline = $first . ' is improving this term.';
        } elseif ($diff <= -2) {
            $headline = $first . "'s marks are a little lower than last term.";
        } else {
            $headline = $first . ' is steady this term.';
        }
    }

    $with_mark = array_values(array_filter($subjects, function ($s) {
        return $s['mark'] !== null;
    }));

    $best = null;
    $worst_drop = null;
    $lowest = null;
    foreach ($with_mark as $s) {
        if ($s['delta'] !== null && $s['delta'] >= 3 && ($best === null || $s['delta'] > $best['delta'])) {
            $best = $s;
        }
        if ($s['delta'] !== null && $s['delta'] <= -3 && ($worst_drop === null || $s['delta'] < $worst_drop['delta'])) {
            $worst_drop = $s;
        }
        if ($lowest === null || $s['mark'] < $lowest['mark']) {
            $lowest = $s;
        }
    }

    $sentences = [];
    if ($best !== null) {
        $sentences[] = $best['name'] . ' improved the most, up ' . $best['delta'] . ' points.';
    }
    $lowest_done = false;
    if ($worst_drop !== null) {
        if ($lowest !== null && $lowest['name'] === $worst_drop['name']) {
            $sentences[] = $worst_drop['name'] . ' dipped by ' . abs($worst_drop['delta'])
                . ' points and is the lowest mark at ' . $worst_drop['mark'] . '%.';
            $lowest_done = true;
        } else {
            $sentences[] = $worst_drop['name'] . ' dipped by ' . abs($worst_drop['delta']) . ' points.';
        }
    }
    if (!$lowest_done && $lowest !== null && count($with_mark) >= 2) {
        $sentences[] = $lowest['name'] . ' is the lowest mark at ' . $lowest['mark'] . '%.';
    }

    return [
        'headline' => $headline,
        'note'     => implode(' ', array_slice($sentences, 0, 2)),
    ];
}

/**
 * Topics from a subject brief's JSON column as a clean list of non-empty strings. Anything that is not a list
 * (empty, broken JSON, a number) gives an empty list, so one bad row never breaks the whole page.
 */
function parent_parse_topics($json): array
{
    $list = json_decode((string) $json, true);
    if (!is_array($list) || !array_is_list($list)) {
        return [];
    }
    $out = [];
    foreach ($list as $topic) {
        if (!is_string($topic) && !is_int($topic) && !is_float($topic)) {
            continue;
        }
        $text = trim((string) $topic);
        if ($text !== '') {
            $out[] = $text;
        }
    }
    return $out;
}

/**
 * Assessment weighting from a subject brief's JSON column: a list of ['type' => string, 'weight' => number].
 * Rows with no name or a weight of 0 or less are dropped (the teacher's form does not allow them either).
 */
function parent_parse_assessments($json): array
{
    $list = json_decode((string) $json, true);
    if (!is_array($list) || !array_is_list($list)) {
        return [];
    }
    $out = [];
    foreach ($list as $item) {
        if (!is_array($item) || !isset($item['type']) || !is_scalar($item['type'])) {
            continue;
        }
        $type = trim((string) $item['type']);
        $weight = $item['weight'] ?? null;
        if ($type === '' || !is_numeric($weight) || (float) $weight <= 0) {
            continue;
        }
        $w = (float) $weight;
        $out[] = ['type' => $type, 'weight' => ($w == floor($w)) ? (int) $w : round($w, 1)];
    }
    return $out;
}

/** "Thandi", "Thandi and Sipho", "Thandi, Sipho and Lwazi". Blank names are left out. */
function parent_join_names(array $names): string
{
    $names = array_values(array_filter(array_map(function ($n) {
        return trim((string) $n);
    }, $names), function ($n) {
        return $n !== '';
    }));
    $count = count($names);
    if ($count === 0) {
        return '';
    }
    if ($count === 1) {
        return $names[0];
    }
    return implode(', ', array_slice($names, 0, -1)) . ' and ' . $names[$count - 1];
}

/** One announcement as the News screen needs it. $for is the child or children it relates to ('' for the school). */
function parent_feed_item(array $row, string $kind, string $sender, string $for): array
{
    $created = (string) ($row['created_at'] ?? '');
    $ts = strtotime($created);
    $title = trim((string) ($row['title'] ?? ''));

    // An edit date of 0000-00-00 counts as "never edited"
    $edited = null;
    $edited_at = trim((string) ($row['edited_at'] ?? ''));
    if ($edited_at !== '') {
        $edited_ts = strtotime($edited_at);
        if ($edited_ts !== false && $edited_ts > 0) {
            $edited = parent_date_parts($edited_at)['label'];
        }
    }

    return [
        'id'      => (int) $row['id'],
        'kind'    => $kind,
        'tag'     => $kind === 'school' ? 'School' : 'Teacher',
        'title'   => $title !== '' ? $title : 'Announcement',
        'message' => trim((string) ($row['message'] ?? '')),
        'sender'  => $sender,
        'for'     => $for,
        'date'    => parent_date_parts($created)['label'],
        'time'    => ($ts !== false && $ts > 0) ? date('H:i', $ts) : '',
        'ts'      => ($ts !== false && $ts > 0) ? $ts : 0,
        'edited'  => $edited,
    ];
}

/**
 * One news feed from school-wide announcements and the announcements teachers sent to parents.
 * A school-wide announcement appears once. A teacher announcement appears once even when it reaches several of the
 * parent's children (the same class), with all their names. Newest first, at most $limit items.
 *
 * @param array $school_rows  id, title, message, created_at, edited_at
 * @param array $teacher_rows id, title, message, created_at, edited_at, t_title, t_surname, child_name (one row per child)
 * @return array{items: array, more: bool} "more" is true when older items were left out
 */
function parent_build_feed(array $school_rows, array $teacher_rows, string $school_name, int $limit): array
{
    $items = [];
    $seen_school = [];
    foreach ($school_rows as $row) {
        $id = (int) $row['id'];
        if (isset($seen_school[$id])) {
            continue;
        }
        $seen_school[$id] = true;
        $items[] = parent_feed_item($row, 'school', $school_name, '');
    }

    $grouped = [];
    foreach ($teacher_rows as $row) {
        $id = (int) $row['id'];
        if (!isset($grouped[$id])) {
            $grouped[$id] = ['row' => $row, 'names' => []];
        }
        $name = trim((string) ($row['child_name'] ?? ''));
        if ($name !== '' && !in_array($name, $grouped[$id]['names'], true)) {
            $grouped[$id]['names'][] = $name;
        }
    }
    foreach ($grouped as $group) {
        $items[] = parent_feed_item(
            $group['row'],
            'teacher',
            parent_teacher_display($group['row']['t_title'] ?? '', $group['row']['t_surname'] ?? ''),
            parent_join_names($group['names'])
        );
    }

    usort($items, function ($a, $b) {
        return [$b['ts'], $b['id']] <=> [$a['ts'], $a['id']];
    });

    $limit = max(0, $limit);
    return ['items' => array_slice($items, 0, $limit), 'more' => count($items) > $limit];
}

/**
 * Which heading an event sits under on the Events screen: "Today", "Tomorrow", "This week", "Next week", then the
 * month ("November", or "January 2027" in another year). Weeks run Monday to Sunday. Dates before today are "Earlier".
 */
function parent_event_group(string $date, string $today): string
{
    $d = strtotime(substr($date, 0, 10));
    $t = strtotime(substr($today, 0, 10));
    if ($d === false || $t === false) {
        return '';
    }
    $diff = (int) round(($d - $t) / 86400);
    if ($diff < 0) {
        return 'Earlier';
    }
    if ($diff === 0) {
        return 'Today';
    }
    if ($diff === 1) {
        return 'Tomorrow';
    }
    $to_sunday = 7 - (int) date('N', $t);
    if ($diff <= $to_sunday) {
        return 'This week';
    }
    if ($diff <= $to_sunday + 7) {
        return 'Next week';
    }
    return date('F', $d) . (date('Y', $d) !== date('Y', $t) ? ' ' . date('Y', $d) : '');
}

/** "work" for assignments, quizzes, tests and exams; "school" for holidays and other school events. */
function parent_event_section(string $category): string
{
    return in_array($category, ['assignment', 'quiz', 'test', 'exam'], true) ? 'work' : 'school';
}

/** One upcoming item as the Events screen needs it. $names are the children it is for. */
function parent_event_item(array $raw, array $names, string $today): array
{
    $date = (string) $raw['date'];
    $parts = parent_date_parts($date);
    $ts = strtotime($date);
    // Only assignments and quizzes carry a time. Midnight means "no time set".
    $time = (strlen($date) > 10 && $ts !== false && date('H:i', $ts) !== '00:00') ? date('H:i', $ts) : '';
    $title = trim((string) ($raw['title'] ?? ''));
    $subject = trim((string) ($raw['subject'] ?? ''));

    return [
        'date'     => substr($date, 0, 10),
        'time'     => $time,
        'dow'      => $parts['dow'],
        'day'      => $parts['day'],
        'group'    => parent_event_group($date, $today),
        'title'    => $title !== '' ? $title : 'Event',
        'kind'     => (string) $raw['kind'],
        'category' => (string) $raw['category'],
        'section'  => parent_event_section((string) $raw['category']),
        'subject'  => $subject !== '' ? $subject : null,
        'done'     => !empty($raw['done']),
        'for'      => parent_join_names($names),
    ];
}

/**
 * One list of what is coming up across all of a parent's children, earliest first, at most $limit items.
 * The same thing for several children (a class event, or an assignment none of them has handed in) shows once, with
 * all their names. An assignment one child has handed in and another has not stays two items.
 *
 * @param array $per_child list of ['name' => first name, 'items' => rows from parent_collect_upcoming()]
 * @return array{items: array, more: bool} "more" is true when later items were left out
 */
function parent_build_events(array $per_child, string $today, int $limit): array
{
    $merged = [];
    foreach ($per_child as $child) {
        $name = trim((string) ($child['name'] ?? ''));
        foreach ($child['items'] as $raw) {
            $key = implode('|', [
                (string) $raw['date'], (string) $raw['title'], (string) $raw['category'], (string) $raw['kind'],
                (string) ($raw['subject'] ?? ''), !empty($raw['done']) ? '1' : '0',
            ]);
            if (!isset($merged[$key])) {
                $merged[$key] = ['raw' => $raw, 'names' => []];
            }
            if ($name !== '' && !in_array($name, $merged[$key]['names'], true)) {
                $merged[$key]['names'][] = $name;
            }
        }
    }

    // A date without a time (a class event) sorts before the timed items on the same day
    uasort($merged, function ($a, $b) {
        return [(string) $a['raw']['date'], strtolower((string) $a['raw']['title'])]
            <=> [(string) $b['raw']['date'], strtolower((string) $b['raw']['title'])];
    });

    $items = [];
    foreach ($merged as $entry) {
        $items[] = parent_event_item($entry['raw'], $entry['names'], $today);
    }

    $limit = max(0, $limit);
    return ['items' => array_slice($items, 0, $limit), 'more' => count($items) > $limit];
}

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
// Part 2: database reads
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════

/** Id of the current academic year, or 0 when none is set. */
function parent_current_year_id(mysqli $conn): int
{
    $res = $conn->query('SELECT id FROM academic_years WHERE is_current = 1 LIMIT 1');
    $row = $res ? $res->fetch_assoc() : null;
    return $row ? (int) $row['id'] : 0;
}

/** The school's current term (1 to 4). */
function parent_current_term(mysqli $conn): int
{
    $res = $conn->query('SELECT current_global_term FROM platform_settings LIMIT 1');
    $row = $res ? $res->fetch_assoc() : null;
    $term = $row ? (int) $row['current_global_term'] : 1;
    return ($term >= 1 && $term <= 4) ? $term : 1;
}

/**
 * School name, logo (null when none was uploaded or the file is gone), two-letter initials and the name of the
 * current academic year ('' when none is set). Same rules as the learner dashboard's header and menu.
 *
 * @param string $base_dir the web root, used to check the logo file exists
 */
function parent_school_info(mysqli $conn, string $base_dir): array
{
    $name = 'My School';
    $logo = null;

    $res = $conn->query("SELECT setting_value, school_logo FROM school_name WHERE setting_key = 'school_name' LIMIT 1");
    if ($res && ($row = $res->fetch_assoc())) {
        $name = trim((string) $row['setting_value']) !== '' ? trim((string) $row['setting_value']) : $name;
        $path = trim((string) ($row['school_logo'] ?? ''));
        $is_default = ($path === '' || stripos($path, 'default_school.png') !== false);
        if (!$is_default) {
            $relative = ltrim(str_replace('\\', '/', $path), '/');
            if (strpos($relative, '..') === false && is_file(rtrim($base_dir, '/') . '/' . $relative)) {
                $logo = $relative;
            }
        }
    }

    // Shown under the school name in the menu, like the learner menu. Nothing is shown when no year is current.
    $year = '';
    $year_res = $conn->query('SELECT name FROM academic_years WHERE is_current = 1 LIMIT 1');
    if ($year_res && ($year_row = $year_res->fetch_assoc())) {
        $year = trim((string) ($year_row['name'] ?? ''));
    }

    return ['name' => $name, 'logo' => $logo, 'initials' => parent_initials($name), 'year' => $year];
}

/**
 * The learner with this users.id, but only if linked to this parent. Null otherwise (so a missing child and
 * someone else's child look the same).
 */
function parent_find_child(mysqli $conn, string $parent_email, int $child_id): ?array
{
    if ($child_id <= 0) {
        return null;
    }
    $stmt = $conn->prepare(
        "SELECT u.id, u.email, u.name, u.surname
         FROM parent_links pl
         JOIN users u ON u.email = pl.learner_email AND u.role = 'learner' AND COALESCE(u.is_deleted, 0) = 0
         WHERE pl.parent_email = ? AND u.id = ?
         LIMIT 1"
    );
    $stmt->bind_param('si', $parent_email, $child_id);
    $stmt->execute();
    $row = $stmt->get_result()->fetch_assoc();
    $stmt->close();

    return $row ?: null;
}

/** The parent's linked children with this year's class name. */
function parent_list_children(mysqli $conn, string $parent_email, int $year_id): array
{
    $stmt = $conn->prepare(
        "SELECT DISTINCT u.id, u.name, u.surname,
                (SELECT c.name FROM class_students cs JOIN classes c ON c.id = cs.class_id
                 WHERE cs.student_email = u.email AND cs.academic_year_id = ? LIMIT 1) AS class_name
         FROM parent_links pl
         JOIN users u ON u.email = pl.learner_email AND u.role = 'learner' AND COALESCE(u.is_deleted, 0) = 0
         WHERE pl.parent_email = ?
         ORDER BY u.name, u.surname"
    );
    $stmt->bind_param('is', $year_id, $parent_email);
    $stmt->execute();
    $result = $stmt->get_result();

    $children = [];
    while ($row = $result->fetch_assoc()) {
        $full = parent_full_name($row['name'], $row['surname']);
        $children[] = [
            'id'         => (int) $row['id'],
            'name'       => $full,
            'first_name' => trim((string) $row['name']),
            'initials'   => parent_person_initials($row['name'], $row['surname']),
            'class_name' => $row['class_name'] !== null ? (string) $row['class_name'] : null,
        ];
    }
    $stmt->close();

    return $children;
}

/**
 * The learner's quiz results for the current year that a parent may see, grouped by subject name.
 * A result is visible once the teacher published the marks and every open-ended answer in that attempt is graded.
 * Subject name and grouping follow the learner's own Grades page.
 *
 * @return array<string, array<int, array>> subject => result rows (newest first)
 */
function parent_fetch_published_results(mysqli $conn, string $learner_email, int $year_id): array
{
    $stmt = $conn->prepare(
        "SELECT DISTINCT
                r.id AS result_id, r.score, r.total, r.submitted_at,
                q.id AS quiz_id, q.title AS quiz_title, q.is_summative, q.weight_percent, q.term_number,
                COALESCE(ts.subject_name, CONCAT(COALESCE(u.title, ''), ' ', COALESCE(u.surname, 'Unknown'))) AS subject
         FROM quiz_results r
         JOIN quizzes q ON r.quiz_id = q.id
         JOIN class_students cs ON q.class_id = cs.class_id AND cs.student_email = r.user_email AND cs.academic_year_id = ?
         LEFT JOIN teacher_subjects ts ON ts.teacher_email = q.created_by AND ts.class_id = q.class_id
         LEFT JOIN users u ON q.created_by = u.email AND u.role = 'teacher'
         WHERE r.user_email = ?
           AND q.academic_year_id = ?
           AND q.publish_marks = 1
           AND (q.has_open_ended = 0 OR NOT EXISTS (
                SELECT 1
                FROM quizquestions qq
                LEFT JOIN open_ended_grades og ON og.question_id = qq.id AND og.attempt_id = r.attempt_id
                WHERE qq.quiz_id = q.id AND qq.question_type = 'open_ended'
                  AND (og.graded_by IS NULL OR og.graded_by = '')
           ))
         ORDER BY subject ASC, r.submitted_at DESC"
    );
    $stmt->bind_param('isi', $year_id, $learner_email, $year_id);
    $stmt->execute();
    $result = $stmt->get_result();

    $by_subject = [];
    while ($row = $result->fetch_assoc()) {
        $name = trim((string) $row['subject']);
        if ($name === '') {
            $name = 'Unknown subject';
        }
        $by_subject[$name][] = $row;
    }
    $stmt->close();

    return $by_subject;
}

/**
 * One row per subject with its mark for $term, the mark for the term before it, and the change.
 * Subjects with no published result at all are not listed.
 *
 * @return array<int, array{name: string, mark: ?int, prev_mark: ?int, delta: ?int, term: array, quizzes: array}>
 */
function parent_subject_marks(array $by_subject, int $term): array
{
    $rows = [];
    foreach ($by_subject as $name => $quizzes) {
        $current = parent_term_mark($quizzes, $term);
        $previous = $term > 1 ? parent_term_mark($quizzes, $term - 1) : null;
        $mark = $current['pct'];
        $prev_mark = $previous ? $previous['pct'] : null;
        $rows[] = [
            'name'      => (string) $name,
            'mark'      => $mark,
            'prev_mark' => $prev_mark,
            'delta'     => ($mark !== null && $prev_mark !== null) ? $mark - $prev_mark : null,
            'term'      => $current,
            'quizzes'   => $quizzes,
        ];
    }
    return $rows;
}

/**
 * Everything due or happening for one learner from $from_date (Y-m-d H:i:s) for the next $days days, as raw rows:
 * date (Y-m-d, or Y-m-d H:i:s for assignments and quizzes), title, kind (a label such as "Assignment due"), subject,
 * category ("assignment", "quiz", or the class event's type) and done (an assignment already handed in).
 * Takes at most $per_source rows from each source: assignments, quizzes and class events.
 * The Home screen and the Events screen both read this.
 *
 * @return array<int, array{date: string, title: string, kind: string, subject: ?string, category: string, done: bool}>
 */
function parent_collect_upcoming(mysqli $conn, string $learner_email, int $year_id, string $from_date, int $days, int $per_source): array
{
    $to_date = date('Y-m-d H:i:s', strtotime($from_date) + $days * 86400);
    $class_ids = "SELECT cs0.class_id FROM class_students cs0 WHERE cs0.student_email = ? AND cs0.academic_year_id = ?";
    $items = [];

    // Assignment due dates
    $stmt = $conn->prepare(
        "SELECT a.title, a.due_date AS d, s.id AS submission_id,
                (SELECT ts.subject_name FROM teacher_subjects ts
                 WHERE ts.teacher_email = a.created_by AND ts.class_id = a.class_id LIMIT 1) AS subject
         FROM assignments a
         LEFT JOIN submissions s ON s.assignment_id = a.id AND s.student_email = ?
         WHERE a.class_id IN ($class_ids)
           AND a.academic_year_id = ?
           AND a.due_date >= ? AND a.due_date <= ?
         ORDER BY a.due_date ASC
         LIMIT ?"
    );
    $stmt->bind_param('ssiissi', $learner_email, $learner_email, $year_id, $year_id, $from_date, $to_date, $per_source);
    $stmt->execute();
    $res = $stmt->get_result();
    while ($row = $res->fetch_assoc()) {
        $done = !empty($row['submission_id']);
        $items[] = [
            'date'     => (string) $row['d'],
            'title'    => (string) $row['title'],
            'kind'     => $done ? 'Assignment handed in' : 'Assignment due',
            'subject'  => $row['subject'],
            'category' => 'assignment',
            'done'     => $done,
        ];
    }
    $stmt->close();

    // Quizzes the learner has not handed in yet
    $stmt = $conn->prepare(
        "SELECT q.title, q.start_time AS d,
                (SELECT ts.subject_name FROM teacher_subjects ts
                 WHERE ts.teacher_email = q.created_by AND ts.class_id = q.class_id LIMIT 1) AS subject
         FROM quizzes q
         LEFT JOIN quiz_attempts qa ON qa.quiz_id = q.id AND qa.user_email = ? AND qa.status = 'submitted'
         WHERE q.class_id IN ($class_ids)
           AND q.academic_year_id = ?
           AND q.start_time >= ? AND q.start_time <= ?
           AND q.status IN ('Open', 'Scheduled')
           AND qa.id IS NULL
         ORDER BY q.start_time ASC
         LIMIT ?"
    );
    $stmt->bind_param('ssiissi', $learner_email, $learner_email, $year_id, $year_id, $from_date, $to_date, $per_source);
    $stmt->execute();
    $res = $stmt->get_result();
    while ($row = $res->fetch_assoc()) {
        $items[] = [
            'date'     => (string) $row['d'],
            'title'    => (string) $row['title'],
            'kind'     => 'Quiz',
            'subject'  => $row['subject'],
            'category' => 'quiz',
            'done'     => false,
        ];
    }
    $stmt->close();

    // Class events (tests, exams, holidays, school events)
    $from_day = substr($from_date, 0, 10);
    $to_day = substr($to_date, 0, 10);
    $stmt = $conn->prepare(
        "SELECT ae.title, ae.event_date AS d, ae.event_type
         FROM academic_events ae
         WHERE ae.class_id IN ($class_ids)
           AND ae.academic_year_id = ?
           AND ae.event_date >= ? AND ae.event_date <= ?
         ORDER BY ae.event_date ASC
         LIMIT ?"
    );
    $stmt->bind_param('siissi', $learner_email, $year_id, $year_id, $from_day, $to_day, $per_source);
    $stmt->execute();
    $res = $stmt->get_result();
    while ($row = $res->fetch_assoc()) {
        $type = (string) $row['event_type'];
        $items[] = [
            'date'     => (string) $row['d'],
            'title'    => (string) $row['title'],
            'kind'     => parent_event_kind($type),
            'subject'  => null,
            'category' => $type !== '' ? $type : 'other',
            'done'     => false,
        ];
    }
    $stmt->close();

    return $items;
}

/**
 * What is coming up for the learner (the Home screen's short list): assignment due dates, quizzes not yet taken, and
 * class events, from $from_date (Y-m-d H:i:s) for the next $days days, earliest first.
 */
function parent_fetch_upcoming(mysqli $conn, string $learner_email, int $year_id, string $from_date, int $days, int $limit): array
{
    $out = [];
    foreach (parent_merge_upcoming(parent_collect_upcoming($conn, $learner_email, $year_id, $from_date, $days, 20), $limit) as $item) {
        $parts = parent_date_parts((string) $item['date']);
        $kind = $item['kind'];
        if (!empty($item['subject'])) {
            $kind .= ' · ' . $item['subject'];
        }
        $out[] = [
            'date'  => substr((string) $item['date'], 0, 10),
            'dow'   => $parts['dow'],
            'day'   => $parts['day'],
            'title' => (string) $item['title'],
            'kind'  => $kind,
        ];
    }
    return $out;
}

/**
 * Latest announcements a parent should see for this learner: school-wide ones meant for everyone, and the
 * class announcements teachers sent to parents. Newest first.
 */
function parent_fetch_news(mysqli $conn, string $learner_email, int $year_id, string $school_name, int $limit): array
{
    $stmt = $conn->prepare(
        "SELECT a.id, a.title, a.created_at, a.class_id, u.title AS t_title, u.surname AS t_surname
         FROM announcements a
         LEFT JOIN users u ON u.email = a.created_by AND u.role = 'teacher'
         WHERE a.academic_year_id = ?
           AND (
                (a.class_id IS NULL AND a.target_role = 'all')
                OR (a.send_to = 'parents' AND a.class_id IN (
                        SELECT cs0.class_id FROM class_students cs0
                        WHERE cs0.student_email = ? AND cs0.academic_year_id = ?))
           )
         ORDER BY a.created_at DESC
         LIMIT ?"
    );
    $stmt->bind_param('isii', $year_id, $learner_email, $year_id, $limit);
    $stmt->execute();
    $res = $stmt->get_result();

    $news = [];
    while ($row = $res->fetch_assoc()) {
        $is_school = $row['class_id'] === null;
        $who = $is_school ? $school_name : parent_teacher_display($row['t_title'], $row['t_surname']);
        $news[] = [
            'id'    => (int) $row['id'],
            'title' => (string) $row['title'],
            'tag'   => $is_school ? 'School' : 'Teacher',
            'meta'  => parent_date_parts((string) $row['created_at'])['label'] . ' · ' . $who,
        ];
    }
    $stmt->close();

    return $news;
}

/**
 * The subject briefs (syllabus) posted for the learner's class this year, term by term, then by subject.
 * Same source as the learner's Syllabus page (api/learner/get_sbo.php). A brief whose teacher account is gone
 * still shows, with "Teacher" in place of the name.
 *
 * @return array<int, array{id: int, term: int, subject: string, teacher: string, topics: array, assessments: array, note: ?string, updated: string}>
 */
function parent_fetch_syllabus(mysqli $conn, string $learner_email, int $year_id): array
{
    $stmt = $conn->prepare(
        "SELECT sb.id, sb.term_number, sb.subject_name, sb.topics, sb.assessments, sb.notes, sb.updated_at,
                u.title AS t_title, u.surname AS t_surname
         FROM subject_briefs sb
         LEFT JOIN users u ON u.email = sb.created_by AND u.role = 'teacher'
         WHERE sb.academic_year_id = ?
           AND sb.class_id IN (
                SELECT cs.class_id FROM class_students cs
                WHERE cs.student_email = ? AND cs.academic_year_id = ?)
         ORDER BY sb.term_number ASC, sb.subject_name ASC"
    );
    $stmt->bind_param('isi', $year_id, $learner_email, $year_id);
    $stmt->execute();
    $result = $stmt->get_result();

    $briefs = [];
    while ($row = $result->fetch_assoc()) {
        $term = (int) $row['term_number'];
        if ($term < 1 || $term > 4) {
            continue;
        }
        $subject = trim((string) $row['subject_name']);
        $note = trim((string) ($row['notes'] ?? ''));
        $briefs[] = [
            'id'          => (int) $row['id'],
            'term'        => $term,
            'subject'     => $subject !== '' ? $subject : 'Subject',
            'teacher'     => parent_teacher_display($row['t_title'], $row['t_surname']),
            'topics'      => parent_parse_topics($row['topics']),
            'assessments' => parent_parse_assessments($row['assessments']),
            'note'        => $note !== '' ? $note : null,
            'updated'     => parent_date_parts((string) $row['updated_at'])['label'],
        ];
    }
    $stmt->close();

    return $briefs;
}

/**
 * The News feed for a parent, across all their linked children (spec 3.4): school-wide announcements for everyone,
 * plus the announcements teachers sent to parents for the class each linked child is in this year.
 * Every row is scoped to the signed-in parent through parent_links. Learner emails are not returned.
 *
 * @return array{items: array, more: bool}
 */
function parent_fetch_feed(mysqli $conn, string $parent_email, int $year_id, string $school_name, int $limit): array
{
    // School-wide: no class, meant for everyone (the same rule as the Home screen)
    $fetch = $limit + 1;
    $stmt = $conn->prepare(
        "SELECT a.id, a.title, a.message, a.created_at, a.edited_at
         FROM announcements a
         WHERE a.academic_year_id = ? AND a.class_id IS NULL AND a.target_role = 'all'
         ORDER BY a.created_at DESC, a.id DESC
         LIMIT ?"
    );
    $stmt->bind_param('ii', $year_id, $fetch);
    $stmt->execute();
    $school_rows = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
    $stmt->close();

    // Teacher announcements sent to parents, one row per linked child in that class
    $row_cap = $fetch * 8;
    $stmt = $conn->prepare(
        "SELECT a.id, a.title, a.message, a.created_at, a.edited_at,
                t.title AS t_title, t.surname AS t_surname, ch.name AS child_name
         FROM parent_links pl
         JOIN users ch ON ch.email = pl.learner_email AND ch.role = 'learner' AND COALESCE(ch.is_deleted, 0) = 0
         JOIN class_students cs ON cs.student_email = ch.email AND cs.academic_year_id = ?
         JOIN announcements a ON a.class_id = cs.class_id AND a.academic_year_id = ? AND a.send_to = 'parents'
         LEFT JOIN users t ON t.email = a.created_by AND t.role = 'teacher'
         WHERE pl.parent_email = ?
         ORDER BY a.created_at DESC, a.id DESC, ch.name ASC
         LIMIT ?"
    );
    $stmt->bind_param('iisi', $year_id, $year_id, $parent_email, $row_cap);
    $stmt->execute();
    $teacher_rows = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
    $stmt->close();

    return parent_build_feed($school_rows, $teacher_rows, $school_name, $limit);
}

/**
 * The learners linked to this parent, in the same order as parent_list_children(). Includes each learner's email so
 * their data can be read. It is for server use only and is never sent to the browser.
 *
 * @return array<int, array{email: string, name: string}>
 */
function parent_linked_learners(mysqli $conn, string $parent_email): array
{
    $stmt = $conn->prepare(
        "SELECT DISTINCT u.email, u.name, u.surname
         FROM parent_links pl
         JOIN users u ON u.email = pl.learner_email AND u.role = 'learner' AND COALESCE(u.is_deleted, 0) = 0
         WHERE pl.parent_email = ?
         ORDER BY u.name, u.surname"
    );
    $stmt->bind_param('s', $parent_email);
    $stmt->execute();
    $result = $stmt->get_result();

    $learners = [];
    while ($row = $result->fetch_assoc()) {
        $learners[] = ['email' => (string) $row['email'], 'name' => trim((string) $row['name'])];
    }
    $stmt->close();

    return $learners;
}

/**
 * The Events feed for a parent, across all their linked children (spec 3.5): assignment due dates, quizzes not yet
 * taken and the class events (tests, exams, holidays, school events) from the start of $today for the next $days days.
 * Every read is for a learner linked to this parent.
 *
 * @return array{items: array, more: bool}
 */
function parent_fetch_events(mysqli $conn, string $parent_email, int $year_id, string $today, int $days, int $limit): array
{
    $from = substr($today, 0, 10) . ' 00:00:00';
    $per_child = [];
    foreach (parent_linked_learners($conn, $parent_email) as $learner) {
        $per_child[] = [
            'name'  => $learner['name'],
            'items' => parent_collect_upcoming($conn, $learner['email'], $year_id, $from, $days, $limit + 1),
        ];
    }

    return parent_build_events($per_child, substr($today, 0, 10), $limit);
}
