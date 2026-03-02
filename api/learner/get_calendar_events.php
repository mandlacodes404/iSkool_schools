<?php
if (session_status() === PHP_SESSION_NONE) session_start();
header('Content-Type: application/json');
require_once dirname(__DIR__, 2) . '/config.php';

if (!isset($_SESSION['email']) || $_SESSION['role'] !== 'learner') {
    echo json_encode(['error' => 'Unauthorized']); exit();
}

$email = $_SESSION['email'];
$month = (int)($_GET['month'] ?? date('n'));
$year  = (int)($_GET['year']  ?? date('Y'));

// ── Academic Year ──
$yearRes = $conn->query("SELECT id FROM academic_years WHERE is_current = 1 LIMIT 1");
if ($yearRes->num_rows === 0) { echo json_encode(['error' => 'No active year']); exit(); }
$yearId = (int)$yearRes->fetch_assoc()['id'];

// ── Learner's Class ──
$classStmt = $conn->prepare("SELECT class_id FROM class_students WHERE student_email = ? AND academic_year_id = ? LIMIT 1");
$classStmt->bind_param("si", $email, $yearId);
$classStmt->execute();
$classRow = $classStmt->get_result()->fetch_assoc();
$classStmt->close();

if (!$classRow) {
    echo json_encode(['events' => [], 'month' => $month, 'year' => $year]); exit();
}
$classId = (int)$classRow['class_id'];

$monthStart = sprintf('%04d-%02d-01', $year, $month);
$monthEnd   = date('Y-m-t', strtotime($monthStart));

$events = [];

// ────────────────────────────────────────────
// 1. Assignment due dates
// ────────────────────────────────────────────
$stmt = $conn->prepare("
    SELECT a.id, a.title, a.due_date AS event_date,
           s.id AS submission_id
    FROM assignments a
    LEFT JOIN submissions s ON s.assignment_id = a.id AND s.student_email = ?
    WHERE a.class_id = ?
      AND a.academic_year_id = ?
      AND a.due_date BETWEEN ? AND ?
    ORDER BY a.due_date ASC
");
$stmt->bind_param("siiss", $email, $classId, $yearId, $monthStart, $monthEnd);
$stmt->execute();
$rows = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
$stmt->close();

foreach ($rows as $row) {
    $submitted = !empty($row['submission_id']);
    $events[] = [
        'date'      => $row['event_date'],
        'title'     => $row['title'],
        'type'      => 'assignment',
        'submitted' => $submitted,
        'tooltip'   => $row['title'] . ' — Due ' . date('d M', strtotime($row['event_date']))
                       . ($submitted ? ' ✓ Submitted' : ' · Pending')
    ];
}

// ────────────────────────────────────────────
// 2. Quizzes — completed (with %) + upcoming
// ────────────────────────────────────────────
$stmt = $conn->prepare("
    SELECT q.id, q.title, q.status,
           DATE(q.start_time) AS event_date,
           r.score, r.total,
           qa.status AS attempt_status
    FROM quizzes q
    LEFT JOIN quiz_results r   ON r.quiz_id = q.id AND r.user_email = ?
    LEFT JOIN quiz_attempts qa ON qa.quiz_id = q.id AND qa.user_email = ?
    WHERE q.class_id = ?
      AND q.academic_year_id = ?
      AND DATE(q.start_time) BETWEEN ? AND ?
      AND q.status IN ('Open', 'Scheduled', 'Closed')
    ORDER BY q.start_time ASC
");
$stmt->bind_param("ssiiss", $email, $email, $classId, $yearId, $monthStart, $monthEnd);
$stmt->execute();
$rows = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
$stmt->close();

foreach ($rows as $row) {
    $completed = ($row['attempt_status'] === 'submitted' && $row['total'] > 0);
    $pct       = $completed ? round(($row['score'] / $row['total']) * 100) : null;

    $events[] = [
        'date'    => $row['event_date'],
        'title'   => $row['title'],
        'type'    => 'quiz',
        'subtype' => $completed ? 'quiz_done' : 'quiz_upcoming',
        'pct'     => $pct,
        'status'  => $row['status'],
        'tooltip' => $completed
                     ? $row['title'] . ' — ' . $pct . '%'
                     : $row['title'] . ' — ' . ucfirst(strtolower($row['status']))
    ];
}

// ────────────────────────────────────────────
// 3. Academic events for this class
// ────────────────────────────────────────────
$stmt = $conn->prepare("
    SELECT ae.title, ae.event_date, ae.event_type,
           CONCAT(COALESCE(u.title,''), ' ', u.surname) AS teacher
    FROM academic_events ae
    LEFT JOIN users u ON ae.created_by = u.email
    WHERE ae.class_id = ?
      AND ae.academic_year_id = ?
      AND ae.event_date BETWEEN ? AND ?
    ORDER BY ae.event_date ASC
");
$stmt->bind_param("iiss", $classId, $yearId, $monthStart, $monthEnd);
$stmt->execute();
$rows = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
$stmt->close();

foreach ($rows as $row) {
    $events[] = [
        'date'       => $row['event_date'],
        'title'      => $row['title'],
        'type'       => 'academic',
        'event_type' => $row['event_type'],
        'tooltip'    => ucfirst($row['event_type']) . ': ' . $row['title']
                        . ' — ' . trim($row['teacher'])
    ];
}

echo json_encode(['events' => $events, 'month' => $month, 'year' => $year]);