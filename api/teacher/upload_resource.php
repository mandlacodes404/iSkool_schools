<?php
session_start();
require_once dirname(__DIR__, 2) . '/config.php';
require_once dirname(__DIR__, 2) . '/school_upload_helper.php';  // ← NEW
require_once dirname(__DIR__, 2) . '/push_functions.php';
require dirname(__DIR__, 2) . '/vendor/autoload.php';

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

header('Content-Type: application/json');

if (!isset($_SESSION['email']) || $_SESSION['role'] !== 'teacher') {
    echo json_encode(['success' => false, 'error' => 'Unauthorized']);
    exit();
}

$email       = $_SESSION['email'];
$maxFileSize = 10 * 1024 * 1024;

$yearResult = $conn->query("SELECT id FROM academic_years WHERE is_current = 1 LIMIT 1");
if ($yearResult->num_rows === 0) {
    echo json_encode(['success' => false, 'error' => 'No active academic year']);
    exit();
}
$current_year_id = (int)$yearResult->fetch_assoc()['id'];

$termResult   = $conn->query("SELECT current_global_term FROM platform_settings LIMIT 1");
$current_term = $termResult ? (int)$termResult->fetch_assoc()['current_global_term'] : 1;

$title      = trim($_POST['title'] ?? '');
$classId    = (int)($_POST['class_id'] ?? 0);
$forceEmail = isset($_POST['force_email']);

// Teacher display name
$stmtUser = $conn->prepare("SELECT title, name, surname FROM users WHERE email = ? LIMIT 1");
$stmtUser->bind_param("s", $email);
$stmtUser->execute();
$userData = $stmtUser->get_result()->fetch_assoc();
$stmtUser->close();

$teacherDisplayName = "Teacher";
if ($userData) {
    $tTitle       = $userData['title'] ?? '';
    $tName        = $userData['name'] ?? '';
    $tSurname     = $userData['surname'] ?? '';
    $firstInitial = !empty($tName) ? strtoupper(substr(trim($tName), 0, 1)) . "." : "";
    $teacherDisplayName = trim("$tTitle $firstInitial $tSurname");
}

// School name
$schoolNameResult = $conn->query("SELECT setting_value FROM school_name WHERE setting_key = 'school_name' LIMIT 1");
$schoolName = ($schoolNameResult && $row = $schoolNameResult->fetch_assoc())
    ? $row['setting_value']
    : $_SERVER['HTTP_HOST'];

if (empty($title)) {
    echo json_encode(['success' => false, 'error' => 'Please enter a title.']);
    exit();
}
if ($classId <= 0) {
    echo json_encode(['success' => false, 'error' => 'Please select a class.']);
    exit();
}
if (!isset($_FILES['resource']) || $_FILES['resource']['error'] !== UPLOAD_ERR_OK) {
    echo json_encode(['success' => false, 'error' => 'File upload failed.']);
    exit();
}

$file = $_FILES['resource'];
if ($file['size'] > $maxFileSize) {
    echo json_encode(['success' => false, 'error' => 'File too large. Max 10MB.']);
    exit();
}

$allowedTypes = ['pdf', 'doc', 'docx', 'ppt', 'pptx', 'jpg', 'jpeg', 'png', 'zip'];
$ext          = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
if (!in_array($ext, $allowedTypes)) {
    echo json_encode(['success' => false, 'error' => 'Invalid file type.']);
    exit();
}

// ── CHANGED: school-scoped upload directory ──────────────────────────────────
$baseDir    = dirname(__DIR__, 2) . '/resources';
$uploadDir  = getSchoolUploadDir($conn, $baseDir);
$schoolSlug = getSchoolSlug($conn);
// ─────────────────────────────────────────────────────────────────────────────

$filename   = time() . '_' . preg_replace("/[^A-Za-z0-9._-]/", "", basename($file['name']));
$targetPath = $uploadDir . $filename;

if (!move_uploaded_file($file['tmp_name'], $targetPath)) {
    echo json_encode(['success' => false, 'error' => 'Failed to save file.']);
    exit();
}

// filename stored in DB includes the school slug subfolder so serving works correctly
$storedFilename = $schoolSlug . '/' . $filename;

