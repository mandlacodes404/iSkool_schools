<?php
ob_start();
error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);
ini_set('error_log', 'php_errors.log');

session_start();
include("config.php");

require 'vendor/autoload.php';
use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;
require_once 'push_functions.php';

if (!isset($_SESSION['email']) || $_SESSION['role'] !== 'teacher') {
    http_response_code(401);
    echo json_encode(["success" => false, "message" => "Unauthorized access. Please log in as a teacher."]);
    ob_end_flush();
    exit;
}

$email = $_SESSION['email'];

// ==================== AUTOMATIC ACADEMIC YEAR DETECTION ====================
$current_academic_year_id = null;
$result = $conn->query("SELECT id FROM academic_years WHERE is_current = 1 LIMIT 1");
if ($result && $row = $result->fetch_assoc()) {
    $current_academic_year_id = $row['id'];
}
if (!$current_academic_year_id) {
    die("No active academic year found. Please contact your admin.");
}

// ==================== GET CURRENT GLOBAL TERM ====================
$current_global_term = 4; 
$result = $conn->query("SELECT current_global_term FROM platform_settings LIMIT 1");
if ($result && $row = $result->fetch_assoc()) {
    $current_global_term = (int)$row['current_global_term'];
}

// Fetch classes 
$stmt = $conn->prepare("SELECT id, name FROM classes ORDER BY name ASC");
$stmt->execute();
$classResult = $stmt->get_result();

// Get school name from DB
$dbName     = $conn->query("SELECT DATABASE()")->fetch_row()[0];
$schoolName = ucwords(str_replace(['iskool_', '_'], [' ', ' '], $dbName));

