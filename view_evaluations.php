<?php
session_start();
include("config.php");

// Check admin login and role
if (!isset($_SESSION['school_admin']) || $_SESSION['role'] !== 'school_admin') {
    header("Location: index.php");
    exit();
}

$school_id = $_SESSION['school_id'];

// Fetch evaluations with counts of responses from the correct table
$sql = "
    SELECT te.id, te.subject, te.description, te.class_id, te.teacher_id, te.created_at,
           u.name AS teacher_name, c.name AS class_name,
           (SELECT COUNT(*) FROM teacher_evaluation_responses er WHERE er.evaluation_id = te.id) AS response_count
    FROM teacher_evaluations te
    JOIN users u ON u.id = te.teacher_id
    JOIN classes c ON c.id = te.class_id
    WHERE te.school_id = ? AND te.released = 1
    ORDER BY te.created_at DESC
";

$stmt = $conn->prepare($sql);
$stmt->bind_param("i", $school_id);
$stmt->execute();
$result = $stmt->get_result();
?>

<!DOCTYPE html>
<html lang="en">
<head>
    <title>View Teacher Evaluations</title>
    <style>
        body {
            background-color: #0d1117;
            color: #e0e6f0;
            font-family: Arial, sans-serif;
            padding: 30px;
        }
        table {
            width: 90%;
            margin: 0 auto;
            border-collapse: collapse;
            background-color: #161b22;
            box-shadow: 0 0 20px rgba(0,191,255,0.25);
            border-radius: 10px;
            overflow: hidden;
        }
        th, td {
            padding: 12px 16px;
            border-bottom: 1px solid #22272e;
            text-align: left;
        }
        th {
            background-color: white;
            color: black;
        }
        tr:hover {
            background-color: #22354a;
        }
        a.view-link {
            color: #00aaff;
            text-decoration: none;
            font-weight: bold;
        }
        a.view-link:hover {
            text-decoration: underline;
        }

      
    </style>
</head>
<body>

<h2 style="text-align:center;">Released Teacher Evaluations</h2>

<table>
    <thead>
        <tr>
            <th>Teacher</th>
            <th>Class</th>
            <th>Subject</th>
            <th>Description</th>
            <th>Responses</th>
            <th>Released On</th>
            <th>Action</th>
        </tr>
    </thead>
    <tbody>
    <?php if ($result->num_rows > 0): ?>
        <?php while ($row = $result->fetch_assoc()): ?>
        <tr>
            <td><?= htmlspecialchars($row['teacher_name']) ?></td>
            <td><?= htmlspecialchars($row['class_name']) ?></td>
            <td><?= htmlspecialchars($row['subject']) ?></td>
            <td><?= htmlspecialchars($row['description']) ?></td>
            <td><?= (int)$row['response_count'] ?></td>
            <td><?= htmlspecialchars(date('Y-m-d', strtotime($row['created_at']))) ?></td>
            <td><a class="view-link" href="view_evaluation_details.php?id=<?= $row['id'] ?>">View Details</a></td>
        </tr>
        <?php endwhile; ?>
    <?php else: ?>
        <tr><td colspan="7" style="text-align:center;">No evaluations found.</td></tr>
    <?php endif; ?>
    </tbody>
</table>


</body>
</html>
