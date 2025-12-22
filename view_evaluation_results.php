<?php
session_start();
require_once 'config.php';

if (!isset($_SESSION['email']) || $_SESSION['role'] !== 'teacher') {
    header("Location: index.php"); exit();
}

$teacher_email = $_SESSION['email'];

// Get teacher's evaluations
$evals = $conn->query("SELECT te.*, c.name as class_name 
                       FROM teacher_evaluations te 
                       JOIN classes c ON te.class_id = c.id 
                       WHERE te.created_by = '$teacher_email' 
                       ORDER BY te.created_at DESC")->fetch_all(MYSQLI_ASSOC);
?>

<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>My Evaluation Results</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.2/css/all.min.css">
    <style>
        body { font-family: 'Nunito', sans-serif; background: #0d1117; color: #e0e6f0; padding: 20px; }
        .container { max-width: 900px; margin: auto; }
        .eval-card { background: #161b22; padding: 20px; border-radius: 12px; margin: 20px 0; }
        .bar { height: 20px; background: #4fd1c5; border-radius: 10px; text-align: center; color: black; line-height: 20px; }
        .comments { margin-top: 20px; padding: 10px; background: #0d1117; border-radius: 8px; }
    </style>
</head>
<body>
<div class="container">
    <h1 style="text-align:center; color:#4fd1c5;"><i class="fas fa-chart-bar"></i> Evaluation Results</h1>

    <?php if (empty($evals)): ?>
        <p style="text-align:center;">No evaluations released yet.</p>
    <?php else: foreach ($evals as $eval):
        $eval_id = $eval['id'];
        $responses = $conn->query("SELECT COUNT(*) as count FROM evaluation_responses WHERE evaluation_id = $eval_id")->fetch_assoc()['count'];

        $stmt_query = $conn->query("SELECT * FROM evaluation_statements WHERE evaluation_id = $eval_id ORDER BY order_num");
        ?>
        <div class="eval-card">
            <h2><?= htmlspecialchars($eval['title']) ?> — <?= htmlspecialchars($eval['class_name']) ?></h2>
            <p><strong>Responses:</strong> <?= $responses ?></p>

            <?php while ($stmt = $stmt_query->fetch_assoc()):
                $stmt_id = $stmt['id'];
                $counts = $conn->query("SELECT answer, COUNT(*) as cnt FROM evaluation_answers WHERE statement_id = $stmt_id GROUP BY answer")->fetch_all(MYSQLI_ASSOC);
                $total_answers = array_sum(array_column($counts, 'cnt')) ?: 1;

                $options = ['strongly_agree' => 0, 'agree' => 0, 'neutral' => 0, 'disagree' => 0, 'strongly_disagree' => 0];
                foreach ($counts as $c) $options[$c['answer']] = $c['cnt'];

                $labels = ['Strongly Agree', 'Agree', 'Neutral', 'Disagree', 'Strongly Disagree'];
                $values = array_values($options);
                ?>
                <div style="margin:20px 0;">
                    <strong><?= htmlspecialchars($stmt['statement']) ?></strong>
                    <?php foreach ($values as $i => $val):
                        $perc = round(($val / $total_answers) * 100);
                        $color = ['#1ed760', '#4fd1c5', '#ffd43b', '#f85149', '#e74c3c'][$i];
                        ?>
                        <p><?= $labels[$i] ?>: <?= $perc ?>% (<?= $val ?>)</p>
                        <div style="height:20px; background:#21262d; border-radius:10px; overflow:hidden;">
                            <div class="bar" style="width:<?= $perc ?>%; background:<?= $color ?>;"><?= $perc ?>%</div>
                        </div>
                    <?php endforeach; ?>
                </div>
            <?php endwhile; ?>

            <!-- Comments -->
            <div class="comments">
                <strong>Anonymous Comments:</strong>
                <?php
                $comments = $conn->query("SELECT comments FROM evaluation_responses WHERE evaluation_id = $eval_id AND comments != ''");
                if ($comments->num_rows == 0): ?>
                    <p><em>No comments.</em></p>
                <?php else: while ($c = $comments->fetch_assoc()): ?>
                    <p>• <?= nl2br(htmlspecialchars($c['comments'])) ?></p>
                <?php endwhile; endif; ?>
            </div>
        </div>
    <?php endforeach; endif; ?>
</div>
</body>
</html>