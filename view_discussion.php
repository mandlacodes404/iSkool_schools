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
    ? 'Anonymous' 
    : ($disc['creator_name'] ?: 'Learner');

// Get replies safely
$replies_query = $conn->query("
    SELECT r.*, u.profile_picture,
           CASE 
               WHEN r.replier_anonymous = 1 AND '$user_role' = 'learner' THEN 'Anonymous'
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

        // This ensures it uses the uploads folder in your main project root
$upload_dir = __DIR__ . '/uploads/discussions/';
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
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.2/css/all.min.css">
    <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@600;700&display=swap" rel="stylesheet">
   <style>
    :root {
    --bg: #131314;           /* Gemini's deep charcoal */
    --card: #1e1f20;         /* Surface color */
    --text: #e3e3e3;         /* Soft white text */
    --accent: #8ab4f8;       /* Gemini Blue */
    --my-bubble: #1a232e;    /* Tonal blue for your messages */
    --other-bubble: #1e1f20; /* Tonal gray for others */
    --border: #444746;       /* Subtle border */
    --preview-bg: rgba(255,255,255,0.05);
}

/* 1. Base Layout */
body { 
    font-family: 'Inter', 'Nunito', sans-serif; 
    background: var(--bg); 
    color: var(--text); 
    margin: 0; 
    height: 100vh; 
    display: flex; 
    flex-direction: column; 
    overflow: hidden; 
}

/* 2. Top Navigation Bar */
.top-nav {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 16px;
    background: rgba(19, 19, 20, 0.8);
    backdrop-filter: blur(10px);
    border-bottom: 1px solid var(--border);
    position: sticky;
    top: 0;
    z-index: 1000;
}

.page-title {
    font-size: 16px;
    font-weight: 500;
    color: var(--text);
}

.back-btn, .info-btn {
    background: transparent;
    color: var(--text);
    border: none;
    font-size: 20px;
    cursor: pointer;
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    transition: background 0.2s;
}

.back-btn:hover, .info-btn:hover { background: rgba(255,255,255,0.05); }
.info-btn { color: var(--accent); }

/* Privacy Modal Styles */
.info-modal {
    display: none;
    position: fixed;
    top: 0; left: 0; width: 100%; height: 100%;
    background: rgba(0,0,0,0.7);
    z-index: 10002;
    align-items: center;
    justify-content: center;
}

.info-modal-content {
    background: var(--card);
    padding: 24px;
    border-radius: 20px;
    max-width: 300px;
    text-align: center;
    border: 1px solid var(--border);
    animation: popIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

@keyframes popIn {
    from { transform: scale(0.8); opacity: 0; }
    to { transform: scale(1); opacity: 1; }
}

.info-modal-content h3 { margin-top: 0; color: var(--accent); font-size: 18px; }
.info-modal-content p { font-size: 14px; color: #9aa0a6; line-height: 1.5; }
.info-modal-content button {
    background: var(--accent);
    color: #131314;
    border: none;
    padding: 10px 20px;
    border-radius: 10px;
    font-weight: bold;
    margin-top: 15px;
    cursor: pointer;
}

/* 3. Chat Area */
.chat-container {
    flex: 1;
    max-width: 900px;
    margin: 0 auto;
    width: 100%;
    overflow-y: auto;
    padding: 10px 20px 30px 20px; /* Adjusted top padding */
    display: flex;
    flex-direction: column;
    gap: 24px;
    scroll-behavior: smooth;
}

/* 4. Messages & Bubbles */
.message {
    display: flex;
    max-width: 85%;
    gap: 12px;
    position: relative;
    animation: slideUp 0.4s cubic-bezier(0.2, 0, 0, 1);
}

@keyframes slideUp {
    from { opacity: 0; transform: translateY(15px); }
    to { opacity: 1; transform: translateY(0); }
}

.message.me { align-self: flex-end; flex-direction: row-reverse; }

.message .avatar {
    width: 32px; height: 32px; 
    border-radius: 50%; 
    object-fit: cover; 
    border: 1px solid var(--border);
}

.bubble {
    background: transparent;
    border: 1px solid var(--border);
    padding: 14px 18px;
    border-radius: 22px;
    font-size: 15px;
    line-height: 1.6;
    word-wrap: break-word;
    cursor: pointer;
}

.message.me .bubble {
    background: var(--my-bubble);
    border: 1px solid #3c4043;
    color: #d2e3fc;
}

.message.active .bubble {
    border-color: var(--accent);
    box-shadow: 0 0 0 1px var(--accent);
}

/* 5. Attachments & Previews */
.attachment {
    margin-top: 10px;
    max-width: 250px;
    border-radius: 12px;
    overflow: hidden;
    border: 1px solid var(--border);
}

.attachment img { width: 100%; display: block; }

.attachment a {
    display: block;
    background: rgba(138, 180, 248, 0.1);
    padding: 12px;
    text-align: center;
    color: var(--accent);
    text-decoration: none;
    font-size: 13px;
}

.reply-preview {
    background: var(--preview-bg);
    padding: 8px 12px;
    border-left: 3px solid var(--accent);
    border-radius: 8px;
    margin-bottom: 8px;
    font-size: 13px;
}

.message-info {
    font-size: 11px;
    color: #80868b;
    margin-top: 6px;
    padding: 0 10px;
}

/* 6. Action Menu (The floating Reply/Report) */
.message-actions {
    position: absolute;
    bottom: -45px;
    left: 50%;
    transform: translateX(-50%);
    background: #2d2e31;
    border: 1px solid var(--border);
    padding: 6px;
    border-radius: 12px;
    display: none;
    gap: 8px;
    z-index: 100;
}

.message.active .message-actions { display: flex; }

.message-actions button {
    background: transparent;
    border: none;
    color: #e3e3e3;
    font-size: 13px;
    padding: 6px 12px;
    border-radius: 8px;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 6px;
}

.message-actions button:hover { background: rgba(255,255,255,0.1); }

/* 7. Input Bar (The Pill) */
.input-bar {
    padding: 20px;
    display: flex;
    justify-content: center;
    background: var(--bg);
}

#replyForm {
    max-width: 800px;
    background: #282a2d;
    border-radius: 28px;
    padding: 8px 16px;
    border: 1px solid transparent;
    transition: all 0.3s;
}

#replyForm:focus-within { border-color: #5f6368; }

.input-wrapper { flex: 1; }

textarea {
    background: transparent !important;
    border: none !important;
    color: var(--text) !important;
    font-size: 15px !important;
    outline: none !important;
    width: 100%;
}

.attach-btn { color: #9aa0a6; font-size: 18px; }

.input-bar button[type="submit"] {
    background: transparent;
    color: var(--accent);
    border: none;
    font-size: 18px;
    cursor: pointer;
}

/* 8. Report Modal */
#reportForm {
    position: fixed;
    top: 50%; left: 50%;
    transform: translate(-50%, -50%);
    background: var(--card);
    padding: 24px;
    border-radius: 16px;
    border: 1px solid var(--border);
    z-index: 10001;
}

/* 9. RESPONSIVE / MOBILE */
@media (max-width: 768px) {
    /* Since we have a sticky top-nav, we ensure chat doesn't hide behind it */
    .top-nav {
        padding: 8px 12px;
    }
    
    .page-title {
        font-size: 14px; /* Slightly smaller for mobile screens */
    }

    .chat-container { 
        padding: 10px 10px 20px 10px; 
    } 
    
    .message { max-width: 95%; } /* Give messages more room on small screens */
    .bubble { padding: 12px 14px; font-size: 14px; }
    
    .input-bar { padding: 10px; }
    #replyForm { border-radius: 20px; gap: 8px; }
    
    .anon-checkbox label { display: none; } /* Show only the checkbox to save space */
}

@media (min-width: 769px) {
    /* Hide the top navigation bar on desktop screens */
    .top-nav {
        display: none !important;
    }
}

/* Media Overlay Layer */
#mediaOverlay {
    display: none;
    position: fixed;
    top: 0; left: 0; 
    width: 100%; height: 100%;
    background: rgba(0, 0, 0, 0.95);
    z-index: 99999; /* Higher than top-nav */
    flex-direction: column;
}

#mediaOverlay .overlay-nav {
    display: flex;
    align-items: center;
    padding: 15px;
    background: rgba(0,0,0,0.5);
}

