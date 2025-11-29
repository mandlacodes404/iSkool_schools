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
            padding: 32px;
            max-width: 420px;
            margin: 0 auto;
            border: 1px solid var(--border);
            box-shadow: 0 8px 30px rgba(0,0,0,0.4);
        }
        h2 {
            margin: 0 0 24px 0;
            font-size: 28px;
            color: var(--accent);
            text-align: center;
            font-weight: 700;
        }
        ul { list-style: none; padding: 0; margin: 0; }
        li { margin: 16px 0; }
        button, a {
            width: 100%;
            padding: 16px;
            border: none;
            border-radius: 12px;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 12px;
            transition: all 0.3s ease;
            text-decoration: none;
        }
        #updateTeacherProfileBtn {
            background: rgba(79, 209, 197, 0.15);
            color: var(--accent);
            border: 1.5px solid var(--accent);
        }
        #updateTeacherProfileBtn:hover {
            background: var(--accent);
            color: #000;
            transform: translateY(-3px);
            box-shadow: 0 6px 20px rgba(79, 209, 197, 0.3);
        }
        #removeTeacherProfileBtn {
            background: rgba(248, 81, 73, 0.15);
            color: var(--danger);
            border: 1.5px solid var(--danger);
        }
        #removeTeacherProfileBtn:hover {
            background: var(--danger);
            color: white;
            transform: translateY(-3px);
            box-shadow: 0 6px 20px rgba(248, 81, 73, 0.3);
        }
        .logout-link {
            background: var(--danger);
            color: white;
        }
        .logout-link:hover {
            background: #c0392b;
            transform: translateY(-3px);
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