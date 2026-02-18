<?php
session_start();
require_once 'config.php';

if (!isset($_SESSION['email']) || $_SESSION['role'] !== 'learner' || !isset($_GET['quiz_id'])) {
    header("Location: index.php");
    exit();
}

$quizId = intval($_GET['quiz_id']);
$userEmail = $_SESSION['email'];

// Fetch quiz info
$stmt = $conn->prepare("SELECT title, duration, attempt_limit FROM quizzes WHERE id = ?");
$stmt->bind_param("i", $quizId);
$stmt->execute();
$stmt->bind_result($quizTitle, $duration, $attemptLimit);
$stmt->fetch();
$stmt->close();

// --- ADD THIS: Check for existing attempt ---
$attemptStatus = '';
$stmt = $conn->prepare("SELECT status FROM quiz_attempts WHERE quiz_id = ? AND user_email = ? LIMIT 1");
$stmt->bind_param("is", $quizId, $userEmail);
$stmt->execute();
$stmt->bind_result($attemptStatus);
$stmt->fetch();
$stmt->close();

// Decide button text and instructions based on status
$isContinuing = ($attemptStatus === 'in_progress');
$buttonText = $isContinuing ? "Continue Quiz" : "Start Quiz";

// ────────────────────── YOUR MOBILE DETECTION ──────────────────────
$user_agent = $_SERVER['HTTP_USER_AGENT'] ?? '';
$is_mobile = preg_match("/(android|iphone|ipad|ipod|webos|windows phone|mobile)/i", $user_agent);
// ──────────────────────────────────────────────────────────────────
?>

<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <link rel="icon" type="image/svg+xml" href="/icon.svg?v=1.2">
    <title>Quiz Instructions</title>
    <style>
    :root {
        --bg-color:       #0d1117;
        --card-bg:        #1b1b1b;
        --text-color:     #e2e8f0;
        --secondary-text: #8b949e;
        --accent-color:   #4fd1c5;
        --button-bg:      rgba(79, 209, 197, 0.1);
        --button-hover-bg:rgba(79, 209, 197, 0.2);
        --border-color:   rgba(255, 255, 255, 0.05);
        --glass-bg:       rgba(255, 255, 255, 0.03);
        --shadow-soft:    0 2px 10px rgba(0,0,0,0.25);
        --warning-color:  #f85149;   /* red for warnings */
        --info-color:     #4fd1c5;   /* teal for info accents */
    }

    body {
        font-family: 'Nunito', sans-serif;
        background-color: var(--bg-color);
        color: var(--text-color);
        margin: 0;
        padding: 30px;
        line-height: 1.6;
    }

    .container {
        max-width: 700px;
        margin: auto;
        background-color: var(--card-bg);
        padding: 30px;
        border-radius: 12px;
        box-shadow: var(--shadow-soft);
        border: 1px solid var(--border-color);
    }

    h2 {
        color: var(--text-color);
        margin-bottom: 25px;
        font-weight: 700;
        text-align: center;
        font-size: 24px;
    }

    h3 {
        color: var(--text-color);
        font-size: 18px;
        margin: 25px 0 15px;
        font-weight: 600;
    }

    ul {
        list-style-type: none;
        padding-left: 0;
    }

    li {
        margin-bottom: 12px;
        color: var(--secondary-text);
        font-size: 15px;
        position: relative;
        padding-left: 24px;
    }

    li::before {
        content: "•";
        color: var(--accent-color);
        position: absolute;
        left: 0;
        font-weight: bold;
    }

    .quiz-info {
        background: var(--glass-bg);
        border: 1px solid var(--border-color);
        padding: 18px;
        border-radius: 10px;
        margin-bottom: 25px;
        font-size: 15px;
        color: var(--secondary-text);
    }

    .quiz-info p {
        margin: 10px 0;
    }

    .quiz-info strong {
        color: var(--text-color);
    }

    /* AI Invigilator box – subtle glass with teal accent */
    .ai-box {
        background: var(--glass-bg);
        border: 1px solid var(--border-color);
        border-left: 4px solid var(--accent-color);
        padding: 18px;
        border-radius: 10px;
        margin: 30px 0 25px;
    }

    .ai-box h4 {
        color: var(--accent-color);
        margin: 0 0 12px;
        font-size: 17px;
        display: flex;
        align-items: center;
        gap: 10px;
    }

    .ai-box p {
        margin: 0 0 12px;
        font-size: 13.5px;
        color: var(--secondary-text);
    }

    .ai-box ul {
        margin: 10px 0 0;
    }

    .ai-box li {
        font-size: 13.5px;
        color: var(--secondary-text);
    }

    .mobile-warning {
        font-size: 12.5px;
        color: var(--warning-color);
        margin-top: 12px;
        font-style: italic;
        display: flex;
        align-items: center;
        gap: 8px;
    }

    /* Start/Continue button – teal glass style */
    .start-btn {
        background: var(--button-bg);
        color: var(--text-color);
        padding: 14px 30px;
        border: 1px solid var(--border-color);
        border-radius: 10px;
        font-size: 16px;
        font-weight: 700;
        cursor: pointer;
        transition: all 0.3s ease;
        display: block;
        margin: 35px auto 0;
        width: 100%;
        max-width: 320px;
        text-align: center;
    }

    .start-btn:hover {
        background: var(--button-hover-bg);
        border-color: var(--accent-color);
        transform: translateY(-1px);
    }

    /* Continue state – slightly different but still teal family */
    .start-btn.continue {
        background: rgba(79,209,197,0.15);
        border-color: rgba(79,209,197,0.4);
    }

    .start-btn.continue:hover {
        background: rgba(79,209,197,0.25);
    }

    /* Mobile overrides */
    <?php if ($is_mobile): ?>
    body { padding: 15px; }
    .container { padding: 20px; border-radius: 0; box-shadow: none; }
    <?php endif; ?>
