<?php
ob_start();
error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);
ini_set('error_log', 'php_errors.log');

header('Content-Type: application/json');

require 'vendor/autoload.php';
use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

// ── Only accept POST ──
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed.']);
    ob_end_flush();
    exit;
}

// ── Sanitise & collect fields ──
function clean($val) {
    return htmlspecialchars(strip_tags(trim($val ?? '')));
}

$full_name        = clean($_POST['full_name']         ?? '');
$email            = clean($_POST['email']             ?? '');
$phone            = clean($_POST['phone']             ?? '');
$province         = clean($_POST['province']          ?? '');
$background       = clean($_POST['background']        ?? '');
$preferred_path   = clean($_POST['preferred_path']    ?? '');
$school_reach     = clean($_POST['school_reach']      ?? '');
$school_connections = clean($_POST['school_connections'] ?? '');
$notes            = clean($_POST['notes']             ?? '');

// ── Server-side validation ──
$errors = [];
if (strlen($full_name) < 2)                          $errors[] = 'Full name is required.';
if (!filter_var($email, FILTER_VALIDATE_EMAIL))       $errors[] = 'A valid email address is required.';
if (strlen($phone) < 7)                              $errors[] = 'Phone number is required.';
if (empty($province))                                $errors[] = 'Province is required.';
if (empty($background))                              $errors[] = 'Background is required.';
if (empty($preferred_path))                          $errors[] = 'Preferred path is required.';
if (empty($school_reach))                            $errors[] = 'School reach estimate is required.';
if (strlen($school_connections) < 10)                $errors[] = 'Please tell us about your school connections.';

if (!empty($errors)) {
    http_response_code(422);
    echo json_encode(['success' => false, 'message' => implode(' ', $errors)]);
    ob_end_flush();
    exit;
}

// ── Generate reference number ──
$ref = 'ISK/AFF/' . strtoupper(substr(md5($email . microtime()), 0, 6));

// ── Path label for email display ──
$path_label = ($preferred_path === 'direct') ? '⚡ Direct Subscription' : '🎯 Pilot First (6-month free pilot)';

// ── 1. Notify iSkool team ──
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
    $mail->setFrom($from_email, 'iSkool Website');
    $mail->addAddress('info@iskool.online', 'iSkool Team');
    $mail->isHTML(true);
    $mail->Subject = 'New Affiliate Application — ' . $full_name . ' [' . $ref . ']';
    $mail->Body = '
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;background:#eeece8;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Helvetica,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#eeece8;padding:40px 20px;">
<tr><td align="center">
  <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:20px;border:1px solid #e2e0dc;">
    <tr><td style="padding:40px 44px 36px;">

      <table cellpadding="0" cellspacing="0" style="margin-bottom:36px;">
        <tr>
          <td style="vertical-align:middle;padding-right:8px;"><img src="https://iskool.online/apple-touch-icon.png" width="22" height="22" alt="iSkool" style="display:block;border-radius:5px;"></td>
          <td style="vertical-align:middle;"><span style="font-size:15px;font-weight:600;color:#0d0d0d;letter-spacing:-0.2px;">iSkool</span></td>
        </tr>
      </table>

      <p style="margin:0 0 20px;font-size:24px;font-weight:600;color:#0d0d0d;line-height:1.3;">New affiliate application</p>

      <p style="margin:0 0 24px;font-size:16px;color:#4a4a4a;line-height:1.7;">A new affiliate application has been submitted. Reference: <strong style="color:#0d0d0d;">' . $ref . '</strong></p>

      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;"><tr><td style="border-top:1px solid #e8e6e2;"></td></tr></table>

      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
        <tr><td style="padding:8px 0;font-size:14px;color:#6a6a6a;width:140px;vertical-align:top;">Name</td><td style="padding:8px 0;font-size:14px;color:#0d0d0d;font-weight:500;">' . $full_name . '</td></tr>
        <tr><td style="padding:8px 0;font-size:14px;color:#6a6a6a;vertical-align:top;">Email</td><td style="padding:8px 0;font-size:14px;color:#0d0d0d;">' . $email . '</td></tr>
        <tr><td style="padding:8px 0;font-size:14px;color:#6a6a6a;vertical-align:top;">Phone</td><td style="padding:8px 0;font-size:14px;color:#0d0d0d;">' . $phone . '</td></tr>
        <tr><td style="padding:8px 0;font-size:14px;color:#6a6a6a;vertical-align:top;">Province</td><td style="padding:8px 0;font-size:14px;color:#0d0d0d;">' . $province . '</td></tr>
        <tr><td style="padding:8px 0;font-size:14px;color:#6a6a6a;vertical-align:top;">Background</td><td style="padding:8px 0;font-size:14px;color:#0d0d0d;">' . $background . '</td></tr>
        <tr><td style="padding:8px 0;font-size:14px;color:#6a6a6a;vertical-align:top;">Preferred path</td><td style="padding:8px 0;font-size:14px;color:#0d0d0d;">' . $preferred_path . '</td></tr>
        <tr><td style="padding:8px 0;font-size:14px;color:#6a6a6a;vertical-align:top;">School reach</td><td style="padding:8px 0;font-size:14px;color:#0d0d0d;">' . $school_reach . '</td></tr>
      </table>

      <p style="margin:0 0 6px;font-size:14px;color:#6a6a6a;">School connections</p>
      <p style="margin:0 0 24px;font-size:14px;color:#0d0d0d;line-height:1.7;">' . nl2br($school_connections) . '</p>

      ' . (!empty($notes) ? '<p style="margin:0 0 6px;font-size:14px;color:#6a6a6a;">Additional notes</p><p style="margin:0 0 24px;font-size:14px;color:#0d0d0d;line-height:1.7;">' . nl2br($notes) . '</p>' : '') . '

      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;"><tr><td style="border-top:1px solid #e8e6e2;"></td></tr></table>

      <p style="margin:0 0 36px;font-size:13px;color:#6a6a6a;line-height:1.6;">Submitted ' . date('d F Y') . ' at ' . date('H:i') . ' &middot; Reference: ' . $ref . '</p>

      <table width="100%" cellpadding="0" cellspacing="0">
        <tr><td style="border-top:1px solid #e8e6e2;padding-top:24px;">
          <p style="margin:0;font-size:12px;color:#9a9a9a;line-height:1.6;">iSkool (Pty) Ltd, Johannesburg, South Africa &nbsp;&middot;&nbsp; <a href="https://iskool.online" style="color:#9a9a9a;text-decoration:none;">iskool.online</a></p>
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
    error_log('Affiliate notification email failed: ' . $e->getMessage());
    // Don't fail the whole request — log and continue to applicant confirmation
}

