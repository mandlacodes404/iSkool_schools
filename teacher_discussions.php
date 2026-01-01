<?php
session_start();
require_once 'config.php';

if (!isset($_SESSION['email']) || $_SESSION['role'] !== 'teacher') {
    header("Location: index.php"); exit();
}

$teacher_email = $_SESSION['email'];

// Get teacher's tagged discussions with class name
$discussions = $conn->query("
    SELECT d.*, c.name as class_name, COUNT(r.id) as reply_count
    FROM class_discussions d
    JOIN discussion_teachers dt ON d.id = dt.discussion_id
    JOIN classes c ON d.class_id = c.id
    LEFT JOIN discussion_replies r ON d.id = r.discussion_id
    WHERE dt.teacher_email = '$teacher_email'
    GROUP BY d.id
    ORDER BY d.created_at DESC
")->fetch_all(MYSQLI_ASSOC);

// Get reports for teacher's tagged discussions
$reports = $conn->query("
    SELECT dr.*, d.title, r.message as reply_text, u.name as reporter_name
    FROM discussion_reports dr
    LEFT JOIN class_discussions d ON dr.discussion_id = d.id
    LEFT JOIN discussion_replies r ON dr.reply_id = r.id
    LEFT JOIN users u ON dr.reporter_email = u.email
    WHERE d.id IN (SELECT discussion_id FROM discussion_teachers WHERE teacher_email = '$teacher_email')
    ORDER BY dr.reported_at DESC
")->fetch_all(MYSQLI_ASSOC);

// ——————— MOBILE DETECTION (same as learner side) ———————
$user_agent = $_SERVER['HTTP_USER_AGENT'] ?? '';
$is_mobile = preg_match("/(android|iphone|ipad|ipod|webos|windows phone|mobile)/i", $user_agent);
?>

<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Moderate Discussions</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.2/css/all.min.css">
    <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@600;700&display=swap" rel="stylesheet">
    <style>
        body { font-family: 'Nunito', sans-serif; background: #0d1117; color: #e0e6f0; padding: 20px; margin: 0; }
        .container { max-width: 900px; margin: auto; }
        h1 { text-align: center; color: #4fd1c5; margin: 40px 0 30px; font-size: 32px; }
        h2 { color: #4fd1c5; margin: 40px 0 20px; font-size: 24px; }

        .report { 
            background: rgba(248,81,73,0.2); 
            padding: 20px; 
            border-radius: 12px; 
            margin: 15px 0; 
            border-left: 5px solid #f85149; 
        }
        .report strong { color: #ffd43b; }

        .disc-card { 
            background: #161b22; 
            padding: 25px; 
            border-radius: 12px; 
            margin: 20px 0; 
            box-shadow: 0 4px 15px rgba(0,0,0,0.3);
            border-left: 4px solid #4fd1c5;
        }
        .disc-card h3 { margin: 0 0 15px 0; font-size: 22px; }
        .disc-card h3 a { color: #4fd1c5; text-decoration: none; }
        .disc-card h3 a:hover { text-decoration: underline; }
        .disc-meta { color: #8b949e; font-size: 15px; }
        .no-data { text-align: center; opacity: 0.8; font-size: 18px; margin: 40px 0; }
    </style>
</head>
<body>
<div class="container">
    <h1><i class="fas fa-comments"></i> Moderate Discussions</h1>

    <h2>Reports</h2>
    <?php if (empty($reports)): ?>
        <p class="no-data">No reports yet — great job keeping things respectful!</p>
    <?php else: foreach ($reports as $rep): ?>
        <div class="report">
            <strong>Reason:</strong> <?= ucfirst(str_replace('_', ' ', $rep['reason'])) ?><br>
            <strong>Reported by:</strong> <?= htmlspecialchars($rep['reporter_name'] ?? 'Learner') ?><br>
            <?= $rep['reply_text'] 
                ? '<strong>Post:</strong> ' . nl2br(htmlspecialchars($rep['reply_text'])) 
                : '<strong>Discussion:</strong> ' . htmlspecialchars($rep['title']) ?><br>
            <?= $rep['comment'] ? '<strong>Comment:</strong> ' . nl2br(htmlspecialchars($rep['comment'])) : '' ?>
        </div>
    <?php endforeach; endif; ?>

    <h2>Your Tagged Discussions</h2>
    <?php if (empty($discussions)): ?>
        <p class="no-data">You haven't been tagged in any discussions yet.</p>
<?php else: foreach ($discussions as $d): ?>
    <div class="disc-card">
        <h3>
            <a href="view_discussion.php?id=<?= $d['id'] ?>" <?= $is_mobile ? 'target="_blank"' : '' ?>>
                <?= htmlspecialchars($d['title']) ?>
            </a>
        </h3>
        <div class="disc-meta">
            Class: <strong><?= htmlspecialchars($d['class_name']) ?></strong> • 
            Replies: <strong><?= $d['reply_count'] ?></strong> • 
            Created: <?= date('M j, Y', strtotime($d['created_at'])) ?>
        </div>
    </div>
<?php endforeach; endif; ?>
</div>
</body>
</html>