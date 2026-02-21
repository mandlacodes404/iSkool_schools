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

$creator_query = $conn->query("SELECT profile_picture FROM users WHERE email = '{$disc['creator_email']}'");
$creator_row = $creator_query->fetch_assoc();
$creator_pic = $creator_row['profile_picture'] ?? 'default.png';
$creator_display = $disc['creator_anonymous'] && $user_role === 'learner' 
    ? 'Anonymous' 
    : ($disc['creator_name'] ?: 'Learner');

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

if ($_SERVER['REQUEST_METHOD'] === 'POST' && $is_in_class) {
    $action = $_POST['action'] ?? '';

    if ($action === 'reply') {
        $message = trim($_POST['message'] ?? '');
        $anonymous = !empty($_POST['anonymous']);
        $parent_reply_id = !empty($_POST['reply_to']) ? (int)$_POST['reply_to'] : null;
        $attachment = null;

        $replier_full_name = $anonymous ? NULL : trim(($_SESSION['name'] ?? '') . ' ' . ($_SESSION['surname'] ?? ''));

        $upload_dir = __DIR__ . '/uploads/discussions/';
        if (!is_dir($upload_dir)) {
            mkdir($upload_dir, 0755, true);
        }

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
    <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.2/css/all.min.css">
    <style>
        :root {
            --bg:           #0d1117;
            --surface:      #1a1919;
            --surface-2:    #222222;
            --border:       rgba(255,255,255,0.07);
            --border-hover: rgba(79,209,197,0.3);
            --text:         #e2e8f0;
            --text-muted:   #8b949e;
            --accent:       #4fd1c5;
            --accent-dim:   rgba(79,209,197,0.08);
            --teacher-line: #f6877a;
            --my-line:      #4fd1c5;
            --danger:       #f85149;
            --radius:       14px;
            --radius-sm:    8px;
        }

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        body {
            font-family: 'Nunito', sans-serif;
            background: var(--bg);
            color: var(--text);
            height: 100vh;
            display: flex;
            flex-direction: column;
            overflow: hidden;
        }

        /* ── TOP NAV (mobile only) ── */
        .top-nav {
            display: none;
            align-items: center;
            justify-content: space-between;
            padding: 10px 16px;
            background: var(--surface);
            border-bottom: 1px solid var(--border);
            position: sticky;
            top: 0;
            z-index: 100;
            flex-shrink: 0;
        }

        .top-nav .page-title {
            font-size: 15px;
            font-weight: 700;
            color: var(--text);
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            max-width: 200px;
        }

        .top-nav button {
            background: transparent;
            border: none;
            color: var(--text-muted);
            font-size: 18px;
            cursor: pointer;
            width: 36px;
            height: 36px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 50%;
            transition: background 0.2s, color 0.2s;
            flex-shrink: 0;
        }

        .top-nav button:hover { background: rgba(255,255,255,0.06); color: var(--text); }
        .top-nav .info-btn { color: var(--accent); }

        @media (max-width: 768px) {
            .top-nav { display: flex; }
        }

        /* ── LAYOUT WRAPPER ── */
        .page-layout {
            flex: 1;
            display: flex;
            overflow: hidden;
            max-width: 960px;
            width: 100%;
            margin: 0 auto;
            padding: 0 20px;
            gap: 0;
        }

        @media (max-width: 768px) {
            .page-layout { padding: 0; max-width: 100%; }
        }

        /* ── THREAD PANEL (left/main) ── */
        .thread-panel {
            flex: 1;
            display: flex;
            flex-direction: column;
            overflow: hidden;
            min-width: 0;
        }

        /* ── TOPIC HEADER (desktop only) ── */
        .topic-header {
            padding: 24px 0 16px 0;
            border-bottom: 1px solid var(--border);
            flex-shrink: 0;
        }

        .topic-header .class-badge {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            background: var(--accent-dim);
            border: 1px solid rgba(79,209,197,0.2);
            color: var(--accent);
            font-size: 11px;
            font-weight: 700;
            padding: 3px 10px;
            border-radius: 20px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 10px;
        }

        .topic-header h1 {
            font-size: 20px;
            font-weight: 800;
            color: var(--text);
            line-height: 1.3;
        }

        .topic-header .meta {
            margin-top: 6px;
            font-size: 12px;
            color: var(--text-muted);
            display: flex;
            align-items: center;
            gap: 12px;
        }

        .reply-count-pill {
            background: var(--surface-2);
            border: 1px solid var(--border);
            padding: 2px 8px;
            border-radius: 20px;
            font-size: 11px;
            color: var(--text-muted);
        }

        @media (max-width: 768px) {
            .topic-header { display: none; }
        }

        /* ── SCROLL AREA ── */
        .posts-scroll {
            flex: 1;
            overflow-y: auto;
            padding: 20px 0;
            display: flex;
            flex-direction: column;
            gap: 2px;
            scrollbar-width: thin;
            scrollbar-color: var(--surface-2) transparent;
        }

        .posts-scroll::-webkit-scrollbar { width: 4px; }
        .posts-scroll::-webkit-scrollbar-track { background: transparent; }
        .posts-scroll::-webkit-scrollbar-thumb { background: var(--surface-2); border-radius: 4px; }

        @media (max-width: 768px) {
            .posts-scroll { padding: 12px 12px; gap: 4px; }
        }

        /* ── POST CARD ── */
        .post-card {
            background: var(--surface);
            border: 1px solid var(--border);
            border-radius: var(--radius);
            padding: 16px 18px;
            transition: border-color 0.2s;
            position: relative;
            border-left: 3px solid transparent;
        }

        .post-card:hover { border-color: rgba(255,255,255,0.1); }

        .post-card.is-op {
            background: rgba(79,209,197,0.04);
            border-color: rgba(79,209,197,0.15);
            border-left-color: var(--accent);
        }

        .post-card.is-me {
            border-left-color: var(--my-line);
        }

        .post-card.is-teacher {
            border-left-color: var(--teacher-line);
        }

        .post-card.active {
            border-color: var(--border-hover);
            box-shadow: 0 0 0 1px rgba(79,209,197,0.15);
        }

        /* ── POST HEADER ROW ── */
        .post-header {
            display: flex;
            align-items: center;
            gap: 10px;
            margin-bottom: 10px;
        }

        .post-avatar {
            width: 32px;
            height: 32px;
            border-radius: 50%;
            object-fit: cover;
            border: 2px solid var(--border);
            flex-shrink: 0;
        }

        .post-avatar-placeholder {
            width: 32px;
            height: 32px;
            border-radius: 50%;
            background: var(--surface-2);
            border: 2px solid var(--border);
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 12px;
            font-weight: 800;
            color: var(--text-muted);
            flex-shrink: 0;
            text-transform: uppercase;
        }

        .post-meta { flex: 1; min-width: 0; }

        .post-author {
            font-size: 13px;
            font-weight: 700;
            color: var(--text);
            display: flex;
            align-items: center;
            gap: 6px;
        }

        .op-tag, .me-tag, .teacher-tag {
            font-size: 10px;
            font-weight: 700;
            padding: 1px 6px;
            border-radius: 4px;
            text-transform: uppercase;
            letter-spacing: 0.3px;
        }

        .op-tag   { background: var(--accent-dim); color: var(--accent); border: 1px solid rgba(79,209,197,0.2); }
        .me-tag   { background: rgba(79,209,197,0.1); color: var(--accent); border: 1px solid rgba(79,209,197,0.2); }
        .teacher-tag { background: rgba(246,135,122,0.1); color: var(--teacher-line); border: 1px solid rgba(246,135,122,0.2); }

        .post-time {
            font-size: 11px;
            color: var(--text-muted);
            margin-top: 1px;
        }

        /* ── REPLY QUOTE ── */
        .reply-quote {
            background: rgba(255,255,255,0.03);
            border-left: 3px solid var(--accent);
            border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
            padding: 8px 12px;
            margin-bottom: 10px;
            font-size: 12px;
            color: var(--text-muted);
        }

        .reply-quote .quote-author {
            color: var(--accent);
            font-weight: 700;
            margin-bottom: 2px;
            font-size: 11px;
        }

        .reply-quote .quote-text {
            line-height: 1.4;
            overflow: hidden;
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
        }

        /* ── POST BODY ── */
        .post-body {
            font-size: 14px;
            line-height: 1.65;
            color: var(--text);
            word-wrap: break-word;
            white-space: pre-wrap;
        }

        /* ── ATTACHMENT ── */
        .post-attachment {
            margin-top: 12px;
            border-radius: var(--radius-sm);
            overflow: hidden;
            border: 1px solid var(--border);
            display: inline-block;
            max-width: 280px;
        }

        .post-attachment img {
            width: 100%;
            display: block;
            cursor: zoom-in;
            transition: opacity 0.2s;
        }

        .post-attachment img:hover { opacity: 0.9; }

        .post-attachment .pdf-link {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 12px 16px;
            background: rgba(79,209,197,0.06);
            color: var(--accent);
            cursor: pointer;
            font-size: 13px;
            font-weight: 600;
            transition: background 0.2s;
        }

        .post-attachment .pdf-link:hover { background: rgba(79,209,197,0.12); }

        /* ── POST FOOTER ACTIONS ── */
        .post-footer {
            display: flex;
            align-items: center;
            gap: 4px;
            margin-top: 12px;
            padding-top: 10px;
            border-top: 1px solid var(--border);
        }

        .action-btn {
            background: none;
            border: none;
            color: var(--text-muted);
            font-size: 12px;
            font-weight: 600;
            cursor: pointer;
            padding: 4px 10px;
            border-radius: 6px;
            display: flex;
            align-items: center;
            gap: 5px;
            font-family: 'Nunito', sans-serif;
            transition: background 0.15s, color 0.15s;
        }

        .action-btn:hover { background: rgba(255,255,255,0.05); color: var(--text); }
        .action-btn.reply-btn:hover { color: var(--accent); }
        .action-btn.report-btn:hover { color: var(--danger); }

        /* ── INPUT AREA ── */
        .compose-area {
            flex-shrink: 0;
            padding: 16px 0 20px 0;
            border-top: 1px solid var(--border);
        }

        @media (max-width: 768px) {
            .compose-area { padding: 12px; border-top: 1px solid var(--border); }
        }

        /* Reply preview strip */
        #replyPreview {
            display: none;
            background: var(--accent-dim);
            border: 1px solid rgba(79,209,197,0.2);
            border-radius: var(--radius-sm);
            padding: 8px 12px;
            margin-bottom: 10px;
            font-size: 12px;
            color: var(--text-muted);
            display: none;
            align-items: center;
            gap: 8px;
        }

        #replyPreview .rp-label { color: var(--accent); font-weight: 700; flex-shrink: 0; }
        #replyPreview .rp-text { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

        #replyPreview .cancel-reply {
            background: none;
            border: none;
            color: var(--danger);
            cursor: pointer;
            font-size: 16px;
            line-height: 1;
            flex-shrink: 0;
            padding: 0 4px;
        }

        /* File preview */
        #filePreview {
            display: none;
            align-items: center;
            gap: 8px;
            background: var(--surface-2);
            border: 1px solid var(--border);
            border-radius: var(--radius-sm);
            padding: 8px 12px;
            margin-bottom: 10px;
            font-size: 12px;
            color: var(--text-muted);
        }

        #filePreview img { width: 36px; height: 36px; object-fit: cover; border-radius: 4px; }
        #filePreview .clear-file { background: none; border: none; color: var(--danger); cursor: pointer; margin-left: auto; font-size: 16px; }

        /* Compose box */
        .compose-box {
            background: var(--surface);
            border: 1px solid var(--border);
            border-radius: var(--radius);
            transition: border-color 0.2s;
            overflow: hidden;
        }

        .compose-box:focus-within { border-color: rgba(79,209,197,0.4); }

        .compose-box textarea {
            width: 100%;
            background: transparent;
            border: none;
            color: var(--text);
            font-family: 'Nunito', sans-serif;
            font-size: 14px;
            font-weight: 600;
            padding: 14px 16px 8px 16px;
            resize: none;
            outline: none;
            min-height: 48px;
            max-height: 140px;
            line-height: 1.5;
        }

        .compose-box textarea::placeholder { color: var(--text-muted); }

        .compose-toolbar {
            display: flex;
            align-items: center;
            gap: 4px;
            padding: 8px 12px;
            border-top: 1px solid var(--border);
        }

        .tool-btn {
            background: none;
            border: none;
            color: var(--text-muted);
            cursor: pointer;
            padding: 6px 8px;
            border-radius: 6px;
            font-size: 15px;
            transition: background 0.15s, color 0.15s;
            display: flex;
            align-items: center;
            gap: 5px;
            font-family: 'Nunito', sans-serif;
            font-size: 12px;
            font-weight: 700;
        }

        .tool-btn:hover { background: rgba(255,255,255,0.06); color: var(--text); }

        .tool-btn.anon-btn { color: var(--text-muted); }
        .tool-btn.anon-btn input { display: none; }

        .tool-btn.anon-btn.anon-on { color: var(--accent); }

        .spacer { flex: 1; }

        .post-btn {
            background: var(--accent);
            color: #0d1117;
            border: none;
            padding: 8px 18px;
            border-radius: 8px;
            font-family: 'Nunito', sans-serif;
            font-size: 13px;
            font-weight: 800;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 6px;
            transition: background 0.2s, transform 0.1s;
        }

        .post-btn:hover { background: #38b2ac; }
        .post-btn:active { transform: scale(0.97); }

        /* ── NOTICES ── */
        .notice-bar {
            padding: 12px 16px;
            border-radius: var(--radius-sm);
            margin-bottom: 12px;
            font-size: 13px;
            font-weight: 600;
        }

        .notice-bar.success { background: rgba(35,134,54,0.2); border: 1px solid rgba(35,134,54,0.4); color: #3fb950; }
        .notice-bar.error   { background: rgba(248,81,73,0.15); border: 1px solid rgba(248,81,73,0.3); color: var(--danger); }

        /* ── PRIVACY MODAL ── */
        .info-modal {
            display: none;
            position: fixed;
            inset: 0;
            background: rgba(0,0,0,0.75);
            z-index: 10002;
            align-items: center;
            justify-content: center;
        }

        .info-modal-content {
            background: var(--surface);
            border: 1px solid var(--border);
            padding: 28px 24px;
            border-radius: 20px;
            max-width: 320px;
            width: 90%;
            text-align: center;
            animation: popIn 0.25s cubic-bezier(0.175,0.885,0.32,1.275);
        }

        @keyframes popIn {
            from { transform: scale(0.85); opacity: 0; }
            to   { transform: scale(1); opacity: 1; }
        }

        .info-modal-content h3 { color: var(--accent); font-size: 17px; margin-bottom: 10px; }
        .info-modal-content p  { font-size: 13px; color: var(--text-muted); line-height: 1.6; }
        .info-modal-content button {
            margin-top: 18px;
            background: var(--accent);
            color: #0d1117;
            border: none;
            padding: 10px 24px;
            border-radius: 8px;
            font-weight: 800;
            cursor: pointer;
            font-family: 'Nunito', sans-serif;
        }

        /* ── REPORT MODAL ── */
        #reportModal {
            display: none;
            position: fixed;
            inset: 0;
            background: rgba(0,0,0,0.75);
            z-index: 10001;
            align-items: center;
            justify-content: center;
        }

        .report-modal-inner {
            background: var(--surface);
            border: 1px solid var(--border);
            padding: 28px;
            border-radius: 20px;
            max-width: 420px;
            width: 90%;
            animation: popIn 0.25s cubic-bezier(0.175,0.885,0.32,1.275);
        }

        .report-modal-inner h3 {
            color: var(--danger);
            font-size: 17px;
            margin-bottom: 18px;
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .report-modal-inner select,
        .report-modal-inner textarea {
            width: 100%;
            background: var(--bg);
            border: 1px solid var(--border);
            color: var(--text);
            border-radius: var(--radius-sm);
            padding: 10px 12px;
            font-family: 'Nunito', sans-serif;
            font-size: 13px;
            margin-bottom: 12px;
            outline: none;
        }

        .report-modal-inner select:focus,
        .report-modal-inner textarea:focus { border-color: rgba(248,81,73,0.4); }

        .report-modal-inner textarea { height: 90px; resize: none; }

        .report-actions { display: flex; gap: 10px; justify-content: flex-end; margin-top: 6px; }

        .btn-cancel-report {
            background: var(--surface-2);
            border: 1px solid var(--border);
            color: var(--text-muted);
            padding: 9px 18px;
            border-radius: 8px;
            cursor: pointer;
            font-family: 'Nunito', sans-serif;
            font-weight: 700;
            font-size: 13px;
        }

        .btn-submit-report {
            background: var(--danger);
            border: none;
            color: white;
            padding: 9px 18px;
            border-radius: 8px;
            cursor: pointer;
            font-family: 'Nunito', sans-serif;
            font-weight: 800;
            font-size: 13px;
        }

        /* ── MEDIA OVERLAY ── */
        #mediaOverlay {
            display: none;
            position: fixed;
            inset: 0;
            background: rgba(0,0,0,0.95);
            z-index: 99999;
            flex-direction: column;
        }

        #mediaOverlay .overlay-nav {
            display: flex;
            align-items: center;
            padding: 14px 16px;
            background: rgba(0,0,0,0.4);
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
        }

        #mediaOverlay iframe {
            width: 100%;
            height: 100%;
            border: none;
            background: white;
        }

        .close-media {
            background: var(--accent);
            color: #0d1117;
            border: none;
            padding: 8px 18px;
            border-radius: 20px;
            font-weight: 700;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 8px;
            font-family: 'Nunito', sans-serif;
        }

        /* ── POST ENTRY ANIMATION ── */
        .post-card {
            animation: fadeUp 0.3s ease both;
        }

        @keyframes fadeUp {
            from { opacity: 0; transform: translateY(8px); }
            to   { opacity: 1; transform: translateY(0); }
        }
    </style>
