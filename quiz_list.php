<?php
/**
 * iSkool - Available Quizzes List
 *
 * Displays all available quizzes for the logged-in learner, grouped by subject
 * (from teacher_subjects table) with fallback to teacher name (e.g., "Ms Ntuli").
 * Features:
 * - Dynamic grouping using COALESCE for subject or teacher name
 * - Collapsible sections per subject/teacher
 * - Quiz status handling (Open, Scheduled, Closed) with countdown timers
 * - Responsive design with search functionality
 * - Start quiz button with proper availability logic
 * - Full-screen processing loader
 *
 * @package     iSkool
 * @subpackage  Learner
 * @author      mandlasimphiwe99@gmail.com
 * @copyright   2025 iSkool EdTech. All rights reserved.
 * @license     Proprietary - Unauthorized use prohibited
 * @version     1.0.0
 * @since       2025-12-14
 * @link        https://iskool.online
 */
ob_start();
error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);
ini_set('error_log', 'php_errors.log');

session_start();
require_once 'config.php';

// ────────────────────────────────────────────────────────────────────────
//           Security: Must be logged in as learner 
// ────────────────────────────────────────────────────────────────────────
if (!isset($_SESSION['email']) || $_SESSION['role'] !== 'learner') {
    header("Location: index.php");
    exit();
}

$studentEmail = $_SESSION['email'];

// ────────────────────────────────────────────────────────────────────────
//    Get current active academic year (no school_id needed) 
// ────────────────────────────────────────────────────────────────────────

$currentYearResult = $conn->query("SELECT id FROM academic_years WHERE is_current = 1 LIMIT 1");
if ($currentYearResult->num_rows === 0) {
    die("No active academic year set. Contact your admin.");
}
$currentYear = $currentYearResult->fetch_assoc();
$current_academic_year_id = (int)$currentYear['id'];

// ────────────────────────────────────────────────────────────────────────
//     Step 1: Get all classes this learner has joined this year 
// ────────────────────────────────────────────────────────────────────────

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
    $joinedClassIds[] = (int)$row['class_id'];
}
$stmt->close();

// ... (Your Step 1 code is fine) ...

