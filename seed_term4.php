<?php
require_once 'config.php';

echo "<pre>";
echo "=== Adding 4 Term 4 Summative Quizzes (2025) ===\n";
echo "Date: December 14, 2025\n";
echo "Using existing class and teachers only.\n\n";

$academic_year_id = 1;  // 2025 is current

// Step 1: Find the existing Grade 10 Mathematics A class by name
$stmt = $conn->prepare("SELECT id FROM classes WHERE name = '10A'");
$stmt->execute();
$result = $stmt->get_result();

if ($result->num_rows === 0) {
    die("ERROR: Class 'Grade 10 Mathematics A' not found! Please check the name exactly.\n");
}

$row = $result->fetch_assoc();
$class_id = $row['id'];
echo "Found existing class: Grade 10 Mathematics A (ID: $class_id)\n";
$stmt->close();

// Step 2: Get first 4 teachers (ordered by creation)
$stmt = $conn->query("SELECT email FROM users WHERE role = 'teacher' ORDER BY id ASC LIMIT 4");
$teacher_emails = [];
while ($row = $stmt->fetch_assoc()) {
    $teacher_emails[] = $row['email'];
}

if (count($teacher_emails) < 4) {
    die("ERROR: Only found " . count($teacher_emails) . " teachers. Need at least 4.\n");
}

echo "Using these 4 existing teachers:\n";
foreach ($teacher_emails as $i => $email) {
    echo "  " . ($i+1) . ". $email\n";
}
echo "\n";

// Step 3: Define the 4 Term 4 summative quizzes
$quizzes = [
    ['Term 4: Trigonometry Summative Assessment',          90, $teacher_emails[0]],
    ['Term 4: Statistics & Data Handling Summative',       90, $teacher_emails[1]],
    ['Term 4: Probability Summative Assessment',           90, $teacher_emails[2]],
    ['Term 4: Financial Mathematics Summative',            90, $teacher_emails[3]],
];

$added = 0;
foreach ($quizzes as $q) {
    [$title, $duration, $created_by] = $q;

    // Prevent duplicates
    $check = $conn->prepare("SELECT id FROM quizzes WHERE title = ? AND class_id = ? AND academic_year_id = ?");
    $check->bind_param("sii", $title, $class_id, $academic_year_id);
    $check->execute();
    $check->store_result();
    if ($check->num_rows > 0) {
        echo "Already exists: $title → Skipped\n";
        $check->close();
        continue;
    }
    $check->close();

    // Random October date (2025)
    $day = rand(8, 22);
    $start_time = sprintf("2025-10-%02d 09:00:00", $day);
    $status = 'Closed';
    $term_number = 4;
    $is_summative = 1;
    $weight = 25.00;

    $stmt = $conn->prepare("
        INSERT INTO quizzes 
        (title, duration, created_by, class_id, academic_year_id, term_number, start_time, status, is_summative, weight_percent, publish_marks)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    ");
    $stmt->bind_param("sisiiissid", $title, $duration, $created_by, $class_id, $academic_year_id, $term_number, $start_time, $status, $is_summative, $weight);

    if ($stmt->execute()) {
        echo "Added: $title (by $created_by) → Oct $day, 2025\n";
        $added++;
    } else {
        echo "Failed: $title\n";
    }
    $stmt->close();
}

echo "\n=== DONE ===\n";
echo "Added $added new Term 4 summative quizzes (25% each).\n";
echo "Next: Run seed_term4_results.php\n";
?>