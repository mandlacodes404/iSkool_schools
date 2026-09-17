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

// "Your classes" = union of two sets, this academic year only:
//   1. Classes the teacher has manually linked themselves to
//      (a row in teacher_subjects — this is also where subject_name
//      comes from, added via the "+ Add subject" flow).
//   2. Classes the teacher has posted content to (quiz, assignment,
//      announcement, or resource created this year), even if they
//      never explicitly added themselves via teacher_subjects.
//
// teacher_subjects has no academic_year_id column, so a manually-added
// link doesn't expire year to year on its own — that's a product
// decision (does "add class" carry over each year, or should teachers
// re-add each year?) that isn't resolved yet. For now, manually-added
// classes always show; only the content-detection half is year-scoped.
//
// subject_name resolution mirrors the learner-side fallback used in
// get_grades.php (COALESCE ts.subject_name -> teacher's own name),
// except here, with no subject set, we show an actionable prompt
// instead of echoing the teacher's own name back at them.
$stmt = $conn->prepare("
    SELECT
        c.id,
        c.name,
        ts.subject_name,
        (SELECT COUNT(*) FROM class_students cs
         WHERE cs.class_id = c.id AND cs.academic_year_id = ?) AS learner_count
    FROM classes c
    LEFT JOIN teacher_subjects ts
        ON ts.class_id = c.id AND ts.teacher_email = ?
    WHERE
        -- manually added
        EXISTS (
            SELECT 1 FROM teacher_subjects ts2
            WHERE ts2.class_id = c.id AND ts2.teacher_email = ?
        )
        -- or has posted content this year
        OR EXISTS (
            SELECT 1 FROM quizzes q
            WHERE q.class_id = c.id AND q.created_by = ? AND q.academic_year_id = ?
        )
        OR EXISTS (
            SELECT 1 FROM assignments a
            WHERE a.class_id = c.id AND a.created_by = ? AND a.academic_year_id = ?
        )
        OR EXISTS (
            SELECT 1 FROM announcements an
            WHERE an.class_id = c.id AND an.created_by = ? AND an.academic_year_id = ?
        )
        OR EXISTS (
            SELECT 1 FROM resources r
            WHERE r.class_id = c.id AND r.uploaded_by = ? AND r.academic_year_id = ?
        )
    ORDER BY c.name ASC
");
// Order must match the ? placeholders exactly as they appear in the
// SQL above: learner_count subquery, LEFT JOIN, then each EXISTS
// clause in sequence (email, year) pairs for quizzes/assignments/
// announcements/resources, with the manually-added EXISTS (email
// only, no year) sitting between the LEFT JOIN and the quizzes check.
$stmt->bind_param(
    "isssisisisi",
    $current_year_id,          // learner_count subquery
    $email,                    // LEFT JOIN ts.teacher_email
    $email,                    // manually-added EXISTS (ts2, no year)
    $email, $current_year_id,  // quizzes: created_by, academic_year_id
    $email, $current_year_id,  // assignments: created_by, academic_year_id
    $email, $current_year_id,  // announcements: created_by, academic_year_id
    $email, $current_year_id   // resources: uploaded_by, academic_year_id
);
$stmt->execute();
$res = $stmt->get_result();

$classes = [];
while ($row = $res->fetch_assoc()) {
    $hasSubject = $row['subject_name'] !== null && trim($row['subject_name']) !== '';
    $classes[] = [
        'id'                 => (int)$row['id'],
        'name'               => $row['name'],
        'subject_name'       => $hasSubject ? $row['subject_name'] : null,
        'needs_subject'      => !$hasSubject,
        'learner_count'      => (int)$row['learner_count'],
    ];
}
$stmt->close();

echo json_encode(['classes' => $classes]);
