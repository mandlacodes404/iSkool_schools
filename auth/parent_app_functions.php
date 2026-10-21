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
 * School name, logo (null when none was uploaded or the file is gone) and two-letter initials.
 * Same rules as the learner dashboard's header.
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

    return ['name' => $name, 'logo' => $logo, 'initials' => parent_initials($name)];
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
 * What is coming up for the learner: assignment due dates, quizzes not yet taken, and class events,
 * from $from_date (Y-m-d H:i:s) for the next $days days, earliest first.
 */
function parent_fetch_upcoming(mysqli $conn, string $learner_email, int $year_id, string $from_date, int $days, int $limit): array
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
         LIMIT 20"
    );
    $stmt->bind_param('ssiiss', $learner_email, $learner_email, $year_id, $year_id, $from_date, $to_date);
    $stmt->execute();
    $res = $stmt->get_result();
    while ($row = $res->fetch_assoc()) {
        $kind = empty($row['submission_id']) ? 'Assignment due' : 'Assignment handed in';
        $items[] = ['date' => $row['d'], 'title' => $row['title'], 'kind' => $kind, 'subject' => $row['subject']];
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
         LIMIT 20"
    );
    $stmt->bind_param('ssiiss', $learner_email, $learner_email, $year_id, $year_id, $from_date, $to_date);
    $stmt->execute();
    $res = $stmt->get_result();
    while ($row = $res->fetch_assoc()) {
        $items[] = ['date' => $row['d'], 'title' => $row['title'], 'kind' => 'Quiz', 'subject' => $row['subject']];
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
         LIMIT 20"
    );
    $stmt->bind_param('siiss', $learner_email, $year_id, $year_id, $from_day, $to_day);
    $stmt->execute();
    $res = $stmt->get_result();
    while ($row = $res->fetch_assoc()) {
        $items[] = ['date' => $row['d'], 'title' => $row['title'], 'kind' => parent_event_kind((string) $row['event_type']), 'subject' => null];
    }
    $stmt->close();

    $out = [];
    foreach (parent_merge_upcoming($items, $limit) as $item) {
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
