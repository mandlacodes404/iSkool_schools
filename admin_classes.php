<?php
session_start();
require_once 'config.php';

// Ensure only admins can access
if (!isset($_SESSION['email']) || $_SESSION['role'] !== 'admin') {
    header("Location: index.php");
    exit();
}

$adminEmail = $_SESSION['email'];

// Clean up old session key
unset($_SESSION['school_id']);

// Handle deletion of class
if (isset($_GET['delete']) && is_numeric($_GET['delete'])) {
    $deleteId = intval($_GET['delete']);
    
    // No school_id check needed — current DB = current school
    $stmt = $conn->prepare("DELETE FROM classes WHERE id = ?");
    $stmt->bind_param("i", $deleteId);
    $stmt->execute();
    $stmt->close();
    
    header("Location: admin_classes.php");
    exit();
}

// Handle class creation form
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['class_name'])) {
    $className = trim($_POST['class_name']);
    if (!empty($className)) {
        $subject = 'General';  // default subject
        $createdBy = $adminEmail;

        // Check duplicate class name (current school only)
        $check = $conn->prepare("SELECT id FROM classes WHERE name = ?");
        $check->bind_param("s", $className);
        $check->execute();
        $check->store_result();

        if ($check->num_rows === 0) {
            $stmt = $conn->prepare("INSERT INTO classes (name, subject, created_by) VALUES (?, ?, ?)");
            $stmt->bind_param("sss", $className, $subject, $createdBy);
            $stmt->execute();
            $stmt->close();
        }
        $check->close();
    }
    header("Location: admin_classes.php");
    exit();
}

// Fetch all classes for current school (current DB = current school)
$result = $conn->query("SELECT * FROM classes ORDER BY name ASC");
$classes = $result;
?>

<!DOCTYPE html>
<html>
<head>

    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Manage Classes</title>
    <style>
        /* Your existing styles here */
        body {
            font-family: Arial, sans-serif;
            background: #f4f6f8;
            padding: 30px;
        }
        h1 {
            color: #2c3e50;
        }
        form {
            margin-bottom: 30px;
        }
        input[type="text"] {
            padding: 8px;
            width: 250px;
            border-radius: 5px;
            border: 1px solid #ccc;
        }
        button {
            padding: 8px 16px;
            background: #27ae60;
            color: white;
            border: none;
            border-radius: 5px;
            margin-left: 10px;
            cursor: pointer;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            background: white;
        }
        th, td {
            padding: 12px;
            border-bottom: 1px solid #ddd;
            text-align: left;
        }
        th {
            background: #2980b9;
            color: white;
        }
        a.delete {
            color: red;
            text-decoration: none;
            font-weight: bold;
        }
        a.delete:hover {
            text-decoration: underline;
        }
        /* Dropdown for school selection */
        #school-select {
            margin-bottom: 20px;
        }
    </style>
</head>
<body>

<h1>Manage Classes</h1>

<!-- SCHOOL DROPDOWN COMPLETELY REMOVED — NO MORE SUPER ADMIN SWITCHING -->

<form method="POST">
    <input type="text" name="class_name" placeholder="Enter class name (e.g. 11A)" required>
    <button type="submit">Add Class</button>
</form>

<table>
    <thead>
        <tr>
            <th>Class Name</th>
            <th>Created By</th>
            <th>Action</th>
        </tr>
    </thead>
    <tbody>
        <?php while ($row = $classes->fetch_assoc()): ?>
            <tr>
                <td><?= htmlspecialchars($row['name']) ?></td>
                <td><?= htmlspecialchars($row['created_by']) ?></td>
                <td>
                    <!-- CLEAN DELETE LINK — NO school_id IN URL ANYMORE -->
                    <a class="delete" href="admin_classes.php?delete=<?= $row['id'] ?>" 
                       onclick="return confirm('Are you sure you want to delete this class?');">
                        Delete
                    </a>
                </td>
            </tr>
        <?php endwhile; ?>
    </tbody>
</table>

</body>
</html>
