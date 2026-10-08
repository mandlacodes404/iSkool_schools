<?php
require_once __DIR__ . '/../../auth/session_guard.php';
require_once __DIR__ . '/../../auth/csrf_helper.php';
require_once dirname(__DIR__, 2) . '/config.php';
require_once dirname(__DIR__, 2) . '/includes/teacher_class_access.php';
require_once dirname(__DIR__, 2) . '/push_functions.php';
require dirname(__DIR__, 2) . '/vendor/autoload.php';

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

header('Content-Type: application/json');

if (!isset($_SESSION['email']) || $_SESSION['role'] !== 'teacher') {
    echo json_encode(['success' => false, 'error' => 'Unauthorized']);
    exit();
}

verify_csrf_token();

$email = $_SESSION['email'];

// Teacher display name
$stmtUser = $conn->prepare("SELECT title, name, surname FROM users WHERE email = ? LIMIT 1");
$stmtUser->bind_param("s", $email);
$stmtUser->execute();
$userData = $stmtUser->get_result()->fetch_assoc();
$stmtUser->close();

$teacherDisplayName = "Teacher";
if ($userData) {
    $tTitle      = $userData['title'] ?? '';
    $tName       = $userData['name'] ?? '';
    $tSurname    = $userData['surname'] ?? '';
    $firstInitial = !empty($tName) ? strtoupper(substr(trim($tName), 0, 1)) . "." : "";
    $teacherDisplayName = trim("$tTitle $firstInitial $tSurname");
}

// School name
$schoolNameResult = $conn->query("SELECT setting_value FROM school_name WHERE setting_key = 'school_name' LIMIT 1");
$schoolName = ($schoolNameResult && $row = $schoolNameResult->fetch_assoc())
    ? $row['setting_value']
    : $_SERVER['HTTP_HOST'];

// Academic year
$yearResult = $conn->query("SELECT id FROM academic_years WHERE is_current = 1 LIMIT 1");
if ($yearResult->num_rows === 0) {
    echo json_encode(['success' => false, 'error' => 'No active academic year']);
    exit();
}
$current_year_id = (int)$yearResult->fetch_assoc()['id'];

// Current term
$termResult      = $conn->query("SELECT current_global_term FROM platform_settings LIMIT 1");
$current_term    = $termResult ? (int)$termResult->fetch_assoc()['current_global_term'] : 1;

// Form data
$title      = trim($_POST['title'] ?? '');
$msg        = trim($_POST['message'] ?? '');
$class_id   = (int)($_POST['class_id'] ?? 0);
$send_to    = $_POST['send_to'] ?? 'learners';
$forceEmail = isset($_POST['force_email']);

if (empty($title) || empty($msg) || $class_id <= 0) {
    echo json_encode(['success' => false, 'error' => 'Please fill in all fields.']);
    exit();
}
if (!teacher_has_class_access($conn, $email, $class_id)) {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'You do not have access to this class.']);
    exit();
}

