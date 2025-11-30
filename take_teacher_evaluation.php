<?php
session_start();
require_once 'config.php';

// Security: Must be logged in as learner
if (!isset($_SESSION['email']) || $_SESSION['role'] !== 'learner') {
    header("Location: index.php");
    exit();
}

$learnerEmail = $_SESSION['email'];

// Step 1: Get current academic year
$currentYearResult = $conn->query("SELECT id FROM academic_years WHERE is_current = 1 LIMIT 1");
if ($currentYearResult->num_rows === 0) {
    die("No active academic year. Contact your admin.");
}
$current_academic_year_id = (int)$currentYearResult->fetch_assoc()['id'];

// Step 2: Get all class IDs this learner is in for current year
$classIds = [];
$stmt = $conn->prepare("
    SELECT DISTINCT class_id 
    FROM class_students 
    WHERE student_email = ? 
      AND academic_year_id = ?
");
$stmt->bind_param("si", $learnerEmail, $current_academic_year_id);
$stmt->execute();
$result = $stmt->get_result();

while ($row = $result->fetch_assoc()) {
    $classIds[] = (int)$row['class_id'];
}
$stmt->close();

$evaluations = [];

if (!empty($classIds)) {
    // Step 3: Get released evaluations for those classes
    $placeholders = implode(',', array_fill(0, count($classIds), '?'));
    $types = str_repeat('i', count($classIds));

    $stmt = $conn->prepare("
        SELECT 
            e.id,
            e.title,
            e.description,
            e.created_at,
            e.released,
            u.name AS teacher_name,
            c.name AS class_name
        FROM teacher_evaluations e
        JOIN users u ON e.teacher_id = u.id AND u.role = 'teacher'
        JOIN classes c ON e.class_id = c.id
        WHERE e.class_id IN ($placeholders) 
          AND e.academic_year_id = ?
          AND e.released = 1
        ORDER BY e.created_at DESC
    ");

    $bind_params = $classIds;
    $bind_params[] = $current_academic_year_id;
    $types .= 'i';

    $stmt->bind_param($types, ...$bind_params);
    $stmt->execute();
    $evaluations = $stmt->get_result();
    $stmt->close();
}
?>

<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Teacher Evaluations</title>
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
            justify-content: center;
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

        .eval-box {
            background: var(--card-bg);
            padding: 15px;
            border-radius: var(--card-radius);
            margin-bottom: 15px;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
            transition: transform 0.3s ease, box-shadow 0.3s ease;
        }

        .eval-box:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
        }

        .eval-header {
            display: flex;
            align-items: center;
            gap: 10px;
            margin-bottom: 10px;
        }

        .eval-header h3 {
            margin: 0;
            flex: 1;
            font-size: 16px;
            color: var(--accent-color);
        }

        .eval-icon {
            font-size: 20px;
            color: var(--accent-color);
        }

        .eval-box p {
            margin: 5px 0;
            color: var(--text-color);
            opacity: 0.8;
            font-size: 14px;
            line-height: 1.5;
        }

        form label {
            font-size: 14px;
            color: var(--text-color);
            margin-top: 10px;
            display: block;
        }

        form select,
        form textarea {
            width: 100%;
            padding: 10px;
            margin-top: 5px;
            border-radius: var(--card-radius);
            background-color: var(--card-bg);
            border: 1px solid var(--border-color);
            color: var(--text-color);
            font-size: 14px;
            font-family: 'Nunito', sans-serif;
            font-weight: 600;
        }

        form select:focus,
        form textarea:focus {
            border-color: var(--accent-color);
            box-shadow: 0 0 8px var(--shadow-glow);
            outline: none;
        }

        form textarea {
            height: 80px;
            resize: vertical;
        }

        form button {
            background: var(--button-bg);
            color: var(--text-color);
            padding: 8px 16px;
            margin-top: 10px;
            border-radius: var(--card-radius);
            border: none;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
            transition: background 0.3s ease, color 0.3s ease;
        }

        form button:hover {
            background: var(--accent-color);
            color: var(--bg-color);
        }

        .submitted-msg {
            font-style: italic;
            color: var(--accent-color);
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

        @media (max-width: 768px) {
            .container {
                padding: 0 10px;
            }

            h2 {
                font-size: 24px;
            }

            .eval-box {
                padding: 10px;
            }

            .eval-header h3 {
                font-size: 14px;
            }

            .eval-box p,
            form label,
            form select,
            form textarea,
            .submitted-msg {
                font-size: 12px;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h2><i class="fas fa-chalkboard-teacher"></i> Teacher Evaluations</h2>
        </div>

        <?php if ($evaluations && $evaluations->num_rows > 0): ?>
            <?php while ($eval = $evaluations->fetch_assoc()): ?>
                <?php
                // Check if learner has already submitted
                $check = $conn->prepare("SELECT id FROM teacher_evaluation_responses WHERE evaluation_id = ? AND learner_email = ?");
                $check->bind_param("is", $eval['id'], $learnerEmail);
                $check->execute();
                $hasSubmitted = $check->get_result()->num_rows > 0;
                $check->close();
                ?>
                <div class="eval-box">
                    <div class="eval-header">
                        <i class="fas fa-chalkboard-teacher eval-icon"></i>
                        <h3><?= htmlspecialchars($eval['subject']) ?> - <?= htmlspecialchars($eval['teacher_name']) ?> (<?= htmlspecialchars($eval['class_name']) ?>)</h3>
                    </div>
                    <p><?= nl2br(htmlspecialchars($eval['description'])) ?></p>

                    <?php if ($hasSubmitted): ?>
                        <p class="submitted-msg">✅ You have already submitted this evaluation.</p>
                    <?php else: ?>
                        <form method="POST" action="submit_teacher_evaluation.php">
                            <input type="hidden" name="evaluation_id" value="<?= $eval['id'] ?>">
                            <label for="rating-<?= $eval['id'] ?>">Rating (1-5):</label>
                            <select name="rating" id="rating-<?= $eval['id'] ?>" required>
                                <option value="">-- Choose --</option>
                                <option value="1">⭐</option>
                                <option value="2">⭐⭐</option>
                                <option value="3">⭐⭐⭐</option>
                                <option value="4">⭐⭐⭐⭐</option>
                                <option value="5">⭐⭐⭐⭐⭐</option>
                            </select>
                            <label for="feedback-<?= $eval['id'] ?>">Optional Feedback:</label>
                            <textarea name="feedback" id="feedback-<?= $eval['id'] ?>" placeholder="Write feedback..."></textarea>
                            <button type="submit">Submit Evaluation</button>
                        </form>
                    <?php endif; ?>
                </div>
            <?php endwhile; ?>
        <?php else: ?>
            <p class="empty">No teacher evaluations available for your class right now.</p>
        <?php endif; ?>

        <div id="loaderOverlay">
            <div class="loader-text">Processing...</div>
            <div class="loader"></div>
        </div>
    </div>
</body>
</html>