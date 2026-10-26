<?php
require_once __DIR__ . '/../../auth/session_guard.php';
require_once dirname(__DIR__, 2) . '/config.php';

header('Content-Type: application/json');

if (!isset($_SESSION['email']) || $_SESSION['role'] !== 'learner') {
    echo json_encode(['error' => 'Unauthorized']); exit;
}

$email        = $_SESSION['email'];
$now          = date('Y-m-d H:i:s');
$sevenDaysAgo = date('Y-m-d H:i:s', strtotime('-7 days'));

// First name for the home greeting. Reads whatever the login stored in the session;
// change these keys (or query users) if your session uses something else.
$firstName = trim(explode(' ', trim((string)($_SESSION['first_name'] ?? $_SESSION['name'] ?? '')))[0]);
// The database is the source of truth for the first name (users.name); the session value above is only a fallback.
$nameStmt = $conn->prepare("SELECT name FROM users WHERE email = ? LIMIT 1");
$nameStmt->bind_param("s", $email);
$nameStmt->execute();
$dbName = trim((string)($nameStmt->get_result()->fetch_assoc()['name'] ?? ''));
$nameStmt->close();
if ($dbName !== '') { $firstName = trim(explode(' ', $dbName)[0]); }
$learner   = ['first_name' => $firstName];

// ── Academic Year ──
$yearRes = $conn->query("SELECT id FROM academic_years WHERE is_current = 1 LIMIT 1");
if ($yearRes->num_rows === 0) { echo json_encode(['error' => 'No active year']); exit; }
$yearId = (int)$yearRes->fetch_assoc()['id'];

// ── Learner's Class ──
$classStmt = $conn->prepare("SELECT class_id FROM class_students WHERE student_email = ? AND academic_year_id = ? LIMIT 1");
$classStmt->bind_param("si", $email, $yearId);
$classStmt->execute();
$classId = $classStmt->get_result()->fetch_assoc()['class_id'] ?? null;
$classStmt->close();

if (!$classId) {
    echo json_encode(['todo' => [], 'recent' => [], 'events' => [], 'upcoming' => [], 'learner' => $learner, 'no_class' => true, 'has_content' => false, 'snapshot' => ['quiz' => null, 'assignment' => null, 'announcement' => null]]);
    exit;
}

$todo   = [];
$recent = [];

// ────────────────────────────────────────────
// SNAPSHOT: Latest Quiz, Upcoming Assignment, Latest Announcement
// Mirrors teacher's get_dashboard_snapshot.php — one item per category
// ────────────────────────────────────────────
$snapshot = ['quiz' => null, 'assignment' => null, 'announcement' => null];

