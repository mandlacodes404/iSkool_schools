<?php
require_once __DIR__ . '/../../auth/session_guard.php';
header('Content-Type: application/json');

require_once dirname(__DIR__, 2) . '/config.php';

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
        if ($stmtCheck->get_result()->num_rows === 1) $targetEmail = $requestedEmail;
        $stmtCheck->close();
    }
}

if (!in_array($viewerRole, ['learner', 'parent'])) {
    echo json_encode(['error' => 'Unauthorized']); exit();
}

// ── School info ──
$schoolName = 'My School';
$schoolLogo = 'uploads/schools/default_school.png';
$r = $conn->query("SELECT setting_value FROM school_name WHERE setting_key = 'school_name' LIMIT 1");
if ($row = $r->fetch_assoc()) $schoolName = $row['setting_value'];

// ── Learner details ──
$ls = $conn->prepare("
    SELECT u.name, u.surname, u.title, c.name AS class_name
    FROM users u
    LEFT JOIN class_students cs ON u.email = cs.student_email
        AND cs.academic_year_id = (SELECT id FROM academic_years WHERE is_current = 1 LIMIT 1)
    LEFT JOIN classes c ON cs.class_id = c.id
    WHERE u.email = ? AND u.role = 'learner' LIMIT 1
");
$ls->bind_param("s", $targetEmail);
$ls->execute();
$learner = $ls->get_result()->fetch_assoc();
$ls->close();

$learnerName  = trim(($learner['title'] ?? '') . ' ' . ($learner['name'] ?? '') . ' ' . ($learner['surname'] ?? ''));
$learnerClass = $learner['class_name'] ?? 'Not enrolled';

// ── Academic year & term ──
$yr = $conn->query("SELECT id FROM academic_years WHERE is_current = 1 LIMIT 1");
$current_year_id = (int)$yr->fetch_assoc()['id'];

$tr = $conn->query("SELECT current_global_term FROM platform_settings LIMIT 1");
$current_term = (int)$tr->fetch_assoc()['current_global_term'];

// ── All quiz results ──
$sql = "
    SELECT
        r.id AS result_id, r.score, r.total, r.submitted_at,
        q.id AS quiz_id, q.title AS quiz_title, q.publish_marks,
        q.is_summative, q.weight_percent, q.term_number,
        COALESCE(ts.subject_name, CONCAT(COALESCE(u.title,''), ' ', COALESCE(u.surname,'Unknown'))) AS subject
    FROM quiz_results r
    JOIN quizzes q ON r.quiz_id = q.id
    JOIN class_students cs ON q.class_id = cs.class_id
        AND cs.student_email = r.user_email
        AND cs.academic_year_id = ?
    LEFT JOIN teacher_subjects ts ON ts.teacher_email = q.created_by AND ts.class_id = q.class_id
    LEFT JOIN users u ON q.created_by = u.email AND u.role = 'teacher'
    WHERE r.user_email = ? AND q.academic_year_id = ?
    ORDER BY subject ASC, r.submitted_at DESC
";
$stmt = $conn->prepare($sql);
$stmt->bind_param("isi", $current_year_id, $targetEmail, $current_year_id);
$stmt->execute();
$rows = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
$stmt->close();

// ── Group by subject ──
$bySubject = [];
foreach ($rows as $row) {
    $sub = trim($row['subject'] ?: 'Unknown Subject');
    $bySubject[$sub][] = $row;
}

// ── Calculate term mark ──
function calcTermMark($quizzes, $term) {
    $summative = array_values(array_filter($quizzes, fn($q) =>
        !empty($q['is_summative']) && (int)$q['term_number'] === $term
    ));

    if (empty($summative)) return ['pct' => null, 'assessed' => 0, 'remaining' => 100, 'count' => 0, 'total_count' => 0];

    $published   = array_values(array_filter($summative, fn($q) => $q['publish_marks'] == 1));
    $weights     = array_map(fn($q) => (float)($q['weight_percent'] ?? 0), $published);
    $totalWeight = array_sum($weights);

    if ($totalWeight > 100) {
        $f = 100 / $totalWeight;
        $weights = array_map(fn($w) => $w * $f, $weights);
        $totalWeight = 100;
    } elseif ($totalWeight == 0 && count($published) > 0) {
        $weights = array_fill(0, count($published), 100 / count($published));
        $totalWeight = 100;
    }

    $earned = 0;
    foreach ($published as $i => $q) {
        $w = $weights[$i] ?? 0;
        $earned += $q['total'] > 0 ? round(($q['score'] / $q['total']) * $w, 1) : 0;
    }

    $pct = $totalWeight > 0 ? round(($earned / $totalWeight) * 100) : 0;

    return [
        'pct'         => count($published) > 0 ? $pct : null,
        'assessed'    => round($totalWeight, 1),
        'remaining'   => round(100 - $totalWeight, 1),
        'count'       => count($published),
        'total_count' => count($summative)
    ];
}

// ── Build subjects array with all 4 terms ──
$subjects = [];
foreach ($bySubject as $name => $quizzes) {
    $terms = [];
    for ($t = 1; $t <= 4; $t++) {
        $terms[$t] = calcTermMark($quizzes, $t);
    }
    $subjects[] = ['name' => $name, 'terms' => $terms];
}

// ── Overall average for current term ──
$overallValues = array_filter(array_map(fn($s) => $s['terms'][$current_term]['pct'], $subjects), fn($v) => $v !== null);
$overallAvg    = count($overallValues) > 0 ? round(array_sum($overallValues) / count($overallValues)) : null;

echo json_encode([
    'school_name'  => $schoolName,
    'school_logo'  => $schoolLogo,
    'learner_name' => $learnerName,
    'learner_class'=> $learnerClass,
    'current_term' => $current_term,
    'date'         => date('F j, Y'),
    'overall_avg'  => $overallAvg,
    'subjects'     => $subjects
]);