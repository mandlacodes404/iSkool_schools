<?php
session_start();
include("config.php");

if (!isset($_SESSION['email']) || $_SESSION['role'] !== 'teacher') {
    header("Location: index.php");
    exit();
}

$email = $_SESSION['email'];
$teacherSchoolId = $_SESSION['school_id'] ?? null;

// GET CURRENT ACADEMIC YEAR AUTOMATICALLY
$currentYearStmt = $conn->prepare("SELECT id FROM academic_years WHERE school_id = ? AND is_current = 1 LIMIT 1");
$currentYearStmt->bind_param("i", $teacherSchoolId);
$currentYearStmt->execute();
$currentYearResult = $currentYearStmt->get_result();
$currentYearRow = $currentYearResult->fetch_assoc();
$current_academic_year_id = $currentYearRow['id'] ?? null;
$currentYearStmt->close();

if (!$current_academic_year_id) {
    die("No active academic year found. Contact your administrator.");
}
// ==========================================================================
// GET CURRENT GLOBAL TERM (Your throne — same as quizzes)
$current_global_term = 4; // safety fallback
$result = $conn->query("SELECT current_global_term FROM platform_settings LIMIT 1");
if ($result && $row = $result->fetch_assoc()) {
    $current_global_term = (int)$row['current_global_term'];
}
// ==========================================================================
// Get classes assigned to the teacher's school
if ($teacherSchoolId !== null) {
    $stmt = $conn->prepare("SELECT * FROM classes WHERE school_id = ? ORDER BY name ASC");
    $stmt->bind_param("i", $teacherSchoolId);
    $stmt->execute();
    $classResult = $stmt->get_result();
} else {
    $classResult = $conn->query("SELECT * FROM classes WHERE 0"); // empty
}

// Handle form submission
if ($_SERVER["REQUEST_METHOD"] === "POST") {
    $title = $_POST['title'];
    $description = $_POST['description'];
    $due_date = $_POST['due_date'];
    $class_id = $_POST['class_id'];

    $filePath = null;
    if (isset($_FILES['attachment']) && $_FILES['attachment']['error'] === 0) {
        $uploadDir = "assignment_Uploads/";
        if (!file_exists($uploadDir)) mkdir($uploadDir, 0777, true);
        $filename = time() . "_" . basename($_FILES['attachment']['name']);
        $filePath = $uploadDir . $filename;
        move_uploaded_file($_FILES['attachment']['tmp_name'], $filePath);
    }

        $stmt = $conn->prepare("
        INSERT INTO assignments 
        (title, description, due_date, class_id, created_by, file_url, academic_year_id, term_number) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ");
    $stmt->bind_param("ssssssii", 
        $title, 
        $description, 
        $due_date, 
        $class_id, 
        $email, 
        $filePath, 
        $current_academic_year_id,
        $current_global_term      // ← FORCED CURRENT TERM
    );
    $stmt->execute();

    // Output JavaScript to trigger the success popup and redirect
    echo '<script>
        document.addEventListener("DOMContentLoaded", function() {
            document.getElementById("successModal").style.display = "flex";
            setTimeout(function() {
                window.location.href = "teacher_assignments.php";
            }, 2000);
        });
    </script>';
}
?>

<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Create Assignment</title>
  <style>
    body {
      font-family: 'Inter', Arial, sans-serif;
      background-color: #0d1117;
      color: #c9d1d9;
      max-width: 900px;
      margin: 30px auto;
      padding: 0 20px 50px;
      line-height: 1.6;
    }

    p.topbar {
      font-size: 1rem;
      color: #8b949e;
      margin-bottom: 32px;
      user-select: none;
      text-align: center;
    }

    p.topbar strong {
      color: #c9d1d9;
    }

    p.topbar a {
      color: #58a6ff;
      text-decoration: none;
      font-weight: 600;
    }

    p.topbar a:hover {
      text-decoration: underline;
    }

    h1 {
      font-weight: 700;
      font-size: 2.4rem;
      margin-bottom: 30px;
      color: #e6edf3;
      text-align: center;
    }

    label {
      display: block;
      margin-top: 18px;
      font-weight: 600;
      color: #8b949e;
      user-select: none;
    }

    input[type="text"],
    input[type="datetime-local"],
    select,
    textarea,
    input[type="file"] {
      width: 100%;
      padding: 12px 14px;
      margin-top: 8px;
      background-color: #161b22;
      border: 1.5px solid #30363d;
      border-radius: 8px;
      font-size: 1rem;
      color: #c9d1d9;
      transition: border-color 0.2s ease;
      font-family: inherit;
      resize: vertical;
    }

    input[type="text"]::placeholder,
    input[type="datetime-local"]::placeholder,
    textarea::placeholder {
      color: #8b949e;
    }

    input[type="text"]:focus,
    input[type="datetime-local"]:focus,
    select:focus,
    textarea:focus,
    input[type="file"]:focus {
      outline: none;
      border-color: #58a6ff;
      box-shadow: 0 0 6px #58a6ffaa;
      background-color: #21262d;
    }

    button.submit-btn {
      width: 100%;
      font-weight: 700;
      border-radius: 10px;
      border: none;
      padding: 16px 0;
      font-size: 1.15rem;
      cursor: pointer;
      background-color: #0969da;
      color: #c9d1d9;
      transition: background-color 0.3s ease;
      user-select: none;
      margin-top: 30px;
    }

    button.submit-btn:hover {
      background-color: #2188ff;
    }

    #loaderOverlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(13,17,23,0.85); /* dark translucent */
      display: none; /* hidden by default */
      justify-content: center;
      align-items: center;
      flex-direction: column;
      z-index: 9999;
    }

    .loader {
      border: 6px solid #f3f3f3;
      border-top: 6px solid #58a6ff; /* blue spinner */
      border-radius: 50%;
      width: 60px;
      height: 60px;
      animation: spin 1s linear infinite;
      margin-top: 12px;
    }

    .loader-text {
      color: #c9d1d9;
      font-size: 18px;
      font-weight: bold;
      text-align: center;
    }

    /* Spinner animation */
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }

    /* Success Modal Styles */
    #successModal {
      display: none;
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(13, 17, 23, 0.85);
      justify-content: center;
      align-items: center;
      z-index: 10000;
      animation: fadeIn 0.3s ease-in-out;
    }

    #successModalContent {
      background: #161b22;
      padding: 20px;
      border-radius: 10px;
      text-align: center;
      box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
      max-width: 400px;
      width: 90%;
      border: 1.5px solid #30363d;
    }

    #successModalContent p {
      font-size: 18px;
      color: #c9d1d9;
      margin: 0 0 10px;
      font-weight: 600;
    }

    #successModalContent i {
      color: #238636;
      font-size: 40px;
      margin-bottom: 10px;
    }

    @keyframes fadeIn {
      from { opacity: 0; transform: scale(0.95); }
      to { opacity: 1; transform: scale(1); }
    }
  </style>
