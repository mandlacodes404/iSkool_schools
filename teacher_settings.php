<?php
session_start();
if (!isset($_SESSION['teacher'])) {
    exit('Unauthorized');
}

$teacherEmail = $_SESSION['email'];
$teacherName  = $_SESSION['name'] ?? 'Teacher';
$defaultPic   = 'default_teacher.png';
?>

<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Teacher Settings • iSkool</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.2/css/all.min.css">
    <style>
    :root {
        --bg: #000000;
        --card: rgba(15, 15, 15, 0.82);
        --glass-border: rgba(255, 255, 255, 0.09);
        --text: #ffffff;
        --text-muted: #b0b0b0;
        --accent: #4fd1c5;
        --danger: #ff4444;
        --hover-glow: 0 0 22px rgba(79, 209, 197, 0.45);
    }

    * { box-sizing: border-box; }

    body {
        margin: 0;
        padding: 24px;
        min-height: 100vh;
        background: var(--bg);
        color: var(--text);
        font-family: 'Nunito', sans-serif;
        display: flex;
        align-items: center;
        justify-content: center;
        background-image: 
            radial-gradient(circle at 15% 25%, rgba(79, 209, 197, 0.07) 0%, transparent 25%),
            radial-gradient(circle at 85% 75%, rgba(79, 209, 197, 0.05) 0%, transparent 25%);
    }

    .settings-card {
        width: 100%;
        max-width: 440px;
        background: var(--card);
        backdrop-filter: blur(22px);
        -webkit-backdrop-filter: blur(22px);
        border: 1px solid var(--glass-border);
        border-radius: 26px;
        padding: 44px 36px;
        box-shadow:
            0 25px 50px rgba(0, 0, 0, 0.5),
            0 0 80px rgba(79, 209, 197, 0.1);
        text-align: center;
        animation: fadeIn 0.7s ease-out;
    }

    @keyframes fadeIn {
        from { opacity: 0; transform: translateY(30px); }
        to   { opacity: 1; transform: translateY(0); }
    }

    h2 {
        margin: 0 0 36px 0;
        font-size: 34px;
        font-weight: 800;
        background: linear-gradient(135deg, #4fd1c5, #6df5e9);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
    }

    ul { list-style: none; padding: 0; margin: 0; }
    li { margin-bottom: 18px; }

    button, a {
        width: 100%;
        padding: 19px 22px;
        border: none;
        border-radius: 18px;
        font-family: 'Nunito', sans-serif;
        font-size: 17.5px;
        font-weight: 700;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 16px;
        transition: all 0.4s ease;
        position: relative;
        overflow: hidden;
        text-decoration: none;
        color: white;
    }

    button::before, a::before {
        content: '';
        position: absolute;
        top: 0; left: -100%;
        width: 100%; height: 100%;
        background: linear-gradient(90deg, transparent, rgba(255,255,255,0.12), transparent);
        transition: left 0.7s;
    }

    button:hover::before, a:hover::before { left: 100%; }

    #updateTeacherProfileBtn {
        background: rgba(79, 209, 197, 0.16);
        border: 1.8px solid rgba(79, 209, 197, 0.4);
        color: #4fd1c5;
    }
    #updateTeacherProfileBtn:hover {
        background: #4fd1c5;
        color: #000;
        transform: translateY(-5px);
        box-shadow: var(--hover-glow);
    }

    #removeTeacherProfileBtn {
        background: rgba(255, 68, 68, 0.15);
        border: 1.8px solid rgba(255, 68, 68, 0.4);
        color: #ff6666;
    }
    #removeTeacherProfileBtn:hover {
        background: #ff4444;
        color: white;
        transform: translateY(-5px);
        box-shadow: 0 0 25px rgba(255, 68, 68, 0.5);
    }

    .logout-link {
        background: linear-gradient(135deg, #ff3333, #cc0000);
        margin-top: 10px;
        box-shadow: 0 10px 30px rgba(255, 51, 51, 0.35);
    }
    .logout-link:hover {
        background: linear-gradient(135deg, #ff1111, #aa0000);
        transform: translateY(-5px);
        box-shadow: 0 15px 40px rgba(255, 51, 51, 0.5);
    }

    button i, a i {
        font-size: 21px;
        width: 30px;
    }

    @media (max-width: 480px) {
        .settings-card { padding: 36px 28px; border-radius: 22px; }
        h2 { font-size: 30px; }
    }
</style>
</head>
<body>

<div class="settings-card">
    <h2>Teacher Settings</h2>

    <ul>
        <li>
            <button id="updateTeacherProfileBtn">
                Update Profile Picture
            </button>
        </li>

        <li>
            <button id="removeTeacherProfileBtn">
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
    const updateBtn = document.getElementById('updateTeacherProfileBtn');
    const removeBtn = document.getElementById('removeTeacherProfileBtn');

    // UPDATE BUTTON — NOW WORKS 100%
    updateBtn.addEventListener('click', () => {
        const parentWin = window.parent;
        if (parentWin?.document?.getElementById('teacherProfileInput')) {
            parentWin.document.getElementById('teacherProfileInput').click();
        }
    });

    // REMOVE BUTTON — instant default + cache buster
    removeBtn.addEventListener('click', () => {
        if (!confirm('Remove profile picture?')) return;

        const parentWin = window.parent;
        const avatar = parentWin?.document?.querySelector('.teacher-avatar');

        if (avatar) {
            avatar.src = 'uploads/teachers/<?= $defaultPic ?>?v=' + Date.now();
        }

        fetch('upload_profile.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: 'remove=1&role=teacher'
        })
        .then(r => r.json())
        .then(data => {
            if (!data.success) alert(data.error || 'Failed to remove');
        })
        .catch(() => alert('Network error'));
    });
});
</script>

</body>
</html>