<?php
session_start();
require_once dirname(__DIR__, 2) . '/config.php';
require_once dirname(__DIR__, 2) . '/push_functions.php';
require dirname(__DIR__, 2) . '/vendor/autoload.php';

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

header('Content-Type: application/json');

if (!isset($_SESSION['email']) || $_SESSION['role'] !== 'teacher') {
    echo json_encode(['success' => false, 'error' => 'Unauthorized']);
    exit();
}

$teacher_email = $_SESSION['email'];
$teacher_name  = $_SESSION['name'] ?? 'Your Teacher';

$yearResult = $conn->query("SELECT id FROM academic_years WHERE is_current = 1 LIMIT 1");
if ($yearResult->num_rows === 0) {
    echo json_encode(['success' => false, 'error' => 'No active academic year']);
    exit();
}
$current_year_id  = (int)$yearResult->fetch_assoc()['id'];
$termResult       = $conn->query("SELECT current_global_term FROM platform_settings LIMIT 1");
$current_term     = $termResult ? (int)$termResult->fetch_assoc()['current_global_term'] : 1;

$dbName     = $conn->query("SELECT DATABASE()")->fetch_row()[0];
$schoolName = ucwords(str_replace(['iskool_', '_'], ['', ' '], $dbName));

$title       = trim($_POST['title'] ?? '');
$description = trim($_POST['description'] ?? '');
$class_id    = (int)($_POST['class_id'] ?? 0);
$use_default = !empty($_POST['use_default']);
$forceEmail  = isset($_POST['force_email']);

if (empty($title) || $class_id <= 0) {
    echo json_encode(['success' => false, 'error' => 'Please fill in all required fields.']);
    exit();
}

