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
$maxFileSize = 10 * 1024 * 1024;

$yearResult = $conn->query("SELECT id FROM academic_years WHERE is_current = 1 LIMIT 1");
if ($yearResult->num_rows === 0) {
    echo json_encode(['success' => false, 'error' => 'No active academic year']);
    exit();
}
$current_year_id = (int)$yearResult->fetch_assoc()['id'];

$termResult = $conn->query("SELECT current_global_term FROM platform_settings LIMIT 1");
$current_term = $termResult ? (int)$termResult->fetch_assoc()['current_global_term'] : 1;

$title   = trim($_POST['title'] ?? '');
$classId = (int)($_POST['class_id'] ?? 0);
$forceEmail = isset($_POST['force_email']);

if (empty($title)) {
    echo json_encode(['success' => false, 'error' => 'Please enter a title.']);
    exit();
}
if ($classId <= 0) {
    echo json_encode(['success' => false, 'error' => 'Please select a class.']);
    exit();
}
if (!isset($_FILES['resource']) || $_FILES['resource']['error'] !== UPLOAD_ERR_OK) {
    echo json_encode(['success' => false, 'error' => 'File upload failed.']);
    exit();
}

$file = $_FILES['resource'];
if ($file['size'] > $maxFileSize) {
    echo json_encode(['success' => false, 'error' => 'File too large. Max 10MB.']);
    exit();
}

$allowedTypes = ['pdf','doc','docx','ppt','pptx','jpg','jpeg','png','zip'];
$ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
if (!in_array($ext, $allowedTypes)) {
    echo json_encode(['success' => false, 'error' => 'Invalid file type.']);
    exit();
}

$filename   = time() . '_' . preg_replace("/[^A-Za-z0-9._-]/", "", basename($file['name']));
$targetPath = dirname(__DIR__, 2) . '/resources/' . $filename;

if (!is_dir(dirname(__DIR__, 2) . '/resources/')) {
    mkdir(dirname(__DIR__, 2) . '/resources/', 0755, true);
}

if (!move_uploaded_file($file['tmp_name'], $targetPath)) {
    echo json_encode(['success' => false, 'error' => 'Failed to save file.']);
    exit();
}

$stmt = $conn->prepare("
    INSERT INTO resources (title, filename, class_id, uploaded_by, academic_year_id, term_number, uploaded_at)
    VALUES (?, ?, ?, ?, ?, ?, NOW())
");
$stmt->bind_param("ssisii", $title, $filename, $classId, $email, $current_year_id, $current_term);
$stmt->execute();
$stmt->close();

// Notify learners
$cleanBaseUrl = rtrim(BASE_URL, '/');
$resourceLink = $cleanBaseUrl . "/learner_dashboard.php?page=resource_list.php";
$learnerStmt = $conn->prepare("
    SELECT u.email, u.name 
    FROM users u
    JOIN class_students cs ON u.email = cs.student_email
    WHERE cs.class_id = ? AND cs.academic_year_id = ? AND u.role = 'learner'
");
$learnerStmt->bind_param("ii", $classId, $current_year_id);
$learnerStmt->execute();
$learners = $learnerStmt->get_result();

while ($learner = $learners->fetch_assoc()) {
    $lEmail = $learner['email'];
    $lName  = $learner['name'];
    $isPushSent = false;

    $checkSub = $conn->prepare("SELECT id FROM user_subscriptions WHERE user_email = ? LIMIT 1");
    $checkSub->bind_param("s", $lEmail);
    $checkSub->execute();
    if ($checkSub->get_result()->num_rows > 0) {
        $isPushSent = sendPushToUser($conn, $lEmail, $title, "A study material has been uploaded.", $resourceLink);
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
            $mail->setFrom('noreply@iskool.online', 'iSkool');
            $mail->addAddress($lEmail);
            $mail->isHTML(true);
            $mail->Subject = "New Resource: $title";
            $mail->Body    = '<p>Hello ' . htmlspecialchars($lName) . ', a new resource has been uploaded: <strong>' . htmlspecialchars($title) . '</strong></p>';
            $mail->send();
        } catch (Exception $e) {
            error_log("Email failed to $lEmail: " . $mail->ErrorInfo);
        }
    }
}
$learnerStmt->close();

echo json_encode(['success' => true]);