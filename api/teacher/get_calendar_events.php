<?php
require_once __DIR__ . '/../../auth/session_guard.php';
header('Content-Type: application/json');
require_once dirname(__DIR__, 2) . '/config.php';

if (!isset($_SESSION['email']) || $_SESSION['role'] !== 'teacher') {
    echo json_encode(['error' => 'Unauthorized']); exit();
}

$email = $_SESSION['email'];
$month = (int)($_GET['month'] ?? date('n'));
$year  = (int)($_GET['year']  ?? date('Y'));

$yearResult      = $conn->query("SELECT id FROM academic_years WHERE is_current = 1 LIMIT 1");
$current_year_id = (int)$yearResult->fetch_assoc()['id'];

$monthStart = sprintf('%04d-%02d-01', $year, $month);
$monthEnd   = date('Y-m-t', strtotime($monthStart));

$events = [];

// ── Assignment due dates ──
$stmt = $conn->prepare("
    SELECT a.title, a.due_date AS event_date, c.name AS class_name
    FROM assignments a
    JOIN classes c ON a.class_id = c.id
    WHERE a.created_by = ?
      AND a.academic_year_id = ?
      AND a.due_date BETWEEN ? AND ?
");
$stmt->bind_param("siss", $email, $current_year_id, $monthStart, $monthEnd);
$stmt->execute();
$rows = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
$stmt->close();

foreach ($rows as $row) {
    $events[] = [
        'date'       => $row['event_date'],
        'title'      => $row['title'],
        'class_name' => $row['class_name'],
        'type'       => 'assignment'
    ];
}

// ── Quiz start dates ──
$stmt = $conn->prepare("
    SELECT q.title, DATE(q.start_time) AS event_date, c.name AS class_name
    FROM quizzes q
    JOIN classes c ON q.class_id = c.id
    WHERE q.created_by = ?
      AND q.academic_year_id = ?
      AND DATE(q.start_time) BETWEEN ? AND ?
");
$stmt->bind_param("siss", $email, $current_year_id, $monthStart, $monthEnd);
$stmt->execute();
$rows = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
$stmt->close();

foreach ($rows as $row) {
    $events[] = [
        'date'       => $row['event_date'],
        'title'      => $row['title'],
        'class_name' => $row['class_name'],
        'type'       => 'quiz'
    ];
}

// ── Personal reminders ──
$stmt = $conn->prepare("
    SELECT id, title, event_date
    FROM teacher_reminders
    WHERE user_email = ?
      AND event_date BETWEEN ? AND ?
");
$stmt->bind_param("sss", $email, $monthStart, $monthEnd);
$stmt->execute();
$rows = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
$stmt->close();

foreach ($rows as $row) {
    $events[] = [
        'id'         => $row['id'],
        'date'       => $row['event_date'],
        'title'      => $row['title'],
        'class_name' => null,
        'type'       => 'reminder'
    ];
}

// ── Academic events (class-specific, created by this teacher) ──
$stmt = $conn->prepare("
    SELECT ae.id, ae.title, ae.event_date, ae.event_type, c.name AS class_name
    FROM academic_events ae
    JOIN classes c ON ae.class_id = c.id
    WHERE ae.created_by = ?
      AND ae.academic_year_id = ?
      AND ae.event_date BETWEEN ? AND ?
    ORDER BY ae.event_date ASC
");
$stmt->bind_param("siss", $email, $current_year_id, $monthStart, $monthEnd);
$stmt->execute();
$rows = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
$stmt->close();

foreach ($rows as $row) {
    $events[] = [
        'id'         => $row['id'],
        'date'       => $row['event_date'],
        'title'      => $row['title'],
        'class_name' => $row['class_name'],
        'event_type' => $row['event_type'],
        'type'       => 'academic'
    ];
}

echo json_encode(['events' => $events, 'month' => $month, 'year' => $year]);