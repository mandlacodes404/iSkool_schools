<?php
session_start();
include("config.php");

if (!isset($_GET['id'])) {
    echo "No blog post selected.";
    exit();
}

$postId = intval($_GET['id']);

// Fetch the blog post
$stmt = $conn->prepare("SELECT * FROM school_blog WHERE id = ?");
$stmt->bind_param("i", $postId);
$stmt->execute();
$post = $stmt->get_result()->fetch_assoc();

if (!$post) {
    echo "Post not found.";
    exit();
}

// Handle new comment from learner
if ($_SERVER['REQUEST_METHOD'] === 'POST' && $_SESSION['role'] === 'learner') {
    $commenter = $_SESSION['email'];
    $comment = trim($_POST['comment']);

    if (!empty($comment)) {
        $stmt = $conn->prepare("INSERT INTO blog_comments (blog_id, commenter_email, comment) VALUES (?, ?, ?)");
        $stmt->bind_param("iss", $postId, $commenter, $comment);
        $stmt->execute();
    }
}

// Fetch comments
$comments = $conn->prepare("SELECT * FROM blog_comments WHERE blog_id = ? ORDER BY created_at ASC");
$comments->bind_param("i", $postId);
$comments->execute();
$commentResults = $comments->get_result();
?>

<!DOCTYPE html>
<html>
<head>
    <title>School Blog Post</title>
    <meta charset="UTF-8">
    <style>
        body {
            font-family: 'Segoe UI', sans-serif;
            background: #f9f9f9;
            margin: 0;
            padding: 20px;
        }

        .blog-container {
            max-width: 800px;
            margin: auto;
            background: white;
            border-radius: 12px;
            box-shadow: 0 4px 10px rgba(0,0,0,0.1);
            padding: 30px;
        }

        .blog-title {
            font-size: 28px;
            font-weight: bold;
            color: #333;
            margin-bottom: 10px;
        }

        .blog-meta {
            color: #888;
            font-size: 14px;
            margin-bottom: 20px;
        }

        .blog-image {
            max-width: 100%;
            border-radius: 8px;
            margin: 20px 0;
        }

        .blog-content {
            font-size: 17px;
            line-height: 1.6;
            color: #444;
            margin-bottom: 30px;
        }

        .comments-section {
            margin-top: 40px;
        }

        .comment-box {
            width: 100%;
            padding: 12px;
            font-size: 16px;
            border: 1px solid #ccc;
            border-radius: 8px;
            resize: vertical;
            margin-bottom: 10px;
        }

        .comment-btn {
            background-color: #007bff;
            color: white;
            border: none;
            padding: 10px 16px;
            font-size: 15px;
            border-radius: 6px;
            cursor: pointer;
        }

        .comment-btn:hover {
            background-color: #0056b3;
        }

        .comment {
            background: #f1f1f1;
            border-radius: 8px;
            padding: 12px 15px;
            margin-bottom: 15px;
        }

        .comment strong {
            color: #007bff;
        }

        .comment small {
            display: block;
            color: #666;
            margin-top: 5px;
            font-size: 13px;
        }

        .comment-header {
            font-weight: bold;
        }
    </style>
</head>
<body>

<div class="blog-container">
    <div class="blog-title"><?= htmlspecialchars($post['title']) ?></div>
    <div class="blog-meta">Posted by <?= htmlspecialchars($post['posted_by']) ?> on <?= $post['created_at'] ?></div>

    <?php if (!empty($post['image_path'])): ?>
        <img src="<?= htmlspecialchars($post['image_path']) ?>" class="blog-image">
    <?php endif; ?>

    <div class="blog-content"><?= nl2br(htmlspecialchars($post['content'])) ?></div>

    <div class="comments-section">
        <h3>💬 Comments</h3>

        <?php if ($_SESSION['role'] === 'learner'): ?>
            <form method="POST">
                <textarea class="comment-box" name="comment" placeholder="Write your comment..." required></textarea><br>
                <button type="submit" class="comment-btn">Post Comment</button>
            </form>
        <?php else: ?>
            <p><i>Only learners can comment on blog posts.</i></p>
        <?php endif; ?>

        <br>

        <?php while ($row = $commentResults->fetch_assoc()): ?>
            <div class="comment">
                <div class="comment-header"><?= htmlspecialchars($row['commenter_email']) ?></div>
                <p><?= nl2br(htmlspecialchars($row['comment'])) ?></p>
                <small><?= $row['created_at'] ?></small>
            </div>
        <?php endwhile; ?>
    </div>
</div>

</body>
</html>
