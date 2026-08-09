<?php
require_once __DIR__ . '/../../auth/session_guard.php';
require_once dirname(__DIR__, 2) . '/config.php';

header('Content-Type: application/json');

if (!isset($_SESSION['email']) || $_SESSION['role'] !== 'teacher') {
    echo json_encode(['error' => 'Unauthorized']);
    exit();
}

$teacher_email = $_SESSION['email'];

$current_year = $conn->query("SELECT id FROM academic_years WHERE is_current = 1 LIMIT 1")->fetch_assoc();
if (!$current_year) {
    echo json_encode(['error' => 'No active academic year']);
    exit();
}
$current_year_id = (int)$current_year['id'];

$stmt = $conn->prepare("
    SELECT te.id, te.title, te.description, te.created_at,
           c.name AS class_name,
           COUNT(er.id) AS response_count
    FROM teacher_evaluations te
    JOIN classes c ON te.class_id = c.id
    LEFT JOIN evaluation_responses er ON te.id = er.evaluation_id
    WHERE te.created_by = ?
      AND te.academic_year_id = ?
    GROUP BY te.id
    ORDER BY c.name, te.created_at DESC
");
$stmt->bind_param("si", $teacher_email, $current_year_id);
$stmt->execute();
$evaluations = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
$stmt->close();

$grouped = [];

foreach ($evaluations as $eval) {
    $eval_id = $eval['id'];

    // Get statements
    $statements = [];
    $stmtQ = $conn->prepare("
        SELECT id, statement 
        FROM evaluation_statements 
        WHERE evaluation_id = ? 
        ORDER BY order_num
    ");
    $stmtQ->bind_param("i", $eval_id);
    $stmtQ->execute();
    $stmtResults = $stmtQ->get_result()->fetch_all(MYSQLI_ASSOC);
    $stmtQ->close();

    foreach ($stmtResults as $s) {
        $stmt_id = $s['id'];

        // Get answer counts
        $answerStmt = $conn->prepare("
            SELECT answer, COUNT(*) as cnt 
            FROM evaluation_answers 
            WHERE statement_id = ? 
            GROUP BY answer
        ");
        $answerStmt->bind_param("i", $stmt_id);
        $answerStmt->execute();
        $answerRows = $answerStmt->get_result()->fetch_all(MYSQLI_ASSOC);
        $answerStmt->close();

        $options = [
            'strongly_agree'    => 0,
            'agree'             => 0,
            'neutral'           => 0,
            'disagree'          => 0,
            'strongly_disagree' => 0
        ];
        foreach ($answerRows as $a) {
            if (isset($options[$a['answer']])) {
                $options[$a['answer']] = (int)$a['cnt'];
            }
        }

        $total = array_sum($options) ?: 1;
        $breakdown = [];
        $labels = [
            'strongly_agree'    => 'Strongly Agree',
            'agree'             => 'Agree',
            'neutral'           => 'Neutral',
            'disagree'          => 'Disagree',
            'strongly_disagree' => 'Strongly Disagree'
        ];
        $colors = [
            'strongly_agree'    => '#1ed760',
            'agree'             => '#4fd1c5',
            'neutral'           => '#ffd43b',
            'disagree'          => '#f85149',
            'strongly_disagree' => '#e74c3c'
        ];

        foreach ($options as $key => $val) {
            $breakdown[] = [
                'label'      => $labels[$key],
                'color'      => $colors[$key],
                'count'      => $val,
                'percentage' => round(($val / $total) * 100)
            ];
        }

        $statements[] = [
            'statement' => $s['statement'],
            'breakdown' => $breakdown
        ];
    }

    // Get comments
    $commentStmt = $conn->prepare("
        SELECT comments 
        FROM evaluation_responses 
        WHERE evaluation_id = ? AND comments != '' 
        ORDER BY submitted_at DESC
    ");
    $commentStmt->bind_param("i", $eval_id);
    $commentStmt->execute();
    $comments = array_column(
        $commentStmt->get_result()->fetch_all(MYSQLI_ASSOC),
        'comments'
    );
    $commentStmt->close();

    $class_name = $eval['class_name'];
    if (!isset($grouped[$class_name])) {
        $grouped[$class_name] = [];
    }

    $grouped[$class_name][] = [
        'id'             => (int)$eval['id'],
        'title'          => $eval['title'],
        'description'    => $eval['description'],
        'response_count' => (int)$eval['response_count'],
        'statements'     => $statements,
        'comments'       => $comments
    ];
}

echo json_encode(array_map(function($class_name, $evals) {
    return ['class_name' => $class_name, 'evaluations' => $evals];
}, array_keys($grouped), array_values($grouped)));