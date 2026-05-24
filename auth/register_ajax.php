<?php
require_once __DIR__ . '/session_guard.php';
require_once __DIR__ . '/csrf_helper.php';
/**
 * register_ajax.php
 *
 * AJAX-only registration endpoint. Called by fetch() in index.php.
 * Always returns JSON — never redirects or renders HTML.
 *
 * Response shape:
 *   { "success": true }
 *   { "success": false, "message": "..." }
 *
 * On success, the JS in index.php redirects to registration_success.php.
 */

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed.']);
    exit();
}

verify_csrf_token();

require_once __DIR__ . '/../config.php';

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

// ── Collect and sanitise inputs ──
$title      = trim($_POST['title'] ?? '');
$first_name = trim($_POST['name'] ?? '');
$second_name = trim($_POST['second_name'] ?? '');
$surname    = trim($_POST['surname'] ?? '');
$email      = trim($_POST['email'] ?? '');
$role       = $_POST['role'] ?? '';
$access_key = trim($_POST['access_key'] ?? '');
$gender     = $_POST['gender'] ?? '';
$age        = (int)($_POST['age'] ?? 0);
$defaultPic = 'uploads/default_profile.png';

// ── Validation ──
if ($role === 'admin') {
    echo json_encode(['success' => false, 'message' => 'Admin accounts can only be created by the system.']);
    exit();
}

if (empty($title) || empty($first_name) || empty($surname) || empty($email) || empty($role) || empty($access_key)) {
    echo json_encode(['success' => false, 'message' => 'All fields are required.']);
    exit();
}

$raw_password     = $_POST['password'] ?? '';
$confirm_password = $_POST['confirm_password'] ?? '';

if (strlen($raw_password) < 8) {
    echo json_encode(['success' => false, 'message' => 'Password must be at least 8 characters long.']);
    exit();
}

if ($raw_password !== $confirm_password) {
    echo json_encode(['success' => false, 'message' => 'Passwords do not match. Please try again.']);
    exit();
}

$password = password_hash($raw_password, PASSWORD_DEFAULT);

// ── Validate access key ──
$keyStmt = $conn->prepare("SELECT id FROM access_keys WHERE role = ? AND access_key = ?");
$keyStmt->bind_param("ss", $role, $access_key);
$keyStmt->execute();
$keyStmt->store_result();

if ($keyStmt->num_rows === 0) {
    echo json_encode(['success' => false, 'message' => 'Invalid or already used access key.']);
    exit();
}
$keyStmt->close();

// ── Check for duplicate email ──
$check = $conn->prepare("SELECT id FROM users WHERE email = ?");
$check->bind_param("s", $email);
$check->execute();
$check->store_result();

if ($check->num_rows > 0) {
    echo json_encode(['success' => false, 'message' => 'This email is already registered.']);
    exit();
}
$check->close();

