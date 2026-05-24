<?php
/**
 * iSkool School Dashboard — Teacher Profile API
 * Updated: added phone, subject_specialization, employment_type
 */
ob_start();
error_reporting(E_ALL);
ini_set('display_errors', 0);
require_once __DIR__ . '/../../auth/session_guard.php';
require_once '../../config.php';

if (!isset($_SESSION['email']) || !in_array($_SESSION['role'], ['school_admin', 'admin'])) {
    http_response_code(403);
    echo json_encode(['error' => 'Unauthorized']);
    exit();
}

header('Content-Type: application/json');

$teacherEmail = trim($_POST['email'] ?? '');
if (!$teacherEmail) { echo json_encode(['error' => 'Missing email']); exit(); }
$safe = $conn->real_escape_string($teacherEmail);

$yearId = 0;
$res = $conn->query("SELECT id FROM academic_years WHERE is_current = 1 LIMIT 1");
if ($row = $res->fetch_assoc()) $yearId = $row['id'];

// ── Teacher personal details — including new fields ──
$uRes = $conn->query("
    SELECT id, name, surname, email, gender, age, profile_pic, created_at,
           phone, subject_specialization, employment_type
    FROM users WHERE email = '$safe' AND role = 'teacher' LIMIT 1
");
$u = $uRes->fetch_assoc();
if (!$u) { echo json_encode(['error' => 'Teacher not found']); exit(); }

// Content counts
$quizzes       = (int)$conn->query("SELECT COUNT(*) c FROM quizzes WHERE created_by = '$safe'")->fetch_assoc()['c'];
$assignments   = (int)$conn->query("SELECT COUNT(*) c FROM assignments WHERE created_by = '$safe'")->fetch_assoc()['c'];
$resources     = (int)$conn->query("SELECT COUNT(*) c FROM resources WHERE uploaded_by = '$safe'")->fetch_assoc()['c'];
$announcements = (int)$conn->query("SELECT COUNT(*) c FROM announcements WHERE created_by = '$safe'")->fetch_assoc()['c'];

// Last active
$lastRes = $conn->query("
    SELECT MAX(ts) last_active FROM (
        SELECT MAX(created_at) ts FROM quizzes WHERE created_by = '$safe'
        UNION ALL
        SELECT MAX(created_at) ts FROM assignments WHERE created_by = '$safe'
        UNION ALL
        SELECT MAX(uploaded_at) ts FROM resources WHERE uploaded_by = '$safe'
        UNION ALL
        SELECT MAX(created_at) ts FROM announcements WHERE created_by = '$safe'
    ) t
");
$lastActive = $lastRes->fetch_assoc()['last_active'];

// ── Per-class subject performance ──
$classRes = $conn->query("
    SELECT DISTINCT q.class_id, c.name class_name
    FROM quizzes q
    JOIN classes c ON c.id = q.class_id
    WHERE q.created_by = '$safe' AND q.is_summative = 1
    ORDER BY c.name ASC
");

$classSubjects = [];

while ($cr = $classRes->fetch_assoc()) {
    $classId   = (int)$cr['class_id'];
    $className = $cr['class_name'];

    $subjectName = null;
    $tsRes = $conn->query("SELECT subject_name FROM teacher_subjects WHERE teacher_email = '$safe' AND class_id = $classId LIMIT 1");
    if ($tsRow = $tsRes->fetch_assoc()) $subjectName = $tsRow['subject_name'];
    if (!$subjectName) $subjectName = trim($u['name'] . ' ' . $u['surname']);

    $learnerCount = (int)$conn->query("
        SELECT COUNT(DISTINCT student_email) c FROM class_students
        WHERE class_id = $classId
        " . ($yearId ? "AND academic_year_id = $yearId" : "") . "
    ")->fetch_assoc()['c'];

    $quizCount = (int)$conn->query("
        SELECT COUNT(*) c FROM quizzes
        WHERE created_by = '$safe' AND class_id = $classId AND is_summative = 1
    ")->fetch_assoc()['c'];

    $avgRes = $conn->query("
        SELECT ROUND(AVG(qr.score / qr.total * 100), 1) avg
        FROM quiz_results qr
        JOIN quizzes q ON qr.quiz_id = q.id
        WHERE q.created_by = '$safe' AND q.class_id = $classId AND q.is_summative = 1
        " . ($yearId ? "AND qr.academic_year_id = $yearId" : "") . "
    ");
    $avg = $avgRes->fetch_assoc()['avg'];

    $submittedCount = (int)$conn->query("
        SELECT COUNT(DISTINCT qr.user_email) c
        FROM quiz_results qr
        JOIN quizzes q ON qr.quiz_id = q.id
        WHERE q.created_by = '$safe' AND q.class_id = $classId AND q.is_summative = 1
        " . ($yearId ? "AND qr.academic_year_id = $yearId" : "") . "
    ")->fetch_assoc()['c'];

    $perfRes = $conn->query("
        SELECT qr.user_email,
               u.name, u.surname,
               ROUND(AVG(qr.score / qr.total * 100), 1) avg_pct
        FROM quiz_results qr
        JOIN quizzes q ON qr.quiz_id = q.id
        JOIN users u ON u.email = qr.user_email
        WHERE q.created_by = '$safe' AND q.class_id = $classId AND q.is_summative = 1
        " . ($yearId ? "AND qr.academic_year_id = $yearId" : "") . "
        GROUP BY qr.user_email
        ORDER BY avg_pct DESC
    ");
    $perf = [];
    while ($p = $perfRes->fetch_assoc()) {
        $perf[] = ['name' => trim($p['name'] . ' ' . $p['surname']), 'avg' => $p['avg_pct']];
    }

    $classSubjects[] = [
        'class_id'        => $classId,
        'class_name'      => $className,
        'subject_name'    => $subjectName,
        'learner_count'   => $learnerCount,
        'submitted_count' => $submittedCount,
        'quiz_count'      => $quizCount,
        'avg_pct'         => $avg,
        'top_learners'    => array_slice($perf, 0, 3),
        'bottom_learners' => array_slice(array_reverse($perf), 0, 3),
    ];
}

// Overall avg
$overallAvg = $conn->query("
    SELECT ROUND(AVG(qr.score / qr.total * 100), 1) avg
    FROM quiz_results qr
    JOIN quizzes q ON qr.quiz_id = q.id
    WHERE q.created_by = '$safe' AND q.is_summative = 1
    " . ($yearId ? "AND qr.academic_year_id = $yearId" : "") . "
")->fetch_assoc()['avg'];

// School average
$schoolAvg = $conn->query("
    SELECT ROUND(AVG(qr.score / qr.total * 100), 1) avg
    FROM quiz_results qr
    JOIN quizzes q ON qr.quiz_id = q.id
    WHERE q.is_summative = 1
    " . ($yearId ? "AND qr.academic_year_id = $yearId" : "") . "
")->fetch_assoc()['avg'];

echo json_encode([
    'id'                     => $u['id'],
    'name'                   => trim($u['name'] . ' ' . $u['surname']),
    'first_name'             => $u['name'],
    'surname'                => $u['surname'],
    'email'                  => $u['email'],
    'gender'                 => $u['gender'],
    'age'                    => $u['age'],
    'profile_pic'            => $u['profile_pic'],
    'joined'                 => $u['created_at'],
    'last_active'            => $lastActive,
    // New fields
    'phone'                  => $u['phone'],
    'subject_specialization' => $u['subject_specialization'],
    'employment_type'        => $u['employment_type'],
    // Content
    'quizzes'                => $quizzes,
    'assignments'            => $assignments,
    'resources'              => $resources,
    'announcements'          => $announcements,
    'total'                  => $quizzes + $assignments + $resources + $announcements,
    'overall_avg'            => $overallAvg,
    'school_avg'             => $schoolAvg,
    'class_subjects'         => $classSubjects,
]);