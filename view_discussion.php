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

// Handle POST actions
if ($_SERVER['REQUEST_METHOD'] === 'POST' && $is_in_class) {
    $action = $_POST['action'] ?? '';

    if ($action === 'reply') {
        $message = trim($_POST['message'] ?? '');
        $anonymous = !empty($_POST['anonymous']);
        $parent_reply_id = !empty($_POST['reply_to']) ? (int)$_POST['reply_to'] : null;
        $attachment = null;

        $replier_full_name = $anonymous ? NULL : trim(($_SESSION['name'] ?? '') . ' ' . ($_SESSION['surname'] ?? ''));

        // Fixed path: lowercase 'uploads'
        $upload_dir = 'uploads/discussions/';
        if (!is_dir($upload_dir)) {
            mkdir($upload_dir, 0755, true);
        }

        // Handle file upload
        if (isset($_FILES['attachment']) && $_FILES['attachment']['error'] === UPLOAD_ERR_OK) {
            $file = $_FILES['attachment'];
            $allowed = ['jpg', 'jpeg', 'png', 'gif', 'pdf'];
            $ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));

            if (in_array($ext, $allowed) && $file['size'] <= 10 * 1024 * 1024) {
                $filename = uniqid('disc_') . '.' . $ext;
                $path = $upload_dir . $filename;

                if (move_uploaded_file($file['tmp_name'], $path)) {
                    $attachment = $filename;
                } else {
                    $_SESSION['upload_error'] = "Upload failed. Check folder permissions for 'uploads/discussions/'.";
                }
            } else {
                $_SESSION['upload_error'] = "Invalid file type or too large (max 10MB).";
            }
        }

        if (!empty($message) || $attachment) {
            $stmt = $conn->prepare("INSERT INTO discussion_replies (discussion_id, parent_reply_id, message, replier_email, replier_anonymous, replier_name, attachment) VALUES (?, ?, ?, ?, ?, ?, ?)");
            $stmt->bind_param("iississ", $disc_id, $parent_reply_id, $message, $user_email, $anonymous, $replier_full_name, $attachment);
            $stmt->execute();
            $stmt->close();
            header("Location: view_discussion.php?id=$disc_id#bottom");
            exit();
        }
    }

    if ($action === 'report') {
        $reply_id = !empty($_POST['reply_id']) ? (int)$_POST['reply_id'] : null;
        $discussion_id = (int)$_POST['discussion_id'];
        $reason = $_POST['reason'] ?? 'other';
        $comment = trim($_POST['comment'] ?? '');

        $stmt = $conn->prepare("INSERT INTO discussion_reports (discussion_id, reply_id, reporter_email, reason, comment) VALUES (?, ?, ?, ?, ?)");
        $stmt->bind_param("iisss", $discussion_id, $reply_id, $user_email, $reason, $comment);
        $stmt->execute();
        $stmt->close();
        $report_msg = "Content reported successfully.";
        header("Location: view_discussion.php?id=$disc_id");
        exit();
    }
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
            padding: 8px;
            border-radius: 18px;
            transition: background 0.2s;
        }
        .message:hover { background: rgba(255,255,255,0.03); }
        .message.me { align-self: flex-end; flex-direction: row-reverse; }
        .message .avatar {
            width: 40px; height: 40px; border-radius: 50%; object-fit: cover; border: 2px solid var(--border); flex-shrink: 0;
        }
        .bubble {
            background: var(--other-bubble);
            padding: 12px 16px;
            border-radius: 18px;
            border-top-left-radius: 4px;
            max-width: 100%;
            word-wrap: break-word;
            cursor: pointer;
        }
        .message.me .bubble {
            background: var(--my-bubble);
            color: black;
            border-top-right-radius: 4px;
            border-top-left-radius: 18px;
        }
        .message.active .bubble {
            background: rgba(79,209,197,0.2) !important;
        }

        .attachment {
            margin-top: 10px;
            max-width: 300px;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        }
        .attachment img {
            width: 100%;
            display: block;
            border-radius: 12px;
        }
        .attachment a {
            display: block;
            background: rgba(79,209,197,0.15);
            padding: 14px;
            text-align: center;
            color: var(--accent);
            font-weight: 600;
            text-decoration: none;
            border-top: 1px solid var(--border);
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
        }
        .message-actions button:hover {
            background: rgba(255,255,255,0.1);
        }

        .input-bar {
            background: var(--card);
            padding: 15px 20px;
            border-top: 1px solid var(--border);
            display: flex;
            align-items: center;
            gap: 12px;
        }
        .input-wrapper {
            flex: 1;
            background: var(--bg);
            border: 1px solid var(--border);
            border-radius: 30px;
            padding: 8px 16px;
            display: flex;
            flex-direction: column;
            gap: 8px;
        }
        .input-wrapper textarea {
            flex: 1;
            background: transparent;
            border: none;
            color: var(--text);
            resize: none;
            min-height: 20px;
            max-height: 100px;
            font-size: 15px;
            outline: none;
        }
        .attach-btn { cursor: pointer; font-size: 20px; color: var(--accent); }
        .input-bar button {
            background: var(--accent);
            color: black;
            border: none;
            width: 48px;
            height: 48px;
            border-radius: 50%;
            cursor: pointer;
            font-size: 20px;
        }
        .input-bar .anon-checkbox { font-size: 14px; white-space: nowrap; }

        #filePreview {
            display: none;
            background: rgba(79,209,197,0.1);
            padding: 8px 12px;
            border-radius: 12px;
            font-size: 14px;
            align-items: center;
            gap: 8px;
        }
        #filePreview img {
            width: 40px;
            height: 40px;
            object-fit: cover;
            border-radius: 8px;
        }
        #filePreview span {
            flex: 1;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        #filePreview button {
            background: none;
            border: none;
            color: #f85149;
            cursor: pointer;
            font-size: 18px;
        }

                        .anonymity-note {
            background: rgba(79,209,197,0.1);
            padding: 12px 16px;
            text-align: center;
            font-size: 14px;
            border-bottom: 1px solid var(--border);
            color: #c9d1d9;
            position: relative;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 12px;
        }

        .back-btn {
            position: absolute;
            left: 16px;
            background: rgba(255, 255, 255, 0.1);
            backdrop-filter: blur(10px);
            color: var(--text);
            width: 36px;
            height: 36px;
            border-radius: 50%;
            border: none;
            font-size: 20px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: background 0.2s ease;
            z-index: 10; /* ensures button is on top */
        }

        .back-btn:hover {
            background: rgba(255, 255, 255, 0.2);
        }

        .anonymity-text {
            flex: 1;
            font-size: 14px;
            padding-left: 52px;  /* ← This is the key fix: pushes text right of button */
            padding-right: 52px; /* optional: symmetric on right side */
            box-sizing: border-box;
        }

        /* Hide back button on desktop */
        @media (min-width: 769px) {
            .back-btn {
                display: none;
            }
            .anonymity-text {
                padding-left: 0;   /* no need for padding on desktop */
                padding-right: 0;
            }
        }

        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @media (max-width: 768px) { .chat-container { padding: 15px; } .message { max-width: 90%; } .input-bar { padding: 12px; } }
    </style>