$stmt = $conn->prepare("
    INSERT INTO resources (title, filename, class_id, uploaded_by, academic_year_id, term_number, uploaded_at)
    VALUES (?, ?, ?, ?, ?, ?, NOW())
");
$stmt->bind_param("ssisii", $title, $storedFilename, $classId, $email, $current_year_id, $current_term);
$stmt->execute();
$stmt->close();

// Notify learners
$cleanBaseUrl = rtrim(BASE_URL, '/');
$resourceLink = $cleanBaseUrl . "/learner_dashboard.php?page=resource_list.php";
$learnerStmt  = $conn->prepare("
    SELECT u.email, u.name 
    FROM users u
    JOIN class_students cs ON u.email = cs.student_email
    WHERE cs.class_id = ? AND cs.academic_year_id = ? AND u.role = 'learner'
");
$learnerStmt->bind_param("ii", $classId, $current_year_id);
$learnerStmt->execute();
$learners = $learnerStmt->get_result();

while ($learner = $learners->fetch_assoc()) {
    $lEmail     = $learner['email'];
    $lName      = $learner['name'];
    $isPushSent = false;

    $checkSub = $conn->prepare("SELECT id FROM user_subscriptions WHERE user_email = ? LIMIT 1");
    $checkSub->bind_param("s", $lEmail);
    $checkSub->execute();
    if ($checkSub->get_result()->num_rows > 0) {
        $isPushSent = sendPushToUser($conn, $lEmail, $title, "A study material has been uploaded.", $resourceLink);
    }
    $checkSub->close();

    if (!$isPushSent || $forceEmail) {
        try {
            $mail             = new PHPMailer(true);
            $mail->isSMTP();
            $mail->Host       = 'iskool.online';
            $mail->SMTPAuth   = true;
            $mail->Username   = 'noreply@iskool.online';
            $mail->Password   = 'ogeQkRitRfdy';
            $mail->SMTPSecure = PHPMailer::ENCRYPTION_SMTPS;
            $mail->Port       = 465;
            $mail->setFrom('noreply@iskool.online', 'iSkool');
            $mail->addAddress($lEmail);
            $mail->isHTML(true);
            $mail->Subject = "New Resource: $title";
            $mail->Body    = '
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',sans-serif;">

<table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:40px 20px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

  <!-- HEADER -->
  <tr>
    <td style="background:#0d1117;border-radius:12px 12px 0 0;padding:32px 40px;text-align:center;">
      <img src="https://iskool.online/apple-touch-icon.png"
           width="72" height="72" alt="iSkool"
           style="display:block;margin:0 auto 12px;border-radius:14px;border:2px solid rgba(57,213,193,0.3);">
      <p style="margin:0;font-size:12px;color:#8b949e;letter-spacing:2px;text-transform:uppercase;">
        iSkool
      </p>
    </td>
  </tr>

  <!-- HERO -->
  

  <!-- SCHOOL + TEACHER ROW -->
  <tr>
    <td style="background:#161b22;padding:14px 40px;text-align:center;border-bottom:1px solid #21262d;">
      <p style="margin:0;font-size:13px;color:#8b949e;">
        
        <span style="color:#39d5c1;">' . htmlspecialchars($schoolName) . '</span>
      </p>
    </td>
  </tr>

  <!-- BODY -->
  <tr>
    <td style="background:#ffffff;padding:40px;">

      <p style="margin:0 0 24px;font-size:15px;color:#333;line-height:1.6;">
        Hi <strong>' . htmlspecialchars($lName) . '</strong>, your teacher has uploaded a new resource for your class.
      </p>

      <!-- RESOURCE TITLE BOX -->
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8f9fa;border:1px solid #e9ecef;border-left:4px solid #39d5c1;border-radius:4px;margin-bottom:24px;">
        <tr>
          <td style="padding:16px 20px;">
            <p style="margin:0;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#39d5c1;margin-bottom:6px;">
              Resource
            </p>
            <p style="margin:0;font-size:18px;font-weight:700;color:#0d1117;">
              📎 ' . htmlspecialchars($title) . '
            </p>
          </td>
        </tr>
      </table>

      <!-- INFO BOX -->
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#e8f4fd;border:1px solid #b3d9f7;border-radius:8px;margin-bottom:28px;">
        <tr>
          <td style="padding:16px 20px;">
            <p style="margin:0;font-size:13px;color:#1565c0;line-height:1.7;">
              Log in to your iSkool dashboard to view and download this resource.
              Resources are available anytime from your <strong>Resources</strong> section.
            </p>
          </td>
        </tr>
      </table>

      <!-- DIVIDER -->
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
        <tr>
          <td style="border-top:1px solid #f0ede6;padding:0;"></td>
        </tr>
      </table>

      <!-- FROM -->
      <p style="margin:0;font-size:13px;color:#888;">
        Uploaded by
        <strong style="color:#333;">' . htmlspecialchars($teacherDisplayName) . '</strong>
        
      </p>

    </td>
  </tr>

  <!-- FOOTER -->
  <tr>
    <td style="background:#0d1117;border-radius:0 0 12px 12px;padding:24px 40px;text-align:center;">
      <p style="margin:0 0 4px;font-size:13px;color:#8b949e;">
        iSkool LMS · Johannesburg, South Africa
      </p>
      <p style="margin:0;font-size:12px;color:#484f58;">
        <a href="https://iskool.online" style="color:#39d5c1;text-decoration:none;">www.iskool.online</a>
        &nbsp;·&nbsp;
        <a href="mailto:support@iskool.online" style="color:#484f58;text-decoration:none;">support@iskool.online</a>
      </p>
      <p style="margin:8px 0 0;font-size:11px;color:#484f58;">
        &copy; ' . date("Y") . ' iSkool LMS. All rights reserved.
      </p>
    </td>
  </tr>

</table>
</td></tr>
</table>
</body>
</html>';
            $mail->send();
        } catch (Exception $e) {
            error_log("Email failed to $lEmail: " . $mail->ErrorInfo);
        }
    }
}
$learnerStmt->close();

echo json_encode(['success' => true]);