<?php
session_start();
include("config.php");

// Check if user is logged in
if (!isset($_SESSION['email'])) {
    header("Location: index.php");
    exit();
}

// Fetch blog posts
$result = $conn->query("SELECT * FROM school_blog ORDER BY created_at DESC");
?>

<h2>📢 School News & Updates</h2>

<?php while ($row = $result->fetch_assoc()): ?>
    <div style="border:1px solid #ccc; padding:15px; margin-bottom:20px; border-radius:10px;">
        <h3><?= htmlspecialchars($row['title']) ?></h3>
        <small>Posted by: <?= htmlspecialchars($row['posted_by']) ?> | <?= $row['created_at'] ?></small><br><br>
        
        <?php if (!empty($row['image_path'])): ?>
            <img src="<?= htmlspecialchars($row['image_path']) ?>" alt="News Image" style="max-width: 100%; height:auto;"><br><br>
        <?php endif; ?>

        <p><?= nl2br(htmlspecialchars($row['content'])) ?></p>

        <a href="blog_post.php?id=<?= $row['id'] ?>">💬 View & Comment</a>
    </div>
<?php endwhile; ?>
