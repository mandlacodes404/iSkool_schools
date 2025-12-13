<?php
session_start();
require_once 'config.php';

// Security: Must be logged in as learner OR parent
if (!isset($_SESSION['email'])) {
    header("Location: index.php"); exit();
}

$viewerEmail = $_SESSION['email'];
$viewerRole  = $_SESSION['role'] ?? '';
$targetEmail = $viewerEmail;

// Parent viewing their linked learner
if ($viewerRole === 'parent' && isset($_GET['learner'])) {
    $requestedEmail = filter_var($_GET['learner'], FILTER_VALIDATE_EMAIL);
    if ($requestedEmail) {
        $stmtCheck = $conn->prepare("SELECT 1 FROM parent_links WHERE parent_email = ? AND learner_email = ?");
        $stmtCheck->bind_param("ss", $viewerEmail, $requestedEmail);
        $stmtCheck->execute();
        if ($stmtCheck->get_result()->num_rows === 1) {
            $targetEmail = $requestedEmail;
        }
        $stmtCheck->close();
    }
}

// Block invalid access
if ($viewerRole === 'learner' && $targetEmail !== $viewerEmail) {
    header("Location: index.php"); exit();
}
if ($viewerRole === 'parent' && $targetEmail === $viewerEmail) {
    header("Location: parent_dashboard.php"); exit();
}
if (!in_array($viewerRole, ['learner', 'parent'])) {
    header("Location: index.php"); exit();
}

// Get current academic year (no school_id needed)
$currentYearResult = $conn->query("SELECT id FROM academic_years WHERE is_current = 1 LIMIT 1");
if ($currentYearResult->num_rows === 0) {
    die("No active academic year.");
}
$current_academic_year_id = (int)$currentYearResult->fetch_assoc()['id'];

// Current term from platform_settings
$current_global_term = 4;
$termStmt = $conn->query("SELECT current_global_term FROM platform_settings LIMIT 1");
if ($termRow = $termStmt->fetch_assoc()) {
    $current_global_term = (int)$termRow['current_global_term'];
}

// View term (from URL or current)
$view_term = isset($_GET['view_term']) && in_array($_GET['view_term'], [1,2,3,4])
    ? (int)$_GET['view_term']
    : $current_global_term;

// Fetch all quiz results for this learner in current year
$sql = "
    SELECT DISTINCT 
        r.id AS result_id, r.score, r.total, r.submitted_at, r.time_taken,
        q.id AS quiz_id, q.title AS quiz_title, q.duration, q.publish_marks,
        q.is_summative, q.weight_percent, q.term_number,
        q.class_id, q.created_by,
        COALESCE(ts.subject_name, CONCAT(COALESCE(u.title,''), ' ', COALESCE(u.surname,'Unknown'))) AS display_group,
        u.title, u.surname
    FROM quiz_results r
    JOIN quizzes q ON r.quiz_id = q.id
    JOIN class_students cs ON q.class_id = cs.class_id 
                         AND cs.student_email = ? 
                         AND cs.academic_year_id = ?
    LEFT JOIN teacher_subjects ts ON ts.teacher_email = q.created_by AND ts.class_id = q.class_id
    LEFT JOIN users u ON q.created_by = u.email AND u.role = 'teacher'
    WHERE r.user_email = ? 
      AND q.academic_year_id = ?
    ORDER BY display_group ASC, r.submitted_at DESC
";

$stmt = $conn->prepare($sql);
$stmt->bind_param("ssii", $targetEmail, $current_academic_year_id, $targetEmail, $current_academic_year_id);
$stmt->execute();
$result = $stmt->get_result();

$groupedResults = [];
while ($row = $result->fetch_assoc()) {
    $group = trim($row['display_group'] ?? 'Unknown Subject');
    $group = $group === '' ? 'Unknown Subject' : $group;
    $groupedResults[$group][] = $row;
}
$stmt->close();

function formatDuration($seconds) {
    $minutes = floor($seconds / 60);
    $secs = $seconds % 60;
    return "{$minutes}m {$secs}s";
}

