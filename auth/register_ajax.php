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
require_once __DIR__ . '/rate_limit_functions.php';
require_once __DIR__ . '/parent_invite_db.php';

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

// A parent who came from a learner's invite link has the invite code in the pending_parent_invite cookie (set by
// parent_link.php). When they leave the access key empty, that invite takes the place of the key, and the account is
// linked to the learner in the same step. A parent who types the access key registers the usual way.
$invite_code = '';
if ($role === 'parent' && $access_key === '') {
    $cookie_code = $_COOKIE['pending_parent_invite'] ?? '';
    if (parent_invite_is_valid_code_format($cookie_code)) {
        $invite_code = $cookie_code;
    }
}
$use_invite = $invite_code !== '';

// ── Validation ──
if ($role === 'admin') {
    echo json_encode(['success' => false, 'message' => 'Admin accounts can only be created by the system.']);
    exit();
}

if (empty($title) || empty($first_name) || empty($surname) || empty($email) || empty($role) || ($access_key === '' && !$use_invite)) {
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

// ── Validate the invite, or the access key ──
$invite = null;
if ($use_invite) {
    // Checked before anyone is signed in, so wrong codes are rate limited by IP and every bad code gets one message.
    $client_ip = auth_rate_limit_client_ip();
    $window    = 15 * 60;

    if (auth_rate_limit_is_blocked($conn, 'parent_invite_register', 'ip', $client_ip, 10, $window)) {
        http_response_code(429);
        echo json_encode(['success' => false, 'message' => 'Too many attempts. Please wait a few minutes and try again.']);
        exit();
    }

    $invite = parent_invite_find_open($conn, $invite_code);
    if ($invite === null) {
        auth_rate_limit_record_attempt($conn, 'parent_invite_register', 'ip', $client_ip, $window);
        echo json_encode(['success' => false, 'message' => 'This invite link is not valid or has expired. Ask your child to create a new one, or enter the parent access key from your school.']);
        exit();
    }
} else {
    $keyStmt = $conn->prepare("SELECT id FROM access_keys WHERE role = ? AND access_key = ?");
    $keyStmt->bind_param("ss", $role, $access_key);
    $keyStmt->execute();
    $keyStmt->store_result();

    if ($keyStmt->num_rows === 0) {
        echo json_encode(['success' => false, 'message' => 'Invalid or already used access key.']);
        exit();
    }
    $keyStmt->close();
}

// ── Check for duplicate email ──
$check = $conn->prepare("SELECT id FROM users WHERE email = ?");
$check->bind_param("s", $email);
$check->execute();
$check->store_result();

if ($check->num_rows > 0) {
    $taken = $use_invite
        ? 'This email is already registered. Log in instead, and you will come back to confirm the link.'
        : 'This email is already registered.';
    echo json_encode(['success' => false, 'message' => $taken]);
    exit();
}
$check->close();

// ── Insert user ──
// With an invite, the account, the claim on the invite and the link to the learner are saved together or not at all:
// if someone else used the link a moment earlier, no account is left behind.
$linked = false;
$in_transaction = false;
try {
    if ($use_invite) {
        $conn->begin_transaction();
        $in_transaction = true;
    }

    $stmt = $conn->prepare("
        INSERT INTO users 
        (title, name, second_name, surname, email, password, role, profile_pic, gender, age)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ");
    $stmt->bind_param("sssssssssi", $title, $first_name, $second_name, $surname, $email, $password, $role, $defaultPic, $gender, $age);

    if (!$stmt->execute()) {
        if ($in_transaction) {
            $conn->rollback();
        }
        echo json_encode(['success' => false, 'message' => 'Registration failed. Please try again.']);
        exit();
    }

    if ($use_invite) {
        if (!parent_invite_claim($conn, $invite['id'], $email)) {
            $conn->rollback();
            $in_transaction = false;
            auth_rate_limit_record_attempt($conn, 'parent_invite_register', 'ip', $client_ip, $window);
            echo json_encode(['success' => false, 'message' => 'This invite link has just been used. Ask your child to create a new one, or enter the parent access key from your school.']);
            exit();
        }
        parent_invite_link($conn, $email, $invite['learner_email']);
        $conn->commit();
        $in_transaction = false;
        $linked = true;

        // The invite is spent, so the reminder cookie must not send this parent back to a link that no longer works.
        setcookie('pending_parent_invite', '', [
            'expires'  => time() - 3600,
            'path'     => '/',
            'secure'   => true,
            'httponly' => true,
            'samesite' => 'Lax',
        ]);
    }
} catch (Throwable $e) {
    if ($in_transaction) {
        try { $conn->rollback(); } catch (Throwable $ignored) {}
    }
    error_log('register_ajax failed: ' . $e->getMessage());
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
                    ' . ($linked
                        ? 'Log in. Your child is already linked, so you will see their progress on <strong>Home</strong>.'
                        : 'Log in. Ask your child to open <strong>My Class</strong> in iSkool and create a parent link, then open that link to connect your account to them.') . '
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
    $mail->Body = <<<HTML
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
<body style="margin:0;padding:0;background:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">

  <table class="outer-table" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;max-width:600px;margin:0 auto;">
    <tr>
      <td class="inner-cell" style="padding:40px 44px 48px;">

        <table cellpadding="0" cellspacing="0" style="margin-bottom:36px;">
          <tr>
            <td style="vertical-align:middle;padding-right:8px;">
              <img src="https://iskool.xyz/apple-touch-icon.png?v=1.1" width="36" height="36" alt="iSkool" style="display:block;border-radius:7px;">
            </td>
            <td style="vertical-align:middle;">
              <span style="font-size:13px;font-weight:600;color:#0d0d0d;letter-spacing:-0.2px;">iSkool</span>
            </td>
          </tr>
        </table>

        <p style="margin:0 0 20px;font-size:20px;font-weight:600;color:#0d0d0d;line-height:1.3;">Welcome to iSkool, {{FIRST_NAME}}.</p>

        <p style="margin:0 0 28px;font-size:14px;color:#4a4a4a;line-height:1.7;">
          Your account has been successfully created at
          <a href="{{SCHOOL_URL}}" style="color:#0866ff;text-decoration:none;">{{SCHOOL_NAME}}</a>.
        </p>

        <p style="margin:0 0 16px;font-size:14px;color:#4a4a4a;line-height:1.7;">Here is how to get started:</p>
        {{ROLE_TIPS}}

        <p style="margin:28px 0 40px;font-size:14px;line-height:1.6;">
          <a href="{{SCHOOL_URL}}" style="color:#0866ff;text-decoration:none;font-weight:500;">Log in to iSkool →</a>
        </p>

        <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;"><tr><td style="border-top:1px solid #e8e6e2;"></td></tr></table>

        <p style="margin:0 0 24px;font-size:13px;color:#6a6a6a;line-height:1.7;">
          If you did not register for this account, contact us immediately at
          <a href="mailto:support@iskool.xyz" style="color:#0866ff;text-decoration:none;">support@iskool.xyz</a>.
        </p>

        <p style="margin:0 0 40px;font-size:13px;color:#4a4a4a;line-height:1.7;">Thanks,<br>iSkool Support</p>

        <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:8px;">
          <tr>
            <td style="background:#f2f2f2;border-radius:8px;padding:24px 28px;">
              <img src="https://iskool.xyz/email.png" alt="iSkool" style="display:block;height:24px;">
              <p style="margin:0 0 8px;font-size:12px;color:#9a9a9a;line-height:1.6;">
                iSkool (Pty) Ltd, Johannesburg, South Africa &nbsp;&middot;&nbsp;
                <a href="https://iskool.xyz" style="color:#9a9a9a;text-decoration:none;">iskool.xyz</a> &nbsp;&middot;&nbsp;
                <a href="mailto:support@iskool.xyz" style="color:#9a9a9a;text-decoration:none;">support@iskool.xyz</a>
              </p>
              <p style="margin:0;font-size:12px;color:#9a9a9a;line-height:1.6;">This email was sent to {{RECIPIENT_EMAIL}}. Please do not forward this email.</p>
            </td>
          </tr>
        </table>

      </td>
    </tr>
  </table>

</body>
</html>
HTML;

    $mail->Body = str_replace([
        '{{FIRST_NAME}}',
        '{{SCHOOL_URL}}',
        '{{SCHOOL_NAME}}',
        '{{ROLE_TIPS}}',
        '{{RECIPIENT_EMAIL}}'
    ], [
        htmlspecialchars($first_name),
        $schoolUrl,
        htmlspecialchars($schoolName),
        $roleTips,
        htmlspecialchars($email)
    ], $mail->Body);

    $mail->send();
} catch (Exception $e) {
    // Silently fail — registration was already successful
}

echo json_encode($linked
    ? ['success' => true, 'linked' => true, 'learner_name' => $invite['learner_name']]
    : ['success' => true]);
exit();