// Insert announcement
$stmt = $conn->prepare("
    INSERT INTO announcements 
    (class_id, title, message, created_by, academic_year_id, term_number, send_to) 
    VALUES (?, ?, ?, ?, ?, ?, ?)
");
$stmt->bind_param("issssis", $class_id, $title, $msg, $email, $current_year_id, $current_term, $send_to);
$stmt->execute();
$announcement_id = $stmt->insert_id;
$stmt->close();

// Get recipients
if ($send_to === 'parents') {
    $recipientStmt = $conn->prepare("
        SELECT DISTINCT u.email, u.name 
        FROM users u 
        JOIN parent_classes pc ON u.email = pc.parent_email
        WHERE pc.class_id = ? AND pc.academic_year_id = ? AND u.role = 'parent'
    ");
} else {
    $recipientStmt = $conn->prepare("
        SELECT DISTINCT u.email, u.name 
        FROM users u 
        JOIN class_students cs ON u.email = cs.student_email
        WHERE cs.class_id = ? AND cs.academic_year_id = ? AND u.role = 'learner'
    ");
}
$recipientStmt->bind_param("ii", $class_id, $current_year_id);
$recipientStmt->execute();
$recipients = $recipientStmt->get_result();

$cleanBaseUrl       = rtrim(BASE_URL, '/');
$announcementLink = $cleanBaseUrl . "/learner_dashboard.php?page=announcement_detail&id=" . $announcement_id;
$fullPushTitle      = $teacherDisplayName . ": " . $title;

while ($recipient = $recipients->fetch_assoc()) {
    $rEmail     = $recipient['email'];
    $rName      = $recipient['name'];
    $isPushSent = false;

    $checkSub = $conn->prepare("SELECT id FROM user_subscriptions WHERE user_email = ? LIMIT 1");
    $checkSub->bind_param("s", $rEmail);
    $checkSub->execute();
    $subResult = $checkSub->get_result();
    $checkSub->close();

    // Release this result before sendPushToUser() starts its own query on
    // the same MySQLi connection. This is the working assignment sequence.
    if ($subResult->num_rows > 0) {
        $isPushSent = sendPushToUser($conn, $rEmail, $fullPushTitle, $msg, $announcementLink, $schoolName);
    }

    // Match quiz notifications: fall back to email when push is unavailable,
    // or send both channels when the teacher explicitly selects email.
    if (!$isPushSent || $forceEmail) {
        try {
            $mail = new PHPMailer(true);
            $mail->isSMTP();
            $mail->Host       = getenv('SMTP_HOST');
            $mail->SMTPAuth   = true;
            $mail->Username   = getenv('SMTP_USER');
            $mail->Password   = getenv('SMTP_PASSWORD');
            $mail->SMTPSecure = PHPMailer::ENCRYPTION_SMTPS;
            $mail->Port       = getenv('SMTP_PORT');
            $from_email       = getenv('SMTP_FROM');
            $mail->setFrom($from_email, $schoolName);
            $mail->addAddress($rEmail);
            $mail->isHTML(true);
            $mail->Subject = htmlspecialchars($title);
           $mail->Body = '
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

  <!-- Announcement title -->
  <p style="margin:0 0 20px;font-size:28px;font-weight:700;color:#0d0d0d;line-height:1.25;letter-spacing:-0.5px;font-family:\'DM Sans\',Helvetica,Arial,sans-serif;">' . htmlspecialchars($title) . '</p>

  <!-- Thin divider -->
  <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;"><tr><td style="border-top:1px solid #e5e5e5;"></td></tr></table>

  <!-- Message body -->
  <p style="margin:0 0 36px;font-size:16px;color:#2d2d2d;line-height:1.8;font-family:\'DM Sans\',Helvetica,Arial,sans-serif;">' . nl2br(htmlspecialchars($msg)) . '</p>

  <!-- Sent by -->
  <p style="margin:0 0 40px;font-size:14px;color:#888888;font-family:\'DM Sans\',Helvetica,Arial,sans-serif;">Sent by <span style="color:#0d0d0d;font-weight:600;">' . htmlspecialchars($teacherDisplayName) . '</span></p>

  <!-- Footer divider -->
  <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;"><tr><td style="border-top:1px solid #e5e5e5;"></td></tr></table>

  <!-- Footer -->
  <p style="margin:0;font-size:12px;color:#aaaaaa;line-height:1.6;font-family:\'DM Sans\',Helvetica,Arial,sans-serif;">
    ' . htmlspecialchars($schoolName) . ' &nbsp;&middot;&nbsp; Powered by <a href="https://iskool.xyz" style="color:#aaaaaa;text-decoration:underline;">iSkool</a>
  </p>

</td></tr>
</table>
</body>
</html>';
            $mail->send();
        } catch (Exception $e) {
            error_log("Email failed to $rEmail: " . $mail->ErrorInfo);
        }
    }
}
$recipientStmt->close();

echo json_encode(['success' => true]);
