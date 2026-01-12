<?php
session_start();
include("config.php");

if (!isset($_SESSION['email']) || $_SESSION['role'] !== 'teacher') {
    echo json_encode(['error' => 'Unauthorized']);
    exit();
}

$quiz_id = isset($_GET['quiz_id']) ? intval($_GET['quiz_id']) : 0;

// 1. Get Master Mapping from user_answers
$q_stmt = $conn->prepare("SELECT DISTINCT question_id FROM user_answers WHERE quiz_id = ? ORDER BY question_id ASC");
$q_stmt->bind_param("i", $quiz_id);
$q_stmt->execute();
$q_res = $q_stmt->get_result();

$master_map = [];
$count = 1;
while($q_row = $q_res->fetch_assoc()) {
    $master_map[$q_row['question_id']] = $count++;
}
$q_stmt->close();

// 2. Fetch Integrity Logs
$sql = "SELECT 
            u.name, u.surname, u.email,
            COUNT(l.id) as total_switches,
            MAX(l.layout_mode) as layout_used,
            GROUP_CONCAT(DISTINCT l.active_question_id) as problem_question_ids,
            MAX(l.occurred_at) as last_event 
        FROM users u
        INNER JOIN quiz_integrity_logs l ON u.email = l.user_email
        WHERE l.quiz_id = ?
        GROUP BY u.email
        ORDER BY total_switches DESC";

$stmt = $conn->prepare($sql);
$stmt->bind_param("i", $quiz_id);
$stmt->execute();
$result = $stmt->get_result();

$reportData = [];

while ($row = $result->fetch_assoc()) {
    $total = $row['total_switches'];
    $fullName = $row['name'] . ' ' . $row['surname'];
    $raw_ids = array_filter(explode(',', $row['problem_question_ids'] ?? '')); 

    $mapped_numbers = [];
    foreach ($raw_ids as $id) {
        if (isset($master_map[$id])) {
            $mapped_numbers[] = $master_map[$id];
        }
    }
    sort($mapped_numbers);
    $clean_questions = !empty($mapped_numbers) ? implode(', ', $mapped_numbers) : "N/A";

    // --- ENHANCED AI BEHAVIORAL ANALYSIS ---
    $behavior_note = "";
    
    // Scenario A: Frequent switches but no specific question IDs (N/A)
    if ($clean_questions === "N/A" && $total > 0) {
        $risk = "Low"; 
        $color = "#3498db"; // Blue for informational
        $behavior_note = "Activity occurred outside of the active question viewport (likely on the intro or submission screens). This suggests environmental setup rather than active cheating.";
    } 
    // Scenario B: Minor interruptions (1-3)
    elseif ($total <= 3) {
        $risk = "Low"; $color = "#22c55e";
        $behavior_note = "Minimal session interruptions detected. Likely accidental tab switches or system notifications.";
    } 
    // Scenario C: Moderate suspicious activity (4-10)
    elseif ($total <= 10) {
        $risk = "Medium"; $color = "#f39c12";
        $behavior_note = "Targeted interruptions. The learner exited the quiz environment $total times, specifically while focusing on Question(s): $clean_questions. Suggests potential external verification.";
    } 
    // Scenario D: Critical/High Risk
    else {
        $risk = ($total > 20) ? "Critical" : "High";
        $color = ($total > 20) ? "#f85149" : "#e67e22";
        $behavior_note = "High-risk pattern. Sustained and repeated navigation recorded on Question(s): $clean_questions. This behavior is strongly consistent with unauthorized resource usage.";
    }

    $final_narrative = "<strong>$fullName:</strong> $behavior_note";

    $reportData[] = [
        'name' => $fullName,
        'switches' => $total,
        'narrative' => $final_narrative,
        'risk' => $risk,
        'color' => $color,
        'problem_questions' => $clean_questions,
        'last_event_time' => !empty($row['last_event']) ? date("H:i", strtotime($row['last_event'])) : "N/A"
    ];
}

echo json_encode($reportData);