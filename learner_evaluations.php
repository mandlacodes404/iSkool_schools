<?php
session_start();
require_once 'config.php';

if (!isset($_SESSION['email']) || $_SESSION['role'] !== 'learner') {
    header("Location: index.php"); exit();
}

$learner_email = $_SESSION['email'];
$current_academic_year_id = $conn->query("SELECT id FROM academic_years WHERE is_current = 1 LIMIT 1")->fetch_assoc()['id'];

// Get learner's class
$classStmt = $conn->prepare("SELECT class_id FROM class_students WHERE student_email = ? AND academic_year_id = ?");
$classStmt->bind_param("si", $learner_email, $current_academic_year_id);
$classStmt->execute();
$class_id = $classStmt->get_result()->fetch_assoc()['class_id'] ?? null;
$classStmt->close();

$message = "";

if ($class_id) {
    $stmt = $conn->prepare("
        SELECT te.*, u.name AS teacher_name, CONCAT(COALESCE(u.title,''), ' ', u.surname) AS teacher_full 
        FROM teacher_evaluations te
        JOIN users u ON te.created_by = u.email
        WHERE te.class_id = ? AND te.is_active = 1
        ORDER BY te.created_at DESC
    ");
    $stmt->bind_param("i", $class_id);
    $stmt->execute();
    $evals = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
    $stmt->close();
}

// Handle submission
if ($_SERVER['REQUEST_METHOD'] === 'POST' && $class_id) {
    $eval_id = (int)$_POST['eval_id'];
    $comments = trim($_POST['comments'] ?? '');

    $hash = hash('sha256', $learner_email . $eval_id . 'salt123');

    $check = $conn->prepare("SELECT 1 FROM evaluation_responses WHERE evaluation_id = ? AND unique_hash = ?");
    $check->bind_param("is", $eval_id, $hash);
    $check->execute();
    if ($check->get_result()->num_rows > 0) {
        $message = "You have already submitted this evaluation.";
    } else {
        $stmt = $conn->prepare("INSERT INTO evaluation_responses (evaluation_id, class_id, comments, unique_hash) VALUES (?, ?, ?, ?)");
        $stmt->bind_param("iiss", $eval_id, $class_id, $comments, $hash);
        $stmt->execute();
        $response_id = $stmt->insert_id;
        $stmt->close();

        $stmt = $conn->prepare("INSERT INTO evaluation_answers (response_id, statement_id, answer) VALUES (?, ?, ?)");
        foreach ($_POST['answer'] ?? [] as $stmt_id => $answer) {
            $stmt_id = (int)$stmt_id;
            $stmt->bind_param("iis", $response_id, $stmt_id, $answer);
            $stmt->execute();
        }
        $stmt->close();

        $message = "Thank you! Your feedback has been submitted anonymously.";
    }
    header("Location: " . $_SERVER['PHP_SELF']);
    exit();
}
?>

<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Teacher Evaluations</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.2/css/all.min.css">
    <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@600;700&display=swap" rel="stylesheet">
    <style>
        :root {
            --bg: #0d1117;
            --card: #161b22;
            --text: #e0e6f0;
            --accent: #4fd1c5;
            --accent-dark: #3ab8ac;
            --success: #1ed760;
            --border: #30363d;
            --hover: #21262d;
        }
        body { font-family: 'Nunito', sans-serif; background: var(--bg); color: var(--text); padding: 20px; margin: 0; }
        .container { max-width: 900px; margin: 0 auto; }
        h1 { text-align: center; font-size: 32px; color: var(--accent); margin: 40px 0 30px; }

        .eval-card {
            background: var(--card);
            border-radius: 16px;
            padding: 30px;
            margin: 25px 0;
            box-shadow: 0 8px 25px rgba(0,0,0,0.4);
            border: 1px solid var(--border);
        }
        .eval-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 20px;
        }
        .eval-title {
            font-size: 24px;
            font-weight: 700;
            color: var(--accent);
            margin: 0;
        }
        .teacher-name {
            font-size: 16px;
            color: #8b949e;
            margin-top: 6px;
        }
        .completed {
            background: rgba(30,215,96,0.2);
            color: var(--success);
            padding: 10px 18px;
            border-radius: 30px;
            font-weight: 700;
            font-size: 15px;
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .description {
            background: rgba(79,209,197,0.1);
            padding: 15px;
            border-radius: 10px;
            margin-bottom: 30px;
            font-style: italic;
            opacity: 0.9;
            border-left: 4px solid var(--accent);
        }

        .statement {
            margin: 30px 0;
        }
        .question-text {
            font-size: 18px;
            font-weight: 600;
            margin-bottom: 15px;
            padding: 15px;
            background: rgba(33,38,45,0.6);
            border-radius: 10px;
            border-left: 4px solid var(--accent);
        }

        .options {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
            gap: 12px;
        }
        .option-label {
            display: block;
            text-align: center;
        }
        .option-label input[type="radio"] {
            display: none;
        }
        .option-label span {
            display: block;
            padding: 14px 10px;
            background: var(--hover);
            border-radius: 12px;
            cursor: pointer;
            transition: all 0.3s ease;
            font-weight: 600;
            border: 2px solid transparent;
        }
        .option-label input[type="radio"]:checked + span {
            background: var(--accent);
            color: black;
            border-color: var(--accent-dark);
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(79,209,197,0.4);
        }
        .option-label span:hover {
            background: #2a323c;
        }

        .comments-section {
            margin-top: 35px;
        }
        .comments-section label {
            font-size: 17px;
            font-weight: 600;
            display: block;
            margin-bottom: 10px;
        }
        textarea {
            width: 100%;
            padding: 15px;
            background: var(--hover);
            border: 1px solid var(--border);
            border-radius: 12px;
            color: var(--text);
            font-family: inherit;
            font-size: 15px;
            resize: vertical;
            min-height: 120px;
        }
        textarea::placeholder { opacity: 0.7; }

        button[type="submit"] {
            width: 100%;
            padding: 18px;
            background: var(--accent);
            color: black;
            font-weight: 700;
            font-size: 18px;
            border: none;
            border-radius: 14px;
            margin-top: 30px;
            cursor: pointer;
            transition: all 0.3s;
            box-shadow: 0 6px 20px rgba(79,209,197,0.3);
        }
        button[type="submit"]:hover {
            background: var(--accent-dark);
            transform: translateY(-2px);
            box-shadow: 0 10px 25px rgba(79,209,197,0.5);
        }

        .thank-you {
            text-align: center;
            padding: 40px;
            font-size: 20px;
            color: var(--success);
            font-style: italic;
        }

        @media (max-width: 768px) {
            .options { grid-template-columns: 1fr; }
            .eval-title { font-size: 22px; }
            h1 { font-size: 28px; }
        }
    </style>
</head>
<body>
<div class="container">
    <h1><i class="fas fa-poll"></i> Teacher Evaluations</h1>

    <?php if ($message): ?>
        <p style="text-align:center; padding:18px; background:rgba(30,215,96,0.2); border:2px solid var(--success); border-radius:12px; margin:20px 0; font-size:18px;">
            <?= htmlspecialchars($message) ?>
        </p>
    <?php endif; ?>

    <?php if (!$class_id): ?>
        <p style="text-align:center; font-size:18px; opacity:0.8;">You are not enrolled in a class yet.</p>

    <?php elseif (empty($evals)): ?>
        <p style="text-align:center; font-size:18px; opacity:0.8;">No active evaluations at the moment.</p>

    <?php else: foreach ($evals as $eval):
        $eval_id = $eval['id'];
        $teacher_display = trim($eval['teacher_full'] ?: $eval['teacher_name'] ?: 'Teacher');

        $hash = hash('sha256', $learner_email . $eval_id . 'salt123');
        $check = $conn->query("SELECT 1 FROM evaluation_responses WHERE evaluation_id = $eval_id AND unique_hash = '$hash'");
        $submitted = $check->num_rows > 0;
        ?>
        <div class="eval-card">
            <div class="eval-header">
                <div>
                    <div class="eval-title"><?= htmlspecialchars($eval['title']) ?></div>
                    <div class="teacher-name">by <?= htmlspecialchars($teacher_display) ?></div>
                </div>
                <?php if ($submitted): ?>
                    <div class="completed"><i class="fas fa-check-circle"></i> Completed</div>
                <?php endif; ?>
            </div>

            <?php if ($submitted): ?>
                <div class="thank-you">
                    <i class="fas fa-heart" style="font-size:48px; margin-bottom:15px; color:var(--success);"></i><br>
                    Thank you for your valuable feedback!
                </div>

            <?php else:
                $stmt = $conn->prepare("SELECT * FROM evaluation_statements WHERE evaluation_id = ? ORDER BY order_num");
                $stmt->bind_param("i", $eval_id);
                $stmt->execute();
                $statements = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
                $stmt->close();
                ?>

                <?php if ($eval['description']): ?>
                    <div class="description"><?= nl2br(htmlspecialchars($eval['description'])) ?></div>
                <?php endif; ?>

                <form method="POST">
                    <input type="hidden" name="eval_id" value="<?= $eval_id ?>">

                    <?php foreach ($statements as $stmt): ?>
                        <div class="statement">
                            <div class="question-text"><?= htmlspecialchars($stmt['statement']) ?></div>
                            <div class="options">
                                <label class="option-label">
                                    <input type="radio" name="answer[<?= $stmt['id'] ?>]" value="strongly_agree" required>
                                    <span>Strongly Agree</span>
                                </label>
                                <label class="option-label">
                                    <input type="radio" name="answer[<?= $stmt['id'] ?>]" value="agree">
                                    <span>Agree</span>
                                </label>
                                <label class="option-label">
                                    <input type="radio" name="answer[<?= $stmt['id'] ?>]" value="neutral">
                                    <span>Neutral</span>
                                </label>
                                <label class="option-label">
                                    <input type="radio" name="answer[<?= $stmt['id'] ?>]" value="disagree">
                                    <span>Disagree</span>
                                </label>
                                <label class="option-label">
                                    <input type="radio" name="answer[<?= $stmt['id'] ?>]" value="strongly_disagree">
                                    <span>Strongly Disagree</span>
                                </label>
                            </div>
                        </div>
                    <?php endforeach; ?>

                    <div class="comments-section">
                        <label>Additional Comments <em>(optional • fully anonymous)</em></label>
                        <textarea name="comments" rows="5" placeholder="Share any thoughts, suggestions, or appreciation..."></textarea>
                    </div>

                    <button type="submit">
                        <i class="fas fa-paper-plane"></i> Submit Feedback
                    </button>
                </form>
            <?php endif; ?>
        </div>
    <?php endforeach; endif; ?>
</div>
</body>
</html>