<?php
require_once __DIR__ . '/../../auth/session_guard.php';
require_once __DIR__ . '/../../auth/csrf_helper.php';
require_once dirname(__DIR__, 2) . '/config.php';
require_once dirname(__DIR__, 2) . '/school_upload_helper.php';  // ← NEW

header('Content-Type: application/json');

if (!isset($_SESSION['email']) || $_SESSION['role'] !== 'teacher') {
    echo json_encode(['error' => 'Unauthorized']);
    exit();
}

verify_csrf_token();

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
$yearStmt = $conn->prepare("SELECT id FROM academic_years WHERE is_current = 1 LIMIT 1");
$yearStmt->execute();
$yearResult = $yearStmt->get_result();
$current_year_id = (int)($yearResult->fetch_assoc()['id'] ?? 0);
$yearStmt->close();

if (!$current_year_id) {
    echo json_encode(['error' => 'No active academic year found.']);
    exit();
}

// Get current term
$termStmt = $conn->prepare("SELECT current_global_term FROM platform_settings LIMIT 1");
$termStmt->execute();
$termResult = $termStmt->get_result();
$current_term = (int)($termResult->fetch_assoc()['current_global_term'] ?? 1);
$termStmt->close();

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
$filePath       = null;
$hasAttachment  = false;
$attachmentName = '';

if (isset($_FILES['attachment']) && $_FILES['attachment']['error'] !== UPLOAD_ERR_NO_FILE && $_FILES['attachment']['error'] !== UPLOAD_ERR_OK) {
    echo json_encode(['error' => 'File upload failed.']);
    exit();
}

