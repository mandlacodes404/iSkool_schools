<?php
session_start();
require_once 'config.php';

if (!isset($_SESSION['email']) || $_SESSION['role'] !== 'learner') {
    header("Location: index.php"); exit();
}

$learner_email = $_SESSION['email'];
$current_year_id = $conn->query("SELECT id FROM academic_years WHERE is_current = 1")->fetch_assoc()['id'];

$classStmt = $conn->prepare("SELECT class_id FROM class_students WHERE student_email = ? AND academic_year_id = ?");
$classStmt->bind_param("si", $learner_email, $current_year_id);
$classStmt->execute();
$class_id = $classStmt->get_result()->fetch_assoc()['class_id'] ?? null;
$classStmt->close();

if (!$class_id) die("Not enrolled.");

$discussions = $conn->query("
    SELECT d.*, 
           CASE WHEN d.creator_anonymous = 1 THEN 'A classmate' ELSE u.name END AS creator_display
    FROM class_discussions d
    LEFT JOIN users u ON d.creator_email = u.email
    WHERE d.class_id = $class_id
    ORDER BY d.created_at DESC
")->fetch_all(MYSQLI_ASSOC);
?>

<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Class Discussions</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.2/css/all.min.css">
    <style>
        body { font-family: 'Nunito', sans-serif; background: #0d1117; color: #e0e6f0; padding: 20px; }
        .container { max-width: 900px; margin: auto; }
        h1 { text-align: center; color: #4fd1c5; }
        .new-btn { display: block; width: 100%; padding: 15px; background: #4fd1c5; color: black; text-align: center; border-radius: 12px; font-weight: 700; margin: 20px 0; text-decoration: none; }
        .disc-card { background: #161b22; padding: 20px; border-radius: 12px; margin: 15px 0; }
        .disc-title { font-size: 20px; font-weight: 600; color: #4fd1c5; }
        .disc-meta { color: #8b949e; font-size: 14px; margin: 8px 0; }
        .reply-count { background: rgba(79,209,197,0.2); padding: 5px 10px; border-radius: 20px; font-size: 13px; }
    </style>
</head>
<body>
<div class="container">
    <h1><i class="fas fa-comments"></i> Class Discussions</h1>

    <a href="create_discussion.php" class="new-btn"><i class="fas fa-plus"></i> Start New Discussion</a>

    <?php if (empty($discussions)): ?>
        <p style="text-align:center; opacity:0.8;">No discussions yet. Be the first to start one!</p>
    <?php else: foreach ($discussions as $d): 
        $reply_count = $conn->query("SELECT COUNT(*) FROM discussion_replies WHERE discussion_id = {$d['id']}")->fetch_row()[0];
        ?>
        <div class="disc-card">
            <div class="disc-title">
                <a href="view_discussion.php?id=<?= $d['id'] ?>" style="color:inherit; text-decoration:none;">
                    <?= htmlspecialchars($d['title']) ?>
                </a>
            </div>
            <div class="disc-meta">
                Started by <?= htmlspecialchars($d['creator_display']) ?> • 
                <?= date('M j, Y', strtotime($d['created_at'])) ?> • 
                <span class="reply-count"><?= $reply_count ?> <?= $reply_count == 1 ? 'reply' : 'replies' ?></span>
            </div>
            <p style="margin:10px 0; opacity:0.9;"><?= htmlspecialchars(substr($d['initial_message'], 0, 200)) ?><?= strlen($d['initial_message']) > 200 ? '...' : '' ?></p>
        </div>
    <?php endforeach; endif; ?>
</div>
</body>
</html>