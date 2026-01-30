<?php
session_start();
require_once 'config.php';

if (!isset($_SESSION['email'])) {
    exit('Unauthorized');
}

$learnerEmail = $_SESSION['email'];
$defaultPic = 'default.png';

// --- FETCH LEARNER INFO FOR INITIALS ---
$learnerName           = $_SESSION['name'] ?? '';
$learnerSurname        = '';
$learnerProfilePicture = 'default.png';

$stmt = $conn->prepare("SELECT name, surname, profile_picture FROM users WHERE email = ?");
$stmt->bind_param("s", $learnerEmail);
$stmt->execute();
$res = $stmt->get_result();

if ($row = $res->fetch_assoc()) {
    $learnerName           = $row['name'] ?: $learnerName;
    $learnerSurname        = $row['surname'] ?: '';
    $learnerProfilePicture = $row['profile_picture'] ?: 'default.png';
}
$stmt->close();

// Generate Initials (MM)
$firstInitial = !empty($learnerName) ? strtoupper(substr(trim($learnerName), 0, 1)) : '';
$lastInitial  = !empty($learnerSurname) ? strtoupper(substr(trim($learnerSurname), 0, 1)) : '';
$initials     = $firstInitial . $lastInitial;
if (empty($initials)) { $initials = "??"; }
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
        --danger-bg:      rgba(248, 81, 73, 0.15);
        --danger-hover:   rgba(248, 81, 73, 0.3);
        --card-radius:    12px;
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
        box-shadow: var(--shadow-soft);
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
        border: 1px solid var(--border-color);
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
        background-color: var(--button-hover-bg);
        border-color: var(--accent-color);
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    }

    /* Update Profile – subtle teal glass */
    #updateProfileBtn {
        background-color: var(--glass-bg);
        border: 1px solid rgba(79, 209, 197, 0.3);
        color: var(--accent-color);
    }

    #updateProfileBtn:hover {
        background-color: var(--button-hover-bg);
        border-color: var(--accent-color);
        color: var(--text-color);
    }

    /* Remove Profile – danger style but muted */
    #removeProfileBtn {
        background-color: var(--danger-bg);
        border: 1px solid rgba(248, 81, 73, 0.3);
        color: #ff6666;
    }

    #removeProfileBtn:hover {
        background-color: var(--danger-hover);
        color: white;
    }

    /* Logout – danger but consistent */
    .logout-link {
        background: var(--danger-bg);
        border: 1px solid rgba(248, 81, 73, 0.3);
        color: #ff6666;
    }

    .logout-link:hover {
        background: var(--danger-hover);
        color: white;
        transform: translateY(-2px);
    }

    button i,
    a.btn i {
        font-size: 18px;
        color: inherit;
    }

    /* Notification Help box – glass with teal accent */
    .notification-help {
        background: var(--glass-bg);
        border: 1px solid var(--border-color);
        border-left: 4px solid var(--accent-color);
        padding: 15px;
        margin-bottom: 20px;
        border-radius: 8px;
    }

    .notification-help h4 {
        margin: 0 0 10px 0;
        color: var(--accent-color);
        font-size: 16px;
        display: flex;
        align-items: center;
        gap: 10px;
    }

    .notification-help ol {
        margin: 0;
        padding-left: 20px;
        font-size: 13px;
        color: var(--secondary-text);
        line-height: 1.6;
    }

    .notification-help li {
        color: var(--secondary-text);
    }

    /* Sync Notifications button – glass teal */
    #syncPushBtn {
        background-color: var(--button-bg);
        border: 1px solid var(--border-color);
        color: var(--accent-color);
    }

    #syncPushBtn:hover {
        background-color: var(--button-hover-bg);
        border-color: var(--accent-color);
        color: var(--text-color);
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
                    <a href="logout.php" target="_top" class="btn logout-link" onclick="localStorage.removeItem('lastLearnerPage');">
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

    const iframeWindow = window.parent; // This is the Dashboard
    
    fetch('upload_profile.php', {
        method: 'POST',
        body: new URLSearchParams({ remove: '1' })
    })
    .then(res => res.json())
    .then(data => {
        if (data.success && iframeWindow) {
            // Find the wrapper in the Sidebar (Parent)
            const avatarWrapper = iframeWindow.document.querySelector('.profile-picture-wrapper');
            
            if (avatarWrapper) {
                // We use the initials we calculated in PHP at the top
                const phpInitials = <?= json_encode($initials) ?>;
                
                // REBUILD THE INITIALS DIV (Exactly like the Dashboard's style)
                // REBUILD WITH THE CHARCOAL & SILVER STYLE
                avatarWrapper.innerHTML = `
                    <div class="initials-avatar" style="
                        width: 40px; 
                        height: 40px; 
                        border-radius: 50%; 
                        display: flex; 
                        align-items: center; 
                        justify-content: center; 
                        background-color: #2d2d2d; 
                        color: #a0a0a0; 
                        font-size: 14px; 
                        font-weight: 800; 
                        border: 3px solid #757272ff; 
                        user-select: none; 
                        text-transform: uppercase; 
                        letter-spacing: -1px;
                    ">
                        ${phpInitials}
                    </div>
                `;
            }
            alert('Profile picture removed!');
        } else {
            alert(data.error || 'Failed to remove');
        }
    })
    .catch(err => alert('Connection error'));
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