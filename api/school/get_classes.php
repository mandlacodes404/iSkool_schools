<?php
/**
 * iSkool School Dashboard — Classes API
 * Returns all classes with summary stats
 */
ob_start();
error_reporting(E_ALL);
ini_set('display_errors', 0);
session_start();
require_once '../../config.php';

if (!isset($_SESSION['email']) || !in_array($_SESSION['role'], ['school_admin', 'admin'])) {
    http_response_code(403);
    echo json_encode(['error' => 'Unauthorized']);
    exit();
}

header('Content-Type: application/json');

// Current academic year
$yearId = 0;
$res = $conn->query("SELECT id FROM academic_years WHERE is_current = 1 LIMIT 1");
if ($row = $res->fetch_assoc()) $yearId = $row['id'];

$classes = [];
$classRes = $conn->query("SELECT id, name, subject, created_by FROM classes ORDER BY name ASC");

while ($cls = $classRes->fetch_assoc()) {
    $cid = $cls['id'];

    // Learner count
    $lc = $conn->query("SELECT COUNT(*) c FROM class_students WHERE class_id = $cid" . ($yearId ? " AND academic_year_id = $yearId" : ""))->fetch_assoc()['c'];

    // Quiz count
    $qc = $conn->query("SELECT COUNT(*) c FROM quizzes WHERE class_id = $cid")->fetch_assoc()['c'];

    // Assignment count
    $ac = $conn->query("SELECT COUNT(*) c FROM assignments WHERE class_id = $cid")->fetch_assoc()['c'];

    // Class average (summative quizzes)
    $avgRes = $conn->query("
        SELECT ROUND(AVG(qr.score / qr.total * 100), 1) avg
        FROM quiz_results qr
        JOIN quizzes q ON qr.quiz_id = q.id
        WHERE q.class_id = $cid AND q.is_summative = 1
        " . ($yearId ? "AND qr.academic_year_id = $yearId" : "") . "
    ");
    $avg = $avgRes->fetch_assoc()['avg'];

    // Teachers who posted content to this class (via teacher_subjects or quizzes/assignments)
    $teacherRes = $conn->query("
        SELECT DISTINCT u.name, u.surname, u.email,
            COALESCE(ts.subject_name, NULL) subject_name
        FROM users u
        LEFT JOIN teacher_subjects ts ON ts.teacher_email = u.email AND ts.class_id = $cid
        WHERE u.role = 'teacher' AND u.is_deleted = 0
        AND (
            EXISTS (SELECT 1 FROM quizzes WHERE created_by = u.email AND class_id = $cid)
            OR EXISTS (SELECT 1 FROM assignments WHERE created_by = u.email AND class_id = $cid)
            OR EXISTS (SELECT 1 FROM resources WHERE uploaded_by = u.email AND class_id = $cid)
        )
    ");
    $teachers = [];
    while ($t = $teacherRes->fetch_assoc()) {
        $teachers[] = [
            'name'         => trim($t['name'] . ' ' . $t['surname']),
            'email'        => $t['email'],
            'subject_name' => $t['subject_name']
        ];
    }

    $classes[] = [
        'id'            => $cid,
        'name'          => $cls['name'],
        'learner_count' => (int)$lc,
        'quiz_count'    => (int)$qc,
        'assignment_count' => (int)$ac,
        'avg_pct'       => $avg,
        'teachers'      => $teachers,
    ];
}

echo json_encode(['classes' => $classes]);