<?php
session_start();
include("config.php");

if (!isset($_SESSION['email']) || $_SESSION['role'] !== 'teacher') {
    header("Location: index.php");
    exit();
}

if (!isset($_GET['quiz_id'])) {
    echo "Quiz ID is missing.";
    exit();
}

$quizId = intval($_GET['quiz_id']);
$schoolId = $_SESSION['school_id'] ?? null;

if (!$schoolId) {
    die("Error: Your school information is missing.");
}

// Get quiz title
$titleStmt = $conn->prepare("SELECT title FROM quizzes WHERE id = ? AND created_by = ?");
$titleStmt->bind_param("is", $quizId, $_SESSION['email']);
$titleStmt->execute();
$titleResult = $titleStmt->get_result();
$quizTitle = $titleResult->fetch_assoc()['title'] ?? 'Unknown Quiz';
$titleStmt->close();

// Handle sorting
$sort = $_GET['sort'] ?? 'submitted_at_desc';
switch ($sort) {
    case 'score_asc':
        $orderBy = "score ASC";
        break;
    case 'score_desc':
        $orderBy = "score DESC";
        break;
    case 'time_asc':
        $orderBy = "time_taken ASC";
        break;
    case 'time_desc':
        $orderBy = "time_taken DESC";
        break;
    case 'submitted_at_asc':
        $orderBy = "submitted_at ASC";
        break;
    case 'submitted_at_desc':
    default:
        $orderBy = "submitted_at DESC";
        break;
}

// Fetch results with student names
$stmt = $conn->prepare("
    SELECT qr.id AS result_id, u.name AS student_name, qr.score, qr.total, qr.time_taken, qr.submitted_at 
    FROM quiz_results qr
    JOIN users u ON qr.user_email = u.email
    WHERE qr.quiz_id = ? AND u.school_id = ?
    ORDER BY $orderBy
");
$stmt->bind_param("ii", $quizId, $schoolId);
$stmt->execute();
$results = $stmt->get_result();

// Handle CSV export
if (isset($_GET['export']) && $_GET['export'] === 'csv') {
    header("Content-Type: text/csv");
    header("Content-Disposition: attachment; filename=quiz_results.csv");
    $output = fopen("php://output", "w");

    // Add 'Percentage' to the header
    fputcsv($output, ['Student Name', 'Score', 'Out Of', 'Time Taken', 'Submitted At', 'Percentage']);

    // Reset query for export
    $exportStmt = $conn->prepare("
        SELECT u.name AS student_name, qr.score, qr.total, qr.time_taken, qr.submitted_at 
        FROM quiz_results qr
        JOIN users u ON qr.user_email = u.email
        WHERE qr.quiz_id = ? AND u.school_id = ?
        ORDER BY qr.submitted_at DESC
    ");
    $exportStmt->bind_param("ii", $quizId, $schoolId);
    $exportStmt->execute();
    $exportResults = $exportStmt->get_result();

    while ($row = $exportResults->fetch_assoc()) {
        $percentage = ($row['total'] > 0) ? round(($row['score'] / $row['total']) * 100) . '%' : 'N/A';
        fputcsv($output, [
            $row['student_name'],
            $row['score'],
            $row['total'],
            formatDuration($row['time_taken']),
            date("F j, Y, g:i a", strtotime($row['submitted_at'])),
            $percentage
        ]);
    }

    fclose($output);
    $exportStmt->close();
    exit();
}

function formatDuration($seconds) {
    $minutes = floor($seconds / 60);
    $secs = $seconds % 60;
    return "{$minutes}m {$secs}s";
}
?>

<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Results for <?= htmlspecialchars($quizTitle) ?></title>
    <style>
        :root {
            --bg-color: #0d1117;
            --card-bg: #161b22;
            --text-color: #e0e6f0;
            --accent-color: #58a6ff;
            --button-bg: #27ae60;
            --button-hover-bg: #219653;
            --card-radius: 12px;
            --shadow-glow: rgba(255, 255, 255, 0.6);
        }

        body {
            margin: 0;
            font-family: Arial, sans-serif;
            background-color: var(--bg-color);
            color: var(--text-color);
            padding: 20px;
        }

        h2 {
            color: var(--accent-color);
            margin-bottom: 20px;
            text-align: center;
            font-weight: 600;
        }

        .sort-options {
            text-align: center;
            margin-bottom: 20px;
        }

        .sort-options a {
            margin: 0 10px;
            text-decoration: none;
            color: var(--accent-color);
            font-weight: 600;
            font-size: 14px;
            transition: color 0.3s ease;
        }

        .sort-options a:hover {
            color: var(--text-color);
            text-decoration: underline;
        }

        table {
            width: 80%;
            max-width: 900px;
            margin: 20px auto;
            border-collapse: collapse;
            background-color: var(--card-bg);
            border-radius: var(--card-radius);
            box-shadow: 0 0 10px rgba(255, 255, 255, 0.1);
            backdrop-filter: blur(10px);
            overflow: hidden;
        }

        th, td {
            padding: 12px 16px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.1);
            text-align: center;
            color: var(--text-color);
            font-size: 14px;
        }

        th {
            background-color: var(--accent-color);
            color: #0d1117;
            font-weight: 600;
            font-size: 15px;
        }

        tr:hover {
            background-color: rgba(88, 166, 255, 0.2);
        }

        tr:last-child td {
            border-bottom: none;
        }

        a.review-link {
            color: var(--accent-color);
            text-decoration: none;
            font-weight: 600;
        }

        a.review-link:hover {
            text-decoration: underline;
        }

        .export-btn {
            display: inline-block;
            background-color: var(--button-bg);
            color: white;
            padding: 8px 15px;
            text-decoration: none;
            border-radius: 4px;
            font-weight: 600;
            margin-bottom: 10px;
        }

        .export-btn:hover {
            background-color: var(--button-hover-bg);
        }

        .back-btn {
            display: block;
            text-align: center;
            margin-top: 30px;
            padding: 8px 15px;
            background-color: var(--accent-color);
            color: #0d1117;
            text-decoration: none;
            border-radius: 4px;
            font-weight: 600;
        }

        .back-btn:hover {
            background-color: var(--text-color);
        }

        p.empty {
            text-align: center;
            opacity: 0.85;
            font-size: 14px;
        }

        /* Loader overlay */
        #loaderOverlay {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.4);
            display: none;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            z-index: 1000;
        }

        .loader {
            border: 6px solid #f3f3f3;
            border-top: 6px solid var(--accent-color);
            border-radius: 50%;
            width: 60px;
            height: 60px;
            animation: spin 1s linear infinite;
            margin-top: 12px;
        }

        .loader-text {
            color: var(--text-color);
            font-size: 18px;
            font-weight: bold;
            text-align: center;
        }

        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
    </style>