// Render term marks table (unchanged logic – perfect)
function renderTermMarksTable($quizzes, $selectedTerm) {
    $summative = array_filter($quizzes, fn($q) => !empty($q['is_summative']) && (int)$q['term_number'] === $selectedTerm);

    if (empty($summative)) {
        echo '<p class="notice" style="margin:10px 0; text-align:center; font-size:13px;">No summative assessments in this term.</p>';
        return;
    }

    $weights = []; $totalWeight = 0; $publishedMap = [];

    foreach ($summative as $idx => $q) {
        if ($q['publish_marks'] == 1) {
            $w = $q['weight_percent'] ?? 0;
            $weights[] = $w;
            $publishedMap[$idx] = count($weights) - 1;
            $totalWeight += $w;
        }
    }

    if ($totalWeight > 100) {
        $factor = 100 / $totalWeight;
        $weights = array_map(fn($w) => $w * $factor, $weights);
        $totalWeight = 100;
    } elseif ($totalWeight == 0 && !empty($weights)) {
        $equal = 100 / count($weights);
        $weights = array_fill(0, count($weights), $equal);
        $totalWeight = 100;
    }

    $earnedTotal = 0; $maxTotal = $totalWeight;
    ?>
    <table style="width:100%; border-collapse:collapse; font-size:13px; margin-top:5px;">
        <thead>
            <tr style="border-bottom:2px solid #30363d; text-align:left;">
                <th style="padding:8px 6px; color:#4fd1c5; width:40%;">Quiz</th>
                <th style="padding:8px 6px; color:#4fd1c5; text-align:center;">Weight</th>
                <th style="padding:8px 6px; color:#4fd1c5; text-align:center;">Score</th>
                <th style="padding:8px 6px; color:#4fd1c5; text-align:center;">Earned</th>
            </tr>
        </thead>
        <tbody>
            <?php foreach ($summative as $idx => $q):
                $weight = $scoreDisplay = $earnedDisplay = '—'; $earned = 0;

                if ($q['publish_marks'] == 1 && isset($publishedMap[$idx])) {
                    $wIdx = $publishedMap[$idx];
                    $weight = round($weights[$wIdx], 1);
                    $score = $q['score'] ?? 0;
                    $total = $q['total'] ?? 1;
                    $earned = $total > 0 ? round(($score / $total) * $weight, 1) : 0;
                    $earnedTotal += $earned;
                    $scoreDisplay = "$score/$total";
                    $earnedDisplay = "$earned/$weight";
                }
            ?>
                <tr style="border-bottom:1px solid #30363d;">
                    <td style="padding:8px 6px; font-size:12.5px;">
                        <?= htmlspecialchars($q['quiz_title']) ?>
                        <?php if ($q['publish_marks'] == 1): ?>
                            <a href="review_quiz.php?result_id=<?= $q['result_id'] ?>" style="color:#4fd1c5; font-size:0.7em; margin-left:4px;">[R]</a>
                        <?php endif; ?>
                    </td>
                    <td style="padding:8px 6px; text-align:center; color:#8b949e;">
                        <?= $q['publish_marks'] == 1 ? $weight . '%' : '—' ?>
                    </td>
                    <td style="padding:8px 6px; text-align:center;"><?= $scoreDisplay ?></td>
                    <td style="padding:8px 6px; text-align:center; font-weight:700; color:#4fd1c5;">
                        <?= $earnedDisplay ?>
                    </td>
                </tr>
            <?php endforeach; ?>

            <tr style="border-top:2px solid #4fd1c5; font-weight:700;">
                <td style="padding:10px 6px; color:#4fd1c5;">TOTAL</td>
                <td style="padding:10px 6px; text-align:center; color:#4fd1c5;"><?= round($maxTotal, 1) ?>%</td>
                <td style="padding:10px 6px; text-align:center;">—</td>
                <td style="padding:10px 6px; text-align:center; color:#1ed760; font-size:1.1em;">
                    <?= round($earnedTotal, 1) ?>/<?= round($maxTotal, 1) ?> → <?= $maxTotal > 0 ? round(($earnedTotal / $maxTotal) * 100) : 0 ?>%
                </td>
            </tr>
        </tbody>
    </table>

    <?php if ($totalWeight < 100): ?>
        <p style="text-align:center; margin:10px 0; font-size:12px; color:#8b949e;">
            <?= (100 - $totalWeight) ?>% of term still to be assessed
        </p>
    <?php endif;
}
?>

