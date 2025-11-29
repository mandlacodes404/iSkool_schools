<?php
session_start();
require_once 'config.php';



if (!isset($_SESSION['email']) || $_SESSION['role'] !== 'user') {
    header("Location: index.php");
    exit();
}

$studentEmail = $_SESSION['email'];

// GET CURRENT ACADEMIC YEAR
$schoolId = $_SESSION['school_id'] ?? null;
$currentYearResult = $conn->query("SELECT id FROM academic_years WHERE school_id = $schoolId AND is_current = 1 LIMIT 1");
if ($currentYearResult->num_rows === 0) {
    die("No active academic year set. Contact your admin.");
}
$currentYear = $currentYearResult->fetch_assoc();
$current_academic_year_id = $currentYear['id'];

// Step 1: Get classes the student has joined
$stmt = $conn->prepare("
    SELECT DISTINCT class_id 
    FROM class_students 
    WHERE student_email = ? 
      AND academic_year_id = ?
");
$stmt->bind_param("si", $studentEmail, $current_academic_year_id);
$stmt->execute();
$result = $stmt->get_result();

$joinedClassIds = [];
while ($row = $result->fetch_assoc()) {
    $joinedClassIds[] = $row['class_id'];
}
$stmt->close();

if (empty($joinedClassIds)) {
    $assignments = false;
} else {
    // Step 2: Fetch assignments – preserve original title
    $placeholders = implode(',', array_fill(0, count($joinedClassIds), '?'));
    $types = str_repeat('i', count($joinedClassIds));

    $sql = "SELECT 
            a.id,
            a.title AS assignment_title,
            a.description,
            a.due_date,
            a.file_url,
            c.name AS class_name,
            u.title,
            u.surname,
            CONCAT(COALESCE(u.title,''), ' ', COALESCE(u.surname,'Unknown')) AS teacher_display
        FROM assignments a
        JOIN classes c ON a.class_id = c.id
        LEFT JOIN users u ON a.created_by = u.email AND u.role = 'teacher'
        WHERE a.class_id IN ($placeholders)
          AND a.academic_year_id = ?
        ORDER BY u.surname, u.title, a.due_date ASC";

$stmt = $conn->prepare($sql);

// First: bind all the class IDs
$bind_names[] = $types;
foreach ($joinedClassIds as $key => $id) {
    $bind_name = 'bind' . $key;
    $$bind_name = $id;
    $bind_names[] = &$$bind_name;
}

// Now add the academic year ID at the end
$bind_names[0] .= 'i';                    // add one more 'i' to the types string
$bind_names[] = &$current_academic_year_id;  // add the actual value

call_user_func_array([$stmt, 'bind_param'], $bind_names);

    $stmt->execute();
    $assignments = $stmt->get_result();
    $stmt->close();

    // Group by teacher, preserve original assignment title
    $groupedAssignments = [];
    while ($row = $assignments->fetch_assoc()) {
        $teacher = trim($row['teacher_display'] ?? 'Unknown Teacher');
        if ($teacher === ' Unknown' || empty(trim($row['surname']))) {
            $teacher = 'Unknown Teacher';
        }

        $assignment = [
            'id'              => $row['id'],
            'title'           => $row['assignment_title'],   // ORIGINAL TITLE
            'description'     => $row['description'],
            'due_date'        => $row['due_date'],
            'file_url'        => $row['file_url'],
            'class_name'      => $row['class_name']
        ];

        $groupedAssignments[$teacher][] = $assignment;
    }

    $currentDateTime = new DateTime('now', new DateTimeZone('SAST'));
}
?>

<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>My Assignments</title>
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
            --lock-color: #f85149;
            --card-radius: 12px;
            --shadow-glow: rgba(79, 209, 197, 0.3);
            --border-color: rgba(255, 255, 255, 0.1);
            --submission-color: #238636;
            --no-submission-color: #f85149;
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

        /* === TEACHER SECTION === */
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

        .teacher-assignments {
            padding: 0 15px 15px;
            display: block;
        }

        .teacher-assignments.collapsed {
            display: none;
        }

        /* === ASSIGNMENT CARD === */
        .assignment {
            background: rgba(0, 0, 0, 0.15);
            padding: 12px;
            border-radius: var(--card-radius);
            margin: 10px 0;
            box-shadow: 0 1px 6px rgba(0, 0, 0, 0.2);
            transition: transform 0.3s ease, box-shadow 0.3s ease;
        }

        .assignment:hover:not(.past-due) {
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        }

        .assignment.past-due {
            opacity: 0.6;
            filter: grayscale(50%);
        }

        .assignment-header {
            display: flex;
            align-items: center;
            gap: 10px;
        }

        .assignment-header h3 {
            margin: 0;
            flex: 1;
            font-size: 15px;
            color: var(--accent-color);
        }

        .assignment-details {
            display: none;
            padding: 8px 12px;
            background: rgba(0, 0, 0, 0.2);
            border-radius: 0 0 var(--card-radius) var(--card-radius);
            margin-top: 5px;
            font-size: 13px;
        }

        .assignment-details p {
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

        .assignment-icon {
            font-size: 18px;
            color: var(--accent-color);
        }

        .lock-icon {
            font-size: 18px;
            color: var(--lock-color);
        }

        a.submit-link {
            background-color: var(--button-bg);
            color: var(--text-color);
            padding: 8px 16px;
            border-radius: var(--card-radius);
            font-weight: 600;
            text-decoration: none;
            transition: background-color 0.3s ease;
            display: inline-block;
            margin-top: 5px;
        }

        a.submit-link:hover:not(.disabled) {
            background-color: var(--accent-color);
            color: var(--bg-color);
        }

        a.submit-link.disabled {
            opacity: 0.4;
            pointer-events: none;
            background-color: var(--button-bg);
            color: var(--text-color);
        }

        .error {
            color: var(--no-submission-color);
            font-weight: 600;
            font-size: 0.9rem;
            margin-top: 5px;
            display: block;
        }

        .no-submission {
            color: var(--no-submission-color);
            font-weight: 600;
            font-size: 0.9rem;
        }

        .attachment-link,
        .submission-link {
            color: var(--accent-color);
            text-decoration: none;
            transition: color 0.3s ease;
        }

        .attachment-link:hover,
        .submission-link:hover {
            color: #1ed760;
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

            .assignment {
                padding: 10px;
            }

            .assignment-header h3 {
                font-size: 14px;
            }

            .assignment-details p {
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
            <h2>My Assignments</h2>
            <?php if (!empty($groupedAssignments)): ?>
                <div class="search-sort">
                    <input type="text" id="searchInput" placeholder="Search by title or class..." aria-label="Search assignments">
                    <select id="sortSelect" aria-label="Sort assignments">
                        <option value="due-date-asc">Due Date (Earliest)</option>
                        <option value="due-date-desc">Due Date (Latest)</option>
                        <option value="title-asc">Title A-Z</option>
                        <option value="title-desc">Title Z-A</option>
                        <option value="class-asc">Class A-Z</option>
                        <option value="class-desc">Class Z-A</option>
                    </select>
                </div>
            <?php endif; ?>
        </div>

        <?php if (!empty($groupedAssignments)): ?>
            <?php foreach ($groupedAssignments as $teacher => $assignments): ?>
                <div class="teacher-section">
                    <div class="teacher-header" onclick="toggleTeacher(this)">
                        <h3>
                            <?= htmlspecialchars($teacher) ?>   <!-- Mr Nkosi -->
                            <span class="file-count">(<?= count($assignments) ?> assignment<?= count($assignments) > 1 ? 's' : '' ?>)</span>
                        </h3>
                        <button class="toggle-teacher" type="button">
                            <i class="fas fa-chevron-down"></i>
                        </button>
                    </div>

                    <div class="teacher-assignments">
                        <?php foreach ($assignments as $assignment): ?>
                            <?php
                            // Fetch submission
                            $subStmt = $conn->prepare("SELECT file_url FROM submissions WHERE assignment_id = ? AND student_email = ?");
                            $subStmt->bind_param("is", $assignment['id'], $studentEmail);
                            $subStmt->execute();
                            $submissionResult = $subStmt->get_result();
                            $submission = $submissionResult->fetch_assoc();
                            $subStmt->close();

                            // Check due date
                            $dueDate = null;
                            $isPastDue = false;
                            if (!empty($assignment['due_date'])) {
                                try {
                                    $dueDate = new DateTime($assignment['due_date'], new DateTimeZone('SAST'));
                                    $isPastDue = $dueDate < $currentDateTime;
                                } catch (Exception $e) {}
                            }
                            $assignmentClass = $isPastDue ? 'assignment past-due' : 'assignment';

                            // File icon
                            $fileExt = !empty($assignment['file_url']) ? strtolower(pathinfo($assignment['file_url'], PATHINFO_EXTENSION)) : '';
                            $iconClass = $isPastDue ? 'fas fa-lock lock-icon' : 'fas fa-file';
                            if (!$isPastDue) {
                                if ($fileExt === 'pdf') $iconClass = 'fas fa-file-pdf';
                                elseif (in_array($fileExt, ['doc', 'docx'])) $iconClass = 'fas fa-file-word';
                                elseif (in_array($fileExt, ['ppt', 'pptx'])) $iconClass = 'fas fa-file-powerpoint';
                                elseif (in_array($fileExt, ['jpg', 'jpeg', 'png'])) $iconClass = 'fas fa-file-image';
                                elseif ($fileExt === 'zip') $iconClass = 'fas fa-file-archive';
                            }

                            $submissionFileExt = !empty($submission['file_url']) ? strtolower(pathinfo($submission['file_url'], PATHINFO_EXTENSION)) : '';
                            ?>
                            <div class="<?= $assignmentClass ?>" data-title="<?= htmlspecialchars($assignment['title']) ?>" data-class="<?= htmlspecialchars($assignment['class_name']) ?>">
                                <div class="assignment-header">
                                    <i class="<?= $iconClass ?>"></i>
                                    <h3><?= htmlspecialchars($assignment['title']) ?></h3>   <!-- ORIGINAL TITLE ONLY -->
                                    <button class="toggle-details" onclick="event.stopPropagation(); toggleDetails(this)">
                                        <i class="fas fa-chevron-down"></i>
                                    </button>
                                </div>
                                <div class="assignment-details">
                                    <p><strong>Class:</strong> <?= htmlspecialchars($assignment['class_name']) ?></p>
                                    <p><strong>Due Date:</strong> <span><?= $assignment['due_date'] ? date('F j, Y, g:i A', strtotime($assignment['due_date'])) : 'Not set' ?></span></p>
                                    <p><strong>Description:</strong> <?= nl2br(htmlspecialchars($assignment['description'] ?? 'No description')) ?></p>
                                    <p><strong>Teacher Attachment:</strong> 
                                        <?php if (!empty($assignment['file_url'])): ?>
                                            <a href="<?= htmlspecialchars($assignment['file_url']) ?>" target="_blank" rel="noopener" class="attachment-link" data-preview="<?= in_array($fileExt, ['jpg','jpeg','png','pdf']) ? htmlspecialchars($assignment['file_url']) : '' ?>" data-full="<?= htmlentities($assignment['file_url']) ?>">Download</a>
                                        <?php else: ?>
                                            No attachment
                                        <?php endif; ?>
                                    </p>
                                    <p><strong>Your Submission:</strong> 
                                        <?php if (!empty($submission['file_url'])): ?>
                                            <a class="submission-link" href="<?= htmlspecialchars($submission['file_url']) ?>" target="_blank" rel="noopener" data-preview="<?= in_array($submissionFileExt, ['jpg','jpeg','png','pdf']) ? htmlspecialchars($submission['file_url']) : '' ?>" data-full="<?= htmlentities($submission['file_url']) ?>">View Submitted File</a>
                                        <?php else: ?>
                                            <span class="no-submission">No submission</span>
                                        <?php endif; ?>
                                    </p>
                                    <p>
                                        <a class="submit-link <?= $isPastDue ? 'disabled' : '' ?>" href="submit_assignment.php?assignment_id=<?= $assignment['id'] ?>" <?= $isPastDue ? 'tabindex="-1" aria-disabled="true"' : '' ?>>Submit / Update</a>
                                        <?php if ($isPastDue): ?>
                                            <span class="error">Sorry, the due date for this assignment has passed.</span>
                                        <?php endif; ?>
                                    </p>
                                </div>
                            </div>
                        <?php endforeach; ?>
                    </div>
                </div>
            <?php endforeach; ?>
        <?php else: ?>
            <p class="empty">You have no assignments currently available. Please join a class or check back later.</p>
        <?php endif; ?>

        <div id="loaderOverlay">
            <div class="loader-text">Processing...</div>
            <div class="loader"></div>
        </div>

        <div id="previewModal">
            <div class="modal-content">
                <button class="close-modal" aria-label="Close preview">Close</button>
                <img id="previewImage" alt="File Preview">
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
            const assignments = section.querySelector('.teacher-assignments');
            const icon = button.querySelector('.toggle-teacher i');
            assignments.classList.toggle('collapsed');
            icon.style.transform = assignments.classList.contains('collapsed') ? 'rotate(0deg)' : 'rotate(180deg)';
        }

        // Toggle assignment details
        function toggleDetails(button) {
            event.stopPropagation();
            const details = button.parentElement.nextElementSibling;
            const isExpanded = details.style.display === 'block';
            details.style.display = isExpanded ? 'none' : 'block';
            button.classList.toggle('active', !isExpanded);
            button.querySelector('i').classList.toggle('fa-chevron-down', isExpanded);
            button.querySelector('i').classList.toggle('fa-chevron-up', !isExpanded);
        }

        // Search & sort
        const searchInput = document.getElementById('searchInput');
        const sortSelect = document.getElementById('sortSelect');
        let searchTimeout;

        function filterAndSortAssignments() {
            const searchTerm = searchInput.value.toLowerCase();

            document.querySelectorAll('.teacher-section').forEach(section => {
                const teacherName = section.querySelector('.teacher-header h3').textContent.toLowerCase().replace(/\s*\(\d+ assignment.*\)/, '');
                const assignments = section.querySelectorAll('.assignment');
                let visibleCount = 0;

                assignments.forEach(assignment => {
                    const title = assignment.dataset.title.toLowerCase();
                    const className = assignment.dataset.class.toLowerCase();
                    const matches = title.includes(searchTerm) || className.includes(searchTerm) || teacherName.includes(searchTerm);
                    assignment.style.display = matches ? 'block' : 'none';
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
                searchTimeout = setTimeout(filterAndSortAssignments, 300);
            });
            sortSelect.addEventListener('change', filterAndSortAssignments);
        }

        // Preview modal
        const previewModal = document.getElementById('previewModal');
        const previewImage = document.getElementById('previewImage');
        const previewIframe = document.getElementById('previewIframe');
        const closeModal = document.querySelector('.close-modal');
        const fullDocumentLink = document.getElementById('fullDocumentLink');

        function showPreview(link) {
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
        }

        document.querySelectorAll('.attachment-link, .submission-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                showPreview(link);
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