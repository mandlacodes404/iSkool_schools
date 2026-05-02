<?php
/**
 * tools/email-preview/test_reset.php
 * Fires the password reset email with a dummy token.
 */

require_once dirname(__DIR__, 2) . '/config.php';
require_once dirname(__DIR__, 2) . '/vendor/autoload.php';

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

$email     = 'mandlasimphiwe99@gmail.com';
$resetLink = rtrim(BASE_URL, '/') . '/reset_password.php?token=TEST_DUMMY_TOKEN_DO_NOT_USE';

try {
    $mail = new PHPMailer(true);
    $mail->isSMTP();
    $mail->Host       = 'iskool.online';
    $mail->SMTPAuth   = true;
    $mail->Username   = 'support@iskool.online';
    $mail->Password   = 'ogeQkRitRfdy';
    $mail->SMTPSecure = PHPMailer::ENCRYPTION_SMTPS;
    $mail->Port       = 465;
    $mail->setFrom('support@iskool.online', 'iSkool Support');
    $mail->addAddress($email);
    $mail->isHTML(true);
    $mail->Subject = '[TEST] Reset Your iSkool Password';
    $mail->Body = '
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body style="margin:0;padding:0;background:#eeece8;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Helvetica,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#eeece8;padding:40px 20px;">
<tr><td align="center">
  <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:20px;border:1px solid #e2e0dc;overflow:hidden;">
    <tr><td style="padding:40px 44px 36px;">

      <table cellpadding="0" cellspacing="0" style="margin-bottom:36px;">
        <tr>
          <td style="vertical-align:middle;padding-right:8px;"><img src="https://iskool.online/apple-touch-icon.png" width="30" height="30" alt="iSkool" style="display:block;border-radius:5px;"></td>
          <td style="vertical-align:middle;"><span style="font-size:15px;font-weight:600;color:#0d0d0d;letter-spacing:-0.2px;">iSkool</span></td>
        </tr>
      </table>

      <p style="margin:0 0 20px;font-size:24px;font-weight:600;color:#0d0d0d;line-height:1.3;">Reset your password</p>
      <p style="margin:0 0 16px;font-size:16px;color:#0d0d0d;line-height:1.6;">Hi there,</p>
      <p style="margin:0 0 24px;font-size:16px;color:#4a4a4a;line-height:1.7;">We received a request to reset the password for your iSkool account. Click the link below to set a new password. This link expires in 1 hour.</p>
      <p style="margin:0 0 24px;font-size:16px;line-height:1.6;"><a href="' . $resetLink . '" style="color:#0866ff;text-decoration:none;font-weight:500;">Reset my password</a></p>
      <p style="margin:0 0 12px;font-size:14px;color:#4a4a4a;line-height:1.7;">If the link above does not work, copy and paste this URL into your browser:</p>
      <p style="margin:0 0 32px;font-size:13px;color:#4a4a4a;word-break:break-all;line-height:1.6;">' . $resetLink . '</p>

      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;"><tr><td style="border-top:1px solid #e8e6e2;"></td></tr></table>

      <p style="margin:0 0 24px;font-size:14px;color:#6a6a6a;line-height:1.6;">If you did not request a password reset, you can ignore this email — your password will remain unchanged. If you are concerned about your account security, contact us at <a href="mailto:support@iskool.online" style="color:#0866ff;text-decoration:none;">support@iskool.online</a>.</p>
      <p style="margin:0 0 36px;font-size:14px;color:#4a4a4a;line-height:1.6;">Thanks,<br>iSkool Support</p>

      <table width="100%" cellpadding="0" cellspacing="0">
        <tr><td style="border-top:1px solid #e8e6e2;padding-top:24px;">
          <p style="margin:0;font-size:12px;color:#9a9a9a;line-height:1.6;">iSkool (Pty) Ltd, Johannesburg, South Africa &nbsp;&middot;&nbsp; <a href="https://iskool.online" style="color:#9a9a9a;text-decoration:none;">iskool.online</a> &nbsp;&middot;&nbsp; <a href="mailto:support@iskool.online" style="color:#9a9a9a;text-decoration:none;">support@iskool.online</a></p>
          <p style="margin:6px 0 0;font-size:12px;color:#9a9a9a;">This email was sent to ' . htmlspecialchars($email) . '. Please do not forward this email.</p>
        </td></tr>
      </table>

    </td></tr>
  </table>
</td></tr>
</table>
</body>
</html>';

    $mail->send();
    header('Location: index.php?sent=Password+Reset');
} catch (Exception $e) {
    die('<p style="font-family:sans-serif;color:red;padding:20px;">❌ Failed: ' . $mail->ErrorInfo . '</p>');
}