</head>
<body>
  <h1>Create New Assignment</h1>

  <form method="POST" enctype="multipart/form-data">
    <label for="title">Title:</label>
    <input type="text" id="title" name="title" required />

    <label for="description">Description:</label>
    <textarea id="description" name="description" rows="5" required></textarea>

    <label for="due_date">Due Date:</label>
    <input type="datetime-local" id="due_date" name="due_date" required />

    <label for="class_id">Assign to Class:</label>
    <select id="class_id" name="class_id" required>
      <?php while ($class = $classResult->fetch_assoc()): ?>
        <option value="<?= $class['id'] ?>">
          <?= htmlspecialchars($class['name']) ?>
        </option>
      <?php endwhile; ?>
    </select>

    <div style="background:#1a202c; padding:18px; border-radius:10px; border-left:5px solid #4fd1c5; margin:25px 0; text-align:center; font-size:1.1rem;">
        <strong style="color:#4fd1c5; font-size:1.3rem;">Posting to: TERM <?= $current_global_term ?></strong><br>
        <small style="color:#8b949e;">This assignment automatically belongs to the current term.</small>
    </div>

    <label for="attachment">Attachment (optional):</label>
    <input type="file" id="attachment" name="attachment" />

    <button type="submit" class="submit-btn">Create Assignment</button>
  </form>

  <!-- Full Screen Loader -->
  <div id="loaderOverlay">
    <div class="loader-text">Processing...</div>
    <div class="loader"></div>
  </div>

  <!-- Success Modal -->
  <div id="successModal">
    <div id="successModalContent">
      <i class="fas fa-check-circle"></i>
      <p>Assignment created successfully!</p>
    </div>
  </div>

<script>
const form = document.querySelector("form");
const loader = document.getElementById("loaderOverlay");

form.addEventListener("submit", () => {
    loader.style.display = "flex"; // show overlay
});
</script>
</body>
</html>