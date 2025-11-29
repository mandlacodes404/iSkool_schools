<?php
session_start();
include("config.php");

if (!isset($_SESSION['email']) || $_SESSION['role'] !== 'teacher') {
    header("Location: index.php");
    exit();
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $name = $_POST['name'];
    $subject = $_POST['subject'];
    $created_by = $_SESSION['email'];

    $stmt = $conn->prepare("INSERT INTO classes (name, subject, created_by) VALUES (?, ?, ?)");
    $stmt->bind_param("sss", $name, $subject, $created_by);
    $stmt->execute();

    header("Location: teacher_dashboard.php");
    exit();
}
?>

<form method="POST">
    <label>Class Name:</label>
    <input type="text" name="name" required>

    <label>Subject:</label>
    <input type="text" name="subject" required>

    <button type="submit">Create Class</button>
</form>
