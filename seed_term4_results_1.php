<?php
require_once 'config.php';

echo "<pre>";
echo "=== Seeding Questions & Realistic Results for the 12 New Term 4 Quizzes ===\n";
echo "Varied scores: natural spread (some low, average, high)\n\n";

$academic_year_id = 1;

// Fetch only the new quizzes (the 3 topics we just added)
$new_titles = [
    "Term 4: Analytical Geometry Summative Assessment",
    "Term 4: Functions and Graphs Summative Assessment",
    "Term 4: Euclidean Geometry Summative Assessment"
];

$in_titles = str_repeat('?,', count($new_titles) - 1) . '?';
$stmt = $conn->prepare("
    SELECT id, class_id, duration, start_time, title, created_by
    FROM quizzes 
    WHERE term_number = 4 
      AND is_summative = 1 
      AND academic_year_id = ?
      AND title IN ($in_titles)
    ORDER BY created_by, title
");
$stmt->bind_param("i" . str_repeat('s', count($new_titles)), $academic_year_id, ...$new_titles);
$stmt->execute();
$result = $stmt->get_result();

$quizzes = [];
while ($row = $result->fetch_assoc()) {
    $quizzes[] = $row;
}
$stmt->close();

if (empty($quizzes)) {
    die("No new Term 4 quizzes found. Run the first script first.\n");
}

$math_questions_pool = [
    "Find the equation of the line passing through points (2,3) and (5,9)",
    "Determine the midpoint and distance between A(-1,4) and B(3, -2)",
    "Sketch the parabola y = x² - 4x + 3 and state its vertex",
    "Solve the system: y = 2x + 1 and y = x² - 3",
    "Prove triangles ABC and DEF are similar (give reasons)",
    "Calculate the area of a triangle with vertices (0,0), (6,0), (3,4)",
    "Find the gradient and y-intercept of y = -3x + 7",
    "Solve the inequality x² - 5x - 6 ≥ 0",
    "Find the turning point of y = -x² + 6x - 5",
    "State and prove the theorem about angles in the same segment",
    "Calculate the length of the hypotenuse in a 8-15-17 triangle",
    "Determine if points are collinear: (1,2), (3,6), (5,10)"
];

foreach ($quizzes as $quiz) {
    $quiz_id = $quiz['id'];
    $class_id = $quiz['class_id'];
    $duration = $quiz['duration'];
    $start_time = $quiz['start_time'];
    $title = $quiz['title'];
    $teacher = $quiz['created_by'];

    echo "Processing: $title (by $teacher)\n";

    // Add 12-15 questions
    $num_q = rand(12, 15);
    $total_points = 0;
    shuffle($math_questions_pool);

    for ($i = 0; $i < $num_q; $i++) {
        $text = $math_questions_pool[$i % count($math_questions_pool)] . " (Q" . ($i+1) . ")";
        $points = rand(5, 8);
        $total_points += $points;

        $stmt = $conn->prepare("INSERT INTO quizquestions (quiz_id, question_text, points) VALUES (?, ?, ?)");
        $stmt->bind_param("isi", $quiz_id, $text, $points);
        $stmt->execute();
        $stmt->close();
    }
    echo "  → $num_q questions ($total_points marks)\n";

    // Get enrolled students
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
    $completing = round($total_students * rand(94, 99) / 100);

    $completed = 0;
    shuffle($students);

    foreach ($students as $email) {
        if ($completed >= $completing) break;

        // Realistic normal distribution around 65%
        $percentage = max(30, min(95, gauss_ms(65, 16)));
        $score = round(($percentage / 100) * $total_points);

        $time_taken = round(rand(75, 115) * $duration / 100 / 60) * 60;
        $submitted_at = date('Y-m-d H:i:s', strtotime($start_time) + rand(-2, 3) * 86400);

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

    echo "  → Results: $completed / $total_students students (realistic variation)\n\n";
}

echo "=== ALL DONE ===\n";
echo "The 12 new Term 4 quizzes now have questions and realistic student results!\n";
echo "Each teacher has 4 × 25% = 100% weight in Term 4.\n";

// Gaussian helper function
function gauss_ms($mean, $sd) {
    $u = $v = 0;
    while ($u === 0) $u = mt_rand() / mt_getrandmax();
    while ($v === 0) $v = mt_rand() / mt_getrandmax();
    return $mean + $sd * sqrt(-2 * log($u)) * cos(2 * M_PI * $v);
}
?>