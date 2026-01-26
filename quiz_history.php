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

// Fetch ONLY this learner's own quiz results (strict filter)
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
      AND r.user_email = cs.student_email   -- ← ADDED THIS: Force results to match the enrolled learner
    ORDER BY display_group ASC, r.submitted_at DESC
";

$stmt = $conn->prepare($sql);
$stmt->bind_param("sisi", $targetEmail, $current_academic_year_id, $targetEmail, $current_academic_year_id);
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
                    $weight = $weights[$wIdx];  // Full precision for calculation
                    $score = $q['score'] ?? 0;
                    $total = $q['total'] ?? 1;
                    $earned = $total > 0 ? round(($score / $total) * $weight, 1) : 0;
                    $earnedTotal += $earned;
                    $scoreDisplay = "$score/$total";
                    $earnedDisplay = number_format($earned, 1) . '/' . number_format($weight, 1);
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
                        <?= $q['publish_marks'] == 1 ? number_format($weight, 1) . '%' : '—' ?>
                    </td>
                    <td style="padding:8px 6px; text-align:center;"><?= $scoreDisplay ?></td>
                    <td style="padding:8px 6px; text-align:center; font-weight:700; color:#4fd1c5;">
                        <?= $earnedDisplay ?>
                    </td>
                </tr>
            <?php endforeach; ?>

            <tr style="border-top:2px solid #4fd1c5; font-weight:700;">
                <td style="padding:10px 6px; color:#4fd1c5;">TOTAL</td>
                <td style="padding:10px 6px; text-align:center; color:#4fd1c5;"><?= number_format($maxTotal, 1) ?>%</td>
                <td style="padding:10px 6px; text-align:center;">—</td>
                <td style="padding:10px 6px; text-align:center; color:#1ed760; font-size:1.1em;">
                    <?= number_format($earnedTotal, 1) ?>/<?= number_format($maxTotal, 1) ?> → <?= $maxTotal > 0 ? round(($earnedTotal / $maxTotal) * 100) : 0 ?>%
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
            --card-bg: #1a1919;            /* Gemini Sidebar Charcoal */
            --text-color: #e2e8f0;
            --accent-color: #4fd1c5;       /* Signature Teal */
            --secondary-bg: rgba(255, 255, 255, 0.03); 
            --lock-color: #f85149;
            --card-radius: 18px;
            --shadow-glow: rgba(79, 209, 197, 0.15);
            --border-color: rgba(255, 255, 255, 0.06);
        }

        body {
            margin: 0;
            font-family: 'Nunito', sans-serif;
            font-weight: 600;
            background-color: var(--bg-color);
            color: var(--text-color);
            padding: 40px 20px; /* Increased top padding for a premium feel */
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            align-items: center;
            -webkit-font-smoothing: antialiased; /* Makes the font look crisper on dark backgrounds */
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
            font-weight: 800;
            letter-spacing: -0.8px;
            color: #ffffff;
            text-align: center;
            margin: 0;
            display: flex;
            align-items: center;
            gap: 12px;
        }

        h2 small {
            font-size: 14px;
            color: var(--accent-color);
            opacity: 0.7;
            font-weight: 500;
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

        .teacher-section {
            background: var(--card-bg) !important;
            border-radius: var(--card-radius);
            margin-bottom: 25px;
            border: 1px solid var(--border-color);
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4) !important;
            overflow: hidden;
        }

        .teacher-header {
            padding: 20px 24px !important;
            background: rgba(255, 255, 255, 0.02) !important;
            display: flex;
            align-items: center;
            gap: 12px;
            cursor: pointer;
            transition: background 0.3s ease;
            border-bottom: 1px solid var(--border-color);
        }

        .teacher-header:hover {
            background: rgba(79, 209, 197, 0.05) !important;
        }

        .teacher-header h3 {
            margin: 0;
            flex: 1;
            font-size: 18px;
            font-weight: 700;
            color: #ffffff !important;
            display: flex;
            align-items: center;
            gap: 10px;
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
            background: rgba(255, 255, 255, 0.02) !important;
            padding: 16px !important;
            border-radius: 12px;
            margin: 12px 15px !important;
            border: 1px solid rgba(255, 255, 255, 0.03) !important;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
        }

        .quiz:hover:not(.unpublished) {
            transform: translateX(4px) !important;
            background: rgba(79, 209, 197, 0.04) !important;
            border-color: rgba(79, 209, 197, 0.2) !important;
        }

        .quiz.unpublished {
            opacity: 0.5;
            background: transparent !important;
            border: 1px dashed rgba(255, 255, 255, 0.1) !important;
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
    height: 12px;
    background: #333;
    border-radius: 6px;
    margin: 40px 0 20px 0; /* Extra top margin for labels */
}
        .score-line {
    position: absolute;
    top: -15px; /* Move line above the bar */
    bottom: -5px;
    width: 2px;
    transform: translateX(-50%);
    z-index: 2;
}

