<?php
session_start();
include("config.php");

if (!isset($_SESSION['email'])) {
    header("Location: login.php");
    exit();
}

$userRole = $_SESSION['role'] ?? 'user';
$currentUserEmail = $_SESSION['email'];

// Fetch profile picture
$profilePicQuery = mysqli_query($conn, "SELECT profile_pic FROM users WHERE email = '$currentUserEmail' LIMIT 1");
$profilePicRow = mysqli_fetch_assoc($profilePicQuery);
$profilePic = !empty($profilePicRow['profile_pic']) ? $profilePicRow['profile_pic'] : 'uploads/default_profile.png';

// Count unread messages (optional)

?>

<!DOCTYPE html>
<html>
<head>
    <title>Q&A Feed</title>
    <link rel="stylesheet" href="feed_styles.css"> <!-- Move your CSS to an external file for reusability -->
    
</head>
<body>

<div class="container">
    <?php
if (isset($_SESSION['flash_message'])): ?>
    <div class="flash-message">
        <?= htmlspecialchars($_SESSION['flash_message']) ?>
    </div>
<?php
    unset($_SESSION['flash_message']);
endif;
?>

    <div class="top-section">
        <img src="<?= htmlspecialchars($profilePic) ?>" alt="Profile Picture" class="profile-pic-large">
        <div>
            <button class="btn btn-home" onclick="window.location.href='learner_dashboard.php'">Dashboard</button>
            <button class="btn btn-home" onclick="window.location.href='inbox.php'">
                Messages
                
            </button>
            <button class="btn btn-logout" onclick="window.location.href='logout.php'">Logout</button>
        </div>
    </div>

    <h2>Ask a Question</h2>

    <form action="submit_question.php" method="POST" enctype="multipart/form-data" class="post-form">
        <textarea name="content" placeholder="What’s your question?" required class="post-textarea"></textarea>
        <input type="file" name="post_image" accept="image/*">
        <button type="submit" class="post-btn">Post Question</button>
    </form>

    <hr>

    <?php
    $result = mysqli_query($conn, "
        SELECT questions.*, users.profile_pic 
        FROM questions 
        JOIN users ON questions.user_email = users.email 
        ORDER BY questions.created_at DESC
    ");

    if (mysqli_num_rows($result) > 0):
        while ($row = mysqli_fetch_assoc($result)):
            $questionId = $row['id'];
    ?>
    <div class="post" id="post-<?= $questionId ?>">
        <div class="post-author-box">
            <img src="<?= htmlspecialchars($row['profile_pic']) ?>" alt="Profile Picture">
            <strong><?= htmlspecialchars($row['user_email']) ?></strong>
        </div>

        <div class="post-content"><?= nl2br(htmlspecialchars($row['content'])) ?></div>

        <?php if (!empty($row['image_path'])): ?>
            <img src="<?= htmlspecialchars($row['image_path']) ?>" alt="Question Image" class="post-image">
        <?php endif; ?>

        <div class="post-date"><?= htmlspecialchars($row['created_at']) ?></div>

        <!-- Answer form -->
        <form data-post-id="<?= $questionId ?>" class="comment-form">
            <textarea name="comment" rows="2" placeholder="Your answer..." required class="comment-textarea"></textarea>
            <button type="submit" class="comment-btn">Answer</button>
        </form>

        <?php
        $comments = mysqli_query($conn, "
            SELECT answers.*, users.profile_pic 
            FROM answers 
            JOIN users ON answers.user_email = users.email 
            WHERE answers.question_id = $questionId 
            ORDER BY answers.created_at ASC
        ");
        if (mysqli_num_rows($comments) > 0):
        ?>
            <div class="comments-container" id="comments-container-<?= $questionId ?>">
                <div class="comments-title">Answers</div>
                <?php while ($c = mysqli_fetch_assoc($comments)): ?>
                    <div class="comment">
                        <img src="<?= htmlspecialchars($c['profile_pic']) ?>" alt="Profile Picture">
                        <div class="comment-content">
                            <strong><?= htmlspecialchars($c['user_email']) ?></strong>
                            <?= nl2br(htmlspecialchars($c['comment'])) ?>
                            <small><?= htmlspecialchars($c['created_at']) ?></small>
                        </div>
                    </div>
                <?php endwhile; ?>
            </div>
        <?php endif; ?>
    </div>
    <?php endwhile; else: ?>
        <p>No questions posted yet. Be the first to ask!</p>
    <?php endif; ?>
</div>

<script>
document.addEventListener('DOMContentLoaded', function() {
    document.querySelectorAll('.comment-form').forEach(form => {
        form.addEventListener('submit', function(e) {
            e.preventDefault();

            const questionId = this.getAttribute('data-post-id');
            const textarea = this.querySelector('textarea[name="comment"]');
            const commentText = textarea.value.trim();
            if (!commentText) return;

            const formData = new FormData();
            formData.append('question_id', questionId);
            formData.append('comment', commentText);

            fetch('submit_answer.php', {
                method: 'POST',
                body: formData
            })
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    textarea.value = '';

                    const commentsContainer = document.getElementById('comments-container-' + questionId);
                    if (!commentsContainer) {
                        const postDiv = document.getElementById('post-' + questionId);
                        const newContainer = document.createElement('div');
                        newContainer.id = 'comments-container-' + questionId;
                        newContainer.classList.add('comments-container');
                        newContainer.innerHTML = '<div class="comments-title">Answers</div>';
                        postDiv.appendChild(newContainer);
                    }

                    const answerHTML = `
                        <div class="comment">
                            <img src="${data.comment.profile_pic}" alt="Profile Picture">
                            <div class="comment-content">
                                <strong>${data.comment.user_email}</strong>
                                ${data.comment.comment_html}
                                <small>${data.comment.created_at}</small>
                            </div>
                        </div>
                    `;
                    document.getElementById('comments-container-' + questionId)
                        .insertAdjacentHTML('beforeend', answerHTML);
                } else {
                    alert(data.message || "Failed to submit answer.");
                }
            })
            .catch(() => {
                alert("Network error.");
            });
        });
    });
});
</script>

</body>
</html>