if ($_SERVER["REQUEST_METHOD"] === "POST") {
    $quiz_title     = trim($_POST['quiz_title'] ?? '');
    $duration       = intval($_POST['duration'] ?? 0);
    $class_id       = intval($_POST['class_id'] ?? 0);
    $publish_marks  = isset($_POST['publish_marks']) ? 1 : 0;
    $start_time     = $_POST['start_time'] ?? '';
    $status = $_POST['status'] ?? 'Scheduled'; 
    $is_summative   = isset($_POST['is_summative']) ? 1 : 0;
    $weight_percent = $is_summative && !empty($_POST['weight_percent']) ? floatval($_POST['weight_percent']) : null;

    // Validation
    $errors = [];
    if (empty($quiz_title)) $errors[] = "Quiz title is required.";
    if ($duration < 1 || $duration > 180) $errors[] = "Duration must be between 1 and 180 minutes.";
    if ($class_id < 1) $errors[] = "Invalid class selected.";
    if (empty($start_time) || !strtotime($start_time)) $errors[] = "Valid start time is required.";

    if (!empty($errors)) {
        http_response_code(400);
        echo json_encode(["success" => false, "message" => implode(" ", $errors)]);
        ob_end_flush();
        exit;
    }
$layout_mode = $_POST['layout_mode'] ?? 'single_page';
    // Capture the shuffle checkbox (1 if checked, 0 if not)
    $shuffle_questions = isset($_POST['shuffle_questions']) ? 1 : 0; 

    // 1. Updated SQL to include shuffle_questions
    $stmt = $conn->prepare("
        INSERT INTO quizzes 
        (title, duration, publish_marks, created_by, class_id, academic_year_id, term_number, start_time, status, is_summative, weight_percent, layout_mode, shuffle_questions) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ");

    /**
     * 2. Added one more "i" at the end of the string and added $shuffle_questions variable
     */
    $stmt->bind_param("siisiiisssdsi", 
        $quiz_title, 
        $duration, 
        $publish_marks, 
        $email, 
        $class_id, 
        $current_academic_year_id, 
        $current_global_term, 
        $start_time, 
        $status, 
        $is_summative, 
        $weight_percent,
        $layout_mode,
        $shuffle_questions
    );

if (!$stmt->execute()) {
    // This will help you see the EXACT error in your log if it fails again
    error_log("SQL Execution Error: " . $stmt->error);
    http_response_code(500);
    echo json_encode(["success" => false, "message" => "Database error: " . $stmt->error]);
    exit;
}
  
    $quiz_id = $stmt->insert_id;
    $stmt->close();

    // INSERT QUESTIONS & CHOICES
    $qStmt = $conn->prepare("INSERT INTO quizquestions (quiz_id, question_text, image_path, points) VALUES (?, ?, ?, ?)");
    $cStmt = $conn->prepare("INSERT INTO choices (question_id, choice_text, is_correct) VALUES (?, ?, ?)");

    $targetDir = "quiz_images/";
    if (!file_exists($targetDir)) mkdir($targetDir, 0755, true);

    foreach ($_POST['question'] as $i => $qText) {
        $points = intval($_POST['points'][$i]);
        $choices = array_map('trim', $_POST['choices'][$i]);
        $correct = intval($_POST['correct_choice'][$i]);
        $imagePath = null;

        if (isset($_FILES['question_images']['name'][$i]) && $_FILES['question_images']['error'][$i] === UPLOAD_ERR_OK) {
            $filename = time() . "_" . basename($_FILES['question_images']['name'][$i]);
            $targetFile = $targetDir . $filename;
            if (move_uploaded_file($_FILES['question_images']['tmp_name'][$i], $targetFile)) {
                $imagePath = $targetFile;
            }
        }

        $qStmt->bind_param("issi", $quiz_id, $qText, $imagePath, $points);
        $qStmt->execute();
        $question_id = $qStmt->insert_id;

        foreach ($choices as $index => $choiceText) {
            if (empty($choiceText)) continue;
            $isCorrect = ($index == $correct) ? 1 : 0;
            $cStmt->bind_param("isi", $question_id, $choiceText, $isCorrect);
            $cStmt->execute();
        }
    }
    $qStmt->close();
    $cStmt->close();

    // --- SMART NOTIFICATION LOGIC (Matching Assignment logic) ---
    $force_email = isset($_POST['force_email']) ? true : false;

    // 1. Define the link
$cleanBaseUrl = rtrim(BASE_URL, '/');
$quizLink = $cleanBaseUrl . "/learner_dashboard.php?page=quiz_list.php";

    $learnersQuery = $conn->prepare("
    SELECT DISTINCT u.email, u.name 
    FROM users u 
    JOIN class_students cs ON u.email = cs.student_email 
    WHERE cs.class_id = ? 
    AND cs.academic_year_id = ?  /* <--- Add this */
    AND u.role = 'learner'
");
// Bind two integers: class_id and current_academic_year_id
$learnersQuery->bind_param("ii", $class_id, $current_academic_year_id);
    $learnersQuery->execute();
    $result = $learnersQuery->get_result();

    while ($learner = $result->fetch_assoc()) {
        $currentEmail = $learner['email'];
        $isPushSent = false;

        // A. Try Mobile Push (Automatic if subscription exists)
        $checkSub = $conn->prepare("SELECT id FROM user_subscriptions WHERE user_email = ? LIMIT 1");
        $checkSub->bind_param("s", $currentEmail);
        $checkSub->execute();
        // 2. Add the link as the 5th parameter in the push function
if ($checkSub->get_result()->num_rows > 0) {
    $isPushSent = sendPushToUser(
        $conn, 
        $currentEmail, 
        "✍️ New Quiz: " . $quiz_title, 
        "Status: " . $status . ". Good luck!",
        $quizLink // <--- Add this here
    );
}
        $checkSub->close();

        // B. Send Email if Push failed OR Force Email is checked
        if (!$isPushSent || $force_email) {
            try {
                $mail = new PHPMailer(true);
                $mail->isSMTP();
                $mail->Host = 'iskool.online';
                $mail->SMTPAuth = true;
                $mail->Username = 'noreply@iskool.online';
                $mail->Password = 'ogeQkRitRfdy';
                $mail->SMTPSecure = PHPMailer::ENCRYPTION_SMTPS;
                $mail->Port = 465;
                $mail->setFrom('noreply@iskool.online', $schoolName);
                $mail->addAddress($currentEmail);
                $mail->isHTML(true);
                $mail->Subject = 'New Quiz: ' . $quiz_title;
                $mail->Body = '
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>New Quiz Alert</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
  body {
    margin: 0;
    padding: 0;
    background-color: #0d1117;
    font-family: "Inter", system-ui, Arial, sans-serif;
    color: #e0e6f0;
  }
  .email-wrapper {
    max-width: 600px;
    margin: 30px auto;
    background-color: #1a202c;
    border-radius: 12px;
    overflow: hidden;
    box-shadow: 0 6px 20px rgba(0,0,0,0.5);
  }
  .email-header {
    background-color: #161b22;
    padding: 30px;
    text-align: center;
  }
  .email-header h1 {
    margin: 0;
    font-size: 28px;
    font-weight: 700;
    color: #4fd1c5;
  }
  .email-header p {
    margin: 6px 0 0;
    font-size: 14px;
    color: #e0e6f0;
  }
  .email-body {
    padding: 30px;
    text-align: left;
  }
  .email-body p {
    margin: 0 0 15px;
    font-size: 16px;
    line-height: 1.6;
    color: #e0e6f0;
  }
  .email-body h2 {
    font-size: 22px;
    font-weight: 600;
    color: #4fd1c5;
    margin: 0 0 20px;
  }
  .cta-button {
    display: inline-block;
    padding: 12px 25px;
    margin-top: 15px;
    background-color: #4fd1c5;
    color: #0d1117;
    font-weight: 600;
    border-radius: 25px;
    text-decoration: none;
    transition: background-color 0.3s ease;
  }
  .cta-button:hover {
    background-color: #1ed760;
  }
  .email-footer {
    background-color: #161b22;
    padding: 20px;
    text-align: center;
    font-size: 13px;
    color: #8b949e;
  }
  @media (max-width: 480px) {
    .email-wrapper {
      margin: 20px 10px;
    }
    .email-header, .email-body, .email-footer {
      padding: 20px;
    }
    .email-header h1 {
      font-size: 24px;
    }
    .email-body h2 {
      font-size: 20px;
    }
    .email-body p {
      font-size: 15px;
    }
  }
</style>
</head>
<body>
  <div class="email-wrapper">
    <div class="email-header">
      <h1><i class="fas fa-poll"></i> iSkool</h1>
      <p>Your Digital Classroom</p>
    </div>
    <div class="email-body">
      <p>Hello ' . htmlspecialchars($learner['name']) . ',</p>
      <h2>New Quiz: ' . htmlspecialchars($quiz_title) . '</h2>
      <p>Your teacher has posted a new quiz titled "<strong>' . htmlspecialchars($quiz_title) . '</strong>" with status: <strong>' . htmlspecialchars($status) . '</strong>. If the quiz is open, you can attempt it now!</p>
      <a href="http://iskool.online/quiz_list.php?quiz_id=' . $quiz_id . '" class="cta-button">Go to Quiz</a>
    </div>
    <div class="email-footer">
      <p>Best regards, ' . htmlspecialchars($schoolName) . '</p>
      <p>Powered by iSkool &copy; 2025</p>
    </div>
  </div>
</body>
</html>
';
            $mail->send();
            } catch (Exception $e) {
                error_log("Email failed for $currentEmail: " . $mail->ErrorInfo);
            }
        }
    }
    $learnersQuery->close();
    

    ob_end_clean();
    echo json_encode(["success" => true, "redirect" => "teacher_quizzes.php"]);
    exit;
}
?>

<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Create Quiz</title>
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.2/css/all.min.css" integrity="sha512-z3gLpd7yknf1YoNbCzqRKc4qyor8gaKU1qmn+CShxbuBusANI9QpRohGBreCFkKxLhei6S9CQXFEbbKuqLg0DA==" crossorigin="anonymous" referrerpolicy="no-referrer" />
<style>
body {
  font-family: 'Inter', Arial, sans-serif;
  background-color: #0d1117;
  color: #e0e6f0;
  margin: 30px auto;
  max-width: 900px;
  line-height: 1.6;
  padding: 0 20px 50px;
}
h1 {
  font-weight: 700;
  font-size: 2.4rem;
  margin-bottom: 30px;
  color: #e0e6f0;
  text-align: center;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
}
label {
  display: block;
  margin-top: 18px;
  font-weight: 600;
  color: #8b949e;
  user-select: none;
}
input[type="text"], input[type="number"], select, input[type="file"], input[type="datetime-local"] {
  width: 100%;
  padding: 12px 14px;
  margin-top: 8px;
  background-color: #1a202c;
  border: 1.5px solid #30363d;
  border-radius: 8px;
  font-size: 1rem;
  color: #e0e6f0;
  transition: border-color 0.2s ease;
}
input[type="text"]::placeholder, input[type="number"]::placeholder {
  color: #8b949e;
}
input[type="text"]:focus, input[type="number"]:focus, select:focus, input[type="file"]:focus, input[type="datetime-local"]:focus {
  outline: none;
  border-color: #4fd1c5;
  box-shadow: 0 0 6px rgba(79, 209, 197, 0.5);
  background-color: #21262d;
}
.question-block {
  background: #1a202c;
  padding: 25px 30px;
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  margin-bottom: 28px;
  position: relative;
}
.question-block h3 {
  margin: 0;
  font-weight: 700;
  font-size: 1.3rem;
  color: #4fd1c5;
  user-select: none;
  display: inline-block;
}
.question-block .points-display {
  font-weight: 600;
  color: #4fd1c5;
}
.question-block button.delete-btn {
  position: absolute;
  top: 22px;
  right: 25px;
  background-color: #f85149;
  color: #e0e6f0;
  border: none;
  border-radius: 6px;
  padding: 6px 12px;
  cursor: pointer;
  font-size: 0.9rem;
  font-weight: 600;
  transition: background-color 0.2s ease;
}
.question-block button.delete-btn:hover {
  background-color: #da3633;
}
.question-block input[type="text"] {
  margin-top: 10px;
}
.question-block select {
  margin-top: 12px;
  max-width: 180px;
}
.question-block input[type="number"] {
  max-width: 100px;
}
.add-btn, .submit-btn {
  width: 100%;
  font-weight: 700;
  border-radius: 10px;
  border: none;
  padding: 16px 0;
  font-size: 1.15rem;
  cursor: pointer;
  transition: background-color 0.3s ease, box-shadow 0.3s ease;
  user-select: none;
}
.add-btn {
  background-color: #238636;
  color: #e0e6f0;
  margin-bottom: 20px;
}
.add-btn:hover {
  background-color: #2ea043;
  box-shadow: 0 0 8px rgba(35, 134, 54, 0.5);
}
.submit-btn {
  background-color: #4fd1c5;
  color: #0d1117;
}
.submit-btn:hover {
  background-color: #1ed760;
  box-shadow: 0 0 8px rgba(79, 209, 197, 0.5);
}
.checkbox-container {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 25px;
  margin-bottom: 30px;
  font-weight: 600;
  color: #8b949e;
  user-select: none;
}
.checkbox-container input[type="checkbox"] {
  width: 18px;
  height: 18px;
  cursor: pointer;
  accent-color: #4fd1c5;
}
#loaderOverlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(13, 17, 23, 0.85);
  display: none;
  justify-content: center;
  align-items: center;
  flex-direction: column;
  z-index: 9999;
}
.loader {
  border: 6px solid #f3f3f3;
  border-top: 6px solid #4fd1c5;
  border-radius: 50%;
  width: 60px;
  height: 60px;
  animation: spin 1s linear infinite;
  margin-top: 12px;
}
.loader-text {
  color: #e0e6f0;
  font-size: 18px;
  font-weight: 600;
  text-align: center;
}
@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
.popup {
  display: none;
  position: fixed;
  top: 20px;
  right: 20px;
  background: #1a202c;
  color: #e0e6f0;
  padding: 16px 22px;
  border-radius: 12px;
  font-size: 15px;
  font-weight: 500;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.4);
  border-left: 5px solid #4fd1c5;
  opacity: 0;
  transform: translateY(-10px);
  transition: all 0.4s ease-in-out;
  z-index: 9999;
}
.popup.show {
  display: block;
  opacity: 1;
  transform: translateY(0);
}

