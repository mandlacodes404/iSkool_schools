<?php
/**
 * iSkool - Quiz Review Page
 * * Features:
 * - Single-query data fetching for performance
 * - Role-based access control (Learner vs Teacher)
 * - "Publish Marks" check for learners
 * - Clear visual feedback for correct/incorrect choices
 */
session_start();
include("config.php");

// 1. Security Check
if (!isset($_SESSION['email'])) {
    header("Location: index.php");
    exit();
}

if (!isset($_GET['result_id'])) {
    die("Invalid review request.");
}

$resultId = intval($_GET['result_id']);
$loggedInEmail = $_SESSION['email'];
$userRole = $_SESSION['role'] ?? 'learner';

// 2. Optimized Data Fetch (Combined results, quiz info, questions, and choices)
$stmt = $conn->prepare("
    SELECT 
        r.score, r.total, r.submitted_at, r.user_email,
        q.id as quiz_id, q.title, q.publish_marks,
        qq.id AS q_id, qq.question_text, qq.image_path, qq.points,
        c.id AS choice_id, c.choice_text, c.is_correct,
        ua.selected_choice_id
    FROM quiz_results r
    JOIN quizzes q ON r.quiz_id = q.id
    JOIN quizquestions qq ON q.id = qq.quiz_id
    JOIN choices c ON qq.id = c.question_id
    LEFT JOIN user_answers ua ON ua.question_id = qq.id AND ua.result_id = r.id
    WHERE r.id = ?
");
$stmt->bind_param("i", $resultId);
$stmt->execute();
$res = $stmt->get_result();

$questions = [];
$quizInfo = null;

while ($row = $res->fetch_assoc()) {
    if (!$quizInfo) $quizInfo = $row;
    
    $qid = $row['q_id'];
    if (!isset($questions[$qid])) {
        $questions[$qid] = [
            'text' => $row['question_text'],
            'image' => $row['image_path'],
            'points' => $row['points'],
            'selected' => $row['selected_choice_id'],
            'choices' => []
        ];
    }
    $questions[$qid]['choices'][] = [
        'id' => $row['choice_id'],
        'text' => $row['choice_text'],
        'is_correct' => $row['is_correct']
    ];
}
$stmt->close();

if (!$quizInfo) die("Review data not found.");

// 3. Strict Access Control
// Fixed: Using 'learner' instead of 'user'
if ($userRole === 'learner') {
    if ($quizInfo['user_email'] !== $loggedInEmail) {
        die("Access denied. You can only view your own results.");
    }

    if ($quizInfo['publish_marks'] == 0) {
        ?>
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">
            <title>Results Not Published</title>
            <style>
                body { background:#0d1117; color:#e0e6f0; font-family:sans-serif; display:flex; flex-direction:column; align-items:center; justify-content:center; height:100vh; text-align:center; margin:0; }
                h1 { color:#4fd1c5; }
                a { color:#4fd1c5; text-decoration:none; border:1px solid #4fd1c5; padding:10px 20px; border-radius:8px; margin-top:20px; }
            </style>
        </head>
        <body>
            <h1>Results Not Published</h1>
            <p>Your teacher has not released the marks for this quiz yet.</p>
            <a href="learner_dashboard.php">Back to Dashboard</a>
        </body>
        </html>
        <?php
        exit();
    }
}

$percentage = ($quizInfo['total'] > 0) ? round(($quizInfo['score'] / $quizInfo['total']) * 100) : 0;
$backLink = ($userRole === 'teacher') ? 'teacher_quizzes.php' : 'quiz_history.php';
?>

<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Review: <?= htmlspecialchars($quizInfo['title']) ?></title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.2/css/all.min.css" />
    <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@600&display=swap" rel="stylesheet">
    <style>
        :root {
            --bg-color: #0d1117;
            --card-bg: #1a202c;
            --text-color: #e0e6f0;
            --accent-color: #4fd1c5;
            --correct: #27ae60;
            --incorrect: #e74c3c;
            --border: rgba(255, 255, 255, 0.1);
        }

        body {
            margin: 0; font-family: 'Nunito', sans-serif;
            background-color: var(--bg-color); color: var(--text-color);
            padding: 20px; display: flex; flex-direction: column; align-items: center;
        }

        .container { max-width: 800px; width: 100%; }

        /* Header Score Card */
        .score-card {
            background: var(--card-bg); padding: 25px; border-radius: 12px;
            text-align: center; margin-bottom: 30px; border-bottom: 4px solid var(--accent-color);
        }

        .perc-circle {
            font-size: 40px; font-weight: bold; color: var(--accent-color);
            margin-bottom: 5px;
        }

        /* Question Box */
        .question-box {
            background: var(--card-bg); padding: 20px; border-radius: 12px;
            margin-bottom: 20px; box-shadow: 0 4px 6px rgba(0,0,0,0.3);
        }

        .question-text { font-size: 18px; margin-bottom: 15px; display: block; }

        .q-meta { font-size: 13px; opacity: 0.6; margin-bottom: 15px; }

        .choice {
            padding: 12px 15px; border-radius: 8px; margin-bottom: 8px;
            background: rgba(255,255,255,0.05); border: 1px solid var(--border);
            display: flex; align-items: center; gap: 10px; transition: 0.3s;
        }

        .choice.correct { border-color: var(--correct); background: rgba(39, 174, 96, 0.15); }
        .choice.incorrect { border-color: var(--incorrect); background: rgba(231, 76, 60, 0.15); }

        .choice i { font-size: 18px; }
        .fa-check-circle { color: var(--correct); }
        .fa-times-circle { color: var(--incorrect); }

        .badge-user {
            margin-left: auto; font-size: 11px; background: rgba(255,255,255,0.1);
            padding: 2px 8px; border-radius: 10px; opacity: 0.8;
        }

        .back-btn {
            display: inline-block; padding: 12px 25px; background: var(--card-bg);
            color: var(--accent-color); text-decoration: none; border-radius: 8px;
            border: 1px solid var(--accent-color); font-weight: bold; transition: 0.3s;
        }

        .back-btn:hover { background: var(--accent-color); color: var(--bg-color); }

        img.q-image { max-width: 100%; border-radius: 8px; margin-bottom: 15px; border: 1px solid var(--border); }

        .review-badge { display: none; }
        .review-title { font-size: 18px; opacity: 0.8; }
        .review-meta { margin-top: 10px; font-size: 14px; }

        @media (max-width: 768px) {
            :root {
                --bg-color: #0d1117;
                --card-bg: transparent;
                --text-color: #e2e8f0;
                --correct: #22c55e;
                --incorrect: #f85149;
                --border: rgba(255,255,255,0.08);
            }

            html, body {
                min-height: 100%;
                background: var(--bg-color);
            }

            body {
                display: block;
                padding: 18px 16px 96px;
                box-sizing: border-box;
                overflow-x: hidden;
            }

            .container {
                max-width: 520px;
                margin: 0 auto;
            }

            .score-card {
                background: transparent;
                border: 0;
                border-radius: 0;
                box-shadow: none;
                text-align: left;
                padding: 0 0 18px;
                margin-bottom: 8px;
                border-bottom: 1px solid rgba(255,255,255,0.07);
            }

            .review-badge {
                display: inline-flex;
                align-items: center;
                gap: 7px;
                padding: 4px 9px;
                border-radius: 6px;
                font-size: 10px;
                font-weight: 800;
                letter-spacing: 0.6px;
                text-transform: uppercase;
                margin-bottom: 12px;
                color: #c9d1d9;
                border: 1px solid rgba(255,255,255,0.1);
                background: rgba(255,255,255,0.04);
            }

            .perc-circle {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                min-width: 62px;
                height: 34px;
                padding: 0 12px;
                border-radius: 10px;
                background: rgba(79,209,197,0.08);
                border: 1px solid rgba(79,209,197,0.28);
                color: #4fd1c5;
                font-size: 18px;
                font-weight: 900;
                margin-bottom: 14px;
            }

            .review-title {
                margin: 0 0 10px;
                color: #e2e8f0;
                font-size: 21px;
                line-height: 1.28;
                font-weight: 800;
                opacity: 1;
            }

            .review-meta {
                margin-top: 0;
                color: #8b949e;
                font-size: 12px;
                line-height: 1.6;
            }

            .question-box {
                background: transparent;
                border-radius: 0;
                box-shadow: none;
                padding: 18px 0 20px;
                margin: 0;
                border-bottom: 1px solid rgba(255,255,255,0.07);
            }

            .q-meta {
                display: inline-flex;
                align-items: center;
                padding: 3px 8px;
                border-radius: 999px;
                background: rgba(255,255,255,0.04);
                border: 1px solid rgba(255,255,255,0.08);
                color: #8b949e;
                font-size: 10px;
                font-weight: 800;
                text-transform: uppercase;
                letter-spacing: 0.5px;
                opacity: 1;
                margin-bottom: 12px;
            }

            .question-text {
                color: #e2e8f0;
                font-size: 15px;
                line-height: 1.75;
                font-weight: 800;
                margin-bottom: 14px;
                overflow-wrap: anywhere;
            }

            img.q-image {
                width: 100%;
                border-radius: 10px;
                margin: 0 0 14px;
                border: 1px solid rgba(255,255,255,0.08);
            }

            .choices-list {
                display: flex;
                flex-direction: column;
                gap: 10px;
            }

            .choice {
                margin: 0;
                min-height: 44px;
                padding: 11px 13px;
                border-radius: 10px;
                background: rgba(255,255,255,0.04);
                border: 1px solid rgba(255,255,255,0.08);
                color: #c9d1d9;
                font-size: 14px;
                line-height: 1.45;
            }

            .choice.correct {
                border-color: rgba(34,197,94,0.4);
                background: rgba(34,197,94,0.09);
                color: #e2e8f0;
            }

            .choice.incorrect {
                border-color: rgba(248,81,73,0.42);
                background: rgba(248,81,73,0.09);
                color: #e2e8f0;
            }

            .choice i {
                font-size: 16px;
                flex-shrink: 0;
            }

            .badge-user {
                margin-left: auto;
                color: #4fd1c5;
                background: rgba(79,209,197,0.08);
                border: 1px solid rgba(79,209,197,0.2);
                opacity: 1;
                white-space: nowrap;
                flex-shrink: 0;
            }
        }
    </style>
</head>
<body>

<div class="container">
    <div class="score-card">
        <div class="review-badge">
            <i class="fas fa-chart-simple"></i>
            Quiz Review
        </div>
        <div class="perc-circle"><?= $percentage ?>%</div>
        <div class="review-title">
            <?= htmlspecialchars($quizInfo['title']) ?>
        </div>
        <div class="review-meta">
            Points: <strong><?= $quizInfo['score'] ?> / <?= $quizInfo['total'] ?></strong> • 
            Date: <?= date("d M Y", strtotime($quizInfo['submitted_at'])) ?>
        </div>
    </div>

    <?php $count = 1; foreach ($questions as $q): ?>
        <div class="question-box">
            <div class="q-meta">Question <?= $count++ ?> (<?= $q['points'] ?> Points)</div>
            <strong class="question-text"><?= htmlspecialchars($q['text']) ?></strong>

            <?php if (!empty($q['image'])): ?>
                <img src="<?= htmlspecialchars($q['image']) ?>" class="q-image" alt="Question Image">
            <?php endif; ?>

            <div class="choices-list">
                <?php foreach ($q['choices'] as $choice): 
                    $isSelected = ($choice['id'] == $q['selected']);
                    $isCorrect = ($choice['is_correct'] == 1);
                    
                    $class = '';
                    if ($isCorrect) $class = 'correct';
                    elseif ($isSelected && !$isCorrect) $class = 'incorrect';
                ?>
                    <div class="choice <?= $class ?>">
                        <?php if ($isCorrect): ?>
                            <i class="fas fa-check-circle"></i>
                        <?php elseif ($isSelected && !$isCorrect): ?>
                            <i class="fas fa-times-circle"></i>
                        <?php else: ?>
                            <i class="far fa-circle" style="opacity:0.3"></i>
                        <?php endif; ?>

                        <?= htmlspecialchars($choice['text']) ?>

                        <?php if ($isSelected): ?>
                            <span class="badge-user">Your Answer</span>
                        <?php endif; ?>
                    </div>
                <?php endforeach; ?>
            </div>
        </div>
    <?php endforeach; ?>

    <div style="text-align: center; margin-top: 40px;">
      
    </div>
</div>

</body>
</html>