// Insert evaluation
$stmt = $conn->prepare("
    INSERT INTO teacher_evaluations (title, description, class_id, created_by, academic_year_id, term_number)
    VALUES (?, ?, ?, ?, ?, ?)
");
$stmt->bind_param("ssisii", $title, $description, $class_id, $teacher_email, $current_year_id, $current_term);
$stmt->execute();
$eval_id = $stmt->insert_id;
$stmt->close();

// Copy default statements
if ($use_default) {
    $conn->query("
        INSERT INTO evaluation_statements (evaluation_id, statement, order_num)
        SELECT $eval_id, statement, order_num 
        FROM evaluation_statements WHERE evaluation_id = 1
    ");
}

// Custom statements
if (isset($_POST['statements']) && is_array($_POST['statements'])) {
    $stmtQ = $conn->prepare("INSERT INTO evaluation_statements (evaluation_id, statement, order_num) VALUES (?, ?, ?)");
    foreach ($_POST['statements'] as $order => $stmt_text) {
        if (trim($stmt_text) !== '') {
            $stmtQ->bind_param("isi", $eval_id, $stmt_text, $order);
            $stmtQ->execute();
        }
    }
    $stmtQ->close();
}

// Notify learners
$cleanBaseUrl = rtrim(BASE_URL, '/');
$evalLink = $cleanBaseUrl . "/learner_dashboard.php?page=evaluation_list.php";
$learnersQuery = $conn->prepare("
    SELECT DISTINCT u.email, COALESCE(u.name, u.email) AS name
    FROM users u
    JOIN class_students cs ON u.email = cs.student_email
    WHERE cs.class_id = ? AND cs.academic_year_id = ? AND u.role = 'learner'
");
$learnersQuery->bind_param("ii", $class_id, $current_year_id);
$learnersQuery->execute();
$learnersResult = $learnersQuery->get_result();

while ($learner = $learnersResult->fetch_assoc()) {
    $lEmail     = $learner['email'];
    $lName      = $learner['name'];
    $isPushSent = false;

    $checkSub = $conn->prepare("SELECT id FROM user_subscriptions WHERE user_email = ? LIMIT 1");
    $checkSub->bind_param("s", $lEmail);
    $checkSub->execute();
    if ($checkSub->get_result()->num_rows > 0) {
        $isPushSent = sendPushToUser(
            $conn, $lEmail,
            "📊 New Evaluation: " . $title,
            "Your teacher requested your feedback. Please complete the evaluation.",
            $evalLink
        );
    }
    $checkSub->close();

    if (!$isPushSent || $forceEmail) {
        try {
            $mail = new PHPMailer(true);
            $mail->isSMTP();
            $mail->Host       = 'iskool.online';
            $mail->SMTPAuth   = true;
            $mail->Username   = 'noreply@iskool.online';
            $mail->Password   = 'ogeQkRitRfdy';
            $mail->SMTPSecure = PHPMailer::ENCRYPTION_SMTPS;
            $mail->Port       = 465;
            $mail->setFrom('noreply@iskool.online', $schoolName);
            $mail->addAddress($lEmail);
            $mail->isHTML(true);
            $mail->Subject = "New Evaluation: " . $title;
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
    <td style="background:#39d5c1;padding:20px 40px;text-align:center;">
      <p style="margin:0;font-size:18px;font-weight:700;color:#0d1117;">
        ⭐ New Teacher Evaluation
      </p>
    </td>
  </tr>

  <!-- SCHOOL + TEACHER ROW -->
  <tr>
    <td style="background:#161b22;padding:14px 40px;text-align:center;border-bottom:1px solid #21262d;">
      <p style="margin:0;font-size:13px;color:#8b949e;">
        <span style="color:#e6edf3;font-weight:600;">' . htmlspecialchars($teacherDisplayName) . '</span>
        &nbsp;·&nbsp;
        <span style="color:#39d5c1;">' . htmlspecialchars($schoolName) . '</span>
      </p>
    </td>
  </tr>

  <!-- BODY -->
  <tr>
    <td style="background:#ffffff;padding:40px;">

      <p style="margin:0 0 24px;font-size:15px;color:#333;line-height:1.6;">
        Hi <strong>' . htmlspecialchars($lName) . '</strong>, your teacher has released a new evaluation and needs your honest feedback.
      </p>

      <!-- EVALUATION TITLE BOX -->
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8f9fa;border:1px solid #e9ecef;border-left:4px solid #39d5c1;border-radius:4px;margin-bottom:24px;">
        <tr>
          <td style="padding:16px 20px;">
            <p style="margin:0;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#39d5c1;margin-bottom:6px;">
              Evaluation
            </p>
            <p style="margin:0;font-size:18px;font-weight:700;color:#0d1117;">
              ' . htmlspecialchars($title) . '
            </p>
          </td>
        </tr>
      </table>

      <!-- INFO BOX -->
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3e5f5;border:1px solid #ce93d8;border-radius:8px;margin-bottom:28px;">
        <tr>
          <td style="padding:16px 20px;">
            <p style="margin:0;font-size:13px;color:#6a1b9a;line-height:1.7;">
              Your feedback helps your teacher improve their teaching. 
              All responses are <strong>anonymous</strong> and will not affect your grades.
              Please be honest and thoughtful.
            </p>
          </td>
        </tr>
      </table>

      <!-- CTA BUTTON -->
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
        <tr>
          <td align="center">
            <a href="' . $evalLink . '"
               style="display:inline-block;background:#39d5c1;color:#0d1117;font-weight:700;font-size:15px;padding:14px 40px;border-radius:30px;text-decoration:none;letter-spacing:0.3px;">
              Complete Evaluation →
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

      <!-- FROM -->
      <p style="margin:0;font-size:13px;color:#888;">
        Released by
        <strong style="color:#333;">' . htmlspecialchars($teacherDisplayName) . '</strong>
        via
        <strong style="color:#333;">' . htmlspecialchars($schoolName) . '</strong>
      </p>

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
            error_log("Eval email failed to $lEmail: " . $mail->ErrorInfo);
        }
    }
}
$learnersQuery->close();

echo json_encode(['success' => true]);