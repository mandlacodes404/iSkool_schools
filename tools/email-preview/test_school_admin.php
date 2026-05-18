<?php
/**
 * tools/email-preview/test_school_admin.php
 * Fires the school admin onboarding email with dummy data.
 */

require_once dirname(__DIR__, 2) . '/vendor/autoload.php';

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

// ── Dummy data ──
$email      = 'mandlasimphiwe99@gmail.com';
$name       = 'Mandla Mahlangu';
$schoolName = 'Landulwazi Comprehensive School';
$schoolUrl  = 'https://landulwazi.iskool.online';
$password   = 'Test@1234';
$keys       = [
    'learner' => 'LRN-XKQP72',
    'teacher' => 'TCH-MN3R91',
    'parent'  => 'PAR-BV6T44',
    'admin'   => 'ADM-ZW8C05',
];

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
    $mail->addAddress($email, $name);
    $mail->isHTML(true);
    $mail->Subject = '[TEST] Welcome to iSkool — Your School Platform is Ready';
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

        <!-- Logo -->
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;margin-bottom:36px;">
          <tr>
            <td style="vertical-align:middle;padding-right:8px;">
              <img src="https://iskool.online/apple-touch-icon.png?v=1.1?v=1.0" width="34" height="34" alt="iSkool" style="display:block;border-radius:7px;">
            </td>
            <td style="vertical-align:middle;">
              <span style="font-size:15px;font-weight:600;color:#0d0d0d;letter-spacing:-0.2px;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Helvetica,Arial,sans-serif;">iSkool</span>
            </td>
          </tr>
        </table>

        <!-- Heading -->
        <p style="margin:0 0 8px;font-size:24px;font-weight:600;color:#0d0d0d;line-height:1.3;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Helvetica,Arial,sans-serif;">Your school platform is live.</p>
        <p style="margin:0 0 28px;font-size:16px;color:#4a4a4a;line-height:1.7;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Helvetica,Arial,sans-serif;">
          Dear <strong>' . htmlspecialchars($name) . '</strong>, welcome to iSkool. Your platform for
          <strong>' . htmlspecialchars($schoolName) . '</strong> has been successfully created and is ready to use.
          Below are your login details and access codes — please keep this email safe.
        </p>

        <!-- Divider -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;margin-bottom:8px;"><tr><td style="border-top:1px solid #e8e6e2;"></td></tr></table>

        <!-- Login details -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;margin-bottom:32px;">
          <tr>
            <td style="padding:4px 0 2px;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#4fd1c5;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Helvetica,Arial,sans-serif;" colspan="2">Your Login Details</td>
          </tr>
          <tr>
            <td style="padding:10px 0;font-size:14px;color:#6a6a6a;width:120px;vertical-align:top;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Helvetica,Arial,sans-serif;">Platform URL</td>
            <td style="padding:10px 0;font-size:14px;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Helvetica,Arial,sans-serif;">
              <a href="' . htmlspecialchars($schoolUrl) . '" style="color:#0866ff;text-decoration:none;font-weight:600;">' . htmlspecialchars($schoolUrl) . '</a>
            </td>
          </tr>
          <tr>
            <td style="padding:10px 0;font-size:14px;color:#6a6a6a;vertical-align:top;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Helvetica,Arial,sans-serif;">Email</td>
            <td style="padding:10px 0;font-size:14px;color:#0d0d0d;font-weight:500;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Helvetica,Arial,sans-serif;">' . htmlspecialchars($email) . '</td>
          </tr>
          <tr>
            <td style="padding:10px 0;font-size:14px;color:#6a6a6a;vertical-align:top;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Helvetica,Arial,sans-serif;">Password</td>
            <td style="padding:10px 0;font-size:14px;color:#0d0d0d;font-weight:500;font-family:monospace;">' . htmlspecialchars($password) . '</td>
          </tr>
        </table>

        <!-- Divider -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;margin-bottom:8px;"><tr><td style="border-top:1px solid #e8e6e2;"></td></tr></table>

        <!-- Access keys -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;margin-bottom:32px;">
          <tr>
            <td style="padding:4px 0 2px;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#4fd1c5;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Helvetica,Arial,sans-serif;" colspan="2">Registration Access Keys</td>
          </tr>
          <tr>
            <td style="padding:10px 0;font-size:14px;color:#6a6a6a;width:120px;vertical-align:middle;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Helvetica,Arial,sans-serif;">Learner Key</td>
            <td style="padding:10px 0;vertical-align:middle;">
              <span style="background:#e8faf8;color:#0d6e62;font-family:monospace;font-weight:700;font-size:14px;padding:4px 12px;border-radius:4px;">' . htmlspecialchars($keys['learner']) . '</span>
            </td>
          </tr>
          <tr>
            <td style="padding:10px 0;font-size:14px;color:#6a6a6a;vertical-align:middle;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Helvetica,Arial,sans-serif;">Teacher Key</td>
            <td style="padding:10px 0;vertical-align:middle;">
              <span style="background:#fff3e0;color:#e65100;font-family:monospace;font-weight:700;font-size:14px;padding:4px 12px;border-radius:4px;">' . htmlspecialchars($keys['teacher']) . '</span>
            </td>
          </tr>
          <tr>
            <td style="padding:10px 0;font-size:14px;color:#6a6a6a;vertical-align:middle;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Helvetica,Arial,sans-serif;">Parent Key</td>
            <td style="padding:10px 0;vertical-align:middle;">
              <span style="background:#f3e5f5;color:#6a1b9a;font-family:monospace;font-weight:700;font-size:14px;padding:4px 12px;border-radius:4px;">' . htmlspecialchars($keys['parent']) . '</span>
            </td>
          </tr>
          <tr>
            <td style="padding:10px 0;font-size:14px;color:#6a6a6a;vertical-align:middle;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Helvetica,Arial,sans-serif;">Admin Key</td>
            <td style="padding:10px 0;vertical-align:middle;">
              <span style="background:#fce4ec;color:#880e4f;font-family:monospace;font-weight:700;font-size:14px;padding:4px 12px;border-radius:4px;">' . htmlspecialchars($keys['admin']) . '</span>
            </td>
          </tr>
        </table>

        <!-- Security warning -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;margin-bottom:32px;">
          <tr>
            <td style="padding:16px 20px;background:#fffbeb;border-left:3px solid #f59e0b;border-radius:4px;">
              <p style="margin:0 0 6px;font-size:13px;font-weight:700;color:#b45309;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Helvetica,Arial,sans-serif;">⚠️ Important Security Notice</p>
              <p style="margin:0;font-size:13px;color:#78350f;line-height:1.6;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Helvetica,Arial,sans-serif;">
                The <strong>Teacher Key</strong> and <strong>Admin Key</strong> must only be shared with authorised staff members.
                <strong>Do not share these codes with learners or parents.</strong>
                iSkool is not responsible for unauthorised registrations resulting from leaked access codes.
              </p>
            </td>
          </tr>
        </table>

        <!-- Divider -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;margin-bottom:8px;"><tr><td style="border-top:1px solid #e8e6e2;"></td></tr></table>

        <!-- Getting started -->
        <p style="margin:0 0 16px;font-size:14px;font-weight:600;color:#0d0d0d;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Helvetica,Arial,sans-serif;">Getting started:</p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;margin-bottom:36px;">
          <tr><td style="padding:8px 0;font-size:14px;color:#4a4a4a;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Helvetica,Arial,sans-serif;">
            <span style="display:inline-block;background:#4fd1c5;color:#0d1117;font-weight:700;font-size:11px;width:20px;height:20px;border-radius:50%;text-align:center;line-height:20px;margin-right:10px;">1</span>
            Log in at <a href="' . htmlspecialchars($schoolUrl) . '" style="color:#0866ff;text-decoration:none;">' . htmlspecialchars($schoolUrl) . '</a> using your email and password above.
          </td></tr>
          <tr><td style="padding:8px 0;font-size:14px;color:#4a4a4a;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Helvetica,Arial,sans-serif;">
            <span style="display:inline-block;background:#4fd1c5;color:#0d1117;font-weight:700;font-size:11px;width:20px;height:20px;border-radius:50%;text-align:center;line-height:20px;margin-right:10px;">2</span>
            Share the <strong>Teacher Key</strong> with your teachers so they can register.
          </td></tr>
          <tr><td style="padding:8px 0;font-size:14px;color:#4a4a4a;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Helvetica,Arial,sans-serif;">
            <span style="display:inline-block;background:#4fd1c5;color:#0d1117;font-weight:700;font-size:11px;width:20px;height:20px;border-radius:50%;text-align:center;line-height:20px;margin-right:10px;">3</span>
            Create your school\'s classes from the Admin dashboard.
          </td></tr>
          <tr><td style="padding:8px 0;font-size:14px;color:#4a4a4a;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Helvetica,Arial,sans-serif;">
            <span style="display:inline-block;background:#4fd1c5;color:#0d1117;font-weight:700;font-size:11px;width:20px;height:20px;border-radius:50%;text-align:center;line-height:20px;margin-right:10px;">4</span>
            Share the <strong>Learner Key</strong> with your learners to register.
          </td></tr>
        </table>

        <!-- Divider -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;margin-bottom:24px;"><tr><td style="border-top:1px solid #e8e6e2;"></td></tr></table>

        <p style="margin:0 0 24px;font-size:14px;color:#6a6a6a;line-height:1.6;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Helvetica,Arial,sans-serif;">
          If you need any assistance contact us at
          <a href="mailto:support@iskool.online" style="color:#0866ff;text-decoration:none;">support@iskool.online</a>.
          We are here to help you get the most out of iSkool.
        </p>

        <p style="margin:0 0 40px;font-size:14px;color:#4a4a4a;line-height:1.6;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Helvetica,Arial,sans-serif;">Thanks,<br>iSkool Support</p>

        <!-- Footer -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;margin-top:8px;">
          <tr>
            <td style="background:#f2f2f2;border-radius:8px;padding:24px 28px;">
            <img src="https://iskool.online/email.png" alt="iSkool" style="display:block;height:24px;">
              <p style="margin:0 0 8px;font-size:12px;color:#9a9a9a;line-height:1.6;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Helvetica,Arial,sans-serif;">
                iSkool (Pty) Ltd, Johannesburg, South Africa &nbsp;&middot;&nbsp;
                <a href="https://iskool.online" style="color:#9a9a9a;text-decoration:none;">iskool.online</a> &nbsp;&middot;&nbsp;
                <a href="mailto:support@iskool.online" style="color:#9a9a9a;text-decoration:none;">support@iskool.online</a>
              </p>
              <p style="margin:0;font-size:12px;color:#9a9a9a;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Helvetica,Arial,sans-serif;">This email was sent to ' . htmlspecialchars($email) . '. Please do not forward this email.</p>
            </td>
          </tr>
        </table>

      </td>
    </tr>
  </table>
</td></tr>
</table>

</body>
</html>';

    $mail->send();
    header('Location: index.php?sent=School+Admin+Onboarding');
} catch (Exception $e) {
    die('<p style="font-family:sans-serif;color:red;padding:20px;">❌ Failed: ' . $mail->ErrorInfo . '</p>');
}