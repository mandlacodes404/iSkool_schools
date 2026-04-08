<?php
session_start();
require_once 'config.php';
require_once 'remember_me_functions.php'; // --- ADDED THIS ---

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

// --- Registration Logic ---
if (isset($_POST['register'])) {
    $title      = trim($_POST['title'] ?? '');
    $first_name = trim($_POST['name'] ?? '');
    $surname    = trim($_POST['surname'] ?? '');
    $email      = trim($_POST['email']);
    $password   = password_hash($_POST['password'], PASSWORD_DEFAULT);
    $role       = $_POST['role'];
    $access_key = trim($_POST['access_key']);
    $gender     = $_POST['gender'];
    $age        = (int)$_POST['age'];
    $defaultPic = 'uploads/default_profile.png';

    if ($role === 'admin') {
        $_SESSION['register_error'] = 'Admin accounts can only be created by the system.';
        $_SESSION['active_form'] = 'register';
        header("Location: index.php");
        exit();
    }

    if (empty($title) || empty($first_name) || empty($surname) || empty($email) || empty($role) || empty($access_key)) {
        $_SESSION['register_error'] = 'All fields are required.';
        $_SESSION['active_form'] = 'register';
        header("Location: index.php");
        exit();
    }

    $keyStmt = $conn->prepare("SELECT id FROM access_keys WHERE role = ? AND access_key = ?");
    $keyStmt->bind_param("ss", $role, $access_key);
    $keyStmt->execute();
    $keyStmt->store_result();

    if ($keyStmt->num_rows === 0) {
        $_SESSION['register_error'] = 'Invalid or already used access key.';
        $_SESSION['active_form'] = 'register';
        header("Location: index.php");
        exit();
    }
    $keyStmt->close();

    $check = $conn->prepare("SELECT id FROM users WHERE email = ?");
    $check->bind_param("s", $email);
    $check->execute();
    $check->store_result();

    if ($check->num_rows > 0) {
        $_SESSION['register_error'] = 'This email is already registered.';
        $_SESSION['active_form'] = 'register';
        header("Location: index.php");
        exit();
    }

    $stmt = $conn->prepare("
        INSERT INTO users 
        (title, name, surname, email, password, role, profile_pic, gender, age)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ");
    $stmt->bind_param("ssssssssi", $title, $first_name, $surname, $email, $password, $role, $defaultPic, $gender, $age);

    if ($stmt->execute()) {
       // --- START WELCOME EMAIL ---
require 'vendor/autoload.php';
$mail = new PHPMailer(true);

// ── Role specific content ──
$roleLabel = ucfirst($role);
$roleColor = '#39d5c1';
$roleEmoji = '👤';
$roleTips  = '';

if ($role === 'learner') {
    $roleEmoji = '🎓';
    $roleColor = '#39d5c1';
    $roleTips  = '
        <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:12px;">
            <tr>
                <td style="padding:10px 0;font-size:13px;color:#555;">
                    <span style="display:inline-block;background:#39d5c1;color:#0d1117;font-weight:700;font-size:11px;width:20px;height:20px;border-radius:50%;text-align:center;line-height:20px;margin-right:10px;">1</span>
                    Log in and <strong>join your class</strong> using the Learner Access Key from your teacher.
                </td>
            </tr>
            <tr>
                <td style="padding:10px 0;font-size:13px;color:#555;">
                    <span style="display:inline-block;background:#39d5c1;color:#0d1117;font-weight:700;font-size:11px;width:20px;height:20px;border-radius:50%;text-align:center;line-height:20px;margin-right:10px;">2</span>
                    <strong>Allow notifications</strong> so you never miss a quiz or announcement.
                </td>
            </tr>
            <tr>
                <td style="padding:10px 0;font-size:13px;color:#555;">
                    <span style="display:inline-block;background:#39d5c1;color:#0d1117;font-weight:700;font-size:11px;width:20px;height:20px;border-radius:50%;text-align:center;line-height:20px;margin-right:10px;">3</span>
                    Check your <strong>Grades</strong> section to track your performance across all subjects.
                </td>
            </tr>
            <tr>
                <td style="padding:10px 0;font-size:13px;color:#555;">
                    <span style="display:inline-block;background:#39d5c1;color:#0d1117;font-weight:700;font-size:11px;width:20px;height:20px;border-radius:50%;text-align:center;line-height:20px;margin-right:10px;">4</span>
                    Install iSkool on your phone — tap <strong>Add to Home Screen</strong> in your browser for the best experience.
                </td>
            </tr>
        </table>';

} elseif ($role === 'teacher') {
    $roleEmoji = '👨‍🏫';
    $roleColor = '#a78bfa';
    $roleTips  = '
        <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:12px;">
            <tr>
                <td style="padding:10px 0;font-size:13px;color:#555;">
                    <span style="display:inline-block;background:#a78bfa;color:#fff;font-weight:700;font-size:11px;width:20px;height:20px;border-radius:50%;text-align:center;line-height:20px;margin-right:10px;">1</span>
                    Log in and go to <strong>Home</strong> — your quick snapshot dashboard is waiting.
                </td>
            </tr>
            <tr>
                <td style="padding:10px 0;font-size:13px;color:#555;">
                    <span style="display:inline-block;background:#a78bfa;color:#fff;font-weight:700;font-size:11px;width:20px;height:20px;border-radius:50%;text-align:center;line-height:20px;margin-right:10px;">2</span>
                    Ask your school admin for your <strong>class assignment</strong> so learners can find you.
                </td>
            </tr>
            <tr>
                <td style="padding:10px 0;font-size:13px;color:#555;">
                    <span style="display:inline-block;background:#a78bfa;color:#fff;font-weight:700;font-size:11px;width:20px;height:20px;border-radius:50%;text-align:center;line-height:20px;margin-right:10px;">3</span>
                    Create your <strong>first quiz</strong> from the Quizzes section — it takes under 5 minutes.
                </td>
            </tr>
            <tr>
                <td style="padding:10px 0;font-size:13px;color:#555;">
                    <span style="display:inline-block;background:#a78bfa;color:#fff;font-weight:700;font-size:11px;width:20px;height:20px;border-radius:50%;text-align:center;line-height:20px;margin-right:10px;">4</span>
                    Check <strong>Analytics</strong> after your first quiz to see class performance and gender gap data.
                </td>
            </tr>
        </table>';

} elseif ($role === 'parent') {
    $roleEmoji = '👨‍👩‍👧';
    $roleColor = '#f59e0b';
    $roleTips  = '
        <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:12px;">
            <tr>
                <td style="padding:10px 0;font-size:13px;color:#555;">
                    <span style="display:inline-block;background:#f59e0b;color:#0d1117;font-weight:700;font-size:11px;width:20px;height:20px;border-radius:50%;text-align:center;line-height:20px;margin-right:10px;">1</span>
                    Log in and go to <strong>My Child</strong> to link your account to your child.
                </td>
            </tr>
            <tr>
                <td style="padding:10px 0;font-size:13px;color:#555;">
                    <span style="display:inline-block;background:#f59e0b;color:#0d1117;font-weight:700;font-size:11px;width:20px;height:20px;border-radius:50%;text-align:center;line-height:20px;margin-right:10px;">2</span>
                    Once linked you can track your child\'s <strong>grades and quiz results</strong> in real time.
                </td>
            </tr>
            <tr>
                <td style="padding:10px 0;font-size:13px;color:#555;">
                    <span style="display:inline-block;background:#f59e0b;color:#0d1117;font-weight:700;font-size:11px;width:20px;height:20px;border-radius:50%;text-align:center;line-height:20px;margin-right:10px;">3</span>
                    Allow <strong>notifications</strong> to get instant alerts when new results are published.
                </td>
            </tr>
        </table>';

} elseif ($role === 'school_admin') {
    $roleLabel = 'School Admin';
    $roleEmoji = '🏫';
    $roleColor = '#f85149';
    $roleTips  = '
        <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:12px;">
            <tr>
                <td style="padding:10px 0;font-size:13px;color:#555;">
                    <span style="display:inline-block;background:#f85149;color:#fff;font-weight:700;font-size:11px;width:20px;height:20px;border-radius:50%;text-align:center;line-height:20px;margin-right:10px;">1</span>
                    Log in and go to <strong>Classes</strong> — create your school\'s classes before inviting anyone.
                </td>
            </tr>
            <tr>
                <td style="padding:10px 0;font-size:13px;color:#555;">
                    <span style="display:inline-block;background:#f85149;color:#fff;font-weight:700;font-size:11px;width:20px;height:20px;border-radius:50%;text-align:center;line-height:20px;margin-right:10px;">2</span>
                    Share the <strong>Teacher Access Key</strong> with your teachers so they can register.
                </td>
            </tr>
            <tr>
                <td style="padding:10px 0;font-size:13px;color:#555;">
                    <span style="display:inline-block;background:#f85149;color:#fff;font-weight:700;font-size:11px;width:20px;height:20px;border-radius:50%;text-align:center;line-height:20px;margin-right:10px;">3</span>
                    Share the <strong>Learner Access Key</strong> with your learners to register and join classes.
                </td>
            </tr>
            <tr>
                <td style="padding:10px 0;font-size:13px;color:#555;">
                    <span style="display:inline-block;background:#f85149;color:#fff;font-weight:700;font-size:11px;width:20px;height:20px;border-radius:50%;text-align:center;line-height:20px;margin-right:10px;">4</span>
                    Check the <strong>Analytics</strong> dashboard to monitor school-wide performance from day one.
                </td>
            </tr>
        </table>';
}

$schoolUrl  = 'https://' . $_SERVER['HTTP_HOST'];

// Fetch proper school name from database
$schoolNameResult = $conn->query("SELECT setting_value FROM school_name WHERE setting_key = 'school_name' LIMIT 1");
$schoolName = ($schoolNameResult && $row = $schoolNameResult->fetch_assoc()) 
    ? $row['setting_value'] 
    : $_SERVER['HTTP_HOST']; // fallback to host if DB fails

try {
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
    <td style="background:#39d5c1;padding:20px 40px;text-align:center;">
      <p style="margin:0;font-size:18px;font-weight:700;color:#0d1117;">
        🎉 Welcome to iSkool ' . $roleEmoji . '
      </p>
    </td>
  </tr>

  <!-- SCHOOL ROW -->
  <tr>
    <td style="background:#161b22;padding:14px 40px;text-align:center;border-bottom:1px solid #21262d;">
      <p style="margin:0;font-size:13px;color:#8b949e;">
        <span style="color:#39d5c1;font-weight:600;">' . htmlspecialchars($schoolName) . '</span>
      </p>
    </td>
  </tr>

  <!-- BODY -->
  <tr>
    <td style="background:#ffffff;padding:40px;">

      <p style="margin:0 0 24px;font-size:15px;color:#333;line-height:1.6;">
        Hi <strong>' . htmlspecialchars($first_name) . '</strong>, welcome to iSkool!
        Your account has been successfully created and you are ready to get started.
      </p>

      <!-- ACCOUNT DETAILS BOX -->
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8f9fa;border:1px solid #e9ecef;border-radius:8px;margin-bottom:24px;">
        <tr>
          <td style="padding:16px 24px;border-bottom:1px solid #e9ecef;">
            <p style="margin:0;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#39d5c1;">
              Your Account Details
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 24px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="padding:6px 0;font-size:13px;color:#888;width:100px;">School</td>
                <td style="padding:6px 0;font-size:14px;font-weight:600;color:#333;">
                  ' . htmlspecialchars($schoolName) . '
                </td>
              </tr>
              <tr>
                <td style="padding:6px 0;font-size:13px;color:#888;">Platform</td>
                <td style="padding:6px 0;">
                  <a href="' . $schoolUrl . '" style="color:#39d5c1;font-weight:700;font-size:14px;">
                    ' . $schoolUrl . '
                  </a>
                </td>
              </tr>
              <tr>
                <td style="padding:6px 0;font-size:13px;color:#888;">Role</td>
                <td style="padding:6px 0;">
                  <span style="background:' . $roleColor . '1a;color:' . $roleColor . ';font-weight:700;font-size:12px;padding:3px 10px;border-radius:20px;border:1px solid ' . $roleColor . '4d;">
                    ' . $roleEmoji . ' ' . $roleLabel . '
                  </span>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>

      <!-- GETTING STARTED -->
      <p style="margin:0 0 14px;font-size:14px;font-weight:700;color:#333;">
        Getting Started:
      </p>
      ' . $roleTips . '

      <!-- CTA BUTTON -->
      <table width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;">
        <tr>
          <td align="center">
            <a href="' . $schoolUrl . '"
               style="display:inline-block;background:#39d5c1;color:#0d1117;font-weight:700;font-size:15px;padding:14px 40px;border-radius:30px;text-decoration:none;letter-spacing:0.3px;">
              Log In to iSkool →
            </a>
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
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#fff8e1;border:1px solid #ffe082;border-left:4px solid #ffc107;border-radius:4px;">
        <tr>
          <td style="padding:14px 18px;">
            <p style="margin:0;font-size:12px;color:#795548;line-height:1.6;">
              ⚠️ If you did not register for this account please contact us immediately at
              <a href="mailto:support@iskool.online" style="color:#f57f17;">support@iskool.online</a>
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
} catch (Exception $e) {
    // Silently fail — user can still log in
}
// --- END WELCOME EMAIL ---

        header("Location: registration_success.php");
        exit();
    }
    else {
        $_SESSION['register_error'] = 'Registration failed. Please try again.';
        $_SESSION['active_form'] = 'register';
        header("Location: index.php");
        exit();
    }
}

// ────────────────────── Login Logic ──────────────────────
if (isset($_POST['login'])) {
    $email    = trim($_POST['email']);
    $password = $_POST['password'];

    $stmt = $conn->prepare("SELECT name, password, profile_pic, role, is_deleted FROM users WHERE email = ?");
    $stmt->bind_param("s", $email);
    $stmt->execute();
    $stmt->store_result();

    if ($stmt->num_rows === 1) {
        $stmt->bind_result($name, $hashed_password, $profile_pic, $role, $is_deleted);
        $stmt->fetch();

        if ($is_deleted == 1) {
            $_SESSION['login_error'] = "Your account has been deleted.";
            $_SESSION['active_form'] = 'login';
            header("Location: index.php");
            exit();
        }

        if (password_verify($password, $hashed_password)) {
            $_SESSION['name']        = $name;
            $_SESSION['email']       = $email;
            $_SESSION['profile_pic'] = $profile_pic ?: 'uploads/default_profile.png';
            $_SESSION['role']        = $role;

            // --- REMEMBER ME LOGIC ---
            if (isset($_POST['remember_me'])) {
                create_remember_me_token($conn, $email);
            }
            // -------------------------

            switch ($role) {
                case 'admin':
                    $_SESSION['admin'] = true;
                    header("Location: admin_home.php");
                    break;
                case 'school_admin':
                    $_SESSION['school_admin'] = true;
                    header("Location: school_admin_dashboard.php");
                    break;
                case 'teacher':
                    $_SESSION['teacher'] = true;
                    header("Location: teacher_dashboard.php");
                    break;
                case 'learner':
                    $_SESSION['learner'] = true;
                    header("Location: learner_dashboard.php");
                    break;
                case 'parent':
                    $_SESSION['parent'] = true;
                    header("Location: parent_dashboard.php");
                    break;
                default:
                    $_SESSION['login_error'] = 'Unknown role.';
                    header("Location: index.php");
                    exit();
            }
            exit();
        } else {
            $_SESSION['login_error'] = 'Incorrect password.';
        }
    } else {
        $_SESSION['login_error'] = 'Email not found.';
    }

    $_SESSION['active_form'] = 'login';
    header("Location: index.php");
    exit();
}
?>