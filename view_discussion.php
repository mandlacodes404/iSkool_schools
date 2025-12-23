<?php
session_start();
require_once 'config.php';

if (!isset($_SESSION['email']) || !in_array($_SESSION['role'], ['learner', 'teacher'])) {
    header("Location: index.php"); exit();
}

$user_email = $_SESSION['email'];
$user_role = $_SESSION['role'];
$disc_id = (int)($_GET['id'] ?? 0);

$disc = $conn->query("SELECT d.*, c.name as class_name FROM class_discussions d JOIN classes c ON d.class_id = c.id WHERE d.id = $disc_id")->fetch_assoc();
if (!$disc) die("Discussion not found.");

$is_tagged_teacher = $user_role === 'teacher' && $conn->query("SELECT 1 FROM discussion_teachers WHERE discussion_id = $disc_id AND teacher_email = '$user_email'")->num_rows > 0;
$is_in_class = $user_role === 'learner' && $conn->query("SELECT 1 FROM class_students WHERE class_id = {$disc['class_id']} AND student_email = '$user_email'")->num_rows > 0;

if (!$is_in_class && !$is_tagged_teacher) die("Access denied.");

// Get creator info
$creator_query = $conn->query("SELECT profile_picture FROM users WHERE email = '{$disc['creator_email']}'");
$creator_row = $creator_query->fetch_assoc();
$creator_pic = $creator_row['profile_picture'] ?? 'default.png';
$creator_display = $disc['creator_anonymous'] && $user_role === 'learner' 
    ? 'A classmate' 
    : ($disc['creator_name'] ?: 'Learner');

