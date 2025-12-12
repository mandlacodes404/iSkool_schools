<?php
require_once 'config.php';

echo "<pre>";
echo "=== iSkool Quiz Content & Results Seeder ===\n";
echo "Adding questions + student results to all 16 quizzes...\n\n";

$academic_year_id = 1;

// Get all seeded quizzes (from our previous seeder)
$stmt = $conn->prepare("SELECT id, class_id, duration, start_time, term_number, is_summative FROM quizzes WHERE academic_year_id = ? ORDER BY id");
$stmt->bind_param("i", $academic_year_id);
$stmt->execute();
$quizzes_result = $stmt->get_result();

$quiz_list = [];
while ($row = $quizzes_result->fetch_assoc()) {
    $quiz_list[] = $row;
}
$stmt->close();

if (empty($quiz_list)) {
    die("No quizzes found! Run the first seeder first.\n");
}

// Sample question bank (generic enough for Maths & Physical Sciences)
$math_questions = [
    "What is the value of x in the equation 2x + 5 = 13?", "Solve for y: 3y - 7 = 11",
    "Factorise: x² + 5x + 6", "What is the gradient of the line y = 3x + 2?",
    "Calculate the area of a triangle with base 8cm and height 5cm.", "Simplify: √(16 × 9)",
    "What is sin(30°)?", "Convert 45° to radians.", "Find the hypotenuse of a right triangle with legs 3 and 4.",
    "What is the derivative of x³?", "Expand (x + 2)(x - 3)", "Solve the quadratic: x² - 5x + 6 = 0"
];

$physics_questions = [
    "What is Newton's Second Law?", "Define velocity.", "What is the unit of force?",
    "Calculate work done when force = 10N and distance = 5m.", "State Ohm's Law.",
    "What is acceleration due to gravity on Earth?", "Define kinetic energy.",
    "What is the speed of light in a vacuum?", "Explain refraction.", "What is the formula for momentum?",
    "State the law of conservation of energy.", "What is wavelength?"
];

foreach ($quiz_list as $quiz) {
    $quiz_id = $quiz['id'];
    $class_id = $quiz['class_id'];
    $duration = $quiz['duration'];
    $start_time = $quiz['start_time'];
    $term = $quiz['term_number'];

    echo "Processing Quiz ID $quiz_id (Class $class_id, Term $term)...\n";

    // Choose question bank based on class (5 = Grade 10 Maths from previous seeder)
    $questions_pool = ($class_id == 5) ? $math_questions : $physics_questions;

    // Add 8-12 random questions
    $num_questions = rand(8, 12);
    $total_points = 0;
    shuffle($questions_pool);

    for ($q = 0; $q < $num_questions; $q++) {
        $question_text = $questions_pool[$q % count($questions_pool)] . " (Q" . ($q+1) . ")";
        $points = rand(2, 5); // 2-5 points each
        $total_points += $points;

        // FIXED TABLE NAME: quizquestions (no underscore)
        $stmt = $conn->prepare("INSERT INTO quizquestions (quiz_id, question_text, points) VALUES (?, ?, ?)");
        $stmt->bind_param("isi", $quiz_id, $question_text, $points);
        $stmt->execute();
        $stmt->close();
    }

    echo "  Added $num_questions questions (Total: $total_points marks)\n";

    // Get students in this class
    $stmt = $conn->prepare("SELECT student_email FROM class_students WHERE class_id = ? AND academic_year_id = ?");
    $stmt->bind_param("ii", $class_id, $academic_year_id);
    $stmt->execute();
    $students_result = $stmt->get_result();

    $class_students = [];
    while ($row = $students_result->fetch_assoc()) {
        $class_students[] = $row['student_email'];
    }
    $stmt->close();

    $completion_rate = rand(75, 95); // 75-95% complete the quiz
    $num_complete = round(count($class_students) * $completion_rate / 100);
    shuffle($class_students);

    $completed_count = 0;
    foreach ($class_students as $index => $email) {
        if ($completed_count >= $num_complete) break;

        // Simulate realistic score (average ~68-78%)
        $avg_score = rand(68, 78);
        $variation = rand(-20, 25);
        $percentage = max(30, min(98, $avg_score + $variation));
        $score = round(($percentage / 100) * $total_points);

        // Time taken: 60-130% of duration, rounded to minutes
        $time_taken = rand(60, 130) * $duration / 100;
        $time_taken = round($time_taken / 60) * 60;

        // Submitted around quiz start_time ± few days
        $submitted_at = date('Y-m-d H:i:s', strtotime($start_time) + rand(-3*86400, 7*86400));

        // Insert attempt
        $stmt = $conn->prepare("INSERT INTO quiz_attempts (user_email, quiz_id, attempt_count, last_attempt) VALUES (?, ?, 1, ?)");
        $stmt->bind_param("sis", $email, $quiz_id, $submitted_at);
        $stmt->execute();
        $stmt->close();

        // Insert result
        $stmt = $conn->prepare("INSERT INTO quiz_results (user_email, quiz_id, academic_year_id, score, total, time_taken, submitted_at) VALUES (?, ?, ?, ?, ?, ?, ?)");
        $stmt->bind_param("siiiiss", $email, $quiz_id, $academic_year_id, $score, $total_points, $time_taken, $submitted_at);
        $stmt->execute();
        $stmt->close();

        $completed_count++;
    }

    echo "  Generated results for $completed_count / " . count($class_students) . " students (avg ~72%)\n\n";
}

echo "=== QUIZ CONTENT & RESULTS SEEDING COMPLETE! ===\n";
echo "Log in as a learner and check:\n";
echo "- Quiz results (if visible)\n";
echo "- Analytics dashboards\n";
echo "- Term report cards (should now show real marks, averages, and rankings!)\n";
?>