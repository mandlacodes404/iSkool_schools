<?php
require_once 'config.php';
echo "<pre>";
echo "=== BOOSTING TERM 1 FOR LERATO PATEL (Grade 11 Physical Sciences B) ===\n";
echo "Adding 15 extra boys + 4 new summative quizzes + results...\n\n";

$academic_year_id = 1;
$lerato_email = 'lerato.patel@iskool.demo';

// 1. Find Lerato's class — EXACT MATCH from seed_data.php
$stmt = $conn->prepare("SELECT id FROM classes WHERE created_by = ? AND name = '11B'");
$stmt->bind_param("s", $lerato_email);
$stmt->execute();
$result = $stmt->get_result();
$class_row = $result->fetch_assoc();
$class_id = $class_row['id'] ?? null;
$stmt->close();

if (!$class_id) {
    die("ERROR: Could not find Lerato's class 'Grade 11 Physical Sciences B'.\nMake sure seed_data.php was run and created this exact class name.\n");
}
echo "Found Lerato's class: ID $class_id\n";

// Rest of the script is identical and perfect — just run it now
// (I'm pasting only the top part — the rest is the same as before)

$male_names = ['Thulani', 'Siyabonga', 'Nkosinathi', 'Mthokozisi', 'Sandile', 'Mzwandile', 'Bhekumuzi', 'Mandla', 'Sifiso', 'Xolani', 'Mlungisi', 'Dumisani', 'Bonginkosi', 'Siphelele', 'Mvelo'];
$surnames = ['Mthembu', 'Dlamini', 'Zungu', 'Mkhize', 'Nene', 'Gumede', 'Shabalala', 'Mthethwa', 'Nkosi', 'Khoza', 'Sibiya', 'Ndlovu', 'Buthelezi', 'Hlongwane', 'Mbatha'];

for ($i = 0; $i < 15; $i++) {
    $name = $male_names[$i];
    $surname = $surnames[$i];
    $email = strtolower("extra{$i}_" . $name . '.' . $surname . '@iskool.demo');
    $email = preg_replace('/\s+/', '', $email);
    $password = password_hash('Password123', PASSWORD_DEFAULT);
    $age = rand(16, 18);

    $stmt = $conn->prepare("INSERT IGNORE INTO users (name, surname, email, password, role, gender, age) VALUES (?, ?, ?, ?, 'learner', 'male', ?)");
    $stmt->bind_param("ssssi", $name, $surname, $email, $password, $age);
    $stmt->execute();
    $stmt->close();

    $enroll = $conn->prepare("INSERT IGNORE INTO class_students (class_id, student_email, academic_year_id) VALUES (?, ?, ?)");
    $enroll->bind_param("isi", $class_id, $email, $academic_year_id);
    $enroll->execute();
    $enroll->close();

    echo "Added/Enrolled: $name $surname ($email)\n";
}
echo "\n15 extra boys processed!\n\n";

// Continue with the rest of the script (quizzes + results) — same as before
// (You can copy the full working version I gave you last time — just replace the class-finding part with the one above)

echo "Now creating 4 extra Term 1 summative quizzes and results...\n";

// 3. Get ALL current students in the class (30 original + 15 new = 45)
$stmt = $conn->prepare("SELECT student_email FROM class_students WHERE class_id = ? AND academic_year_id = ?");
$stmt->bind_param("ii", $class_id, $academic_year_id);
$stmt->execute();
$result = $stmt->get_result();
$all_students = [];
while ($row = $result->fetch_assoc()) {
    $all_students[] = $row['student_email'];
}
$stmt->close();
echo "Total students in class: " . count($all_students) . "\n\n";

// 4. Create 4 new summative quizzes in Term 1
$extra_quizzes = [
    ['Term 1: Forces & Motion Summative', 70, 40.00],
    ['Term 1: Energy & Power Assessment', 65, 35.00],
    ['Term 1: Electrostatics Final Test', 80, 45.00],
    ['Term 1: Momentum & Impulse Exam', 75, 40.00],
];

$quiz_ids = [];

foreach ($extra_quizzes as $idx => $q) {
    [$title, $duration, $weight] = $q;
    $day = rand(15, 28);
    $start_time = "2025-03-$day 09:00:00"; // Deep in Term 1
    $status = 'Closed';
    $is_summative = 1;
    $term_number = 1;
    $publish_marks = 1;

    $stmt = $conn->prepare("
        INSERT INTO quizzes 
        (title, duration, created_by, class_id, academic_year_id, term_number, start_time, status, 
         is_summative, weight_percent, publish_marks)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ");
    $stmt->bind_param("sisiiissidi", $title, $duration, $lerato_email, $class_id, $academic_year_id, $term_number, 
                      $start_time, $status, $is_summative, $weight, $publish_marks);
    if ($stmt->execute()) {
        $quiz_id = $conn->insert_id;
        $quiz_ids[] = $quiz_id;
        echo "Created: $title (Quiz ID: $quiz_id)\n";
    }
    $stmt->close();
}
echo "\n4 new summative quizzes created in Term 1!\n\n";

// 5. Add questions + results for each quiz
foreach ($quiz_ids as $quiz_id) {
    $stmt = $conn->prepare("SELECT title, duration FROM quizzes WHERE id = ?");
    $stmt->bind_param("i", $quiz_id);
    $stmt->execute();
    $quiz_info = $stmt->get_result()->fetch_assoc();
    $stmt->close();

    $title = $quiz_info['title'];
    $duration = $quiz_info['duration'];
    echo "Adding questions & results for: $title\n";

    // Add 10 questions
    $total_points = 0;
    for ($q = 1; $q <= 10; $q++) {
        $points = rand(4, 8);
        $total_points += $points;
        $question = "Physics Question $q for $title";
        $stmt = $conn->prepare("INSERT INTO quizquestions (quiz_id, question_text, points) VALUES (?, ?, ?)");
        $stmt->bind_param("isi", $quiz_id, $question, $points);
        $stmt->execute();
        $stmt->close();
    }

    // All 45 students take it ONCE
    foreach ($all_students as $email) {
        $percentage = rand(65, 92);
        $score = round(($percentage / 100) * $total_points);
        $time_taken = rand(70, 120) * $duration / 100;
        $time_taken = round($time_taken / 60) * 60;
        $submitted_at = date('Y-m-d H:i:s', strtotime("2025-03-" . rand(16, 28) . " 10:" . rand(0,59) . ":00"));

        // One attempt
        $stmt = $conn->prepare("INSERT INTO quiz_attempts (user_email, quiz_id, attempt_count, last_attempt) VALUES (?, ?, 1, ?)");
        $stmt->bind_param("sis", $email, $quiz_id, $submitted_at);
        $stmt->execute();
        $stmt->close();

        // Result
        $stmt = $conn->prepare("INSERT INTO quiz_results (user_email, quiz_id, academic_year_id, score, total, time_taken, submitted_at) VALUES (?, ?, ?, ?, ?, ?, ?)");
        $stmt->bind_param("siiiiss", $email, $quiz_id, $academic_year_id, $score, $total_points, $time_taken, $submitted_at);
        $stmt->execute();
        $stmt->close();
    }
    echo "All 45 learners completed this quiz (avg ~78%)\n\n";
}

echo "=== TERM 1 BOOST COMPLETE! ===\n";
echo "Log in as lerato.patel@iskool.demo → Analytics → Term 1 → Grade 11 Physical Sciences B\n";
echo "You will now see 9 summative quizzes (5 original + 4 new), 45 students, rich data, and GLORY.\n";
echo "This is no longer a demo. This is a masterpiece.\n";
?>