<?php
/**
 * iSkool School Dashboard — Class Detail API
 * Returns learner performance grouped by subject/teacher
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

$classId = (int)($_POST['class_id'] ?? 0);
if (!$classId) { echo json_encode(['error' => 'Missing class_id']); exit(); }

// Current academic year
$yearId = 0;
$res = $conn->query("SELECT id FROM academic_years WHERE is_current = 1 LIMIT 1");
if ($row = $res->fetch_assoc()) $yearId = $row['id'];

// Class info
$clsRes = $conn->prepare("SELECT id, name FROM classes WHERE id = ?");
$clsRes->bind_param("i", $classId);
$clsRes->execute();
$cls = $clsRes->get_result()->fetch_assoc();
if (!$cls) { echo json_encode(['error' => 'Class not found']); exit(); }

// Learners in this class
$learners = [];
$lRes = $conn->query("
    SELECT u.name, u.surname, u.email, u.gender
    FROM class_students cs
    JOIN users u ON u.email = cs.student_email
    WHERE cs.class_id = $classId
    " . ($yearId ? "AND cs.academic_year_id = $yearId" : "") . "
    AND u.is_deleted = 0
    ORDER BY u.surname ASC
");
while ($l = $lRes->fetch_assoc()) {
    $learners[$l['email']] = [
        'name'    => trim($l['name'] . ' ' . $l['surname']),
        'email'   => $l['email'],
        'gender'  => $l['gender']
    ];
}

// Teachers who posted quizzes to this class
$teacherRes = $conn->query("
    SELECT DISTINCT created_by FROM quizzes
    WHERE class_id = $classId AND is_summative = 1
");

$subjects = [];

while ($tRow = $teacherRes->fetch_assoc()) {
    $teacherEmail = $tRow['created_by'];

    // Get subject name or fall back to teacher name
    $subjectName = null;
    $tsRes = $conn->query("
        SELECT subject_name FROM teacher_subjects
        WHERE teacher_email = '$teacherEmail' AND class_id = $classId
        LIMIT 1
    ");
    if ($tsRow = $tsRes->fetch_assoc()) {
        $subjectName = $tsRow['subject_name'];
    }

    if (!$subjectName) {
        $uRes = $conn->query("SELECT name, surname FROM users WHERE email = '$teacherEmail' LIMIT 1");
        if ($uRow = $uRes->fetch_assoc()) {
            $subjectName = trim($uRow['name'] . ' ' . $uRow['surname']);
        } else {
            $subjectName = $teacherEmail;
        }
    }

    // Get summative quizzes for this teacher + class
    $quizRes = $conn->query("
        SELECT id, title, term_number FROM quizzes
        WHERE class_id = $classId AND created_by = '$teacherEmail' AND is_summative = 1
        ORDER BY term_number ASC, created_at ASC
    ");

    $quizzes = [];
    while ($q = $quizRes->fetch_assoc()) {
        $quizzes[] = $q;
    }

    if (empty($quizzes)) continue;

    // For each learner, get their score per quiz
    $learnerPerf = [];
    foreach ($learners as $email => $ldata) {
        $scores = [];
        $total  = 0;
        $count  = 0;

        foreach ($quizzes as $quiz) {
            $qid = $quiz['id'];
            $scoreRes = $conn->query("
                SELECT score, total FROM quiz_results
                WHERE user_email = '$email' AND quiz_id = $qid
                ORDER BY submitted_at DESC LIMIT 1
            ");
            if ($sRow = $scoreRes->fetch_assoc()) {
                $pct = $sRow['total'] > 0
                    ? round($sRow['score'] / $sRow['total'] * 100, 1)
                    : null;
                $scores[$qid] = $pct;
                if ($pct !== null) { $total += $pct; $count++; }
            } else {
                $scores[$qid] = null; // not attempted
            }
        }

        $avg = $count > 0 ? round($total / $count, 1) : null;

        $learnerPerf[] = [
            'name'   => $ldata['name'],
            'email'  => $email,
            'gender' => $ldata['gender'],
            'scores' => $scores,
            'avg'    => $avg,
        ];
    }

    // Sort by avg desc
    usort($learnerPerf, function($a, $b) {
        if ($a['avg'] === null && $b['avg'] === null) return 0;
        if ($a['avg'] === null) return 1;
        if ($b['avg'] === null) return -1;
        return $b['avg'] <=> $a['avg'];
    });

    // Subject average
    $validAvgs = array_filter(array_column($learnerPerf, 'avg'), fn($v) => $v !== null);
    $subjectAvg = count($validAvgs) ? round(array_sum($validAvgs) / count($validAvgs), 1) : null;

    $subjects[] = [
        'subject_name'   => $subjectName,
        'teacher_email'  => $teacherEmail,
        'quizzes'        => $quizzes,
        'learner_perf'   => $learnerPerf,
        'subject_avg'    => $subjectAvg,
    ];
}

echo json_encode([
    'class_id'      => $classId,
    'class_name'    => $cls['name'],
    'learner_count' => count($learners),
    'subjects'      => $subjects,
]);