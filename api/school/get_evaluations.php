<?php
/**
 * iSkool School Dashboard — Get Evaluations API
 * Returns teacher evaluation results for admin view
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

// Score map: convert answer enum to numeric score
$scoreMap = [
    'strongly_agree'    => 5,
    'agree'             => 4,
    'neutral'           => 3,
    'disagree'          => 2,
    'strongly_disagree' => 1,
];

// ── Get all evaluations ──
$evalCond = $yearId ? "WHERE te.academic_year_id = $yearId" : "";
$evalRes  = $conn->query("
    SELECT te.id, te.title, te.description, te.term_number,
           te.is_active, te.created_at, te.created_by,
           u.name, u.surname,
           c.name class_name, c.id class_id
    FROM teacher_evaluations te
    JOIN users u ON u.email = te.created_by
    LEFT JOIN classes c ON c.id = te.class_id
    $evalCond
    ORDER BY te.created_at DESC
");

$evaluations = [];

while ($eval = $evalRes->fetch_assoc()) {
    $evalId = (int)$eval['id'];

    // Response count
    $responseCount = (int)$conn->query("
        SELECT COUNT(*) c FROM evaluation_responses WHERE evaluation_id = $evalId
    ")->fetch_assoc()['c'];

    if ($responseCount === 0) {
        // Still include it but with no data
        $evaluations[] = [
            'id'             => $evalId,
            'title'          => $eval['title'],
            'description'    => $eval['description'],
            'term'           => $eval['term_number'],
            'is_active'      => (bool)$eval['is_active'],
            'created_at'     => $eval['created_at'],
            'teacher_name'   => trim($eval['name'] . ' ' . $eval['surname']),
            'teacher_email'  => $eval['created_by'],
            'class_name'     => $eval['class_name'] ?? 'All Classes',
            'class_id'       => $eval['class_id'],
            'response_count' => 0,
            'overall_score'  => null,
            'statements'     => [],
            'comments'       => [],
        ];
        continue;
    }

    // ── Statements with average scores ──
    $stmtRes = $conn->query("
        SELECT es.id, es.statement, es.order_num,
               ea.answer
        FROM evaluation_statements es
        JOIN evaluation_answers ea ON ea.statement_id = es.id
        JOIN evaluation_responses er ON er.id = ea.response_id
        WHERE es.evaluation_id = $evalId
        ORDER BY es.order_num ASC
    ");

    $stmtData = []; // id => [statement, scores[], answers[]]
    while ($row = $stmtRes->fetch_assoc()) {
        $sid = $row['id'];
        if (!isset($stmtData[$sid])) {
            $stmtData[$sid] = [
                'statement' => $row['statement'],
                'scores'    => [],
                'answers'   => [
                    'strongly_agree'    => 0,
                    'agree'             => 0,
                    'neutral'           => 0,
                    'disagree'          => 0,
                    'strongly_disagree' => 0,
                ],
            ];
        }
        $stmtData[$sid]['scores'][] = $scoreMap[$row['answer']] ?? 3;
        if (isset($stmtData[$sid]['answers'][$row['answer']])) {
            $stmtData[$sid]['answers'][$row['answer']]++;
        }
    }

    $answerLabels = [
        'strongly_agree'    => ['label' => 'Strongly Agree',    'color' => '#22c55e'],
        'agree'             => ['label' => 'Agree',             'color' => '#4fd1c5'],
        'neutral'           => ['label' => 'Neutral',           'color' => '#f59e0b'],
        'disagree'          => ['label' => 'Disagree',          'color' => '#f85149'],
        'strongly_disagree' => ['label' => 'Strongly Disagree', 'color' => '#991b1b'],
    ];

    $statements  = [];
    $allScores   = [];
    foreach ($stmtData as $sid => $sdata) {
        $total = count($sdata['scores']);
        $avg   = $total ? round(array_sum($sdata['scores']) / $total, 1) : null;

        // Build breakdown with percentages
        $breakdown = [];
        foreach ($sdata['answers'] as $key => $count) {
            $breakdown[] = [
                'key'        => $key,
                'label'      => $answerLabels[$key]['label'],
                'color'      => $answerLabels[$key]['color'],
                'count'      => $count,
                'percentage' => $total > 0 ? round(($count / $total) * 100) : 0,
            ];
        }

        $statements[] = [
            'statement' => $sdata['statement'],
            'avg_score' => $avg,
            'count'     => $total,
            'breakdown' => $breakdown,
        ];
        if ($avg !== null) $allScores[] = $avg;
    }

    $overallScore = count($allScores) ? round(array_sum($allScores) / count($allScores), 1) : null;

    // ── Anonymous comments ──
    $commentsRes = $conn->query("
        SELECT comments, submitted_at
        FROM evaluation_responses
        WHERE evaluation_id = $evalId
        AND comments IS NOT NULL AND comments != ''
        ORDER BY submitted_at DESC
    ");
    $comments = [];
    while ($c = $commentsRes->fetch_assoc()) {
        $comments[] = ['text' => $c['comments'], 'submitted_at' => $c['submitted_at']];
    }

    $evaluations[] = [
        'id'             => $evalId,
        'title'          => $eval['title'],
        'description'    => $eval['description'],
        'term'           => $eval['term_number'],
        'is_active'      => (bool)$eval['is_active'],
        'created_at'     => $eval['created_at'],
        'teacher_name'   => trim($eval['name'] . ' ' . $eval['surname']),
        'teacher_email'  => $eval['created_by'],
        'class_name'     => $eval['class_name'] ?? 'All Classes',
        'class_id'       => $eval['class_id'],
        'response_count' => $responseCount,
        'overall_score'  => $overallScore,
        'statements'     => $statements,
        'comments'       => $comments,
    ];
}

// ── Filter options ──
$teachers = [];
$tRes = $conn->query("
    SELECT DISTINCT u.email, u.name, u.surname
    FROM teacher_evaluations te
    JOIN users u ON u.email = te.created_by
    ORDER BY u.surname ASC
");
while ($t = $tRes->fetch_assoc()) {
    $teachers[] = ['email' => $t['email'], 'name' => trim($t['name'] . ' ' . $t['surname'])];
}

$classes = [];
$cRes = $conn->query("SELECT id, name FROM classes ORDER BY name ASC");
while ($c = $cRes->fetch_assoc()) $classes[] = $c;

// ── Summary ──
$totalEvals     = count($evaluations);
$totalResponses = array_sum(array_column($evaluations, 'response_count'));
$withResponses  = count(array_filter($evaluations, fn($e) => $e['response_count'] > 0));
$allOverall     = array_filter(array_column($evaluations, 'overall_score'), fn($v) => $v !== null);
$schoolEvalAvg  = count($allOverall) ? round(array_sum($allOverall) / count($allOverall), 1) : null;

echo json_encode([
    'evaluations'     => $evaluations,
    'teachers'        => $teachers,
    'classes'         => $classes,
    'total_evals'     => $totalEvals,
    'total_responses' => $totalResponses,
    'with_responses'  => $withResponses,
    'school_eval_avg' => $schoolEvalAvg,
]);