// Latest quiz available to this learner (most recent start_time, Open/Scheduled)
$stmt = $conn->prepare("
    SELECT q.id, q.title, q.status, q.start_time
    FROM quizzes q
    WHERE q.class_id = ?
      AND q.academic_year_id = ?
      AND q.status IN ('Open', 'Scheduled')
    ORDER BY q.start_time DESC
    LIMIT 1
");
$stmt->bind_param("ii", $classId, $yearId);
$stmt->execute();
$quizRow = $stmt->get_result()->fetch_assoc();
$stmt->close();

if ($quizRow) {
    $snapshot['quiz'] = [
        'id'         => $quizRow['id'],
        'title'      => $quizRow['title'],
        'status'     => $quizRow['status'],
        'start_time' => $quizRow['start_time'] ? date('d M Y', strtotime($quizRow['start_time'])) : 'Not set'
    ];
}

// Next upcoming assignment due, with submission status for this learner
$stmt = $conn->prepare("
    SELECT a.id, a.title, a.due_date,
           s.id AS submission_id
    FROM assignments a
    LEFT JOIN submissions s ON s.assignment_id = a.id AND s.student_email = ?
    WHERE a.class_id = ?
      AND a.academic_year_id = ?
      AND a.due_date >= CURDATE()
    ORDER BY a.due_date ASC
    LIMIT 1
");
$stmt->bind_param("sii", $email, $classId, $yearId);
$stmt->execute();
$assignmentRow = $stmt->get_result()->fetch_assoc();
$stmt->close();

if ($assignmentRow) {
    $snapshot['assignment'] = [
        'id'          => $assignmentRow['id'],
        'title'       => $assignmentRow['title'],
        'due_date'    => date('d M Y', strtotime($assignmentRow['due_date'])),
        'days_left'   => (int)ceil((strtotime($assignmentRow['due_date']) - time()) / 86400),
        'submitted'   => $assignmentRow['submission_id'] !== null
    ];
}

// Latest announcement sent to learners in this class
$stmt = $conn->prepare("
    SELECT a.id, a.title, a.created_at,
           CONCAT(COALESCE(u.title,''), ' ', u.surname) AS teacher
    FROM announcements a
    LEFT JOIN users u ON a.created_by = u.email
    WHERE a.class_id = ?
      AND a.academic_year_id = ?
      AND a.send_to = 'learners'
    ORDER BY a.created_at DESC
    LIMIT 1
");
$stmt->bind_param("ii", $classId, $yearId);
$stmt->execute();
$announcementRow = $stmt->get_result()->fetch_assoc();
$stmt->close();

if ($announcementRow) {
    $snapshot['announcement'] = [
        'id'         => $announcementRow['id'],
        'title'      => $announcementRow['title'],
        'teacher'    => trim($announcementRow['teacher']),
        'created_at' => date('d M Y', strtotime($announcementRow['created_at']))
    ];
}

// ────────────────────────────────────────────
// TO-DO 1: Quizzes not yet attempted
// FIX: include both 'Open' and 'Scheduled' statuses
// ────────────────────────────────────────────
$stmt = $conn->prepare("
    SELECT q.id, q.title, q.start_time, q.is_summative,
           CONCAT(COALESCE(u.title,''), ' ', COALESCE(u.surname,'')) AS teacher
    FROM quizzes q
    LEFT JOIN quiz_attempts qa ON qa.quiz_id = q.id AND qa.user_email = ?
    LEFT JOIN users u ON q.created_by = u.email
    WHERE q.class_id = ?
      AND q.academic_year_id = ?
      AND q.status IN ('Open', 'Scheduled')
      AND q.start_time <= ?
      AND qa.id IS NULL
    ORDER BY q.start_time ASC
");
$stmt->bind_param("siis", $email, $classId, $yearId, $now);
$stmt->execute();
$res = $stmt->get_result();
while ($row = $res->fetch_assoc()) {
    $todo[] = [
        'type'  => 'quiz',
        'id'    => $row['id'],
        'title' => $row['title'],
        'label' => 'Quiz available',
        'meta'  => 'Started ' . date('M j', strtotime($row['start_time'])),
        'start_time'   => $row['start_time'],
        'is_summative' => (int)$row['is_summative'],
        'teacher'      => trim((string)$row['teacher'])
    ];
}
$stmt->close();

// ────────────────────────────────────────────
// RESUME: quizzes this learner has started but not finished (still within the quiz duration).
// Kept out of $todo on purpose so the desktop Home is unchanged; the mobile Home reads `resume`.
// ────────────────────────────────────────────
$resume = [];
$stmt = $conn->prepare("
    SELECT q.id, q.title, q.start_time, q.is_summative,
           CONCAT(COALESCE(u.title,''), ' ', COALESCE(u.surname,'')) AS teacher
    FROM quiz_attempts qa
    JOIN quizzes q ON q.id = qa.quiz_id
    LEFT JOIN users u ON q.created_by = u.email
    WHERE qa.user_email = ?
      AND qa.status = 'in_progress'
      AND q.class_id = ?
      AND q.academic_year_id = ?
      AND q.status = 'Open'
      AND DATE_ADD(COALESCE(qa.start_time, qa.last_attempt), INTERVAL q.duration MINUTE) > ?
    ORDER BY qa.attempt_id DESC
");
$stmt->bind_param("siis", $email, $classId, $yearId, $now);
$stmt->execute();
$res = $stmt->get_result();
$resumeSeen = [];
while ($row = $res->fetch_assoc()) {
    if (isset($resumeSeen[$row['id']])) continue;
    $resumeSeen[$row['id']] = true;
    $resume[] = [
        'type'         => 'quiz',
        'id'           => $row['id'],
        'title'        => $row['title'],
        'label'        => 'Continue quiz',
        'meta'         => 'In progress',
        'start_time'   => $row['start_time'],
        'is_summative' => (int)$row['is_summative'],
        'teacher'      => trim((string)$row['teacher'])
    ];
}
$stmt->close();

// ────────────────────────────────────────────
// TO-DO 2: Assignments not yet submitted & not past due
// ────────────────────────────────────────────
$stmt = $conn->prepare("
    SELECT a.id, a.title, a.due_date,
           CONCAT(COALESCE(u.title,''), ' ', COALESCE(u.surname,'')) AS teacher
    FROM assignments a
    LEFT JOIN submissions s ON s.assignment_id = a.id AND s.student_email = ?
    LEFT JOIN users u ON a.created_by = u.email
    WHERE a.class_id = ?
      AND a.academic_year_id = ?
      AND a.due_date >= ?
      AND s.id IS NULL
    ORDER BY a.due_date ASC
");
$stmt->bind_param("siis", $email, $classId, $yearId, $now);
$stmt->execute();
$res = $stmt->get_result();
while ($row = $res->fetch_assoc()) {
    $todo[] = [
        'type'  => 'assignment',
        'id'    => $row['id'],
        'title' => $row['title'],
        'label' => 'Assignment due',
        'meta'  => 'Due ' . date('M j', strtotime($row['due_date'])),
        'due_date' => $row['due_date'],
        'teacher'  => trim((string)$row['teacher'])
    ];
}
$stmt->close();

// ────────────────────────────────────────────
// TO-DO 3: Evaluations not yet submitted
// ────────────────────────────────────────────
$stmt = $conn->prepare("
    SELECT te.id, te.title,
           CONCAT(COALESCE(u.title,''), ' ', u.surname) AS teacher
    FROM teacher_evaluations te
    JOIN users u ON te.created_by = u.email
    WHERE te.class_id = ?
      AND te.is_active = 1
    ORDER BY te.created_at DESC
");
$stmt->bind_param("i", $classId);
$stmt->execute();
$res = $stmt->get_result();
while ($row = $res->fetch_assoc()) {
    $hash = hash('sha256', $email . $row['id'] . 'salt123');

    $check = $conn->prepare("SELECT 1 FROM evaluation_responses WHERE evaluation_id = ? AND unique_hash = ?");
    $check->bind_param("is", $row['id'], $hash);
    $check->execute();
    $checkResult = $check->get_result();
    $check->close();

    if ($checkResult->num_rows === 0) {
        $todo[] = [
            'type'  => 'evaluation',
            'id'    => $row['id'],
            'title' => $row['title'],
            'label' => 'Evaluation pending',
            'meta'  => trim($row['teacher'])
        ];
    }
}
$stmt->close();

// ────────────────────────────────────────────
// RECENT 1: Announcements (last 7 days)
// ────────────────────────────────────────────
$stmt = $conn->prepare("
    SELECT a.id, a.title, a.created_at,
           CONCAT(COALESCE(u.title,''), ' ', u.surname) AS teacher
    FROM announcements a
    LEFT JOIN users u ON a.created_by = u.email
    WHERE a.class_id = ?
      AND a.academic_year_id = ?
      AND a.send_to = 'learners'
      AND a.created_at >= ?
    ORDER BY a.created_at DESC
    LIMIT 3
");
$stmt->bind_param("iis", $classId, $yearId, $sevenDaysAgo);
$stmt->execute();
$res = $stmt->get_result();
while ($row = $res->fetch_assoc()) {
    $recent[] = [
        'type'       => 'announcement',
        'id'         => (int)$row['id'],
        'scope'      => 'teacher',
        'title'      => $row['title'],
        'meta'       => trim($row['teacher']),
        'created_at' => $row['created_at']
    ];
}
$stmt->close();

// ────────────────────────────────────────────
// RECENT 2: Resources (last 7 days)
// ────────────────────────────────────────────
$stmt = $conn->prepare("
    SELECT r.id, r.title, r.uploaded_at,
           CONCAT(COALESCE(u.title,''), ' ', u.surname) AS teacher
    FROM resources r
    LEFT JOIN users u ON r.uploaded_by = u.email
    WHERE r.class_id = ?
      AND r.academic_year_id = ?
      AND r.uploaded_at >= ?
    ORDER BY r.uploaded_at DESC
    LIMIT 3
");
$stmt->bind_param("iis", $classId, $yearId, $sevenDaysAgo);
$stmt->execute();
$res = $stmt->get_result();
while ($row = $res->fetch_assoc()) {
    $recent[] = [
        'type'       => 'resource',
        'id'         => (int)$row['id'],
        'title'      => $row['title'],
        'meta'       => trim($row['teacher']),
        'created_at' => $row['uploaded_at']
    ];
}
$stmt->close();

// ────────────────────────────────────────────
// RECENT 3: Assignments posted (last 7 days)
// ────────────────────────────────────────────
$stmt = $conn->prepare("
    SELECT a.id, a.title, a.created_at,
           CONCAT(COALESCE(u.title,''), ' ', u.surname) AS teacher
    FROM assignments a
    LEFT JOIN users u ON a.created_by = u.email
    WHERE a.class_id = ?
      AND a.academic_year_id = ?
      AND a.created_at >= ?
    ORDER BY a.created_at DESC
    LIMIT 3
");
$stmt->bind_param("iis", $classId, $yearId, $sevenDaysAgo);
$stmt->execute();
$res = $stmt->get_result();
while ($row = $res->fetch_assoc()) {
    $recent[] = [
        'type'       => 'assignment',
        'id'         => (int)$row['id'],
        'title'      => $row['title'],
        'meta'       => trim($row['teacher']),
        'created_at' => $row['created_at']
    ];
}
$stmt->close();

// ────────────────────────────────────────────
// RECENT 4: Quizzes created (last 7 days)
// NEW: newly created/opened quizzes appear in recent activity
// ────────────────────────────────────────────
$stmt = $conn->prepare("
    SELECT q.id, q.title, q.start_time AS created_at,
           CONCAT(COALESCE(u.title,''), ' ', u.surname) AS teacher
    FROM quizzes q
    LEFT JOIN users u ON q.created_by = u.email
    WHERE q.class_id = ?
      AND q.academic_year_id = ?
      AND q.start_time >= ?
      AND q.status IN ('Open', 'Scheduled')
    ORDER BY q.start_time DESC
    LIMIT 3
");
$stmt->bind_param("iis", $classId, $yearId, $sevenDaysAgo);
$stmt->execute();
$res = $stmt->get_result();
while ($row = $res->fetch_assoc()) {
    $recent[] = [
        'type'       => 'quiz',
        'id'         => (int)$row['id'],
        'title'      => $row['title'],
        'meta'       => trim($row['teacher']),
        'created_at' => $row['created_at']
    ];
}
$stmt->close();

// ── Sort recent by date desc, cap at 3 ──
usort($recent, fn($a, $b) => strtotime($b['created_at']) - strtotime($a['created_at']));
$recent = array_slice($recent, 0, 3);

// ── Relative time helper ──
function timeAgo($datetime) {
    $diff = time() - strtotime($datetime);
    if ($diff < 86400)  return 'Today';
    if ($diff < 172800) return 'Yesterday';
    $days = floor($diff / 86400);
    return $days . ' day' . ($days > 1 ? 's' : '') . ' ago';
}

foreach ($recent as &$item) {
    $item['time_ago'] = timeAgo($item['created_at']);
}
unset($item);

$events = [];
$today  = date('Y-m-d');

$stmt = $conn->prepare("
    SELECT ae.title, ae.event_date, ae.event_type
    FROM academic_events ae
    WHERE ae.class_id = ?
      AND ae.academic_year_id = ?
      AND ae.event_date >= ?
    ORDER BY ae.event_date ASC
    LIMIT 5
");
$stmt->bind_param("iis", $classId, $yearId, $today);
$stmt->execute();
$res = $stmt->get_result();
while ($row = $res->fetch_assoc()) {
    $events[] = [
        'title'      => $row['title'],
        'event_date' => $row['event_date'],
        'event_type' => $row['event_type']
    ];
}
$stmt->close();

// ────────────────────────────────────────────
// UPCOMING (desktop "Coming up"): unsubmitted assignments due, quizzes yet to
// start, and school events, merged and sorted by date. `events` is untouched
// so the mobile layout keeps working as before.
// ────────────────────────────────────────────
$upcoming = [];

$stmt = $conn->prepare("
    SELECT a.title, a.due_date AS d
    FROM assignments a
    LEFT JOIN submissions s ON s.assignment_id = a.id AND s.student_email = ?
    WHERE a.class_id = ? AND a.academic_year_id = ?
      AND a.due_date >= CURDATE() AND s.id IS NULL
    ORDER BY a.due_date ASC LIMIT 5
");
$stmt->bind_param("sii", $email, $classId, $yearId);
$stmt->execute();
$res = $stmt->get_result();
while ($row = $res->fetch_assoc()) {
    $upcoming[] = ['kind' => 'assignment', 'label' => 'Assignment', 'title' => $row['title'], 'date' => date('Y-m-d', strtotime($row['d']))];
}
$stmt->close();

$stmt = $conn->prepare("
    SELECT q.title, q.start_time AS d
    FROM quizzes q
    WHERE q.class_id = ? AND q.academic_year_id = ?
      AND q.status IN ('Open', 'Scheduled') AND q.start_time > ?
    ORDER BY q.start_time ASC LIMIT 5
");
$stmt->bind_param("iis", $classId, $yearId, $now);
$stmt->execute();
$res = $stmt->get_result();
while ($row = $res->fetch_assoc()) {
    $upcoming[] = ['kind' => 'quiz', 'label' => 'Quiz', 'title' => $row['title'], 'date' => date('Y-m-d', strtotime($row['d']))];
}
$stmt->close();

foreach ($events as $e) {
    $upcoming[] = [
        'kind'  => 'academic',
        'label' => $e['event_type'] ? ucfirst(str_replace('_', ' ', $e['event_type'])) : 'School event',
        'title' => $e['title'],
        'date'  => $e['event_date']
    ];
}
usort($upcoming, fn($a, $b) => strcmp($a['date'], $b['date']));
$upcoming = array_slice($upcoming, 0, 5);

// ── Has the class ever had anything posted? Drives the "just joined" empty state ──
// Assumes unpublished quizzes use status 'Draft'; adjust if yours differ.
$stmt = $conn->prepare("
    SELECT (SELECT COUNT(*) FROM quizzes       WHERE class_id = ? AND academic_year_id = ? AND status <> 'Draft')
         + (SELECT COUNT(*) FROM assignments   WHERE class_id = ? AND academic_year_id = ?)
         + (SELECT COUNT(*) FROM announcements WHERE class_id = ? AND academic_year_id = ? AND send_to = 'learners')
         + (SELECT COUNT(*) FROM resources     WHERE class_id = ? AND academic_year_id = ?) AS n
");
$stmt->bind_param("iiiiiiii", $classId, $yearId, $classId, $yearId, $classId, $yearId, $classId, $yearId);
$stmt->execute();
$hasContent = ((int)($stmt->get_result()->fetch_assoc()['n'] ?? 0)) > 0;
$stmt->close();

echo json_encode(['todo' => $todo, 'resume' => $resume, 'recent' => $recent, 'events' => $events, 'upcoming' => $upcoming, 'learner' => $learner, 'has_content' => $hasContent, 'snapshot' => $snapshot]);