/* Mode Card Styling */
.layout-options {
    display: flex;
    gap: 15px;
    margin-top: 10px;
}
.mode-card {
    flex: 1;
    background: #1a202c;
    border: 2px solid #30363d;
    padding: 15px;
    border-radius: 10px;
    text-align: center;
    cursor: pointer;
    transition: all 0.3s ease;
}
.mode-card i {
    display: block;
    font-size: 20px;
    margin-bottom: 8px;
    color: #8b949e;
}
input[type="radio"]:checked + .mode-card {
    border-color: #4fd1c5;
    background: rgba(79, 209, 197, 0.1);
}
input[type="radio"]:checked + .mode-card i {
    color: #4fd1c5;
}
.info-trigger {
    color: #4fd1c5;
    cursor: pointer;
    font-size: 0.9rem;
    margin-left: 5px;
}
/* Modal for Information */
#layoutModal {
    display: none;
    position: fixed;
    top: 0; left: 0; width: 100%; height: 100%;
    background: rgba(0,0,0,0.85);
    z-index: 10000;
    justify-content: center;
    align-items: center;
}
.modal-content {
    background: #1a202c;
    padding: 30px;
    border-radius: 15px;
    max-width: 450px;
    border: 1px solid #4fd1c5;
}
</style>
</head>
<body>
  <h1><i class="fas fa-poll"></i> Create a New Quiz</h1>
  <form id="quizForm" action="create_quiz.php" method="POST" enctype="multipart/form-data">
    <label>Quiz Title:</label>
    <input type="text" name="quiz_title" required aria-label="Quiz title">

    <label>Assign to Class:</label>
    <select name="class_id" required aria-label="Select class">
      <?php while ($class = $classResult->fetch_assoc()): ?>
        <option value="<?= htmlspecialchars($class['id']) ?>">
          <?= htmlspecialchars($class['name']) ?><?= !empty($class['subject']) ? ' (' . htmlspecialchars($class['subject']) . ')' : '' ?>
        </option>
      <?php endwhile; ?>
    </select>

    <label>Quiz Duration (in minutes):</label>
    <input type="number" name="duration" min="1" max="180" required aria-label="Quiz duration in minutes">

    <label>Start Time (when quiz should become available):</label>
    <input type="datetime-local" name="start_time" required aria-label="Quiz start time">

    <label>Quiz Status:</label>