#mediaOverlay .overlay-content {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: auto;
    padding: 20px;
}

#mediaOverlay img {
    max-width: 100%;
    max-height: 90vh;
    border-radius: 8px;
    box-shadow: 0 0 20px rgba(0,0,0,0.5);
}

#mediaOverlay iframe {
    width: 100%;
    height: 100%;
    border: none;
    background: white;
}

.close-media {
    background: var(--accent);
    color: #131314;
    border: none;
    padding: 8px 16px;
    border-radius: 20px;
    font-weight: 600;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 8px;
}
   </style>
</head>
<body>
    <div class="top-nav">
    <button class="back-btn" onclick="goBackToDiscussions()">
        <i class="fas fa-chevron-left"></i>
    </button>
    <div class="page-title">Discussion</div>
    <button class="info-btn" onclick="toggleInfoModal()">
        <i class="fas fa-info-circle"></i>
    </button>
</div>

<div id="infoModal" class="info-modal" onclick="toggleInfoModal()">
    <div class="info-modal-content" onclick="event.stopPropagation()">
        <h3>Privacy & Anonymity</h3>
        <p>Questions can posted as Anonymous, but the tagged teacher can always see names for moderation purposes.</p>
        <button onclick="toggleInfoModal()">Got it</button>
    </div>
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
    <?php if (!($disc['creator_anonymous'] && $user_role === 'learner')): ?>
        <img src="uploads/learners/<?= htmlspecialchars($creator_pic) ?>" class="avatar">
    <?php endif; ?>
    <div>
        <div class="bubble" onclick="toggleActions(this.parentElement.parentElement)">
            <strong><?= htmlspecialchars($creator_display) ?></strong><br>
            <?= nl2br(htmlspecialchars($disc['initial_message'])) ?>

            
           <?php if (!empty($disc['attachment'])): 
    $ext = strtolower(pathinfo($disc['attachment'], PATHINFO_EXTENSION));
    $path = 'uploads/discussions/' . $disc['attachment'];
    $is_image = in_array($ext, ['jpg', 'jpeg', 'png', 'gif', 'webp']);
