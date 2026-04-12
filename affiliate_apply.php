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
    $mail->Host       = 'iskool.online';
    $mail->SMTPAuth   = true;
    $mail->Username   = 'noreply@iskool.online';
    $mail->Password   = 'ogeQkRitRfdy';
    $mail->SMTPSecure = PHPMailer::ENCRYPTION_SMTPS;
    $mail->Port       = 465;
    $mail->setFrom('noreply@iskool.online', 'iSkool Website');
    $mail->addAddress('info@iskool.online', 'iSkool Team');
    $mail->isHTML(true);
    $mail->Subject = 'New Affiliate Application — ' . $full_name . ' [' . $ref . ']';
    $mail->Body = '
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:40px 20px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

  <!-- HEADER -->
  <tr>
    <td style="background:#0d1117;border-radius:12px 12px 0 0;padding:32px 40px;text-align:center;">
      <img src="https://iskool.online/apple-touch-icon.png" width="72" height="72" alt="iSkool"
           style="display:block;margin:0 auto 12px;border-radius:14px;border:2px solid rgba(57,213,193,0.3);">
      <p style="margin:0;font-size:12px;color:#8b949e;letter-spacing:2px;">iSkool · AFFILIATE APPLICATION</p>
    </td>
  </tr>

  <!-- REF BAND -->
  <tr>
    <td style="background:#161b22;padding:14px 40px;text-align:center;border-bottom:1px solid #21262d;">
      <p style="margin:0;font-size:13px;color:#8b949e;">
        Reference: <span style="color:#f5c842;font-weight:700;letter-spacing:1px;">' . $ref . '</span>
      </p>
    </td>
  </tr>

  <!-- BODY -->
  <tr>
    <td style="background:#ffffff;padding:40px;">

      <p style="margin:0 0 28px;font-size:15px;color:#333;line-height:1.6;">
        A new affiliate application has been submitted. Here are the full details:
      </p>

      <!-- APPLICANT DETAILS -->
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8f9fa;border:1px solid #e9ecef;border-left:4px solid #39d5c1;border-radius:4px;margin-bottom:20px;">
        <tr>
          <td style="padding:20px 24px;">
            <p style="margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#39d5c1;">Applicant</p>
            <p style="margin:0;font-size:20px;font-weight:700;color:#0d1117;">' . $full_name . '</p>
          </td>
        </tr>
      </table>

      <!-- CONTACT ROW -->
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
        <tr>
          <td width="50%" style="padding-right:8px;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8f9fa;border:1px solid #e9ecef;border-radius:8px;">
              <tr><td style="padding:14px 18px;">
                <p style="margin:0 0 4px;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#888;">Email</p>
                <p style="margin:0;font-size:14px;color:#0d1117;font-weight:600;">' . $email . '</p>
              </td></tr>
            </table>
          </td>
          <td width="50%" style="padding-left:8px;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8f9fa;border:1px solid #e9ecef;border-radius:8px;">
              <tr><td style="padding:14px 18px;">
                <p style="margin:0 0 4px;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#888;">Phone</p>
                <p style="margin:0;font-size:14px;color:#0d1117;font-weight:600;">' . $phone . '</p>
              </td></tr>
            </table>
          </td>
        </tr>
      </table>

      <!-- PROFILE ROW -->
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
        <tr>
          <td width="50%" style="padding-right:8px;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8f9fa;border:1px solid #e9ecef;border-radius:8px;">
              <tr><td style="padding:14px 18px;">
                <p style="margin:0 0 4px;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#888;">Province</p>
                <p style="margin:0;font-size:14px;color:#0d1117;font-weight:600;">' . $province . '</p>
              </td></tr>
            </table>
          </td>
          <td width="50%" style="padding-left:8px;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8f9fa;border:1px solid #e9ecef;border-radius:8px;">
              <tr><td style="padding:14px 18px;">
                <p style="margin:0 0 4px;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#888;">Background</p>
                <p style="margin:0;font-size:14px;color:#0d1117;font-weight:600;">' . $background . '</p>
              </td></tr>
            </table>
          </td>
        </tr>
      </table>

      <!-- PATH & REACH ROW -->
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
        <tr>
          <td width="50%" style="padding-right:8px;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#fff8e1;border:1px solid #ffe082;border-radius:8px;">
              <tr><td style="padding:14px 18px;">
                <p style="margin:0 0 4px;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#f57f17;">Preferred Path</p>
                <p style="margin:0;font-size:14px;color:#e65100;font-weight:600;">' . $path_label . '</p>
              </td></tr>
            </table>
          </td>
          <td width="50%" style="padding-left:8px;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#e8faf8;border:1px solid #b2dfdb;border-radius:8px;">
              <tr><td style="padding:14px 18px;">
                <p style="margin:0 0 4px;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#0d6e62;">School Reach</p>
                <p style="margin:0;font-size:14px;color:#39d5c1;font-weight:600;">' . $school_reach . '</p>
              </td></tr>
            </table>
          </td>
        </tr>
      </table>

      <!-- SCHOOL CONNECTIONS -->
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8f9fa;border:1px solid #e9ecef;border-radius:8px;margin-bottom:20px;">
        <tr><td style="padding:20px 24px;">
          <p style="margin:0 0 8px;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#888;">School Connections</p>
          <p style="margin:0;font-size:14px;color:#333;line-height:1.65;">' . nl2br($school_connections) . '</p>
        </td></tr>
      </table>

      ' . (!empty($notes) ? '
      <!-- ADDITIONAL NOTES -->
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8f9fa;border:1px solid #e9ecef;border-radius:8px;margin-bottom:20px;">
        <tr><td style="padding:20px 24px;">
          <p style="margin:0 0 8px;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#888;">Additional Notes</p>
          <p style="margin:0;font-size:14px;color:#333;line-height:1.65;">' . nl2br($notes) . '</p>
        </td></tr>
      </table>' : '') . '

      <!-- DIVIDER -->
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
        <tr><td style="border-top:1px solid #f0ede6;padding:0;"></td></tr>
      </table>

      <p style="margin:0;font-size:13px;color:#888;line-height:1.6;">
        Submitted: <strong style="color:#444;">' . date('d F Y, H:i') . '</strong><br>
        Reference: <strong style="color:#444;">' . $ref . '</strong>
      </p>

    </td>
  </tr>

  <!-- FOOTER -->
  <tr>
    <td style="background:#f8f9fa;border-radius:0 0 12px 12px;padding:24px 40px;text-align:center;border-top:1px solid #e9ecef;">
      <p style="margin:0;font-size:12px;color:#aaa;">iSkool (Pty) Ltd · Johannesburg, South Africa · iskool.online</p>
    </td>
  </tr>

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
    $confirm->Host       = 'iskool.online';
    $confirm->SMTPAuth   = true;
    $confirm->Username   = 'noreply@iskool.online';
    $confirm->Password   = 'ogeQkRitRfdy';
    $confirm->SMTPSecure = PHPMailer::ENCRYPTION_SMTPS;
    $confirm->Port       = 465;
    $confirm->setFrom('noreply@iskool.online', 'iSkool');
    $confirm->addAddress($email, $full_name);
    $confirm->isHTML(true);
    $confirm->Subject = 'Your iSkool Affiliate Application — ' . $ref;
    $confirm->Body = '
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:40px 20px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

  <!-- HEADER -->
  <tr>
    <td style="background:#0d1117;border-radius:12px 12px 0 0;padding:32px 40px;text-align:center;">
      <img src="https://iskool.online/apple-touch-icon.png" width="72" height="72" alt="iSkool"
           style="display:block;margin:0 auto 12px;border-radius:14px;border:2px solid rgba(57,213,193,0.3);">
      <p style="margin:0;font-size:12px;color:#8b949e;letter-spacing:2px;">iSkool · AFFILIATE PROGRAMME</p>
    </td>
  </tr>

  <!-- BODY -->
  <tr>
    <td style="background:#ffffff;padding:40px;">

      <p style="margin:0 0 20px;font-size:18px;font-weight:700;color:#0d1117;">
        Thanks for applying, ' . $full_name . '! 🎉
      </p>
      <p style="margin:0 0 24px;font-size:15px;color:#333;line-height:1.7;">
        We\'ve received your affiliate application and our team will review it within <strong>3–5 business days</strong>. If approved, you\'ll receive your partner agreement and referral code by email.
      </p>

      <!-- REF -->
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#0d1117;border-radius:10px;margin-bottom:28px;">
        <tr><td style="padding:20px 24px;text-align:center;">
          <p style="margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#8b949e;">Your Reference Number</p>
          <p style="margin:0;font-size:24px;font-weight:700;color:#f5c842;letter-spacing:2px;">' . $ref . '</p>
        </td></tr>
      </table>

      <p style="margin:0 0 12px;font-size:14px;color:#555;line-height:1.7;">
        Keep this reference number safe — we\'ll use it in all correspondence about your application.
      </p>

      <!-- WHAT HAPPENS NEXT -->
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8f9fa;border:1px solid #e9ecef;border-left:4px solid #39d5c1;border-radius:4px;margin:28px 0 0;">
        <tr><td style="padding:20px 24px;">
          <p style="margin:0 0 10px;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#39d5c1;">What happens next</p>
          <p style="margin:0 0 8px;font-size:14px;color:#333;">📋 &nbsp;We review your application (3–5 business days)</p>
          <p style="margin:0 0 8px;font-size:14px;color:#333;">✅ &nbsp;If approved, you\'ll receive your partner agreement</p>
          <p style="margin:0 0 8px;font-size:14px;color:#333;">🔑 &nbsp;Your unique referral code is issued</p>
          <p style="margin:0;font-size:14px;color:#333;">💸 &nbsp;You start referring schools and earning commission</p>
        </td></tr>
      </table>

      <!-- DIVIDER -->
      <table width="100%" cellpadding="0" cellspacing="0" style="margin:28px 0 20px;">
        <tr><td style="border-top:1px solid #f0ede6;padding:0;"></td></tr>
      </table>

      <p style="margin:0;font-size:13px;color:#888;">
        Questions? Reply to this email or contact us at
        <a href="mailto:info@iskool.online" style="color:#39d5c1;text-decoration:none;">info@iskool.online</a>
      </p>

    </td>
  </tr>

  <!-- FOOTER -->
  <tr>
    <td style="background:#f8f9fa;border-radius:0 0 12px 12px;padding:24px 40px;text-align:center;border-top:1px solid #e9ecef;">
      <p style="margin:0;font-size:12px;color:#aaa;">iSkool (Pty) Ltd · Johannesburg, South Africa · iskool.online</p>
    </td>
  </tr>

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