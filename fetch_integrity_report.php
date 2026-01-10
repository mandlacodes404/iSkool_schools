<?php
session_start();
include("config.php");

$quiz_id = intval($_GET['quiz_id'] ?? 0);

$sql = "SELECT u.name, u.surname, COUNT(log.id) as switches 
        FROM quiz_integrity_logs log
        JOIN users u ON log.user_email = u.email
        WHERE log.quiz_id = ?
        GROUP BY log.user_email
        ORDER BY switches DESC";

$stmt = $conn->prepare($sql);
$stmt->bind_param("i", $quiz_id);
$stmt->execute();
echo json_encode($stmt->get_result()->fetch_all(MYSQLI_ASSOC));