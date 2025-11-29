<?php
session_start();
require_once 'config.php';

$email = $_SESSION['email'];

// GET CURRENT ACADEMIC YEAR ID
$schoolId = $_SESSION['school_id'] ?? null;
$currentYearResult = $conn->query("SELECT id FROM academic_years WHERE school_id = $schoolId AND is_current = 1 LIMIT 1");
if ($currentYearResult->num_rows === 0) {
    die("No active academic year. Contact your admin.");
}
$current_academic_year_id = $currentYearResult->fetch_assoc()['id'];
if (!isset($_SESSION['email']) || $_SESSION['role'] !== 'user') {
    header("Location: index.php");
    exit();
}

$email = $_SESSION['email'];

// Get learner's class ID (assuming one class per learner)
$classQuery = $conn->prepare("SELECT class_id FROM class_students WHERE student_email = ? AND academic_year_id = ? LIMIT 1");
$classQuery->bind_param("si", $email, $current_academic_year_id);
$classQuery->execute();
$classQuery->bind_result($classId);
$classQuery->fetch();
$classQuery->close();

// Get school name
$schoolName = '';
$learnerSchoolId = $_SESSION['school_id'];
if ($learnerSchoolId) {
    $stmtSchool = $conn->prepare("SELECT name FROM schools WHERE id = ?");
    $stmtSchool->bind_param("i", $learnerSchoolId);
    $stmtSchool->execute();
    $resultSchool = $stmtSchool->get_result();
    if ($resultSchool->num_rows > 0) {
        $rowSchool = $resultSchool->fetch_assoc();
        $schoolName = $rowSchool['name'];
    }
    $stmtSchool->close();
}

