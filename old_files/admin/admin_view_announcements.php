<?php
session_start();
require_once 'config.php';

if (!isset($_SESSION['school_admin'])) {
    header("Location: index.php");
    exit();
}

// Clean up old session key if exists
unset($_SESSION['school_id']);

$targetRoleFilter = $_GET['target_role'] ?? '';

// Build WHERE clause — NO school_id needed
$whereClauses = [];
$params = [];
$types = "";

if ($targetRoleFilter && in_array($targetRoleFilter, ['all', 'teachers', 'learners'])) {
    $whereClauses[] = "a.target_role = ?";
    $params[] = $targetRoleFilter;
    $types .= 's';
}

$whereSql = !empty($whereClauses) ? "WHERE " . implode(" AND ", $whereClauses) : "";

// Fetch announcements (current DB = current school)
$sql = "
    SELECT 
        a.id, a.title, a.message, a.created_at, a.created_by, 
        a.class_id, a.target_role, u.name AS creator_name
    FROM announcements a
    JOIN users u ON a.created_by = u.email
    $whereSql
    ORDER BY a.created_at DESC
";

$stmt = $conn->prepare($sql);
if (!empty($params)) {
    $stmt->bind_param($types, ...$params);
}
$stmt->execute();
$result = $stmt->get_result();

// Fetch class names for display (current school only)
$classNames = [];
$classResult = $conn->query("SELECT id, name FROM classes");
while ($row = $classResult->fetch_assoc()) {
    $classNames[$row['id']] = $row['name'];
}
?>

<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1">

<title>View Announcements</title>
<style>
  body { font-family: Arial, sans-serif; background: #0d1117; color: #e0e6f0; padding: 20px; }
  table { width: 100%; border-collapse: collapse; margin-top: 20px; }
  th, td { padding: 12px 10px; border-bottom: 1px solid #444; text-align: left; }
  th { background: #161b22; color: #2980b9; }
  tr:hover { background: #222831; }
  select { padding: 8px; border-radius: 5px; border: none; background: #161b22; color: #e0e6f0; }
  h1 { color: #2980b9; }
  .no-data { margin-top: 20px; color: #888; }
  a { color: #2980b9; text-decoration: none; }
  a:hover { text-decoration: underline; }
</style>
</head>
<body>

<h1>View Announcements</h1>

<form method="GET">
  <label for="target_role">Filter by Role:</label>
  <select id="target_role" name="target_role" onchange="this.form.submit()">
    <option value="" <?= $targetRoleFilter === '' ? 'selected' : '' ?>>All</option>
    <option value="all" <?= $targetRoleFilter === 'all' ? 'selected' : '' ?>>All Users</option>
    <option value="teachers" <?= $targetRoleFilter === 'teachers' ? 'selected' : '' ?>>Teachers</option>
    <option value="learners" <?= $targetRoleFilter === 'learners' ? 'selected' : '' ?>>Learners</option>
  </select>
</form>

<?php if ($result->num_rows > 0): ?>
  <table>
    <thead>
      <tr>
        <th>Title</th>
        <th>Message</th>
        <th>Class</th>
        <th>Target Role</th>
        <th>Created By</th>
        <th>Created At</th>
      </tr>
    </thead>
    <tbody>
      <?php while ($row = $result->fetch_assoc()): ?>
      <tr>
        <td><?= htmlspecialchars($row['title']) ?></td>
        <td><?= nl2br(htmlspecialchars($row['message'])) ?></td>
        <td><?= isset($classNames[$row['class_id']]) ? htmlspecialchars($classNames[$row['class_id']]) : 'All Classes' ?></td>
        <td><?= ucfirst($row['target_role']) ?></td>
        <td><?= htmlspecialchars($row['creator_name'] ?: $row['created_by']) ?></td>
        <td><?= htmlspecialchars($row['created_at']) ?></td>
      </tr>
      <?php endwhile; ?>
    </tbody>
  </table>
<?php else: ?>
  <p class="no-data">No announcements found.</p>
<?php endif; ?>

<a href="admin_announcements.php" style="color:#2980b9;">➕ Create New Announcement</a>

</body>
</html>
