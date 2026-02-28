<?php
/**
 * api/learner/get_grades.php
 * Returns all quiz results for the logged-in learner (or parent's linked learner),
 * grouped by subject/teacher — identical logic to the old quiz_history.php
 */

session_start();
require_once dirname(__DIR__, 2) . '/config.php';

header('Content-Type: application/json');

// ── SECURITY ────────────────────────────────────────────────────────────────
if (!isset($_SESSION['email'])) {
    echo json_encode(['error' => 'Unauthorized']); exit();
}

$viewerEmail = $_SESSION['email'];
$viewerRole  = $_SESSION['role'] ?? '';
$targetEmail = $viewerEmail;

// Parent viewing their linked learner
if ($viewerRole === 'parent' && isset($_GET['learner'])) {
    $requestedEmail = filter_var($_GET['learner'], FILTER_VALIDATE_EMAIL);
    if ($requestedEmail) {
        $stmtCheck = $conn->prepare("SELECT 1 FROM parent_links WHERE parent_email = ? AND learner_email = ?");
        $stmtCheck->bind_param("ss", $viewerEmail, $requestedEmail);
        $stmtCheck->execute();
        if ($stmtCheck->get_result()->num_rows === 1) {
            $targetEmail = $requestedEmail;
        }
        $stmtCheck->close();
    }
}

// Block invalid access
if ($viewerRole === 'learner' && $targetEmail !== $viewerEmail) {
    echo json_encode(['error' => 'Forbidden']); exit();
}
if (!in_array($viewerRole, ['learner', 'parent'])) {
    echo json_encode(['error' => 'Forbidden']); exit();
}

// ── ACADEMIC YEAR ────────────────────────────────────────────────────────────
$currentYearResult = $conn->query("SELECT id FROM academic_years WHERE is_current = 1 LIMIT 1");
if ($currentYearResult->num_rows === 0) {
    echo json_encode(['error' => 'No active academic year']); exit();
}
$current_academic_year_id = (int)$currentYearResult->fetch_assoc()['id'];

// ── CURRENT TERM ─────────────────────────────────────────────────────────────
$current_global_term = 1;
$termStmt = $conn->query("SELECT current_global_term FROM platform_settings LIMIT 1");
if ($termRow = $termStmt->fetch_assoc()) {
    $current_global_term = (int)$termRow['current_global_term'];
}

// ── FETCH QUIZ RESULTS ───────────────────────────────────────────────────────
$sql = "
    SELECT DISTINCT
        r.id          AS result_id,
        r.score,
        r.total,
        r.submitted_at,
        r.time_taken,
        q.id          AS quiz_id,
        q.title       AS quiz_title,
        q.duration,
        q.publish_marks,
        q.is_summative,
        q.weight_percent,
        q.term_number,
        q.class_id,
        q.created_by,
        COALESCE(ts.subject_name,
            CONCAT(COALESCE(u.title,''), ' ', COALESCE(u.surname,'Unknown'))
        ) AS display_group
    FROM quiz_results r
    JOIN quizzes q ON r.quiz_id = q.id
    JOIN class_students cs
        ON q.class_id       = cs.class_id
        AND cs.student_email = ?
        AND cs.academic_year_id = ?
    LEFT JOIN teacher_subjects ts
        ON ts.teacher_email = q.created_by
        AND ts.class_id     = q.class_id
    LEFT JOIN users u
        ON q.created_by = u.email
        AND u.role = 'teacher'
    WHERE r.user_email   = ?
      AND q.academic_year_id = ?
      AND r.user_email   = cs.student_email
    ORDER BY display_group ASC, r.submitted_at DESC
";

$stmt = $conn->prepare($sql);
$stmt->bind_param("sisi",
    $targetEmail, $current_academic_year_id,
    $targetEmail, $current_academic_year_id
);
$stmt->execute();
$rows = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
$stmt->close();

// ── GROUP BY SUBJECT ─────────────────────────────────────────────────────────
$grouped = [];
foreach ($rows as $row) {
    $group = trim($row['display_group'] ?? 'Unknown Subject');
    if ($group === '') $group = 'Unknown Subject';

    $grouped[$group][] = [
        'result_id'      => (int)$row['result_id'],
        'quiz_id'        => (int)$row['quiz_id'],
        'quiz_title'     => $row['quiz_title'],
        'score'          => (int)$row['score'],
        'total'          => (int)$row['total'],
        'duration'       => (int)$row['duration'],
        'time_taken'     => (int)$row['time_taken'],
        'publish_marks'  => (int)$row['publish_marks'],
        'is_summative'   => (int)$row['is_summative'],
        'weight_percent' => (float)$row['weight_percent'],
        'term_number'    => (int)$row['term_number'],
        'submitted_at'   => $row['submitted_at'],
    ];
}

// Convert to indexed array for JSON
$output = [];
foreach ($grouped as $groupName => $quizzes) {
    $output[] = [
        'group'   => $groupName,
        'quizzes' => $quizzes,
    ];
}

echo json_encode([
    'groups'              => $output,
    'current_term'        => $current_global_term,
    'target_email'        => $targetEmail,
    'viewer_role'         => $viewerRole,
]);