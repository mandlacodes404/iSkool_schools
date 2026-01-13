<?php
session_start();
include("config.php");

if (!isset($_SESSION['email']) || $_SESSION['role'] !== 'teacher') {
    header("Location: index.php");
    exit();
}
require_once 'push_functions.php';
require 'vendor/autoload.php';
    use PHPMailer\PHPMailer\PHPMailer;
    use PHPMailer\PHPMailer\Exception;
    
$email = $_SESSION['email'];

// GET CURRENT ACADEMIC YEAR AUTOMATICALLY (NO SCHOOL_ID NEEDED)
$current_academic_year_id = null;
$result = $conn->query("SELECT id FROM academic_years WHERE is_current = 1 LIMIT 1");
if ($row = $result->fetch_assoc()) {
    $current_academic_year_id = $row['id'];
}

if (!$current_academic_year_id) {
    die("No active academic year found. Contact your administrator.");
}

// GET CURRENT GLOBAL TERM (Your throne — same as quizzes)
$current_global_term = 4; // safety fallback
$result = $conn->query("SELECT current_global_term FROM platform_settings LIMIT 1");
if ($result && $row = $result->fetch_assoc()) {
    $current_global_term = (int)$row['current_global_term'];
}

// Get ALL classes in current school (current DB = current school → no filter needed)
$stmt = $conn->prepare("SELECT id, name FROM classes ORDER BY name ASC");
$stmt->execute();
$classResult = $stmt->get_result();
$stmt->close();