</head>
<body>

<!-- Mobile Top Nav -->
<div class="top-nav">
    <button onclick="goBackToDiscussions()" title="Back">
        <i class="fas fa-chevron-left"></i>
    </button>
    <div class="page-title"><?= htmlspecialchars($disc['title']) ?></div>
    <button class="info-btn" onclick="toggleInfoModal()" title="Privacy info">
        <i class="fas fa-info-circle"></i>
    </button>
</div>

<!-- Privacy Info Modal -->
<div id="infoModal" class="info-modal" onclick="toggleInfoModal()">
    <div class="info-modal-content" onclick="event.stopPropagation()">
        <h3><i class="fas fa-user-shield"></i> Privacy & Anonymity</h3>
        <p>Posts can be made anonymously. However, the tagged teacher can always see names for moderation purposes.</p>
        <button onclick="toggleInfoModal()">Got it</button>
    </div>
</div>

<!-- Report Modal -->
<div id="reportModal" onclick="closeReportModal()">
    <div class="report-modal-inner" onclick="event.stopPropagation()">
        <h3><i class="fas fa-flag"></i> Report Content</h3>
        <form method="POST" id="reportForm">
            <input type="hidden" name="action" value="report">
            <input type="hidden" name="reply_id" id="reportReplyId" value="">
            <input type="hidden" name="discussion_id" id="reportDiscId" value="">
            <select name="reason" required>
                <option value="bullying">Bullying</option>
                <option value="inappropriate">Inappropriate content</option>
                <option value="off_topic">Off-topic</option>
                <option value="spam">Spam</option>
                <option value="other">Other</option>
            </select>
            <textarea name="comment" placeholder="Additional comment (optional)"></textarea>
            <div class="report-actions">
                <button type="button" class="btn-cancel-report" onclick="closeReportModal()">Cancel</button>
                <button type="submit" class="btn-submit-report">Submit Report</button>
            </div>
        </form>
    </div>
