<?php
require_once __DIR__ . '/../../auth/session_guard.php';
header('Content-Type: application/json');
require_once dirname(__DIR__, 2) . '/config.php';

if (!isset($_SESSION['email']) || $_SESSION['role'] !== 'teacher') {
    echo json_encode(['error' => 'Unauthorized']); exit();
}

$email = $_SESSION['email'];

$yearResult = $conn->query("SELECT id FROM academic_years WHERE is_current = 1 LIMIT 1");
$current_year_id = (int)$yearResult->fetch_assoc()['id'];

if (!$current_year_id) {
    echo json_encode(['error' => 'No active academic year']); exit();
}

// ── Existing desktop "Quick Snapshot" queries (unchanged) ──

$stmt = $conn->prepare("
    SELECT q.id, q.title, q.status, q.start_time, c.name AS class_name
    FROM quizzes q
    JOIN classes c ON q.class_id = c.id
    WHERE q.created_by = ? AND q.academic_year_id = ?
    ORDER BY q.id DESC LIMIT 1
");
$stmt->bind_param("si", $email, $current_year_id);
$stmt->execute();
$quiz = $stmt->get_result()->fetch_assoc();
$stmt->close();

$stmt = $conn->prepare("
    SELECT a.id, a.title, a.due_date, c.name AS class_name
    FROM assignments a
    JOIN classes c ON a.class_id = c.id
    WHERE a.created_by = ? AND a.academic_year_id = ?
      AND a.due_date >= CURDATE()
    ORDER BY a.due_date ASC LIMIT 1
");
$stmt->bind_param("si", $email, $current_year_id);
$stmt->execute();
$assignment = $stmt->get_result()->fetch_assoc();
$stmt->close();

$stmt = $conn->prepare("
    SELECT a.id, a.title, a.created_at, c.name AS class_name
    FROM announcements a
    JOIN classes c ON a.class_id = c.id
    WHERE a.created_by = ? AND a.academic_year_id = ?
    ORDER BY a.created_at DESC LIMIT 1
");
$stmt->bind_param("si", $email, $current_year_id);
$stmt->execute();
$announcement = $stmt->get_result()->fetch_assoc();
$stmt->close();

// ── NEW: Mobile home "Recent activity" trail ──
// Last 4 things this teacher created, across all 4 content types,
// merged by created_at. Each row is normalised to the same shape so
// the frontend can render them without a type-specific branch beyond
// picking an icon/colour.

$trail = [];

$stmt = $conn->prepare("
    SELECT q.id, q.title, q.created_at, c.name AS class_name
    FROM quizzes q
    JOIN classes c ON q.class_id = c.id
    WHERE q.created_by = ? AND q.academic_year_id = ?
    ORDER BY q.created_at DESC LIMIT 4
");
$stmt->bind_param("si", $email, $current_year_id);
$stmt->execute();
$res = $stmt->get_result();
while ($row = $res->fetch_assoc()) {
    $trail[] = [
        'type'       => 'quiz',
        'id'         => (int)$row['id'],
        'title'      => $row['title'],
        'class_name' => $row['class_name'],
        'created_at' => $row['created_at'],
    ];
}
$stmt->close();

$stmt = $conn->prepare("
    SELECT a.id, a.title, a.created_at, c.name AS class_name
    FROM assignments a
    JOIN classes c ON a.class_id = c.id
    WHERE a.created_by = ? AND a.academic_year_id = ?
    ORDER BY a.created_at DESC LIMIT 4
");
$stmt->bind_param("si", $email, $current_year_id);
$stmt->execute();
$res = $stmt->get_result();
while ($row = $res->fetch_assoc()) {
    $trail[] = [
        'type'       => 'assignment',
        'id'         => (int)$row['id'],
        'title'      => $row['title'],
        'class_name' => $row['class_name'],
        'created_at' => $row['created_at'],
    ];
}
$stmt->close();

$stmt = $conn->prepare("
    SELECT a.id, a.title, a.created_at, c.name AS class_name
    FROM announcements a
    JOIN classes c ON a.class_id = c.id
    WHERE a.created_by = ? AND a.academic_year_id = ?
    ORDER BY a.created_at DESC LIMIT 4
");
$stmt->bind_param("si", $email, $current_year_id);
$stmt->execute();
$res = $stmt->get_result();
while ($row = $res->fetch_assoc()) {
    $trail[] = [
        'type'       => 'announcement',
        'id'         => (int)$row['id'],
        'title'      => $row['title'],
        'class_name' => $row['class_name'],
        'created_at' => $row['created_at'],
    ];
}
$stmt->close();

$stmt = $conn->prepare("
    SELECT r.id, r.title, r.uploaded_at AS created_at, c.name AS class_name
    FROM resources r
    JOIN classes c ON r.class_id = c.id
    WHERE r.uploaded_by = ? AND r.academic_year_id = ?
    ORDER BY r.uploaded_at DESC LIMIT 4
");
$stmt->bind_param("si", $email, $current_year_id);
$stmt->execute();
$res = $stmt->get_result();
while ($row = $res->fetch_assoc()) {
    $trail[] = [
        'type'       => 'resource',
        'id'         => (int)$row['id'],
        'title'      => $row['title'],
        'class_name' => $row['class_name'],
        'created_at' => $row['created_at'],
    ];
}
$stmt->close();

// Merge all four candidate pools by created_at desc, keep top 4 overall.
usort($trail, function ($a, $b) {
    return strtotime($b['created_at']) <=> strtotime($a['created_at']);
});
$trail = array_slice($trail, 0, 4);

// Relative time label ("2 hours ago", "Yesterday", "3 days ago") —
// computed server-side so the frontend just prints it.
foreach ($trail as &$item) {
    $item['time_label'] = format_relative_time($item['created_at']);
}
unset($item);

function format_relative_time($datetime) {
    $diff = time() - strtotime($datetime);
    if ($diff < 60)   return 'Just now';
    if ($diff < 3600) return floor($diff / 60) . ' min ago';
    if ($diff < 86400) return floor($diff / 3600) . ' hour' . (floor($diff / 3600) != 1 ? 's' : '') . ' ago';
    if ($diff < 172800) return 'Yesterday, ' . date('g:i A', strtotime($datetime));
    if ($diff < 604800) return floor($diff / 86400) . ' days ago';
    return date('d M Y', strtotime($datetime));
}

// ── NEW: Mobile home "Upcoming" week strip ──
// Events for the current Mon–Sun week only (assignments due,
// quizzes closing/opening, academic_events, teacher_reminders),
// same four source tables the existing month calendar already
// reads from in get_calendar_events.php — narrowed to 7 days so
// the mobile strip can show a week-view instead of a full month.

$monday = date('Y-m-d', strtotime('monday this week'));
$sunday = date('Y-m-d', strtotime('sunday this week'));

$week_events = [];

$stmt = $conn->prepare("
    SELECT a.due_date AS event_date, a.title, c.name AS class_name
    FROM assignments a
    JOIN classes c ON a.class_id = c.id
    WHERE a.created_by = ? AND a.academic_year_id = ?
      AND DATE(a.due_date) BETWEEN ? AND ?
");
$stmt->bind_param("siss", $email, $current_year_id, $monday, $sunday);
$stmt->execute();
$res = $stmt->get_result();
while ($row = $res->fetch_assoc()) {
    $week_events[] = [
        'type'       => 'assignment',
        'date'       => date('Y-m-d', strtotime($row['event_date'])),
        'title'      => $row['title'],
        'class_name' => $row['class_name'],
        'label'      => 'Due',
    ];
}
$stmt->close();

$stmt = $conn->prepare("
    SELECT q.start_time AS event_date, q.title, c.name AS class_name
    FROM quizzes q
    JOIN classes c ON q.class_id = c.id
    WHERE q.created_by = ? AND q.academic_year_id = ?
      AND DATE(q.start_time) BETWEEN ? AND ?
");
$stmt->bind_param("siss", $email, $current_year_id, $monday, $sunday);
$stmt->execute();
$res = $stmt->get_result();
while ($row = $res->fetch_assoc()) {
    $week_events[] = [
        'type'       => 'quiz',
        'date'       => date('Y-m-d', strtotime($row['event_date'])),
        'title'      => $row['title'],
        'class_name' => $row['class_name'],
        'label'      => 'Quiz',
    ];
}
$stmt->close();

$stmt = $conn->prepare("
    SELECT ae.event_date, ae.title, ae.event_type, c.name AS class_name
    FROM academic_events ae
    JOIN classes c ON ae.class_id = c.id
    WHERE ae.created_by = ? AND ae.academic_year_id = ?
      AND ae.event_date BETWEEN ? AND ?
");
$stmt->bind_param("siss", $email, $current_year_id, $monday, $sunday);
$stmt->execute();
$res = $stmt->get_result();
while ($row = $res->fetch_assoc()) {
    $week_events[] = [
        'type'       => 'academic',
        'date'       => $row['event_date'],
        'title'      => $row['title'],
        'class_name' => $row['class_name'],
        'label'      => ucfirst($row['event_type']),
    ];
}
$stmt->close();

$stmt = $conn->prepare("
    SELECT event_date, title
    FROM teacher_reminders
    WHERE user_email = ?
      AND event_date BETWEEN ? AND ?
");
$stmt->bind_param("sss", $email, $monday, $sunday);
$stmt->execute();
$res = $stmt->get_result();
while ($row = $res->fetch_assoc()) {
    $week_events[] = [
        'type'       => 'reminder',
        'date'       => $row['event_date'],
        'title'      => $row['title'],
        'class_name' => null,
        'label'      => 'Reminder',
    ];
}
$stmt->close();

// Sort chronologically so the "row list under the strip" reads in date order.
usort($week_events, function ($a, $b) {
    return strtotime($a['date']) <=> strtotime($b['date']);
});

echo json_encode([
    // Existing desktop payload — unchanged shape, still consumed by
    // renderSnapshotPanel() on desktop.
    'quiz' => $quiz ? [
        'id'         => $quiz['id'],
        'title'      => $quiz['title'],
        'class_name' => $quiz['class_name'],
        'status'     => $quiz['status'],
        'start_time' => $quiz['start_time'] ? date('d M Y', strtotime($quiz['start_time'])) : 'Not set'
    ] : null,

    'assignment' => $assignment ? [
        'id'         => $assignment['id'],
        'title'      => $assignment['title'],
        'class_name' => $assignment['class_name'],
        'due_date'   => date('d M Y', strtotime($assignment['due_date'])),
        'days_left'  => (int)ceil((strtotime($assignment['due_date']) - time()) / 86400)
    ] : null,

    'announcement' => $announcement ? [
        'id'         => $announcement['id'],
        'title'      => $announcement['title'],
        'class_name' => $announcement['class_name'],
        'created_at' => date('d M Y', strtotime($announcement['created_at']))
    ] : null,

    // New mobile-home payload.
    'trail'       => $trail,
    'week_events' => $week_events,
    'week_start'  => $monday,
]);