<?php
session_start();
require_once 'config.php';

if (!isset($_SESSION['school_admin'])) {
    header("Location: index.php");
    exit();
}

$schoolId = $_SESSION['school_id'];

$classStmt = $conn->prepare("SELECT id, name FROM classes WHERE school_id = ?");
$classStmt->bind_param("i", $schoolId);
$classStmt->execute();
$classResult = $classStmt->get_result();

$classes = [];
while ($class = $classResult->fetch_assoc()) {
    $classId = $class['id'];

    // Count learners
    $countStmt = $conn->prepare("
        SELECT COUNT(*) as total
        FROM class_students cs
        JOIN users u ON cs.student_email = u.email
        WHERE cs.class_id = ? AND u.role = 'user' AND u.is_deleted = 0
    ");
    $countStmt->bind_param("i", $classId);
    $countStmt->execute();
    $learnerCount = $countStmt->get_result()->fetch_assoc()['total'];

    // Average quiz score
    $avgStmt = $conn->prepare("
        SELECT SUM(score) as total_score, SUM(total) as total_total
        FROM quiz_results
        WHERE quiz_id IN (SELECT id FROM quizzes WHERE class_id = ?)
    ");
    $avgStmt->bind_param("i", $classId);
    $avgStmt->execute();
    $avgRow = $avgStmt->get_result()->fetch_assoc();

    $average = ($avgRow['total_total'] > 0)
        ? round(($avgRow['total_score'] / $avgRow['total_total']) * 100, 2)
        : 0;

    $classes[] = [
        'id' => $class['id'],
        'name' => $class['name'],
        'average' => $average,
        'learners' => $learnerCount
    ];
}
?>

<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Reports & Performance</title>
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

        h1 {
            text-align: center;
            font-size: 28px;
            color: var(--accent-color);
            margin-bottom: 30px;
        }

        table {
            width: 100%;
            margin: 0 auto;
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
            text-align: center;
            font-size: 15px;
        }

        th {
            background-color: #161b22;
            color: var(--accent-color);
            font-weight: bold;
            border-bottom: 1px solid rgba(255,255,255,0.1);
        }

        tr:nth-child(even) {
            background-color: rgba(255,255,255,0.02);
        }

        tr:hover {
            background-color: rgba(255,255,255,0.05);
        }

        td a {
            color: var(--accent-color);
            font-weight: bold;
            text-decoration: none;
        }

        td a:hover {
            color: #00bfff;
            text-shadow: 0 0 5px var(--hover-glow);
        }

        .back {
            display: block;
            margin: 40px auto 0;
            background: var(--accent-color);
            color: #0d1117;
            padding: 12px 24px;
            border-radius: 30px;
            text-align: center;
            width: fit-content;
            text-decoration: none;
            font-weight: bold;
            box-shadow: none;
            transition: background 0.3s ease;
        }

        .back:hover {
            background: #dddddd;
        }
    </style>
</head>
<body>

<h1>📊 Class Performance Overview</h1>

<table>
    <thead>
        <tr>
            <th>Class</th>
            <th>Class Average</th>
            <th>Total Learners</th>
        </tr>
    </thead>
    <tbody>
        <?php if (count($classes) > 0): ?>
            <?php foreach ($classes as $class): ?>
                <tr>
                    <td>
                        <a href="class_learners_report.php?class_id=<?= urlencode($class['id']) ?>">
                            <?= htmlspecialchars($class['name']) ?>
                        </a>
                    </td>
                    <td><?= $class['average'] ?>%</td>
                    <td><?= $class['learners'] ?></td>
                </tr>
            <?php endforeach; ?>
        <?php else: ?>
            <tr><td colspan="3">No class data found.</td></tr>
        <?php endif; ?>
    </tbody>
</table>



</body>
</html>