if ($_SERVER["REQUEST_METHOD"] === "POST") {
    $title       = trim($_POST['title']);
    $description = trim($_POST['description']);
    $due_date    = $_POST['due_date'];
    $class_id    = (int)$_POST['class_id'];

    // File upload
    $filePath = null;
    $hasAttachment = false;
    if (isset($_FILES['attachment']) && $_FILES['attachment']['error'] === UPLOAD_ERR_OK) {
        $uploadDir = "assignment_Uploads/";
        if (!is_dir($uploadDir)) mkdir($uploadDir, 0777, true);
        $filename = time() . "_" . basename($_FILES['attachment']['name']);
        $filePath = $uploadDir . $filename;
        if (move_uploaded_file($_FILES['attachment']['tmp_name'], $filePath)) {
            $hasAttachment = true;
            $attachmentName = basename($_FILES['attachment']['name']);
        }
    }

    // Insert assignment
    $stmt = $conn->prepare("
        INSERT INTO assignments 
        (title, description, due_date, class_id, created_by, file_url, academic_year_id, term_number) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ");
    $stmt->bind_param("sssissii", 
        $title, 
        $description, 
        $due_date, 
        $class_id, 
        $email, 
        $filePath, 
        $current_academic_year_id,
        $current_global_term
    );
    $stmt->execute();
    $assignment_id = $stmt->insert_id;
    $stmt->close();

    // ────────────────────────────────────────────────────────────────────────
    // EMAIL NOTIFICATIONS: All Learners in the Class
    // ────────────────────────────────────────────────────────────────────────
    

    // Get school name
    $dbName     = $conn->query("SELECT DATABASE()")->fetch_row()[0];
    $schoolName = ucwords(str_replace(['iskool_', '_'], [' ', ' '], $dbName));

    // Teacher name
    $teacher_name = $_SESSION['name'] ?? 'Your Teacher';

    // Format due date nicely
    $formatted_due_date = date("l, F j, Y", strtotime($due_date));
// This uses your config's BASE_URL and ensures no double slashes //
$cleanBaseUrl = rtrim(BASE_URL, '/');
$assignmentLink = $cleanBaseUrl . "/learner_dashboard.php?page=learner_assignments.php";

// LOG IT (Temporary): This will create a file named 'url_test.txt' 
// so you can see EXACTLY what the teacher is sending.
file_put_contents('url_test.txt', "Link sent: " . $assignmentLink . PHP_EOL, FILE_APPEND);

    // Email template
    $emailBody = '
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="color-scheme" content="light dark">
<title>New Assignment Released</title>
<style>
  :root { color-scheme: light dark; }
  body { margin:0; padding:0; font-family:Verdana, Tahoma, Arial, Helvetica, sans-serif; font-size:16px; line-height:1.6; }
  .wrapper { max-width:600px; margin:30px auto; border-radius:16px; overflow:hidden; box-shadow:0 8px 25px rgba(0,0,0,0.2); }
  .header { padding:40px; text-align:center; background:#161b22; color:#ffffff; }
  .header h1 { margin:0; font-size:32px; font-weight:bold; color:#4fd1c5; }
  .body { padding:40px; background:#1e1e1e; color:#c9d1d9; }
  .body h2 { color:#4fd1c5; font-size:24px; font-weight:bold; margin-bottom:20px; }
  .body p { margin:0 0 18px; }
  .highlight { background:#2d333b; padding:20px; border-radius:12px; margin:25px 0; border-left:5px solid #4fd1c5; }
  .cta-button {
    display:inline-block; padding:16px 32px; margin:30px 0;
    background:#4fd1c5; color:#000; font-weight:bold; border-radius:30px;
    text-decoration:none; font-size:17px;
  }
  .footer { padding:30px; text-align:center; background:#161b22; font-size:14px; color:#8b949e; }
  .due-date { font-weight:bold; color:#4fd1c5; font-size:18px; }
  @media (prefers-color-scheme: light) {
    .wrapper { background:#ffffff; }
    .header, .body, .footer { background:#ffffff; color:#333333; }
    .body h2 { color:#4fd1c5; }
    .highlight { background:#f0f9ff; border-left-color:#4fd1c5; }
    .footer { color:#666666; border-top:1px solid #eeeeee; }
  }
  @media (max-width: 480px) {
    .header, .body, .footer { padding:30px 20px !important; }
    .header h1 { font-size:28px !important; }
    .body h2 { font-size:22px !important; }
  }
</style>
</head>
<body>
  <div class="wrapper">
    <div class="header"><h1>iSkool</h1></div>
    <div class="body">
      <h2>New Assignment</h2>
      <p>Hi {{name}},</p>
      <p>A new assignment has been released in your class.</p>
      
      <div class="highlight">
        <strong>' . htmlspecialchars($title) . '</strong><br><br>
        ' . nl2br(htmlspecialchars($description)) . '<br><br>
        <span class="due-date">Due Date: ' . $formatted_due_date . '</span>' .
        ($hasAttachment ? '<br><br><em>📎 Attachment included: ' . htmlspecialchars($attachmentName) . '</em>' : '') . '<br><br>
        <em>Assigned by: ' . htmlspecialchars($teacher_name) . '</em>
      </div>

      <p style="text-align:center;">
        <a href="' . $assignmentLink . '" class="cta-button">View Assignment</a>
      </p>

      <p>Please complete and submit before the due date. Good luck!</p>
    </div>
    <div class="footer">
      <p>Best regards,<br>' . htmlspecialchars($schoolName) . '</p>
      <p>Powered by iSkool © ' . date("Y") . '</p>
    </div>
  </div>
</body>
</html>';

    // Get all learners in the class
    $learnersQuery = $conn->prepare("
        SELECT DISTINCT u.email, COALESCE(u.name, u.email) AS name
        FROM users u
        JOIN class_students cs ON u.email = cs.student_email
        WHERE cs.class_id = ? AND u.role = 'learner'
    ");
    $learnersQuery->bind_param("i", $class_id);
    $learnersQuery->execute();
    $learnersResult = $learnersQuery->get_result();

    // --- SMART NOTIFICATION LOGIC ---
    
    $force_email = isset($_POST['force_email']) ? true : false;

    while ($learner = $learnersResult->fetch_assoc()) {
        $currentEmail = $learner['email'];
        $isPushSent = false;

        // A. Try Mobile Push first
        $checkSub = $conn->prepare("SELECT id FROM user_subscriptions WHERE user_email = ? LIMIT 1");
        $checkSub->bind_param("s", $currentEmail);
        $checkSub->execute();
        $subResult = $checkSub->get_result();
        
      if ($subResult->num_rows > 0) {
    $isPushSent = sendPushToUser(
        $conn, 
        $currentEmail, 
        "📚 New Assignment: " . $title, 
        "Due: " . $formatted_due_date,
        $assignmentLink // This is correct!
    );
}

        // B. Send Email if Push failed OR if "Urgent" is checked
        if (!$isPushSent || $force_email) {
            try {
                $mail = new PHPMailer(true);
                $mail->isSMTP();
                $mail->Host       = 'iskool.online';
                $mail->SMTPAuth   = true;
                $mail->Username   = 'noreply@iskool.online';
                $mail->Password   = 'ogeQkRitRfdy';
                $mail->SMTPSecure = PHPMailer::ENCRYPTION_SMTPS;
                $mail->Port       = 465;

                $mail->setFrom('noreply@iskool.online', $schoolName);
                $mail->addAddress($currentEmail);
                $mail->isHTML(true);
                $mail->Subject = "New Assignment: " . $title;

                // Personalize the name and set the body
                $personalizedBody = str_replace('{{name}}', htmlspecialchars($learner['name']), $emailBody);
                $mail->Body = $personalizedBody;

                $mail->send();
            } catch (Exception $e) {
                error_log("Assignment email failed (learner {$currentEmail}): " . $mail->ErrorInfo);
            }
        }
    }
    // --- END NOTIFICATION LOGIC ---
    $learnersQuery->close();

    // Success feedback
    echo '<script>
        document.addEventListener("DOMContentLoaded", function() {
            const modal = document.getElementById("successModal");
            if (modal) modal.style.display = "flex";
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
    <div style="background:#1a202c; padding:15px; border-radius:10px; border:1px solid #30363d; margin:20px 0;">
    <label style="display: flex; align-items: center; cursor: pointer; color: #4fd1c5; font-weight: bold; margin:0;">
        <input type="checkbox" name="force_email" value="1" style="width: 22px; height: 22px; margin-right: 12px; cursor: pointer;">
        we recommend sending mobile notifications but if you feel the message is important or urgent you can tick this box
    </label>
</div>

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