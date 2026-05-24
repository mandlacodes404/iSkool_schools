<?php
/**
 * iSkool School Dashboard — Get All Teachers API
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

$yearId = 0;
$res = $conn->query("SELECT id FROM academic_years WHERE is_current = 1 LIMIT 1");
if ($row = $res->fetch_assoc()) $yearId = $row['id'];

$teachers = [];

$result = $conn->query("
    SELECT id, name, surname, email, gender, profile_pic, created_at
    FROM users
    WHERE role = 'teacher' AND is_deleted = 0
    ORDER BY surname ASC, name ASC
");

while ($row = $result->fetch_assoc()) {
    $email = $conn->real_escape_string($row['email']);

    // Content counts
    $quizzes       = (int)$conn->query("SELECT COUNT(*) c FROM quizzes WHERE created_by = '$email'")->fetch_assoc()['c'];
    $assignments   = (int)$conn->query("SELECT COUNT(*) c FROM assignments WHERE created_by = '$email'")->fetch_assoc()['c'];
    $resources     = (int)$conn->query("SELECT COUNT(*) c FROM resources WHERE uploaded_by = '$email'")->fetch_assoc()['c'];
    $announcements = (int)$conn->query("SELECT COUNT(*) c FROM announcements WHERE created_by = '$email'")->fetch_assoc()['c'];
    $total         = $quizzes + $assignments + $resources + $announcements;

    // Classes they've posted to
    $classRes = $conn->query("
        SELECT DISTINCT c.name
        FROM classes c
        WHERE c.id IN (
            SELECT class_id FROM quizzes WHERE created_by = '$email'
            UNION
            SELECT class_id FROM assignments WHERE created_by = '$email'
            UNION
            SELECT class_id FROM resources WHERE uploaded_by = '$email'
        )
        ORDER BY c.name ASC
    ");
    $classNames = [];
    while ($c = $classRes->fetch_assoc()) $classNames[] = $c['name'];

    // Last active (most recent content)
    $lastRes = $conn->query("
        SELECT MAX(ts) last_active FROM (
            SELECT MAX(created_at) ts FROM quizzes WHERE created_by = '$email'
            UNION ALL
            SELECT MAX(created_at) ts FROM assignments WHERE created_by = '$email'
            UNION ALL
            SELECT MAX(uploaded_at) ts FROM resources WHERE uploaded_by = '$email'
            UNION ALL
            SELECT MAX(created_at) ts FROM announcements WHERE created_by = '$email'
        ) t
    ");
    $lastActive = $lastRes->fetch_assoc()['last_active'];

    // Average % of learners in their summative quizzes
    $avgRes = $conn->query("
        SELECT ROUND(AVG(qr.score / qr.total * 100), 1) avg
        FROM quiz_results qr
        JOIN quizzes q ON qr.quiz_id = q.id
        WHERE q.created_by = '$email' AND q.is_summative = 1
        " . ($yearId ? "AND qr.academic_year_id = $yearId" : "") . "
    ");
    $avg = $avgRes->fetch_assoc()['avg'];

    $teachers[] = [
        'id'           => $row['id'],
        'name'         => trim($row['name'] . ' ' . $row['surname']),
        'first_name'   => $row['name'],
        'surname'      => $row['surname'],
        'email'        => $row['email'],
        'gender'       => $row['gender'],
        'profile_pic'  => $row['profile_pic'],
        'created_at'   => $row['created_at'],
        'quizzes'      => $quizzes,
        'assignments'  => $assignments,
        'resources'    => $resources,
        'announcements'=> $announcements,
        'total'        => $total,
        'classes'      => implode(', ', $classNames),
        'class_list'   => $classNames,
        'last_active'  => $lastActive,
        'avg_pct'      => $avg,
    ];
}

echo json_encode(['teachers' => $teachers]);