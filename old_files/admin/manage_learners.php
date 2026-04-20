<?php
session_start();
require_once 'config.php';
require_once 'admin_year_helper.php';

if (!isset($_SESSION['school_admin'])) {
    header("Location: index.php");
    exit();
}

// Fetch all classes
$classesResult = $conn->query("SELECT id, name FROM classes ORDER BY name ASC");
$classes = [];
while ($c = $classesResult->fetch_assoc()) {
    $classes[$c['id']] = $c['name'];
}

// Fetch learners for current academic year
$sql = "SELECT u.id, u.name AS learner_name, c.id AS class_id
        FROM users u
        LEFT JOIN class_students cs ON u.email = cs.student_email AND cs.academic_year_id = ?
        LEFT JOIN classes c ON cs.class_id = c.id
        WHERE u.role = 'learner'
        ORDER BY c.name ASC, u.name ASC";

$stmt = $conn->prepare($sql);
$stmt->bind_param("i", $activeYearId);
$stmt->execute();
$result = $stmt->get_result();

$learnersByClass = [];
while ($row = $result->fetch_assoc()) {
    $classId = $row['class_id'] ?? 0;
    $learnersByClass[$classId][] = $row['learner_name'];
}
?>

<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Learners by Class</title>
<style>
  body {
    font-family: 'Segoe UI', Arial, sans-serif;
    padding: 40px 20px;
    background: #0d1117;
    color: #c9d1d9;
    margin: 0;
    line-height: 1.6;
  }
  h1 {
    text-align: center;
    color: #58a6ff;
    margin-bottom: 50px;
    font-size: 2.4rem;
    font-weight: 600;
  }

  .class-group {
    margin-bottom: 22px;
    border-radius: 14px;
    overflow: hidden;
    box-shadow: 0 8px 25px rgba(0,0,0,0.4);
    transition: all 0.3s ease;
  }
  .class-group:hover {
    transform: translateY(-5px);
    box-shadow: 0 15px 35px rgba(0,0,0,0.5);
  }

  .class-header {
    background: linear-gradient(135deg, #161b22, #0d1117);
    padding: 20px 28px;
    font-size: 1.4rem;
    font-weight: 600;
    cursor: pointer;
    user-select: none;
    display: flex;
    justify-content: space-between;
    align-items: center;
    color: #58a6ff;
    transition: background 0.3s ease;
  }
  .class-header:hover {
    background: linear-gradient(135deg, #1f6feb28, #161b22);
  }

  .toggle-icon {
    font-size: 30px;
    transition: transform 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  }
  .class-header.collapsed .toggle-icon {
    transform: rotate(-90deg);
  }

  .count-badge {
    background: #21262d;
    color: #79c0ff;
    padding: 7px 16px;
    border-radius: 30px;
    font-size: 0.95rem;
    font-weight: 500;
    border: 1px solid #30363d;
    margin-left: 12px;
  }

  .learners-list {
    background: #0d1117;
    padding: 0;
    margin: 0;
    list-style: none;
    max-height: 600px;
    overflow-y: auto;
  }

  .learner-item {
    padding: 16px 28px;
    border-bottom: 1px solid #30363d;
    font-size: 1.1rem;
    transition: background 0.2s;
  }
  .learner-item:hover {
    background: #161b22;
  }
  .learner-item:last-child {
    border-bottom: none;
  }

  .no-learners {
    padding: 50px 28px;
    text-align: center;
    color: #8b949e;
    font-style: italic;
    font-size: 1.15rem;
  }

  .footer-link {
    display: block;
    text-align: center;
    margin: 60px auto 20px;
    color: #58a6ff;
    text-decoration: none;
    font-size: 1.1rem;
  }
  .footer-link:hover {
    text-decoration: underline;
  }
</style>
</head>
<body>

<h1>Learners by Class</h1>

<?php if (empty($classes)): ?>
  <p style="text-align:center;color:#8b949e;margin-top:100px;font-size:1.4rem;">
    No classes have been created yet.
  </p>
<?php else: ?>
  <?php foreach ($classes as $classId => $className):
    $learners = $learnersByClass[$classId] ?? [];
    $learnerCount = count($learners);
  ?>
    <div class="class-group">
      <div class="class-header" onclick="this.classList.toggle('collapsed');
                                   const list = this.nextElementSibling;
                                   list.style.display = this.classList.contains('collapsed') ? 'none' : 'block';">
        <span>
          <?= htmlspecialchars($className) ?>
          <span class="count-badge"><?= $learnerCount ?> learner<?= $learnerCount == 1 ? '' : 's' ?></span>
        </span>
        <span class="toggle-icon">Down Arrow</span>
      </div>

      <ul class="learners-list" style="display: block;">
        <?php if ($learnerCount > 0): ?>
          <?php foreach ($learners as $learnerName): ?>
            <li class="learner-item"><?= htmlspecialchars($learnerName) ?></li>
          <?php endforeach; ?>
        <?php else: ?>
          <li class="no-learners">No learners assigned to this class yet</li>
        <?php endif; ?>
      </ul>
    </div>
  <?php endforeach; ?>
<?php endif; ?>

<a href="dashboard.php" class="footer-link">Back to Dashboard</a>

</body>
</html>