<?php
session_start();
include("config.php");

if (!isset($_SESSION['email']) || $_SESSION['role'] !== 'teacher') {
    echo json_encode(['error' => 'Unauthorized']);
    exit();
}

$quiz_id = isset($_GET['quiz_id']) ? intval($_GET['quiz_id']) : 0;

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

// Also get question text for richer narrative
$qt_stmt = $conn->prepare("
    SELECT id, question_text 
    FROM quizquestions 
    WHERE quiz_id = ?
");
$qt_stmt->bind_param("i", $quiz_id);
$qt_stmt->execute();
$qt_res = $qt_stmt->get_result();
$question_texts = [];
while ($qt_row = $qt_res->fetch_assoc()) {
    $question_texts[$qt_row['id']] = $qt_row['question_text'];
}
$qt_stmt->close();

// ── 2. Fetch logs per learner, per event type ─────────────────────────────
// Only multi_page logs are stored (enforced in log_integrity_event.php)
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

    // Map to question numbers, remove duplicates
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
        'count'    => (int)$row['event_count'],
        'questions' => $mapped,
    ];

    // Keep latest last_event across all event types
    if ($row['last_event'] > $learners[$email]['last_event']) {
        $learners[$email]['last_event'] = $row['last_event'];
    }
}
$stmt->close();

// ── 3. Helper: format question list naturally ──────────────────────────────
function formatQuestions(array $nums): string {
    if (empty($nums)) return '';
    if (count($nums) === 1) return 'Question ' . $nums[0];
    $last = array_pop($nums);
    return 'Questions ' . implode(', ', $nums) . ' and ' . $last;
}

// ── 4. Build report ───────────────────────────────────────────────────────
$reportData = [];

foreach ($learners as $email => $data) {
    $name      = $data['name'];
    $events    = $data['events'];

    $tab_count  = $events['tab_switch']['count']       ?? 0;
    $exit_count = $events['quiz_exit']['count']        ?? 0;
    $rapid_count= $events['rapid_navigation']['count'] ?? 0;
    $total      = $tab_count + $exit_count + $rapid_count;

    $tab_qs  = $events['tab_switch']['questions']       ?? [];
    $exit_qs = $events['quiz_exit']['questions']        ?? [];

    // ── Build natural narrative parts ──────────────────────────────────────
    $parts = [];

    if ($tab_count > 0) {
        $q_str = !empty($tab_qs) ? ' while on ' . formatQuestions($tab_qs) : '';
        $times = $tab_count === 1 ? 'once' : "$tab_count times";
        $parts[] = "switched tabs $times{$q_str}";
    }

    if ($exit_count > 0) {
        $q_str = !empty($exit_qs) ? ' during ' . formatQuestions($exit_qs) : '';
        $times = $exit_count === 1 ? 'once' : "$exit_count times";
        $parts[] = "left the quiz $times{$q_str}";
    }

    if ($rapid_count > 0) {
        $parts[] = "navigated through questions unusually fast ($rapid_count rapid moves)";
    }

    // ── Compose full narrative ─────────────────────────────────────────────
    if (empty($parts)) {
        continue; // No flagged events, skip this learner
    }

    $action_str = '';
    if (count($parts) === 1) {
        $action_str = $parts[0];
    } elseif (count($parts) === 2) {
        $action_str = $parts[0] . ', and ' . $parts[1];
    } else {
        $last = array_pop($parts);
        $action_str = implode(', ', $parts) . ', and ' . $last;
    }

    // ── Risk scoring ───────────────────────────────────────────────────────
    if ($total <= 2) {
        $risk  = 'Low';
        $color = '#22c55e';
        $prefix = "Minor irregularities noted.";
    } elseif ($total <= 6) {
        $risk  = 'Medium';
        $color = '#f39c12';
        $prefix = "Suspicious activity pattern detected.";
    } elseif ($total <= 15) {
        $risk  = 'High';
        $color = '#e67e22';
        $prefix = "Significant behavioral anomalies recorded.";
    } else {
        $risk  = 'Critical';
        $color = '#f85149';
        $prefix = "Severe integrity breach pattern identified.";
    }

    // ── Combine all flagged questions for display ──────────────────────────
    $all_flagged_qs = array_unique(array_merge($tab_qs, $exit_qs));
    sort($all_flagged_qs);
    $clean_questions = !empty($all_flagged_qs) ? implode(', ', $all_flagged_qs) : 'N/A';

    $narrative = "<strong>$name</strong> $action_str. $prefix";

    $reportData[] = [
        'name'             => $name,
        'switches'         => $total,
        'tab_switches'     => $tab_count,
        'quiz_exits'       => $exit_count,
        'rapid_moves'      => $rapid_count,
        'narrative'        => $narrative,
        'risk'             => $risk,
        'color'            => $color,
        'problem_questions'=> $clean_questions,
        'last_event_time'  => !empty($data['last_event'])
                                ? date("H:i", strtotime($data['last_event']))
                                : 'N/A',
        'layout_mode'      => 'multi_page',
    ];
}

// Sort by total events descending
usort($reportData, fn($a, $b) => $b['switches'] <=> $a['switches']);

echo json_encode($reportData);
?>