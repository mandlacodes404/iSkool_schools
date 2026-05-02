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
    $_SESSION['reset_error'] = "No account found with that email.";
    $_SESSION['active_form'] = 'forgot-form';
    header("Location: index.php");
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
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" style="margin:0;padding:0;width:100%;background:#ffffff;">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <style type="text/css">
    html, body { margin:0 !important;padding:0 !important;width:100% !important;background:#ffffff !important; }
    div[style*="margin: 16px 0"] { margin:0 !important; }
    @media only screen and (max-width:600px) { .outer-td { padding:32px 20px 40px !important; } }
  </style>
</head>
<body style="margin:0 !important;padding:0 !important;Margin:0;background:#ffffff;width:100%;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;background:#ffffff;">
<tr><td align="center" style="padding:0;margin:0;background:#ffffff;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;max-width:600px;width:100%;background:#ffffff;">
    <tr>
      <td class="outer-td" style="padding:40px 44px 48px;background:#ffffff;">

        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;margin-bottom:36px;">
          <tr>
            <td style="vertical-align:middle;padding-right:8px;">
              <img src="https://iskool.online/apple-touch-icon.png" width="36" height="36" alt="iSkool" style="display:block;border-radius:7px;">
            </td>
            <td style="vertical-align:middle;">
              <span style="font-size:15px;font-weight:600;color:#0d0d0d;letter-spacing:-0.2px;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Helvetica,Arial,sans-serif;">iSkool</span>
            </td>
          </tr>
        </table>

        <p style="margin:0 0 20px;font-size:24px;font-weight:600;color:#0d0d0d;line-height:1.3;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Helvetica,Arial,sans-serif;">Reset your password</p>

        <p style="margin:0 0 16px;font-size:16px;color:#0d0d0d;line-height:1.6;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Helvetica,Arial,sans-serif;">Hi there,</p>

        <p style="margin:0 0 24px;font-size:16px;color:#4a4a4a;line-height:1.7;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Helvetica,Arial,sans-serif;">
          We received a request to reset the password for your iSkool account.
          Click the link below to set a new password. This link expires in 1 hour.
        </p>

        <p style="margin:0 0 28px;font-size:16px;line-height:1.6;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Helvetica,Arial,sans-serif;">
          <a href="' . $resetLink . '" style="color:#0866ff;text-decoration:none;font-weight:500;">Reset my password →</a>
        </p>

        <p style="margin:0 0 12px;font-size:14px;color:#4a4a4a;line-height:1.7;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Helvetica,Arial,sans-serif;">If the link above does not work, copy and paste this URL into your browser:</p>

        <p style="margin:0 0 40px;font-size:13px;color:#4a4a4a;word-break:break-all;line-height:1.6;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Helvetica,Arial,sans-serif;">' . $resetLink . '</p>

        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;margin-bottom:24px;">
          <tr><td style="border-top:1px solid #e8e6e2;"></td></tr>
        </table>

        <p style="margin:0 0 24px;font-size:14px;color:#6a6a6a;line-height:1.6;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Helvetica,Arial,sans-serif;">
          If you did not request a password reset, you can ignore this email — your password will remain unchanged.
          If you are concerned about your account security, contact us at
          <a href="mailto:support@iskool.online" style="color:#0866ff;text-decoration:none;">support@iskool.online</a>.
        </p>

        <p style="margin:0 0 40px;font-size:14px;color:#4a4a4a;line-height:1.6;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Helvetica,Arial,sans-serif;">Thanks,<br>iSkool Support</p>

        <p style="margin:0;font-size:12px;color:#9a9a9a;line-height:1.6;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Helvetica,Arial,sans-serif;">
          iSkool (Pty) Ltd, Johannesburg, South Africa &nbsp;&middot;&nbsp;
          <a href="https://iskool.online" style="color:#9a9a9a;text-decoration:none;">iskool.online</a> &nbsp;&middot;&nbsp;
          <a href="mailto:support@iskool.online" style="color:#9a9a9a;text-decoration:none;">support@iskool.online</a>
        </p>
        <p style="margin:6px 0 0;font-size:12px;color:#9a9a9a;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Helvetica,Arial,sans-serif;">
          This email was sent to ' . htmlspecialchars($email) . '. Please do not forward this email.
        </p>

      </td>
    </tr>
  </table>
</td></tr>
</table>
</body>
</html>';

    $mail->send();
    $_SESSION['reset_message'] = "Reset link sent to your email.";
    $_SESSION['active_form'] = 'forgot-form';

} catch (Exception $e) {
    $_SESSION['reset_error'] = "Email could not be sent. Please try again later.";
    $_SESSION['active_form'] = 'forgot-form';
}

header("Location: index.php");
exit();