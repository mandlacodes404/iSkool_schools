<?php
session_start();
require_once dirname(__DIR__, 2) . '/config.php';
require_once dirname(__DIR__, 2) . '/push_functions.php';

header('Content-Type: application/json');

if (!isset($_SESSION['email']) || $_SESSION['role'] !== 'learner') {
    echo json_encode(['error' => 'Unauthorized']); exit();
}

require dirname(__DIR__, 2) . '/vendor/autoload.php';
use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

$learner_email   = $_SESSION['email'];
$current_year_id = (int)($conn->query("SELECT id FROM academic_years WHERE is_current = 1")->fetch_assoc()['id'] ?? 0);

$classStmt = $conn->prepare("SELECT class_id FROM class_students WHERE student_email = ? AND academic_year_id = ? LIMIT 1");
$classStmt->bind_param("si", $learner_email, $current_year_id);
$classStmt->execute();
$class_id = (int)($classStmt->get_result()->fetch_assoc()['class_id'] ?? 0);
$classStmt->close();

if (!$class_id) { echo json_encode(['error' => 'Not enrolled in a class']); exit(); }

$title           = trim($_POST['title'] ?? '');
$message_text    = trim($_POST['message'] ?? '');
$anonymous       = !empty($_POST['anonymous']);
$tagged_teachers = $_POST['teachers'] ?? [];

if (empty($title) || empty($message_text) || empty($tagged_teachers)) {
    echo json_encode(['error' => 'Please fill all fields and tag at least one teacher.']); exit();
}

// File upload
$attachment_name = null;
if (isset($_FILES['attachment']) && $_FILES['attachment']['error'] === UPLOAD_ERR_OK) {
    $target_dir = dirname(__DIR__, 2) . '/uploads/discussions/';
    if (!is_dir($target_dir)) mkdir($target_dir, 0777, true);
    $ext     = strtolower(pathinfo($_FILES['attachment']['name'], PATHINFO_EXTENSION));
    $allowed = ['pdf','jpg','jpeg','png','webp'];
    if (in_array($ext, $allowed) && $_FILES['attachment']['size'] <= 5 * 1024 * 1024) {
        $attachment_name = 'disc_' . time() . '_' . uniqid() . '.' . $ext;
        if (!move_uploaded_file($_FILES['attachment']['tmp_name'], $target_dir . $attachment_name)) {
            echo json_encode(['error' => 'File upload failed.']); exit();
        }
    } else {
        echo json_encode(['error' => 'Invalid file type or too large (max 5MB).']); exit();
    }
}

$name_row         = $conn->query("SELECT name, surname FROM users WHERE email = '$learner_email'")->fetch_assoc();
$learner_name     = $name_row['name'] ?? '';
$learner_surname  = $name_row['surname'] ?? '';
$creator_fullname = $anonymous ? null : trim($learner_name . ' ' . $learner_surname);
$creator_display  = $anonymous ? 'Anonymous Learner' : trim($learner_name . ' ' . $learner_surname);