/* Color coding for the lines */
#lowLine { background: #ff4d4d; }   /* Red for Lowest */
#meanLine { background: #ffcc00; }  /* Yellow for Average */
#highLine { background: #00ff00; }  /* Green for Highest */

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

     .score-marker {
    position: absolute;
    top: 50%;
    width: 14px;
    height: 14px;
    background: #fff;
    border: 3px solid #00aaff; /* Your specific score color */
    border-radius: 50%;
    transform: translate(-50%, -50%);
    z-index: 5;
    transition: left 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}
.score-line:hover {
    width: 4px; /* Makes the line thicker on hover */
    cursor: help;
}

.score-labels {
    display: flex;
    justify-content: space-between;
    width: 100%;
    font-size: 11px;
    color: #8b949e;
    margin-top: 10px;
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

        /* Term Marks Table Overrides */
        .term-marks-content table {
            background: rgba(0, 0, 0, 0.2) !important;
            border-radius: 10px !important;
        }
        .term-marks-content th {
            text-transform: uppercase !important;
            font-size: 11px !important;
            letter-spacing: 0.5px !important;
            background: rgba(255, 255, 255, 0.02) !important;
        }
        .term-marks-content tr {
            border-bottom: 1px solid rgba(255, 255, 255, 0.03) !important;
        }
        
       .modal {
    display: none; /* JavaScript will change this to flex */
    position: fixed;
    z-index: 1000;
    inset: 0;
    background-color: rgba(0,0,0,0.7);
    align-items: center;
    justify-content: center;
}

/* Clean Gemini-Style Report Button */
.report-button {
    padding: 14px 32px;
    background: rgba(79, 209, 197, 0.1);
    color: var(--accent-color);
    border: 1px solid rgba(79, 209, 197, 0.4);
    border-radius: 12px;
    font-weight: 700;
    font-size: 16px;
    cursor: pointer;
    transition: all 0.3s ease;
    box-shadow: none !important;
}

.report-button:hover {
    background: var(--accent-color);
    color: #0d1117;
    border-color: var(--accent-color);
    transform: translateY(-2px);
}

.report-button:active {
    transform: translateY(0);
}

/* ─────────────────────────────────────────────── */
/*     PROGRESS REPORT MODAL – consolidated        */
/* ─────────────────────────────────────────────── */

#reportModal .modal-content {
    width: 95%;
    max-width: 1000px;
    height: 90vh;
    margin: 5vh auto;
    padding: 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background: #0d1117;
    border-radius: 12px;
    box-shadow: 0 10px 30px rgba(0,0,0,0.5);
    position: relative;          /* ← VERY IMPORTANT: this makes absolute children stay inside */
}

#reportModal .modal-header {
    padding: 20px;
    border-bottom: 1px solid var(--border-color);
    background: #161b22;
    position: relative;          /* extra safety – close button will stay in header */
}

/* Base close button styling – visible on all screen sizes */
#reportModal .close-modal {
    position: absolute;
    top: 15px;
    right: 20px;
    font-size: 36px;
    font-weight: bold;
    color: #e0e6f0;
    cursor: pointer;
    z-index: 10;
    line-height: 1;
    padding: 0 8px;
}

/* Optional: subtle hover effect on desktop too */
#reportModal .close-modal:hover {
    color: white;
    transform: scale(1.15);
}

/* Rest of the modal parts */
.iframe-container {
    flex: 1 1 auto;
    width: 100%;
    background: #0d1117;
    min-height: 0;
}