if (!$classId) {
    $message = "You haven't joined a class yet.";
} else {
    // Step: Fetch resources with ORIGINAL title + teacher display name
    $stmt = $conn->prepare("
        SELECT 
            r.id, 
            r.title AS resource_title,           -- ORIGINAL TITLE
            r.filename, 
            r.uploaded_at,
            u.title,
            u.surname,
            CONCAT(COALESCE(u.title,''), ' ', COALESCE(u.surname,'Unknown')) AS teacher_display
        FROM resources r
        LEFT JOIN users u ON r.uploaded_by = u.email AND u.role = 'teacher'
        WHERE r.class_id = ? AND r.academic_year_id = ?
        ORDER BY u.surname, u.title, r.uploaded_at DESC
    ");
    $stmt->bind_param("ii", $classId, $current_academic_year_id);
    $stmt->execute();
    $resources = $stmt->get_result();

    // Group by teacher using "Mr Nkosi" format
    $groupedResources = [];
    while ($row = $resources->fetch_assoc()) {
        $teacher = trim($row['teacher_display'] ?? 'Unknown Teacher');
        if ($teacher === ' Unknown' || empty(trim($row['surname']))) {
            $teacher = 'Unknown Teacher';
        }

        $resource = [
            'id'           => $row['id'],
            'title'        => $row['resource_title'],   // ORIGINAL TITLE ONLY
            'filename'     => $row['filename'],
            'uploaded_at'  => $row['uploaded_at']
        ];

        $groupedResources[$teacher][] = $resource;
    }
}
?>

<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>My Study Resources</title>
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

        /* === TEACHER SECTION STYLES === */
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

        .teacher-resources {
            padding: 0 15px 15px;
            display: block;
        }

        .teacher-resources.collapsed {
            display: none;
        }

        /* === RESOURCE CARD === */
        .resource {
            background: rgba(0, 0, 0, 0.15);
            padding: 12px;
            border-radius: var(--card-radius);
            margin: 10px 0;
            box-shadow: 0 1px 6px rgba(0, 0, 0, 0.2);
            transition: transform 0.3s ease, box-shadow 0.3s ease;
        }

        .resource:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        }

        .resource-header {
            display: flex;
            align-items: center;
            gap: 10px;
        }

        .resource-header h3 {
            margin: 0;
            flex: 1;
            font-size: 15px;
        }

        .resource-header h3 a {
            color: var(--accent-color);
            text-decoration: none;
            transition: color 0.3s ease;
        }

        .resource-header h3 a:hover {
            color: #1ed760;
        }

        .resource-details {
            display: none;
            padding: 8px 12px;
            background: rgba(0, 0, 0, 0.2);
            border-radius: 0 0 var(--card-radius) var(--card-radius);
            margin-top: 5px;
            font-size: 13px;
        }

        .resource-details p {
            margin: 4px 0;
            opacity: 0.8;
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

        .file-icon {
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

        #previewModal {
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.8);
            justify-content: center;
            align-items: center;
            z-index: 2000;
        }

        .modal-content {
            background: var(--card-bg);
            padding: 20px;
            border-radius: var(--card-radius);
            max-width: 90%;
            max-height: 90%;
            overflow: auto;
            position: relative;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 10px;
        }

        .modal-content img {
            max-width: 100%;
            max-height: 70vh;
            border-radius: var(--card-radius);
        }

        .modal-content iframe {
            width: 100%;
            height: 70vh;
            border: none;
            border-radius: var(--card-radius);
        }

        .modal-actions {
            display: flex;
            gap: 10px;
        }

        .modal-actions a,
        .modal-actions button {
            background: var(--button-bg);
            color: var(--text-color);
            border: none;
            padding: 8px 16px;
            border-radius: var(--card-radius);
            cursor: pointer;
            font-size: 14px;
            text-decoration: none;
            transition: background 0.3s ease;
        }

        .modal-actions a:hover,
        .modal-actions button:hover {
            background: var(--accent-color);
            color: var(--bg-color);
        }

        .close-modal {
            position: absolute;
            top: 10px;
            right: 10px;
            background: var(--button-bg);
            color: var(--text-color);
            border: none;
            padding: 8px;
            border-radius: 50%;
            cursor: pointer;
            font-size: 16px;
            transition: background 0.3s ease;
        }

        .close-modal:hover {
            background: var(--accent-color);
            color: var(--bg-color);
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

            .resource {
                padding: 10px;
            }

            .resource-header h3 {
                font-size: 14px;
            }

            .resource-details p {
                font-size: 12px;
            }

            .modal-content iframe {
                height: 50vh;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h2>Resources</h2>
            <?php if (!isset($message)): ?>
                <div class="search-sort">
                    <input type="text" id="searchInput" placeholder="Search by title or teacher..." aria-label="Search resources">
                    <select id="sortSelect" aria-label="Sort resources">
                        <option value="date-desc">Newest First</option>
                        <option value="date-asc">Oldest First</option>
                        <option value="title-asc">Title A-Z</option>
                        <option value="title-desc">Title Z-A</option>
                    </select>
                </div>
            <?php endif; ?>
        </div>

        <?php if (isset($message)): ?>
            <p class="empty"><?= htmlspecialchars($message) ?></p>
        <?php elseif (!empty($groupedResources)): ?>
            <?php foreach ($groupedResources as $teacher => $files): ?>
                <div class="teacher-section">
                    <div class="teacher-header" onclick="toggleTeacher(this)">
                        <h3>
                            <?= htmlspecialchars($teacher) ?>   <!-- Mr Nkosi -->
                            <span class="file-count">(<?= count($files) ?> file<?= count($files) > 1 ? 's' : '' ?>)</span>
                        </h3>
                        <button class="toggle-teacher" type="button">
                            <i class="fas fa-chevron-down"></i>
                        </button>
                    </div>

                    <div class="teacher-resources">
                        <?php foreach ($files as $res): ?>
                            <?php
                            $fileExt = strtolower(pathinfo($res['filename'], PATHINFO_EXTENSION));
                            $iconClass = 'fas fa-file';
                            if ($fileExt === 'pdf') $iconClass = 'fas fa-file-pdf';
                            elseif (in_array($fileExt, ['doc', 'docx'])) $iconClass = 'fas fa-file-word';
                            elseif (in_array($fileExt, ['ppt', 'pptx'])) $iconClass = 'fas fa-file-powerpoint';
                            elseif (in_array($fileExt, ['jpg', 'jpeg', 'png'])) $iconClass = 'fas fa-file-image';
                            elseif ($fileExt === 'zip') $iconClass = 'fas fa-file-archive';
                            ?>
                            <div class="resource" data-title="<?= htmlspecialchars($res['title']) ?>" data-teacher="<?= htmlspecialchars($teacher) ?>">
                                <div class="resource-header">
                                    <i class="<?= $iconClass ?> file-icon"></i>
                                    <h3>
                                        <a href="resources/<?= rawurlencode($res['filename']) ?>" 
                                           target="_blank" 
                                           class="download-link" 
                                           data-preview="<?= in_array($fileExt, ['jpg','jpeg','png','pdf']) ? 'resources/' . rawurlencode($res['filename']) : '' ?>"
                                           data-full="resources/<?= rawurlencode($res['filename']) ?>">
                                            <?= htmlspecialchars($res['title']) ?>   <!-- ORIGINAL TITLE ONLY -->
                                        </a>
                                    </h3>
                                    <button class="toggle-details" onclick="event.stopPropagation(); toggleDetails(this)" aria-label="Toggle resource details">
                                        <i class="fas fa-chevron-down"></i>
                                    </button>
                                </div>
                                <div class="resource-details">
                                    <p><strong>Date:</strong> <?= date("F j, Y, g:i a", strtotime($res['uploaded_at'])) ?></p>
                                </div>
                            </div>
                        <?php endforeach; ?>
                    </div>
                </div>
            <?php endforeach; ?>
        <?php else: ?>
            <p class="empty">No resources available for your class yet.</p>
        <?php endif; ?>

        <div id="loaderOverlay">
            <div class="loader-text">Processing...</div>
            <div class="loader"></div>
        </div>

        <div id="previewModal">
            <div class="modal-content">
                <button class="close-modal" aria-label="Close preview">Close</button>
                <img id="previewImage" alt="Resource Preview">
                <iframe id="previewIframe"></iframe>
                <div class="modal-actions">
                    <a id="fullDocumentLink" href="#" target="_blank">View Full Document</a>
                </div>
            </div>
        </div>
    </div>

    <script>
        // Toggle teacher section
        function toggleTeacher(button) {
            const section = button.closest('.teacher-section');
            const resources = section.querySelector('.teacher-resources');
            const icon = button.querySelector('.toggle-teacher i');
            
            resources.classList.toggle('collapsed');
            icon.style.transform = resources.classList.contains('collapsed') ? 'rotate(0deg)' : 'rotate(180deg)';
        }

        // Toggle resource details
        function toggleDetails(button) {
            event.stopPropagation();
            const details = button.parentElement.nextElementSibling;
            const isExpanded = details.style.display === 'block';
            details.style.display = isExpanded ? 'none' : 'block';
            button.classList.toggle('active', !isExpanded);
            button.querySelector('i').classList.toggle('fa-chevron-down', isExpanded);
            button.querySelector('i').classList.toggle('fa-chevron-up', !isExpanded);
        }

        // Search and sort with teacher grouping
        const searchInput = document.getElementById('searchInput');
        const sortSelect = document.getElementById('sortSelect');
        let searchTimeout;

        function filterAndSortResources() {
            const searchTerm = searchInput.value.toLowerCase();

            document.querySelectorAll('.teacher-section').forEach(section => {
                const teacherName = section.querySelector('.teacher-header h3').textContent.toLowerCase().replace(/\s*\(\d+ file.*\)/, '');
                const resources = section.querySelectorAll('.resource');
                let visibleCount = 0;

                resources.forEach(resource => {
                    const title = resource.dataset.title.toLowerCase();
                    const matches = title.includes(searchTerm) || teacherName.includes(searchTerm);
                    resource.style.display = matches ? 'block' : 'none';
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
                searchTimeout = setTimeout(filterAndSortResources, 300);
            });
            sortSelect.addEventListener('change', filterAndSortResources);
        }

        // Preview modal
        const previewModal = document.getElementById('previewModal');
        const previewImage = document.getElementById('previewImage');
        const previewIframe = document.getElementById('previewIframe');
        const closeModal = document.querySelector('.close-modal');
        const fullDocumentLink = document.getElementById('fullDocumentLink');

        document.querySelectorAll('.download-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const fileUrl = link.dataset.preview;
                const fullUrl = link.dataset.full;
                const fileExt = fileUrl ? fileUrl.split('.').pop().toLowerCase() : '';

                previewImage.style.display = 'none';
                previewIframe.style.display = 'none';
                fullDocumentLink.href = fullUrl;

                if (fileUrl && ['jpg', 'jpeg', 'png'].includes(fileExt)) {
                    previewImage.src = fileUrl;
                    previewImage.style.display = 'block';
                } else if (fileUrl && fileExt === 'pdf') {
                    previewIframe.src = fileUrl;
                    previewIframe.style.display = 'block';
                } else {
                    window.open(fullUrl, '_blank');
                    return;
                }

                previewModal.style.display = 'flex';
            });
        });

        closeModal.addEventListener('click', () => {
            previewModal.style.display = 'none';
            previewImage.src = '';
            previewIframe.src = '';
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && previewModal.style.display === 'flex') {
                closeModal.click();
            }
        });
    </script>
</body>
</html>