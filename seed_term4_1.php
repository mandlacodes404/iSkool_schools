<?php
require_once 'config.php';

echo "<pre>";
echo "=== Adding 3 Additional Term 4 Summative Quizzes Per Teacher (25% each) ===\n";
echo "Current: 1 quiz per teacher → After this: 4 quizzes per teacher = 100% total weight\n";
echo "Current date: December 14, 2025\n\n";

$academic_year_id = 1; // 2025

// Step 1: Get Grade 10 Mathematics A class
$stmt = $conn->prepare("SELECT id FROM classes WHERE name = '10A'");
$stmt->execute();
$result = $stmt->get_result();
if (!$row = $result->fetch_assoc()) {
    die("ERROR: Class 'Grade 10 Mathematics A' not found!\n");
}
$class_id = $row['id'];
echo "Found class: Grade 10 Mathematics A (ID: $class_id)\n";
$stmt->close();

// Step 2: Get the 4 existing teachers
$stmt = $conn->query("SELECT email FROM users WHERE role = 'teacher' ORDER BY id ASC LIMIT 4");
$teachers = [];
while ($row = $stmt->fetch_assoc()) {
    $teachers[] = $row['email'];
}
if (count($teachers) < 4) {
    die("ERROR: Only found " . count($teachers) . " teachers.\n");
}
echo "Using teachers (in order):\n";
foreach ($teachers as $i => $email) {
    echo "  " . ($i+1) . ". $email\n";
}
echo "\n";

// Step 3: 3 new quiz topics
$new_topics = [
    "Analytical Geometry Summative Assessment",
    "Functions and Graphs Summative Assessment",
    "Euclidean Geometry Summative Assessment"
];

$added = 0;
foreach ($teachers as $t_idx => $teacher_email) {
    echo "Adding 3 quizzes for teacher: $teacher_email\n";

    foreach ($new_topics as $topic_idx => $topic) {
        $title = "Term 4: $topic";

        // Prevent duplicates
        $check = $conn->prepare("SELECT id FROM quizzes WHERE title = ? AND created_by = ? AND class_id = ? AND academic_year_id = ?");
        $check->bind_param("ssii", $title, $teacher_email, $class_id, $academic_year_id);
        $check->execute();
        $check->store_result();
        if ($check->num_rows > 0) {
            echo "  Already exists: $title (by this teacher) → Skipped\n";
            $check->close();
            continue;
        }
        $check->close();

        // Random date in October/November 2025
        $month = in_array($t_idx, [0,1]) ? 10 : 11;
        $day = rand(9, 24);
        $start_time = sprintf("2025-%02d-%02d 09:00:00", $month, $day);

        $duration = rand(80, 100);
        $status = 'Closed';
        $term_number = 4;
        $is_summative = 1;
        $weight = 25.00; // 25% each

        $stmt = $conn->prepare("
            INSERT INTO quizzes 
            (title, duration, created_by, class_id, academic_year_id, term_number, start_time, status, is_summative, weight_percent, publish_marks)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
        ");
        $stmt->bind_param("sisiiissid", $title, $duration, $teacher_email, $class_id, $academic_year_id, $term_number, $start_time, $status, $is_summative, $weight);

        if ($stmt->execute()) {
            echo "  Added: $title (25%) → Date: " . date('M d, Y', strtotime($start_time)) . "\n";
            $added++;
        } else {
            echo "  Failed to add: $title\n";
        }
        $stmt->close();
    }
    echo "\n";
}

echo "=== DONE ===\n";
echo "Added $added new Term 4 summative quizzes.\n";
echo "Each teacher now has 4 quizzes × 25% = 100% total weight in Term 4!\n";
echo "Next: Run seed_term4_additional_results.php\n";
?>