#reportFrame {
    width: 100%;
    height: 100%;
    border: none;
    display: block;
}

.modal-footer {
    padding: 15px;
    border-top: 1px solid var(--border-color);
    text-align: center;
    background: #161b22;
}

/* ─────────────────────────────────────────────── */
/*     MOBILE – full screen + better close button  */
/* ─────────────────────────────────────────────── */

@media (max-width: 768px) {
    #reportModal .modal-content {
        width: 100%;
        max-width: none;
        height: 100vh;
        margin: 0;
        border-radius: 0;
    }

    #reportModal .modal-header {
        padding: 16px 20px;
    }

    .modal-footer {
        padding: 12px 20px;
    }

    /* Enhanced mobile close button – bigger touch target */
    #reportModal .close-modal {
        top: 12px;
        right: 16px;
        font-size: 40px;
        width: 48px;
        height: 48px;
        line-height: 48px;
        text-align: center;
        background: rgba(0,0,0,0.5);
        border-radius: 50%;
        color: white;
    }

    #reportModal .close-modal:hover,
    #reportModal .close-modal:active {
        background: rgba(0,0,0,0.8);
    }
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
    <button onclick="generateProgressReport()" class="report-button">
    <i class="fas fa-file-invoice"></i> Generate Progress Report
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
                                                <strong>Performance overview:</strong>
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

    <div id="gradeModal" class="modal">
    <div class="modal-content">
        <span id="closeModal" class="close-modal">×</span>
        <div class="modal-header"><h2>Performance Overview</h2></div>
        
        <div class="score-circle-container">
            <svg width="120" height="120">
                <circle class="score-circle-bg" cx="60" cy="60" r="50" />
                <circle class="score-circle-fg" id="circleProgress" cx="60" cy="60" r="50" stroke-dasharray="314" stroke-dashoffset="314" />
            </svg>
            <div class="score-circle-text" id="scoreText">0%</div>
        </div>
        
        <div id="scoreOutOf" style="color:#8b949e; margin-bottom:10px;"></div>

        <div class="score-range">
            <div class="score-marker" id="scoreMarker"></div>
            <div class="score-line" id="lowLine" title="Lowest"></div>
            <div class="score-line" id="meanLine" title="Average"></div>
            <div class="score-line" id="highLine" title="Highest"></div>
        </div>
        
        <div class="score-labels">
            <span>0%</span>
            <span>Class Distribution</span>
            <span>100%</span>
        </div>

        <hr style="width: 100%; border: 0; border-top: 1px solid rgba(255,255,255,0.1); margin: 15px 0;">

        <div class="modal-description" style="text-align: left; color: #8b949e; font-size: 12px; line-height: 1.6; font-weight: normal;">
            <p style="margin: 0 0 5px 0;"><i class="fas fa-info-circle" style="margin-right: 5px;"></i> <strong>How to read this:</strong></p>
            <ul style="list-style: none; padding: 0; margin: 0;">
                <li><span style="color: #00aaff;">●</span> The <b>Blue Dot</b> is your personal score.</li>
                <li><span style="color: #ff4d4d;">|</span> The <b>Red Line</b> is the lowest score in class.</li>
                <li><span style="color: #ffcc00;">|</span> The <b>Yellow Line</b> is the class average.</li>
                <li><span style="color: #00ff00;">|</span> The <b>Green Line</b> is the highest score achieved.</li>
            </ul>
        </div>
    </div>
    </div>

<div id="reportModal" class="modal">
    <div class="modal-content">
       <span id="closeReportModal" class="close-modal" onclick="closeReportModalNow()">&times;</span>
        <div class="modal-header">
            <h2>Academic Progress Report</h2>
        </div>
        <div class="iframe-container" style="height: 70vh; width: 100%;">
            <iframe id="reportFrame" src="" style="width:100%; height:100%; border:none;"></iframe>
        </div>
        
    </div>
