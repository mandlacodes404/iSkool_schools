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
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Settings</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.2/css/all.min.css" integrity="sha512-z3gLpd7yknf1YoNbCzqRKc4qyor8gaKU1qmn+CShxbuBusANI9QpRohGBreCFkKxLhei6S9CQXFEbbKuqLg0DA==" crossorigin="anonymous" referrerpolicy="no-referrer" />
    <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@600&display=swap" rel="stylesheet">
    <style>
        :root {
            --bg-color: #0d1117;
            --card-bg: #1a202c;
            --text-color: #e0e6f0;
            --accent-color: #4fd1c5;
            --button-bg: #2c3e50;
            --button-hover-bg: #34495e;
            --disabled-bg: #3a3f47;
            --disabled-text: #7a7f88;
            --card-radius: 12px;
            --shadow-glow: rgba(79, 209, 197, 0.3);
            --border-color: rgba(255, 255, 255, 0.1);
            --danger-bg: #ff4444;
            --danger-hover: #ff6666;
        }

        body {
            margin: 0;
            font-family: 'Nunito', sans-serif;
            font-weight: 600;
            background-color: var(--bg-color);
            color: var(--text-color);
            padding: 20px;
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            align-items: center;
        }

        .container {
            max-width: 800px;
            width: 100%;
        }

        .header {
            text-align: center;
            margin-bottom: 30px;
        }

        h2 {
            font-size: 28px;
            color: var(--text-color);
            margin: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 10px;
        }

        .settings-card {
            background: var(--card-bg);
            border-radius: var(--card-radius);
            padding: 30px;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
            border: 1px solid var(--border-color);
        }

        ul {
            list-style: none;
            padding: 0;
            margin: 0;
        }

        li {
            margin-bottom: 15px;
        }

        li:last-child {
            margin-bottom: 0;
        }

        button,
        a.btn {
            width: 100%;
            padding: 14px 20px;
            border: none;
            border-radius: var(--card-radius);
            background-color: var(--button-bg);
            color: var(--text-color);
            font-family: 'Nunito', sans-serif;
            font-weight: 600;
            font-size: 16px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 12px;
            text-decoration: none;
            transition: all 0.3s ease;
        }

        button:hover,
        a.btn:hover {
            background-color: var(--accent-color);
            color: var(--bg-color);
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        }

        /* Accent style for Update Profile */
        #updateProfileBtn {
            background-color: rgba(79, 209, 197, 0.15);
            border: 1px solid rgba(79, 209, 197, 0.3);
            color: var(--accent-color);
        }

        #updateProfileBtn:hover {
            background-color: var(--accent-color);
            color: var(--bg-color);
        }

        /* Danger style for Remove Profile */
        #removeProfileBtn {
            background-color: rgba(255, 68, 68, 0.15);
            border: 1px solid rgba(255, 68, 68, 0.3);
            color: #ff6666;
        }

        #removeProfileBtn:hover {
            background-color: var(--danger-bg);
            color: white;
        }

        /* Logout button */
        .logout-link {
            background: linear-gradient(135deg, #ff4444, #cc0000);
            box-shadow: 0 4px 12px rgba(255, 68, 68, 0.3);
        }

        .logout-link:hover {
            background: linear-gradient(135deg, #ff6666, #aa0000);
            box-shadow: 0 6px 16px rgba(255, 68, 68, 0.4);
        }

        button i,
        a.btn i {
            font-size: 18px;
            color: inherit;
        }

        @media (max-width: 768px) {
            .container {
                padding: 0 10px;
            }

            h2 {
                font-size: 24px;
            }

            .settings-card {
                padding: 20px;
            }

            button,
            a.btn {
                padding: 12px 16px;
                font-size: 15px;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h2>Settings</h2>
        </div>

        <div class="settings-card">
            <div style="background: rgba(79, 209, 197, 0.05); border-left: 4px solid var(--accent-color); padding: 15px; margin-bottom: 20px; border-radius: 8px;">
                 <h4 style="margin: 0 0 10px 0; color: var(--accent-color); font-size: 16px;">
                   <i class="fas fa-lightbulb"></i> Notification Help
                    </h4>
                 <ol style="margin: 0; padding-left: 20px; font-size: 13px; color: #aaa; line-height: 1.6;">
                     <li><strong>iPhone Users:</strong> You must "Add to Home Screen" first for notifications to work.</li>
                    <li>Tap <strong>Sync Notifications</strong> below if you aren't getting quiz alerts.</li>
                    <li>If prompted, select <strong>"Allow"</strong> on the system popup.</li>
                 </ol>
           </div>
            <ul>
                <li>
                    <button id="updateProfileBtn">
                        <i class="fas fa-user-circle"></i> Update Profile Picture
                    </button>
                </li>

                <li>
                    <button id="removeProfileBtn">
                        <i class="fas fa-user-slash"></i> Remove Profile Picture
                    </button>
                </li>

                <li>
                    <a href="logout.php" target="_top" class="btn logout-link">
                        <i class="fas fa-sign-out-alt"></i> Logout
                    </a>
                </li>

                <li>
                     <div style="margin-bottom: 8px; font-size: 13px; color: #aaa; padding: 0 5px;">
                      <i class="fas fa-info-circle"></i> Not receiving alerts? Tap below to sync.
                       </div>
                       <button id="syncPushBtn" style="background-color: rgba(79, 209, 197, 0.1); border: 1px solid var(--accent-color); color: var(--accent-color);">
                      <i class="fas fa-bell"></i> Sync Notifications
                     </button>
                </li>
            </ul>
        </div>

<script>
document.addEventListener('DOMContentLoaded', function () {
    const updateBtn = document.getElementById('updateProfileBtn');
    const removeBtn = document.getElementById('removeProfileBtn');
    const syncPushBtn = document.getElementById('syncPushBtn');

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

    syncPushBtn.addEventListener('click', () => {
    // Check if the function exists on the parent dashboard
    if (window.parent && typeof window.parent.requestIphonePush === 'function') {
        window.parent.requestIphonePush();
    } else {
        alert("Notification system is currently unavailable.");
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