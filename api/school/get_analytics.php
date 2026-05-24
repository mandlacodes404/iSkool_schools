<?php
/**
 * iSkool School Dashboard — Analytics API
 * World-class data center: trends, health, risk, difficulty, engagement
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

// ── Current academic year ──
$yearId   = 0;
$yearName = 'Current Year';
$res = $conn->query("SELECT id, name FROM academic_years WHERE is_current = 1 LIMIT 1");
if ($row = $res->fetch_assoc()) { $yearId = $row['id']; $yearName = $row['name']; }
$yearCond      = $yearId ? "AND qr.academic_year_id = $yearId" : "";
$yearCondPlain = $yearId ? "AND academic_year_id = $yearId" : "";

// ══════════════════════════════════════════════════════════
// 1. TERM AVERAGES — only terms that have data
// ══════════════════════════════════════════════════════════
$termAverages = [];
for ($t = 1; $t <= 4; $t++) {
    $r = $conn->query("
        SELECT ROUND(AVG(qr.score / qr.total * 100), 1) avg,
               COUNT(DISTINCT qr.user_email) learners,
               COUNT(*) submissions
        FROM quiz_results qr
        JOIN quizzes q ON qr.quiz_id = q.id
        WHERE q.is_summative = 1 AND q.term_number = $t $yearCond
    ")->fetch_assoc();
    if ((int)$r['submissions'] > 0) {
        $termAverages[] = [
            'term'        => $t,
            'avg'         => $r['avg'],
            'learners'    => (int)$r['learners'],
            'submissions' => (int)$r['submissions'],
        ];
    }
}

// ══════════════════════════════════════════════════════════
// 2. SUMMARY KPIs
// ══════════════════════════════════════════════════════════
$totalLearners    = (int)$conn->query("SELECT COUNT(*) c FROM users WHERE role='learner' AND is_deleted=0")->fetch_assoc()['c'];
$totalTeachers    = (int)$conn->query("SELECT COUNT(*) c FROM users WHERE role='teacher' AND is_deleted=0")->fetch_assoc()['c'];
$totalClasses     = (int)$conn->query("SELECT COUNT(*) c FROM classes")->fetch_assoc()['c'];
$schoolOverallAvg = $conn->query("
    SELECT ROUND(AVG(qr.score / qr.total * 100), 1) avg
    FROM quiz_results qr JOIN quizzes q ON qr.quiz_id = q.id
    WHERE q.is_summative = 1 $yearCond
")->fetch_assoc()['avg'];

// Pass rate
$prRes = $conn->query("
    SELECT COUNT(DISTINCT CASE WHEN learner_avg >= 50 THEN user_email END) passed,
           COUNT(DISTINCT user_email) total
    FROM (
        SELECT qr.user_email, ROUND(AVG(qr.score / qr.total * 100), 1) learner_avg
        FROM quiz_results qr JOIN quizzes q ON qr.quiz_id = q.id
        WHERE q.is_summative = 1 $yearCond GROUP BY qr.user_email
    ) sub
")->fetch_assoc();
$passRate         = ($prRes['total'] > 0) ? round($prRes['passed'] / $prRes['total'] * 100, 1) : null;
$assessedLearners = (int)$prRes['total'];

// ══════════════════════════════════════════════════════════
// 3. AT-RISK LEARNERS — composite risk score
// ══════════════════════════════════════════════════════════
$threeWeeksAgo  = date('Y-m-d H:i:s', strtotime('-21 days'));
$atRiskRes = $conn->query("
    SELECT u.email, u.name, u.surname,
           ROUND(AVG(qr.score / qr.total * 100), 1) avg_pct,
           COUNT(qr.id) submissions,
           MAX(qr.submitted_at) last_submission,
           GROUP_CONCAT(DISTINCT c.name ORDER BY c.name SEPARATOR ', ') class_names
    FROM users u
    JOIN quiz_results qr ON qr.user_email = u.email
    JOIN quizzes q ON qr.quiz_id = q.id
    LEFT JOIN class_students cs ON cs.student_email = u.email " . ($yearId ? "AND cs.academic_year_id = $yearId" : "") . "
    LEFT JOIN classes c ON c.id = cs.class_id
    WHERE u.role = 'learner' AND u.is_deleted = 0 AND q.is_summative = 1 $yearCond
    GROUP BY u.email, u.name, u.surname
    HAVING avg_pct < 50 AND (MAX(qr.submitted_at) < '$threeWeeksAgo' OR COUNT(qr.id) < 2)
    ORDER BY avg_pct ASC LIMIT 20
");
$atRiskLearners = [];
while ($r = $atRiskRes->fetch_assoc()) {
    $markScore    = max(0, 100 - ($r['avg_pct'] * 2));
    $daysSince    = $r['last_submission'] ? floor((time() - strtotime($r['last_submission'])) / 86400) : 60;
    $recencyScore = min(100, $daysSince * 2);
    $riskScore    = round(($markScore * 0.6) + ($recencyScore * 0.4));
    $atRiskLearners[] = [
        'name'            => trim($r['name'] . ' ' . $r['surname']),
        'email'           => $r['email'],
        'avg_pct'         => $r['avg_pct'],
        'submissions'     => (int)$r['submissions'],
        'last_submission' => $r['last_submission'],
        'classes'         => $r['class_names'] ?: '—',
        'risk_score'      => $riskScore,
    ];
}
usort($atRiskLearners, fn($a, $b) => $b['risk_score'] <=> $a['risk_score']);
$atRiskCount = count($atRiskLearners);

// ══════════════════════════════════════════════════════════
// 4. CLASS HEALTH INDEX
// ══════════════════════════════════════════════════════════
$classHealth = [];
$classRes    = $conn->query("SELECT id, name FROM classes ORDER BY name ASC");
while ($cls = $classRes->fetch_assoc()) {
    $cid      = (int)$cls['id'];
    $enrolled = (int)$conn->query("
        SELECT COUNT(DISTINCT student_email) c FROM class_students
        WHERE class_id = $cid " . ($yearId ? "AND academic_year_id = $yearId" : "") . "
    ")->fetch_assoc()['c'];

    $allAvgs = [];
    $terms   = [];
    for ($t = 1; $t <= 4; $t++) {
        $r = $conn->query("
            SELECT ROUND(AVG(qr.score / qr.total * 100), 1) avg
            FROM quiz_results qr JOIN quizzes q ON qr.quiz_id = q.id
            WHERE q.class_id = $cid AND q.is_summative = 1 AND q.term_number = $t $yearCond
        ")->fetch_assoc();
        $terms[$t] = $r['avg'];
        if ($r['avg'] !== null) $allAvgs[] = floatval($r['avg']);
    }
    $overallAvg = count($allAvgs) ? round(array_sum($allAvgs) / count($allAvgs), 1) : null;

    $submitted = (int)$conn->query("
        SELECT COUNT(DISTINCT qr.user_email) c
        FROM quiz_results qr JOIN quizzes q ON qr.quiz_id = q.id
        WHERE q.class_id = $cid AND q.is_summative = 1 $yearCond
    ")->fetch_assoc()['c'];
    $submissionRate = ($enrolled > 0) ? round($submitted / $enrolled * 100, 1) : 0;

    $teacherActivity = (int)$conn->query("
        SELECT (
            (SELECT COUNT(*) FROM quizzes WHERE class_id=$cid $yearCondPlain) +
            (SELECT COUNT(*) FROM assignments WHERE class_id=$cid $yearCondPlain) +
            (SELECT COUNT(*) FROM resources WHERE class_id=$cid $yearCondPlain) +
            (SELECT COUNT(*) FROM announcements WHERE class_id=$cid $yearCondPlain)
        ) total
    ")->fetch_assoc()['total'];

    $summativeCount = (int)$conn->query("
        SELECT COUNT(*) c FROM quizzes WHERE class_id=$cid AND is_summative=1 $yearCondPlain
    ")->fetch_assoc()['c'];

    $healthScore = round(
        ($overallAvg !== null ? $overallAvg * 0.4 : 0) +
        ($submissionRate * 0.3) +
        (min(100, $teacherActivity * 10) * 0.2) +
        ($summativeCount > 0 ? 10 : 0)
    );

    $classHealth[] = [
        'class_id'        => $cid,
        'class_name'      => $cls['name'],
        'enrolled'        => $enrolled,
        'overall_avg'     => $overallAvg,
        'terms'           => $terms,
        'submission_rate' => $submissionRate,
        'submitted'       => $submitted,
        'teacher_activity'=> $teacherActivity,
        'summative_count' => $summativeCount,
        'health_score'    => $healthScore,
    ];
}
usort($classHealth, fn($a, $b) => $b['health_score'] <=> $a['health_score']);

$classesWithSummative = count(array_filter($classHealth, fn($c) => $c['summative_count'] > 0));
$assessmentCoverage   = $totalClasses > 0 ? round($classesWithSummative / $totalClasses * 100, 1) : 0;

// ══════════════════════════════════════════════════════════
// 5. ASSESSMENT DIFFICULTY INDEX
// ══════════════════════════════════════════════════════════
$diffRes = $conn->query("
    SELECT q.id, q.title, q.term_number, c.name class_name,
           ROUND(AVG(qr.score / qr.total * 100), 1) avg_pct,
           COUNT(DISTINCT qr.user_email) submissions,
           ROUND(MIN(qr.score / qr.total * 100), 1) lowest,
           ROUND(MAX(qr.score / qr.total * 100), 1) highest
    FROM quizzes q
    JOIN quiz_results qr ON qr.quiz_id = q.id
    JOIN classes c ON c.id = q.class_id
    WHERE q.is_summative = 1 $yearCond
    GROUP BY q.id, q.title, q.term_number, c.name
    HAVING avg_pct < 50 AND COUNT(DISTINCT qr.user_email) >= 3
    ORDER BY avg_pct ASC LIMIT 10
");
$difficultyIndex = [];
while ($r = $diffRes->fetch_assoc()) {
    $difficultyIndex[] = [
        'quiz_id'     => (int)$r['id'],
        'title'       => $r['title'],
        'term'        => (int)$r['term_number'],
        'class'       => $r['class_name'],
        'avg_pct'     => $r['avg_pct'],
        'submissions' => (int)$r['submissions'],
        'lowest'      => $r['lowest'],
        'highest'     => $r['highest'],
    ];
}

// ══════════════════════════════════════════════════════════
// 6. SUBJECT PERFORMANCE — only properly named subjects
// ══════════════════════════════════════════════════════════
$subjectMap = [];
$subRes = $conn->query("
    SELECT ts.subject_name, ts.class_id, ts.teacher_email
    FROM teacher_subjects ts
    WHERE ts.subject_name IS NOT NULL AND ts.subject_name != ''
");
while ($ts = $subRes->fetch_assoc()) {
    $name    = $ts['subject_name'];
    $classId = (int)$ts['class_id'];
    $email   = $conn->real_escape_string($ts['teacher_email']);

    $avgRes = $conn->query("
        SELECT ROUND(AVG(qr.score / qr.total * 100), 1) avg,
               COUNT(DISTINCT qr.user_email) learners, COUNT(*) submissions
        FROM quiz_results qr JOIN quizzes q ON qr.quiz_id = q.id
        WHERE q.created_by = '$email' AND q.class_id = $classId AND q.is_summative = 1 $yearCond
    ")->fetch_assoc();
    if ($avgRes['avg'] === null || $avgRes['submissions'] == 0) continue;

    $termData = [];
    for ($t = 1; $t <= 4; $t++) {
        $tr = $conn->query("
            SELECT ROUND(AVG(qr.score / qr.total * 100), 1) avg
            FROM quiz_results qr JOIN quizzes q ON qr.quiz_id = q.id
            WHERE q.created_by='$email' AND q.class_id=$classId
            AND q.is_summative=1 AND q.term_number=$t $yearCond
        ")->fetch_assoc();
        if ($tr['avg'] !== null) $termData[$t] = floatval($tr['avg']);
    }

    if (!isset($subjectMap[$name])) $subjectMap[$name] = ['avgs'=>[],'learners'=>0,'submissions'=>0,'terms'=>[]];
    $subjectMap[$name]['avgs'][]       = floatval($avgRes['avg']);
    $subjectMap[$name]['learners']    += (int)$avgRes['learners'];
    $subjectMap[$name]['submissions'] += (int)$avgRes['submissions'];
    foreach ($termData as $t => $v) $subjectMap[$name]['terms'][$t][] = $v;
}

$subjectPerf = [];
foreach ($subjectMap as $name => $data) {
    $avg      = count($data['avgs']) ? round(array_sum($data['avgs']) / count($data['avgs']), 1) : null;
    $termAvgs = [];
    foreach ($data['terms'] as $t => $vals) $termAvgs[$t] = round(array_sum($vals) / count($vals), 1);
    ksort($termAvgs);
    $keys  = array_keys($termAvgs);
    $trend = count($keys) >= 2 ? round($termAvgs[end($keys)] - $termAvgs[$keys[count($keys)-2]], 1) : null;
    $subjectPerf[] = ['subject'=>$name,'avg'=>$avg,'learners'=>$data['learners'],'submissions'=>$data['submissions'],'term_avgs'=>$termAvgs,'trend'=>$trend];
}
usort($subjectPerf, fn($a,$b) => ($b['avg']??-1)<=>($a['avg']??-1));

// ══════════════════════════════════════════════════════════
// 7. GENDER BREAKDOWN
// ══════════════════════════════════════════════════════════
$genderBreakdown = [];
foreach (['male','female'] as $gender) {
    $g = $conn->real_escape_string($gender);
    $termData = [];
    for ($t = 1; $t <= 4; $t++) {
        $r = $conn->query("
            SELECT ROUND(AVG(qr.score/qr.total*100),1) avg, COUNT(DISTINCT qr.user_email) learners
            FROM quiz_results qr JOIN quizzes q ON qr.quiz_id=q.id JOIN users u ON u.email=qr.user_email
            WHERE q.is_summative=1 AND q.term_number=$t AND u.gender='$g' $yearCond
        ")->fetch_assoc();
        if ($r['avg'] !== null) $termData[$t] = ['avg'=>$r['avg'],'learners'=>(int)$r['learners']];
    }
    $overall = $conn->query("
        SELECT ROUND(AVG(qr.score/qr.total*100),1) avg, COUNT(DISTINCT qr.user_email) learners
        FROM quiz_results qr JOIN quizzes q ON qr.quiz_id=q.id JOIN users u ON u.email=qr.user_email
        WHERE q.is_summative=1 AND u.gender='$g' $yearCond
    ")->fetch_assoc();
    $genderBreakdown[$gender] = ['terms'=>$termData,'overall'=>$overall['avg'],'learners'=>(int)$overall['learners']];
}

// ══════════════════════════════════════════════════════════
// 8. TOP PERFORMERS
// ══════════════════════════════════════════════════════════
$topPerformers = [];
$topRes = $conn->query("
    SELECT qr.user_email, u.name, u.surname, u.gender,
           GROUP_CONCAT(DISTINCT c.name ORDER BY c.name SEPARATOR ', ') class_names,
           ROUND(AVG(qr.score/qr.total*100),1) avg_pct, COUNT(*) submissions
    FROM quiz_results qr JOIN quizzes q ON qr.quiz_id=q.id JOIN users u ON u.email=qr.user_email
    LEFT JOIN class_students cs ON cs.student_email=qr.user_email " . ($yearId?"AND cs.academic_year_id=$yearId":"") . "
    LEFT JOIN classes c ON c.id=cs.class_id
    WHERE q.is_summative=1 AND u.role='learner' $yearCond
    GROUP BY qr.user_email HAVING COUNT(*)>=1 ORDER BY avg_pct DESC LIMIT 10
");
while ($r = $topRes->fetch_assoc()) {
    $topPerformers[] = ['name'=>trim($r['name'].' '.$r['surname']),'email'=>$r['user_email'],'gender'=>$r['gender'],'classes'=>$r['class_names']?:'—','avg'=>$r['avg_pct'],'submissions'=>(int)$r['submissions']];
}

// ══════════════════════════════════════════════════════════
// 9. MOST IMPROVED
// ══════════════════════════════════════════════════════════
$mostImproved = [];
$miRes = $conn->query("
    SELECT qr.user_email, u.name, u.surname, q.term_number,
           ROUND(AVG(qr.score/qr.total*100),1) avg_pct
    FROM quiz_results qr JOIN quizzes q ON qr.quiz_id=q.id JOIN users u ON u.email=qr.user_email
    WHERE q.is_summative=1 AND u.role='learner' $yearCond
    GROUP BY qr.user_email, q.term_number ORDER BY qr.user_email, q.term_number
");
$lt = [];
while ($r = $miRes->fetch_assoc()) {
    $e = $r['user_email'];
    if (!isset($lt[$e])) $lt[$e] = ['name'=>trim($r['name'].' '.$r['surname']),'terms'=>[]];
    $lt[$e]['terms'][$r['term_number']] = floatval($r['avg_pct']);
}
foreach ($lt as $email => $data) {
    $terms=$data['terms']; $maxJump=null; $from=null; $to=null;
    for ($t=1;$t<=3;$t++) {
        if (isset($terms[$t]) && isset($terms[$t+1])) {
            $jump=$terms[$t+1]-$terms[$t];
            if ($maxJump===null||$jump>$maxJump) { $maxJump=$jump; $from=$t; $to=$t+1; }
        }
    }
    if ($maxJump!==null && $maxJump>0) {
        $mostImproved[]=['name'=>$data['name'],'email'=>$email,'from_term'=>$from,'to_term'=>$to,'from_avg'=>$terms[$from],'to_avg'=>$terms[$to],'jump'=>round($maxJump,1)];
    }
}
usort($mostImproved,fn($a,$b)=>$b['jump']<=>$a['jump']);
$mostImproved=array_slice($mostImproved,0,10);

// ══════════════════════════════════════════════════════════
// 10. PEAK ACTIVITY HOURS
// ══════════════════════════════════════════════════════════
$peakHours = array_fill(0,24,0);
$hrRes = $conn->query("
    SELECT HOUR(qr.submitted_at) hr, COUNT(*) c
    FROM quiz_results qr JOIN quizzes q ON qr.quiz_id=q.id
    WHERE q.is_summative=1 $yearCond GROUP BY HOUR(qr.submitted_at)
");
while ($r=$hrRes->fetch_assoc()) $peakHours[(int)$r['hr']]+=(int)$r['c'];
$subHrRes=$conn->query("SELECT HOUR(submitted_at) hr, COUNT(*) c FROM submissions GROUP BY HOUR(submitted_at)");
while ($r=$subHrRes->fetch_assoc()) $peakHours[(int)$r['hr']]+=(int)$r['c'];

$peakHoursFormatted=[];
for ($h=0;$h<24;$h++) {
    $label=$h===0?'12am':($h<12?$h.'am':($h===12?'12pm':($h-12).'pm'));
    $peakHoursFormatted[]=['hour'=>$h,'label'=>$label,'count'=>$peakHours[$h]];
}

// ══════════════════════════════════════════════════════════
// 11. TEACHER PARTICIPATION
// ══════════════════════════════════════════════════════════
$teacherParticipation=[];
$fullyActive=$partlyActive=$inactive=0;
$tpRes=$conn->query("
    SELECT u.email, u.name, u.surname,
        (SELECT COUNT(*) FROM quizzes WHERE created_by=u.email $yearCondPlain) quizzes,
        (SELECT COUNT(*) FROM assignments WHERE created_by=u.email $yearCondPlain) assignments,
        (SELECT COUNT(*) FROM resources WHERE uploaded_by=u.email $yearCondPlain) resources,
        (SELECT COUNT(*) FROM announcements WHERE created_by=u.email $yearCondPlain) announcements
    FROM users u WHERE u.role='teacher' AND u.is_deleted=0
");
while ($r=$tpRes->fetch_assoc()) {
    $total=$r['quizzes']+$r['assignments']+$r['resources']+$r['announcements'];
    if ($r['quizzes']>0&&$r['assignments']>0&&$r['resources']>0) { $status='full'; $fullyActive++; }
    elseif ($total>0) { $status='partial'; $partlyActive++; }
    else { $status='inactive'; $inactive++; }
    $teacherParticipation[]=['name'=>trim($r['name'].' '.$r['surname']),'email'=>$r['email'],'quizzes'=>(int)$r['quizzes'],'assignments'=>(int)$r['assignments'],'resources'=>(int)$r['resources'],'announcements'=>(int)$r['announcements'],'total'=>$total,'status'=>$status];
}
usort($teacherParticipation,fn($a,$b)=>$b['total']<=>$a['total']);
$teacherParticipationRate=$totalTeachers>0?round($fullyActive/$totalTeachers*100,1):0;

// ══════════════════════════════════════════════════════════
// RESPOND
// ══════════════════════════════════════════════════════════
echo json_encode([
    'year_name'                  => $yearName,
    'total_learners'             => $totalLearners,
    'total_teachers'             => $totalTeachers,
    'total_classes'              => $totalClasses,
    'school_overall_avg'         => $schoolOverallAvg,
    'pass_rate'                  => $passRate,
    'assessed_learners'          => $assessedLearners,
    'at_risk_count'              => $atRiskCount,
    'at_risk_learners'           => $atRiskLearners,
    'assessment_coverage'        => $assessmentCoverage,
    'teacher_participation_rate' => $teacherParticipationRate,
    'teacher_participation'      => $teacherParticipation,
    'term_averages'              => $termAverages,
    'class_health'               => $classHealth,
    'subject_performance'        => $subjectPerf,
    'gender_breakdown'           => $genderBreakdown,
    'top_performers'             => $topPerformers,
    'most_improved'              => $mostImproved,
    'difficulty_index'           => $difficultyIndex,
    'peak_hours'                 => $peakHoursFormatted,
    'teacher_participation_list' => $teacherParticipation,
]);