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

$email = $_SESSION['email'];

// Teacher display name
$stmtUser = $conn->prepare("SELECT title, name, surname FROM users WHERE email = ? LIMIT 1");
$stmtUser->bind_param("s", $email);
$stmtUser->execute();
$userData = $stmtUser->get_result()->fetch_assoc();
$stmtUser->close();

$teacherDisplayName = "Teacher";
if ($userData) {
    $tTitle      = $userData['title'] ?? '';
    $tName       = $userData['name'] ?? '';
    $tSurname    = $userData['surname'] ?? '';
    $firstInitial = !empty($tName) ? strtoupper(substr(trim($tName), 0, 1)) . "." : "";
    $teacherDisplayName = trim("$tTitle $firstInitial $tSurname");
}

// School name
$dbName     = $conn->query("SELECT DATABASE()")->fetch_row()[0];
$schoolName = ucwords(str_replace(['iskool_', '_'], ['', ' '], $dbName));

// Academic year
$yearResult = $conn->query("SELECT id FROM academic_years WHERE is_current = 1 LIMIT 1");
if ($yearResult->num_rows === 0) {
    echo json_encode(['success' => false, 'error' => 'No active academic year']);
    exit();
}
$current_year_id = (int)$yearResult->fetch_assoc()['id'];

// Current term
$termResult      = $conn->query("SELECT current_global_term FROM platform_settings LIMIT 1");
$current_term    = $termResult ? (int)$termResult->fetch_assoc()['current_global_term'] : 1;

// Form data
$title      = trim($_POST['title'] ?? '');
$msg        = trim($_POST['message'] ?? '');
$class_id   = (int)($_POST['class_id'] ?? 0);
$send_to    = $_POST['send_to'] ?? 'learners';
$forceEmail = isset($_POST['force_email']);

if (empty($title) || empty($msg) || $class_id <= 0) {
    echo json_encode(['success' => false, 'error' => 'Please fill in all fields.']);
    exit();
}

// Insert announcement
$stmt = $conn->prepare("
    INSERT INTO announcements 
    (class_id, title, message, created_by, academic_year_id, term_number, send_to) 
    VALUES (?, ?, ?, ?, ?, ?, ?)
");
$stmt->bind_param("issssis", $class_id, $title, $msg, $email, $current_year_id, $current_term, $send_to);
$stmt->execute();
$stmt->close();

// Get recipients
if ($send_to === 'parents') {
    $recipientStmt = $conn->prepare("
        SELECT DISTINCT u.email, u.name 
        FROM users u 
        JOIN parent_classes pc ON u.email = pc.parent_email
        WHERE pc.class_id = ? AND pc.academic_year_id = ? AND u.role = 'parent'
    ");
} else {
    $recipientStmt = $conn->prepare("
        SELECT DISTINCT u.email, u.name 
        FROM users u 
        JOIN class_students cs ON u.email = cs.student_email
        WHERE cs.class_id = ? AND cs.academic_year_id = ? AND u.role = 'learner'
    ");
}
$recipientStmt->bind_param("ii", $class_id, $current_year_id);
$recipientStmt->execute();
$recipients = $recipientStmt->get_result();

$cleanBaseUrl       = rtrim(BASE_URL, '/');
$announcementLink = $cleanBaseUrl . "/learner_dashboard.php?page=announcement_list.php";
$fullPushTitle      = $teacherDisplayName . ": " . $title;

while ($recipient = $recipients->fetch_assoc()) {
    $rEmail     = $recipient['email'];
    $rName      = $recipient['name'];
    $isPushSent = false;

    $checkSub = $conn->prepare("SELECT id FROM user_subscriptions WHERE user_email = ? LIMIT 1");
    $checkSub->bind_param("s", $rEmail);
    $checkSub->execute();
    if ($checkSub->get_result()->num_rows > 0) {
        $isPushSent = sendPushToUser($conn, $rEmail, $fullPushTitle, $msg, $announcementLink);
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
            $mail->addAddress($rEmail);
            $mail->isHTML(true);
            $mail->Subject = htmlspecialchars($title);
            $mail->Body    = '
            <!DOCTYPE html>
            <html lang="en">
            <head>
            <meta charset="UTF-8">
            <style>
              body { margin:0; padding:0; font-family:Verdana,sans-serif; font-size:16px; line-height:1.6; }
              .wrapper { max-width:600px; margin:30px auto; border-radius:16px; overflow:hidden; box-shadow:0 8px 25px rgba(0,0,0,0.2); border:1px solid #eee; }
              .header { padding:40px; text-align:center; background:#161b22; color:#ffffff; }
              .header h1 { margin:0; font-size:32px; color:#1db954; }
              .body { padding:40px; background:#ffffff; color:#333333; }
              .body h2 { color:#1db954; font-size:24px; margin-bottom:20px; }
              .footer { padding:30px; text-align:center; background:#f4f4f4; font-size:14px; color:#666666; }
            </style>
            </head>
            <body>
              <div class="wrapper">
                <div class="header"><h1>iSkool</h1></div>
                <div class="body">
                  <h2>' . htmlspecialchars($title) . '</h2>
                  <p>' . nl2br(htmlspecialchars($msg)) . '</p>
                </div>
                <div class="footer">
                  <p>From: ' . htmlspecialchars($teacherDisplayName) . '</p>
                  <p>Best regards, ' . htmlspecialchars($schoolName) . '</p>
                  <p>Powered by iSkool &copy; ' . date("Y") . '</p>
                </div>
              </div>
            </body>
            </html>';
            $mail->send();
        } catch (Exception $e) {
            error_log("Email failed to $rEmail: " . $mail->ErrorInfo);
        }
    }
}
$recipientStmt->close();

echo json_encode(['success' => true]);