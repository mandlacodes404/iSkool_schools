<?php
/**
 * iSkool School Dashboard — Teacher Profile API
 * Updated: added phone, subject_specialization, employment_type
 */
ob_start();
error_reporting(E_ALL);
ini_set('display_errors', 0);
require_once __DIR__ . '/../../auth/session_guard.php';
require_once __DIR__ . '/../../auth/csrf_helper.php';
require_once '../../config.php';

if (!isset($_SESSION['email']) || !in_array($_SESSION['role'], ['school_admin', 'admin'])) {
    http_response_code(403);
    echo json_encode(['error' => 'Unauthorized']);
    exit();
}

verify_csrf_token();

header('Content-Type: application/json');

$teacherEmail = trim($_POST['email'] ?? '');
if (!$teacherEmail) { echo json_encode(['error' => 'Missing email']); exit(); }

$yearId = 0;
$res = $conn->query("SELECT id FROM academic_years WHERE is_current = 1 LIMIT 1");
if ($row = $res->fetch_assoc()) $yearId = $row['id'];

// ── Teacher personal details — including new fields ──
$uStmt = $conn->prepare("
    SELECT id, name, surname, email, gender, age, profile_pic, created_at,
           phone, subject_specialization, employment_type
    FROM users WHERE email = ? AND role = 'teacher' LIMIT 1
");
$uStmt->bind_param("s", $teacherEmail);
$uStmt->execute();
$uRes = $uStmt->get_result();
$u = $uRes->fetch_assoc();
$uStmt->close();
if (!$u) { echo json_encode(['error' => 'Teacher not found']); exit(); }

// Content counts
$quizCountStmt = $conn->prepare("SELECT COUNT(*) c FROM quizzes WHERE created_by = ?");
$quizCountStmt->bind_param("s", $teacherEmail);
$quizCountStmt->execute();
$quizzes = (int)$quizCountStmt->get_result()->fetch_assoc()['c'];
$quizCountStmt->close();
$assignmentCountStmt = $conn->prepare("SELECT COUNT(*) c FROM assignments WHERE created_by = ?");
$assignmentCountStmt->bind_param("s", $teacherEmail);
$assignmentCountStmt->execute();
$assignments = (int)$assignmentCountStmt->get_result()->fetch_assoc()['c'];
$assignmentCountStmt->close();
$resourceCountStmt = $conn->prepare("SELECT COUNT(*) c FROM resources WHERE uploaded_by = ?");
$resourceCountStmt->bind_param("s", $teacherEmail);
$resourceCountStmt->execute();
$resources = (int)$resourceCountStmt->get_result()->fetch_assoc()['c'];
$resourceCountStmt->close();
$announcementCountStmt = $conn->prepare("SELECT COUNT(*) c FROM announcements WHERE created_by = ?");
$announcementCountStmt->bind_param("s", $teacherEmail);
$announcementCountStmt->execute();
$announcements = (int)$announcementCountStmt->get_result()->fetch_assoc()['c'];
$announcementCountStmt->close();

// Last active
$lastStmt = $conn->prepare("
    SELECT MAX(ts) last_active FROM (
        SELECT MAX(created_at) ts FROM quizzes WHERE created_by = ?
        UNION ALL
        SELECT MAX(created_at) ts FROM assignments WHERE created_by = ?
        UNION ALL
        SELECT MAX(uploaded_at) ts FROM resources WHERE uploaded_by = ?
        UNION ALL
        SELECT MAX(created_at) ts FROM announcements WHERE created_by = ?
    ) t
");
$lastStmt->bind_param("ssss", $teacherEmail, $teacherEmail, $teacherEmail, $teacherEmail);
$lastStmt->execute();
$lastRes = $lastStmt->get_result();
$lastActive = $lastRes->fetch_assoc()['last_active'];
$lastStmt->close();

// ── Per-class subject performance ──
$classStmt = $conn->prepare("
    SELECT DISTINCT q.class_id, c.name class_name
    FROM quizzes q
    JOIN classes c ON c.id = q.class_id
    WHERE q.created_by = ? AND q.is_summative = 1
    ORDER BY c.name ASC
");
$classStmt->bind_param("s", $teacherEmail);
$classStmt->execute();
$classRes = $classStmt->get_result();

$classSubjects = [];

while ($cr = $classRes->fetch_assoc()) {
    $classId   = (int)$cr['class_id'];
    $className = $cr['class_name'];

    $subjectName = null;
    $tsStmt = $conn->prepare("SELECT subject_name FROM teacher_subjects WHERE teacher_email = ? AND class_id = ? LIMIT 1");
    $tsStmt->bind_param("si", $teacherEmail, $classId);
    $tsStmt->execute();
    $tsRes = $tsStmt->get_result();
    if ($tsRow = $tsRes->fetch_assoc()) $subjectName = $tsRow['subject_name'];
    $tsStmt->close();
    if (!$subjectName) $subjectName = trim($u['name'] . ' ' . $u['surname']);

    $learnerCountSql = "
        SELECT COUNT(DISTINCT student_email) c FROM class_students
        WHERE class_id = ?
        " . ($yearId ? "AND academic_year_id = ?" : "") . "
    ";
    $learnerCountStmt = $conn->prepare($learnerCountSql);
    if ($yearId) {
        $learnerCountStmt->bind_param("ii", $classId, $yearId);
    } else {
        $learnerCountStmt->bind_param("i", $classId);
    }
    $learnerCountStmt->execute();
    $learnerCount = (int)$learnerCountStmt->get_result()->fetch_assoc()['c'];
    $learnerCountStmt->close();

    $quizClassStmt = $conn->prepare("
        SELECT COUNT(*) c FROM quizzes
        WHERE created_by = ? AND class_id = ? AND is_summative = 1
    ");
    $quizClassStmt->bind_param("si", $teacherEmail, $classId);
    $quizClassStmt->execute();
    $quizCount = (int)$quizClassStmt->get_result()->fetch_assoc()['c'];
    $quizClassStmt->close();

    $avgSql = "
        SELECT ROUND(AVG(qr.score / qr.total * 100), 1) avg
        FROM quiz_results qr
        JOIN quizzes q ON qr.quiz_id = q.id
        WHERE q.created_by = ? AND q.class_id = ? AND q.is_summative = 1
        " . ($yearId ? "AND qr.academic_year_id = ?" : "") . "
    ";
    $avgStmt = $conn->prepare($avgSql);
    if ($yearId) {
        $avgStmt->bind_param("sii", $teacherEmail, $classId, $yearId);
    } else {
        $avgStmt->bind_param("si", $teacherEmail, $classId);
    }
    $avgStmt->execute();
    $avgRes = $avgStmt->get_result();
    $avg = $avgRes->fetch_assoc()['avg'];
    $avgStmt->close();

    $submittedSql = "
        SELECT COUNT(DISTINCT qr.user_email) c
        FROM quiz_results qr
        JOIN quizzes q ON qr.quiz_id = q.id
        WHERE q.created_by = ? AND q.class_id = ? AND q.is_summative = 1
        " . ($yearId ? "AND qr.academic_year_id = ?" : "") . "
    ";
    $submittedStmt = $conn->prepare($submittedSql);
    if ($yearId) {
        $submittedStmt->bind_param("sii", $teacherEmail, $classId, $yearId);
    } else {
        $submittedStmt->bind_param("si", $teacherEmail, $classId);
    }
    $submittedStmt->execute();
    $submittedCount = (int)$submittedStmt->get_result()->fetch_assoc()['c'];
    $submittedStmt->close();

    $perfSql = "
        SELECT qr.user_email,
               u.name, u.surname,
               ROUND(AVG(qr.score / qr.total * 100), 1) avg_pct
        FROM quiz_results qr
        JOIN quizzes q ON qr.quiz_id = q.id
        JOIN users u ON u.email = qr.user_email
        WHERE q.created_by = ? AND q.class_id = ? AND q.is_summative = 1
        " . ($yearId ? "AND qr.academic_year_id = ?" : "") . "
        GROUP BY qr.user_email
        ORDER BY avg_pct DESC
    ";
    $perfStmt = $conn->prepare($perfSql);
    if ($yearId) {
        $perfStmt->bind_param("sii", $teacherEmail, $classId, $yearId);
    } else {
        $perfStmt->bind_param("si", $teacherEmail, $classId);
    }
    $perfStmt->execute();
    $perfRes = $perfStmt->get_result();
    $perf = [];
    while ($p = $perfRes->fetch_assoc()) {
        $perf[] = ['name' => trim($p['name'] . ' ' . $p['surname']), 'avg' => $p['avg_pct']];
    }
    $perfStmt->close();

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
$classStmt->close();

// Overall avg
$overallSql = "
    SELECT ROUND(AVG(qr.score / qr.total * 100), 1) avg
    FROM quiz_results qr
    JOIN quizzes q ON qr.quiz_id = q.id
    WHERE q.created_by = ? AND q.is_summative = 1
    " . ($yearId ? "AND qr.academic_year_id = ?" : "") . "
";
$overallStmt = $conn->prepare($overallSql);
if ($yearId) {
    $overallStmt->bind_param("si", $teacherEmail, $yearId);
} else {
    $overallStmt->bind_param("s", $teacherEmail);
}
$overallStmt->execute();
$overallAvg = $overallStmt->get_result()->fetch_assoc()['avg'];
$overallStmt->close();

// School average
$schoolAvgSql = "
    SELECT ROUND(AVG(qr.score / qr.total * 100), 1) avg
    FROM quiz_results qr
    JOIN quizzes q ON qr.quiz_id = q.id
    WHERE q.is_summative = 1
    " . ($yearId ? "AND qr.academic_year_id = ?" : "") . "
";
$schoolAvgStmt = $conn->prepare($schoolAvgSql);
if ($yearId) {
    $schoolAvgStmt->bind_param("i", $yearId);
}
$schoolAvgStmt->execute();
$schoolAvg = $schoolAvgStmt->get_result()->fetch_assoc()['avg'];
$schoolAvgStmt->close();

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
