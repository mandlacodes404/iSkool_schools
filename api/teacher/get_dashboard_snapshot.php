<?php
require_once __DIR__ . '/../../auth/session_guard.php';
header('Content-Type: application/json');
require_once dirname(__DIR__, 2) . '/config.php';

if (!isset($_SESSION['email']) || $_SESSION['role'] !== 'teacher') {
    echo json_encode(['error' => 'Unauthorized']); exit();
}

$email = $_SESSION['email'];

// Current academic year
$yearResult = $conn->query("SELECT id FROM academic_years WHERE is_current = 1 LIMIT 1");
$current_year_id = (int)$yearResult->fetch_assoc()['id'];

if (!$current_year_id) {
    echo json_encode(['error' => 'No active academic year']); exit();
}

// ── Latest Quiz ──
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

// ── Closest Due Assignment ──
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

// ── Latest Announcement ──
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

// ── Latest Discussion ──
$stmt = $conn->prepare("
    SELECT d.id, d.title, d.created_at, c.name AS class_name,
           COUNT(r.id) AS reply_count
    FROM class_discussions d
    JOIN discussion_teachers dt ON d.id = dt.discussion_id
    JOIN classes c ON d.class_id = c.id
    LEFT JOIN discussion_replies r ON d.id = r.discussion_id
    WHERE dt.teacher_email = ? AND d.academic_year_id = ?
    GROUP BY d.id
    ORDER BY d.created_at DESC LIMIT 1
");
$stmt->bind_param("si", $email, $current_year_id);
$stmt->execute();
$discussion = $stmt->get_result()->fetch_assoc();
$stmt->close();

// ── Format & Return ──
echo json_encode([
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

    'discussion' => $discussion ? [
        'id'          => $discussion['id'],
        'title'       => $discussion['title'],
        'class_name'  => $discussion['class_name'],
        'reply_count' => (int)$discussion['reply_count'],
        'created_at'  => date('d M Y', strtotime($discussion['created_at']))
    ] : null
]);
?>