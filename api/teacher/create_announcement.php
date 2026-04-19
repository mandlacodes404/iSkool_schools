<?php
session_start();
require_once dirname(__DIR__, 2) . '/config.php';
require_once dirname(__DIR__, 2) . '/push_functions.php';
require dirname(__DIR__, 2) . '/vendor/autoload.php';

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

header('Content-Type: application/json');

if (!isset($_SESSION['email']) || $_SESSION['role'] !== 'teacher') {
    echo json_encode(['success' => false, 'error' => 'Unauthorized']);
    exit();
}

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

// Insert announcement
$stmt = $conn->prepare("
    INSERT INTO announcements 
    (class_id, title, message, created_by, academic_year_id, term_number, send_to) 
    VALUES (?, ?, ?, ?, ?, ?, ?)
");
$stmt->bind_param("issssis", $class_id, $title, $msg, $email, $current_year_id, $current_term, $send_to);
$stmt->execute();
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
$announcementLink = $cleanBaseUrl . "/learner_dashboard.php?page=announcement_list.php";
$fullPushTitle      = $teacherDisplayName . ": " . $title;

while ($recipient = $recipients->fetch_assoc()) {
    $rEmail     = $recipient['email'];
    $rName      = $recipient['name'];
    $isPushSent = false;

    $checkSub = $conn->prepare("SELECT id FROM user_subscriptions WHERE user_email = ? LIMIT 1");
    $checkSub->bind_param("s", $rEmail);
    $checkSub->execute();
    if ($checkSub->get_result()->num_rows > 0) {
        $isPushSent = sendPushToUser($conn, $rEmail, $fullPushTitle, $msg, $announcementLink);
    }
    $checkSub->close();

    if (!$isPushSent || $forceEmail) {
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
            $mail->addAddress($rEmail);
            $mail->isHTML(true);
            $mail->Subject = htmlspecialchars($title);
           $mail->Body = '
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;background:#eeece8;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Helvetica,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#eeece8;padding:40px 20px;">
<tr><td align="center">
  <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:20px;border:1px solid #e2e0dc;">
    <tr><td style="padding:40px 44px 36px;">

      <p style="margin:0 0 8px;font-size:17px;font-weight:700;color:#0d0d0d;letter-spacing:-0.3px;">' . htmlspecialchars($schoolName) . '</p>

      <p style="margin:0 0 20px;font-size:24px;font-weight:600;color:#0d0d0d;line-height:1.3;">' . htmlspecialchars($title) . '</p>

      <p style="margin:0 0 32px;font-size:16px;color:#4a4a4a;line-height:1.8;">' . nl2br(htmlspecialchars($msg)) . '</p>

      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;"><tr><td style="border-top:1px solid #e8e6e2;"></td></tr></table>

      <p style="margin:0 0 36px;font-size:14px;color:#6a6a6a;line-height:1.6;">Sent by ' . htmlspecialchars($teacherDisplayName) . '</p>

      <table width="100%" cellpadding="0" cellspacing="0">
        <tr><td style="border-top:1px solid #e8e6e2;padding-top:24px;">
          <p style="margin:0;font-size:12px;color:#9a9a9a;line-height:1.6;">' . htmlspecialchars($schoolName) . ' &nbsp;&middot;&nbsp; Powered by <a href="https://iskool.online" style="color:#9a9a9a;text-decoration:none;">iSkool</a></p>
        </td></tr>
      </table>

    </td></tr>
  </table>
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