?>
    <?php if ($is_image): ?>
        <div class="attachment" onclick="openMedia('<?= $path ?>', 'image'); event.stopPropagation();">
            <img src="<?= $path ?>" alt="Attached image" style="cursor: pointer;">
        </div>
    <?php else: ?>
        <div class="attachment" onclick="openMedia('<?= $path ?>', 'pdf'); event.stopPropagation();" style="cursor: pointer;">
            <div style="display: flex; align-items: center; gap: 10px; background: rgba(138, 180, 248, 0.1); padding: 10px; border-radius: 8px;">
                <i class="fas fa-file-pdf fa-2x"></i>
                <span style="font-size: 13px;">Open PDF Document</span>
            </div>
        </div>
    <?php endif; ?>
<?php endif; ?>
        </div>
        <div class="message-info"><?= date('M j, g:i a', strtotime($disc['created_at'])) ?></div>
    </div>
    
    <div class="message-actions">
        <button onclick="event.stopPropagation(); setReply(0)"><i class="fas fa-reply"></i> Reply</button>
        <?php if ($user_role === 'learner' && $disc['creator_email'] !== $user_email): ?>
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
                <?php if (!($r['replier_anonymous'] && $user_role === 'learner')): ?>
                  <img src="uploads/learners/<?= htmlspecialchars($reply_pic) ?>" class="avatar">
                <?php endif; ?>
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
                       <?php if (!empty($r['attachment'])): 
    $ext = strtolower(pathinfo($r['attachment'], PATHINFO_EXTENSION));
    $path = 'uploads/discussions/' . $r['attachment'];
    $is_image = in_array($ext, ['jpg', 'jpeg', 'png', 'gif', 'webp']);
?>
    <?php if ($is_image): ?>
        <div class="attachment" onclick="openMedia('<?= $path ?>', 'image'); event.stopPropagation();">
            <img src="<?= $path ?>" alt="Attached image" style="cursor: pointer;">
        </div>
    <?php else: ?>
        <div class="attachment" onclick="openMedia('<?= $path ?>', 'pdf'); event.stopPropagation();" style="cursor: pointer;">
            <div style="display: flex; align-items: center; gap: 10px; background: rgba(138, 180, 248, 0.1); padding: 10px; border-radius: 8px;">
                <i class="fas fa-file-pdf fa-2x"></i>
                <span style="font-size: 13px;">Open PDF Document</span>
            </div>
        </div>
    <?php endif; ?>
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
        function toggleInfoModal() {
    const modal = document.getElementById('infoModal');
    modal.style.display = (modal.style.display === 'flex') ? 'none' : 'flex';
}
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

        function openMedia(path, type) {
    const overlay = document.getElementById('mediaOverlay');
    const content = document.getElementById('mediaContent');
    overlay.style.display = 'flex';
    
    if (type === 'image') {
        content.innerHTML = `<img src="${path}" alt="Preview">`;
    } else {
        // For PDFs, we use an iframe
        content.innerHTML = `<iframe src="${path}"></iframe>`;
    }
    
    // Push a "fake" state to browser history so the hardware back button works!
    history.pushState({viewingMedia: true}, "");
}

function closeMedia() {
    document.getElementById('mediaOverlay').style.display = 'none';
    document.getElementById('mediaContent').innerHTML = '';
}

// Handle the hardware back button on Android/iOS
window.onpopstate = function(event) {
    if (document.getElementById('mediaOverlay').style.display === 'flex') {
        closeMedia();
    }
};
    </script>

    <div id="mediaOverlay">
    <div class="overlay-nav">
        <button class="close-media" onclick="closeMedia()">
            <i class="fas fa-arrow-left"></i> Back to Chat
        </button>
    </div>
    <div class="overlay-content" id="mediaContent">
        </div>
</div>
</body>
</html>