<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>My Quiz History</title>
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
            flex-wrap: wrap;
            gap: 10px;
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

        h2 small {
            font-size: 14px;
            opacity: 0.8;
            font-weight: normal;
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

        /* === SECTION (was teacher-section) === */
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

        .quiz:hover:not(.unpublished) {
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        }

        .quiz.unpublished {
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
            color: var(--accent-color);
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
            color: var(--lock-color);
        }

        .quiz-details a,
        .quiz-header a {
            color: var(--accent-color);
            text-decoration: none;
            font-weight: 600;
            transition: color 0.3s ease;
        }

        .quiz-details a:hover,
        .quiz-header a:hover {
            color: #1ed760;
        }

        .notice {
            font-style: italic;
            color: var(--text-color);
            opacity: 0.8;
            font-size: 14px;
            margin: 5px 0;
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

        /* Modal Styles */
        .modal {
            display: none;
            align-items: center;
            justify-content: center;
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.6);
            backdrop-filter: blur(6px);
            z-index: 1000;
        }

        .modal-content {
            background: #1a252f;
            color: #ffffff;
            padding: 20px;
            border-radius: 10px;
            max-width: 400px;
            width: 90%;
            box-shadow: 0 0 10px rgba(0, 0, 0, 0.5);
            text-align: center;
            position: relative;
            display: flex;
            flex-direction: column;
            align-items: center;
        }

        .close-modal {
            position: absolute;
            top: 10px;
            right: 15px;
            cursor: pointer;
            font-size: 20px;
            color: #aaa;
            transition: color 0.2s;
        }

        .close-modal:hover {
            color: #00ff00;
        }

        .modal-header {
            display: flex;
            justify-content: space-between;
            width: 100%;
            margin-bottom: 20px;
        }

        .modal-header h2 {
            font-size: 18px;
            margin: 0;
            color: #ffffff;
        }

        .score-circle-container {
            position: relative;
            width: 120px;
            height: 120px;
            margin: 0 auto 20px;
        }

        .score-circle-bg {
            fill: none;
            stroke: #444;
            stroke-width: 10;
        }

        .score-circle-fg {
            fill: none;
            stroke: #00ff00;
            stroke-width: 10;
            stroke-linecap: round;
            transform: rotate(-90deg);
            transform-origin: center;
            transition: stroke-dashoffset 0.3s ease;
        }

        .score-circle-text {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            font-size: 32px;
            font-weight: 700;
            color: #ffffff;
        }

        .score-out-of {
            font-size: 14px;
            color: #aaa;
            margin-top: 5px;
        }

        .score-range {
            position: relative;
            width: 100%;
            height: 20px;
            background: #333;
            border-radius: 10px;
            margin-top: 20px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 0 10px;
        }

        .score-range-line {
            position: absolute;
            top: 50%;
            left: 10px;
            right: 10px;
            height: 2px;
            background: #aaa;
            transform: translateY(-50%);
        }

        .score-marker {
            position: absolute;
            top: 50%;
            width: 10px;
            height: 10px;
            background: #00aaff;
            border-radius: 50%;
            transform: translate(-50%, -50%);
            transition: left 0.3s ease;
        }

        .score-line {
            position: absolute;
            top: 0;
            bottom: 0;
            width: 1px;
            background: #aaa;
            transform: translateX(-50%);
        }

        .score-labels {
            display: flex;
            justify-content: space-between;
            width: 100%;
            font-size: 12px;
            color: #aaa;
            margin-top: 5px;
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
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            
            <h2>
                Grades
                <?php if ($viewerRole === 'parent'): ?>
                    <small>— <?= htmlspecialchars($targetEmail) ?></small>
                <?php endif; ?>
            </h2>

            <div style="text-align:center; margin:30px 0;">
    <button onclick="generateProgressReport()" 
            style="padding:14px 32px; background:#00ff99; color:black; border:none; border-radius:12px; 
                   font-weight:600; font-size:16px; cursor:pointer; box-shadow:0 8px 25px rgba(0,255,153,0.4);
                   transition:all 0.3s;">
        Generate Progress Report
    </button>
</div>
            <?php if (!empty($groupedResults)): ?>
                <div class="search-sort">
                    <input type="text" id="searchInput" placeholder="Search by quiz title..." aria-label="Search quiz results">
                    <select id="sortSelect" aria-label="Sort quiz results">
                        <option value="date-desc">Newest First</option>
                        <option value="date-asc">Oldest First</option>
                        <option value="title-asc">Title A-Z</option>
                        <option value="title-desc">Title Z-A</option>
                        <option value="score-desc">Score (Highest)</option>
                        <option value="score-asc">Score (Lowest)</option>
                    </select>
                </div>
            <?php endif; ?>
        </div>

        <?php if (!empty($groupedResults)): ?>
            <?php foreach ($groupedResults as $groupName => $quizzes): ?>
                <div class="teacher-section">
                    <div class="teacher-header" onclick="toggleTeacher(this)">
                        <h3>
                            <?= htmlspecialchars($groupName) ?>
                            <span class="file-count">(<?= count($quizzes) ?> assessment<?= count($quizzes) > 1 ? 's' : '' ?>)</span>
                        </h3>
                        <button class="toggle-teacher" type="button">
                            <i class="fas fa-chevron-down"></i>
                        </button>
                    </div>

                    <div class="teacher-quizzes">
                        <!-- Toggle Button -->
                        <div style="padding:15px 15px 5px; text-align:right;">
                            <button type="button" class="toggle-term-marks" 
                                    style="background:none; border:none; color:#8b949e; font-size:13px; cursor:pointer; display:flex; align-items:center; gap:5px;" 
                                    onclick="event.stopPropagation(); toggleTermMarks(this)">
                                <i class="fas fa-calculator"></i> TERM MARKS
                            </button>
                        </div>

                        <!-- Original Quiz List -->
                        <div class="original-view">
                            <?php foreach ($quizzes as $row): 
                                $isUnpublished = $row['publish_marks'] == 0; ?>
                                <div class="quiz <?= $isUnpublished ? 'unpublished' : '' ?>" 
                                     data-title="<?= htmlspecialchars($row['quiz_title']) ?>" 
                                     data-score="<?= $isUnpublished ? '0' : $row['score'] ?>" 
                                     data-total="<?= $row['total'] ?>">
                                    <div class="quiz-header">
                                        <i class="<?= $isUnpublished ? 'fas fa-lock lock-icon' : 'fas fa-poll quiz-icon' ?>"></i>
                                        <h3>
                                            <?= $row['publish_marks'] == 1 
                                                ? '<a href="review_quiz.php?result_id='.htmlspecialchars($row['result_id']).'">'.htmlspecialchars($row['quiz_title']).'</a>'
                                                : htmlspecialchars($row['quiz_title']) ?>
                                            <?php if (!empty($row['is_summative'])): ?>
                                                <i class="fas fa-check-circle" style="color:#4fd1c5; margin-left:6px; font-size:0.9em;" title="Counts toward term mark"></i>
                                            <?php endif; ?>
                                        </h3>
                                        <button class="toggle-details" onclick="event.stopPropagation(); toggleDetails(this)">
                                            <i class="fas fa-chevron-down"></i>
                                        </button>
                                    </div>
                                    <div class="quiz-details">
                                        <?php if ($row['publish_marks'] == 1): ?>
                                            <p><strong>Score:</strong> <?= $row['score'] ?> / <?= $row['total'] ?></p>
                                            <p>
                                                <strong>Review:</strong>
                                                <button class="viewDetails" data-quiz="<?= $row['quiz_id'] ?>" 
                                                        style="background:#00ffff1a;color:#00ffff;border:none;padding:6px 12px;border-radius:8px;cursor:pointer;">
                                                    View Details
                                                </button>
                                            </p>
                                        <?php else: ?>
                                            <p class="notice">Marks not published yet.</p>
                                        <?php endif; ?>
                                        <p><strong>Duration:</strong> <?= intval($row['duration']) ?> min</p>
                                        <p><strong>Time Taken:</strong> <?= formatDuration($row['time_taken']) ?></p>
                                        <p><strong>Taken on:</strong> <?= date('F j, Y, g:i a', strtotime($row['submitted_at'])) ?></p>
                                    </div>
                                </div>
                            <?php endforeach; ?>
                        </div>

                        <!-- TERM MARKS VIEW — NOW STAYS IN THIS MODE -->
                        <div class="term-marks-view" style="display:none; padding:0 15px 15px;">
                            <div style="margin:10px 0 15px; text-align:center;">
                                <select class="term-selector" 
                                        style="padding:8px 12px; background:#1a202c; color:#e0e6f0; border:1px solid #30363d; border-radius:8px; font-size:14px;">
                                    <?php for ($t = 1; $t <= 4; $t++): ?>
                                        <option value="<?= $t ?>" <?= $view_term == $t ? 'selected' : '' ?>>Term <?= $t ?></option>
                                    <?php endfor; ?>
                                </select>
                            </div>

                            <div class="term-marks-content">
                                <?php renderTermMarksTable($quizzes, $view_term); ?>
                            </div>
                        </div>
                    </div>
                </div>
            <?php endforeach; ?>
        <?php else: ?>
            <p class="empty">No quiz results found.</p>
        <?php endif; ?>

        <div id="loaderOverlay">
            <div class="loader-text">Processing...</div>
            <div class="loader"></div>
        </div>
    </div>

    <!-- Grade Modal -->
    <div id="gradeModal" class="modal">
        <div class="modal-content">
            <span id="closeModal" class="close-modal">×</span>
            <div class="modal-header"><h2>Grade</h2></div>
            <div class="score-circle-container">
                <svg width="120" height="120">
                    <circle class="score-circle-bg" cx="60" cy="60" r="50" />
                    <circle class="score-circle-fg" cx="60" cy="60" r="50" stroke-dasharray="314" stroke-dashoffset="314" />
                </svg>
                <div class="score-circle-text" id="scoreText"></div>
            </div>
            <div class="score-out-of" id="scoreOutOf"></div>
            <div class="score-range" id="scoreRange">
                <div class="score-range-line"></div>
                <div class="score-marker" id="scoreMarker"></div>
                <div class="score-line" id="lowLine"></div>
                <div class="score-line" id="meanLine"></div>
                <div class="score-line" id="highLine"></div>
            </div>
            <div class="score-labels" id="scoreLabels"></div>
        </div>
    </div>

    <script>
        function toggleTeacher(el) {
            const section = el.closest('.teacher-section');
            const content = section.querySelector('.teacher-quizzes');
            const icon = section.querySelector('.toggle-teacher i');
            content.classList.toggle('collapsed');
            icon.style.transform = content.classList.contains('collapsed') ? 'rotate(0deg)' : 'rotate(180deg)';
        }

        function toggleDetails(btn) {
            event.stopPropagation();
            const details = btn.parentElement.nextElementSibling;
            const expanded = details.style.display === 'block';
            details.style.display = expanded ? 'none' : 'block';
            btn.querySelector('i').classList.toggle('fa-chevron-down', expanded);
            btn.querySelector('i').classList.toggle('fa-chevron-up', !expanded);
        }

        // FIXED: Now stays in term marks mode forever until user clicks back
        function toggleTermMarks(btn) {
            const section = btn.closest('.teacher-section');
            const original = section.querySelector('.original-view');
            const termView = section.querySelector('.term-marks-view');
            const isInTermMode = termView.style.display === 'block';

            if (isInTermMode) {
                // Exit term mode → go back to quiz list
                original.style.display = 'block';
                termView.style.display = 'none';
                btn.innerHTML = '<i class="fas fa-calculator"></i> TERM MARKS';
            } else {
                // Enter term mode → show report and stay here
                original.style.display = 'none';
                termView.style.display = 'block';
                btn.innerHTML = '<i class="fas fa-list"></i> QUIZ LIST';
            }
        }

        // Term selector: change term → reload page → stays in term marks mode!
        document.querySelectorAll('.term-selector').forEach(sel => {
            sel.addEventListener('change', function() {
                const url = new URL(window.location);
                url.searchParams.set('view_term', this.value);
                window.location = url.toString();
            });
        });

        // Search functionality (unchanged)
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            let timeout;
            searchInput.addEventListener('input', () => {
                clearTimeout(timeout);
                timeout = setTimeout(() => {
                    const term = searchInput.value.toLowerCase();
                    document.querySelectorAll('.teacher-section').forEach(sec => {
                        const header = sec.querySelector('.teacher-header h3').textContent.toLowerCase();
                        const quizzes = sec.querySelectorAll('.quiz');
                        let visible = 0;
                        quizzes.forEach(q => {
                            const title = q.dataset.title.toLowerCase();
                            const match = title.includes(term) || header.includes(term);
                            q.style.display = match ? 'block' : 'none';
                            if (match) visible++;
                        });
                        sec.style.display = visible ? 'block' : 'none';
                    });
                }, 300);
            });
        }

        // Modal (unchanged)
        const gradeModal = document.getElementById('gradeModal');
        document.querySelectorAll('.viewDetails').forEach(btn => {
            btn.addEventListener('click', e => {
                e.stopPropagation();
                const quizId = btn.dataset.quiz;
                gradeModal.style.display = 'flex';
                fetch(`get_quiz_stats.php?quiz_id=${quizId}&user_email=<?= urlencode($targetEmail) ?>`)
                    .then(r => r.json())
                    .then(data => {
                        const percent = Math.round((data.user_score / data.total) * 100);
                        const circ = 314;
                        document.querySelector('.score-circle-fg').setAttribute('stroke-dashoffset', circ - (circ * percent / 100));
                        document.getElementById('scoreText').textContent = data.user_score;
                        document.getElementById('scoreOutOf').textContent = `Out of ${data.total} pts`;
                        document.getElementById('scoreLabels').innerHTML = `
                            <span>Low: ${data.min}</span>
                            <span>Mean: ${Math.round(data.avg * 10)/10}</span>
                            <span>High: ${data.max}</span>
                        `;
                    });
            });
        });

        document.getElementById('closeModal').onclick = () => gradeModal.style.display = 'none';
        gradeModal.onclick = e => { if (e.target === gradeModal) gradeModal.style.display = 'none'; };

        function generateProgressReport() {
    const url = `progress_report.php?learner=<?= urlencode($targetEmail) ?>`;
    window.open(url, '_blank');
}
    </script>
</body>
</html>