<select name="status" id="quizStatus" required>
  <option value="Scheduled">Scheduled (Opens at start time)</option>
  <option value="Open">Open (Available immediately)</option>
  <option value="Closed">Closed (Not accessible)</option>
</select>

    <div class="checkbox-container">
      <input type="checkbox" name="publish_marks" value="1" id="publishMarksCheckbox" />
      <label for="publishMarksCheckbox">Publish marks immediately <i class="fas fa-poll"></i></label>
    </div>

    <div class="checkbox-container" style="margin-top: 20px;">
  <input type="checkbox" name="is_summative" value="1" id="isSummativeCheckbox" />
  <label for="isSummativeCheckbox">Counts toward official term mark (Verified)</label>
</div>

<div style="background:#1a202c; padding:15px; border-radius:10px; border:1px solid #30363d; margin:20px 0;">
    <label style="display: flex; align-items: center; cursor: pointer; color: #4fd1c5; font-weight: bold; margin:0;">
        <input type="checkbox" name="force_email" value="1" style="width: 20px; height: 20px; margin-right: 12px;">
        Learners automatically get mobile notifications, tick the box if you want the learners to get emails too but we recommend mobile notifications because emails are heavy on the server.
    </label>
</div>

  <div style="background:#1a202c; padding:18px; border-radius:10px; border-left:5px solid #4fd1c5; margin:25px 0; text-align:center; font-size:1.1rem;">
        <strong style="color:#4fd1c5; font-size:1.3rem;">Posting to: TERM <?= $current_global_term ?></strong><br>
        <small style="color:#8b949e;">This quiz will automatically belong to the current term.
       </small>
    </div>