if (isset($_FILES['attachment']) && $_FILES['attachment']['error'] === UPLOAD_ERR_OK) {
    $safe_name = preg_replace('/[^a-zA-Z0-9._-]/', '_', basename($_FILES['attachment']['name']));
    $ext = strtolower(pathinfo($safe_name, PATHINFO_EXTENSION));
    $max_size = 50 * 1024 * 1024;
    $allowed = ['pdf', 'doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx', 'jpg', 'jpeg', 'png', 'gif', 'webp', 'mp4', 'mov', 'avi', 'zip', 'rar', 'txt', 'csv'];
    $blocked = ['php', 'phtml', 'phar', 'php3', 'php4', 'php5', 'php7', 'cgi', 'pl', 'asp', 'aspx', 'js', 'html', 'htm', 'svg'];
    $allowedMimeTypes = [
        'pdf' => ['application/pdf'],
        'doc' => ['application/msword', 'application/vnd.ms-office', 'application/x-cfb'],
        'docx' => ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/zip'],
        'ppt' => ['application/vnd.ms-powerpoint', 'application/vnd.ms-office', 'application/x-cfb'],
        'pptx' => ['application/vnd.openxmlformats-officedocument.presentationml.presentation', 'application/zip'],
        'xls' => ['application/vnd.ms-excel', 'application/vnd.ms-office', 'application/x-cfb'],
        'xlsx' => ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/zip'],
        'jpg' => ['image/jpeg'],
        'jpeg' => ['image/jpeg'],
        'png' => ['image/png'],
        'gif' => ['image/gif'],
        'webp' => ['image/webp'],
        'mp4' => ['video/mp4'],
        'mov' => ['video/quicktime'],
        'avi' => ['video/x-msvideo'],
        'zip' => ['application/zip', 'application/x-zip-compressed', 'multipart/x-zip'],
        'rar' => ['application/vnd.rar', 'application/x-rar-compressed'],
        'txt' => ['text/plain'],
        'csv' => ['text/csv', 'text/plain', 'application/vnd.ms-excel']
    ];

    if ($_FILES['attachment']['size'] > $max_size) {
        echo json_encode(['error' => 'File too large. Maximum size is 50MB.']);
        exit();
    }
    if ($safe_name === '' || in_array($ext, $blocked, true) || !in_array($ext, $allowed, true)) {
        echo json_encode(['error' => 'File type not allowed.']);
        exit();
    }

    $finfo = new finfo(FILEINFO_MIME_TYPE);
    $mime = $finfo->file($_FILES['attachment']['tmp_name']);
    if (!isset($allowedMimeTypes[$ext]) || !in_array($mime, $allowedMimeTypes[$ext], true)) {
        echo json_encode(['error' => 'File type not allowed.']);
        exit();
    }

    // ── CHANGED: school-scoped upload directory ──────────────────────────────
    $baseDir   = dirname(__DIR__, 2) . '/assignment_Uploads';
    $uploadDir = getSchoolUploadDir($conn, $baseDir);
    $schoolSlug = getSchoolSlug($conn);
    // ────────────────────────────────────────────────────────────────────────

    $filename = time() . '_' . $safe_name;

    // file_url stored in DB as relative path (used by learner to download)
    $filePath = 'assignment_Uploads/' . $schoolSlug . '/' . $filename;

    if (move_uploaded_file($_FILES['attachment']['tmp_name'], $uploadDir . $filename)) {
        $hasAttachment  = true;
        $attachmentName = $safe_name;
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
$schoolNameStmt = $conn->prepare("SELECT setting_value FROM school_name WHERE setting_key = 'school_name' LIMIT 1");
$schoolNameStmt->execute();
$schoolNameResult = $schoolNameStmt->get_result();
$schoolName = ($schoolNameResult && $row = $schoolNameResult->fetch_assoc())
    ? $row['setting_value']
    : $_SERVER['HTTP_HOST'];
$schoolNameStmt->close();

// Formatted due date
$formatted_due_date = date("l, F j, Y", strtotime($due_date));

// Assignment link
$cleanBaseUrl   = rtrim(BASE_URL, '/');
$assignmentLink = $cleanBaseUrl . "/learner_dashboard.php?page=assignment_detail&id=" . $assignment_id;
// Email body
$emailBody = '
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&display=swap" rel="stylesheet">
</head>
<body style="margin:0;padding:0;background:#ffffff;font-family:\'DM Sans\',Helvetica,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;">
<tr><td style="padding:48px 32px 40px;">

  <!-- School name in red -->
  <p style="margin:0 0 28px;font-size:13px;font-weight:700;color:#cc1f1f;letter-spacing:0.8px;text-transform:uppercase;font-family:\'DM Sans\',Helvetica,Arial,sans-serif;">' . htmlspecialchars($schoolName) . '</p>

  <!-- Title -->
  <p style="margin:0 0 20px;font-size:28px;font-weight:700;color:#0d0d0d;line-height:1.25;letter-spacing:-0.5px;font-family:\'DM Sans\',Helvetica,Arial,sans-serif;">New assignment: ' . htmlspecialchars($title) . '</p>

  <!-- Divider -->
  <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;"><tr><td style="border-top:1px solid #e5e5e5;"></td></tr></table>

  <!-- Greeting -->
  <p style="margin:0 0 16px;font-size:16px;color:#2d2d2d;line-height:1.8;font-family:\'DM Sans\',Helvetica,Arial,sans-serif;">Hi <strong>{{name}}</strong>, a new assignment has been posted in your class.</p>

  <!-- Description -->
  <p style="margin:0 0 28px;font-size:16px;color:#2d2d2d;line-height:1.8;font-family:\'DM Sans\',Helvetica,Arial,sans-serif;">' . nl2br(htmlspecialchars($description)) . '</p>

  <!-- Meta rows -->
  <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
    <tr>
      <td style="padding:8px 0;font-size:14px;color:#888888;width:120px;vertical-align:top;font-family:\'DM Sans\',Helvetica,Arial,sans-serif;">Due date</td>
      <td style="padding:8px 0;font-size:14px;color:#0d0d0d;font-weight:600;font-family:\'DM Sans\',Helvetica,Arial,sans-serif;">' . $formatted_due_date . '</td>
    </tr>
    ' . ($hasAttachment ? '
    <tr>
      <td style="padding:8px 0;font-size:14px;color:#888888;vertical-align:top;font-family:\'DM Sans\',Helvetica,Arial,sans-serif;">Attachment</td>
      <td style="padding:8px 0;font-size:14px;color:#0d0d0d;font-family:\'DM Sans\',Helvetica,Arial,sans-serif;">' . htmlspecialchars($attachmentName) . '</td>
    </tr>' : '') . '
  </table>

  <!-- Assigned by -->
  <p style="margin:0 0 40px;font-size:14px;color:#888888;font-family:\'DM Sans\',Helvetica,Arial,sans-serif;">Assigned by <span style="color:#0d0d0d;font-weight:600;">' . htmlspecialchars($teacherDisplayName) . '</span></p>

  <!-- Footer divider -->
  <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;"><tr><td style="border-top:1px solid #e5e5e5;"></td></tr></table>

  <!-- Footer -->
  <p style="margin:0;font-size:12px;color:#aaaaaa;line-height:1.6;font-family:\'DM Sans\',Helvetica,Arial,sans-serif;">
    ' . htmlspecialchars($schoolName) . ' &nbsp;&middot;&nbsp; Powered by <a href="https://iskool.online" style="color:#aaaaaa;text-decoration:underline;">iSkool</a>
  </p>

</td></tr>
</table>
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
        $pushTitle  = '📋 New Assignment: ' . $title;
        $isPushSent = sendPushToUser(
            $conn,
            $currentEmail,
            $pushTitle,
            'Due: ' . $formatted_due_date,
            $assignmentLink,
            $schoolName,
            'https://iskool.online/assets/icons/assignment.png'
        );
    }

    // Email is an explicit teacher choice, never a push-delivery fallback.
    if ($force_email) {
        try {
            $mail             = new PHPMailer(true);
            $mail->isSMTP();
            $mail->Host       = getenv('SMTP_HOST');
            $mail->SMTPAuth   = true;
            $mail->Username   = getenv('SMTP_USER');
            $mail->Password   = getenv('SMTP_PASSWORD');
            $mail->SMTPSecure = PHPMailer::ENCRYPTION_SMTPS;
            $mail->Port       = getenv('SMTP_PORT');

            $from_email = getenv('SMTP_FROM');
            $mail->setFrom($from_email, $schoolName);
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
