<?php
session_start();
require_once 'config.php';

if (!isset($_SESSION['email']) || $_SESSION['role'] !== 'learner') {
    header("Location: index.php"); exit();
}

$learner_email = $_SESSION['email'];
$current_year_id = $conn->query("SELECT id FROM academic_years WHERE is_current = 1")->fetch_assoc()['id'] ?? 0;

$classStmt = $conn->prepare("SELECT class_id FROM class_students WHERE student_email = ? AND academic_year_id = ?");
if ($current_year_id > 0) {
    $classStmt->bind_param("si", $learner_email, $current_year_id);
} else {
    $classStmt->bind_param("s", $learner_email);
}
$classStmt->execute();
$class_id = $classStmt->get_result()->fetch_assoc()['class_id'] ?? null;
$classStmt->close();

if (!$class_id) die("Not enrolled.");

// ────── SAFE QUERY FOR DISCUSSIONS ──────
$stmt = $conn->prepare("
    SELECT d.*, 
           CASE WHEN d.creator_anonymous = 1 THEN 'A classmate' ELSE COALESCE(u.name, 'Learner') END AS creator_display
    FROM class_discussions d
    LEFT JOIN users u ON d.creator_email = u.email
    WHERE d.class_id = ?
    ORDER BY d.created_at DESC
");
$stmt->bind_param("i", $class_id);
$stmt->execute();
$discussions_result = $stmt->get_result();
$discussions = $discussions_result->fetch_all(MYSQLI_ASSOC);
$stmt->close();

// ────────────────────── MOBILE DETECTION ──────────────────────
$user_agent = $_SERVER['HTTP_USER_AGENT'] ?? '';
$is_mobile = preg_match("/(android|iphone|ipad|ipod|webos|windows phone|mobile)/i", $user_agent);
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Class Discussions</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.2/css/all.min.css">
    <style>
        body { font-family: 'Nunito', sans-serif; background: #0d1117; color: #e0e6f0; padding: 20px; margin: 0; }
        .container { max-width: 900px; margin: auto; }
        h1 { text-align: center; color: #4fd1c5; margin-bottom: 30px; }
        .new-btn { 
            display: block; width: 100%; padding: 15px; background: #4fd1c5; color: black; 
            text-align: center; border-radius: 12px; font-weight: 700; margin: 20px 0; 
            text-decoration: none; font-size: 18px;
        }
        .disc-card { 
            background: #161b22; padding: 20px; border-radius: 12px; margin: 15px 0; 
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        }
        .disc-title { 
            font-size: 20px; font-weight: 600; color: #4fd1c5; margin-bottom: 8px;
        }
        .disc-title a { color: inherit; text-decoration: none; }
        .disc-title a:hover { opacity: 0.8; }
        .disc-meta { color: #8b949e; font-size: 14px; margin: 8px 0; display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }
        .reply-count { 
            background: rgba(79,209,197,0.2); padding: 5px 12px; border-radius: 20px; 
            font-size: 13px; font-weight: 600;
        }
        .preview-text { margin: 10px 0; opacity: 0.9; line-height: 1.5; }
        .no-discussions { text-align: center; opacity: 0.7; font-size: 16px; }
    </style>
</head>
<body>
<div class="container">
    <h1><i class="fas fa-comments"></i> Class Discussions</h1>

    <a href="create_discussion.php" class="new-btn">
        <i class="fas fa-plus"></i> Start New Discussion
    </a>

    <?php if (empty($discussions)): ?>
        <p class="no-discussions">No discussions yet. Be the first to start one!</p>
    <?php else: foreach ($discussions as $d): 
        // Safe reply count
        $reply_stmt = $conn->prepare("SELECT COUNT(*) FROM discussion_replies WHERE discussion_id = ?");
        $reply_stmt->bind_param("i", $d['id']);
        $reply_stmt->execute();
        $reply_count = $reply_stmt->get_result()->fetch_row()[0] ?? 0;
        $reply_stmt->close();

        $target = $is_mobile ? 'target="_blank"' : '';  // Open in new tab only on mobile
        ?>
        <div class="disc-card">
            <div class="disc-title">
                <a href="view_discussion.php?id=<?= $d['id'] ?>" <?= $target ?>>
                    <?= htmlspecialchars($d['title']) ?>
                </a>
            </div>
            <div class="disc-meta">
                <span>Started by <?= htmlspecialchars($d['creator_display']) ?></span>
                <span>•</span>
                <span><?= date('M j, Y', strtotime($d['created_at'])) ?></span>
                <span>•</span>
                <span class="reply-count"><?= $reply_count ?> <?= $reply_count == 1 ? 'reply' : 'replies' ?></span>
            </div>
            <p class="preview-text">
                <?= htmlspecialchars(substr($d['initial_message'], 0, 200)) ?>
                <?= strlen($d['initial_message']) > 200 ? '...' : '' ?>
            </p>
        </div>
    <?php endforeach; endif; ?>
</div>
</body>
</html>