// ── Insert user ──
$stmt = $conn->prepare("
    INSERT INTO users 
    (title, name, second_name, surname, email, password, role, profile_pic, gender, age)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
");
$stmt->bind_param("sssssssssi", $title, $first_name, $second_name, $surname, $email, $password, $role, $defaultPic, $gender, $age);

if (!$stmt->execute()) {
    echo json_encode(['success' => false, 'message' => 'Registration failed. Please try again.']);
    exit();
}

// ── Send welcome email (silently fail — user can still log in) ──
try {
    require __DIR__ . '/../vendor/autoload.php';
    $mail = new PHPMailer(true);

    $roleLabel = ucfirst($role);
    $roleColor = '#39d5c1';
    $roleEmoji = '👤';
    $roleTips  = '';

    if ($role === 'learner') {
        $roleEmoji = '🎓';
        $roleColor = '#39d5c1';
        $roleTips  = '
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:12px;">
                <tr><td style="padding:10px 0;font-size:15px;color:#4a4a4a;line-height:1.6;border-bottom:1px solid #f0f0f0;">Log in and join your class using the Learner Access Key from your teacher.</td></tr>
                <tr><td style="padding:10px 0;font-size:15px;color:#4a4a4a;line-height:1.6;border-bottom:1px solid #f0f0f0;">Allow notifications so you never miss a quiz or announcement.</td></tr>
                <tr><td style="padding:10px 0;font-size:15px;color:#4a4a4a;line-height:1.6;border-bottom:1px solid #f0f0f0;">Check your Grades section to track your performance across all subjects.</td></tr>
                <tr><td style="padding:10px 0;font-size:15px;color:#4a4a4a;line-height:1.6;">Install iSkool on your phone — tap Add to Home Screen in your browser for the best experience.</td></tr>
            </table>';

    } elseif ($role === 'teacher') {
        $roleEmoji = '👨‍🏫';
        $roleColor = '#a78bfa';
        $roleTips  = '
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:12px;">
                <tr><td style="padding:10px 0;font-size:15px;color:#4a4a4a;line-height:1.6;border-bottom:1px solid #f0f0f0;">Log in and go to Home — your quick snapshot dashboard is waiting.</td></tr>
                <tr><td style="padding:10px 0;font-size:15px;color:#4a4a4a;line-height:1.6;border-bottom:1px solid #f0f0f0;">Ask your school admin for your class assignment so learners can find you.</td></tr>
                <tr><td style="padding:10px 0;font-size:15px;color:#4a4a4a;line-height:1.6;border-bottom:1px solid #f0f0f0;">Create your first quiz from the Quizzes section — it takes under 5 minutes.</td></tr>
                <tr><td style="padding:10px 0;font-size:15px;color:#4a4a4a;line-height:1.6;">Check Analytics after your first quiz to see class performance and gender gap data.</td></tr>
            </table>';

    } elseif ($role === 'parent') {
        $roleEmoji = '👨‍👩‍👧';
        $roleColor = '#f59e0b';
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
        $roleEmoji = '🏫';
        $roleColor = '#f85149';
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

    $schoolUrl = 'https://' . $_SERVER['HTTP_HOST'];
    $schoolNameResult = $conn->query("SELECT setting_value FROM school_name WHERE setting_key = 'school_name' LIMIT 1");
    $schoolName = ($schoolNameResult && $row = $schoolNameResult->fetch_assoc())
        ? $row['setting_value']
        : $_SERVER['HTTP_HOST'];

    $mail->isSMTP();
    $mail->Host       = getenv('SMTP_HOST');
    $mail->SMTPAuth   = true;
    $mail->Username   = getenv('SMTP_USER');
    $mail->Password   = getenv('SMTP_PASSWORD');
    $mail->SMTPSecure = PHPMailer::ENCRYPTION_SMTPS;
    $mail->Port       = getenv('SMTP_PORT');

    $from_email = getenv('SMTP_FROM');
    $mail->setFrom($from_email, 'iSkool Support');
    $mail->addAddress($email, $first_name);
    $mail->isHTML(true);
    $mail->Subject = 'Welcome to iSkool, ' . $first_name . '!';
    $mail->Body    = '<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
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
        <p style="margin:0 0 20px;font-size:24px;font-weight:600;color:#0d0d0d;line-height:1.3;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Helvetica,Arial,sans-serif;">Welcome to iSkool, ' . htmlspecialchars($first_name) . '.</p>
        <p style="margin:0 0 28px;font-size:16px;color:#4a4a4a;line-height:1.7;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Helvetica,Arial,sans-serif;">
          Your account has been successfully created at
          <a href="' . $schoolUrl . '" style="color:#0866ff;text-decoration:none;">' . htmlspecialchars($schoolName) . '</a>.
          Here are your account details.
        </p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;margin-bottom:8px;"><tr><td style="border-top:1px solid #e8e6e2;"></td></tr></table>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;margin-bottom:32px;">
          <tr>
            <td style="padding:10px 0;font-size:14px;color:#6a6a6a;width:100px;vertical-align:top;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Helvetica,Arial,sans-serif;">School</td>
            <td style="padding:10px 0;font-size:14px;color:#0d0d0d;font-weight:500;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Helvetica,Arial,sans-serif;">' . htmlspecialchars($schoolName) . '</td>
          </tr>
          <tr>
            <td style="padding:10px 0;font-size:14px;color:#6a6a6a;vertical-align:top;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Helvetica,Arial,sans-serif;">Platform</td>
            <td style="padding:10px 0;font-size:14px;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Helvetica,Arial,sans-serif;"><a href="' . $schoolUrl . '" style="color:#0866ff;text-decoration:none;">' . $schoolUrl . '</a></td>
          </tr>
          <tr>
            <td style="padding:10px 0;font-size:14px;color:#6a6a6a;vertical-align:top;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Helvetica,Arial,sans-serif;">Role</td>
            <td style="padding:10px 0;font-size:14px;color:#0d0d0d;font-weight:500;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Helvetica,Arial,sans-serif;">' . $roleLabel . '</td>
          </tr>
        </table>
        <p style="margin:0 0 16px;font-size:16px;color:#4a4a4a;line-height:1.7;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Helvetica,Arial,sans-serif;">Here is how to get started:</p>
        ' . $roleTips . '
        <p style="margin:28px 0 40px;font-size:16px;line-height:1.6;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Helvetica,Arial,sans-serif;">
          <a href="' . $schoolUrl . '" style="color:#0866ff;text-decoration:none;font-weight:500;">Log in to iSkool →</a>
        </p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;margin-bottom:24px;"><tr><td style="border-top:1px solid #e8e6e2;"></td></tr></table>
        <p style="margin:0 0 24px;font-size:14px;color:#6a6a6a;line-height:1.7;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Helvetica,Arial,sans-serif;">
          If you did not register for this account, contact us immediately at
          <a href="mailto:support@iskool.online" style="color:#0866ff;text-decoration:none;">support@iskool.online</a>.
        </p>
        <p style="margin:0 0 40px;font-size:14px;color:#4a4a4a;line-height:1.7;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Helvetica,Arial,sans-serif;">Thanks,<br>iSkool Support</p>
        <p style="margin:0;font-size:12px;color:#9a9a9a;line-height:1.6;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Helvetica,Arial,sans-serif;">
          iSkool (Pty) Ltd, Johannesburg, South Africa &nbsp;&middot;&nbsp;
          <a href="https://iskool.online" style="color:#9a9a9a;text-decoration:none;">iskool.online</a> &nbsp;&middot;&nbsp;
          <a href="mailto:support@iskool.online" style="color:#9a9a9a;text-decoration:none;">support@iskool.online</a>
        </p>
        <p style="margin:6px 0 0;font-size:12px;color:#9a9a9a;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Helvetica,Arial,sans-serif;">This email was sent to ' . htmlspecialchars($email) . '. Please do not forward this email.</p>
      </td>
    </tr>
  </table>
</td></tr>
</table>
</body></html>';

    $mail->send();
} catch (Exception $e) {
    // Silently fail — registration was already successful
}

echo json_encode(['success' => true]);
exit();
