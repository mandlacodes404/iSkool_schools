<?php
session_start();
if (!isset($_SESSION['email'])) {
    exit('Unauthorized');
}

$learnerEmail = $_SESSION['email'];
$defaultPic = 'default.png';
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Settings</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.2/css/all.min.css">
    <style>
        :root {
            --bg: #0d1117;
            --card: #1a202c;
            --text: #e2e8f0;
            --accent: #4fd1c5;
            --danger: #f85149;
            --border: rgba(255,255,255,0.08);
        }
        body {
            margin: 0;
            padding: 24px;
            background: var(--bg);
            color: var(--text);
            font-family: 'Nunito', sans-serif;
            min-height: 100vh;
        }
        .settings-card {
            background: var(--card);
            border-radius: 16px;
            padding: 28px;
            max-width: 420px;
            margin: 0 auto;
            border: 1px solid var(--border);
            box-shadow: 0 8px 25px rgba(0,0,0,0.3);
        }
        h2 {
            margin: 0 0 24px 0;
            font-size: 26px;
            color: var(--accent);
            text-align: center;
            font-weight: 700;
        }
        ul {
            list-style: none;
            padding: 0;
            margin: 0;
        }
        li {
            margin-bottom: 14px;
        }
        button, a {
            width: 100%;
            padding: 14px 16px;
            border: none;
            border-radius: 12px;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 10px;
            transition: all 0.3s ease;
            text-decoration: none;
        }
        #updateProfileBtn {
            background: rgba(79, 209, 197, 0.15);
            color: var(--accent);
            border: 1.5px solid var(--accent);
        }
        #updateProfileBtn:hover {
            background: var(--accent);
            color: #000;
            transform: translateY(-2px);
        }
        #removeProfileBtn {
            background: rgba(248, 81, 73, 0.15);
            color: var(--danger);
            border: 1.5px solid var(--danger);
        }
        #removeProfileBtn:hover {
            background: var(--danger);
            color: white;
            transform: translateY(-2px);
        }
        .logout-link {
            background: var(--danger);
            color: white;
        }
        .logout-link:hover {
            background: #c0392b;
            transform: translateY(-2px);
        }
    </style>
</head>
<body>

<div class="settings-card">
    <h2>Settings</h2>
    
    <ul>
        <li>
            <button id="updateProfileBtn">
                Update Profile Picture
            </button>
        </li>

        <li>
            <button id="removeProfileBtn">
                Remove Profile Picture
            </button>
        </li>

        <li>
            <a href="logout.php" target="_top" class="logout-link">
                Logout
            </a>
        </li>
    </ul>
</div>

<script>
document.addEventListener('DOMContentLoaded', function () {
    const updateBtn = document.getElementById('updateProfileBtn');
    const removeBtn = document.getElementById('removeProfileBtn');

    updateBtn.addEventListener('click', () => {
        const iframeWindow = window.parent;
        if (iframeWindow) {
            const input = iframeWindow.document.getElementById('profileInput');
            if (input) input.click();
        }
    });

    removeBtn.addEventListener('click', () => {
        if (!confirm('Remove profile picture?')) return;

        const iframeWindow = window.parent;
        if (iframeWindow) {
            const avatar = iframeWindow.document.querySelector('.learner-avatar');
            if (avatar) {
                avatar.src = 'uploads/learners/<?= $defaultPic ?>?v=' + Date.now();
            }

            fetch('upload_profile.php', {
                method: 'POST',
                body: new URLSearchParams({ remove: '1' })
            })
            .then(res => res.json())
            .then(data => {
                if (!data.success) {
                    alert(data.error || 'Failed');
                location.reload();
                }
            });
        }
    });

    // THIS IS THE MAGIC LINE THAT FIXES DOUBLE UPLOAD
    // Listen for successful upload from the dashboard script and update sidebar instantly
    window.addEventListener('profileUpdated', function(e) {
        const avatar = document.querySelector('.learner-avatar');
        if (avatar && e.detail?.newSrc) {
            avatar.src = e.detail.newSrc + '?v=' + Date.now();
        }
    });
});
</script>

</body>
</html>