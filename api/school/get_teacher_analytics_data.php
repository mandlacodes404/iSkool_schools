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
require_once __DIR__ . '/../../auth/csrf_helper.php';
require_once '../../config.php';

if (!isset($_SESSION['email']) || !in_array($_SESSION['role'], ['school_admin', 'admin'])) {
    http_response_code(403);
    echo json_encode(['error' => 'Unauthorized']);
    exit();
}

verify_csrf_token();

header('Content-Type: application/json');

$teacherEmail = trim($_POST['teacher_email'] ?? '');
$classId      = (int)($_POST['class_id']      ?? 0);
$term         = (int)($_POST['term']           ?? 0);

if (!$teacherEmail || !$classId || !$term) {
    echo json_encode(['error' => 'Missing teacher_email, class_id or term']);
    exit();
}

$yearResult      = $conn->query("SELECT id FROM academic_years WHERE is_current = 1 LIMIT 1");
$current_year_id = (int)($yearResult->fetch_assoc()['id'] ?? 0);
$yearCond        = $current_year_id ? "AND qr.academic_year_id = ?" : "";
$yearCondQ       = $current_year_id ? "AND q.academic_year_id = ?" : "";

// ── Quiz averages (class avg per quiz) ──
$quizAvgs = [];
$qaStmt = $conn->prepare("
    SELECT q.id, q.title,
           ROUND(AVG(qr.score / qr.total * 100), 1) avg,
           COUNT(DISTINCT qr.user_email) submitted
    FROM quizzes q
    LEFT JOIN quiz_results qr ON qr.quiz_id = q.id
    WHERE q.created_by = ?
      AND q.class_id = ?
      AND q.term_number = ?
      AND q.is_summative = 1
      AND q.publish_marks = 1
      $yearCondQ
    GROUP BY q.id
    ORDER BY q.created_at ASC
");
$qaTypes = $current_year_id ? "siii" : "sii";
if ($current_year_id) {
    $qaStmt->bind_param($qaTypes, $teacherEmail, $classId, $term, $current_year_id);
} else {
    $qaStmt->bind_param($qaTypes, $teacherEmail, $classId, $term);
}
$qaStmt->execute();
$qaRes = $qaStmt->get_result();
while ($r = $qaRes->fetch_assoc()) {
    $quizAvgs[] = [
        'title'     => $r['title'],
        'avg'       => $r['avg'] !== null ? (float)$r['avg'] : null,
        'submitted' => (int)$r['submitted'],
    ];
}
$qaStmt->close();

// ── Boys vs Girls per quiz ──
$genderData = [];
$gStmt = $conn->prepare("
    SELECT q.id, q.title,
           ROUND(AVG(CASE WHEN u.gender = 'male'   THEN qr.score / qr.total * 100 END), 1) boys,
           ROUND(AVG(CASE WHEN u.gender = 'female' THEN qr.score / qr.total * 100 END), 1) girls
    FROM quizzes q
    LEFT JOIN quiz_results qr ON qr.quiz_id = q.id
    LEFT JOIN users u ON u.email = qr.user_email
    WHERE q.created_by = ?
      AND q.class_id = ?
      AND q.term_number = ?
      AND q.is_summative = 1
      AND q.publish_marks = 1
      $yearCondQ
    GROUP BY q.id
    ORDER BY q.created_at ASC
");
if ($current_year_id) {
    $gStmt->bind_param("siii", $teacherEmail, $classId, $term, $current_year_id);
} else {
    $gStmt->bind_param("sii", $teacherEmail, $classId, $term);
}
$gStmt->execute();
$gRes = $gStmt->get_result();
while ($r = $gRes->fetch_assoc()) {
    if ($r['boys'] !== null || $r['girls'] !== null) {
        $genderData[] = [
            'title' => $r['title'],
            'boys'  => $r['boys']  !== null ? (float)$r['boys']  : null,
            'girls' => $r['girls'] !== null ? (float)$r['girls'] : null,
        ];
    }
}
$gStmt->close();

// ── Class performance by term (all 4 terms) ──
$classByTerm = [];
for ($t = 1; $t <= 4; $t++) {
    $classTermStmt = $conn->prepare("
        SELECT ROUND(AVG(qr.score / qr.total * 100), 1) avg
        FROM quiz_results qr
        JOIN quizzes q ON qr.quiz_id = q.id
        WHERE q.created_by = ?
          AND q.class_id = ?
          AND q.term_number = ?
          AND q.is_summative = 1
          $yearCond
    ");
    if ($current_year_id) {
        $classTermStmt->bind_param("siii", $teacherEmail, $classId, $t, $current_year_id);
    } else {
        $classTermStmt->bind_param("sii", $teacherEmail, $classId, $t);
    }
    $classTermStmt->execute();
    $r = $classTermStmt->get_result()->fetch_assoc();
    $classTermStmt->close();
    $classByTerm[] = $r['avg'] !== null ? (float)$r['avg'] : null;
}

// ── Boys vs Girls by term ──
$boysByTerm   = [];
$girlsByTerm  = [];
for ($t = 1; $t <= 4; $t++) {
    $genderTermStmt = $conn->prepare("
        SELECT
            ROUND(AVG(CASE WHEN u.gender = 'male'   THEN qr.score / qr.total * 100 END), 1) boys,
            ROUND(AVG(CASE WHEN u.gender = 'female' THEN qr.score / qr.total * 100 END), 1) girls
        FROM quiz_results qr
        JOIN quizzes q ON qr.quiz_id = q.id
        JOIN users u ON u.email = qr.user_email
        WHERE q.created_by = ?
          AND q.class_id = ?
          AND q.term_number = ?
          AND q.is_summative = 1
          $yearCond
    ");
    if ($current_year_id) {
        $genderTermStmt->bind_param("siii", $teacherEmail, $classId, $t, $current_year_id);
    } else {
        $genderTermStmt->bind_param("sii", $teacherEmail, $classId, $t);
    }
    $genderTermStmt->execute();
    $r = $genderTermStmt->get_result()->fetch_assoc();
    $genderTermStmt->close();
    $boysByTerm[]  = $r['boys']  !== null ? (float)$r['boys']  : null;
    $girlsByTerm[] = $r['girls'] !== null ? (float)$r['girls'] : null;
}

// ── Top girls / Top boys (this term) ──
$topGirls = [];
$topBoys  = [];
$topStmt = $conn->prepare("
    SELECT qr.user_email,
           u.name, u.surname, u.gender,
           ROUND(AVG(qr.score / qr.total * 100), 1) avg
    FROM quiz_results qr
    JOIN quizzes q ON qr.quiz_id = q.id
    JOIN users u ON u.email = qr.user_email
    WHERE q.created_by = ?
      AND q.class_id = ?
      AND q.term_number = ?
      AND q.is_summative = 1
      $yearCond
    GROUP BY qr.user_email
    ORDER BY avg DESC
");
if ($current_year_id) {
    $topStmt->bind_param("siii", $teacherEmail, $classId, $term, $current_year_id);
} else {
    $topStmt->bind_param("sii", $teacherEmail, $classId, $term);
}
$topStmt->execute();
$topRes = $topStmt->get_result();
while ($r = $topRes->fetch_assoc()) {
    $entry = ['name' => trim($r['name'] . ' ' . $r['surname']), 'avg' => (float)$r['avg']];
    if ($r['gender'] === 'female' && count($topGirls) < 5) $topGirls[] = $entry;
    if ($r['gender'] === 'male'   && count($topBoys)  < 5) $topBoys[]  = $entry;
}
$topStmt->close();

// ── Admin-only: top learners + needs support (all genders, this term) ──
$allTop    = [];
$allBottom = [];
$perfStmt = $conn->prepare("
    SELECT qr.user_email,
           u.name, u.surname,
           ROUND(AVG(qr.score / qr.total * 100), 1) avg
    FROM quiz_results qr
    JOIN quizzes q ON qr.quiz_id = q.id
    JOIN users u ON u.email = qr.user_email
    WHERE q.created_by = ?
      AND q.class_id = ?
      AND q.term_number = ?
      AND q.is_summative = 1
      $yearCond
    GROUP BY qr.user_email
    ORDER BY avg DESC
");
if ($current_year_id) {
    $perfStmt->bind_param("siii", $teacherEmail, $classId, $term, $current_year_id);
} else {
    $perfStmt->bind_param("sii", $teacherEmail, $classId, $term);
}
$perfStmt->execute();
$perfRes = $perfStmt->get_result();
$perf = [];
while ($r = $perfRes->fetch_assoc()) {
    $perf[] = ['name' => trim($r['name'] . ' ' . $r['surname']), 'avg' => (float)$r['avg']];
}
$perfStmt->close();
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
