<?php
session_start();
include("config.php");

if (!isset($_SESSION['email']) || $_SESSION['role'] !== 'teacher') {
    echo json_encode(['error' => 'Unauthorized']);
    exit();
}

$quiz_id = isset($_GET['quiz_id']) ? intval($_GET['quiz_id']) : 0;

// This query gets the counts and the student names
$sql = "SELECT 
            u.name, 
            u.surname, 
            COUNT(l.id) as total_switches,
            SUM(CASE WHEN l.event_type = 'tab_hidden' THEN 1 ELSE 0 END) as hidden_count,
            SUM(CASE WHEN l.event_type = 'window_blur' THEN 1 ELSE 0 END) as blur_count
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
    $hidden = $row['hidden_count'];
    $blur = $row['blur_count'];
    $fullName = $row['name'] . ' ' . $row['surname'];

    // --- THE AI NARRATIVE ENGINE ---
    if ($total <= 2) {
        $narrative = "{$fullName} had {$total} interruption. Likely a system notification or accidental click.";
        $risk = "Low Risk";
        $color = "#2ecc71";
    } elseif ($total <= 7) {
        $narrative = "{$fullName} had {$total} interruptions. The screen was hidden {$hidden} times and the tab was left {$blur} times. Moderate risk.";
        $risk = "Medium Risk";
        $color = "#f39c12";
    } elseif ($total <= 10) {
        // Your Zinhle Mkhathini example
        $narrative = "{$fullName} had {$total} interruptions. The screen was hidden {$hidden} times and the tab was left {$blur} times. This frequency suggests a high risk of cheating.";
        $risk = "High Risk";
        $color = "#e67e22";
    } else {
        $narrative = "{$fullName} had {$total} interruptions across almost every question. Frequent tab switching detected.";
        $risk = "Critical";
        $color = "#e74c3c";
    }

    $reportData[] = [
        'name' => $fullName,
        'switches' => $total,
        'narrative' => $narrative,
        'risk' => $risk,
        'color' => $color
    ];
}

echo json_encode($reportData);