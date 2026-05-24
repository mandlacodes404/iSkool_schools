<?php
/**
 * iSkool School Dashboard — Learner Profile API
 * Returns personal + academic details for a single learner
 * Updated: added guardian, emergency, medical, DOB, ID, address fields
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

$learnerEmail = trim($_POST['email'] ?? '');
if (!$learnerEmail) { echo json_encode(['error' => 'Missing email']); exit(); }

$safe = $conn->real_escape_string($learnerEmail);

// Current academic year
$yearId = 0;
$yearName = '';
$res = $conn->query("SELECT id, name FROM academic_years WHERE is_current = 1 LIMIT 1");
if ($row = $res->fetch_assoc()) { $yearId = $row['id']; $yearName = $row['name']; }

// Current term
$month = (int)date('n');
$currentTerm = $month <= 3 ? 1 : ($month <= 6 ? 2 : ($month <= 9 ? 3 : 4));

// ── Learner personal details — including all new profile fields ──
$uRes = $conn->query("
    SELECT id, name, surname, email, gender, age,
           profile_pic, created_at, profile_status,
           date_of_birth, id_number, address,
           guardian_name, guardian_relationship, guardian_phone, guardian_email,
           emergency_contact_name, emergency_contact_phone,
           medical_notes
    FROM users WHERE email = '$safe' AND role = 'learner' LIMIT 1
");
$u = $uRes->fetch_assoc();
if (!$u) { echo json_encode(['error' => 'Learner not found']); exit(); }

// Classes enrolled
$classRes = $conn->query("
    SELECT c.id, c.name FROM class_students cs
    JOIN classes c ON c.id = cs.class_id
    WHERE cs.student_email = '$safe'
    " . ($yearId ? "AND cs.academic_year_id = $yearId" : "") . "
    ORDER BY c.name ASC
");
$classes = [];
while ($c = $classRes->fetch_assoc()) $classes[] = $c;
$classNames = implode(', ', array_column($classes, 'name'));

// School name
$schoolName = 'iSkool';
$snRes = $conn->query("SELECT setting_value FROM school_name WHERE setting_key = 'school_name' LIMIT 1");
if ($snRow = $snRes->fetch_assoc()) $schoolName = $snRow['setting_value'];

// ── ACADEMIC DATA: subjects grouped by teacher_subjects ──
$classIds = array_column($classes, 'id');
$subjects = [];

if (!empty($classIds)) {
    $classIdStr = implode(',', array_map('intval', $classIds));

    $teacherRes = $conn->query("
        SELECT DISTINCT q.created_by, q.class_id
        FROM quizzes q
        WHERE q.class_id IN ($classIdStr) AND q.is_summative = 1
    ");

    $teacherClassPairs = [];
    while ($tr = $teacherRes->fetch_assoc()) {
        $teacherClassPairs[] = $tr;
    }

    foreach ($teacherClassPairs as $pair) {
        $teacherEmail = $conn->real_escape_string($pair['created_by']);
        $classId      = (int)$pair['class_id'];

        // Subject name or teacher name fallback
        $subjectName = null;
        $tsRes = $conn->query("
            SELECT subject_name FROM teacher_subjects
            WHERE teacher_email = '$teacherEmail' AND class_id = $classId LIMIT 1
        ");
        if ($tsRow = $tsRes->fetch_assoc()) $subjectName = $tsRow['subject_name'];

        if (!$subjectName) {
            $tuRes = $conn->query("SELECT name, surname FROM users WHERE email = '$teacherEmail' LIMIT 1");
            if ($tuRow = $tuRes->fetch_assoc()) {
                $subjectName = trim($tuRow['name'] . ' ' . $tuRow['surname']);
            } else {
                $subjectName = $teacherEmail;
            }
        }

        // Get class name
        $className = '';
        foreach ($classes as $c) {
            if ($c['id'] == $classId) { $className = $c['name']; break; }
        }

        $subjectKey = $subjectName . '|' . $classId;

        // Per-term data
        $terms = [];
        for ($t = 1; $t <= 4; $t++) {
            $qRes = $conn->query("
                SELECT q.id, q.title, q.weight_percent, q.term_number,
                       qr.score, qr.total
                FROM quizzes q
                LEFT JOIN quiz_results qr
                    ON qr.quiz_id = q.id AND qr.user_email = '$safe'
                WHERE q.class_id = $classId
                    AND q.created_by = '$teacherEmail'
                    AND q.is_summative = 1
                    AND q.term_number = $t
                    AND q.publish_marks = 1
                ORDER BY q.created_at ASC
            ");

            $quizzes     = [];
            $totalWeight = 0;
            $earnedTotal = 0;
            $totalCount  = 0;

            while ($qRow = $qRes->fetch_assoc()) {
                $totalCount++;
                $w = floatval($qRow['weight_percent'] ?: 0);
                if ($qRow['score'] !== null && $qRow['total'] > 0) {
                    $earned       = ($qRow['score'] / $qRow['total']) * $w;
                    $earnedTotal += $earned;
                    $totalWeight += $w;
                    $quizzes[]    = [
                        'title'  => $qRow['title'],
                        'score'  => $qRow['score'],
                        'total'  => $qRow['total'],
                        'weight' => $w,
                        'earned' => round($earned, 1),
                        'pct'    => round($qRow['score'] / $qRow['total'] * 100, 1),
                    ];
                }
            }

            // Recalculate weights evenly if all zero
            if ($totalWeight == 0 && count($quizzes) > 0) {
                $w = 100 / count($quizzes);
                foreach ($quizzes as &$qq) {
                    $qq['weight']  = $w;
                    $qq['earned']  = round(($qq['score'] / $qq['total']) * $w, 1);
                }
                unset($qq);
                $totalWeight = 100;
                $earnedTotal = array_sum(array_column($quizzes, 'earned'));
            }

            $pct       = $totalWeight > 0 ? round(($earnedTotal / $totalWeight) * 100) : null;
            $remaining = $totalWeight > 0 ? round(100 - $totalWeight, 1) : 100;

            $terms[$t] = [
                'pct'         => $pct,
                'count'       => count($quizzes),
                'total_count' => $totalCount,
                'remaining'   => $remaining,
                'quizzes'     => $quizzes,
            ];
        }

        $termPcts = array_filter(array_map(fn($t) => $t['pct'], $terms), fn($v) => $v !== null);
        $overallSubAvg = count($termPcts) ? round(array_sum($termPcts) / count($termPcts)) : null;

        $subjects[$subjectKey] = [
            'name'        => $subjectName,
            'class_name'  => $className,
            'terms'       => $terms,
            'overall_avg' => $overallSubAvg,
        ];
    }
}

$subjects = array_values($subjects);

$allAvgs    = array_filter(array_column($subjects, 'overall_avg'), fn($v) => $v !== null);
$overallAvg = count($allAvgs) ? round(array_sum($allAvgs) / count($allAvgs)) : null;

// Format DOB for display
$dobFormatted = null;
if ($u['date_of_birth']) {
    $dobFormatted = date('d F Y', strtotime($u['date_of_birth']));
}

echo json_encode([
    // ── Identity ──
    'id'           => $u['id'],
    'name'         => trim($u['name'] . ' ' . $u['surname']),
    'first_name'   => $u['name'],
    'surname'      => $u['surname'],
    'email'        => $u['email'],
    'gender'       => $u['gender'],
    'age'          => $u['age'],
    'date_of_birth'=> $dobFormatted,
    'id_number'    => $u['id_number'],
    'address'      => $u['address'],
    'profile_pic'  => $u['profile_pic'],
    'profile_status'=> $u['profile_status'] ?? 'incomplete',
    'joined'       => $u['created_at'],

    // ── Guardian ──
    'guardian_name'         => $u['guardian_name'],
    'guardian_relationship' => $u['guardian_relationship'],
    'guardian_phone'        => $u['guardian_phone'],
    'guardian_email'        => $u['guardian_email'],

    // ── Emergency ──
    'emergency_contact_name'  => $u['emergency_contact_name'],
    'emergency_contact_phone' => $u['emergency_contact_phone'],

    // ── Medical ──
    'medical_notes' => $u['medical_notes'],

    // ── Academic ──
    'classes'      => $classNames ?: '—',
    'school_name'  => $schoolName,
    'year_name'    => $yearName,
    'current_term' => $currentTerm,
    'subjects'     => $subjects,
    'overall_avg'  => $overallAvg,
    'date'         => date('d F Y'),
]);