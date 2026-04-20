<?php
session_start();
include("config.php");

if (!isset($_SESSION['email']) || $_SESSION['role'] !== 'teacher') {
    die("Access denied.");
}

$teacher_email = $_SESSION['email'];
$class_id = $_GET['class_id'] ?? 0;
$class_id = intval($class_id);

if ($class_id <= 0) {
    die("Invalid class_id. Add ?class_id=5 to URL");
}

echo "<h2>DEBUG: Analytics Data for Class ID = $class_id</h2>";
echo "<p><strong>Teacher:</strong> $teacher_email</p>";
echo "<hr>";

// 1. QUIZZES
echo "<h3>1. Quizzes (Summative + Published)</h3>";
$sql = "SELECT id, title, is_summative, publish_marks, start_time FROM quizzes WHERE class_id = ? AND created_by = ?";
$stmt = $conn->prepare($sql);
$stmt->bind_param("is", $class_id, $teacher_email);
$stmt->execute();
$result = $stmt->get_result();

if ($result->num_rows === 0) {
    echo "<p style='color: orange;'>No quizzes found.</p>";
} else {
    echo "<table border='1' cellpadding='8' cellspacing='0' style='font-family: Arial;'><tr><th>ID</th><th>Title</th><th>Summative</th><th>Published</th><th>Start Time</th></tr>";
    while ($row = $result->fetch_assoc()) {
        $summative = $row['is_summative'] ? 'Yes' : 'No';
        $published = $row['publish_marks'] ? 'Yes' : 'No';
        $start = $row['start_time'] ?: 'NULL';
        echo "<tr><td>{$row['id']}</td><td>{$row['title']}</td><td>$summative</td><td>$published</td><td>$start</td></tr>";
    }
    echo "</table>";
}
$stmt->close();
echo "<hr>";

// 2. RESULTS
echo "<h3>2. Quiz Results</h3>";
$sql = "SELECT r.quiz_id, r.user_email, r.score, r.total FROM quiz_results r JOIN quizzes q ON r.quiz_id = q.id WHERE q.class_id = ? AND q.created_by = ?";
$stmt = $conn->prepare($sql);
$stmt->bind_param("is", $class_id, $teacher_email);
$stmt->execute();
$result = $stmt->get_result();

if ($result->num_rows === 0) {
    echo "<p style='color: red;'>No results found.</p>";
} else {
    echo "<table border='1' cellpadding='8' cellspacing='0'><tr><th>Quiz ID</th><th>Student Email</th><th>Score</th><th>Total</th></tr>";
    while ($row = $result->fetch_assoc()) {
        echo "<tr><td>{$row['quiz_id']}</td><td>{$row['user_email']}</td><td>{$row['score']}</td><td>{$row['total']}</td></tr>";
    }
    echo "</table>";
}
$stmt->close();
echo "<hr>";

// 3. STUDENTS IN CLASS
echo "<h3>3. Students in Class</h3>";
$sql = "SELECT cs.student_email, u.name, u.surname, u.gender FROM class_students cs JOIN users u ON cs.student_email = u.email WHERE cs.class_id = ? AND u.role = 'user'";
$stmt = $conn->prepare($sql);
$stmt->bind_param("i", $class_id);
$stmt->execute();
$result = $stmt->get_result();

if ($result->num_rows === 0) {
    echo "<p style='color: red;'>No students enrolled.</p>";
} else {
    echo "<table border='1' cellpadding='8' cellspacing='0'><tr><th>Email</th><th>Name</th><th>Gender</th></tr>";
    while ($row = $result->fetch_assoc()) {
        $name = trim($row['name'] . ' ' . $row['surname']);
        echo "<tr><td>{$row['student_email']}</td><td>$name</td><td>{$row['gender']}</td></tr>";
    }
    echo "</table>";
}
$stmt->close();
echo "<hr>";

// 4. FINAL JSON (Safe include)
echo "<h3>4. Final JSON Output (Safe)</h3>";
echo "<pre style='background: #f4f4f4; padding: 10px; border: 1px solid #ccc;'>";

// Capture output
ob_start();
include("get_analytics_data.php");
$json_output = ob_get_clean();
echo htmlspecialchars($json_output);
echo "</pre>";

echo "<p><a href='teacher_analytics.php'>Back to Analytics</a></p>";
?>