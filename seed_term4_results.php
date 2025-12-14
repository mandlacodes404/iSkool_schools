<?php
require_once 'config.php';

echo "<pre>";
echo "=== Seeding Questions & Realistic Results for Term 4 Summatives ===\n";
echo "Scores: natural spread (some low, most average, some high)\n\n";

$academic_year_id = 1;

// Get only the 4 Term 4 summative quizzes for 2025
$stmt = $conn->prepare("
    SELECT q.id, q.class_id, q.duration, q.start_time, q.title
    FROM quizzes q
    WHERE q.term_number = 4 
      AND q.is_summative = 1 
      AND q.academic_year_id = ?
");
$stmt->bind_param("i", $academic_year_id);
$stmt->execute();
$result = $stmt->get_result();

$quizzes = [];
while ($row = $result->fetch_assoc()) {
    $quizzes[] = $row;
}
$stmt->close();

if (empty($quizzes)) {
    die("No Term 4 summative quizzes found. Run seed_term4_summatives.php first.\n");
}

$math_questions = [
    "Solve: 3(x - 4) = 27", "Calculate sin(30°)", "Find the mean of 8, 12, 15, 18, 22",
    "Probability of heads on a coin flip?", "Expand (x + 4)^2",
    "Solve x² - 10x + 21 = 0", "Convert 30° to radians",
    "Simple interest: P=10000, r=8%, t=2 years", "What is tan(45°)?",
    "Factorise x² - 16", "Find the median of 5, 7, 9, 12, 15",
    "Area of triangle: base=10, height=8", "Probability of rolling a 4 or 5 on a die"
];

foreach ($quizzes as $quiz) {
    $quiz_id = $quiz['id'];
    $class_id = $quiz['class_id'];
    $duration = $quiz['duration'];
    $start_time = $quiz['start_time'];
    $title = $quiz['title'];

    echo "Processing: $title (ID: $quiz_id)\n";

    // Add 12–15 questions
    $num_q = rand(12, 15);
    $total_points = 0;
    shuffle($math_questions);

    for ($i = 0; $i < $num_q; $i++) {
        $text = $math_questions[$i % count($math_questions)] . " (Q" . ($i+1) . ")";
        $points = rand(5, 8);
        $total_points += $points;

        $stmt = $conn->prepare("INSERT INTO quizquestions (quiz_id, question_text, points) VALUES (?, ?, ?)");
        $stmt->bind_param("isi", $quiz_id, $text, $points);
        $stmt->execute();
        $stmt->close();
    }
    echo "  → $num_q questions ($total_points marks)\n";

    // Get enrolled students for this class in 2025
    $stmt = $conn->prepare("SELECT student_email FROM class_students WHERE class_id = ? AND academic_year_id = ?");
    $stmt->bind_param("ii", $class_id, $academic_year_id);
    $stmt->execute();
    $res = $stmt->get_result();
    $students = [];
    while ($row = $res->fetch_assoc()) {
        $students[] = $row['student_email'];
    }
    $stmt->close();

    $total_students = count($students);
    $completion_rate = rand(95, 99);
    $completing = round($total_students * $completion_rate / 100);

    $completed = 0;
    shuffle($students);

    foreach ($students as $email) {
        if ($completed >= $completing) break;

        // Realistic score distribution (bell curve around ~65%)
        $percentage = max(25, min(95, gauss_ms(65, 16)));  // Normal distribution helper below
        $score = round(($percentage / 100) * $total_points);

        $time_taken = round(rand(80, 115) * $duration / 100 / 60) * 60;
        $offset_days = rand(-1, 2);
        $submitted_at = date('Y-m-d H:i:s', strtotime($start_time) + $offset_days * 86400);

        // Single attempt
        $stmt = $conn->prepare("INSERT IGNORE INTO quiz_attempts (user_email, quiz_id, attempt_count, last_attempt) VALUES (?, ?, 1, ?)");
        $stmt->bind_param("sis", $email, $quiz_id, $submitted_at);
        $stmt->execute();
        $stmt->close();

        $stmt = $conn->prepare("INSERT INTO quiz_results (user_email, quiz_id, academic_year_id, score, total, time_taken, submitted_at) VALUES (?, ?, ?, ?, ?, ?, ?)");
        $stmt->bind_param("siiiiss", $email, $quiz_id, $academic_year_id, $score, $total_points, $time_taken, $submitted_at);
        $stmt->execute();
        $stmt->close();

        $completed++;
    }

    echo "  → Results: $completed / $total_students students (realistic spread)\n\n";
}

echo "=== ALL DONE ===\n";
echo "Term 4 summative quizzes now have questions and realistic final marks!\n";

// Simple Gaussian helper (approximation)
function gauss_ms($mean, $sd) {
    $u = 0; while($u == 0) $u = mt_rand()/mt_getrandmax();
    $v = 0; while($v == 0) $v = mt_rand()/mt_getrandmax();
    return $mean + $sd * sqrt(-2 * log($u)) * cos(2 * M_PI * $v);
}
?>