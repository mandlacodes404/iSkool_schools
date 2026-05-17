<?php
/**
 * tools/email-preview/test_welcome.php
 * Fires the welcome/registration email for any role.
 * Usage: test_welcome.php?role=learner|teacher|parent|school_admin
 */

require_once dirname(__DIR__, 2) . '/config.php';
require_once dirname(__DIR__, 2) . '/vendor/autoload.php';

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

$role       = $_GET['role'] ?? 'learner';
$first_name = 'Mandla';
$email      = 'mandlasimphiwe99@gmail.com';

$schoolUrl        = rtrim(BASE_URL, '/');
$schoolNameResult = $conn->query("SELECT setting_value FROM school_name WHERE setting_key = 'school_name' LIMIT 1");
$schoolName       = ($schoolNameResult && $row = $schoolNameResult->fetch_assoc()) ? $row['setting_value'] : $_SERVER['HTTP_HOST'];

$roleLabel = ucfirst($role);
$roleTips  = '';

if ($role === 'learner') {
    $roleLabel = 'Learner';
    $roleTips  = '
        <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:12px;">
            <tr><td style="padding:10px 0;font-size:15px;color:#4a4a4a;line-height:1.6;border-bottom:1px solid #f0f0f0;">Log in and join your class using the Learner Access Key from your teacher.</td></tr>
            <tr><td style="padding:10px 0;font-size:15px;color:#4a4a4a;line-height:1.6;border-bottom:1px solid #f0f0f0;">Allow notifications so you never miss a quiz or announcement.</td></tr>
            <tr><td style="padding:10px 0;font-size:15px;color:#4a4a4a;line-height:1.6;border-bottom:1px solid #f0f0f0;">Check your Grades section to track your performance across all subjects.</td></tr>
            <tr><td style="padding:10px 0;font-size:15px;color:#4a4a4a;line-height:1.6;">
                Install iSkool on your phone for the best experience. Follow our step-by-step install guide attached to this email, or visit
                <a href="https://iskool.online/install_guide.html" style="color:#0866ff;text-decoration:none;font-weight:500;">iskool.online/install_guide.html</a> anytime.
            </td></tr>
        </table>';
} elseif ($role === 'teacher') {
    $roleLabel = 'Teacher';
    $roleTips  = '
        <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:12px;">
            <tr><td style="padding:10px 0;font-size:15px;color:#4a4a4a;line-height:1.6;border-bottom:1px solid #f0f0f0;">Log in and go to Home — your quick snapshot dashboard is waiting.</td></tr>
            <tr><td style="padding:10px 0;font-size:15px;color:#4a4a4a;line-height:1.6;border-bottom:1px solid #f0f0f0;">Ask your school admin for your class assignment so learners can find you.</td></tr>
            <tr><td style="padding:10px 0;font-size:15px;color:#4a4a4a;line-height:1.6;border-bottom:1px solid #f0f0f0;">Create your first quiz from the Quizzes section — it takes under 5 minutes.</td></tr>
            <tr><td style="padding:10px 0;font-size:15px;color:#4a4a4a;line-height:1.6;">Check Analytics after your first quiz to see class performance and gender gap data.</td></tr>
        </table>';
} elseif ($role === 'parent') {
    $roleLabel = 'Parent';
    $roleTips  = '
        <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:12px;">
            <tr><td style="padding:10px 0;font-size:13px;color:#555;">
                <span style="display:inline-block;background:#f59e0b;color:#0d1117;font-weight:700;font-size:11px;width:20px;height:20px;border-radius:50%;text-align:center;line-height:20px;margin-right:10px;">1</span>
                Log in and go to <strong>My Child</strong> to link your account to your child.
            </td></tr>
            <tr><td style="padding:10px 0;font-size:13px;color:#555;">
                <span style="display:inline-block;background:#f59e0b;color:#0d1117;font-weight:700;font-size:11px;width:20px;height:20px;border-radius:50%;text-align:center;line-height:20px;margin-right:10px;">2</span>
                Once linked you can track your child\'s <strong>grades and quiz results</strong> in real time.
            </td></tr>
            <tr><td style="padding:10px 0;font-size:13px;color:#555;">
                <span style="display:inline-block;background:#f59e0b;color:#0d1117;font-weight:700;font-size:11px;width:20px;height:20px;border-radius:50%;text-align:center;line-height:20px;margin-right:10px;">3</span>
                Allow <strong>notifications</strong> to get instant alerts when new results are published.
            </td></tr>
        </table>';
} elseif ($role === 'school_admin') {
    $roleLabel = 'School Admin';
    $roleTips  = '
        <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:12px;">
            <tr><td style="padding:10px 0;font-size:13px;color:#555;">
                <span style="display:inline-block;background:#f85149;color:#fff;font-weight:700;font-size:11px;width:20px;height:20px;border-radius:50%;text-align:center;line-height:20px;margin-right:10px;">1</span>
                Log in and go to <strong>Classes</strong> — create your school\'s classes before inviting anyone.
            </td></tr>
            <tr><td style="padding:10px 0;font-size:13px;color:#555;">
                <span style="display:inline-block;background:#f85149;color:#fff;font-weight:700;font-size:11px;width:20px;height:20px;border-radius:50%;text-align:center;line-height:20px;margin-right:10px;">2</span>
                Share the <strong>Teacher Access Key</strong> with your teachers so they can register.
            </td></tr>
            <tr><td style="padding:10px 0;font-size:13px;color:#555;">
                <span style="display:inline-block;background:#f85149;color:#fff;font-weight:700;font-size:11px;width:20px;height:20px;border-radius:50%;text-align:center;line-height:20px;margin-right:10px;">3</span>
                Share the <strong>Learner Access Key</strong> with your learners to register and join classes.
            </td></tr>
            <tr><td style="padding:10px 0;font-size:13px;color:#555;">
                <span style="display:inline-block;background:#f85149;color:#fff;font-weight:700;font-size:11px;width:20px;height:20px;border-radius:50%;text-align:center;line-height:20px;margin-right:10px;">4</span>
                Check the <strong>Analytics</strong> dashboard to monitor school-wide performance from day one.
            </td></tr>
        </table>';
}

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
    $mail->addAddress($email, $first_name);
    $mail->isHTML(true);
    $mail->Subject = '[TEST] Welcome to iSkool, ' . $first_name . '!';
    $mail->Body = '
