<?php
session_start();
require_once 'config.php';

if (!isset($_SESSION['school_admin'])) {
    header("Location: index.php");
    exit();
}

$schoolId = $_SESSION['school_id'];

$sql = "
SELECT users.id, users.name, classes.name AS class_name
FROM users
LEFT JOIN class_students ON users.email = class_students.student_email
LEFT JOIN classes ON class_students.class_id = classes.id
WHERE users.school_id = ? AND users.role = 'user' AND users.is_deleted = 1
ORDER BY users.name ASC
";

$stmt = $conn->prepare($sql);
$stmt->bind_param("i", $schoolId);
$stmt->execute();
$result = $stmt->get_result();
?>

<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Deleted Learners</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 30px; background: #0d1117; color: #e0e6f0; }
    table { border-collapse: collapse; width: 100%; margin-top: 20px; }
    th, td { padding: 12px 15px; border-bottom: 1px solid #444; }
    th { background: #161b22; color: #2980b9; }
    tr:hover { background: #222831; }
    button { padding: 6px 12px; background: #27ae60; color: white; border: none; border-radius: 5px; cursor: pointer; }
    button:hover { background: #1e8449; }
  </style>
</head>
<body>

<h1>Restore Learners</h1>

<table>
  <thead>
    <tr>
      <th>Name</th>
      <th>Class</th>
      <th>Action</th>
    </tr>
  </thead>
  <tbody>
    <?php if ($result->num_rows > 0): ?>
      <?php while ($row = $result->fetch_assoc()): ?>
        <tr>
          <td><?= htmlspecialchars($row['name']) ?></td>
          <td><?= htmlspecialchars($row['class_name'] ?: 'Unassigned') ?></td>
          <td>
            <form method="post" action="restore_learner.php" style="display:inline;">
              <input type="hidden" name="user_id" value="<?= $row['id'] ?>" />
              <button type="submit">Restore</button>
            </form>
          </td>
        </tr>
      <?php endwhile; ?>
    <?php else: ?>
      <tr><td colspan="3">No deleted learners.</td></tr>
    <?php endif; ?>
  </tbody>
</table>

</body>
</html>