// ── 2. Send confirmation email to applicant ──
try {
    $confirm = new PHPMailer(true);
    $confirm->isSMTP();
    $confirm->Host       = getenv('SMTP_HOST');
    $confirm->SMTPAuth   = true;
    $confirm->Username   = getenv('SMTP_USER');
    $confirm->Password   = getenv('SMTP_PASSWORD');
    $confirm->SMTPSecure = PHPMailer::ENCRYPTION_SMTPS;
    $confirm->Port       = getenv('SMTP_PORT');
    $from_email          = getenv('SMTP_FROM');
    $confirm->setFrom($from_email, 'iSkool');
    $confirm->addAddress($email, $full_name);
    $confirm->isHTML(true);
    $confirm->Subject = 'Your iSkool Affiliate Application — ' . $ref;
    $confirm->Body = '
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;background:#eeece8;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Helvetica,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#eeece8;padding:40px 20px;">
<tr><td align="center">
  <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:20px;border:1px solid #e2e0dc;">
    <tr><td style="padding:40px 44px 36px;">

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

      <p style="margin:0 0 20px;font-size:24px;font-weight:600;color:#0d0d0d;line-height:1.3;">Thanks for applying, ' . $full_name . '.</p>

      <p style="margin:0 0 24px;font-size:16px;color:#4a4a4a;line-height:1.7;">
        We\'ve received your affiliate application and our team will review it within 3–5 business days.
        If approved, you\'ll receive your partner agreement and referral code by email.
      </p>

      <p style="margin:0 0 8px;font-size:14px;color:#6a6a6a;">Your reference number</p>
      <p style="margin:0 0 28px;font-size:20px;font-weight:600;color:#0d0d0d;letter-spacing:0.5px;">' . $ref . '</p>

      <p style="margin:0 0 16px;font-size:16px;color:#4a4a4a;line-height:1.7;">Here is what happens next:</p>

      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:8px;">
        <tr><td style="border-top:1px solid #e8e6e2;"></td></tr>
      </table>

      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:8px;">
        <tr><td style="padding:10px 0;font-size:15px;color:#4a4a4a;line-height:1.6;border-bottom:1px solid #f0f0f0;">We review your application (3–5 business days)</td></tr>
        <tr><td style="padding:10px 0;font-size:15px;color:#4a4a4a;line-height:1.6;border-bottom:1px solid #f0f0f0;">If approved, you\'ll receive your partner agreement</td></tr>
        <tr><td style="padding:10px 0;font-size:15px;color:#4a4a4a;line-height:1.6;border-bottom:1px solid #f0f0f0;">Your unique referral code is issued</td></tr>
        <tr><td style="padding:10px 0;font-size:15px;color:#4a4a4a;line-height:1.6;">You start referring schools and earning commission</td></tr>
      </table>

      <table width="100%" cellpadding="0" cellspacing="0" style="margin:28px 0 24px;">
        <tr><td style="border-top:1px solid #e8e6e2;"></td></tr>
      </table>

      <p style="margin:0 0 24px;font-size:16px;color:#4a4a4a;line-height:1.7;">
        Questions? Reply to this email or contact us at
        <a href="mailto:info@iskool.online" style="color:#0866ff;text-decoration:none;">info@iskool.online</a>.
      </p>

      <p style="margin:0 0 36px;font-size:16px;color:#4a4a4a;line-height:1.7;">Thanks,<br>iSkool Team</p>

      <table width="100%" cellpadding="0" cellspacing="0">
        <tr><td style="border-top:1px solid #e8e6e2;padding-top:24px;">
          <p style="margin:0;font-size:12px;color:#9a9a9a;line-height:1.6;">
            iSkool (Pty) Ltd, Johannesburg, South Africa
            &nbsp;&middot;&nbsp;
            <a href="https://iskool.online" style="color:#9a9a9a;text-decoration:none;">iskool.online</a>
          </p>
          <p style="margin:6px 0 0;font-size:12px;color:#9a9a9a;">This email was sent to ' . htmlspecialchars($email) . '. Please do not forward this email.</p>
        </td></tr>
      </table>

    </td></tr>
  </table>
</td></tr>
</table>
</body>
</html>';

    $confirm->send();

} catch (Exception $e) {
    error_log('Affiliate confirmation email to applicant failed: ' . $e->getMessage());
    // Still return success — the application was received even if the confirmation email glitches
}

// ── Return success ──
echo json_encode([
    'success' => true,
    'ref'     => $ref,
    'message' => 'Application received.'
]);

ob_end_flush();
exit;
