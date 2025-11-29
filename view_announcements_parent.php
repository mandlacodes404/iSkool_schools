<?php
session_start();
require_once 'config.php';

if (!isset($_SESSION['email']) || $_SESSION['role'] !== 'parent') {
    header("Location: index.php");
    exit();
}

$parentEmail = $_SESSION['email'];
$schoolId = $_SESSION['school_id'] ?? 0;

// Get class IDs the parent has joined
$joined = $conn->prepare("SELECT class_id FROM parent_classes WHERE parent_email = ?");
$joined->bind_param("s", $parentEmail);
$joined->execute();
$joinedResult = $joined->get_result();

$classIds = [];
while ($row = $joinedResult->fetch_assoc()) {
    $classIds[] = $row['class_id'];
}

$announcements = [];
$groupedAnnouncements = [];

if (!empty($classIds)) {
    $inClause = implode(',', array_map('intval', $classIds));
    $sql = "
        SELECT 
            a.title AS announcement_title,
            a.message, 
            a.created_at, 
            a.created_by,
            c.name AS class_name,
            u.title AS teacher_title,
            u.surname AS teacher_surname,
            CONCAT(COALESCE(u.title,''), ' ', COALESCE(u.surname,'Unknown')) AS teacher_display
        FROM announcements a
        JOIN classes c ON a.class_id = c.id
        LEFT JOIN users u ON a.created_by = u.email AND u.role = 'teacher'
        WHERE a.class_id IN ($inClause) 
          AND c.school_id = $schoolId 
          AND a.send_to = 'parents'
        ORDER BY u.surname, u.title, a.created_at DESC
    ";
    $result = $conn->query($sql);

    while ($row = $result->fetch_assoc()) {
        $teacher = trim($row['teacher_display'] ?? 'Unknown Teacher');
        if ($teacher === ' Unknown' || empty(trim($row['teacher_surname']))) {
            $teacher = 'Unknown Teacher';
        }
        $groupedAnnouncements[$teacher][] = $row;
    }
}

$currentDateTime = new DateTime('now', new DateTimeZone('SAST'));
$sevenDaysAgo = (new DateTime('now', new DateTimeZone('SAST')))->modify('-7 days');
?>

