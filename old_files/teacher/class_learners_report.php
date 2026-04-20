<?php
session_start();
require_once 'config.php';

if (!isset($_SESSION['school_admin'])) {
    header("Location: index.php");
    exit();
}

if (!isset($_GET['class_id'])) {
    echo "No class specified.";
    exit();
}

$class_id = intval($_GET['class_id']);
$schoolId = $_SESSION['school_id'];

$stmt = $conn->prepare("SELECT name FROM classes WHERE id = ? AND school_id = ?");
$stmt->bind_param("ii", $class_id, $schoolId);
$stmt->execute();
$result = $stmt->get_result();
if ($result->num_rows === 0) {
    echo "Class not found or you don't have access.";
    exit();
}
$class = $result->fetch_assoc();
$class_name = $class['name'];

$learnersStmt = $conn->prepare("
    SELECT u.email, u.name,
      COALESCE(ROUND(AVG((qr.score / NULLIF(qr.total, 0)) * 100), 2), 0) AS average_score
    FROM class_students cs
    JOIN users u ON cs.student_email = u.email
    LEFT JOIN quiz_results qr ON qr.user_email = u.email
      AND qr.quiz_id IN (SELECT id FROM quizzes WHERE class_id = ?)
    WHERE cs.class_id = ?
    GROUP BY u.email, u.name
    ORDER BY u.name ASC
");
$learnersStmt->bind_param("ii", $class_id, $class_id);
$learnersStmt->execute();
$learnersResult = $learnersStmt->get_result();
?>

<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Learners in <?= htmlspecialchars($class_name) ?></title>
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
            font-size: 26px;
            color: var(--accent-color);
            margin-bottom: 30px;
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
            text-align: left;
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

<h1>📘 Learner Performance – <?= htmlspecialchars($class_name) ?></h1>

<?php if ($learnersResult->num_rows > 0): ?>
<table>
    <thead>
        <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Learner average (%)</th>
        </tr>
    </thead>
    <tbody>
        <?php while ($learner = $learnersResult->fetch_assoc()): ?>
            <tr>
                <td>
                    <a href="learner_teacher_breakdown.php?learner=<?= urlencode($learner['email']) ?>&class_id=<?= $class_id ?>">
                        <?= htmlspecialchars($learner['name'] ?: $learner['email']) ?>
                    </a>
                </td>
                <td><?= htmlspecialchars($learner['email']) ?></td>
                <td><?= $learner['average_score'] ?>%</td>
            </tr>
        <?php endwhile; ?>
    </tbody>
</table>
<?php else: ?>
    <p style="text-align:center; opacity: 0.8;">No learners found in this class.</p>
<?php endif; ?>

<a href="reports.php" class="back">← Back to Reports</a>

</body>
</html>
