<?php
session_start();
require 'config.php';
require 'vendor/autoload.php';

use PHPMailer\PHPMailer\PHPMailer;

$email = trim($_POST['email']);

// 1. Check if user exists
$stmt = $conn->prepare("SELECT * FROM users WHERE email = ?");
$stmt->bind_param("s", $email);
$stmt->execute();
$userResult = $stmt->get_result();

if ($userResult->num_rows === 0) {
    $_SESSION['reset_message'] = "No account found with that email.";
    header("Location: forgot_password.php");
    exit();
}

// 2. Create token & expiry
$token = bin2hex(random_bytes(32));
$expires_at = date("Y-m-d H:i:s", time() + 3600);

// 3. Store token
$stmt = $conn->prepare("INSERT INTO password_resets (email, token, expires_at) VALUES (?, ?, ?)");
$stmt->bind_param("sss", $email, $token, $expires_at);
$stmt->execute();

// 4. Generate the dynamic Reset Link (Automatically uses the current school's subdomain)
$resetLink = BASE_URL . "reset_password.php?token=$token";

// 5. Send email via iSkool Server
$mail = new PHPMailer(true);

try {
    $mail->isSMTP();
    $mail->Host       = 'iskool.online'; // Check your hosting for the exact SMTP host
    $mail->SMTPAuth   = true;
    $mail->Username   = 'support@iskool.online';
    $mail->Password   = 'ogeQkRitRfdy'; // The password for support@iskool.online
    $mail->SMTPSecure = PHPMailer::ENCRYPTION_SMTPS; // Using SSL
    $mail->Port       = 465;

    $mail->setFrom('support@iskool.online', 'iSkool Support');
    $mail->addAddress($email);

    $mail->isHTML(true);
    $mail->Subject = 'Reset Your iSkool Password';
    
    // Modernized email body to match your new Gemini-style UI
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

  <!-- CARD -->
  <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:20px;border:1px solid #e2e0dc;overflow:hidden;">
    <tr>
      <td style="padding:40px 44px 36px;">

        <!-- LOGO -->
        <table cellpadding="0" cellspacing="0" style="margin-bottom:36px;">
          <tr>
            <td style="vertical-align:middle;padding-right:8px;">
              <img src="https://iskool.online/apple-touch-icon.png" width="22" height="22" alt="iSkool" style="display:block;border-radius:5px;">
            </td>
            <td style="vertical-align:middle;">
              <span style="font-size:15px;font-weight:600;color:#0d0d0d;letter-spacing:-0.2px;">iSkool</span>
            </td>
          </tr>
        </table>

        <!-- HEADING -->
        <p style="margin:0 0 20px;font-size:24px;font-weight:600;color:#0d0d0d;line-height:1.3;">Reset your password</p>

        <p style="margin:0 0 16px;font-size:16px;color:#0d0d0d;line-height:1.6;">Hi there,</p>

        <p style="margin:0 0 24px;font-size:16px;color:#4a4a4a;line-height:1.7;">
          We received a request to reset the password for your iSkool account.
          Click the link below to set a new password. This link expires in 1 hour.
        </p>

        <p style="margin:0 0 24px;font-size:16px;line-height:1.6;">
          <a href="' . $resetLink . '" style="color:#0866ff;text-decoration:none;font-weight:500;">Reset my password</a>
        </p>

        <p style="margin:0 0 12px;font-size:14px;color:#4a4a4a;line-height:1.7;">If the link above does not work, copy and paste this URL into your browser:</p>

        <p style="margin:0 0 32px;font-size:13px;color:#4a4a4a;word-break:break-all;line-height:1.6;">' . $resetLink . '</p>

        <!-- DIVIDER -->
        <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
          <tr><td style="border-top:1px solid #e8e6e2;"></td></tr>
        </table>

        <p style="margin:0 0 24px;font-size:14px;color:#6a6a6a;line-height:1.6;">
          If you did not request a password reset, you can ignore this email — your password will remain unchanged.
          If you are concerned about your account security, contact us at
          <a href="mailto:support@iskool.online" style="color:#0866ff;text-decoration:none;">support@iskool.online</a>.
        </p>

        <p style="margin:0 0 36px;font-size:14px;color:#4a4a4a;line-height:1.6;">Thanks,<br>iSkool Support</p>

        <!-- FOOTER -->
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr><td style="border-top:1px solid #e8e6e2;padding-top:24px;">
            <p style="margin:0;font-size:12px;color:#9a9a9a;line-height:1.6;">
              iSkool (Pty) Ltd, Johannesburg, South Africa
              &nbsp;&middot;&nbsp;
              <a href="https://iskool.online" style="color:#9a9a9a;text-decoration:none;">iskool.online</a>
              &nbsp;&middot;&nbsp;
              <a href="mailto:support@iskool.online" style="color:#9a9a9a;text-decoration:none;">support@iskool.online</a>
            </p>
            <p style="margin:6px 0 0;font-size:12px;color:#9a9a9a;">
              This email was sent to ' . htmlspecialchars($email) . '. Please do not forward this email.
            </p>
          </td></tr>
        </table>

      </td>
    </tr>
  </table>

</td></tr>
</table>
</body>
</html>';

    $mail->send();
    $_SESSION['reset_message'] = "Reset link sent to your email.";

} catch (Exception $e) {
    $_SESSION['reset_error'] = "Email could not be sent. Please try again later.";
}

header("Location: forgot_password.php");
exit();