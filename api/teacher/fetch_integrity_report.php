<?php
require_once __DIR__ . '/../../auth/session_guard.php';
require_once dirname(__DIR__, 2) . '/config.php';

header('Content-Type: application/json');

if (!isset($_SESSION['email']) || $_SESSION['role'] !== 'teacher') {
    echo json_encode(['error' => 'Unauthorized']);
    exit();
}

$quiz_id = isset($_GET['quiz_id']) ? intval($_GET['quiz_id']) : 0;

$ownerStmt = $conn->prepare("SELECT id FROM quizzes WHERE id = ? AND created_by = ? LIMIT 1");
$ownerStmt->bind_param("is", $quiz_id, $_SESSION['email']);
$ownerStmt->execute();
$ownsQuiz = $ownerStmt->get_result()->num_rows > 0;
$ownerStmt->close();
if (!$ownsQuiz) {
    http_response_code(403);
    echo json_encode(['error' => 'Quiz not found']);
    exit();
}

// ── 1. Build master question number map from user_answers ─────────────────
$q_stmt = $conn->prepare("
    SELECT DISTINCT question_id 
    FROM user_answers 
    WHERE quiz_id = ? 
    ORDER BY question_id ASC
");
$q_stmt->bind_param("i", $quiz_id);
$q_stmt->execute();
$q_res = $q_stmt->get_result();
$master_map = [];
$count = 1;
while ($q_row = $q_res->fetch_assoc()) {
    $master_map[$q_row['question_id']] = $count++;
}
$q_stmt->close();

// ── 2. Fetch logs per learner, per event type ─────────────────────────────
$sql = "
    SELECT 
        u.name, u.surname, u.email,
        l.event_type,
        GROUP_CONCAT(l.active_question_id ORDER BY l.occurred_at ASC) AS question_ids,
        COUNT(l.id) AS event_count,
        MAX(l.occurred_at) AS last_event
    FROM users u
    INNER JOIN quiz_integrity_logs l ON u.email = l.user_email
    WHERE l.quiz_id = ? AND l.layout_mode = 'multi_page'
    GROUP BY u.email, l.event_type
    ORDER BY u.email, l.event_type
";

$stmt = $conn->prepare($sql);
$stmt->bind_param("i", $quiz_id);
$stmt->execute();
$result = $stmt->get_result();

// Group by learner
$learners = [];
while ($row = $result->fetch_assoc()) {
    $email = $row['email'];
    if (!isset($learners[$email])) {
        $learners[$email] = [
            'name'       => $row['name'] . ' ' . $row['surname'],
            'events'     => [],
            'last_event' => $row['last_event'],
        ];
    }

    $raw_ids = array_filter(explode(',', $row['question_ids'] ?? ''));

    $mapped = [];
    foreach ($raw_ids as $qid) {
        $qid = trim($qid);
        if (isset($master_map[$qid])) {
            $num = $master_map[$qid];
            if (!in_array($num, $mapped)) $mapped[] = $num;
        }
    }
    sort($mapped);

    $learners[$email]['events'][$row['event_type']] = [
        'count'     => (int)$row['event_count'],
        'questions' => $mapped,
    ];

    if ($row['last_event'] > $learners[$email]['last_event']) {
        $learners[$email]['last_event'] = $row['last_event'];
    }
}
$stmt->close();

// ── 3. Build report ───────────────────────────────────────────────────────
$reportData = [];

foreach ($learners as $email => $data) {
    $name        = $data['name'];
    $events      = $data['events'];

    $tab_qs      = $events['tab_switch']['questions']        ?? [];
    $exit_qs     = $events['quiz_exit']['questions']         ?? [];
    $rapid_count = $events['rapid_navigation']['count']      ?? 0;

    // Merge tab switches and exits — both mean left the quiz environment
    $all_interruption_qs = array_unique(array_merge($tab_qs, $exit_qs));
    sort($all_interruption_qs);

    $total = count($all_interruption_qs) + $rapid_count;

    // ── Skip if nothing to report ─────────────────────────────────────────
    if (empty($all_interruption_qs) && $rapid_count === 0) {
        continue;
    }

    // ── Build simple, precise narrative ───────────────────────────────────
    $firstName = explode(' ', $name)[0];
    $sentences = [];

    foreach ($all_interruption_qs as $qNum) {
        $sentences[] = "$firstName left the quiz environment whilst on Question $qNum.";
    }

    if ($rapid_count > 0) {
        $sentences[] = "$firstName navigated through questions unusually fast.";
    }

    $narrative = "<strong>$name:</strong> " . implode(' ', $sentences);

    // ── Risk scoring ───────────────────────────────────────────────────────
    if ($total <= 2) {
        $risk  = 'Low';
        $color = '#22c55e';
    } elseif ($total <= 6) {
        $risk  = 'Medium';
        $color = '#f39c12';
    } elseif ($total <= 15) {
        $risk  = 'High';
        $color = '#e67e22';
    } else {
        $risk  = 'Critical';
        $color = '#f85149';
    }

    $clean_questions = !empty($all_interruption_qs) ? implode(', ', $all_interruption_qs) : 'N/A';

    $tab_count  = $events['tab_switch']['count']  ?? 0;
    $exit_count = $events['quiz_exit']['count']   ?? 0;

    $reportData[] = [
        'name'              => $name,
        'switches'          => $total,
        'tab_switches'      => $tab_count,
        'quiz_exits'        => $exit_count,
        'rapid_moves'       => $rapid_count,
        'narrative'         => $narrative,
        'risk'              => $risk,
        'color'             => $color,
        'problem_questions' => $clean_questions,
        'last_event_time'   => !empty($data['last_event'])
                                ? date("H:i", strtotime($data['last_event']))
                                : 'N/A',
        'layout_mode'       => 'multi_page',
    ];
}

// Sort by total events descending
usort($reportData, fn($a, $b) => $b['switches'] <=> $a['switches']);

echo json_encode($reportData);
?>