// Get replies safely
$replies_query = $conn->query("
    SELECT r.*, u.profile_picture,
           CASE 
               WHEN r.replier_anonymous = 1 AND '$user_role' = 'learner' THEN 'A classmate'
               ELSE COALESCE(r.replier_name, 'Learner')
           END AS replier_display,
           (r.replier_email = '$user_email') AS is_me
    FROM discussion_replies r
    LEFT JOIN users u ON r.replier_email = u.email
    WHERE r.discussion_id = $disc_id
    ORDER BY r.created_at ASC
");
$replies = $replies_query ? $replies_query->fetch_all(MYSQLI_ASSOC) : [];

// Reply submission
if ($_SERVER['REQUEST_METHOD'] === 'POST' && $is_in_class) {
    $message = trim($_POST['message']);
    $anonymous = !empty($_POST['anonymous']);
    $parent_reply_id = !empty($_POST['reply_to']) ? (int)$_POST['reply_to'] : null;

    $replier_full_name = $anonymous ? NULL : trim(($_SESSION['name'] ?? '') . ' ' . ($_SESSION['surname'] ?? ''));

    if (!empty($message)) {
        $stmt = $conn->prepare("INSERT INTO discussion_replies (discussion_id, parent_reply_id, message, replier_email, replier_anonymous, replier_name) VALUES (?, ?, ?, ?, ?, ?)");
        $stmt->bind_param("iissis", $disc_id, $parent_reply_id, $message, $user_email, $anonymous, $replier_full_name);
        $stmt->execute();
        $stmt->close();
        header("Location: view_discussion.php?id=$disc_id#bottom");
        exit();
    }
}

// Report handling
if (isset($_GET['report']) && $is_in_class) {
    $reply_id = (int)$_GET['report'];
    $reason = $_POST['reason'] ?? 'other';
    $comment = trim($_POST['comment'] ?? '');

    $stmt = $conn->prepare("INSERT INTO discussion_reports (reply_id, reporter_email, reason, comment) VALUES (?, ?, ?, ?)");
    $stmt->bind_param("isss", $reply_id, $user_email, $reason, $comment);
    $stmt->execute();
    $stmt->close();
    $report_msg = "Reported.";
}
?>

<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title><?= htmlspecialchars($disc['title']) ?></title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.2/css/all.min.css">
    <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@600;700&display=swap" rel="stylesheet">
    <style>
        :root {
            --bg: #0d1117;
            --card: #161b22;
            --text: #e0e6f0;
            --accent: #4fd1c5;
            --my-bubble: #4fd1c5;
            --other-bubble: #21262d;
            --border: #30363d;
            --preview-bg: rgba(255,255,255,0.05);
        }
        body { font-family: 'Nunito', sans-serif; background: var(--bg); color: var(--text); margin: 0; height: 100vh; display: flex; flex-direction: column; }

        .anonymity-note {
            background: rgba(79,209,197,0.1);
            padding: 12px;
            text-align: center;
            font-size: 14px;
            border-bottom: 1px solid var(--border);
            color: #c9d1d9;
        }

        .chat-container {
            flex: 1;
            overflow-y: auto;
            padding: 20px;
            display: flex;
            flex-direction: column;
            gap: 15px;
        }

        .message {
            display: flex;
            max-width: 80%;
            gap: 10px;
            position: relative;
            animation: fadeIn 0.3s ease;
            cursor: pointer;
            padding: 8px;
            border-radius: 18px;
            transition: background 0.2s;
        }
        .message:hover {
            background: rgba(255,255,255,0.03);
        }
        .message.me { align-self: flex-end; flex-direction: row-reverse; }
        .message .avatar {
            width: 40px;
            height: 40px;
            border-radius: 50%;
            object-fit: cover;
            border: 2px solid var(--border);
            flex-shrink: 0;
        }
        .bubble {
            background: var(--other-bubble);
            padding: 12px 16px;
            border-radius: 18px;
            border-top-left-radius: 4px;
            max-width: 100%;
            word-wrap: break-word;
        }
        .message.me .bubble {
            background: var(--my-bubble);
            color: black;
            border-top-right-radius: 4px;
            border-top-left-radius: 18px;
        }

        .reply-preview {
            background: var(--preview-bg);
            padding: 8px 12px;
            border-left: 4px solid var(--accent);
            border-radius: 8px;
            margin-bottom: 8px;
            font-size: 14px;
            opacity: 0.9;
        }
        .reply-preview .author { font-weight: 600; font-size: 13px; color: var(--accent); }
        .reply-preview .text { margin-top: 4px; color: #b0b7c1; }

        .message-info {
            font-size: 12px;
            color: #8b949e;
            margin-top: 5px;
            text-align: right;
        }
        .message.me .message-info { text-align: left; }

        .message-actions {
            position: absolute;
            bottom: -50px;
            left: 50%;
            transform: translateX(-50%);
            background: var(--card);
            padding: 10px 16px;
            border-radius: 30px;
            box-shadow: 0 8px 20px rgba(0,0,0,0.5);
            display: none;
            gap: 20px;
            z-index: 10;
            white-space: nowrap;
        }
        .message.active .message-actions {
            display: flex;
        }
        .message-actions button {
            background: none;
            border: none;
            color: var(--text);
            font-size: 15px;
            cursor: pointer;
            padding: 8px 16px;
            border-radius: 20px;
            display: flex;
            align-items: center;
            gap: 6px;
            transition: background 0.2s;
        }
        .message-actions button:hover {
            background: rgba(255,255,255,0.1);
        }
        .message-actions button i {
            font-size: 16px;
        }

        .input-bar {
            background: var(--card);
            padding: 15px 20px;
            border-top: 1px solid var(--border);
            display: flex;
            align-items: flex-end;
            gap: 10px;
        }
        .input-bar textarea {
            flex: 1;
            padding: 12px 16px;
            background: var(--bg);
            border: 1px solid var(--border);
            border-radius: 24px;
            color: var(--text);
            resize: none;
            min-height: 48px;
            max-height: 120px;
            font-size: 15px;
        }
        .input-bar textarea:focus { outline: none; border-color: var(--accent); }
        .input-bar button {
            background: var(--accent);
            color: black;
            border: none;
            width: 48px;
            height: 48px;
            border-radius: 50%;
            cursor: pointer;
            font-size: 20px;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .input-bar .anon-checkbox {
            display: flex;
            align-items: center;
            font-size: 14px;
            white-space: nowrap;
        }

        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
        }

        @media (max-width: 768px) {
            .chat-container { padding: 15px; }
            .message { max-width: 90%; }
            .input-bar { padding: 12px; }
        }
    </style>
</head>
<body>
    <div class="anonymity-note">
        <strong>Note:</strong> Posts can be anonymous among classmates, but the tagged teacher can see names for moderation.
    </div>

    <div class="chat-container" id="chat">
        <!-- Initial Message -->
        <div class="message <?= $disc['creator_email'] === $user_email ? 'me' : '' ?>" data-id="0" onclick="toggleActions(this)">
            <img src="Uploads/learners/<?= htmlspecialchars($creator_pic) ?>" class="avatar">
            <div>
                <div class="bubble">
                    <strong><?= htmlspecialchars($creator_display) ?></strong><br>
                    <?= nl2br(htmlspecialchars($disc['initial_message'])) ?>
                </div>
                <div class="message-info"><?= date('M j, g:i a', strtotime($disc['created_at'])) ?></div>
            </div>
            <div class="message-actions">
                <button onclick="event.stopPropagation(); setReply(0)"><i class="fas fa-reply"></i> Reply</button>
                <?php if ($user_role === 'learner'): ?>
                    <button onclick="event.stopPropagation(); document.getElementById('report-0').style.display='block'"><i class="fas fa-flag"></i> Report</button>
                <?php endif; ?>
            </div>
        </div>

        <!-- Replies -->
        <?php foreach ($replies as $r):
            $reply_pic = $r['profile_picture'] ?? 'default.png';
            $parent_preview = null;
            if ($r['parent_reply_id']) {
                if ($r['parent_reply_id'] == 0) {
                    $parent_preview = [
                        'author' => $creator_display,
                        'text' => substr($disc['initial_message'], 0, 80) . (strlen($disc['initial_message']) > 80 ? '...' : '')
                    ];
                } else {
                    foreach ($replies as $p) {
                        if ($p['id'] == $r['parent_reply_id']) {
                            $parent_preview = [
                                'author' => $p['replier_display'],
                                'text' => substr($p['message'], 0, 80) . (strlen($p['message']) > 80 ? '...' : '')
                            ];
                            break;
                        }
                    }
                }
            }
            ?>
            <div class="message <?= $r['is_me'] ? 'me' : '' ?>" data-id="<?= $r['id'] ?>" onclick="toggleActions(this)">
                <img src="Uploads/learners/<?= htmlspecialchars($reply_pic) ?>" class="avatar">
                <div>
                    <?php if ($parent_preview): ?>
                        <div class="reply-preview">
                            <div class="author"><?= htmlspecialchars($parent_preview['author']) ?></div>
                            <div class="text"><?= htmlspecialchars($parent_preview['text']) ?></div>
                        </div>
                    <?php endif; ?>
                    <div class="bubble">
                        <strong><?= htmlspecialchars($r['replier_display']) ?></strong><br>
                        <?= nl2br(htmlspecialchars($r['message'])) ?>
                    </div>
                    <div class="message-info"><?= date('M j, g:i a', strtotime($r['created_at'])) ?></div>
                </div>
                <div class="message-actions">
                    <button onclick="event.stopPropagation(); setReply(<?= $r['id'] ?>)"><i class="fas fa-reply"></i> Reply</button>
                    <?php if ($user_role === 'learner' && !$r['is_me']): ?>
                        <button onclick="event.stopPropagation(); document.getElementById('report-<?= $r['id'] ?>').style.display='block'"><i class="fas fa-flag"></i> Report</button>
                    <?php endif; ?>
                </div>
            </div>

            <?php if ($user_role === 'learner' && !$r['is_me']): ?>
                <div id="report-<?= $r['id'] ?>" style="display:none; margin:10px 50px;">
                    <form method="POST">
                        <input type="hidden" name="report" value="<?= $r['id'] ?>">
                        <select name="reason" required style="width:100%; padding:8px; margin:5px 0;">
                            <option value="bullying">Bullying</option>
                            <option value="inappropriate">Inappropriate</option>
                            <option value="off_topic">Off-topic</option>
                            <option value="spam">Spam</option>
                            <option value="other">Other</option>
                        </select>
                        <textarea name="comment" placeholder="Comment (optional)" style="width:100%; padding:8px;"></textarea>
                        <button type="submit" style="margin-top:8px;">Submit Report</button>
                    </form>
                </div>
            <?php endif; ?>
        <?php endforeach; ?>
    </div>

    <?php if ($is_in_class): ?>
        <div class="input-bar">
            <form method="POST" style="width:100%; display:flex; align-items:flex-end; gap:10px;">
                <input type="hidden" name="reply_to" id="replyTo" value="0">
                <div style="flex:1;">
                    <div id="replyPreview" style="display:none; background:var(--preview-bg); padding:10px; border-radius:10px; margin-bottom:10px; border-left:4px solid var(--accent);">
                        <strong>Replying to:</strong> <span id="previewText"></span>
                        <button type="button" onclick="cancelReply()" style="float:right; background:none; border:none; color:#f85149; cursor:pointer;">✕</button>
                    </div>
                    <textarea name="message" rows="1" required placeholder="Type your message..." autofocus></textarea>
                </div>
                <div class="anon-checkbox">
                    <input type="checkbox" name="anonymous" id="anon" checked>
                    <label for="anon">Anonymous</label>
                </div>
                <button type="submit"><i class="fas fa-paper-plane"></i></button>
            </form>
        </div>
    <?php endif; ?>

    <script>
        function toggleActions(msg) {
            document.querySelectorAll('.message').forEach(m => m.classList.remove('active'));
            msg.classList.add('active');
        }

        function setReply(msgId) {
            document.getElementById('replyTo').value = msgId;
            const preview = document.getElementById('replyPreview');
            const bubble = document.querySelector(`.message[data-id="${msgId}"] .bubble`);
            const text = bubble ? bubble.textContent.trim() : 'this message';
            document.getElementById('previewText').textContent = text.substring(0, 80) + (text.length > 80 ? '...' : '');
            preview.style.display = 'block';
            document.querySelector('textarea').focus();
            document.querySelectorAll('.message').forEach(m => m.classList.remove('active'));
        }

        function cancelReply() {
            document.getElementById('replyTo').value = '0';
            document.getElementById('replyPreview').style.display = 'none';
        }

        // Auto-scroll
        const chat = document.getElementById('chat');
        chat.scrollTop = chat.scrollHeight;

        // Resize textarea
        document.querySelector('textarea')?.addEventListener('input', function() {
            this.style.height = 'auto';
            this.style.height = this.scrollHeight + 'px';
        });

        // Close actions when clicking outside
        document.addEventListener('click', function(e) {
            if (!e.target.closest('.message')) {
                document.querySelectorAll('.message').forEach(m => m.classList.remove('active'));
            }
        });
    </script>
</body>
</html>