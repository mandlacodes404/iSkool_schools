<?php
/**
 * iSkool School Dashboard — Analytics API
 * School-wide performance data: trends, class comparison,
 * subject breakdown, gender, top performers, most improved, completion
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

// ── Current academic year ──
$yearId   = 0;
$yearName = 'Current Year';
$res = $conn->query("SELECT id, name FROM academic_years WHERE is_current = 1 LIMIT 1");
if ($row = $res->fetch_assoc()) { $yearId = $row['id']; $yearName = $row['name']; }
$yearCond = $yearId ? "AND qr.academic_year_id = $yearId" : "";
$yearCondNoAlias = $yearId ? "AND academic_year_id = $yearId" : "";

// ══════════════════════════════════════════════════════════
// 1. TERM AVERAGES — school average per term (trend line)
// ══════════════════════════════════════════════════════════
$termAverages = [];
for ($t = 1; $t <= 4; $t++) {
    $r = $conn->query("
        SELECT ROUND(AVG(qr.score / qr.total * 100), 1) avg,
               COUNT(DISTINCT qr.user_email) learners,
               COUNT(*) submissions
        FROM quiz_results qr
        JOIN quizzes q ON qr.quiz_id = q.id
        WHERE q.is_summative = 1 AND q.term_number = $t
        $yearCond
    ")->fetch_assoc();
    $termAverages[] = [
        'term'        => $t,
        'avg'         => $r['avg'],
        'learners'    => (int)$r['learners'],
        'submissions' => (int)$r['submissions'],
    ];
}

// ══════════════════════════════════════════════════════════
// 2. CLASS PERFORMANCE — avg per class, per term
// ══════════════════════════════════════════════════════════
$classPerf = [];
$classRes = $conn->query("SELECT id, name FROM classes ORDER BY name ASC");
while ($cls = $classRes->fetch_assoc()) {
    $cid   = (int)$cls['id'];
    $terms = [];
    $allAvgs = [];

    for ($t = 1; $t <= 4; $t++) {
        $r = $conn->query("
            SELECT ROUND(AVG(qr.score / qr.total * 100), 1) avg
            FROM quiz_results qr
            JOIN quizzes q ON qr.quiz_id = q.id
            WHERE q.class_id = $cid AND q.is_summative = 1 AND q.term_number = $t
            $yearCond
        ")->fetch_assoc();
        $avg = $r['avg'];
        $terms[$t] = $avg;
        if ($avg !== null) $allAvgs[] = $avg;
    }

    $overall = count($allAvgs) ? round(array_sum($allAvgs) / count($allAvgs), 1) : null;

    // Learner count
    $lc = (int)$conn->query("
        SELECT COUNT(DISTINCT student_email) c FROM class_students
        WHERE class_id = $cid " . ($yearId ? "AND academic_year_id = $yearId" : "") . "
    ")->fetch_assoc()['c'];

    $classPerf[] = [
        'class_id'      => $cid,
        'class_name'    => $cls['name'],
        'learner_count' => $lc,
        'terms'         => $terms,
        'overall'       => $overall,
    ];
}

// Sort by overall desc
usort($classPerf, function($a, $b) {
    if ($a['overall'] === null && $b['overall'] === null) return 0;
    if ($a['overall'] === null) return 1;
    if ($b['overall'] === null) return -1;
    return $b['overall'] <=> $a['overall'];
});

// ══════════════════════════════════════════════════════════
// 3. SUBJECT PERFORMANCE — avg per subject across school
// ══════════════════════════════════════════════════════════
$subjectPerf = [];

// Get all teacher+class combos that have summative quizzes
$tcRes = $conn->query("
    SELECT DISTINCT q.created_by, q.class_id
    FROM quizzes q
    WHERE q.is_summative = 1
");

$subjectMap = []; // key = subject_name, accumulate avgs

while ($tc = $tcRes->fetch_assoc()) {
    $teacherEmail = $conn->real_escape_string($tc['created_by']);
    $classId      = (int)$tc['class_id'];

    // Subject name or teacher name fallback
    $subjectName = null;
    $tsRes = $conn->query("SELECT subject_name FROM teacher_subjects WHERE teacher_email = '$teacherEmail' AND class_id = $classId LIMIT 1");
    if ($tsRow = $tsRes->fetch_assoc()) $subjectName = $tsRow['subject_name'];
    if (!$subjectName) {
        $uRes = $conn->query("SELECT name, surname FROM users WHERE email = '$teacherEmail' LIMIT 1");
        if ($uRow = $uRes->fetch_assoc()) $subjectName = trim($uRow['name'] . ' ' . $uRow['surname']);
        else $subjectName = $teacherEmail;
    }

    $avgRes = $conn->query("
        SELECT ROUND(AVG(qr.score / qr.total * 100), 1) avg,
               COUNT(DISTINCT qr.user_email) learners
        FROM quiz_results qr
        JOIN quizzes q ON qr.quiz_id = q.id
        WHERE q.created_by = '$teacherEmail' AND q.class_id = $classId AND q.is_summative = 1
        $yearCond
    ")->fetch_assoc();

    if ($avgRes['avg'] === null) continue;

    if (!isset($subjectMap[$subjectName])) {
        $subjectMap[$subjectName] = ['avgs' => [], 'learners' => 0];
    }
    $subjectMap[$subjectName]['avgs'][]   = floatval($avgRes['avg']);
    $subjectMap[$subjectName]['learners'] += (int)$avgRes['learners'];
}

foreach ($subjectMap as $name => $data) {
    $avg = count($data['avgs']) ? round(array_sum($data['avgs']) / count($data['avgs']), 1) : null;
    $subjectPerf[] = ['subject' => $name, 'avg' => $avg, 'learners' => $data['learners']];
}
usort($subjectPerf, fn($a, $b) => ($b['avg'] ?? -1) <=> ($a['avg'] ?? -1));

// ══════════════════════════════════════════════════════════
// 4. GENDER BREAKDOWN — avg per term per gender
// ══════════════════════════════════════════════════════════
$genderBreakdown = [];
foreach (['male', 'female'] as $gender) {
    $gSafe = $conn->real_escape_string($gender);
    $termData = [];
    for ($t = 1; $t <= 4; $t++) {
        $r = $conn->query("
            SELECT ROUND(AVG(qr.score / qr.total * 100), 1) avg
            FROM quiz_results qr
            JOIN quizzes q ON qr.quiz_id = q.id
            JOIN users u ON u.email = qr.user_email
            WHERE q.is_summative = 1 AND q.term_number = $t
            AND u.gender = '$gSafe'
            $yearCond
        ")->fetch_assoc();
        $termData[$t] = $r['avg'];
    }
    // Overall
    $overall = $conn->query("
        SELECT ROUND(AVG(qr.score / qr.total * 100), 1) avg
        FROM quiz_results qr
        JOIN quizzes q ON qr.quiz_id = q.id
        JOIN users u ON u.email = qr.user_email
        WHERE q.is_summative = 1 AND u.gender = '$gSafe'
        $yearCond
    ")->fetch_assoc()['avg'];

    $genderBreakdown[$gender] = ['terms' => $termData, 'overall' => $overall];
}

// ══════════════════════════════════════════════════════════
// 5. TOP PERFORMERS — top 10 learners by overall avg
// ══════════════════════════════════════════════════════════
$topPerformers = [];
$topRes = $conn->query("
    SELECT qr.user_email,
           u.name, u.surname, u.gender,
           GROUP_CONCAT(DISTINCT c.name ORDER BY c.name SEPARATOR ', ') class_names,
           ROUND(AVG(qr.score / qr.total * 100), 1) avg_pct,
           COUNT(*) submissions
    FROM quiz_results qr
    JOIN quizzes q ON qr.quiz_id = q.id
    JOIN users u ON u.email = qr.user_email
    LEFT JOIN class_students cs ON cs.student_email = qr.user_email
        " . ($yearId ? "AND cs.academic_year_id = $yearId" : "") . "
    LEFT JOIN classes c ON c.id = cs.class_id
    WHERE q.is_summative = 1 AND u.role = 'learner'
    $yearCond
    GROUP BY qr.user_email
    HAVING COUNT(*) >= 1
    ORDER BY avg_pct DESC
    LIMIT 10
");
while ($r = $topRes->fetch_assoc()) {
    $topPerformers[] = [
        'name'        => trim($r['name'] . ' ' . $r['surname']),
        'email'       => $r['user_email'],
        'gender'      => $r['gender'],
        'classes'     => $r['class_names'] ?: '—',
        'avg'         => $r['avg_pct'],
        'submissions' => (int)$r['submissions'],
    ];
}

// ══════════════════════════════════════════════════════════
// 6. MOST IMPROVED — biggest jump from Term 1→2, 2→3, or 3→4
// ══════════════════════════════════════════════════════════
$mostImproved = [];

// Get per-learner per-term averages
$miRes = $conn->query("
    SELECT qr.user_email,
           u.name, u.surname,
           q.term_number,
           ROUND(AVG(qr.score / qr.total * 100), 1) avg_pct
    FROM quiz_results qr
    JOIN quizzes q ON qr.quiz_id = q.id
    JOIN users u ON u.email = qr.user_email
    WHERE q.is_summative = 1 AND u.role = 'learner'
    $yearCond
    GROUP BY qr.user_email, q.term_number
    ORDER BY qr.user_email, q.term_number
");

$learnerTerms = [];
while ($r = $miRes->fetch_assoc()) {
    $email = $r['user_email'];
    if (!isset($learnerTerms[$email])) {
        $learnerTerms[$email] = [
            'name'  => trim($r['name'] . ' ' . $r['surname']),
            'terms' => []
        ];
    }
    $learnerTerms[$email]['terms'][$r['term_number']] = floatval($r['avg_pct']);
}

// Find biggest improvement between consecutive terms
foreach ($learnerTerms as $email => $data) {
    $terms = $data['terms'];
    $maxJump = null;
    $fromTerm = null;
    $toTerm   = null;

    for ($t = 1; $t <= 3; $t++) {
        if (isset($terms[$t]) && isset($terms[$t + 1])) {
            $jump = $terms[$t + 1] - $terms[$t];
            if ($maxJump === null || $jump > $maxJump) {
                $maxJump  = $jump;
                $fromTerm = $t;
                $toTerm   = $t + 1;
            }
        }
    }

    if ($maxJump !== null && $maxJump > 0) {
        $mostImproved[] = [
            'name'      => $data['name'],
            'email'     => $email,
            'from_term' => $fromTerm,
            'to_term'   => $toTerm,
            'from_avg'  => $terms[$fromTerm],
            'to_avg'    => $terms[$toTerm],
            'jump'      => round($maxJump, 1),
        ];
    }
}

// Sort by jump desc, take top 10
usort($mostImproved, fn($a, $b) => $b['jump'] <=> $a['jump']);
$mostImproved = array_slice($mostImproved, 0, 10);

// ══════════════════════════════════════════════════════════
// 7. COMPLETION RATE — per term: enrolled vs submitted
// ══════════════════════════════════════════════════════════
$enrolled = (int)$conn->query("
    SELECT COUNT(DISTINCT student_email) c FROM class_students
    " . ($yearId ? "WHERE academic_year_id = $yearId" : "") . "
")->fetch_assoc()['c'];

$completionByTerm = [];
for ($t = 1; $t <= 4; $t++) {
    $submitted = (int)$conn->query("
        SELECT COUNT(DISTINCT qr.user_email) c
        FROM quiz_results qr
        JOIN quizzes q ON qr.quiz_id = q.id
        WHERE q.is_summative = 1 AND q.term_number = $t
        $yearCond
    ")->fetch_assoc()['c'];

    $rate = $enrolled > 0 ? round($submitted / $enrolled * 100, 1) : 0;
    $completionByTerm[] = [
        'term'      => $t,
        'enrolled'  => $enrolled,
        'submitted' => $submitted,
        'rate'      => $rate,
    ];
}

// ══════════════════════════════════════════════════════════
// 8. SUMMARY KPIs
// ══════════════════════════════════════════════════════════
$totalLearners  = (int)$conn->query("SELECT COUNT(*) c FROM users WHERE role='learner' AND is_deleted=0")->fetch_assoc()['c'];
$totalTeachers  = (int)$conn->query("SELECT COUNT(*) c FROM users WHERE role='teacher' AND is_deleted=0")->fetch_assoc()['c'];
$totalClasses   = (int)$conn->query("SELECT COUNT(*) c FROM classes")->fetch_assoc()['c'];

$schoolOverallAvg = $conn->query("
    SELECT ROUND(AVG(qr.score / qr.total * 100), 1) avg
    FROM quiz_results qr
    JOIN quizzes q ON qr.quiz_id = q.id
    WHERE q.is_summative = 1
    $yearCond
")->fetch_assoc()['avg'];

// ══════════════════════════════════════════════════════════
// RESPOND
// ══════════════════════════════════════════════════════════
echo json_encode([
    'year_name'          => $yearName,
    'total_learners'     => $totalLearners,
    'total_teachers'     => $totalTeachers,
    'total_classes'      => $totalClasses,
    'school_overall_avg' => $schoolOverallAvg,
    'term_averages'      => $termAverages,
    'class_performance'  => $classPerf,
    'subject_performance'=> $subjectPerf,
    'gender_breakdown'   => $genderBreakdown,
    'top_performers'     => $topPerformers,
    'most_improved'      => $mostImproved,
    'completion'         => $completionByTerm,
    'enrolled'           => $enrolled,
]);