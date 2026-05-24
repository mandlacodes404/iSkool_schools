<?php
require_once __DIR__ . '/../../auth/session_guard.php';
header('Content-Type: application/json');
require_once dirname(__DIR__, 2) . '/config.php';
require_once dirname(__DIR__, 2) . '/push_functions.php';

if (!isset($_SESSION['email']) || $_SESSION['role'] !== 'teacher') {
    echo json_encode(['error' => 'Unauthorized']); exit();
}

$teacherEmail = $_SESSION['email'];
$input        = json_decode(file_get_contents('php://input'), true);

$class_id    = (int)($input['class_id']  ?? 0);
$term        = (int)($input['term']      ?? 0);
$subject     = trim($input['subject']    ?? '');
$topics      = $input['topics']          ?? [];
$assessments = $input['assessments']     ?? [];
$notes       = trim($input['notes']      ?? '');

// ── Validation ──
if ($class_id <= 0)         { echo json_encode(['error' => 'Please select a class.']);               exit(); }
if ($term < 1 || $term > 4) { echo json_encode(['error' => 'Please select a valid term.']);          exit(); }
if (empty($subject))        { echo json_encode(['error' => 'Please enter a subject name.']);         exit(); }
if (empty($topics))         { echo json_encode(['error' => 'Please add at least one topic.']);       exit(); }
if (empty($assessments))    { echo json_encode(['error' => 'Please add at least one assessment.']);  exit(); }

// ── Weights must total 100 ──
$totalWeight = array_sum(array_column($assessments, 'weight'));
if ($totalWeight !== 100) {
    echo json_encode(['error' => "Weights must total 100%. Currently: {$totalWeight}%."]); exit();
}

// ── Sanitise ──
$topics = array_values(array_filter(array_map('trim', $topics)));
if (empty($topics)) { echo json_encode(['error' => 'Please add at least one topic.']); exit(); }

$cleanAssessments = [];
foreach ($assessments as $a) {
    $type   = trim($a['type']    ?? '');
    $weight = (int)($a['weight'] ?? 0);
    if ($type && $weight > 0) $cleanAssessments[] = ['type' => $type, 'weight' => $weight];
}
if (empty($cleanAssessments)) { echo json_encode(['error' => 'Please add at least one valid assessment.']); exit(); }

// ── Verify class exists ──
$classCheck = $conn->prepare("SELECT id, name FROM classes WHERE id = ? LIMIT 1");
$classCheck->bind_param("i", $class_id);
$classCheck->execute();
$classRow = $classCheck->get_result()->fetch_assoc();
$classCheck->close();
if (!$classRow) { echo json_encode(['error' => 'Invalid class selected.']); exit(); }
$className = $classRow['name'];

// ── Academic year ──
$yearRes = $conn->query("SELECT id FROM academic_years WHERE is_current = 1 LIMIT 1");
if ($yearRes->num_rows === 0) { echo json_encode(['error' => 'No active academic year.']); exit(); }
$yearId = (int)$yearRes->fetch_assoc()['id'];

// ── Insert or update ──
$topicsJson      = json_encode($topics);
$assessmentsJson = json_encode($cleanAssessments);

$stmt = $conn->prepare("
    INSERT INTO subject_briefs
        (class_id, academic_year_id, term_number, subject_name, created_by, topics, assessments, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
        subject_name = VALUES(subject_name),
        topics       = VALUES(topics),
        assessments  = VALUES(assessments),
        notes        = VALUES(notes),
        updated_at   = CURRENT_TIMESTAMP
");
$stmt->bind_param("iiisssss",
    $class_id, $yearId, $term, $subject,
    $teacherEmail, $topicsJson, $assessmentsJson, $notes
);
if (!$stmt->execute()) { $stmt->close(); echo json_encode(['error' => 'Failed to save SBO.']); exit(); }
$stmt->close();

// ── Teacher name ──
$nameStmt = $conn->prepare("SELECT CONCAT(COALESCE(title,''), ' ', surname) AS dn FROM users WHERE email = ?");
$nameStmt->bind_param("s", $teacherEmail);
$nameStmt->execute();
$teacherName = trim($nameStmt->get_result()->fetch_assoc()['dn'] ?? 'Your teacher');
$nameStmt->close();

// ── Push notify all learners ──
$learnersStmt = $conn->prepare("
    SELECT cs.student_email FROM class_students cs
    WHERE cs.class_id = ? AND cs.academic_year_id = ?
");
$learnersStmt->bind_param("ii", $class_id, $yearId);
$learnersStmt->execute();
$learners = $learnersStmt->get_result()->fetch_all(MYSQLI_ASSOC);
$learnersStmt->close();

// ── School name ──
$schoolNameResult = $conn->query("SELECT setting_value FROM school_name WHERE setting_key = 'school_name' LIMIT 1");
$schoolName = ($schoolNameResult && $snRow = $schoolNameResult->fetch_assoc())
    ? $snRow['setting_value']
    : 'iSkool';

$cleanBaseUrl = rtrim(BASE_URL, '/');

foreach ($learners as $learner) {
    sendPushToUser(
        $conn,
        $learner['student_email'],
        "📚 Term {$term} Syllabus — {$className}",
        "Term {$term} syllabus has been posted for {$subject} by {$teacherName}",
        $cleanBaseUrl . '/learner_dashboard.php?page=syllabus',
        $schoolName
    );
}

echo json_encode(['success' => true, 'notified' => count($learners)]);