</head>
<body>

<h2>📊 Results for "<?= htmlspecialchars($quizTitle) ?>"</h2>

<div class="sort-options">
    Sort by:
    <a href="?quiz_id=<?= $quizId ?>&sort=score_desc">Score ↓</a>
    <a href="?quiz_id=<?= $quizId ?>&sort=score_asc">Score ↑</a>
    <a href="?quiz_id=<?= $quizId ?>&sort=submitted_at_desc">Date ↓</a>
    <a href="?quiz_id=<?= $quizId ?>&sort=submitted_at_asc">Date ↑</a>
    <a href="?quiz_id=<?= $quizId ?>&sort=time_asc">Time Taken ↑</a>
    <a href="?quiz_id=<?= $quizId ?>&sort=time_desc">Time Taken ↓</a>
</div>

<?php if ($results->num_rows > 0): ?>
    <div style="text-align: right;">
        <a href="?quiz_id=<?= $quizId ?>&export=csv" class="export-btn">📥 Download CSV</a>
    </div>
    <table>
        <tr>
            <th>Student Name</th>
            <th>Score</th>
            <th>Out Of</th>
            <th>Time Taken</th>
            <th>Submitted At</th>
            <th>Review</th>
        </tr>
        <?php while ($row = $results->fetch_assoc()): ?>
            <tr>
                <td><?= htmlspecialchars($row['student_name']) ?></td>
                <td><?= htmlspecialchars($row['score']) ?></td>
                <td><?= htmlspecialchars($row['total']) ?></td>
                <td><?= formatDuration($row['time_taken']) ?></td>
                <td><?= date("F j, Y, g:i a", strtotime($row['submitted_at'])) ?></td>
                <td><a href="review_quiz.php?result_id=<?= $row['result_id'] ?>&by=teacher" class="review-link">Review</a></td>
            </tr>
        <?php endwhile; ?>
    </table>
<?php else: ?>
    <p class="empty">No results yet for this quiz.</p>
<?php endif; ?>

<a href="teacher_quizzes.php" class="back-btn">← Back to My Quizzes</a>

<div id="loaderOverlay">
    <div class="loader-text">Processing...</div>
    <div class="loader"></div>
</div>

<script>
    // Show loader for CSV export
    document.querySelector('.export-btn').addEventListener('click', () => {
        document.getElementById('loaderOverlay').style.display = 'flex';
    });
</script>

</body>
</html>