<?php
session_start();
include("config.php");

if (!isset($_SESSION['email'])) {
    header("Location: index.php");
    exit();
}

if (!isset($_GET['result_id'])) {
    echo "Invalid review request.";
    exit();
}

$resultId = intval($_GET['result_id']);
$loggedInEmail = $_SESSION['email'];
$userRole = $_SESSION['role'] ?? 'user';

// Get user's school_id
$schoolStmt = $conn->prepare("SELECT school_id FROM users WHERE email = ?");
$schoolStmt->bind_param("s", $loggedInEmail);
$schoolStmt->execute();
$schoolStmt->bind_result($userSchoolId);
$schoolStmt->fetch();
$schoolStmt->close();

// Fetch quiz result including user_email and quiz creator
$quizStmt = $conn->prepare("
    SELECT r.quiz_id, r.score, r.total, r.submitted_at, q.title, r.user_email, q.created_by, q.publish_marks
    FROM quiz_results r 
    JOIN quizzes q ON r.quiz_id = q.id 
    WHERE r.id = ?
");
$quizStmt->bind_param("i", $resultId);
$quizStmt->execute();
$quizResult = $quizStmt->get_result()->fetch_assoc();
$quizStmt->close();

if (!$quizResult) {
    echo "Quiz not found.";
    exit();
}

// Get quiz creator's school_id
$creatorStmt = $conn->prepare("SELECT school_id FROM users WHERE email = ?");
$creatorStmt->bind_param("s", $quizResult['created_by']);
$creatorStmt->execute();
$creatorStmt->bind_result($creatorSchoolId);
$creatorStmt->fetch();
$creatorStmt->close();

// Access control
if ($userRole === 'user') {
    if (
        $quizResult['user_email'] !== $loggedInEmail ||
        $userSchoolId !== $creatorSchoolId
    ) {
        echo "Access denied.";
        exit();
    }

    // Block if publish_marks is off
    if ($quizResult['publish_marks'] == 0) {
        echo '
        <!DOCTYPE html>
        <html>
        <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>Results Not Published</title>
        <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@600&display=swap" rel="stylesheet">
        <style>
            :root {
                --bg-color: #0d1117;
                --text-color: #e0e6f0;
                --accent-color: #4fd1c5;
                --button-bg: #2c3e50;
                --button-hover-bg: #34495e;
                --card-radius: 12px;
                --shadow-glow: rgba(79, 209, 197, 0.3);
            }

            body {
                font-family: \'Nunito\', sans-serif;
                font-weight: 600;
                background-color: var(--bg-color);
                color: var(--text-color);
                display: flex;
                flex-direction: column;
                justify-content: center;
                align-items: center;
                height: 100vh;
                margin: 0;
                padding: 20px;
                text-align: center;
            }

            h1 {
                font-size: 2.5rem;
                color: var(--accent-color);
                margin-bottom: 20px;
                text-shadow: 0 0 8px var(--shadow-glow);
            }

            p {
                font-size: 1.2rem;
                margin-bottom: 40px;
                max-width: 400px;
                line-height: 1.5;
                color: var(--text-color);
                opacity: 0.8;
            }

            a {
                text-decoration: none;
                background-color: var(--button-bg);
                color: var(--text-color);
                padding: 12px 30px;
                border-radius: var(--card-radius);
                font-weight: 600;
                box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
                transition: background-color 0.3s ease, box-shadow 0.3s ease;
            }

            a:hover {
                background-color: var(--button-hover-bg);
                box-shadow: 0 0 15px var(--shadow-glow);
            }

            @media (max-width: 768px) {
                h1 {
                    font-size: 2rem;
                }

                p {
                    font-size: 1rem;
                }
            }
        </style>
        </head>
        <body>
            <h1>Results Not Published Yet</h1>
            <p>Your teacher has not published the results for this quiz yet. Please check back later.</p>
            <a href="learner_dashboard.php">Back to Dashboard</a>
        </body>
        </html>
        ';
        exit();
    }
}

// Fetch all questions and user answers
$query = $conn->prepare("
    SELECT 
        qq.id AS question_id,
        qq.question_text,
        qq.image_path,
        qq.points,
        ua.selected_choice_id,
        c.id AS choice_id,
        c.choice_text,
        c.is_correct
    FROM quizquestions qq
    JOIN choices c ON qq.id = c.question_id
    LEFT JOIN user_answers ua 
        ON ua.question_id = qq.id AND ua.result_id = ?
    WHERE qq.quiz_id = ?
    ORDER BY qq.id, c.id
");
$query->bind_param("ii", $resultId, $quizResult['quiz_id']);
$query->execute();
$res = $query->get_result();

$questions = [];
while ($row = $res->fetch_assoc()) {
    $qid = $row['question_id'];
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

$backLink = ($userRole === 'teacher') ? 'teacher_quizzes.php' : 'quiz_history.php';
?>

<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Review Quiz: <?= htmlspecialchars($quizResult['title']) ?></title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.2/css/all.min.css" integrity="sha512-z3gLpd7yknf1YoNbCzqRKc4qyor8gaKU1qmn+CShxbuBusANI9QpRohGBreCFkKxLhei6S9CQXFEbbKuqLg0DA==" crossorigin="anonymous" referrerpolicy="no-referrer" />
    <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@600&display=swap" rel="stylesheet">
    <style>
        :root {
            --bg-color: #0d1117;
            --card-bg: #1a202c;
            --text-color: #e0e6f0;
            --accent-color: #4fd1c5;
            --button-bg: #2c3e50;
            --button-hover-bg: #34495e;
            --correct-bg: #27ae60;
            --incorrect-bg: #e74c3c;
            --card-radius: 12px;
            --shadow-glow: rgba(79, 209, 197, 0.3);
            --border-color: rgba(255, 255, 255, 0.1);
        }

        body {
            margin: 0;
            font-family: 'Nunito', sans-serif;
            font-weight: 600;
            background-color: var(--bg-color);
            color: var(--text-color);
            padding: 20px;
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            align-items: center;
        }

        .container {
            max-width: 800px;
            width: 100%;
        }

        h2 {
            font-size: 28px;
            color: var(--text-color);
            text-align: center;
            margin: 20px 0;
            display: flex;
            align-items: center;
            gap: 10px;
        }

        h2 i {
            color: var(--accent-color);
        }

        .score-info {
            background: var(--card-bg);
            padding: 15px;
            border-radius: var(--card-radius);
            margin-bottom: 20px;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
            text-align: center;
            font-size: 16px;
        }

        .score-info span {
            color: var(--accent-color);
            font-weight: 600;
        }

        .question-box {
            background: var(--card-bg);
            padding: 20px;
            border-radius: var(--card-radius);
            margin-bottom: 20px;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
            transition: transform 0.3s ease, box-shadow 0.3s ease;
        }

        .question-box:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
        }

        .question-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 10px;
        }

        .question-header strong {
            font-size: 18px;
            color: var(--accent-color);
        }

        .question-points {
            font-size: 14px;
            color: var(--text-color);
            opacity: 0.8;
        }

        .question-box img {
            max-width: 100%;
            max-height: 300px;
            margin: 10px 0;
            border-radius: 8px;
            border: 1px solid var(--border-color);
        }

        .choice {
            margin: 8px 0;
            padding: 12px 15px;
            border-radius: 6px;
            border: 1px solid var(--border-color);
            color: var(--text-color);
            font-size: 14px;
            display: flex;
            align-items: center;
            gap: 10px;
            transition: background-color 0.3s ease;
        }

        .correct {
            background-color: var(--correct-bg);
            border-left: 5px solid #1f8b4c;
            color: #ffffff;
        }

        .incorrect {
            background-color: var(--incorrect-bg);
            border-left: 5px solid #c0392b;
            color: #ffffff;
        }

        .choice-icon {
            font-size: 16px;
        }

        a.back-link {
            display: inline-block;
            color: var(--accent-color);
            text-decoration: none;
            font-weight: 600;
            padding: 10px 20px;
            border-radius: var(--card-radius);
            background: var(--button-bg);
            transition: background-color 0.3s ease, box-shadow 0.3s ease;
        }

        a.back-link:hover {
            background: var(--button-hover-bg);
            box-shadow: 0 0 10px var(--shadow-glow);
        }

        #loaderOverlay {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.7);
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
            font-weight: 600;
            text-align: center;
        }

        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }

        @media (max-width: 768px) {
            .container {
                padding: 0 10px;
            }

            h2 {
                font-size: 24px;
            }

            .score-info {
                font-size: 14px;
            }

            .question-header strong {
                font-size: 16px;
            }

            .question-points {
                font-size: 12px;
            }

            .choice {
                font-size: 12px;
                padding: 10px;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <h2><i class="fas fa-poll"></i> Review: <?= htmlspecialchars($quizResult['title']) ?></h2>
        <div class="score-info">
            <span>Score:</span> <?= $quizResult['score'] ?> / <?= $quizResult['total'] ?> |
            <span>Date:</span> <?= date("F j, Y, g:i a", strtotime($quizResult['submitted_at'])) ?>
        </div>

        <?php 
        $questionNumber = 1;
        foreach ($questions as $q): 
        ?>
            <div class="question-box">
                <div class="question-header">
                    <strong>Question <?= $questionNumber ?>: <?= htmlspecialchars($q['text']) ?></strong>
                    <span class="question-points"><?= $q['points'] ?> point<?= $q['points'] == 1 ? '' : 's' ?></span>
                </div>
                <?php if (!empty($q['image'])): ?>
                    <img src="<?= htmlspecialchars($q['image']) ?>" alt="Question Image">
                <?php endif; ?>
                <div>
                    <?php foreach ($q['choices'] as $choice): 
                        $isSelected = ($choice['id'] == $q['selected']);
                        $isCorrect = ($choice['is_correct'] == 1);
                        $showIncorrect = $isSelected && !$isCorrect;
                    ?>
                        <div class="choice <?= $isCorrect ? 'correct' : ($showIncorrect ? 'incorrect' : '') ?>">
                            <span class="choice-icon">
                                <?php if ($isCorrect): ?>
                                    <i class="fas fa-check-circle" style="color: #1f8b4c;"></i>
                                <?php elseif ($showIncorrect): ?>
                                    <i class="fas fa-times-circle" style="color: #c0392b;"></i>
                                <?php elseif ($isSelected): ?>
                                    <i class="fas fa-circle" style="color: var(--accent-color);"></i>
                                <?php else: ?>
                                    <i class="far fa-circle" style="color: var(--text-color); opacity: 0.5;"></i>
                                <?php endif; ?>
                            </span>
                            <?= htmlspecialchars($choice['text']) ?>
                        </div>
                    <?php endforeach; ?>
                </div>
            </div>
        <?php 
        $questionNumber++;
        endforeach; 
        ?>

        <a href="<?= htmlspecialchars($backLink) ?>" class="back-link">← Back</a>

        <!-- Full Screen Loader -->
        <div id="loaderOverlay">
            <div class="loader-text">Processing...</div>
            <div class="loader"></div>
        </div>
    </div>
</body>
</html>