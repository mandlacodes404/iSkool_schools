<?php
/**
 * iSkool School Dashboard — Get Teacher Analytics Data API
 * Returns per-class analytics for a specific teacher/class/term
 * Mirrors api/teacher/get_analytics_data.php but for admin view
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

$teacherEmail = trim($_POST['teacher_email'] ?? '');
$classId      = (int)($_POST['class_id']      ?? 0);
$term         = (int)($_POST['term']           ?? 0);

if (!$teacherEmail || !$classId || !$term) {
    echo json_encode(['error' => 'Missing teacher_email, class_id or term']);
    exit();
}

$email = $conn->real_escape_string($teacherEmail);

$yearResult      = $conn->query("SELECT id FROM academic_years WHERE is_current = 1 LIMIT 1");
$current_year_id = (int)($yearResult->fetch_assoc()['id'] ?? 0);
$yearCond        = $current_year_id ? "AND qr.academic_year_id = $current_year_id" : "";
$yearCondQ       = $current_year_id ? "AND q.academic_year_id = $current_year_id" : "";

// ── Quiz averages (class avg per quiz) ──
$quizAvgs = [];
$qaRes = $conn->query("
    SELECT q.id, q.title,
           ROUND(AVG(qr.score / qr.total * 100), 1) avg,
           COUNT(DISTINCT qr.user_email) submitted
    FROM quizzes q
    LEFT JOIN quiz_results qr ON qr.quiz_id = q.id
    WHERE q.created_by = '$email'
      AND q.class_id = $classId
      AND q.term_number = $term
      AND q.is_summative = 1
      AND q.publish_marks = 1
      $yearCondQ
    GROUP BY q.id
    ORDER BY q.created_at ASC
");
while ($r = $qaRes->fetch_assoc()) {
    $quizAvgs[] = [
        'title'     => $r['title'],
        'avg'       => $r['avg'] !== null ? (float)$r['avg'] : null,
        'submitted' => (int)$r['submitted'],
    ];
}

// ── Boys vs Girls per quiz ──
$genderData = [];
$gRes = $conn->query("
    SELECT q.id, q.title,
           ROUND(AVG(CASE WHEN u.gender = 'male'   THEN qr.score / qr.total * 100 END), 1) boys,
           ROUND(AVG(CASE WHEN u.gender = 'female' THEN qr.score / qr.total * 100 END), 1) girls
    FROM quizzes q
    LEFT JOIN quiz_results qr ON qr.quiz_id = q.id
    LEFT JOIN users u ON u.email = qr.user_email
    WHERE q.created_by = '$email'
      AND q.class_id = $classId
      AND q.term_number = $term
      AND q.is_summative = 1
      AND q.publish_marks = 1
      $yearCondQ
    GROUP BY q.id
    ORDER BY q.created_at ASC
");
while ($r = $gRes->fetch_assoc()) {
    if ($r['boys'] !== null || $r['girls'] !== null) {
        $genderData[] = [
            'title' => $r['title'],
            'boys'  => $r['boys']  !== null ? (float)$r['boys']  : null,
            'girls' => $r['girls'] !== null ? (float)$r['girls'] : null,
        ];
    }
}

// ── Class performance by term (all 4 terms) ──
$classByTerm = [];
for ($t = 1; $t <= 4; $t++) {
    $r = $conn->query("
        SELECT ROUND(AVG(qr.score / qr.total * 100), 1) avg
        FROM quiz_results qr
        JOIN quizzes q ON qr.quiz_id = q.id
        WHERE q.created_by = '$email'
          AND q.class_id = $classId
          AND q.term_number = $t
          AND q.is_summative = 1
          $yearCond
    ")->fetch_assoc();
    $classByTerm[] = $r['avg'] !== null ? (float)$r['avg'] : null;
}

// ── Boys vs Girls by term ──
$boysByTerm   = [];
$girlsByTerm  = [];
for ($t = 1; $t <= 4; $t++) {
    $r = $conn->query("
        SELECT
            ROUND(AVG(CASE WHEN u.gender = 'male'   THEN qr.score / qr.total * 100 END), 1) boys,
            ROUND(AVG(CASE WHEN u.gender = 'female' THEN qr.score / qr.total * 100 END), 1) girls
        FROM quiz_results qr
        JOIN quizzes q ON qr.quiz_id = q.id
        JOIN users u ON u.email = qr.user_email
        WHERE q.created_by = '$email'
          AND q.class_id = $classId
          AND q.term_number = $t
          AND q.is_summative = 1
          $yearCond
    ")->fetch_assoc();
    $boysByTerm[]  = $r['boys']  !== null ? (float)$r['boys']  : null;
    $girlsByTerm[] = $r['girls'] !== null ? (float)$r['girls'] : null;
}

// ── Top girls / Top boys (this term) ──
$topGirls = [];
$topBoys  = [];
$topRes = $conn->query("
    SELECT qr.user_email,
           u.name, u.surname, u.gender,
           ROUND(AVG(qr.score / qr.total * 100), 1) avg
    FROM quiz_results qr
    JOIN quizzes q ON qr.quiz_id = q.id
    JOIN users u ON u.email = qr.user_email
    WHERE q.created_by = '$email'
      AND q.class_id = $classId
      AND q.term_number = $term
      AND q.is_summative = 1
      $yearCond
    GROUP BY qr.user_email
    ORDER BY avg DESC
");
while ($r = $topRes->fetch_assoc()) {
    $entry = ['name' => trim($r['name'] . ' ' . $r['surname']), 'avg' => (float)$r['avg']];
    if ($r['gender'] === 'female' && count($topGirls) < 5) $topGirls[] = $entry;
    if ($r['gender'] === 'male'   && count($topBoys)  < 5) $topBoys[]  = $entry;
}

// ── Admin-only: top learners + needs support (all genders, this term) ──
$allTop    = [];
$allBottom = [];
$perfRes   = $conn->query("
    SELECT qr.user_email,
           u.name, u.surname,
           ROUND(AVG(qr.score / qr.total * 100), 1) avg
    FROM quiz_results qr
    JOIN quizzes q ON qr.quiz_id = q.id
    JOIN users u ON u.email = qr.user_email
    WHERE q.created_by = '$email'
      AND q.class_id = $classId
      AND q.term_number = $term
      AND q.is_summative = 1
      $yearCond
    GROUP BY qr.user_email
    ORDER BY avg DESC
");
$perf = [];
while ($r = $perfRes->fetch_assoc()) {
    $perf[] = ['name' => trim($r['name'] . ' ' . $r['surname']), 'avg' => (float)$r['avg']];
}
$allTop    = array_slice($perf, 0, 5);
$allBottom = array_slice(array_reverse($perf), 0, 5);

echo json_encode([
    'quiz_averages'            => $quizAvgs,
    'quiz_gender_averages'     => $genderData,
    'class_performance_by_term'=> $classByTerm,
    'boys_vs_girls_by_term'    => ['boys' => $boysByTerm, 'girls' => $girlsByTerm],
    'top_girls'                => $topGirls,
    'top_boys'                 => $topBoys,
    // Admin extras
    'top_learners'             => $allTop,
    'needs_support'            => $allBottom,
]);