</style>
</head>
<body>

<div class="container">
    <h2>
   <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 24px; height: 24px; margin-right: 10px; stroke: var(--accent-color); flex-shrink: 0;">
    <circle cx="12" cy="12" r="10" />
    <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
</svg>
    Quiz Instructions
</h2>

    <div class="quiz-info">
        <p><strong>Quiz Title:</strong> <?= htmlspecialchars($quizTitle) ?></p>
        <p><strong>Duration:</strong> <?= $duration ?> minutes</p>
        <p><strong>Attempts Allowed:</strong> <?= $attemptLimit ?></p>
    </div>

    <h3 style="color:#c9d1d9;">⚠️ Please read carefully:</h3>
    <ul>
        <?php if ($isContinuing): ?>
            <li style="color: #e67e22;"><strong>Note:</strong> You have an unfinished attempt. You will resume from where you left off.</li>
        <?php endif; ?>
        <li>You can only attempt this quiz <strong><?= $attemptLimit ?></strong> time(s).</li>
        <li>Once you begin, the timer will start immediately and cannot be paused.</li>
        <li>Ensure you have a stable internet connection before starting.</li>
    </ul>

    <div style="background: rgba(79, 209, 197, 0.05); border: 1px solid rgba(79, 209, 197, 0.3); border-radius: 10px; padding: 15px; margin-top: 25px;">
        <h4 style="color: #4fd1c5; margin-top: 0; display: flex; align-items: center; gap: 10px;">
            <i class="fas fa-robot"></i> AI Invigilator Active
        </h4>
        <p style="font-size: 13px; color: #8b949e; line-height: 1.5; margin-bottom: 0;">
            This session is monitored by our AI system. To maintain academic integrity, the following are logged:
        </p>
        <ul style="font-size: 13px; color: #c9d1d9; margin-top: 8px;">
            <li><strong>Focus Tracking:</strong> Switching tabs or windows will be flagged.</li>
            <li><strong>Device Lockdown:</strong> Do not minimize the browser or app during the quiz.</li>
            <li><strong>Session Integrity:</strong> Copy-pasting and right-clicking are disabled.</li>
        </ul>
        <?php if ($is_mobile): ?>
            <p style="font-size: 12px; color: #f6877a; margin-top: 8px; font-style: italic;">
                <i class="fas fa-mobile-alt"></i> Mobile Users: Receiving calls or switching apps will result in an automatic warning.
            </p>
        <?php endif; ?>
    </div>

    <div style="margin-top: 25px;">
        <form method="GET" action="take_quiz.php" <?= $is_mobile ? 'target="_blank"' : '' ?>>
            <input type="hidden" name="quiz_id" value="<?= $quizId ?>">
            
            <?php if ($is_mobile): ?>
                <input type="hidden" name="mobile" value="true">
            <?php endif; ?>
            
            <button type="submit" class="start-btn" <?= $isContinuing ? 'style="background-color: #e67e22;"' : '' ?>>
                <?= $buttonText ?>
            </button>
        </form>
    </div>

</body>
</html>