<div id="weightContainer" style="margin-top: 12px; display: none; background: #1a202c; padding: 16px; border-radius: 8px; border: 1px solid #30363d;">
  <label for="weight_percent">Weight % of term mark (e.g., 40 for 40%)</label>
  <input type="number" name="weight_percent" id="weight_percent" min="0" max="100" step="0.1" placeholder="Optional – leave blank for equal weight" style="max-width: 200px;" />
  <small style="color: #8b949e; display: block; margin-top: 6px;">Only used if "Counts toward term mark" is checked.</small>
</div>

<div style="margin-bottom: 30px;">
    <label style="display: flex; align-items: center;">
        Quiz Layout Mode 
        <i class="fas fa-info-circle info-trigger" onclick="document.getElementById('layoutModal').style.display='flex'"></i>
    </label>
    
    <div class="layout-options">
        <label style="flex: 1;">
            <input type="radio" name="layout_mode" value="single_page" checked style="display:none;">
            <div class="mode-card">
                <i class="fas fa-file-alt"></i>
                <strong>Single Page</strong>
            </div>
        </label>
        
        <label style="flex: 1;">
            <input type="radio" name="layout_mode" value="multi_page" style="display:none;">
            <div class="mode-card">
                <i class="fas fa-layer-group"></i>
                <strong>Multi-Page</strong>
            </div>
        </label>
    </div>
