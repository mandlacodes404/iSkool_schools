<?php
session_start();
require_once 'config.php';

// Ensure only logged-in users can view (admin or any role)
if (!isset($_SESSION['role']) && !isset($_SESSION['school_admin'])) {
    header("Location: index.php");
    exit();
}

$userId = $_SESSION['user_id'] ?? 0;
$term   = (int)($_GET['term'] ?? 1);

// Clean up old session key
unset($_SESSION['school_id']);

// Fetch achievers for current term — NO school_id needed
$stmt = $conn->prepare("
    SELECT 
        a.id, 
        a.full_name, 
        a.class, 
        a.medal, 
        a.profile_picture,
        COALESCE(lc.likes_count, 0) AS likes_count,
        COALESCE(cc.comments_count, 0) AS comments_count
    FROM top_achievers a
    LEFT JOIN (
        SELECT achiever_id, COUNT(*) AS likes_count
        FROM achiever_likes
        GROUP BY achiever_id
    ) lc ON a.id = lc.achiever_id
    LEFT JOIN (
        SELECT achiever_id, COUNT(*) AS comments_count
        FROM achiever_comments
        GROUP BY achiever_id
    ) cc ON a.id = cc.achiever_id
    WHERE a.term = ?
    ORDER BY a.class ASC, FIELD(a.medal, 'Gold', 'Silver', 'Bronze')
");
$stmt->bind_param("i", $term);
$stmt->execute();
$result = $stmt->get_result();

$achievers = [];
while ($row = $result->fetch_assoc()) {
    $achievers[] = $row;
}
$stmt->close();

// Fetch which achievers current user has liked (in current school = current DB)
$userLikes = [];
if ($userId > 0) {
    $stmt = $conn->prepare("
        SELECT achiever_id, COUNT(*) 
        FROM achiever_likes 
        WHERE user_id = ? 
        GROUP BY achiever_id
    ");
    $stmt->bind_param("i", $userId);
    $stmt->execute();
    $res = $stmt->get_result();
    while ($r = $res->fetch_assoc()) {
        $userLikes[] = $r['achiever_id'];
    }
    $stmt->close();
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Top Achievers Feed</title>
<style>
body { font-family: Arial, sans-serif; background: #0d1117; color: #e0e6f0; padding: 20px; margin: 0; }
h3 { color: #f4f6f8ff; margin-bottom: 20px; }
.term-select { margin-bottom: 20px; }
.term-select select { padding: 8px; border-radius: 8px; border: none; outline: none; font-size: 10px; }

/* Feed container vertical */
.feed-container { display: flex; flex-direction: column; gap: 16px; max-height: 80vh; overflow-y: auto; padding-right: 8px; margin-bottom: 60px}
.feed-container::-webkit-scrollbar { width: 8px; }
.feed-container::-webkit-scrollbar-thumb { background: rgba(200,200,200,0.3); border-radius: 4px; }
.feed-container::-webkit-scrollbar-track { background: transparent; }

/* Achiever card */
.achiever-card { display: flex; align-items: flex-start; gap: 12px; background: rgba(22,27,34,0.9); border-radius: 12px; padding: 12px; box-shadow: 0 0 15px rgba(88,166,255,0.2); transition: transform 0.2s, box-shadow 0.2s; position: relative; }
.achiever-card:hover { transform: translateY(-3px); box-shadow: 0 0 25px rgba(88,166,255,0.4); }
.achiever-card img { width: 80px; height: 80px; border-radius: 50%; object-fit: cover; }

/* Achiever info */
.achiever-info { display: flex; flex-direction: column; }
.card-name { font-weight: bold; font-size: 16px; }
.card-class { font-size: 14px; color: #a0a0a0; margin-bottom: 4px; }
.medal { font-size: 22px; margin-bottom: 4px; }
.gold { color: #FFD700; }
.silver { color: #C0C0C0; }
.bronze { color: #CD7F32; }

/* Like & Comment buttons */
.achiever-actions { display: flex; gap: 12px; margin-top: 8px; }
.achiever-actions button { background: transparent; border: none; color: #e0e6f0; cursor: pointer; font-size: 18px; display: flex; align-items: center; gap: 4px; padding: 2px 4px; transition: transform 0.1s; }
.achiever-actions button:hover { transform: scale(1.2); }
.achiever-actions .liked { color: #ff4d6d; }
.likes-count, .comments-count { font-size: 14px; color: #a0a0a0; margin-left: 4px; }

/* Mobile style for top achievers */
@media (max-width: 480px) {
    .feed-container {
        display: flex;
        flex-direction: column;
        gap: 12px;
        padding: 0 10px;
    }

    .achiever-card {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 10px 12px;
        border-radius: 12px;
        background: #161b22;
        box-shadow: 0 1px 5px rgba(255,255,255,0.1);
        transition: transform 0.1s;
    }

    .achiever-card:hover {
        transform: translateY(-2px);
        box-shadow: 0 3px 10px rgba(88,166,255,0.2);
    }

    .achiever-card img {
        width: 50px;
        height: 50px;
        border-radius: 50%;
    }

    .achiever-info {
        flex: 1;
        margin-left: 10px;
    }

    .card-name {
        font-size: 16px;
        font-weight: 600;
        color: #fff;
    }

    .card-class {
        font-size: 14px;
        color: #a0a0a0;
    }

    .medal {
        font-size: 22px;
        margin-left: 8px;
    }
}

</style>
</head>
<body>

<h3>Top Achievers</h3>


<div class="term-select">
    <form method="GET">
        <label>Select Term: </label>
        <select name="term" onchange="this.form.submit()">
            <option value="1" <?= $term==1?'selected':'' ?>>Term 1</option>
            <option value="2" <?= $term==2?'selected':'' ?>>Term 2</option>
            <option value="3" <?= $term==3?'selected':'' ?>>Term 3</option>
            <option value="4" <?= $term==4?'selected':'' ?>>Term 4</option>
        </select>
    </form>
</div>

<div class="feed-container">
<?php foreach ($achievers as $achiever): 
    $achieverId = $achiever['id'];
    $profile = !empty($achiever['profile_picture']) ? "uploads/achievers/" . $achiever['profile_picture'] : "uploads/achievers/default.png";
    $medalClass = strtolower($achiever['medal']);
    $medalEmoji = $achiever['medal']=='Gold'?'🥇':($achiever['medal']=='Silver'?'🥈':'🥉');
    $liked = in_array($achieverId, $userLikes)?'liked':'';
?>
<div class="achiever-card" data-id="<?= $achieverId ?>">
    <img src="<?= htmlspecialchars($profile) ?>" alt="Profile Picture">
    <div class="achiever-info">
        <div class="card-name"><?= htmlspecialchars($achiever['full_name']) ?></div>
        <div class="card-class"><?= htmlspecialchars($achiever['class']) ?></div>
        <div class="medal <?= $medalClass ?>"><?= $medalEmoji ?></div>

        
    </div>
</div>
<?php endforeach; ?>
</div>



<script>
// AJAX helper
function ajax(url, data, callback) {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url, true);
    xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
    xhr.onload = function() { if(callback) callback(xhr.responseText); };
    xhr.send(data);
}

// Like toggle
function toggleLike(btn, achieverId) {
    const isLiked = !btn.classList.contains('liked') ? 1 : 0;

    ajax('achiever_like.php', `achiever_id=${achieverId}&liked=${isLiked}`, function(res) {
        const count = parseInt(res) || 0;
        btn.classList.toggle('liked', isLiked);
        btn.innerHTML = (isLiked ? '❤️' : '🤍') + ' <span class="likes-count">' + count + '</span>';
    });
}

// Comment modal logic
let currentAchieverId = null;

function openCommentModal(achieverId) {
    currentAchieverId = achieverId;
    const modal = document.getElementById('commentModal');
    const commentsList = document.getElementById('commentsList');
    commentsList.innerHTML = '';

    // Fetch comments from server
    ajax('fetch_comments.php', `achiever_id=${achieverId}`, function(res) {
        try {
            const comments = JSON.parse(res); // [{user: "Name", comment: "text"}, ...]
            comments.forEach(c => {
                const div = document.createElement('div');
                div.className = 'comment';
                div.innerHTML = `<strong>${c.user}:</strong> ${c.comment}`;
                commentsList.appendChild(div);
            });
        } catch (e) {
            commentsList.innerHTML = '<p style="color:#f88;">Failed to load comments.</p>';
        }
    });

    modal.style.display = 'flex';
}

function closeCommentModal() {
    document.getElementById('commentModal').style.display = 'none';
    document.getElementById('newComment').value = '';
}

// Add comment
function addComment() {
    const input = document.getElementById('newComment');
    const comment = input.value.trim();
    if (!comment || !currentAchieverId) return;

    ajax('achiever_comment.php', `achiever_id=${currentAchieverId}&comment=${encodeURIComponent(comment)}`, function(res) {
        const count = parseInt(res) || 0;

        // Update comments-count on card
        const card = document.querySelector(`.achiever-card[data-id='${currentAchieverId}']`);
        const countSpan = card.querySelector('.comments-count');
        if (countSpan) countSpan.textContent = count;

        // Append comment to modal
        const commentsList = document.getElementById('commentsList');
        const div = document.createElement('div');
        div.className = 'comment';
        div.innerHTML = `<strong>You:</strong> ${comment}`;
        commentsList.appendChild(div);

        input.value = '';
    });
}

// Close modal when clicking outside content
window.onclick = function(event) {
    const modal = document.getElementById('commentModal');
    if (event.target == modal) closeCommentModal();
}
</script>
</body>
</html>