</head>
<body>
    <div class="anonymity-note">
    <button class="back-btn" onclick="goBackToDiscussions()">
        <i class="fas fa-chevron-left"></i>
    </button>
    <span class="anonymity-text">
        <strong></strong> Questions can be anonymous, but the tagged teacher can see names for moderation.
    </span>
</div>

    <?php if (isset($report_msg)): ?>
        <div style="text-align:center; padding:15px; background:#238636; border-radius:12px; margin:20px;">
            <?= htmlspecialchars($report_msg) ?>
        </div>
    <?php endif; ?>

    <?php if (isset($_SESSION['upload_error'])): ?>
        <div style="text-align:center; padding:15px; background:#f85149; color:white; border-radius:12px; margin:20px;">
            <?= htmlspecialchars($_SESSION['upload_error']) ?>
        </div>
        <?php unset($_SESSION['upload_error']); ?>
    <?php endif; ?>

    <div class="chat-container" id="chat">
        <!-- Initial Message -->
        <div class="message <?= $disc['creator_email'] === $user_email ? 'me' : '' ?>" data-id="0">
            <img src="uploads/learners/<?= htmlspecialchars($creator_pic) ?>" class="avatar">
            <div>
                <div class="bubble" onclick="toggleActions(this.parentElement.parentElement)">
                    <strong><?= htmlspecialchars($creator_display) ?></strong><br>
                    <?= nl2br(htmlspecialchars($disc['initial_message'])) ?>
                </div>
                <div class="message-info"><?= date('M j, g:i a', strtotime($disc['created_at'])) ?></div>
            </div>
            <div class="message-actions">
                <button onclick="event.stopPropagation(); setReply(0)"><i class="fas fa-reply"></i> Reply</button>
                <?php if ($user_role === 'learner'): ?>
                    <button onclick="event.stopPropagation(); showReportForm(0, <?= $disc_id ?>)"><i class="fas fa-flag"></i> Report</button>
                <?php endif; ?>
            </div>
        </div>

        <!-- Replies -->
        <?php foreach ($replies as $r):
            $reply_pic = $r['profile_picture'] ?? 'default.png';
            $parent_preview = null;
            if ($r['parent_reply_id']) {
                if ($r['parent_reply_id'] == 0) {
                    $parent_preview = ['author' => $creator_display, 'text' => substr($disc['initial_message'], 0, 80) . (strlen($disc['initial_message']) > 80 ? '...' : '')];
                } else {
                    foreach ($replies as $p) {
                        if ($p['id'] == $r['parent_reply_id']) {
                            $parent_preview = ['author' => $p['replier_display'], 'text' => substr($p['message'] ?? '', 0, 80) . (strlen($p['message'] ?? '') > 80 ? '...' : '')];
                            break;
                        }
                    }
                }
            }
            ?>
            <div class="message <?= $r['is_me'] ? 'me' : '' ?>" data-id="<?= $r['id'] ?>">
                <img src="uploads/learners/<?= htmlspecialchars($reply_pic) ?>" class="avatar">
                <div>
                    <?php if ($parent_preview): ?>
                        <div class="reply-preview">
                            <div class="author"><?= htmlspecialchars($parent_preview['author']) ?></div>
                            <div class="text"><?= htmlspecialchars($parent_preview['text']) ?></div>
                        </div>
                    <?php endif; ?>
                    <div class="bubble" onclick="toggleActions(this.parentElement.parentElement)">
                        <strong><?= htmlspecialchars($r['replier_display']) ?></strong><br>
                        <?= nl2br(htmlspecialchars($r['message'] ?? '')) ?>
                        <?php if ($r['attachment']):
                            $ext = pathinfo($r['attachment'], PATHINFO_EXTENSION);
                            $path = 'uploads/discussions/' . $r['attachment'];
                        ?>
                            <div class="attachment">
                                <?php if (in_array($ext, ['jpg','jpeg','png','gif'])): ?>
                                    <a href="<?= $path ?>" target="_blank" onclick="event.stopPropagation();">
                                        <img src="<?= $path ?>" alt="Attached image">
                                    </a>
                                <?php else: ?>
                                    <a href="<?= $path ?>" target="_blank" onclick="event.stopPropagation();">
                                        <i class="fas fa-file-pdf fa-2x"></i><br>
                                        View PDF Document
                                    </a>
                                <?php endif; ?>
                            </div>
                        <?php endif; ?>
                    </div>
                    <div class="message-info"><?= date('M j, g:i a', strtotime($r['created_at'])) ?></div>
                </div>
                <div class="message-actions">
                    <button onclick="event.stopPropagation(); setReply(<?= $r['id'] ?>)"><i class="fas fa-reply"></i> Reply</button>
                    <?php if ($user_role === 'learner' && !$r['is_me']): ?>
                        <button onclick="event.stopPropagation(); showReportForm(<?= $r['id'] ?>, <?= $disc_id ?>)"><i class="fas fa-flag"></i> Report</button>
                    <?php endif; ?>
                </div>
            </div>
        <?php endforeach; ?>
    </div>

    <?php if ($is_in_class): ?>
        <div class="input-bar">
            <form method="POST" enctype="multipart/form-data" id="replyForm" style="width:100%; display:flex; align-items:center; gap:12px;">
                <input type="hidden" name="action" value="reply">
                <input type="hidden" name="reply_to" id="replyTo" value="0">

                <label class="attach-btn">
                    <i class="fas fa-paperclip"></i>
                    <input type="file" name="attachment" id="attachmentInput" accept="image/*,.pdf" style="display:none;">
                </label>

                <div class="input-wrapper">
                    <div id="replyPreview" style="display:none; background:var(--preview-bg); padding:10px; border-radius:10px; margin-bottom:10px; border-left:4px solid var(--accent); width:100%;">
                        <strong>Replying to:</strong> <span id="previewText"></span>
                        <button type="button" onclick="cancelReply()" style="float:right; background:none; border:none; color:#f85149; cursor:pointer;">✕</button>
                    </div>

                    <div id="filePreview" style="display:none;">
                        <img id="previewImg" src="" alt="Preview">
                        <span id="fileName"></span>
                        <button type="button" onclick="clearAttachment()">✕</button>
                    </div>

                    <textarea name="message" rows="1" placeholder="Type your message..." autofocus></textarea>
                </div>

                <div class="anon-checkbox">
                    <input type="checkbox" name="anonymous" id="anon" checked>
                    <label for="anon">Anon</label>
                </div>

                <button type="submit"><i class="fas fa-paper-plane"></i></button>
            </form>
        </div>
    <?php endif; ?>

    <!-- Report Modal -->
    <div id="reportForm" style="display:none; position:fixed; top:50%; left:50%; transform:translate(-50%,-50%); background:var(--card); padding:30px; border-radius:16px; box-shadow:0 10px 30px rgba(0,0,0,0.6); z-index:10000; width:90%; max-width:500px;">
        <h3 style="color:var(--accent); text-align:center;"><i class="fas fa-flag"></i> Report Content</h3>
        <form method="POST">
            <input type="hidden" name="action" value="report">
            <input type="hidden" name="reply_id" id="reportReplyId" value="">
            <input type="hidden" name="discussion_id" id="reportDiscId" value="">
            <select name="reason" required style="width:100%; padding:12px; margin:15px 0; background:var(--bg); border:1px solid var(--border); border-radius:10px; color:var(--text);">
                <option value="bullying">Bullying</option>
                <option value="inappropriate">Inappropriate</option>
                <option value="off_topic">Off-topic</option>
                <option value="spam">Spam</option>
                <option value="other">Other</option>
            </select>
            <textarea name="comment" placeholder="Additional comment (optional)" style="width:100%; padding:12px; background:var(--bg); border:1px solid var(--border); border-radius:10px; color:var(--text); height:100px;"></textarea>
            <div style="text-align:center; margin-top:20px;">
                <button type="submit" style="background:#f85149; color:white; padding:12px 30px; border:none; border-radius:10px;">Submit Report</button>
                <button type="button" onclick="document.getElementById('reportForm').style.display='none'" style="background:#8b949e; color:white; padding:12px 30px; border:none; border-radius:10px; margin-left:10px;">Cancel</button>
            </div>
        </form>
    </div>

    <script>
        function toggleActions(messageElement) {
            document.querySelectorAll('.message').forEach(m => m.classList.remove('active'));
            messageElement.classList.add('active');
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

        function showReportForm(replyId, discId) {
            document.getElementById('reportReplyId').value = replyId > 0 ? replyId : '';
            document.getElementById('reportDiscId').value = discId;
            document.getElementById('reportForm').style.display = 'block';
        }

        document.addEventListener('click', function(e) {
            if (!e.target.closest('.message') && !e.target.closest('.message-actions')) {
                document.querySelectorAll('.message').forEach(m => m.classList.remove('active'));
            }
        });

        document.querySelector('textarea')?.addEventListener('input', function() {
            this.style.height = 'auto';
            this.style.height = this.scrollHeight + 'px';
        });

        document.getElementById('attachmentInput')?.addEventListener('change', function(e) {
            const file = e.target.files[0];
            const preview = document.getElementById('filePreview');
            const previewImg = document.getElementById('previewImg');
            const fileName = document.getElementById('fileName');

            if (file) {
                preview.style.display = 'flex';
                fileName.textContent = file.name;

                if (file.type.startsWith('image/')) {
                    const reader = new FileReader();
                    reader.onload = function(e) {
                        previewImg.src = e.target.result;
                        previewImg.style.display = 'block';
                    }
                    reader.readAsDataURL(file);
                } else {
                    previewImg.style.display = 'none';
                }
            } else {
                preview.style.display = 'none';
            }
        });

        function clearAttachment() {
            document.getElementById('attachmentInput').value = '';
            document.getElementById('filePreview').style.display = 'none';
        }

        const chat = document.getElementById('chat');
        chat.scrollTop = chat.scrollHeight;

                function goBackToDiscussions() {
            // Check if we came from the dashboard (most users will)
            if (document.referrer.includes('learner_dashboard.php') || document.referrer.includes('teacher_dashboard.php')) {
                history.back(); // This goes back to the dashboard with discussions.php loaded in iframe
            } else {
                // Fallback: directly go to dashboard and load discussions
                window.location.href = '<?php echo $_SESSION['role'] === 'teacher' ? 'teacher_dashboard.php' : 'learner_dashboard.php'; ?>?page=discussions.php';
            }
        }
    </script>
</body>
</html>