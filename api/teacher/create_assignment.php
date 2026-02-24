<?php
session_start();
require_once dirname(__DIR__, 2) . '/config.php';

header('Content-Type: application/json');

if (!isset($_SESSION['email']) || $_SESSION['role'] !== 'teacher') {
    echo json_encode(['error' => 'Unauthorized']);
    exit();
}

require_once dirname(__DIR__, 2) . '/push_functions.php';
require_once dirname(__DIR__, 2) . '/vendor/autoload.php';

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

$email = $_SESSION['email'];

// Get teacher display name
$stmtUser = $conn->prepare("SELECT title, name, surname FROM users WHERE email = ? LIMIT 1");
$stmtUser->bind_param("s", $email);
$stmtUser->execute();
$userData = $stmtUser->get_result()->fetch_assoc();
$stmtUser->close();

$teacherDisplayName = 'Teacher';
if ($userData) {
    $firstInitial       = !empty($userData['name']) ? strtoupper(substr(trim($userData['name']), 0, 1)) . '.' : '';
    $teacherDisplayName = trim($userData['title'] . ' ' . $firstInitial . ' ' . $userData['surname']);
}

// Get current academic year
$yearResult      = $conn->query("SELECT id FROM academic_years WHERE is_current = 1 LIMIT 1");
$current_year_id = (int)$yearResult->fetch_assoc()['id'];

if (!$current_year_id) {
    echo json_encode(['error' => 'No active academic year found.']);
    exit();
}

// Get current term
$termResult       = $conn->query("SELECT current_global_term FROM platform_settings LIMIT 1");
$current_term     = (int)$termResult->fetch_assoc()['current_global_term'];

// Validate inputs
$title       = trim($_POST['title'] ?? '');
$description = trim($_POST['description'] ?? '');
$due_date    = $_POST['due_date'] ?? '';
$class_id    = (int)($_POST['class_id'] ?? 0);
$force_email = isset($_POST['force_email']);

if (!$title || !$description || !$due_date || $class_id < 1) {
    echo json_encode(['error' => 'All required fields must be filled.']);
    exit();
}

// Handle file upload
$filePath    = null;
$hasAttachment  = false;
$attachmentName = '';

if (isset($_FILES['attachment']) && $_FILES['attachment']['error'] === UPLOAD_ERR_OK) {
    $uploadDir = dirname(__DIR__, 2) . '/assignment_Uploads/';
    if (!is_dir($uploadDir)) mkdir($uploadDir, 0777, true);
    $filename = time() . '_' . basename($_FILES['attachment']['name']);
    $filePath = 'assignment_Uploads/' . $filename;
    if (move_uploaded_file($_FILES['attachment']['tmp_name'], $uploadDir . $filename)) {
        $hasAttachment  = true;
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
    $current_year_id,
    $current_term
);

if (!$stmt->execute()) {
    echo json_encode(['error' => 'Failed to save assignment.']);
    exit();
}
$assignment_id = $stmt->insert_id;
$stmt->close();

// School name
$dbName     = $conn->query("SELECT DATABASE()")->fetch_row()[0];
$schoolName = ucwords(str_replace(['iskool_', '_'], [' ', ' '], $dbName));

// Formatted due date
$formatted_due_date = date("l, F j, Y", strtotime($due_date));

// Assignment link
$cleanBaseUrl   = rtrim(BASE_URL, '/');
$assignmentLink = $cleanBaseUrl . "/learner_dashboard.php?page=learner_assignments.php";

// Email body
$emailBody = '
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<style>
  body { margin:0; padding:0; font-family:Verdana,Arial,sans-serif; font-size:16px; line-height:1.6; }
  .wrapper { max-width:600px; margin:30px auto; border-radius:16px; overflow:hidden; box-shadow:0 8px 25px rgba(0,0,0,0.2); }
  .header { padding:40px; text-align:center; background:#161b22; }
  .header h1 { margin:0; font-size:32px; font-weight:bold; color:#4fd1c5; }
  .body { padding:40px; background:#1e1e1e; color:#c9d1d9; }
  .body h2 { color:#4fd1c5; font-size:24px; margin-bottom:20px; }
  .highlight { background:#2d333b; padding:20px; border-radius:12px; margin:25px 0; border-left:5px solid #4fd1c5; }
  .cta-button { display:inline-block; padding:16px 32px; margin:30px 0; background:#4fd1c5; color:#000; font-weight:bold; border-radius:30px; text-decoration:none; font-size:17px; }
  .footer { padding:30px; text-align:center; background:#161b22; font-size:14px; color:#8b949e; }
  .due-date { font-weight:bold; color:#4fd1c5; font-size:18px; }
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
        ($hasAttachment ? '<br><br><em>📎 Attachment: ' . htmlspecialchars($attachmentName) . '</em>' : '') . '<br><br>
        <em>Assigned by: ' . htmlspecialchars($teacherDisplayName) . '</em>
      </div>
      <p style="text-align:center;">
        <a href="' . $assignmentLink . '" class="cta-button">View Assignment</a>
      </p>
      <p>Please complete and submit before the due date. Good luck!</p>
    </div>
    <div class="footer">
      <p>Best regards,<br>' . htmlspecialchars($schoolName) . '</p>
      <p>Powered by iSkool &copy; ' . date("Y") . '</p>
    </div>
  </div>
</body>
</html>';

// Get learners in class
$learnersQuery = $conn->prepare("
    SELECT DISTINCT u.email, COALESCE(u.name, u.email) AS name
    FROM users u
    JOIN class_students cs ON u.email = cs.student_email
    WHERE cs.class_id = ?
      AND cs.academic_year_id = ?
      AND u.role = 'learner'
");
$learnersQuery->bind_param("ii", $class_id, $current_year_id);
$learnersQuery->execute();
$learnersResult = $learnersQuery->get_result();

while ($learner = $learnersResult->fetch_assoc()) {
    $currentEmail = $learner['email'];
    $isPushSent   = false;

    // Try push first
    $checkSub = $conn->prepare("SELECT id FROM user_subscriptions WHERE user_email = ? LIMIT 1");
    $checkSub->bind_param("s", $currentEmail);
    $checkSub->execute();
    $subResult = $checkSub->get_result();
    $checkSub->close();

    if ($subResult->num_rows > 0) {
        $pushTitle  = $teacherDisplayName . ': ' . $title;
        $isPushSent = sendPushToUser(
            $conn,
            $currentEmail,
            $pushTitle,
            'Due: ' . $formatted_due_date,
            $assignmentLink
        );
    }

    // Email if push failed or force_email checked
    if (!$isPushSent || $force_email) {
        try {
            $mail             = new PHPMailer(true);
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
            $mail->Subject = 'New Assignment: ' . $title;
            $mail->Body    = str_replace('{{name}}', htmlspecialchars($learner['name']), $emailBody);
            $mail->send();
        } catch (Exception $e) {
            error_log("Assignment email failed ({$currentEmail}): " . $mail->ErrorInfo);
        }
    }
}
$learnersQuery->close();

echo json_encode(['success' => true, 'assignment_id' => $assignment_id]);