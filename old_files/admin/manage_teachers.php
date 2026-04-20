<?php
session_start();
require_once 'config.php';

// Security – only school_admin allowed
if (!isset($_SESSION['school_admin'])) {
    header("Location: index.php");
    exit();
}

// Clean up old session key if exists
unset($_SESSION['school_id']);

// Fetch ALL active teachers (not deleted)
$stmt = $conn->prepare("SELECT name FROM users WHERE role = 'teacher' AND is_deleted = 0 ORDER BY name ASC");
$stmt->execute();
$result = $stmt->get_result();
?>

<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Manage Teachers</title>
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

  .teachers-container {
    max-width: 800px;
    margin: 0 auto;
  }

  .teachers-list {
    background: #161b22;
    border-radius: 14px;
    overflow: hidden;
    box-shadow: 0 8px 30px rgba(0,0,0,0.5);
    border: 1px solid #30363d;
  }

  .teacher-item {
    padding: 18px 28px;
    border-bottom: 1px solid #30363d;
    font-size: 1.15rem;
    transition: background 0.25s ease;
  }
  .teacher-item:hover {
    background: #1f6feb18;
  }
  .teacher-item:last-child {
    border-bottom: none;
  }

  .no-teachers {
    padding: 60px 28px;
    text-align: center;
    color: #8b949e;
    font-style: italic;
    font-size: 1.2rem;
  }

  .total-count {
    text-align: center;
    margin-bottom: 30px;
    color: #79c0ff;
    font-size: 1.1rem;
    font-weight: 500;
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

<h1>Manage Teachers</h1>

<div class="teachers-container">

  <div class="total-count">
    <?= $result->num_rows ?> Active Teacher<?= $result->num_rows == 1 ? '' : 's' ?>
  </div>

  <?php if ($result->num_rows > 0): ?>
    <div class="teachers-list">
      <?php while ($row = $result->fetch_assoc()): ?>
        <div class="teacher-item">
          <?= htmlspecialchars($row['name']) ?>
        </div>
      <?php endwhile; ?>
    </div>
  <?php else: ?>
    <div class="teachers-list">
      <div class="no-teachers">No teachers have been added yet.</div>
    </div>
  <?php endif; ?>

</div>

<a href="dashboard.php" class="footer-link">Back to Dashboard</a>

</body>
</html>