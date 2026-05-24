<?php
/**
 * tools/email-preview/test_evaluation.php
 * Fires the evaluation notification email with dummy data.
 */

require_once dirname(__DIR__, 2) . '/config.php';
require_once dirname(__DIR__, 2) . '/vendor/autoload.php';

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

// ── Dummy data ──
$email              = 'mandlasimphiwe99@gmail.com';
$learnerName        = 'Mandla';
$teacherDisplayName = 'Mr. S. Mnqovu';
$title              = 'Term 2 Teaching Evaluation';

$schoolNameResult = $conn->query("SELECT setting_value FROM school_name WHERE setting_key = 'school_name' LIMIT 1");
$schoolName = ($schoolNameResult && $row = $schoolNameResult->fetch_assoc()) ? $row['setting_value'] : 'Landulwazi Comprehensive School';

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
    $mail->addAddress($email);
    $mail->isHTML(true);
    $mail->Subject = '[TEST] New Evaluation: ' . $title;
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

  <p style="margin:0 0 28px;font-size:13px;font-weight:700;color:#cc1f1f;letter-spacing:0.8px;text-transform:uppercase;font-family:\'DM Sans\',Helvetica,Arial,sans-serif;">' . htmlspecialchars($schoolName) . '</p>

  <p style="margin:0 0 20px;font-size:28px;font-weight:700;color:#0d0d0d;line-height:1.25;letter-spacing:-0.5px;font-family:\'DM Sans\',Helvetica,Arial,sans-serif;">New evaluation: ' . htmlspecialchars($title) . '</p>

  <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;"><tr><td style="border-top:1px solid #e5e5e5;"></td></tr></table>

  <p style="margin:0 0 16px;font-size:16px;color:#2d2d2d;line-height:1.8;font-family:\'DM Sans\',Helvetica,Arial,sans-serif;">Hi <strong>' . htmlspecialchars($learnerName) . '</strong>, your teacher has released a new evaluation and needs your honest feedback.</p>

  <p style="margin:0 0 36px;font-size:15px;color:#555555;line-height:1.75;font-family:\'DM Sans\',Helvetica,Arial,sans-serif;">Your feedback helps your teacher improve their teaching style. All responses are <strong>anonymous</strong> and will not affect your grades. Please be honest and thoughtful.</p>

  <p style="margin:0 0 40px;font-size:14px;color:#888888;font-family:\'DM Sans\',Helvetica,Arial,sans-serif;">Released by <span style="color:#0d0d0d;font-weight:600;">' . htmlspecialchars($teacherDisplayName) . '</span></p>

  <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;"><tr><td style="border-top:1px solid #e5e5e5;"></td></tr></table>

  <p style="margin:0;font-size:12px;color:#aaaaaa;line-height:1.6;font-family:\'DM Sans\',Helvetica,Arial,sans-serif;">
    ' . htmlspecialchars($schoolName) . ' &nbsp;&middot;&nbsp; Powered by <a href="https://iskool.online" style="color:#aaaaaa;text-decoration:underline;">iSkool</a>
  </p>

</td></tr>
</table>
</body>
</html>';

    $mail->send();
    header('Location: index.php?sent=Evaluation');
} catch (Exception $e) {
    die('<p style="font-family:sans-serif;color:red;padding:20px;">❌ Failed: ' . $mail->ErrorInfo . '</p>');
}
