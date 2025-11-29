<?php
session_start();
include("config.php");

// Check if user is logged in and is a school admin
if (!isset($_SESSION['school_admin']) || $_SESSION['role'] !== 'school_admin') {
    header("Location: index.php");
    exit();
}

$school_id = $_SESSION['school_id'];
$success = "";
$error = "";

// Handle form submission
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $teacher_id = $_POST['teacher_id'];
    $class_id = $_POST['class_id'];
    $subject = trim($_POST['subject']);
    $description = trim($_POST['description']);

    // Simple input validation (you can add more)
    if (empty($teacher_id) || empty($class_id) || empty($subject) || empty($description)) {
        $error = "All fields are required.";
    } else {
        $stmt = $conn->prepare("INSERT INTO teacher_evaluations (school_id, teacher_id, class_id, subject, description, released) VALUES (?, ?, ?, ?, ?, 1)");
        $stmt->bind_param("iiiss", $school_id, $teacher_id, $class_id, $subject, $description);

        if ($stmt->execute()) {
            $success = "Teacher evaluation released successfully!";
        } else {
            $error = "Failed to release evaluation. Please try again.";
        }

        $stmt->close();
    }
}

// Fetch teachers and classes from the same school
$teachers = $conn->query("SELECT id, name FROM users WHERE role = 'teacher' AND school_id = $school_id");
$classes = $conn->query("SELECT id, name FROM classes WHERE school_id = $school_id");
?>

<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Release Teacher Evaluation</title>
    <link rel="stylesheet" href="styles.css" /> <!-- your dark theme CSS -->
    <style>
        body.dark {
            background-color: #0d1117;
            color: #e0e6f0;
            font-family: Arial, sans-serif;
            padding: 30px;
        }
        .container {
            max-width: 600px;
            margin: 0 auto;
            background: rgba(22, 27, 34, 0.85);
            border-radius: 15px;
            padding: 25px;
            box-shadow: 0 8px 32px rgba(0, 191, 255, 0.3);
        }
        label {
            display: block;
            margin-top: 15px;
            margin-bottom: 6px;
            font-weight: 600;
        }
        select, input[type="text"], textarea {
            width: 100%;
            padding: 10px;
            border-radius: 8px;
            border: none;
            background: #161b22;
            color: #e0e6f0;
            font-size: 14px;
            resize: vertical;
        }
        button {
            margin-top: 20px;
            background-color: #00aaff;
            border: none;
            padding: 12px 20px;
            border-radius: 12px;
            color: white;
            font-weight: bold;
            font-size: 16px;
            cursor: pointer;
            box-shadow: 0 4px 15px rgba(0, 170, 255, 0.5);
            transition: background-color 0.3s ease;
        }
        button:hover {
            background-color: #008fcc;
        }
        p.success {
            color: #4caf50;
            font-weight: bold;
            margin-top: 0;
        }
        p.error {
            color: #e74c3c;
            font-weight: bold;
            margin-top: 0;
        }
    </style>
</head>
<body class="dark">

<div class="container">
    <h2>📋 Release Teacher Evaluation</h2>

    <?php if ($success): ?>
        <p class="success"><?= htmlspecialchars($success) ?></p>
    <?php elseif ($error): ?>
        <p class="error"><?= htmlspecialchars($error) ?></p>
    <?php endif; ?>

    <form method="POST" action="">
        <label for="teacher_id">Select Teacher:</label>
        <select name="teacher_id" id="teacher_id" required>
            <option value="">-- Choose --</option>
            <?php while ($row = $teachers->fetch_assoc()): ?>
                <option value="<?= (int)$row['id'] ?>"><?= htmlspecialchars($row['name']) ?></option>
            <?php endwhile; ?>
        </select>

        <label for="class_id">Select Class:</label>
        <select name="class_id" id="class_id" required>
            <option value="">-- Choose --</option>
            <?php while ($row = $classes->fetch_assoc()): ?>
                <option value="<?= (int)$row['id'] ?>"><?= htmlspecialchars($row['name']) ?></option>
            <?php endwhile; ?>
        </select>

        <label for="subject">Subject:</label>
        <input type="text" name="subject" id="subject" required />

        <label for="description">Evaluation Description:</label>
        <textarea name="description" id="description" rows="5" required></textarea>

        <button type="submit">✅ Release Evaluation</button>
    </form>
</div>

</body>
</html>
