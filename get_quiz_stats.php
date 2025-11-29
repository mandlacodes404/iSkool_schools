<?php
include 'config.php';

$quiz_id = intval($_GET['quiz_id']);
$user_email = $_GET['user_email'];

// Get user’s score
$user = $conn->query("SELECT score, total FROM quiz_results WHERE quiz_id=$quiz_id AND user_email='$user_email' ORDER BY submitted_at DESC LIMIT 1");
$user_data = $user->fetch_assoc();
$user_score = $user_data['score'];
$total = $user_data['total'];

// Class stats
$stats = $conn->query("
  SELECT 
    MIN(score) AS min_score,
    MAX(score) AS max_score,
    AVG(score) AS avg_score
  FROM quiz_results
  WHERE quiz_id = $quiz_id
");
$row = $stats->fetch_assoc();

$response = [
  'user_score' => $user_score,
  'total' => $total,
  'min' => (int)$row['min_score'],
  'max' => (int)$row['max_score'],
  'avg' => round($row['avg_score'], 1)
];

echo json_encode($response);
?>