</div>

<!-- Media Overlay -->
<div id="mediaOverlay">
    <div class="overlay-nav">
        <button class="close-media" onclick="closeMedia()">
            <i class="fas fa-arrow-left"></i> Back
        </button>
    </div>
    <div class="overlay-content" id="mediaContent"></div>
</div>

<!-- Main Layout -->
<div class="page-layout">
    <div class="thread-panel">

        <!-- Desktop Topic Header -->
        <div class="topic-header">
            <div class="class-badge">
                <i class="fas fa-chalkboard"></i>
                <?= htmlspecialchars($disc['class_name']) ?>
            </div>
            <h1><?= htmlspecialchars($disc['title']) ?></h1>
            <div class="meta">
                <span><?= count($replies) ?> <?= count($replies) === 1 ? 'reply' : 'replies' ?></span>
                <span class="reply-count-pill">
                    <i class="fas fa-clock" style="margin-right:4px;"></i>
                    Started <?= date('M j, Y', strtotime($disc['created_at'])) ?>
                </span>
                <button onclick="toggleInfoModal()" style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:12px;padding:0;font-family:'Nunito',sans-serif;font-weight:600;display:flex;align-items:center;gap:4px;">
                    <i class="fas fa-info-circle" style="color:var(--accent);"></i> Privacy
                </button>
            </div>
        </div>

        <!-- Notices -->
        <?php if (isset($report_msg)): ?>
            <div class="notice-bar success" style="margin-top:12px;">
                <i class="fas fa-check-circle"></i> <?= htmlspecialchars($report_msg) ?>
            </div>
        <?php endif; ?>
        <?php if (isset($_SESSION['upload_error'])): ?>
            <div class="notice-bar error" style="margin-top:12px;">
                <i class="fas fa-exclamation-circle"></i> <?= htmlspecialchars($_SESSION['upload_error']) ?>
            </div>
            <?php unset($_SESSION['upload_error']); ?>
        <?php endif; ?>

        <!-- Posts Scroll -->
        <div class="posts-scroll" id="postsScroll">

            <!-- ── ORIGINAL POST ── -->
            <?php
            $is_op_me = $disc['creator_email'] === $user_email;
            $show_op_avatar = !($disc['creator_anonymous'] && $user_role === 'learner');
            $op_initials = strtoupper(substr($creator_display, 0, 1));
            ?>
            <div class="post-card is-op <?= $is_op_me ? 'is-me' : '' ?>" data-id="0"
                 style="animation-delay: 0ms;">
                <div class="post-header">
                    <?php if ($show_op_avatar): ?>
                        <img src="uploads/learners/<?= htmlspecialchars($creator_pic) ?>"
                             class="post-avatar"
                             onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                        <div class="post-avatar-placeholder" style="display:none;"><?= $op_initials ?></div>
                    <?php else: ?>
                        <div class="post-avatar-placeholder">?</div>
                    <?php endif; ?>
                    <div class="post-meta">
                        <div class="post-author">
                            <?= htmlspecialchars($creator_display) ?>
                            <span class="op-tag">OP</span>
                            <?php if ($is_op_me): ?><span class="me-tag">You</span><?php endif; ?>
                        </div>
                        <div class="post-time"><?= date('M j, Y · g:i a', strtotime($disc['created_at'])) ?></div>
                    </div>
                </div>

                <div class="post-body"><?= htmlspecialchars($disc['initial_message']) ?></div>

                <?php if (!empty($disc['attachment'])):
                    $ext = strtolower(pathinfo($disc['attachment'], PATHINFO_EXTENSION));
                    $path = 'uploads/discussions/' . $disc['attachment'];
                    $is_image = in_array($ext, ['jpg','jpeg','png','gif','webp']);
                ?>
                    <div class="post-attachment">
                        <?php if ($is_image): ?>
                            <img src="<?= $path ?>" alt="Attachment"
                                 onclick="openMedia('<?= $path ?>', 'image')">
                        <?php else: ?>
                            <div class="pdf-link" onclick="openMedia('<?= $path ?>', 'pdf')">
                                <i class="fas fa-file-pdf fa-lg"></i>
                                <span>Open PDF Document</span>
                            </div>
                        <?php endif; ?>
                    </div>
                <?php endif; ?>

                <div class="post-footer">
                    <?php if ($is_in_class): ?>
                        <button class="action-btn reply-btn" onclick="setReply(0, '<?= htmlspecialchars(addslashes($creator_display)) ?>', <?= json_encode(substr($disc['initial_message'], 0, 100)) ?>)">
                            <i class="fas fa-reply"></i> Reply
                        </button>
                    <?php endif; ?>
                    <?php if ($user_role === 'learner' && !$is_op_me): ?>
                        <button class="action-btn report-btn" onclick="showReportModal(0, <?= $disc_id ?>)">
                            <i class="fas fa-flag"></i> Report
                        </button>
                    <?php endif; ?>
                </div>
            </div>

            <!-- ── REPLIES ── -->
            <?php foreach ($replies as $idx => $r):
                $reply_pic = $r['profile_picture'] ?? 'default.png';
                $is_me = (bool)$r['is_me'];
                $is_teacher_reply = ($user_role === 'learner' && !$r['replier_anonymous'] && str_contains(strtolower($r['replier_display']), 'mr') || str_contains(strtolower($r['replier_display']), 'ms') || str_contains(strtolower($r['replier_display']), 'mrs') || str_contains(strtolower($r['replier_display']), 'dr'));
                $show_avatar = !($r['replier_anonymous'] && $user_role === 'learner');
                $r_initials = strtoupper(substr($r['replier_display'], 0, 1));
                $delay = min($idx * 40, 400);

                // Build parent preview
                $parent_preview = null;
                if ($r['parent_reply_id'] !== null) {
                    if ($r['parent_reply_id'] == 0) {
                        $parent_preview = [
                            'author' => $creator_display,
                            'text'   => substr($disc['initial_message'], 0, 100)
                        ];
                    } else {
                        foreach ($replies as $p) {
                            if ($p['id'] == $r['parent_reply_id']) {
                                $parent_preview = [
                                    'author' => $p['replier_display'],
                                    'text'   => substr($p['message'] ?? '', 0, 100)
                                ];
                                break;
                            }
                        }
                    }
                }
            ?>
            <div class="post-card <?= $is_me ? 'is-me' : '' ?>" data-id="<?= $r['id'] ?>"
                 style="animation-delay: <?= $delay ?>ms;">
                <div class="post-header">
                    <?php if ($show_avatar): ?>
                        <img src="uploads/learners/<?= htmlspecialchars($reply_pic) ?>"
                             class="post-avatar"
                             onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                        <div class="post-avatar-placeholder" style="display:none;"><?= $r_initials ?></div>
                    <?php else: ?>
                        <div class="post-avatar-placeholder">?</div>
                    <?php endif; ?>
                    <div class="post-meta">
                        <div class="post-author">
                            <?= htmlspecialchars($r['replier_display']) ?>
                            <?php if ($is_me): ?><span class="me-tag">You</span><?php endif; ?>
                        </div>
                        <div class="post-time"><?= date('M j, Y · g:i a', strtotime($r['created_at'])) ?></div>
                    </div>
                </div>

                <?php if ($parent_preview): ?>
                    <div class="reply-quote">
                        <div class="quote-author"><?= htmlspecialchars($parent_preview['author']) ?></div>
                        <div class="quote-text"><?= htmlspecialchars($parent_preview['text']) ?><?= strlen($parent_preview['text']) >= 100 ? '…' : '' ?></div>
                    </div>
                <?php endif; ?>

                <div class="post-body"><?= nl2br(htmlspecialchars($r['message'] ?? '')) ?></div>

                <?php if (!empty($r['attachment'])):
                    $ext = strtolower(pathinfo($r['attachment'], PATHINFO_EXTENSION));
                    $path = 'uploads/discussions/' . $r['attachment'];
                    $is_image = in_array($ext, ['jpg','jpeg','png','gif','webp']);
                ?>
                    <div class="post-attachment">
                        <?php if ($is_image): ?>
                            <img src="<?= $path ?>" alt="Attachment"
                                 onclick="openMedia('<?= $path ?>', 'image')">
                        <?php else: ?>
                            <div class="pdf-link" onclick="openMedia('<?= $path ?>', 'pdf')">
                                <i class="fas fa-file-pdf fa-lg"></i>
                                <span>Open PDF Document</span>
                            </div>
                        <?php endif; ?>
                    </div>
                <?php endif; ?>

                <div class="post-footer">
                    <?php if ($is_in_class): ?>
                        <button class="action-btn reply-btn"
                                onclick="setReply(<?= $r['id'] ?>, '<?= htmlspecialchars(addslashes($r['replier_display'])) ?>', <?= json_encode(substr($r['message'] ?? '', 0, 100)) ?>)">
                            <i class="fas fa-reply"></i> Reply
                        </button>
                    <?php endif; ?>
                    <?php if ($user_role === 'learner' && !$is_me): ?>
                        <button class="action-btn report-btn"
                                onclick="showReportModal(<?= $r['id'] ?>, <?= $disc_id ?>)">
                            <i class="fas fa-flag"></i> Report
                        </button>
                    <?php endif; ?>
                </div>
            </div>
            <?php endforeach; ?>

            <div id="bottom"></div>
        </div><!-- /posts-scroll -->

        <!-- ── COMPOSE AREA ── -->
        <?php if ($is_in_class): ?>
        <div class="compose-area">
            <!-- Reply preview strip -->
            <div id="replyPreview">
                <span class="rp-label">Replying to:</span>
                <span class="rp-text" id="previewText"></span>
                <button class="cancel-reply" onclick="cancelReply()" type="button">✕</button>
            </div>

            <!-- File preview -->
            <div id="filePreview">
                <img id="previewImg" src="" alt="Preview" style="display:none;">
                <span id="fileName"></span>
                <button class="clear-file" type="button" onclick="clearAttachment()">✕</button>
            </div>

            <form method="POST" enctype="multipart/form-data" id="replyForm">
                <input type="hidden" name="action" value="reply">
                <input type="hidden" name="reply_to" id="replyTo" value="0">

                <div class="compose-box">
                    <textarea name="message"
                              rows="1"
                              placeholder="Add to the discussion…"
                              id="composeTextarea"
                              autofocus></textarea>
                    <div class="compose-toolbar">
                        <!-- Attach -->
                        <label class="tool-btn" title="Attach image or PDF">
                            <i class="fas fa-paperclip"></i>
                            <input type="file" name="attachment" id="attachmentInput"
                                   accept="image/*,.pdf" style="display:none;">
                        </label>

                        <!-- Anonymous toggle -->
                        <label class="tool-btn anon-btn anon-on" id="anonLabel" title="Post anonymously">
                            <input type="checkbox" name="anonymous" id="anon" checked
                                   onchange="toggleAnonStyle(this)">
                            <i class="fas fa-user-secret"></i> Anon
                        </label>

                        <div class="spacer"></div>

                        <button type="submit" class="post-btn">
                            <i class="fas fa-paper-plane"></i> Post Reply
                        </button>
                    </div>
                </div>
            </form>
        </div>
        <?php endif; ?>

    </div><!-- /thread-panel -->