$stmt = $conn->prepare("
    INSERT INTO class_discussions 
    (title, initial_message, class_id, creator_email, creator_anonymous, creator_name, attachment, academic_year_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
");
$stmt->bind_param("ssisissi", $title, $message_text, $class_id, $learner_email, $anonymous, $creator_fullname, $attachment_name, $current_year_id);
$stmt->execute();
$disc_id = $stmt->insert_id;
$stmt->close();

// Tag teachers
$stmt = $conn->prepare("INSERT IGNORE INTO discussion_teachers (discussion_id, teacher_email) VALUES (?, ?)");
foreach ($tagged_teachers as $t) {
    $stmt->bind_param("is", $disc_id, $t);
    $stmt->execute();
}
$stmt->close();

// Notifications (push + email) — same logic as create_discussion.php
$schoolNameResult = $conn->query("SELECT setting_value FROM school_name WHERE setting_key = 'school_name' LIMIT 1");
$schoolName = ($schoolNameResult && $snRow = $schoolNameResult->fetch_assoc())
    ? $snRow['setting_value']
    : 'iSkool';

$cleanBaseUrl            = rtrim(BASE_URL, '/');
$learnerDiscussionLink = $cleanBaseUrl . '/learner_dashboard.php?page=discussion&id=' . $disc_id;
$teacherDiscussionLink = $cleanBaseUrl . '/view_discussion.php?id=' . $disc_id;

$emailTemplate = function($recipientName, $recipientRole) use ($title, $message_text, $creator_display, $learnerDiscussionLink, $teacherDiscussionLink, $schoolName) {
    $viewLink  = $recipientRole === 'teacher' ? $teacherDiscussionLink : $learnerDiscussionLink;
    $greeting  = $recipientRole === 'teacher' ? 'Dear Teacher' : 'Hi ' . htmlspecialchars($recipientName);
    $introLine = $recipientRole === 'teacher' ? 'A learner tagged you in a new discussion:' : 'A new discussion has been started in your class:';
    return '<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body style="font-family:Verdana,sans-serif;background:#0d1117;color:#e2e8f0;padding:20px;">
        <div style="max-width:600px;margin:auto;background:#161b22;border-radius:12px;overflow:hidden;">
            <div style="background:#161b22;padding:20px;text-align:center;border-bottom:1px solid #30363d;">
                <h1 style="color:#4fd1c5;margin:0;">iSkool</h1>
            </div>
            <div style="padding:30px;">
                <p>' . $greeting . ',</p><p>' . $introLine . '</p>
                <div style="background:#0d1117;padding:20px;border-left:4px solid #4fd1c5;border-radius:8px;margin:20px 0;">
                    <strong>' . htmlspecialchars($title) . '</strong><br><br>
                    ' . nl2br(htmlspecialchars($message_text)) . '<br><br>
                    <em>— ' . htmlspecialchars($creator_display) . '</em>
                </div>
                <p style="text-align:center;">
                    <a href="' . $viewLink . '" style="background:#4fd1c5;color:#000;padding:12px 25px;border-radius:25px;text-decoration:none;font-weight:bold;">View Discussion</a>
                </p>
            </div>
        </div>
    </body></html>';
};

// Notify classmates
$cmStmt = $conn->prepare("
    SELECT DISTINCT u.email, COALESCE(u.name, u.email) AS name
    FROM users u
    JOIN class_students cs ON u.email = cs.student_email
    WHERE cs.class_id = ? AND cs.academic_year_id = ? AND u.role = 'learner' AND u.email != ?
");
$cmStmt->bind_param("iis", $class_id, $current_year_id, $learner_email);
$cmStmt->execute();
$classmates = $cmStmt->get_result()->fetch_all(MYSQLI_ASSOC);
$cmStmt->close();

foreach ($classmates as $cm) {
    $pushed = sendPushToUser($conn, $cm['email'], "New Discussion: $title", "$creator_display started a topic.", $learnerDiscussionLink, $schoolName);
    if (!$pushed) {
        try {
            $mail = new PHPMailer(true);
            $mail->isSMTP(); $mail->Host = 'iskool.online'; $mail->SMTPAuth = true;
            $mail->Username = 'noreply@iskool.online'; $mail->Password = 'ogeQkRitRfdy';
            $mail->SMTPSecure = PHPMailer::ENCRYPTION_SMTPS; $mail->Port = 465;
            $mail->setFrom('noreply@iskool.online', $schoolName);
            $mail->addAddress($cm['email']); $mail->isHTML(true);
            $mail->Subject = "New Discussion: $title";
            $mail->Body = $emailTemplate($cm['name'], 'learner');
            $mail->send();
        } catch (Exception $e) { error_log("Email error: " . $e->getMessage()); }
    }
}

// Notify tagged teachers
if (!empty($tagged_teachers)) {
    $placeholders = implode(',', array_fill(0, count($tagged_teachers), '?'));
    $types        = str_repeat('s', count($tagged_teachers));
    $tStmt        = $conn->prepare("SELECT email, COALESCE(name,'Teacher') AS name FROM users WHERE email IN ($placeholders) AND role = 'teacher'");
    $tStmt->bind_param($types, ...$tagged_teachers);
    $tStmt->execute();
    $teachers = $tStmt->get_result()->fetch_all(MYSQLI_ASSOC);
    $tStmt->close();

    foreach ($teachers as $t) {
        sendPushToUser($conn, $t['email'], "Tagged in Discussion", "$creator_display tagged you.", $teacherDiscussionLink, $schoolName);
        try {
            $mail = new PHPMailer(true);
            $mail->isSMTP(); $mail->Host = 'iskool.online'; $mail->SMTPAuth = true;
            $mail->Username = 'noreply@iskool.online'; $mail->Password = 'ogeQkRitRfdy';
            $mail->SMTPSecure = PHPMailer::ENCRYPTION_SMTPS; $mail->Port = 465;
            $mail->setFrom('noreply@iskool.online', $schoolName);
            $mail->addAddress($t['email']); $mail->isHTML(true);
            $mail->Subject = "You've been tagged: $title";
            $mail->Body = $emailTemplate($t['name'], 'teacher');
            $mail->send();
        } catch (Exception $e) { error_log("Teacher email error: " . $e->getMessage()); }
    }
}

echo json_encode(['success' => true, 'discussion_id' => $disc_id]);
