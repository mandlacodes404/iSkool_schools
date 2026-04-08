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
        Learning Management System
      </p>
    </td>
  </tr>

  <!-- HERO -->
  <tr>
    <td style="background:#f85149;padding:20px 40px;text-align:center;">
      <p style="margin:0;font-size:18px;font-weight:700;color:#ffffff;">
        🔐 Password Reset Request
      </p>
    </td>
  </tr>

  <!-- BODY -->
  <tr>
    <td style="background:#ffffff;padding:40px;">

      <p style="margin:0 0 16px;font-size:15px;color:#333;line-height:1.6;">
        Hi there,
      </p>

      <p style="margin:0 0 24px;font-size:15px;color:#555;line-height:1.7;">
        We received a request to reset the password for your iSkool account.
        Click the button below to set a new password.
      </p>

      <!-- RESET BUTTON -->
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
        <tr>
          <td align="center">
            <a href="' . $resetLink . '"
               style="display:inline-block;background:#f85149;color:#ffffff;font-weight:700;font-size:15px;padding:14px 40px;border-radius:30px;text-decoration:none;letter-spacing:0.3px;">
              Reset My Password →
            </a>
          </td>
        </tr>
      </table>

      <!-- EXPIRY WARNING -->
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#fff8e1;border:1px solid #ffe082;border-left:4px solid #ffc107;border-radius:4px;margin-bottom:24px;">
        <tr>
          <td style="padding:14px 18px;">
            <p style="margin:0;font-size:13px;color:#795548;line-height:1.6;">
              ⏱ <strong>This link will expire in 1 hour.</strong>
              If you do not reset your password within this time you will need to request a new link.
            </p>
          </td>
        </tr>
      </table>

      <!-- LINK FALLBACK -->
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8f9fa;border:1px solid #e9ecef;border-radius:8px;margin-bottom:24px;">
        <tr>
          <td style="padding:16px 20px;">
            <p style="margin:0;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#888;margin-bottom:8px;">
              Button not working? Copy this link
            </p>
            <p style="margin:0;font-size:12px;color:#39d5c1;word-break:break-all;font-family:monospace;">
              ' . $resetLink . '
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

      <!-- SECURITY NOTICE -->
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#fce4ec;border:1px solid #f48fb1;border-left:4px solid #f85149;border-radius:4px;">
        <tr>
          <td style="padding:14px 18px;">
            <p style="margin:0;font-size:12px;color:#880e4f;line-height:1.6;">
              🔒 If you did not request a password reset please ignore this email —
              your password will remain unchanged. If you are concerned about your account
              security contact us at
              <a href="mailto:support@iskool.online" style="color:#c62828;">support@iskool.online</a>
            </p>
          </td>
        </tr>
      </table>

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
    $_SESSION['reset_message'] = "Reset link sent to your email.";

} catch (Exception $e) {
    $_SESSION['reset_error'] = "Email could not be sent. Please try again later.";
}

header("Location: forgot_password.php");
exit();