</div><!-- /page-layout -->

<script>
    // ── REPLY SETUP ──
    function setReply(msgId, authorName, previewText) {
        document.getElementById('replyTo').value = msgId;
        document.getElementById('previewText').textContent =
            authorName + ': ' + previewText.substring(0, 80) + (previewText.length > 80 ? '…' : '');
        const rp = document.getElementById('replyPreview');
        rp.style.display = 'flex';
        document.getElementById('composeTextarea').focus();
    }

    function cancelReply() {
        document.getElementById('replyTo').value = '0';
        document.getElementById('replyPreview').style.display = 'none';
    }

    // ── ANON STYLE TOGGLE ──
    function toggleAnonStyle(cb) {
        document.getElementById('anonLabel').classList.toggle('anon-on', cb.checked);
    }

    // ── REPORT MODAL ──
    function showReportModal(replyId, discId) {
        document.getElementById('reportReplyId').value = replyId > 0 ? replyId : '';
        document.getElementById('reportDiscId').value = discId;
        document.getElementById('reportModal').style.display = 'flex';
    }

    function closeReportModal() {
        document.getElementById('reportModal').style.display = 'none';
    }

    // ── INFO MODAL ──
    function toggleInfoModal() {
        const m = document.getElementById('infoModal');
        m.style.display = m.style.display === 'flex' ? 'none' : 'flex';
    }

    // ── FILE ATTACHMENT PREVIEW ──
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
                reader.onload = e => {
                    previewImg.src = e.target.result;
                    previewImg.style.display = 'block';
                };
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

    // ── AUTO-GROW TEXTAREA ──
    document.getElementById('composeTextarea')?.addEventListener('input', function() {
        this.style.height = 'auto';
        this.style.height = Math.min(this.scrollHeight, 140) + 'px';
    });

    // ── SCROLL TO BOTTOM ON LOAD ──
    const scroll = document.getElementById('postsScroll');
    if (scroll) scroll.scrollTop = scroll.scrollHeight;

    // ── BACK NAVIGATION ──
    function goBackToDiscussions() {
        if (document.referrer.includes('learner_dashboard.php') ||
            document.referrer.includes('teacher_dashboard.php')) {
            history.back();
        } else {
            const role = '<?= $_SESSION['role'] ?>';
            window.location.href = (role === 'teacher' ? 'teacher_dashboard.php' : 'learner_dashboard.php') + '?page=discussions.php';
        }
    }

    // ── MEDIA OVERLAY ──
    function openMedia(path, type) {
        const overlay = document.getElementById('mediaOverlay');
        const content = document.getElementById('mediaContent');
        overlay.style.display = 'flex';
        content.innerHTML = type === 'image'
            ? `<img src="${path}" alt="Preview">`
            : `<iframe src="${path}"></iframe>`;
        history.pushState({ viewingMedia: true }, '');
    }

    function closeMedia() {
        document.getElementById('mediaOverlay').style.display = 'none';
        document.getElementById('mediaContent').innerHTML = '';
    }

    window.onpopstate = function(event) {
        if (document.getElementById('mediaOverlay').style.display === 'flex') {
            closeMedia();
        }
    };
</script>
</body>
</html>