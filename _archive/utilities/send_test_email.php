<?php
/**
 * send_test_email.php
 *
 * Drop this in your iSkool root directory and visit it in the browser.
 * It will send a test welcome email to mandlasimphiwe99@gmail.com.
 * DELETE this file after you're done testing.
 */

require_once 'config.php';
require_once __DIR__ . '/vendor/autoload.php'; // PHPMailer via Composer
use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

// ── Config — change these to test different roles ──
$first_name = 'Mandla';
$email      = 'mandlasimphiwe99@gmail.com';
$role       = 'teacher'; // change to: teacher | parent | school_admin

// ── Role content ──
$roleLabel = ucfirst($role);
$roleTips  = '';

if ($role === 'learner') {
    $roleLabel = 'Learner';
    $roleTips  = '
        <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:12px;">
            <tr><td style="padding:10px 0;font-size:15px;color:#4a4a4a;line-height:1.6;border-bottom:1px solid #f0f0f0;">Log in and join your class using the Learner Access Key from your teacher.</td></tr>
            <tr><td style="padding:10px 0;font-size:15px;color:#4a4a4a;line-height:1.6;border-bottom:1px solid #f0f0f0;">Allow notifications so you never miss a quiz or announcement.</td></tr>
            <tr><td style="padding:10px 0;font-size:15px;color:#4a4a4a;line-height:1.6;border-bottom:1px solid #f0f0f0;">Check your Grades section to track your performance across all subjects.</td></tr>
            <tr><td style="padding:10px 0;font-size:15px;color:#4a4a4a;line-height:1.6;">Install iSkool on your phone — tap Add to Home Screen in your browser for the best experience.</td></tr>
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

// ── School details ──
$schoolUrl  = 'https://' . $_SERVER['HTTP_HOST'];
$schoolNameResult = $conn->query("SELECT setting_value FROM school_name WHERE setting_key = 'school_name' LIMIT 1");
$schoolName = ($schoolNameResult && $row = $schoolNameResult->fetch_assoc())
    ? $row['setting_value']
    : $_SERVER['HTTP_HOST'];

// ── Send ──
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
    $mail->Subject = 'Welcome to iSkool, ' . $first_name . '!';
    $mail->Body    = '
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
            <img src="https://iskool.online/apple-touch-icon.png" width="34" height="34" alt="iSkool" style="display:block;border-radius:5px;">
          </td>
          <td style="vertical-align:middle;">
            <span style="font-size:15px;font-weight:600;color:#0d0d0d;letter-spacing:-0.2px;">iSkool</span>
          </td>
        </tr>
      </table>

      <p style="margin:0 0 20px;font-size:24px;font-weight:600;color:#0d0d0d;line-height:1.3;">Welcome to iSkool, ' . htmlspecialchars($first_name) . '.</p>

      <p style="margin:0 0 24px;font-size:16px;color:#4a4a4a;line-height:1.7;">
        Your account has been successfully created at
        <a href="' . $schoolUrl . '" style="color:#0866ff;text-decoration:none;">' . htmlspecialchars($schoolName) . '</a>.
        Here are your account details.
      </p>

      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:8px;"><tr><td style="border-top:1px solid #e8e6e2;"></td></tr></table>

      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
        <tr>
          <td style="padding:8px 0;font-size:14px;color:#6a6a6a;width:100px;vertical-align:top;">School</td>
          <td style="padding:8px 0;font-size:14px;color:#0d0d0d;font-weight:500;">' . htmlspecialchars($schoolName) . '</td>
        </tr>
        <tr>
          <td style="padding:8px 0;font-size:14px;color:#6a6a6a;vertical-align:top;">Platform</td>
          <td style="padding:8px 0;font-size:14px;"><a href="' . $schoolUrl . '" style="color:#0866ff;text-decoration:none;">' . $schoolUrl . '</a></td>
        </tr>
        <tr>
          <td style="padding:8px 0;font-size:14px;color:#6a6a6a;vertical-align:top;">Role</td>
          <td style="padding:8px 0;font-size:14px;color:#0d0d0d;font-weight:500;">' . $roleLabel . '</td>
        </tr>
      </table>

      <p style="margin:0 0 16px;font-size:16px;color:#4a4a4a;line-height:1.7;">Here is how to get started:</p>
      ' . $roleTips . '

      <p style="margin:24px 0 32px;font-size:16px;line-height:1.6;">
        <a href="' . $schoolUrl . '" style="color:#0866ff;text-decoration:none;font-weight:500;">Log in to iSkool</a>
      </p>

      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;"><tr><td style="border-top:1px solid #e8e6e2;"></td></tr></table>

      <p style="margin:0 0 24px;font-size:14px;color:#6a6a6a;line-height:1.7;">
        If you did not register for this account, contact us immediately at
        <a href="mailto:support@iskool.online" style="color:#0866ff;text-decoration:none;">support@iskool.online</a>.
      </p>

      <p style="margin:0 0 36px;font-size:14px;color:#4a4a4a;line-height:1.7;">Thanks,<br>iSkool Support</p>

      <table width="100%" cellpadding="0" cellspacing="0">
        <tr><td style="border-top:1px solid #e8e6e2;padding-top:24px;">
          <p style="margin:0;font-size:12px;color:#9a9a9a;line-height:1.6;">
            iSkool (Pty) Ltd, Johannesburg, South Africa &nbsp;&middot;&nbsp;
            <a href="https://iskool.online" style="color:#9a9a9a;text-decoration:none;">iskool.online</a> &nbsp;&middot;&nbsp;
            <a href="mailto:support@iskool.online" style="color:#9a9a9a;text-decoration:none;">support@iskool.online</a>
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

    $mail->send();
    echo '<p style="font-family:sans-serif;color:green;padding:20px;">✅ Email sent to <strong>' . $email . '</strong>. Check your inbox!</p>';
    echo '<p style="font-family:sans-serif;color:#999;padding:0 20px;font-size:13px;">⚠️ Delete this file (send_test_email.php) when you\'re done.</p>';

} catch (Exception $e) {
    echo '<p style="font-family:sans-serif;color:red;padding:20px;">❌ Email failed: ' . $mail->ErrorInfo . '</p>';
}