<?php
session_start();
require_once 'config.php';

if (!isset($_SESSION['email']) || $_SESSION['role'] !== 'parent') {
    header("Location: index.php");
    exit();
}

$parentEmail = $_SESSION['email'];

/* -------------------------------------------------------------
   FIXED QUERY
   - SELECT pl.learner_email (the column that actually exists)
   - JOIN users to get the learner's name and verify role
   ------------------------------------------------------------- */
$stmt = $conn->prepare("
    SELECT DISTINCT pl.learner_email, u.name 
    FROM parent_links pl
    JOIN users u ON pl.learner_email = u.email
    WHERE pl.parent_email = ? AND u.role = 'learner'
    ORDER BY u.name
");
$stmt->bind_param("s", $parentEmail);
$stmt->execute();
$result = $stmt->get_result();

$learners = [];
while ($row = $result->fetch_assoc()) {
    $learners[] = $row;
}
$stmt->close();
?>

<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Grades - My Children</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.2/css/all.min.css">
    <style>
        :root {
            --bg: #0d1117;
            --card: #1a202c;
            --text: #e2e8f0;
            --accent: #4fd1c5;
            --radius: 16px;
        }
        body {
            margin: 0; padding: 24px; background: var(--bg); color: var(--text); font-family: 'Nunito', sans-serif;
            min-height: 100vh;
        }
        .container {
            max-width: 800px; margin: 0 auto;
        }
        h2 {
            color: var(--accent); margin-bottom: 20px; font-size: 22px;
        }
        .learner-card {
            background: var(--card); padding: 16px; border-radius: var(--radius);
            margin-bottom: 12px; cursor: pointer; transition: 0.2s;
            display: flex; align-items: center; gap: 12px;
            border: 1px solid rgba(255,255,255,0.05);
        }
        .learner-card:hover {
            background: rgba(79, 209, 197, 0.15);
            transform: translateX(4px);
        }
        .learner-card i {
            color: var(--accent); font-size: 18px;
        }
        .learner-name {
            font-weight: 600; font-size: 16px;
        }
        .no-learners {
            text-align: center; padding: 40px; opacity: 0.7; font-style: italic;
        }
    </style>
</head>
<body>
<div class="container">
    <h2>My Children's Grades</h2>

    <?php if (!empty($learners)): ?>
        <?php foreach ($learners as $l): ?>
            <div class="learner-card" onclick="viewLearnerGrades('<?= htmlspecialchars($l['learner_email']) ?>')">
                <i class="fas fa-user-graduate"></i>
                <div class="learner-name"><?= htmlspecialchars($l['name']) ?></div>
            </div>
        <?php endforeach; ?>
    <?php else: ?>
        <p class="no-learners">No learners linked yet. Ask your child to link you in their dashboard.</p>
    <?php endif; ?>
</div>

<script>
function viewLearnerGrades(email) {
    // Load learner's quiz_history.php in parent iframe
    parent.document.querySelector('iframe[name="mainFrame"]').src = 
        'quiz_history.php?learner=' + encodeURIComponent(email);
    
    // Hide parent grades page
    parent.document.getElementById('myClassesContent')?.classList.remove('active');
}
</script>
</body>
</html>