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

$stmtUser = $conn->prepare("SELECT title, name, surname FROM users WHERE email = ? LIMIT 1");
$stmtUser->bind_param("s", $teacher_email);
$stmtUser->execute();
$userData = $stmtUser->get_result()->fetch_assoc();
$stmtUser->close();

$teacherDisplayName = 'Teacher';
if ($userData) {
    $firstInitial       = !empty($userData['name']) ? strtoupper(substr(trim($userData['name']), 0, 1)) . '.' : '';
    $teacherDisplayName = trim($userData['title'] . ' ' . $firstInitial . ' ' . $userData['surname']);
}

$yearResult = $conn->query("SELECT id FROM academic_years WHERE is_current = 1 LIMIT 1");
if ($yearResult->num_rows === 0) {
    echo json_encode(['success' => false, 'error' => 'No active academic year']);
    exit();
}
$current_year_id  = (int)$yearResult->fetch_assoc()['id'];
$termResult       = $conn->query("SELECT current_global_term FROM platform_settings LIMIT 1");
$current_term     = $termResult ? (int)$termResult->fetch_assoc()['current_global_term'] : 1;

// School name
$schoolNameResult = $conn->query("SELECT setting_value FROM school_name WHERE setting_key = 'school_name' LIMIT 1");
$schoolName = ($schoolNameResult && $row = $schoolNameResult->fetch_assoc())
    ? $row['setting_value']
    : $_SERVER['HTTP_HOST'];

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
$evalLink = $cleanBaseUrl . "/learner_dashboard.php?page=evaluation_detail&id=" . $eval_id;
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
            $evalLink,
            $schoolName
        );
    }
    $checkSub->close();

    if (!$isPushSent || $forceEmail) {
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
            $mail->setFrom($from_email, $schoolName);
            $mail->addAddress($lEmail);
            $mail->isHTML(true);
            $mail->Subject = "New Evaluation: " . $title;
       $mail->Body = '
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&display=swap" rel="stylesheet">
</head>
<body style="margin:0;padding:0;background:#ffffff;font-family:\'DM Sans\',Helvetica,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;">
<tr><td style="padding:48px 32px 40px;">

  <!-- School name in red -->
  <p style="margin:0 0 28px;font-size:13px;font-weight:700;color:#cc1f1f;letter-spacing:0.8px;text-transform:uppercase;font-family:\'DM Sans\',Helvetica,Arial,sans-serif;">' . htmlspecialchars($schoolName) . '</p>

  <!-- Title -->
  <p style="margin:0 0 20px;font-size:28px;font-weight:700;color:#0d0d0d;line-height:1.25;letter-spacing:-0.5px;font-family:\'DM Sans\',Helvetica,Arial,sans-serif;">New evaluation: ' . htmlspecialchars($title) . '</p>

  <!-- Divider -->
  <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;"><tr><td style="border-top:1px solid #e5e5e5;"></td></tr></table>

  <!-- Greeting -->
  <p style="margin:0 0 16px;font-size:16px;color:#2d2d2d;line-height:1.8;font-family:\'DM Sans\',Helvetica,Arial,sans-serif;">Hi <strong>' . htmlspecialchars($lName) . '</strong>, your teacher has released a new evaluation and needs your honest feedback.</p>

  <!-- Note -->
  <p style="margin:0 0 36px;font-size:15px;color:#555555;line-height:1.75;font-family:\'DM Sans\',Helvetica,Arial,sans-serif;">Your feedback helps your teacher improve their teaching style. All responses are <strong>anonymous</strong> and will not affect your grades. Please be honest and thoughtful.</p>

  <!-- Sent by -->
  <p style="margin:0 0 40px;font-size:14px;color:#888888;font-family:\'DM Sans\',Helvetica,Arial,sans-serif;">Released by <span style="color:#0d0d0d;font-weight:600;">' . htmlspecialchars($teacherDisplayName) . '</span></p>

  <!-- Footer divider -->
  <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;"><tr><td style="border-top:1px solid #e5e5e5;"></td></tr></table>

  <!-- Footer -->
  <p style="margin:0;font-size:12px;color:#aaaaaa;line-height:1.6;font-family:\'DM Sans\',Helvetica,Arial,sans-serif;">
    ' . htmlspecialchars($schoolName) . ' &nbsp;&middot;&nbsp; Powered by <a href="https://iskool.online" style="color:#aaaaaa;text-decoration:underline;">iSkool</a>
  </p>

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
