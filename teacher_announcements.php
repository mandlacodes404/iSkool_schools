<?php
session_start();
require_once 'config.php';

if (!isset($_SESSION['email']) || $_SESSION['role'] !== 'teacher') {
    header("Location: index.php");
    exit();
}

$email = $_SESSION['email'];

// GET CURRENT ACADEMIC YEAR AUTOMATICALLY (NO SCHOOL_ID NEEDED)
$current_academic_year_id = null;
$result = $conn->query("SELECT id FROM academic_years WHERE is_current = 1 LIMIT 1");
if ($row = $result->fetch_assoc()) {
    $current_academic_year_id = $row['id'];
}

if (!$current_academic_year_id) {
    die("No active academic year found.");
}

/* -------------------------------------------------
   FETCH ANNOUNCEMENTS + CLASS NAME (NO SCHOOL_ID FILTER)
   ------------------------------------------------- */
$sql = "
    SELECT 
        a.id, a.title, a.message, a.created_at,
        c.id AS class_id, c.name AS class_name
    FROM announcements a
    JOIN classes c ON a.class_id = c.id
    WHERE a.created_by = ? 
      AND a.academic_year_id = ?
    ORDER BY a.created_at DESC
";

$stmt = $conn->prepare($sql);
$stmt->bind_param("si", $email, $current_academic_year_id);
$stmt->execute();
$result = $stmt->get_result();

/* -------------------------------------------------
   GROUP BY class_id (unchanged logic — still perfect)
   ------------------------------------------------- */
$grouped = [];
while ($row = $result->fetch_assoc()) {
    $cid = $row['class_id'];
    if (!isset($grouped[$cid])) {
        $grouped[$cid] = [
            'info' => [
                'id'   => $cid,
                'name' => $row['class_name']
            ],
            'items' => []
        ];
    }
    $grouped[$cid]['items'][] = $row;
}

$stmt->close();
?>

<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>My Sent Announcements</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css">
    <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@600&display=swap" rel="stylesheet">
    <style>
        :root {
            --bg-color: #0d1117;
            --card-bg: #161b22;
            --text-color: #ffffff;
            --accent-color: #00ff99;
            --card-radius: 12px;
            --shadow-glow: rgba(255, 255, 255, 0.6);
        }

        body {
            margin: 0;
            font-family: 'Nunito', sans-serif;
            background-color: var(--bg-color);
            color: var(--text-color);
            padding: 20px;
        }

        h2 {
            color: var(--text-color);
            margin-bottom: 20px;
            text-align: center;
            font-weight: 600;
            font-size: 24px;
        }

        /* ---------- CLASS GROUP ---------- */
        .class-group {
            margin-bottom: 25px;
            border: 1px solid rgba(255,255,255,.1);
            border-radius: var(--card-radius);
            overflow: hidden;
            background: var(--card-bg);
        }
        .class-header {
            padding: 15px;
            background: rgba(255,255,255,.05);
            display: flex;
            justify-content: space-between;
            align-items: center;
            cursor: pointer;
            transition: background .3s;
        }
        .class-header:hover { background: rgba(255,255,255,.08); }
        .class-header h3 {
            margin: 0;
            font-size: 18px;
            color: var(--accent-color);
            font-weight: 600;
        }
        .class-header .count {
            font-size: 14px;
            color: #8b949e;
        }
        .class-header .toggle-class {
            background: none;
            border: none;
            color: var(--text-color);
            font-size: 18px;
            cursor: pointer;
            padding: 0 5px;
        }
        .class-header .toggle-class.active i { transform: rotate(180deg); }
        .class-items { display: none; padding: 0 15px 15px; }
        .class-items.show { display: block; }

        .announcement {
            background: rgba(0,0,0,.2);
            padding: 12px;
            border-radius: var(--card-radius);
            margin: 10px 0;
            box-shadow: 0 0 10px rgba(255,255,255,.1);
            backdrop-filter: blur(10px);
            animation: fadeSlideIn 0.5s ease forwards;
        }

        .announcement h3 {
            margin: 0;
            font-size: 16px;
            color: var(--text-color);
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .announcement h3 .fa-chevron-down {
            color: var(--accent-color);
            text-shadow: 0 0 10px var(--accent-color);
            transition: transform 0.3s ease;
        }

        .announcement h3.active .fa-chevron-down {
            transform: rotate(180deg);
        }

        .announcement-details {
            display: none;
            padding: 10px 12px;
            background: rgba(0,0,0,0.2);
            border-radius: 0 0 var(--card-radius) var(--card-radius);
            margin-top: 2px;
        }

        .announcement-details p {
            margin: 5px 0;
            color: var(--text-color);
            font-size: 14px;
            line-height: 1.5;
        }

        p.empty {
            text-align: center;
            color: var(--text-color);
            font-size: 14px;
        }

        #loaderOverlay {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(13, 17, 23, 0.85);
            backdrop-filter: blur(6px);
            display: none;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            z-index: 1000;
            opacity: 0;
            transition: opacity 0.4s ease;
        }

        #loaderOverlay.show {
            display: flex;
            opacity: 1;
        }

        .loader-container { text-align: center; }
        .loader-book i {
            font-size: 5rem;
            color: var(--accent-color);
            text-shadow: 0 0 10px var(--accent-color);
            animation: rotateBook 4s linear infinite;
        }
        .loader-text {
            font-size: 18px;
            color: var(--text-color);
            font-weight: 600;
            font-family: 'Nunito', sans-serif;
            margin-top: 15px;
        }

        @keyframes rotateBook { 0%{transform:rotate(0)} 100%{transform:rotate(360deg)} }
        @keyframes fadeSlideIn { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }

        @media (max-width: 768px) {
            body { margin-bottom: 80px; }
        }
        @media (max-width: 480px) {
            body { padding: 10px; }
            h2 { font-size: 20px; }
            .announcement { padding: 10px; }
            .announcement h3 { font-size: 14px; }
            .announcement-details p { font-size: 13px; }
            .loader-book i { font-size: 4rem; }
            .loader-text { font-size: 16px; }
        }
        @media (max-width: 360px) {
            h2 { font-size: 18px; }
            .announcement { padding: 8px; }
            .announcement h3 { font-size: 13px; }
            .announcement-details p { font-size: 12px; }
            .loader-book i { font-size: 3rem; }
            .loader-text { font-size: 14px; }
        }
    </style>
