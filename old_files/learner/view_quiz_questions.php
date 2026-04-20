<?php
session_start();
require_once 'config.php';

if (!isset($_SESSION['email']) || $_SESSION['role'] !== 'teacher') {
    header("Location: index.php");
    exit();
}

$quiz_id = isset($_GET['quiz_id']) ? intval($_GET['quiz_id']) : 0;

if ($quiz_id <= 0) {
    echo "Invalid quiz ID.";
    exit();
}

// Fetch quiz info
$quiz_stmt = $conn->prepare("SELECT title FROM quizzes WHERE id = ?");
$quiz_stmt->bind_param("i", $quiz_id);
$quiz_stmt->execute();
$quiz_stmt->store_result();

if ($quiz_stmt->num_rows === 0) {
    echo "Quiz not found.";
    exit();
}

$quiz_stmt->bind_result($quiz_title);
$quiz_stmt->fetch();

// Fetch questions and choices
$q_stmt = $conn->prepare("
    SELECT q.id, q.question_text, q.image_path, c.id AS choice_id, c.choice_text, c.is_correct
    FROM quizquestions q
    LEFT JOIN choices c ON q.id = c.question_id
    WHERE q.quiz_id = ?
    ORDER BY q.id, c.id
");
$q_stmt->bind_param("i", $quiz_id);
$q_stmt->execute();
$result = $q_stmt->get_result();

$questions = [];
while ($row = $result->fetch_assoc()) {
    $qid = $row['id'];
    if (!isset($questions[$qid])) {
        $questions[$qid] = [
            'text' => $row['question_text'],
            'image' => $row['image_path'],
            'choices' => []
        ];
    }
    $questions[$qid]['choices'][] = [
        'id' => $row['choice_id'],
        'text' => $row['choice_text'],
        'is_correct' => $row['is_correct']
    ];
}
?>

<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Questions for: <?= htmlspecialchars($quiz_title) ?></title>
    <style>
        body { font-family: Arial, sans-serif; margin: 30px; background: #f4f6f8; }
        h2 { color: #333; }
        .question { background: white; padding: 15px; margin-bottom: 20px; border-radius: 8px; }
        .question img { max-width: 100%; height: auto; margin-top: 10px; }
        ul { list-style-type: none; padding-left: 0; }
        li.correct { font-weight: bold; color: green; }
        a.back-link { text-decoration: none; color: #2980b9; }

        .loader {
    border: 6px solid #f3f3f3;
    border-top: 6px solid #58a6ff; /* blue spinner */
    border-radius: 50%;
    width: 60px;
    height: 60px;
    animation: spin 1s linear infinite;
    margin-top: 12px;
}

.loader-text {
    color: #c9d1d9;
    font-size: 18px;
    font-weight: bold;
    text-align: center;
}

/* Spinner animation */
@keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
}
    </style>
</head>
<body>

    <h2>Quiz: <?= htmlspecialchars($quiz_title) ?></h2>
    <a class="back-link" href="teacher_quizzes.php">&larr; Back to quizzes</a>

    <?php foreach ($questions as $qid => $q): ?>
        <div class="question">
            <p><strong>Question:</strong> <?= htmlspecialchars($q['text']) ?></p>
            <?php if ($q['image']): ?>
                <img src="<?= htmlspecialchars($q['image']) ?>" alt="Question Image">
            <?php endif; ?>
            <ul>
                <?php foreach ($q['choices'] as $choice): ?>
                    <li class="<?= $choice['is_correct'] ? 'correct' : '' ?>">
                        <?= htmlspecialchars($choice['text']) ?>
                        <?= $choice['is_correct'] ? "&#10004;" : "" /* check mark for correct */ ?>
                    </li>
                <?php endforeach; ?>
            </ul>
        </div>
    <?php endforeach; ?>
<footer style="margin-top: 60px; text-align: center; color: var(--text-color); opacity: 0.6; font-size: 14px;">
    Powered by <a href="#" style="color: var(--accent-color); text-decoration: none;"><strong>iSkool</strong></a> 🚀
</footer>

<!-- Full Screen Loader -->
<div id="loaderOverlay">
    <div class="loader-text">Processing...</div>
    <div class="loader"></div>
</div>

<script>
const form = document.querySelector("form");
const loader = document.getElementById("loaderOverlay");

form.addEventListener("submit", () => {
    loader.style.display = "flex"; // show overlay
});
</script>
</body>
</html>
