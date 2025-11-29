<?php
session_start();
include("config.php");

// Check admin login and role
if (!isset($_SESSION['school_admin']) || $_SESSION['role'] !== 'school_admin') {
    header("Location: index.php");
    exit();
}

$school_id = $_SESSION['school_id'];

if (!isset($_GET['id']) || !is_numeric($_GET['id'])) {
    die("Invalid evaluation ID.");
}

$evaluation_id = intval($_GET['id']);

// Fetch evaluation details (ensure it belongs to this school and is released)
$sqlEval = "
    SELECT te.*, u.name AS teacher_name, c.name AS class_name
    FROM teacher_evaluations te
    JOIN users u ON u.id = te.teacher_id
    JOIN classes c ON c.id = te.class_id
    WHERE te.id = ? AND te.school_id = ? AND te.released = 1
    LIMIT 1
";

$stmtEval = $conn->prepare($sqlEval);
$stmtEval->bind_param("ii", $evaluation_id, $school_id);
$stmtEval->execute();
$resultEval = $stmtEval->get_result();

if ($resultEval->num_rows === 0) {
    die("Evaluation not found or access denied.");
}

$evaluation = $resultEval->fetch_assoc();
$stmtEval->close();

// Fetch all responses for this evaluation
$sqlResponses = "
    SELECT rating, feedback, submitted_at
    FROM teacher_evaluation_responses
    WHERE evaluation_id = ?
    ORDER BY submitted_at DESC
";

$stmtResp = $conn->prepare($sqlResponses);
$stmtResp->bind_param("i", $evaluation_id);
$stmtResp->execute();
$responses = $stmtResp->get_result();
$stmtResp->close();
?>

<!DOCTYPE html>
<html lang="en">
<head>
    <title>Evaluation Details</title>
    <style>
        body {
            background-color: #0d1117;
            color: #e0e6f0;
            font-family: Arial, sans-serif;
            padding: 30px;
        }
        h1, h2 {
            text-align: center;
            margin-bottom: 10px;
        }
        .evaluation-info {
            background-color: #161b22;
            padding: 20px;
            border-radius: 12px;
            box-shadow: 0 0 15px rgba(0,191,255,0.3);
            margin-bottom: 30px;
            max-width: 800px;
            margin-left: auto;
            margin-right: auto;
        }
        .responses {
            max-width: 900px;
            margin: 0 auto;
            border-collapse: collapse;
            width: 100%;
        }
        .responses th, .responses td {
            padding: 12px 15px;
            border-bottom: 1px solid #22272e;
            text-align: left;
        }
        .responses th {
            background-color: white;
            color: black;
        }
        .responses tr:hover {
            background-color: #22354a;
        }
        .no-responses {
            text-align: center;
            margin-top: 20px;
            font-style: italic;
            opacity: 0.7;
        }
        a.back-link {
            display: inline-block;
            margin: 20px auto 0 auto;
            background: #2980b9;
            color: white;
            padding: 10px 24px;
            border-radius: 8px;
            font-weight: 600;
            font-size: 14px;
            text-align: center;
            text-decoration: none;
            box-shadow: 0 3px 12px rgba(0, 191, 255, 0.4);
            transition: background-color 0.3s ease;
            max-width: 150px;
            margin-left: auto;
            margin-right: auto;
        }
        a.back-link:hover {
            background-color: #1c5d8a;
        }

       
    </style>
</head>
<body>

<div class="evaluation-info">
    <h1>Evaluation Details</h1>
    <p><strong>Teacher:</strong> <?= htmlspecialchars($evaluation['teacher_name']) ?></p>
    <p><strong>Class:</strong> <?= htmlspecialchars($evaluation['class_name']) ?></p>
    <p><strong>Subject:</strong> <?= htmlspecialchars($evaluation['subject']) ?></p>
    <p><strong>Description:</strong> <?= nl2br(htmlspecialchars($evaluation['description'])) ?></p>
    <p><strong>Released on:</strong> <?= date('Y-m-d', strtotime($evaluation['created_at'])) ?></p>
</div>

<h2>Learner Responses</h2>

<?php if ($responses->num_rows > 0): ?>
<table class="responses">
    <thead>
        <tr>
            <th>Rating</th>
            <th>Feedback</th>
            <th>Submitted At</th>
        </tr>
    </thead>
    <tbody>
        <?php while ($row = $responses->fetch_assoc()): ?>
        <tr>
            <td><?= intval($row['rating']) ?>/5</td>
            <td><?= nl2br(htmlspecialchars($row['feedback'])) ?></td>
            <td><?= date('Y-m-d H:i', strtotime($row['submitted_at'])) ?></td>
        </tr>
        <?php endwhile; ?>
    </tbody>
</table>
<?php else: ?>
<p class="no-responses">No responses submitted yet.</p>
<?php endif; ?>

<a href="view_evaluations.php" class="back-link">← Back to Evaluations</a>


</script>
</body>
</html>
