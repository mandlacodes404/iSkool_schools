<?php
session_start();
require_once 'config.php';

// Check school admin login
if (!isset($_SESSION['school_admin'])) {
    header("Location: index.php");
    exit();
}

$schoolId = $_SESSION['school_id'];

// Search queries for learner name and class name
$searchName = trim($_GET['search_name'] ?? '');
$searchClass = trim($_GET['search_class'] ?? '');

// Pagination setup
$page = max(1, intval($_GET['page'] ?? 1));
$limit = 20;
$offset = ($page - 1) * $limit;

// Build WHERE conditions and params dynamically
$whereClauses = ["users.school_id = ?", "users.role = 'user'"];
$params = [$schoolId];
$types = "i";

if ($searchName !== '') {
    $whereClauses[] = "users.name LIKE CONCAT('%', ?, '%')";
    $params[] = $searchName;
    $types .= "s";
}
if ($searchClass !== '') {
    $whereClauses[] = "classes.name LIKE CONCAT('%', ?, '%')";
    $params[] = $searchClass;
    $types .= "s";
}

$whereSql = implode(" AND ", $whereClauses);

// Count total learners for pagination
$countSql = "SELECT COUNT(DISTINCT users.id)
             FROM users
             LEFT JOIN class_students ON users.email = class_students.student_email
             LEFT JOIN classes ON class_students.class_id = classes.id
             WHERE $whereSql";

$stmtCount = $conn->prepare($countSql);
$stmtCount->bind_param($types, ...$params);
$stmtCount->execute();
$stmtCount->bind_result($totalLearners);
$stmtCount->fetch();
$stmtCount->close();

$totalPages = ceil($totalLearners / $limit);

// Add limit and offset params for main query
$params[] = $limit;
$params[] = $offset;
$types .= "ii";

// Get learners with their class names
$sql = "
SELECT DISTINCT users.id, users.name, classes.name AS class_name
FROM users
LEFT JOIN class_students ON users.email = class_students.student_email
LEFT JOIN classes ON class_students.class_id = classes.id
WHERE $whereSql
ORDER BY users.name ASC
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
<title>Manage Learners</title>
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

<script>
  async function liveSearch(inputId, datalistId) {
    const input = document.getElementById(inputId);
    const datalist = document.getElementById(datalistId);

    input.addEventListener('input', async () => {
      const term = input.value.trim();
      if (term.length < 2) {
        datalist.innerHTML = '';
        return;
      }
      const response = await fetch('find_learners.php?term=' + encodeURIComponent(term));
      const suggestions = await response.json();

      datalist.innerHTML = '';
      suggestions.forEach(s => {
        const option = document.createElement('option');
        option.value = s.value;
        option.textContent = s.label;
        datalist.appendChild(option);
      });
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    liveSearch('search_name', 'learners_list');
  });
</script>

</head>
<body>

<?php if (isset($_SESSION['success_message'])): ?>
  <div style="background: #27ae60; padding: 10px 15px; color: white; border-radius: 5px; margin-bottom: 20px;">
    <?= $_SESSION['success_message'] ?>
  </div>
  <?php unset($_SESSION['success_message']); ?>
<?php elseif (isset($_SESSION['error_message'])): ?>
  <div style="background: #c0392b; padding: 10px 15px; color: white; border-radius: 5px; margin-bottom: 20px;">
    <?= $_SESSION['error_message'] ?>
  </div>
  <?php unset($_SESSION['error_message']); ?>
<?php endif; ?>


<h1>Manage Learners</h1>

<form method="get" action="">
  <input type="text" id="search_name" name="search_name" placeholder="Search learners by name" list="learners_list" autocomplete="off" value="<?= htmlspecialchars($searchName) ?>" />
  <datalist id="learners_list"></datalist>

  <input type="text" name="search_class" placeholder="Search by class name" value="<?= htmlspecialchars($searchClass) ?>" />
  <button type="submit">Search</button>
</form>

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
        <form method="post" action="delete_learner.php" onsubmit="return confirm('Are you sure you want to remove this learner?');" style="display:inline;">
          <input type="hidden" name="user_id" value="<?= $row['id'] ?>" />
          <button type="submit" style="background:#e74c3c; color:white; border:none; padding:6px 10px; border-radius:5px;">Remove</button>
        </form>
      </td>
    </tr>
  <?php endwhile; ?>
<?php else: ?>
  <tr><td colspan="3">No learners found.</td></tr>
<?php endif; ?>
</tbody>

</table>

<div class="pagination">
  <?php
  $baseUrlParams = http_build_query([
    'search_name' => $searchName,
    'search_class' => $searchClass,
  ]);
  for ($p = 1; $p <= $totalPages; $p++):
    $active = $p === $page ? 'active' : '';
    $url = "?page=$p&$baseUrlParams";
  ?>
    <a href="<?= $url ?>" class="<?= $active ?>"><?= $p ?></a>
  <?php endfor; ?>
</div>

<a href="deleted_learners.php" style="color:#2980b9;">View Deleted Learners</a>

</body>
</html>