</div>

<div id="randomizeOption" style="display: none; margin-top: 15px; background: rgba(79, 209, 197, 0.05); padding: 12px; border-radius: 8px; border: 1px dashed #4fd1c5;">
    <div class="checkbox-container" style="margin: 0;">
        <input type="checkbox" name="shuffle_questions" value="1" id="shuffleCheckbox" />
        <label for="shuffleCheckbox" style="margin-top:0; color: #e0e6f0;">
            Shuffle Questions <i class="fas fa-random" style="margin-left:5px;"></i>
            <br><small style="color: #8b949e; font-weight: normal;">Every student gets questions in a different order.</small>
        </label>
    </div>
</div>

<div id="layoutModal" onclick="this.style.display='none'">
    <div class="modal-content" onclick="event.stopPropagation()">
        <h3 style="color:#4fd1c5; margin-top:0;"><i class="fas fa-question-circle"></i> Choosing a Layout</h3>
        <p><strong>📄 Single Page:</strong> All questions appear on one screen. Best for students with <b>unstable internet</b> because it loads everything at once.</p>
        <hr style="border:0; border-top:1px solid #30363d; margin:15px 0;">
        <p><strong>📑 Multi-Page:</strong> Shows one question at a time. This allows the <b>Integrity Report</b> to track exactly which question a student was viewing when they switched tabs.</p>
        <button type="button" class="submit-btn" style="padding:10px; font-size:1rem;" onclick="document.getElementById('layoutModal').style.display='none'">I Understand</button>
    </div>
</div>

    <div id="questions-container">
      <div class="question-block">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
          <h3>Question 1</h3>
          <span class="points-display">1 pt</span>
        </div>
        <input type="text" name="question[]" placeholder="Enter question text" required aria-label="Question 1 text">
        <label>Optional Image:</label>
        <input type="file" name="question_images[]" accept="image/*" aria-label="Upload image for question 1">
        <label>Choices:</label>
        <input type="text" name="choices[0][]" placeholder="Choice 1" required aria-label="Choice 1 for question 1">
        <input type="text" name="choices[0][]" placeholder="Choice 2" required aria-label="Choice 2 for question 1">
        <input type="text" name="choices[0][]" placeholder="Choice 3" aria-label="Choice 3 for question 1">
        <input type="text" name="choices[0][]" placeholder="Choice 4" aria-label="Choice 4 for question 1">
        <label>Correct Choice:</label>
        <select name="correct_choice[]" aria-label="Correct choice for question 1">
          <option value="0">Choice 1</option>
          <option value="1">Choice 2</option>
          <option value="2">Choice 3</option>
          <option value="3">Choice 4</option>
        </select>
        <label>Points for this question:</label>
        <input type="number" name="points[]" min="1" value="1" required aria-label="Points for question 1" class="points-input">
      </div>
    </div>

    <button type="button" class="add-btn" onclick="addQuestion()">+ Add Another Question</button>
    <br><br>
    <button type="submit" class="submit-btn">Create Quiz</button>
  </form>

  <div id="loaderOverlay">
    <div class="loader-text">Processing...</div>
    <div class="loader"></div>
  </div>

  <div id="successPopup" class="popup">
    <i class="fas fa-check-circle"></i> Quiz created successfully!
  </div>

<script>
let questionIndex = 1;