<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Parent Announcements</title>
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
            --card-radius: 12px;
            --shadow-glow: rgba(79, 209, 197, 0.3);
            --border-color: rgba(255, 255, 255, 0.1);
            --new-badge-color: #f28c38;
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
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
        }

        h2 {
            font-size: 28px;
            color: var(--text-color);
            text-align: center;
            margin: 0;
            display: flex;
            align-items: center;
            gap: 10px;
        }

        .search-sort {
            display: flex;
            gap: 10px;
            flex-wrap: wrap;
        }

        .search-sort input,
        .search-sort select {
            padding: 10px;
            border-radius: var(--card-radius);
            background-color: var(--card-bg);
            border: 1px solid var(--border-color);
            color: var(--text-color);
            font-size: 14px;
            width: 200px;
        }

        .search-sort input:focus,
        .search-sort select:focus {
            border-color: var(--accent-color);
            box-shadow: 0 0 8px var(--shadow-glow);
            outline: none;
        }

        /* TEACHER SECTION */
        .teacher-section {
            background: var(--card-bg);
            border-radius: var(--card-radius);
            margin-bottom: 20px;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
            overflow: hidden;
        }

        .teacher-header {
            padding: 15px;
            background: rgba(79, 209, 197, 0.15);
            display: flex;
            align-items: center;
            gap: 12px;
            cursor: pointer;
            transition: background 0.3s ease;
        }

        .teacher-header:hover {
            background: rgba(79, 209, 197, 0.25);
        }

        .teacher-header h3 {
            margin: 0;
            flex: 1;
            font-size: 18px;
            color: var(--accent-color);
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .file-count {
            font-size: 14px;
            opacity: 0.8;
            font-weight: normal;
        }

        .toggle-teacher {
            background: none;
            border: none;
            color: var(--text-color);
            font-size: 18px;
            cursor: pointer;
        }

        .toggle-teacher i {
            transition: transform 0.3s ease;
        }

        .teacher-announcements {
            padding: 0 15px 15px;
            display: block;
        }

        .teacher-announcements.collapsed {
            display: none;
        }

        /* ANNOUNCEMENT CARD */
        .announcement {
            background: rgba(0, 0, 0, 0.15);
            padding: 12px;
            border-radius: var(--card-radius);
            margin: 10px 0;
            box-shadow: 0 1px 6px rgba(0, 0, 0, 0.2);
            transition: transform 0.3s ease, box-shadow 0.3s ease;
        }

        .announcement:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        }

        .announcement-header {
            display: flex;
            align-items: center;
            gap: 10px;
        }

        .announcement-header h3 {
            margin: 0;
            flex: 1;
            font-size: 15px;
            color: var(--accent-color);
        }

        .announcement-header .new-badge {
            background: var(--new-badge-color);
            color: var(--bg-color);
            padding: 4px 8px;
            border-radius: 10px;
            font-size: 12px;
            font-weight: 600;
        }

        .announcement-details {
            display: none;
            padding: 8px 12px;
            background: rgba(0, 0, 0, 0.2);
            border-radius: 0 0 var(--card-radius) var(--card-radius);
            margin-top: 5px;
            font-size: 13px;
        }

        .announcement-details p {
            margin: 4px 0;
            opacity: 0.8;
            line-height: 1.5;
        }

        .toggle-details {
            background: none;
            border: none;
            color: var(--text-color);
            font-size: 16px;
            cursor: pointer;
            transition: color 0.3s ease;
        }

        .toggle-details:hover,
        .toggle-details.active {
            color: var(--accent-color);
        }

        .announcement-icon {
            font-size: 18px;
            color: var(--accent-color);
        }

        p.empty {
            text-align: center;
            opacity: 0.8;
            font-size: 16px;
            padding: 20px;
            background: var(--card-bg);
            border-radius: var(--card-radius);
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
        }

        #loaderOverlay {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.7);
            display: none;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            z-index: 1000;
        }

        .loader {
            border: 6px solid #f3f3f3;
            border-top: 6px solid var(--accent-color);
            border-radius: 50%;
            width: 60px;
            height: 60px;
            animation: spin 1s linear infinite;
            margin-top: 12px;
        }

        .loader-text {
            color: var(--text-color);
            font-size: 18px;
            font-weight: 600;
            text-align: center;
        }

        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }

        @media (max-width: 768px) {
            .container {
                padding: 0 10px;
                margin-bottom: 80px;
            }

            h2 {
                font-size: 24px;
            }

            .search-sort {
                display: none;
            }

            .teacher-header h3 {
                font-size: 16px;
            }

            .announcement {
                padding: 10px;
            }

            .announcement-header h3 {
                font-size: 14px;
            }

            .announcement-details p {
                font-size: 12px;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h2>Parent Announcements</h2>
            <?php if (!empty($groupedAnnouncements)): ?>
                <div class="search-sort">
                    <input type="text" id="searchInput" placeholder="Search by title or message..." aria-label="Search announcements">
                    <select id="sortSelect" aria-label="Sort announcements">
                        <option value="date-desc">Newest First</option>
                        <option value="date-asc">Oldest First</option>
                        <option value="title-asc">Title A-Z</option>
                        <option value="title-desc">Title Z-A</option>
                    </select>
                </div>
            <?php endif; ?>
        </div>

        <?php if (empty($groupedAnnouncements)): ?>
            <p class="empty">No announcements have been posted for your joined classes yet.</p>
        <?php else: ?>
            <?php foreach ($groupedAnnouncements as $teacher => $announcements): ?>
                <div class="teacher-section">
                    <div class="teacher-header" onclick="toggleTeacher(this)">
                        <h3>
                            <?= htmlspecialchars($teacher) ?>
                            <span class="file-count">(<?= count($announcements) ?> announcement<?= count($announcements) > 1 ? 's' : '' ?>)</span>
                        </h3>
                        <button class="toggle-teacher" type="button">
                            <i class="fas fa-chevron-down"></i>
                        </button>
                    </div>

                    <div class="teacher-announcements">
                        <?php foreach ($announcements as $row): ?>
                            <?php
                            $createdAt = new DateTime($row['created_at'], new DateTimeZone('SAST'));
                            $isNew = $createdAt > $sevenDaysAgo;
                            $title = $row['announcement_title'] ?? 'Untitled Announcement';
                            ?>
                            <div class="announcement" 
                                 data-title="<?= htmlspecialchars($title) ?>" 
                                 data-message="<?= htmlspecialchars($row['message']) ?>">
                                <div class="announcement-header">
                                    <i class="fas fa-bullhorn announcement-icon"></i>
                                    <h3><?= htmlspecialchars($title) ?></h3>
                                    <small style="opacity:0.7; font-size:12px;"><?= htmlspecialchars($row['class_name']) ?></small>
                                    <?php if ($isNew): ?>
                                        <span class="new-badge">New</span>
                                    <?php endif; ?>
                                    <button class="toggle-details" onclick="event.stopPropagation(); toggleDetails(this)">
                                        <i class="fas fa-chevron-down"></i>
                                    </button>
                                </div>
                                <div class="announcement-details">
                                    <p><strong>Message:</strong> <?= nl2br(htmlspecialchars($row['message'])) ?></p>
                                    <p><strong>Class:</strong> <?= htmlspecialchars($row['class_name']) ?></p>
                                    <p><strong>Date:</strong> <?= date('F j, Y, g:i a', strtotime($row['created_at'])) ?></p>
                                </div>
                            </div>
                        <?php endforeach; ?>
                    </div>
                </div>
            <?php endforeach; ?>
        <?php endif; ?>

        <div id="loaderOverlay">
            <div class="loader-text">Processing...</div>
            <div class="loader"></div>
        </div>
    </div>

    <script>
        function toggleTeacher(button) {
            const section = button.closest('.teacher-section');
            const announcements = section.querySelector('.teacher-announcements');
            const icon = button.querySelector('.toggle-teacher i');
            announcements.classList.toggle('collapsed');
            icon.style.transform = announcements.classList.contains('collapsed') ? 'rotate(0deg)' : 'rotate(180deg)';
        }

        function toggleDetails(button) {
            event.stopPropagation();
            const details = button.parentElement.nextElementSibling;
            const isExpanded = details.style.display === 'block';
            details.style.display = isExpanded ? 'none' : 'block';
            button.classList.toggle('active', !isExpanded);
            button.querySelector('i').classList.toggle('fa-chevron-down', isExpanded);
            button.querySelector('i').classList.toggle('fa-chevron-up', !isExpanded);
        }

        const searchInput = document.getElementById('searchInput');
        const sortSelect = document.getElementById('sortSelect');
        let searchTimeout;

        function filterAndSortAnnouncements() {
            const searchTerm = searchInput.value.toLowerCase();

            document.querySelectorAll('.teacher-section').forEach(section => {
                const teacherName = section.querySelector('.teacher-header h3').textContent.toLowerCase().replace(/\s*\(\d+ announcement.*\)/, '');
                const announcements = section.querySelectorAll('.announcement');
                let visibleCount = 0;

                announcements.forEach(ann => {
                    const title = ann.dataset.title.toLowerCase();
                    const message = ann.dataset.message.toLowerCase();
                    const matches = title.includes(searchTerm) || message.includes(searchTerm) || teacherName.includes(searchTerm);
                    ann.style.display = matches ? 'block' : 'none';
                    if (matches) visibleCount++;
                });

                const header = section.querySelector('.teacher-header');
                if (visibleCount === 0) {
                    section.style.display = 'none';
                } else {
                    section.style.display = 'block';
                    header.style.display = 'flex';
                }
            });
        }

        if (searchInput && sortSelect) {
            searchInput.addEventListener('input', () => {
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(filterAndSortAnnouncements, 300);
            });
            sortSelect.addEventListener('change', filterAndSortAnnouncements);
        }
    </script>
</body>
</html>