</head>
<body>
    <h2>Sent Announcements</h2>

    <?php if (!empty($grouped)): ?>
        <?php foreach ($grouped as $classId => $class): ?>
            <div class="class-group">
                <div class="class-header">
                    <h3><?= htmlspecialchars($class['info']['name']) ?></h3>
                    <div>
                        <span class="count">(<?= count($class['items']) ?>)</span>
                        <button class="toggle-class" aria-label="Toggle announcements"><i class="fas fa-chevron-down"></i></button>
                    </div>
                </div>
                <div class="class-items">
                    <?php foreach ($class['items'] as $ann): ?>
                        <div class="announcement">
                            <h3 onclick="toggleDetails(this)">
                                <i class="fas fa-chevron-down"></i>
                                <?= htmlspecialchars($ann['title']) ?>
                            </h3>
                            <div class="announcement-details" id="details-<?= $ann['id'] ?>">
                                <p><strong>Class:</strong> <?= htmlspecialchars($class['info']['name']) ?></p>
                                <p><strong>Sent:</strong> <?= date('d M Y, H:i', strtotime($ann['created_at'])) ?></p>
                                <p><strong>Message:</strong> <?= nl2br(htmlspecialchars($ann['message'])) ?></p>
                            </div>
                        </div>
                    <?php endforeach; ?>
                </div>
            </div>
        <?php endforeach; ?>
    <?php else: ?>
        <p class="empty">No announcements sent yet.</p>
    <?php endif; ?>

    <div id="loaderOverlay">
        <div class="loader-container">
            <div class="loader-book"><i class="fas fa-book-open"></i></div>
            <div class="loader-text">Processing...</div>
        </div>
    </div>

    <script>
        // Toggle class group
        document.querySelectorAll('.toggle-class').forEach(btn => {
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                const header = this.closest('.class-header');
                const content = header.nextElementSibling;
                content.classList.toggle('show');
                this.classList.toggle('active');
            });
        });
        document.querySelectorAll('.class-header').forEach(header => {
            header.addEventListener('click', function(e) {
                if (e.target.closest('.toggle-class')) return;
                this.querySelector('.toggle-class').click();
            });
        });

        // Toggle announcement details
        function toggleDetails(element) {
            const details = element.parentElement.querySelector('.announcement-details');
            const isOpen = details.style.display === 'block';
            details.style.display = isOpen ? 'none' : 'block';
            element.classList.toggle('active', !isOpen);
        }
    </script>
</body>
</html>