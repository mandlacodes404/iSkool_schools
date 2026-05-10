<?php
session_start();
require_once dirname(__DIR__, 2) . '/config.php';

header('Content-Type: application/json');

if (!isset($_SESSION['email']) || $_SESSION['role'] !== 'learner') {
    echo json_encode(['error' => 'Unauthorized']); exit;
}

$email        = $_SESSION['email'];
$now          = date('Y-m-d H:i:s');
$sevenDaysAgo = date('Y-m-d H:i:s', strtotime('-7 days'));

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
    echo json_encode(['todo' => [], 'recent' => [], 'events' => []]);
    exit;
}

$todo   = [];
$recent = [];

// ────────────────────────────────────────────
// TO-DO 1: Quizzes not yet attempted
// FIX: include both 'Open' and 'Scheduled' statuses
// ────────────────────────────────────────────
$stmt = $conn->prepare("
    SELECT q.id, q.title, q.start_time
    FROM quizzes q
    LEFT JOIN quiz_attempts qa ON qa.quiz_id = q.id AND qa.user_email = ?
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
        'meta'  => 'Started ' . date('M j', strtotime($row['start_time']))
    ];
}
$stmt->close();

// ────────────────────────────────────────────
// TO-DO 2: Assignments not yet submitted & not past due
// ────────────────────────────────────────────
$stmt = $conn->prepare("
    SELECT a.id, a.title, a.due_date
    FROM assignments a
    LEFT JOIN submissions s ON s.assignment_id = a.id AND s.student_email = ?
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
        'meta'  => 'Due ' . date('M j', strtotime($row['due_date']))
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
    SELECT a.title, a.created_at,
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
    SELECT r.title, r.uploaded_at,
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
    SELECT a.title, a.created_at,
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
    SELECT q.title, q.start_time AS created_at,
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

echo json_encode(['todo' => $todo, 'recent' => $recent, 'events' => $events]);