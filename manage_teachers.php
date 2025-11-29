<?php
session_start();
require_once 'config.php';

// Check school admin login
if (!isset($_SESSION['school_admin'])) {
    header("Location: index.php");
    exit();
}

$schoolId = $_SESSION['school_id'];

// Search query for teacher name
$searchName = trim($_GET['search_name'] ?? '');

// Pagination setup
$page = max(1, intval($_GET['page'] ?? 1));
$limit = 20;
$offset = ($page - 1) * $limit;

// Build WHERE conditions and params dynamically
$whereClauses = ["school_id = ?", "role = 'teacher'", "is_deleted = 0"];
$params = [$schoolId];
$types = "i";

if ($searchName !== '') {
    $whereClauses[] = "name LIKE CONCAT('%', ?, '%')";
    $params[] = $searchName;
    $types .= "s";
}

$whereSql = implode(" AND ", $whereClauses);

// Count total teachers for pagination
$countSql = "SELECT COUNT(*) FROM users WHERE $whereSql";
$stmtCount = $conn->prepare($countSql);
$stmtCount->bind_param($types, ...$params);
$stmtCount->execute();
$stmtCount->bind_result($totalTeachers);
$stmtCount->fetch();
$stmtCount->close();

$totalPages = ceil($totalTeachers / $limit);

// Add limit and offset params for main query
$params[] = $limit;
$params[] = $offset;
$types .= "ii";

// Get teachers
$sql = "
SELECT id, name
FROM users
WHERE $whereSql
ORDER BY name ASC
LIMIT ? OFFSET ?
";

$stmt = $conn->prepare($sql);
$stmt->bind_param($types, ...$params);
$stmt->execute();
$result = $stmt->get_result();
?>

<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1">
<title>Manage Teachers</title>
<style>
  body { font-family: Arial, sans-serif; padding: 30px; background: #0d1117; color: #e0e6f0; }
  table { border-collapse: collapse; width: 100%; margin-top: 20px; }
  th, td { padding: 12px 15px; border-bottom: 1px solid #444; }
  th { background: #161b22; color: #2980b9; }
  tr:hover { background: #222831; }
  input[type="text"] { padding: 8px; border-radius: 5px; border: none; width: 300px; margin-right: 10px; }
  button { padding: 8px 14px; background: #2980b9; color: white; border: none; border-radius: 5px; cursor: pointer; }
  button:hover { background: #1c5980; }
  .pagination { margin-top: 20px; }
  .pagination a {
    margin: 0 5px;
    padding: 6px 12px;
    background: #161b22;
    color: #2980b9;
    text-decoration: none;
    border-radius: 5px;
  }
  .pagination a.active {
    background: #2980b9;
    color: white;
  }
</style>
</head>
<body>

<h1>Manage Teachers</h1>

<form method="get" action="">
  <input type="text" name="search_name" placeholder="Search teachers by name" value="<?= htmlspecialchars($searchName) ?>" />
  <button type="submit">Search</button>
</form>

<table>
  <thead>
    <tr>
      <th>Name</th>
      <th>Action</th>
    </tr>
  </thead>

  <tbody>
<?php if ($result->num_rows > 0): ?>
  <?php while ($row = $result->fetch_assoc()): ?>
    <tr>
      <td><?= htmlspecialchars($row['name']) ?></td>
      <td>
        <form method="post" action="delete_teacher.php" onsubmit="return confirm('Are you sure you want to remove this teacher?');" style="display:inline;">
          <input type="hidden" name="user_id" value="<?= $row['id'] ?>" />
          <button type="submit" style="background:#e74c3c; color:white; border:none; padding:6px 10px; border-radius:5px;">Remove</button>
        </form>
      </td>
    </tr>
  <?php endwhile; ?>
<?php else: ?>
  <tr><td colspan="2">No teachers found.</td></tr>
<?php endif; ?>
  </tbody>
</table>

<div class="pagination">
<?php
$baseUrlParams = http_build_query(['search_name' => $searchName]);
for ($p = 1; $p <= $totalPages; $p++):
  $active = $p === $page ? 'active' : '';
  $url = "?page=$p&$baseUrlParams";
?>
  <a href="<?= $url ?>" class="<?= $active ?>"><?= $p ?></a>
<?php endfor; ?>
</div>


<a href="restore_deleted_teachers.php" style="color:#2980b9;">View Deleted Teachers</a>

</body>
</html>
