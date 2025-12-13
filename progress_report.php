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

// Get current academic year
$currentYearResult = $conn->query("SELECT id FROM academic_years WHERE is_current = 1 LIMIT 1");
if ($currentYearResult->num_rows === 0) {
    die("No active academic year.");
}
$current_academic_year_id = (int)$currentYearResult->fetch_assoc()['id'];

// Current global term
$current_global_term = 4;
$termStmt = $conn->query("SELECT current_global_term FROM platform_settings LIMIT 1");
if ($termRow = $termStmt->fetch_assoc()) {
    $current_global_term = (int)$termRow['current_global_term'];
}

// Fetch all quiz results (same as grades page)
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

/**
 * Calculate term percentage and assessment progress
 */
function calculateTermPercentage($quizzes, $term) {
    $summative = array_filter($quizzes, fn($q) => !empty($q['is_summative']) && (int)$q['term_number'] === $term);

    if (empty($summative)) {
        return [
            'percentage' => null,
            'assessed_percent' => 0,
            'message' => 'No summative assessments yet'
        ];
    }

    $weights = [];
    $totalWeight = 0;
    $publishedMap = [];

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

    $earnedTotal = 0;
    foreach ($summative as $idx => $q) {
        if ($q['publish_marks'] == 1 && isset($publishedMap[$idx])) {
            $wIdx = $publishedMap[$idx];
            $weight = $weights[$wIdx];
            $score = $q['score'] ?? 0;
            $total = $q['total'] ?? 1;
            $earned = $total > 0 ? ($score / $total) * $weight : 0;
            $earnedTotal += $earned;
        }
    }

    $percentage = $totalWeight > 0 ? round(($earnedTotal / $totalWeight) * 100) : 0;
    $assessed = round($totalWeight, 1);
    $remaining = round(100 - $assessed, 1);

    $assessText = $remaining > 0 
        ? "$assessed% assessed · $remaining% still to come"
        : "100% assessed";

    return [
        'percentage' => $percentage,
        'assessed_percent' => $assessed,
        'message' => $assessText
    ];
}
?>

<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Progress Report - Term <?= $current_global_term ?></title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.2/css/all.min.css">
    <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@600&display=swap" rel="stylesheet">
    <style>
        :root {
            --bg-color: #0d1117;
            --card-bg: #161b22;
            --text-color: #e0e6f0;
            --accent-color: #4fd1c5;
            --border-color: #30363d;
            --progress-bg: #21262d;
        }
        body {
            margin: 0;
            font-family: 'Nunito', sans-serif;
            background: var(--bg-color);
            color: var(--text-color);
            padding: 30px;
            min-height: 100vh;
        }
        .container {
            max-width: 900px;
            margin: 0 auto;
        }
        h1 {
            text-align: center;
            font-size: 34px;
            margin-bottom: 10px;
            color: var(--accent-color);
        }
        .subtitle {
            text-align: center;
            font-size: 18px;
            margin-bottom: 50px;
            opacity: 0.9;
        }
        .report-table {
            width: 100%;
            border-collapse: collapse;
            background: var(--card-bg);
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 4px 20px rgba(0,0,0,0.3);
        }
        .report-table th {
            background: rgba(79, 209, 197, 0.2);
            padding: 18px;
            text-align: left;
            font-size: 18px;
            color: var(--accent-color);
        }
        .report-table td {
            padding: 20px 18px;
            border-top: 1px solid var(--border-color);
        }
        .subject {
            font-size: 19px;
            font-weight: 600;
        }
        .mark-section {
            text-align: right;
        }
        .percentage {
            font-size: 36px;
            font-weight: 700;
            line-height: 1;
            margin-bottom: 8px;
        }
        .progress-container {
            width: 100%;
            height: 16px;
            background: var(--progress-bg);
            border-radius: 8px;
            overflow: hidden;
            margin-bottom: 8px;
        }
        .progress-bar {
            height: 100%;
            border-radius: 8px;
            transition: width 0.6s ease, background 0.4s ease;
            width: 0%;
        }
        .assess-text {
            font-size: 14px;
            opacity: 0.85;
        }
        .no-data {
            text-align: center;
            padding: 80px;
            font-size: 20px;
            opacity: 0.7;
        }
        .print-btn {
            display: block;
            margin: 40px auto;
            padding: 14px 36px;
            background: var(--accent-color);
            color: black;
            border: none;
            border-radius: 12px;
            font-size: 17px;
            font-weight: 600;
            cursor: pointer;
        }
        @media print {
            body { padding: 20px; background: white; color: black; }
            .print-btn { display: none; }
            .progress-bar { background: #4fd1c5 !important; }
        }
        @media (max-width: 768px) {
            .percentage { font-size: 28px; }
            .report-table td { padding: 16px; }
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>Progress Report</h1>
        <div class="subtitle">
            Term <?= $current_global_term ?> 
            <?php if ($viewerRole === 'parent'): ?>
                — <?= htmlspecialchars($targetEmail) ?>
            <?php else: ?>
                — Your Results
            <?php endif; ?>
        </div>

        <?php if (empty($groupedResults)): ?>
            <div class="no-data">No quiz results available yet for this academic year.</div>
        <?php else: ?>
            <table class="report-table">
                <thead>
                    <tr>
                        <th>Subject</th>
                        <th style="text-align:right;">Current Term Mark</th>
                    </tr>
                </thead>
                <tbody>
                    <?php foreach ($groupedResults as $groupName => $quizzes): 
                        $calc = calculateTermPercentage($quizzes, $current_global_term);
                        $assessedWidth = $calc['assessed_percent'] ?? 0;

                        // Dynamic color based on performance
                        $barColor = '#f85149'; // low
                        if ($calc['percentage'] !== null) {
                            if ($calc['percentage'] >= 80) $barColor = '#1ed760';      // excellent
                            elseif ($calc['percentage'] >= 60) $barColor = '#4fd1c5'; // good
                            elseif ($calc['percentage'] >= 40) $barColor = '#ffd43b'; // average
                        } else {
                            $barColor = '#30363d'; // no mark yet
                        }
                    ?>
                        <tr>
                            <td class="subject"><?= htmlspecialchars($groupName) ?></td>
                            <td class="mark-section">
                                <?php if ($calc['percentage'] !== null): ?>
                                    <div class="percentage" style="color: <?= $barColor ?>;">
                                        <?= $calc['percentage'] ?>%
                                    </div>
                                    <div class="progress-container">
                                        <div class="progress-bar" 
                                             style="width: <?= $assessedWidth ?>%; background: <?= $barColor ?>;">
                                        </div>
                                    </div>
                                    <div class="assess-text"><?= htmlspecialchars($calc['message']) ?></div>
                                <?php else: ?>
                                    <div class="assess-text">No summative assessments yet</div>
                                    <div class="progress-container">
                                        <div class="progress-bar" style="width: 0%; background: #30363d;"></div>
                                    </div>
                                <?php endif; ?>
                            </td>
                        </tr>
                    <?php endforeach; ?>
                </tbody>
            </table>

            <button class="print-btn" onclick="window.print()">
                <i class="fas fa-print"></i> Print Report
            </button>
        <?php endif; ?>
    </div>
</body>
</html>