<?php
session_start();
require_once 'config.php';

if (!isset($_SESSION['email']) || $_SESSION['role'] !== 'teacher') {
    header("Location: index.php"); exit();
}

$teacher_email = $_SESSION['email'];

// Get teacher's evaluations grouped by class
$sql = "
    SELECT te.*, c.name as class_name, COUNT(er.id) as response_count
    FROM teacher_evaluations te
    JOIN classes c ON te.class_id = c.id
    LEFT JOIN evaluation_responses er ON te.id = er.evaluation_id
    WHERE te.created_by = ?
    GROUP BY te.id
    ORDER BY c.name, te.created_at DESC
";

$stmt = $conn->prepare($sql);
$stmt->bind_param("s", $teacher_email);
$stmt->execute();
$result = $stmt->get_result();

$grouped = [];
while ($row = $result->fetch_assoc()) {
    $grouped[$row['class_name']][] = $row;
}
$stmt->close();
?>

<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>My Evaluation Results</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.2/css/all.min.css">
    <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@600;700&display=swap" rel="stylesheet">
    <style>
        body { font-family: 'Nunito', sans-serif; background: #0d1117; color: #e0e6f0; padding: 20px; margin: 0; }
        .container { max-width: 1000px; margin: auto; }
        h1 { text-align: center; color: #4fd1c5; margin: 40px 0 30px; font-size: 32px; }
        .class-group { margin-bottom: 40px; }
        .class-header { 
            background: rgba(79,209,197,0.2); 
            padding: 18px 20px; 
            border-radius: 12px; 
            cursor: pointer; 
            display: flex; 
            justify-content: space-between; 
            align-items: center;
            transition: background 0.3s;
        }
        .class-header:hover { background: rgba(79,209,197,0.3); }
        .class-header h2 { margin: 0; font-size: 24px; color: #4fd1c5; }
        .class-header i { font-size: 20px; color: #8b949e; transition: transform 0.3s; }
        .evaluations-list { margin-top: 15px; display: none; } /* ← Starts closed */

        .eval-card { 
            background: #161b22; 
            border-radius: 12px; 
            padding: 25px; 
            margin-bottom: 25px; 
            box-shadow: 0 4px 15px rgba(0,0,0,0.3);
        }
        .eval-title { font-size: 22px; font-weight: 700; color: #4fd1c5; margin-bottom: 10px; }
        .eval-meta { color: #8b949e; font-size: 15px; margin-bottom: 25px; }

        .question-block { 
            background: rgba(33,38,45,0.6); 
            padding: 20px; 
            border-radius: 10px; 
            margin-bottom: 25px; 
            border-left: 4px solid #4fd1c5;
        }
        .question-text { font-size: 17px; font-weight: 600; margin-bottom: 15px; color: #ffffff; }

        .bars { display: flex; flex-direction: column; gap: 12px; }
        .bar-container { display: flex; align-items: center; gap: 10px; font-size: 14px; }
        .bar-label { width: 140px; color: #c9d1d9; font-weight: 500; }
        .bar-bg { flex: 1; height: 28px; background: #21262d; border-radius: 14px; overflow: hidden; }
        .bar-fill { height: 100%; border-radius: 14px; text-align: center; color: black; font-weight: 700; line-height: 28px; transition: width 0.6s ease; }

        .comments-section { margin-top: 30px; }
        .comments-title { font-size: 18px; color: #4fd1c5; margin-bottom: 15px; }
        .comment { 
            background: #0d1117; 
            padding: 15px; 
            border-radius: 10px; 
            margin-bottom: 12px; 
            font-style: italic; 
            border-left: 3px solid #30363d;
        }
        .no-comments { color: #8b949e; font-style: italic; }

        @media (max-width: 768px) {
            .bar-container { flex-direction: column; align-items: flex-start; }
            .bar-label { width: auto; margin-bottom: 5px; }
        }
    </style>
</head>
<body>
<div class="container">
    <h1><i class="fas fa-chart-bar"></i> My Evaluation Results</h1>

    <?php if (empty($grouped)): ?>
        <p style="text-align:center; font-size:18px; opacity:0.8;">You haven't released any evaluations yet.</p>
    <?php else: foreach ($grouped as $class_name => $evals): ?>
        <div class="class-group">
            <div class="class-header">
                <h2><?= htmlspecialchars($class_name) ?> (<?= count($evals) ?> evaluation<?= count($evals)>1?'s':'' ?>)</h2>
                <i class="fas fa-chevron-down"></i>
            </div>
            <div class="evaluations-list">
                <?php foreach ($evals as $eval):
                    $eval_id = $eval['id'];
                    $stmt_query = $conn->query("SELECT * FROM evaluation_statements WHERE evaluation_id = $eval_id ORDER BY order_num");
                    ?>
                    <div class="eval-card">
                        <div class="eval-title"><?= htmlspecialchars($eval['title']) ?></div>
                        <div class="eval-meta">
                            Responses: <strong><?= $eval['response_count'] ?></strong> 
                            <?= $eval['description'] ? ' — ' . htmlspecialchars($eval['description']) : '' ?>
                        </div>

                        <?php while ($stmt = $stmt_query->fetch_assoc()):
                            $stmt_id = $stmt['id'];
                            $counts = $conn->query("SELECT answer, COUNT(*) as cnt FROM evaluation_answers WHERE statement_id = $stmt_id GROUP BY answer")->fetch_all(MYSQLI_ASSOC);
                            $total_answers = array_sum(array_column($counts, 'cnt')) ?: 1;

                            $options = ['strongly_agree'=>0,'agree'=>0,'neutral'=>0,'disagree'=>0,'strongly_disagree'=>0];
                            foreach ($counts as $c) $options[$c['answer']] = $c['cnt'];

                            $labels = ['Strongly Agree','Agree','Neutral','Disagree','Strongly Disagree'];
                            $colors = ['#1ed760','#4fd1c5','#ffd43b','#f85149','#e74c3c'];
                            ?>
                            <div class="question-block">
                                <div class="question-text"><?= htmlspecialchars($stmt['statement']) ?></div>
                                <div class="bars">
                                    <?php foreach ($options as $key => $val):
                                        $perc = round(($val / $total_answers) * 100);
                                        $label = $labels[array_search($key, array_keys($options))];
                                        $color = $colors[array_search($key, array_keys($options))];
                                        ?>
                                        <div class="bar-container">
                                            <div class="bar-label"><?= $label ?> (<?= $val ?>)</div>
                                            <div class="bar-bg">
                                                <div class="bar-fill" style="width:<?= $perc ?>%; background:<?= $color ?>;">
                                                    <?= $perc ?>%
                                                </div>
                                            </div>
                                        </div>
                                    <?php endforeach; ?>
                                </div>
                            </div>
                        <?php endwhile; ?>

                        <div class="comments-section">
                            <div class="comments-title">Anonymous Comments (<?= $eval['response_count'] ?> total responses)</div>
                            <?php
                            $comments = $conn->query("SELECT comments FROM evaluation_responses WHERE evaluation_id = $eval_id AND comments != '' ORDER BY submitted_at DESC");
                            if ($comments->num_rows == 0): ?>
                                <p class="no-comments">No additional comments.</p>
                            <?php else: while ($c = $comments->fetch_assoc()): ?>
                                <div class="comment"><?= nl2br(htmlspecialchars($c['comments'])) ?></div>
                            <?php endwhile; endif; ?>
                        </div>
                    </div>
                <?php endforeach; ?>
            </div>
        </div>
    <?php endforeach; endif; ?>
</div>

<script>
document.querySelectorAll('.class-header').forEach(header => {
    const list = header.nextElementSibling;
    list.style.display = 'none'; // Start collapsed

    header.addEventListener('click', () => {
        const isOpen = list.style.display === 'block';
        list.style.display = isOpen ? 'none' : 'block';
        header.querySelector('i').style.transform = isOpen ? 'rotate(0deg)' : 'rotate(180deg)';
    });
});
</script>
</body>
</html>