function addQuestion() {
  const container = document.getElementById("questions-container");
  const block = document.createElement("div");
  block.className = "question-block";
  block.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
      <h3>Question ${questionIndex + 1}</h3>
      <span class="points-display">1 pt</span>
    </div>
    <button type="button" class="delete-btn" onclick="this.parentElement.remove()">Delete <i class="fas fa-trash"></i></button>
    <input type="text" name="question[]" placeholder="Enter question text" required aria-label="Question ${questionIndex + 1} text">
    <label>Optional Image:</label>
    <input type="file" name="question_images[]" accept="image/*" aria-label="Upload image for question ${questionIndex + 1}">
    <label>Choices:</label>
    <input type="text" name="choices[${questionIndex}][]" placeholder="Choice 1" required aria-label="Choice 1 for question ${questionIndex + 1}">
    <input type="text" name="choices[${questionIndex}][]" placeholder="Choice 2" required aria-label="Choice 2 for question ${questionIndex + 1}">
    <input type="text" name="choices[${questionIndex}][]" placeholder="Choice 3" aria-label="Choice 3 for question ${questionIndex + 1}">
    <input type="text" name="choices[${questionIndex}][]" placeholder="Choice 4" aria-label="Choice 4 for question ${questionIndex + 1}">
    <label>Correct Choice:</label>
    <select name="correct_choice[]" aria-label="Correct choice for question ${questionIndex + 1}">
      <option value="0">Choice 1</option>
      <option value="1">Choice 2</option>
      <option value="2">Choice 3</option>
      <option value="3">Choice 4</option>
    </select>
    <label>Points for this question:</label>
    <input type="number" name="points[]" min="1" value="1" required aria-label="Points for question ${questionIndex + 1}" class="points-input">
  `;
  container.appendChild(block);

  const pointsInput = block.querySelector('.points-input');
  const pointsDisplay = block.querySelector('.points-display');
  pointsInput.addEventListener('input', () => {
    pointsDisplay.textContent = `${pointsInput.value} pt${pointsInput.value > 1 ? 's' : ''}`;
  });

  questionIndex++;
}

document.querySelectorAll('.points-input').forEach(input => {
  const pointsDisplay = input.closest('.question-block').querySelector('.points-display');
  input.addEventListener('input', () => {
    pointsDisplay.textContent = `${input.value} pt${input.value > 1 ? 's' : ''}`;
  });
});

document.addEventListener("DOMContentLoaded", function () {
  const form = document.querySelector("#quizForm");
  const loader = document.getElementById("loaderOverlay");
  const popup = document.getElementById("successPopup");

  if (form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      loader.style.display = "flex";
      const formData = new FormData(form);
      console.log('Form data:', Object.fromEntries(formData.entries()));

      fetch("create_quiz.php", {
        method: "POST",
        body: formData,
        redirect: 'manual'
      })
      .then(res => {
        console.log('Response status:', res.status);
        if (res.type === 'opaqueredirect') {
          loader.style.display = "none";
          alert("Session expired. Please log in again.");
          window.location.href = "index.php";
          return Promise.reject(new Error('Redirect detected'));
        }
        return res.text().then(text => {
          try {
            return JSON.parse(text);
          } catch (e) {
            console.error('Non-JSON response:', text);
            throw new Error('Invalid server response');
          }
        });
      })
      .then(data => {
        loader.style.display = "none";
        console.log('Response data:', data);
        if (data.success) {
          popup.classList.add("show");
          setTimeout(() => {
            popup.classList.remove("show");
            window.location.href = data.redirect || "teacher_quizzes.php";
          }, 2000);
          form.reset();
        } else {
          alert("❌ Error: " + (data.message || "Failed to create quiz."));
        }
      })
      .catch(err => {
        loader.style.display = "none";
        console.error('Fetch error:', err);
        alert("❌ Something went wrong, please try again!");
      });
    });
  }
});

// Listen for changes on the layout radio buttons
document.querySelectorAll('input[name="layout_mode"]').forEach(radio => {
    radio.addEventListener('change', function() {
        const randomizeDiv = document.getElementById('randomizeOption');
        if (this.value === 'multi_page') {
            // Show with a nice fade-in effect if you want, or just display:block
            randomizeDiv.style.display = 'block';
        } else {
            randomizeDiv.style.display = 'none';
            document.getElementById('shuffleCheckbox').checked = false; // Reset it
        }
    });
});
</script>

<script>
document.getElementById('isSummativeCheckbox').addEventListener('change', function() {
    const weightContainer = document.getElementById('weightContainer');
    weightContainer.style.display = this.checked ? 'block' : 'none';
    if (!this.checked) {
        document.getElementById('weight_percent').value = '';
    }
});

// Trigger on page load (in case of form errors)
document.addEventListener('DOMContentLoaded', function() {
    const checkbox = document.getElementById('isSummativeCheckbox');
    if (checkbox) {
        const event = new Event('change');
        checkbox.dispatchEvent(event);
    }
});
</script>
</body>
</html>