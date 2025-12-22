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

if (!$class_id) {
    $message = "You are not enrolled in any class.";
} else {
    // Get active evaluations for this class
    $stmt = $conn->prepare("SELECT * FROM teacher_evaluations WHERE class_id = ? AND is_active = 1");
    $stmt->bind_param("i", $class_id);
    $stmt->execute();
    $evals = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
    $stmt->close();
}

// Handle submission
if ($_SERVER['REQUEST_METHOD'] === 'POST' && $class_id) {
    $eval_id = (int)$_POST['eval_id'];
    $comments = trim($_POST['comments'] ?? '');

    // Generate anonymous unique hash (prevents duplicates)
    $hash = hash('sha256', $learner_email . $eval_id . 'salt123');

    // Check if already submitted
    $check = $conn->prepare("SELECT 1 FROM evaluation_responses WHERE evaluation_id = ? AND unique_hash = ?");
    $check->bind_param("is", $eval_id, $hash);
    $check->execute();
    if ($check->get_result()->num_rows > 0) {
        $message = "You have already submitted this evaluation.";
    } else {
        // Insert response
        $stmt = $conn->prepare("INSERT INTO evaluation_responses (evaluation_id, class_id, comments, unique_hash) VALUES (?, ?, ?, ?)");
        $stmt->bind_param("iiss", $eval_id, $class_id, $comments, $hash);
        $stmt->execute();
        $response_id = $stmt->insert_id;
        $stmt->close();

        // Insert answers
        $stmt = $conn->prepare("INSERT INTO evaluation_answers (response_id, statement_id, answer) VALUES (?, ?, ?)");
        foreach ($_POST['answer'] ?? [] as $stmt_id => $answer) {
            $stmt_id = (int)$stmt_id;
            $stmt->bind_param("iis", $response_id, $stmt_id, $answer);
            $stmt->execute();
        }
        $stmt->close();

        $message = "Thank you! Your feedback has been submitted anonymously.";
    }
}
?>

<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Teacher Evaluations</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.2/css/all.min.css">
    <style>
        body { font-family: 'Nunito', sans-serif; background: #0d1117; color: #e0e6f0; padding: 20px; }
        .container { max-width: 800px; margin: auto; }
        .eval-card { background: #161b22; padding: 20px; border-radius: 12px; margin: 20px 0; }
        .statement { margin: 20px 0; }
        .options { display: flex; justify-content: space-between; flex-wrap: wrap; gap: 10px; margin-top: 10px; }
        .options label { flex: 1; min-width: 120px; text-align: center; }
        textarea { width: 100%; padding: 10px; background: #0d1117; border: 1px solid #30363d; border-radius: 8px; color: #e0e6f0; margin-top: 20px; }
        button { width: 100%; padding: 15px; background: #4fd1c5; color: black; font-weight: 700; border: none; border-radius: 10px; margin-top: 20px; }
    </style>
</head>
<body>
<div class="container">
    <h1 style="text-align:center; color:#4fd1c5;"><i class="fas fa-poll"></i> Teacher Evaluations</h1>

    <?php if (isset($message)): ?>
        <p style="text-align:center; padding:15px; background:#238636; border-radius:10px;"><?= htmlspecialchars($message) ?></p>
    <?php endif; ?>

    <?php if (!$class_id): ?>
        <p style="text-align:center;">You are not enrolled in a class yet.</p>
    <?php elseif (empty($evals)): ?>
        <p style="text-align:center;">No active evaluations at the moment.</p>
    <?php else: foreach ($evals as $eval): ?>
        <?php
        $stmt = $conn->prepare("SELECT * FROM evaluation_statements WHERE evaluation_id = ? ORDER BY order_num");
        $stmt->bind_param("i", $eval['id']);
        $stmt->execute();
        $statements = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
        $stmt->close();
        ?>
        <div class="eval-card">
            <h2><?= htmlspecialchars($eval['title']) ?></h2>
            <?php if ($eval['description']): ?>
                <p><?= nl2br(htmlspecialchars($eval['description'])) ?></p>
            <?php endif; ?>

            <form method="POST">
                <input type="hidden" name="eval_id" value="<?= $eval['id'] ?>">
                <?php foreach ($statements as $stmt): ?>
                    <div class="statement">
                        <strong><?= htmlspecialchars($stmt['statement']) ?></strong>
                        <div class="options">
                            <label><input type="radio" name="answer[<?= $stmt['id'] ?>]" value="strongly_agree" required> Strongly Agree</label>
                            <label><input type="radio" name="answer[<?= $stmt['id'] ?>]" value="agree"> Agree</label>
                            <label><input type="radio" name="answer[<?= $stmt['id'] ?>]" value="neutral"> Neutral</label>
                            <label><input type="radio" name="answer[<?= $stmt['id'] ?>]" value="disagree"> Disagree</label>
                            <label><input type="radio" name="answer[<?= $stmt['id'] ?>]" value="strongly_disagree"> Strongly Disagree</label>
                        </div>
                    </div>
                <?php endforeach; ?>

                <label>Additional Comments (optional, anonymous)</label>
                <textarea name="comments" rows="4" placeholder="Anything else you'd like to share?"></textarea>

                <button type="submit">Submit Evaluation</button>
            </form>
        </div>
    <?php endforeach; endif; ?>
</div>
</body>
</html>