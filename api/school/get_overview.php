<?php
/**
 * iSkool School Dashboard — Overview API
 * Returns aggregated school-wide stats for the war room
 */
ob_start();
error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);
require_once __DIR__ . '/../../auth/session_guard.php';
require_once '../../config.php';

// Gate: school_admin or admin only
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
if ($row = $res->fetch_assoc()) {
    $yearId   = $row['id'];
    $yearName = $row['name'];
}

// ── KPI: Totals ──
$totalLearners  = $conn->query("SELECT COUNT(*) c FROM users WHERE role='learner' AND is_deleted=0")->fetch_assoc()['c'];
$totalTeachers  = $conn->query("SELECT COUNT(*) c FROM users WHERE role='teacher' AND is_deleted=0")->fetch_assoc()['c'];
$totalClasses   = $conn->query("SELECT COUNT(*) c FROM classes")->fetch_assoc()['c'];

// ── KPI: School average % (from quiz_results this year) ──
$avgRes = $conn->query("
    SELECT ROUND(AVG(qr.score / qr.total * 100), 1) avg
    FROM quiz_results qr
    JOIN quizzes q ON qr.quiz_id = q.id
    WHERE q.is_summative = 1
    " . ($yearId ? "AND qr.academic_year_id = $yearId" : "") . "
");
$schoolAvg = $avgRes->fetch_assoc()['avg'];

// ── Activity this week ──
$weekAgo = date('Y-m-d H:i:s', strtotime('-7 days'));

$quizzesThisWeek = $conn->query("
    SELECT COUNT(*) c FROM quizzes
    WHERE created_at >= '$weekAgo'
")->fetch_assoc()['c'];

$assignmentsThisWeek = $conn->query("
    SELECT COUNT(*) c FROM assignments
    WHERE created_at >= '$weekAgo'
")->fetch_assoc()['c'];

$announcementsThisWeek = $conn->query("
    SELECT COUNT(*) c FROM announcements
    WHERE created_at >= '$weekAgo'
")->fetch_assoc()['c'];

$resourcesThisWeek = $conn->query("
    SELECT COUNT(*) c FROM resources
    WHERE uploaded_at >= '$weekAgo'
")->fetch_assoc()['c'];

// ── Class performance (avg % per class, summative quizzes) ──
$classPerf = [];
$cpRes = $conn->query("
    SELECT c.name class_name,
           ROUND(AVG(qr.score / qr.total * 100), 1) avg_pct,
           COUNT(DISTINCT cs.student_email) learner_count
    FROM classes c
    LEFT JOIN class_students cs ON cs.class_id = c.id " . ($yearId ? "AND cs.academic_year_id = $yearId" : "") . "
    LEFT JOIN quizzes q ON q.class_id = c.id AND q.is_summative = 1
    LEFT JOIN quiz_results qr ON qr.quiz_id = q.id
    GROUP BY c.id, c.name
    ORDER BY avg_pct DESC
");
while ($row = $cpRes->fetch_assoc()) {
    $classPerf[] = $row;
}

// ── Quiz completion rate (submitted vs enrolled) ──
$completionRes = $conn->query("
    SELECT 
        COUNT(DISTINCT qr.user_email) submitted,
        (SELECT COUNT(*) FROM class_students " . ($yearId ? "WHERE academic_year_id = $yearId" : "") . ") enrolled
    FROM quiz_results qr
    JOIN quizzes q ON qr.quiz_id = q.id
    " . ($yearId ? "WHERE qr.academic_year_id = $yearId" : "") . "
");
$comp = $completionRes->fetch_assoc();
$completionRate = ($comp['enrolled'] > 0)
    ? round($comp['submitted'] / $comp['enrolled'] * 100, 1)
    : 0;

// ── Most active teachers (by content published) ──
$activeTeachers = [];
$atRes = $conn->query("
    SELECT u.name, u.surname, u.email,
        (SELECT COUNT(*) FROM quizzes WHERE created_by = u.email) quizzes,
        (SELECT COUNT(*) FROM assignments WHERE created_by = u.email) assignments,
        (SELECT COUNT(*) FROM resources WHERE uploaded_by = u.email) resources,
        (SELECT COUNT(*) FROM announcements WHERE created_by = u.email) announcements
    FROM users u
    WHERE u.role = 'teacher' AND u.is_deleted = 0
    ORDER BY (quizzes + assignments + resources + announcements) DESC
    LIMIT 5
");
while ($row = $atRes->fetch_assoc()) {
    $row['total'] = $row['quizzes'] + $row['assignments'] + $row['resources'] + $row['announcements'];
    $activeTeachers[] = $row;
}

// ── Recent activity feed ──
$recentActivity = [];

// Recent quizzes
$rqRes = $conn->query("
    SELECT q.title, q.created_at, u.name, u.surname, c.name class_name
    FROM quizzes q
    JOIN users u ON u.email = q.created_by
    JOIN classes c ON c.id = q.class_id
    ORDER BY q.created_at DESC LIMIT 4
");
while ($row = $rqRes->fetch_assoc()) {
    $recentActivity[] = [
        'type'  => 'quiz',
        'text'  => trim($row['name'] . ' ' . $row['surname']) . ' posted quiz "' . $row['title'] . '"',
        'class' => $row['class_name'],
        'time'  => $row['created_at']
    ];
}

// Recent announcements
$raRes = $conn->query("
    SELECT a.title, a.created_at, u.name, u.surname, c.name class_name
    FROM announcements a
    JOIN users u ON u.email = a.created_by
    LEFT JOIN classes c ON c.id = a.class_id
    ORDER BY a.created_at DESC LIMIT 3
");
while ($row = $raRes->fetch_assoc()) {
    $recentActivity[] = [
        'type'  => 'announcement',
        'text'  => trim($row['name'] . ' ' . $row['surname']) . ' announced "' . $row['title'] . '"',
        'class' => $row['class_name'] ?? 'All',
        'time'  => $row['created_at']
    ];
}

// Sort by time desc
usort($recentActivity, fn($a, $b) => strtotime($b['time']) - strtotime($a['time']));
$recentActivity = array_slice($recentActivity, 0, 6);

// ── Classes needing attention (avg < 50%) ──
$needAttention = array_filter($classPerf, fn($c) => $c['avg_pct'] !== null && $c['avg_pct'] < 50);

// ── Top 3 / Bottom 3 classes ──
$classesWithAvg = array_values(array_filter($classPerf, fn($c) => $c['avg_pct'] !== null));
$top3    = array_slice($classesWithAvg, 0, 3);
$bottom3 = array_reverse(array_slice($classesWithAvg, -3));

// ── Incomplete learner profiles (uses profile_status column) ──
$incompleteProfiles = $conn->query("
    SELECT COUNT(*) c FROM users
    WHERE role = 'learner' AND is_deleted = 0
    AND profile_status = 'incomplete'
")->fetch_assoc()['c'];

// ── Platform engagement: learners with a valid (non-expired) token ──
$engagedLearners = $conn->query("
    SELECT COUNT(DISTINCT u.email) c
    FROM users u
    JOIN user_tokens ut ON ut.user_email = u.email
    WHERE u.role = 'learner' AND u.is_deleted = 0
    AND ut.expiry >= NOW()
")->fetch_assoc()['c'];

$engagementRate = ($totalLearners > 0)
    ? round($engagedLearners / $totalLearners * 100, 1)
    : 0;

echo json_encode([
    'year_name'              => $yearName,
    'total_learners'         => (int)$totalLearners,
    'total_teachers'         => (int)$totalTeachers,
    'total_classes'          => (int)$totalClasses,
    'school_avg'             => $schoolAvg,
    'completion_rate'        => $completionRate,
    'this_week'              => [
        'quizzes'       => (int)$quizzesThisWeek,
        'assignments'   => (int)$assignmentsThisWeek,
        'announcements' => (int)$announcementsThisWeek,
        'resources'     => (int)$resourcesThisWeek,
    ],
    'class_performance'      => $classPerf,
    'top3_classes'           => $top3,
    'bottom3_classes'        => $bottom3,
    'active_teachers'        => $activeTeachers,
    'recent_activity'        => $recentActivity,
    'classes_need_attention' => array_values($needAttention),
    'incomplete_profiles'    => (int)$incompleteProfiles,
    'engagement_rate'        => $engagementRate,
    'engaged_learners'       => (int)$engagedLearners,
]);