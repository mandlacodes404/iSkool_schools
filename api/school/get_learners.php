<?php
/**
 * iSkool School Dashboard — Get All Learners API
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

$yearId = 0;
$res = $conn->query("SELECT id FROM academic_years WHERE is_current = 1 LIMIT 1");
if ($row = $res->fetch_assoc()) $yearId = $row['id'];

$sql = "
    SELECT 
        u.id, u.name, u.surname, u.email, u.gender, u.age,
        u.profile_pic, u.created_at,
        GROUP_CONCAT(DISTINCT c.name ORDER BY c.name SEPARATOR ', ') AS classes,
        GROUP_CONCAT(DISTINCT c.id   ORDER BY c.name SEPARATOR ',')  AS class_ids
    FROM users u
    LEFT JOIN class_students cs ON cs.student_email = u.email
        " . ($yearId ? "AND cs.academic_year_id = $yearId" : "") . "
    LEFT JOIN classes c ON c.id = cs.class_id
    WHERE u.role = 'learner' AND u.is_deleted = 0
    GROUP BY u.id
    ORDER BY u.surname ASC, u.name ASC
";

$learners = [];
$result = $conn->query($sql);
while ($row = $result->fetch_assoc()) {
    // Overall avg (summative only)
    $email = $conn->real_escape_string($row['email']);
    $avgRes = $conn->query("
        SELECT ROUND(AVG(qr.score / qr.total * 100), 1) avg
        FROM quiz_results qr
        JOIN quizzes q ON qr.quiz_id = q.id
        WHERE qr.user_email = '$email' AND q.is_summative = 1
        " . ($yearId ? "AND qr.academic_year_id = $yearId" : "") . "
    ");
    $avg = $avgRes->fetch_assoc()['avg'];

    $learners[] = [
        'id'         => $row['id'],
        'name'       => trim($row['name'] . ' ' . $row['surname']),
        'first_name' => $row['name'],
        'surname'    => $row['surname'],
        'email'      => $row['email'],
        'gender'     => $row['gender'],
        'age'        => $row['age'],
        'profile_pic'=> $row['profile_pic'],
        'created_at' => $row['created_at'],
        'classes'    => $row['classes'] ?? '—',
        'class_ids'  => $row['class_ids'] ?? '',
        'avg_pct'    => $avg,
    ];
}

// Also return class list for filter dropdown
$classRes = $conn->query("SELECT id, name FROM classes ORDER BY name ASC");
$classes = [];
while ($c = $classRes->fetch_assoc()) $classes[] = $c;

echo json_encode(['learners' => $learners, 'classes' => $classes]);