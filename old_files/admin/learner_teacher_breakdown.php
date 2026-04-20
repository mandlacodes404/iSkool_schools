<?php
session_start();
include("config.php");

// Ensure this is accessed with a learner email
if (!isset($_GET['learner'])) {
    echo "No learner specified.";
    exit();
}

$learnerEmail = $_GET['learner'];

// Get learner name
$stmt = $conn->prepare("SELECT name FROM users WHERE email = ?");
$stmt->bind_param("s", $learnerEmail);
$stmt->execute();
$result = $stmt->get_result();
$learnerName = $result->fetch_assoc()['name'] ?? $learnerEmail;
$stmt->close();
?>

<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Performance Breakdown - <?= htmlspecialchars($learnerName) ?></title>
    <style>
        :root {
            --bg-color: #0d1117;
            --card-bg: rgba(22, 27, 34, 0.7);
            --text-color: #e0e6f0;
            --accent-color: white;
            --hover-glow: rgba(0, 191, 255, 0.6);
            --border-radius: 20px;
        }

        body {
            font-family: Arial, sans-serif;
            background-color: var(--bg-color);
            color: var(--text-color);
            padding: 40px;
            margin: 0;
        }

        h2 {
            text-align: center;
            margin-bottom: 30px;
            font-size: 26px;
            color: var(--accent-color);
        }

        table {
            width: 100%;
            border-collapse: collapse;
            background: var(--card-bg);
            backdrop-filter: blur(10px);
            -webkit-backdrop-filter: blur(10px);
            border-radius: var(--border-radius);
            overflow: hidden;
            box-shadow: 0 0 30px rgba(0, 191, 255, 0.1);
        }

        th, td {
            padding: 16px;
            border: 1px solid rgba(255,255,255,0.1);
            text-align: center;
            font-size: 15px;
        }

        th {
            background-color: #161b22;
            color: var(--accent-color);
            font-weight: bold;
        }

        tr:nth-child(even) {
            background-color: rgba(255,255,255,0.02);
        }

        tr:hover {
            background-color: rgba(255,255,255,0.05);
        }

        .no-data {
            text-align: center;
            opacity: 0.7;
            margin-top: 40px;
            font-size: 16px;
        }
    </style>
</head>
<body>

<h2>📊 Average for <?= htmlspecialchars($learnerName) ?> Per Subject</h2>

<?php
$query = $conn->prepare("
    SELECT u.name AS teacher_name, q.created_by AS teacher_email,
           COUNT(*) AS quizzes_taken,
           ROUND(AVG((qr.score / NULLIF(qr.total, 0)) * 100), 2) AS average_percentage
    FROM quiz_results qr
    JOIN quizzes q ON qr.quiz_id = q.id
    JOIN users u ON q.created_by = u.email
    WHERE qr.user_email = ?
    GROUP BY q.created_by
    ORDER BY average_percentage DESC
");
$query->bind_param("s", $learnerEmail);
$query->execute();
$groupedResults = $query->get_result();

if ($groupedResults->num_rows > 0): ?>
    <table>
        <thead>
            <tr>
                <th>Teacher</th>
                <th>Assignments Taken</th>
                <th>Average (%)</th>
            </tr>
        </thead>
        <tbody>
        <?php while ($row = $groupedResults->fetch_assoc()): ?>
            <tr>
                <td><?= htmlspecialchars($row['teacher_name']) ?></td>
                <td><?= $row['quizzes_taken'] ?></td>
                <td><?= $row['average_percentage'] ?>%</td>
            </tr>
        <?php endwhile; ?>
        </tbody>
    </table>
<?php else: ?>
    <p class="no-data">No quiz records found for this learner.</p>
<?php endif; ?>

</body>
</html>