</div>
<script>
    // --- 1. PRESERVED UTILITY FUNCTIONS ---
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

    function toggleTermMarks(btn) {
        const section = btn.closest('.teacher-section');
        const original = section.querySelector('.original-view');
        const termView = section.querySelector('.term-marks-view');
        const isInTermMode = termView.style.display === 'block';

        if (isInTermMode) {
            original.style.display = 'block';
            termView.style.display = 'none';
            btn.innerHTML = '<i class="fas fa-calculator"></i> TERM MARKS';
        } else {
            original.style.display = 'none';
            termView.style.display = 'block';
            btn.innerHTML = '<i class="fas fa-list"></i> QUIZ LIST';
        }
    }

    // --- 2. SEARCH & TERM SELECTION ---
    document.querySelectorAll('.term-selector').forEach(sel => {
        sel.addEventListener('change', function() {
            const url = new URL(window.location);
            url.searchParams.set('view_term', this.value);
            window.location = url.toString();
        });
    });

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

    // --- 3. GRADE STATS MODAL (Performance Overview) ---
    document.querySelectorAll('.viewDetails').forEach(btn => {
        btn.addEventListener('click', function() {
            const quizId = this.dataset.quiz;
            const loader = document.getElementById('loaderOverlay');
            const gModal = document.getElementById('gradeModal');
            
            if (loader) loader.style.display = 'flex';

            fetch(`get_quiz_stats.php?quiz_id=${quizId}`)
                .then(response => response.json())
                .then(data => {
                    if (loader) loader.style.display = 'none';
                    if (data.error) { alert("Could not load stats."); return; }

                    if (gModal) gModal.style.display = 'flex';

                    const circle = document.getElementById('circleProgress');
                    const percentage = data.user_score;
                    const offset = 314 - (314 * (percentage / 100));
                    if (circle) circle.style.strokeDashoffset = offset;

                    document.getElementById('scoreText').innerText = percentage + '%';
                    document.getElementById('scoreOutOf').innerText = `You scored ${data.score_out_of}`;
                    document.getElementById('scoreMarker').style.left = percentage + '%';
                    
                    document.getElementById('lowLine').style.left = data.min + '%';
                    document.getElementById('meanLine').style.left = data.avg + '%';
                    document.getElementById('highLine').style.left = data.max + '%';
                })
                .catch(err => {
                    if (loader) loader.style.display = 'none';
                    console.error(err);
                });
        });
    });

    // --- 4. PROGRESS REPORT MODAL ---
    function generateProgressReport() {
        const loader = document.getElementById('loaderOverlay');
        const rFrame = document.getElementById('reportFrame');
        const rModal = document.getElementById('reportModal');
        
        if (loader) loader.style.display = 'flex';
        
        const url = `progress_report.php?learner=<?= urlencode($targetEmail) ?>`;
        if (rFrame) {
            rFrame.src = url;
            rFrame.onload = function() {
                if (loader) loader.style.display = 'none';
                if (rModal) rModal.style.display = 'flex';
            };
        }
    }

  function closeReportModalNow() {
    const rModal = document.getElementById('reportModal');
    const rFrame = document.getElementById('reportFrame');
    
    if (rModal) {
        rModal.style.setProperty('display', 'none', 'important');
        rModal.style.display = 'none'; // Double down
    }
    
    if (rFrame) {
        rFrame.onload = null; // Clear the onload handler to prevent re-triggering
        rFrame.src = ''; // Now safe to clear content
    }
}

    function printReport() {
        const rFrame = document.getElementById('reportFrame');
        if (rFrame && rFrame.contentWindow) {
            rFrame.contentWindow.focus();
            rFrame.contentWindow.print();
        }
    }

   // --- 5. THE "CLOSE" FIX (Global Click Handler) ---
    window.onclick = function(event) {
        const gModal = document.getElementById('gradeModal');
        const rModal = document.getElementById('reportModal');
        const closeG = document.getElementById('closeModal');
        const closeR = document.getElementById('closeReportModal');

        // Close Grade Modal logic
        if (event.target === gModal || event.target === closeG) {
            if (gModal) gModal.style.display = 'none';
        }
        
        // Close Report Modal logic
        // We check if they clicked the overlay OR the X button specifically
        if (event.target === rModal || event.target === closeR || closeR.contains(event.target)) {
            closeReportModalNow();
        }
    };

    // Keyboard support: Close with Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === "Escape") {
            const gModal = document.getElementById('gradeModal');
            if (gModal) gModal.style.display = 'none';
            closeReportModalNow();
        }
    });
</script>

</body>
</html>