if (empty($joinedClassIds)) {
    $quizzes = false;
} else {
    // ── Step 2: Fetch all quizzes AND the learner's attempt status ──
    $placeholders = implode(',', array_fill(0, count($joinedClassIds), '?'));
   $types = 's' . str_repeat('i', count($joinedClassIds)) . 'i';

    $stmt = $conn->prepare("
        SELECT 
            q.id,
            q.title AS quiz_title,
            q.duration,
            q.start_time,
            q.status AS quiz_db_status,
            q.is_summative,
            q.class_id,
            COALESCE(ts.subject_name, CONCAT(COALESCE(u.title,''), ' ', COALESCE(u.surname,'Teacher'))) AS display_group,
            qa.status AS attempt_status
        FROM quizzes q
        LEFT JOIN users u ON q.created_by = u.email AND u.role = 'teacher'
        LEFT JOIN teacher_subjects ts ON ts.teacher_email = q.created_by AND ts.class_id = q.class_id
        LEFT JOIN quiz_attempts qa ON qa.quiz_id = q.id AND qa.user_email = ?
        WHERE q.class_id IN ($placeholders)
          AND q.academic_year_id = ?
        ORDER BY display_group ASC, q.start_time DESC
    ");

    $bind_params = array_merge([$studentEmail], $joinedClassIds, [$current_academic_year_id]);
    $stmt->bind_param($types, ...$bind_params);
    $stmt->execute();
    $quizzesResult = $stmt->get_result(); // Named this to avoid confusion
    $stmt->close();

    $groupedQuizzes = [];
    $currentTime = date('Y-m-d H:i:s');

    // ONLY ONE LOOP NEEDED HERE
    while ($row = $quizzesResult->fetch_assoc()) {
        $group = trim($row['display_group'] ?? 'Unknown Teacher');
        $group = $group === '' ? 'Unknown Teacher' : $group;

        $groupedQuizzes[$group][] = [
            'id'             => $row['id'],
            'title'          => $row['quiz_title'],
            'duration'       => $row['duration'],
            'start_time'     => $row['start_time'],
            'status'         => $row['quiz_db_status'], // Use the aliased name from SQL
            'is_summative'   => !empty($row['is_summative']),
            'attempt_status' => $row['attempt_status'],
            'current_time'   => $currentTime
        ];
    }
}
?>

<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Available Quizzes</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.2/css/all.min.css" integrity="sha512-z3gLpd7yknf1YoNbCzqRKc4qyor8gaKU1qmn+CShxbuBusANI9QpRohGBreCFkKxLhei6S9CQXFEbbKuqLg0DA==" crossorigin="anonymous" referrerpolicy="no-referrer" />
    <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@600&display=swap" rel="stylesheet">
    <style>
        :root {
            --bg-color: #0f1113;           /* Darkest Charcoal */
            --card-bg: #1a1c1e;            /* Slate Surface */
            --text-color: #e3e3e3;         /* Off-white text */
           --accent-color: #4fd1c5;       /* YOUR TEAL ACCENT */
            --button-bg: #2c3e50;          /* Deep Slate Button */
            --button-hover-bg: #3c4043;    /* Hover State */
            --disabled-bg: #3c4043;
            --disabled-text: #80868b;
            --card-radius: 12px;
            --shadow-glow: rgba(138, 180, 248, 0.1);
            --border-color: rgba(255, 255, 255, 0.08);
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
            background: rgba(138, 180, 248, 0.05); /* Subtle Blue hint */
            display: flex;
            align-items: center;
            gap: 12px;
            cursor: pointer;
            transition: background 0.3s ease;
            border-bottom: 1px solid var(--border-color);
        }

        .teacher-header:hover {
            background: rgba(138, 180, 248, 0.1);
        }

        .teacher-header h3 {
            margin: 0;
            flex: 1;
            font-size: 18px;
            color:var(--accent-color); /* Crisp white for the category */
            display: flex;
            align-items: center;
            gap: 8px;
        }
        /* This keeps the icon teal while the text is white */
        .teacher-header h3 i {
            color: var(--accent-color);
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

        .teacher-quizzes {
            padding: 0 15px 15px;
            display: block;
        }

        .teacher-quizzes.collapsed {
            display: none;
        }

        /* === QUIZ CARD === */
        .quiz {
            background: rgba(0, 0, 0, 0.15);
            padding: 12px;
            border-radius: var(--card-radius);
            margin: 10px 0;
            box-shadow: 0 1px 6px rgba(0, 0, 0, 0.2);
            transition: transform 0.3s ease, box-shadow 0.3s ease;
        }

        .quiz:hover:not(.closed) {
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        }

        .quiz.closed {
            opacity: 0.6;
            filter: grayscale(50%);
        }

        .quiz-header {
            display: flex;
            align-items: center;
            gap: 10px;
        }

        .quiz-header h3 {
            margin: 0;
            flex: 1;
            font-size: 15px;
            color: #9aa0a6;
        }

        .quiz-details {
            display: none;
            padding: 8px 12px;
            background: rgba(0, 0, 0, 0.2);
            border-radius: 0 0 var(--card-radius) var(--card-radius);
            margin-top: 5px;
            font-size: 13px;
        }

        .quiz-details p {
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

        .quiz-icon {
            font-size: 18px;
            color: var(--accent-color);
        }

        .lock-icon {
            font-size: 18px;
            color: #f85149;
        }

        a.btn {
            background-color: var(--button-bg);
            color: var(--text-color);
            padding: 8px 16px;
            text-decoration: none;
            border-radius: var(--card-radius);
            font-weight: 600;
            font-size: 14px;
            transition: all 0.3s ease;
            display: inline-block;
            border: 1px solid var(--border-color);
        }

        a.btn:hover:not(.disabled) {
            background-color: var(--accent-color);
            color: #0d1117; /* High contrast dark text on blue hover */
            border-color: var(--accent-color);
        }

        a.btn.disabled {
            pointer-events: none;
            opacity: 0.4;
            background-color: var(--disabled-bg);
            color: var(--disabled-text);
        }

        .countdown {
            color: #fdd663; /* Gemini Gold for urgency/scheduled status */
            font-size: 14px;
            font-weight: 700;
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

            .quiz {
                padding: 10px;
            }

            .quiz-header h3 {
                font-size: 14px;
            }

            .quiz-details p {
                font-size: 12px;
            }
        }

        .quiz-header h3 i[title] {
    cursor: help;
}
/* Styling for the new quiz icon */
.quiz-main-icon {
    color: var(--accent-color);
    font-size: 1.2rem;
    background: rgba(79, 209, 197, 0.1);
    padding: 8px;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
}


    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h2>Quizzes</h2>
            <?php if (!empty($groupedQuizzes)): ?>
                <div class="search-sort">
                    <input type="text" id="searchInput" placeholder="Search by quiz title..." aria-label="Search quizzes">
                    <select id="sortSelect" aria-label="Sort quizzes">
                        <option value="date-desc">Newest First</option>
                        <option value="date-asc">Oldest First</option>
                        <option value="title-asc">Title A-Z</option>
                        <option value="title-desc">Title Z-A</option>
                    </select>
                </div>
            <?php endif; ?>
        </div>

        <?php if (!empty($groupedQuizzes)): ?>
            <?php foreach ($groupedQuizzes as $group => $quizzes): ?>
                <div class="teacher-section">
                    <div class="teacher-header" onclick="toggleTeacher(this)">
                          <h3>
                           
    <?= htmlspecialchars($group) ?>
                              <span class="file-count">(<?= count($quizzes) ?> quiz<?= count($quizzes) > 1 ? 'zes' : '' ?>)</span>
                         </h3>
                        <button class="toggle-teacher" type="button">
                            <i class="fas fa-chevron-down"></i>
                        </button>
                    </div>

                    <div class="teacher-quizzes">
                        <?php foreach ($quizzes as $quiz): ?>
                            <?php
                            $status = $quiz['status'] ?? 'Open';
                            $isScheduled = $status === 'Scheduled';
                            $isClosed = $status === 'Closed';
                            $isDisabled = $isScheduled && strtotime($quiz['start_time']) > time() || $isClosed;
                            $btnText = $isClosed ? 'Quiz Closed' : ($isScheduled && $isDisabled ? 'Not Yet Available' : 'Start Quiz');
                            ?>
                            <div class="quiz <?= $isClosed ? 'closed' : '' ?>" data-title="<?= htmlspecialchars($quiz['title']) ?>">
                                <div class="quiz-header">
                                    <i class="fas fa-stopwatch quiz-main-icon"></i>
                                    <h3>
    <?= htmlspecialchars($quiz['title']) ?>
    <?php if (!empty($quiz['is_summative'])): ?>
        <i class="fas fa-check-circle" style="color:#4fd1c5; margin-left:6px; font-size:0.9em;" title="Counts toward term mark"></i>
    <?php endif; ?>
</h3>

                                <button class="toggle-details" onclick="event.stopPropagation(); toggleDetails(this)">
                                        <i class="fas fa-chevron-down"></i>
                                    </button>
                                </div>
                               <div class="quiz-details">
    <p><strong>Duration:</strong> <?= $quiz['duration'] ?> minutes</p>
    <p>
        <strong>Action:</strong>
        <?php
        $quizId = $quiz['id'];
        $attemptStatus = $quiz['attempt_status']; // From our new JOIN
        $quizStatus = $quiz['status']; // Open, Closed, or Scheduled
        $startTime = strtotime($quiz['start_time']);
        $now = time();

        // 1. If already submitted
        if ($attemptStatus === 'submitted') {
            echo "<a class='btn disabled' style='background: #27ae60; opacity: 1;'><i class='fas fa-check-double'></i> Completed</a>";
        } 
        // 2. If quiz is Closed
        elseif ($quizStatus === 'Closed') {
            echo "<a class='btn disabled'>Quiz Closed</a>";
        }
        // 3. If Scheduled but not yet time
        elseif ($quizStatus === 'Scheduled' && $now < $startTime) {
            $startTimestamp = $startTime * 1000;
            echo "<span class='countdown' data-start='$startTimestamp' id='countdown_$quizId'>Loading...</span>";
        }
        // 4. If In Progress (Needs to continue)
        elseif ($attemptStatus === 'in_progress') {
            echo "<a class='btn' href='quiz_instructions.php?quiz_id=$quizId' style='background: #e67e22;'>Continue Quiz</a>";
        }
        // 5. Default: Start Quiz
        else {
            echo "<a class='btn' href='quiz_instructions.php?quiz_id=$quizId'>Start Quiz</a>";
        }
        ?>
    </p>
</div>
                            </div>
                        <?php endforeach; ?>
                    </div>
                </div>
            <?php endforeach; ?>
        <?php else: ?>
            <p class="empty">No quizzes available for your class.</p>
        <?php endif; ?>

        <div id="loaderOverlay">
            <div class="loader-text">Processing...</div>
            <div class="loader"></div>
        </div>
    </div>

    <script>
        // Toggle teacher section
        function toggleTeacher(button) {
            const section = button.closest('.teacher-section');
            const quizzes = section.querySelector('.teacher-quizzes');
            const icon = button.querySelector('.toggle-teacher i');
            quizzes.classList.toggle('collapsed');
            icon.style.transform = quizzes.classList.contains('collapsed') ? 'rotate(0deg)' : 'rotate(180deg)';
        }

        // Toggle quiz details
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

        function filterAndSortQuizzes() {
            const searchTerm = searchInput.value.toLowerCase();

            document.querySelectorAll('.teacher-section').forEach(section => {
                const teacherName = section.querySelector('.teacher-header h3').textContent.toLowerCase().replace(/\s*\(\d+ quiz.*\)/, '');
                const quizzes = section.querySelectorAll('.quiz');
                let visibleCount = 0;

                quizzes.forEach(quiz => {
                    const title = quiz.dataset.title.toLowerCase();
                    const matches = title.includes(searchTerm) || teacherName.includes(searchTerm);
                    quiz.style.display = matches ? 'block' : 'none';
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
                searchTimeout = setTimeout(filterAndSortQuizzes, 300);
            });
            sortSelect.addEventListener('change', filterAndSortQuizzes);
        }

        // Countdowns
        function updateCountdowns() {
            const countdowns = document.querySelectorAll('.countdown');
            countdowns.forEach(el => {
                const quizId = el.id.replace('countdown_', '');
                const startTime = parseInt(el.getAttribute('data-start'));
                const now = new Date().getTime();
                const distance = startTime - now;
                const quizDetails = el.closest('.quiz-details');
                if (distance <= 0) {
                    el.innerHTML = "Available Now";
                    const p = quizDetails.querySelector('p:last-child');
                    p.innerHTML = `<strong>Action:</strong> <a class='btn' href='quiz_instructions.php?quiz_id=${quizId}'>Start Quiz</a>`;
                } else {
                    const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                    const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
                    const seconds = Math.floor((distance % (1000 * 60)) / 1000);
                    el.innerHTML = `Starts in ${hours}h ${minutes}m ${seconds}s`;
                }
            });
        }

        setInterval(updateCountdowns, 1000);
        updateCountdowns();
    </script>
</body>
</html>