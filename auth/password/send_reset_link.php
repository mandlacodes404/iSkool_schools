<?php
/**
 * send_reset_link.php
 *
 * AJAX-only password reset endpoint. Called by fetch() in index.php.
 * Always returns JSON — never redirects or renders HTML.
 *
 * Response shape:
 *   { "success": true }
 *   { "success": false, "message": "..." }
 */

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed.']);
    exit();
}

require_once __DIR__ . '/../session_guard.php';
require_once __DIR__ . '/../csrf_helper.php';
require __DIR__ . '/../../config.php';
require __DIR__ . '/../../vendor/autoload.php';

use PHPMailer\PHPMailer\PHPMailer;

verify_csrf_token();

$email = trim($_POST['email'] ?? '');

if (empty($email) || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    echo json_encode(['success' => false, 'message' => 'Please enter a valid email address.']);
    exit();
}

// 1. Check if user exists
$stmt = $conn->prepare("SELECT id FROM users WHERE email = ?");
$stmt->bind_param("s", $email);
$stmt->execute();
$stmt->store_result();

if ($stmt->num_rows === 0) {
    // Generic message — don't reveal whether the email exists
    echo json_encode(['success' => false, 'message' => 'No account found with that email.']);
    exit();
}
$stmt->close();

// 2. Create token & expiry
$token      = bin2hex(random_bytes(32));
$expires_at = date("Y-m-d H:i:s", time() + 3600);

// 3. Store token
$stmt = $conn->prepare("INSERT INTO password_resets (email, token, expires_at) VALUES (?, ?, ?)");
$stmt->bind_param("sss", $email, $token, $expires_at);
$stmt->execute();
$stmt->close();

// 4. Generate reset link
$resetLink = BASE_URL . "reset_password.php?token=$token";

// 5. Send email
$mail = new PHPMailer(true);

try {
    $mail->isSMTP();
    $mail->Host       = getenv('SMTP_HOST');
    $mail->SMTPAuth   = true;
    $mail->Username   = getenv('SMTP_USER');
    $mail->Password   = getenv('SMTP_PASSWORD');
    $mail->SMTPSecure = PHPMailer::ENCRYPTION_SMTPS;
    $mail->Port       = getenv('SMTP_PORT');

    $from_email = getenv('SMTP_FROM');
    $mail->setFrom($from_email, 'iSkool Support');
    $mail->addAddress($email);
    $mail->isHTML(true);
    $mail->Subject = 'Reset Your iSkool Password';

    $mail->Body = '<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    @media only screen and (max-width: 600px) {
      .outer-table { width: 100% !important; }
      .inner-cell  { padding: 32px 24px 40px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background:#ffffff;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Helvetica,Arial,sans-serif;">

  <!-- Full-width wrapper — white, no card -->
  <table class="outer-table" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;max-width:600px;margin:0 auto;">
    <tr>
      <td class="inner-cell" style="padding:40px 44px 48px;">

        <!-- Logo -->
        <table cellpadding="0" cellspacing="0" style="margin-bottom:36px;">
          <tr>
            <td style="vertical-align:middle;padding-right:8px;">
              <img src="https://iskool.online/apple-touch-icon.png" width="36" height="36" alt="iSkool" style="display:block;border-radius:7px;">
            </td>
            <td style="vertical-align:middle;">
              <span style="font-size:13px;font-weight:600;color:#0d0d0d;letter-spacing:-0.2px;">iSkool</span>
            </td>
          </tr>
        </table>

        <!-- Heading -->
        <p style="margin:0 0 20px;font-size:20px;font-weight:600;color:#0d0d0d;line-height:1.3;">Reset your password</p>

        <p style="margin:0 0 16px;font-size:14px;color:#4a4a4a;line-height:1.7;">Hi there,</p>

        <p style="margin:0 0 24px;font-size:14px;color:#4a4a4a;line-height:1.7;">
          We received a request to reset the password for your iSkool account.
          Click the link below to set a new password. This link expires in 1 hour.
        </p>

        <!-- CTA -->
        <p style="margin:28px 0 40px;font-size:14px;line-height:1.6;">
          <a href="' . $resetLink . '" style="color:#0866ff;text-decoration:none;font-weight:500;">Reset my password →</a>
        </p>

        <!-- Divider -->
        <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;"><tr><td style="border-top:1px solid #e8e6e2;"></td></tr></table>

        <!-- Security note -->
        <p style="margin:0 0 24px;font-size:13px;color:#6a6a6a;line-height:1.7;">
          If you did not request a password reset, contact us at
          <a href="mailto:support@iskool.online" style="color:#0866ff;text-decoration:none;">support@iskool.online</a>.
        </p>

        <p style="margin:0 0 40px;font-size:13px;color:#4a4a4a;line-height:1.7;">Thanks,<br>iSkool Support</p>

        <!-- Footer -->
        <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:8px;">
          <tr>
            <td style="background:#f2f2f2;border-radius:8px;padding:24px 28px;">
              <img src="https://iskool.online/icon.svg" alt="iSkool" style="display:block;height:24px;">
              <p style="margin:0 0 8px;font-size:12px;color:#9a9a9a;line-height:1.6;">
                iSkool (Pty) Ltd, Johannesburg, South Africa &nbsp;&middot;&nbsp;
                <a href="https://iskool.online" style="color:#9a9a9a;text-decoration:none;">iskool.online</a> &nbsp;&middot;&nbsp;
                <a href="mailto:support@iskool.online" style="color:#9a9a9a;text-decoration:none;">support@iskool.online</a>
              </p>
              <p style="margin:0;font-size:12px;color:#9a9a9a;">This email was sent to ' . htmlspecialchars($email) . '. Please do not forward this email.</p>
            </td>
          </tr>
        </table>

      </td>
    </tr>
  </table>

</body>
</html>';

    $mail->send();
    echo json_encode(['success' => true]);

} catch (Exception $e) {
    echo json_encode(['success' => false, 'message' => 'Email could not be sent. Please try again later.']);
}
exit();
