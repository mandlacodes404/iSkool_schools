<?php
session_start();
require_once 'config.php';

// Only allow school admins
if (!isset($_SESSION['school_admin'])) {
    header("Location: index.php");
    exit();
}

// Handle restoration if form is submitted
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['user_id'])) {
    $userId = intval($_POST['user_id']);

    $stmt = $conn->prepare("UPDATE users SET is_deleted = 0 WHERE id = ? AND role = 'teacher'");
    $stmt->bind_param("i", $userId);
    if ($stmt->execute()) {
        $_SESSION['success_message'] = "Teacher restored successfully.";
    } else {
        $_SESSION['error_message'] = "Failed to restore teacher.";
    }
    $stmt->close();

    header("Location: restore_deleted_teachers.php");
    exit();
}

// Fetch deleted teachers (no school_id filter needed anymore)
$stmt = $conn->prepare("SELECT id, name FROM users WHERE role = 'teacher' AND is_deleted = 1 ORDER BY name ASC");
$stmt->execute();
$result = $stmt->get_result();
?>

<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Restore Deleted Teachers</title>
  <style>
    body { font-family: Arial, sans-serif; background: #0d1117; color: #e0e6f0; padding: 30px; }
    h1 { color: #2980b9; }
    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
    th, td { padding: 12px; border-bottom: 1px solid #444; }
    th { background-color: #161b22; }
    tr:hover { background: #222831; }
    button { background: #27ae60; color: white; border: none; padding: 6px 12px; border-radius: 5px; cursor: pointer; }
    button:hover { background: #1e8449; }
    .message { margin-bottom: 20px; padding: 10px 15px; border-radius: 5px; }
    .success { background: #27ae60; color: white; }
    .error { background: #c0392b; color: white; }
  </style>
</head>
<body>

<h1>Restore Deleted Teachers</h1>

<?php if (isset($_SESSION['success_message'])): ?>
  <div class="message success"><?= $_SESSION['success_message'] ?></div>
  <?php unset($_SESSION['success_message']); ?>
<?php elseif (isset($_SESSION['error_message'])): ?>
  <div class="message error"><?= $_SESSION['error_message'] ?></div>
  <?php unset($_SESSION['error_message']); ?>
<?php endif; ?>

<table>
  <thead>
    <tr>
      <th>Teacher Name</th>
      <th>Action</th>
    </tr>
  </thead>
  <tbody>
    <?php if ($result->num_rows > 0): ?>
      <?php while ($row = $result->fetch_assoc()): ?>
        <tr>
          <td><?= htmlspecialchars($row['name']) ?></td>
          <td>
            <form method="post" action="" onsubmit="return confirm('Restore this teacher?');">
              <input type="hidden" name="user_id" value="<?= $row['id'] ?>" />
              <button type="submit">Restore</button>
            </form>
          </td>
        </tr>
      <?php endwhile; ?>
    <?php else: ?>
      <tr><td colspan="2">No deleted teachers found.</td></tr>
    <?php endif; ?>
  </tbody>
</table>

</body>
</html>