<!DOCTYPE html>
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
              <img src="https://iskool.online/apple-touch-icon.png?v=1.1" width="36" height="36" alt="iSkool" style="display:block;border-radius:7px;">
            </td>
            <td style="vertical-align:middle;">
              <span style="font-size:15px;font-weight:600;color:#0d0d0d;letter-spacing:-0.2px;">iSkool</span>
            </td>
          </tr>
        </table>

        <!-- Heading -->
        <p style="margin:0 0 20px;font-size:24px;font-weight:600;color:#0d0d0d;line-height:1.3;">Welcome to iSkool, ' . htmlspecialchars($first_name) . '.</p>

        <p style="margin:0 0 28px;font-size:16px;color:#4a4a4a;line-height:1.7;">
          Your account has been successfully created at
          <a href="' . $schoolUrl . '" style="color:#0866ff;text-decoration:none;">' . htmlspecialchars($schoolName) . '</a>.
          Here are your account details.
        </p>

        <!-- Divider -->
        <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:8px;"><tr><td style="border-top:1px solid #e8e6e2;"></td></tr></table>

        <!-- Account details -->
        <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
          <tr>
            <td style="padding:10px 0;font-size:14px;color:#6a6a6a;width:100px;vertical-align:top;">School</td>
            <td style="padding:10px 0;font-size:14px;color:#0d0d0d;font-weight:500;">' . htmlspecialchars($schoolName) . '</td>
          </tr>
          <tr>
            <td style="padding:10px 0;font-size:14px;color:#6a6a6a;vertical-align:top;">Platform</td>
            <td style="padding:10px 0;font-size:14px;"><a href="' . $schoolUrl . '" style="color:#0866ff;text-decoration:none;">' . $schoolUrl . '</a></td>
          </tr>
          <tr>
            <td style="padding:10px 0;font-size:14px;color:#6a6a6a;vertical-align:top;">Role</td>
            <td style="padding:10px 0;font-size:14px;color:#0d0d0d;font-weight:500;">' . $roleLabel . '</td>
          </tr>
        </table>

        <!-- Getting started -->
        <p style="margin:0 0 16px;font-size:16px;color:#4a4a4a;line-height:1.7;">Here is how to get started:</p>
        ' . $roleTips . '

        <!-- CTA -->
        <p style="margin:28px 0 40px;font-size:16px;line-height:1.6;">
          <a href="' . $schoolUrl . '" style="color:#0866ff;text-decoration:none;font-weight:500;">Log in to iSkool →</a>
        </p>

        <!-- Divider -->
        <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;"><tr><td style="border-top:1px solid #e8e6e2;"></td></tr></table>

        <!-- Security note -->
        <p style="margin:0 0 24px;font-size:14px;color:#6a6a6a;line-height:1.7;">
          If you did not register for this account, contact us immediately at
          <a href="mailto:support@iskool.online" style="color:#0866ff;text-decoration:none;">support@iskool.online</a>.
        </p>

        <p style="margin:0 0 40px;font-size:14px;color:#4a4a4a;line-height:1.7;">Thanks,<br>iSkool Support</p>

        <!-- Footer -->
        <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:8px;">
          <tr>
            <td style="background:#f2f2f2;border-radius:8px;padding:24px 28px;">
              <p style="margin:0 0 10px;font-size:13px;font-weight:700;color:#0d0d0d;">iSkool</p>
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

    // Attach the install guide (only for learner role)
    if ($role === 'learner') {
        $guidePath = dirname(__DIR__, 2) . '/install_guide.html';
        if (file_exists($guidePath)) {
            $mail->addAttachment($guidePath, 'iSkool Install Guide.html');
        }
    }

    $mail->send();
    header("Location: index.php?sent=Welcome&role=$role");
} catch (Exception $e) {
    die('<p style="font-family:sans-serif;color:red;padding:20px;">❌ Failed: ' . $mail->ErrorInfo . '</p>');
}