<?php
require_once __DIR__ . '/../../auth/session_guard.php';
header('Content-Type: application/json');
require_once dirname(__DIR__, 2) . '/config.php';
require_once dirname(__DIR__, 2) . '/push_functions.php';

if (!isset($_SESSION['email']) || $_SESSION['role'] !== 'teacher') {
    echo json_encode(['error' => 'Unauthorized']); exit();
}

$teacherEmail = $_SESSION['email'];

$input = json_decode(file_get_contents('php://input'), true);

$title       = trim($input['title']       ?? '');
$event_date  = trim($input['event_date']  ?? '');
$event_type  = trim($input['event_type']  ?? '');
$class_id    = (int)($input['class_id']   ?? 0);

// ── Validation ──
if (empty($title)) {
    echo json_encode(['error' => 'Title is required.']); exit();
}
if (empty($event_date) || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $event_date)) {
    echo json_encode(['error' => 'A valid date is required.']); exit();
}
$allowedTypes = ['test', 'exam', 'holiday', 'event', 'other'];
if (!in_array($event_type, $allowedTypes)) {
    echo json_encode(['error' => 'Invalid event type.']); exit();
}
if ($class_id <= 0) {
    echo json_encode(['error' => 'Please select a class.']); exit();
}

// TO: (just verify the class exists in this school's database)
$classCheck = $conn->prepare("
    SELECT id, name FROM classes WHERE id = ? LIMIT 1
");
$classCheck->bind_param("i", $class_id);
$classCheck->execute();
$classRow = $classCheck->get_result()->fetch_assoc();
$classCheck->close();

if (!$classRow) {
    echo json_encode(['error' => 'Invalid class selected.']); exit();
}

$className = $classRow['name'];

// ── Get current academic year ──
$yearRes = $conn->query("SELECT id FROM academic_years WHERE is_current = 1 LIMIT 1");
if ($yearRes->num_rows === 0) {
    echo json_encode(['error' => 'No active academic year.']); exit();
}
$academicYearId = (int)$yearRes->fetch_assoc()['id'];

// ── Insert event ──
$stmt = $conn->prepare("
    INSERT INTO academic_events 
        (title, event_date, event_type, class_id, academic_year_id, created_by)
    VALUES (?, ?, ?, ?, ?, ?)
");
$stmt->bind_param("ssssis", $title, $event_date, $event_type, $class_id, $academicYearId, $teacherEmail);
$stmt->execute();

if ($stmt->affected_rows <= 0) {
    $stmt->close();
    echo json_encode(['error' => 'Failed to save event.']); exit();
}
$stmt->close();

// ── Get teacher display name ──
$nameStmt = $conn->prepare("SELECT CONCAT(COALESCE(title,''), ' ', surname) AS display_name FROM users WHERE email = ?");
$nameStmt->bind_param("s", $teacherEmail);
$nameStmt->execute();
$teacherName = trim($nameStmt->get_result()->fetch_assoc()['display_name'] ?? 'Your teacher');
$nameStmt->close();

// ── Format date for notification ──
$formattedDate = date('D, d M', strtotime($event_date)); // e.g. Mon, 14 Jul

// ── Send push to all learners in this class ──
$learnersStmt = $conn->prepare("
    SELECT cs.student_email
    FROM class_students cs
    WHERE cs.class_id = ?
      AND cs.academic_year_id = ?
");
$learnersStmt->bind_param("ii", $class_id, $academicYearId);
$learnersStmt->execute();
$learners = $learnersStmt->get_result()->fetch_all(MYSQLI_ASSOC);
$learnersStmt->close();

// ── School name ──
$schoolNameResult = $conn->query("SELECT setting_value FROM school_name WHERE setting_key = 'school_name' LIMIT 1");
$schoolName = ($schoolNameResult && $snRow = $schoolNameResult->fetch_assoc())
    ? $snRow['setting_value']
    : 'iSkool';

$notifTitle   = "📅 Academic Calendar — {$className}";
$notifMessage = "{$title} on {$formattedDate}";

foreach ($learners as $learner) {
    sendPushToUser(
        $conn,
        $learner['student_email'],
        $notifTitle,
        $notifMessage,
        'learner_dashboard.php',
        $schoolName,
        'https://iskool.online/assets/icons/calendar.png'
    );
}

echo json_encode(['success' => true, 'notified' => count($learners)]);