<?php
require_once __DIR__ . '/../../auth/session_guard.php';
require_once __DIR__ . '/../../auth/csrf_helper.php';
require_once dirname(__DIR__, 2) . '/config.php';
require_once dirname(__DIR__, 2) . '/school_upload_helper.php';  // ← NEW
require_once dirname(__DIR__, 2) . '/push_functions.php';
require dirname(__DIR__, 2) . '/vendor/autoload.php';

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

header('Content-Type: application/json');

if (!isset($_SESSION['email']) || $_SESSION['role'] !== 'teacher') {
    echo json_encode(['success' => false, 'error' => 'Unauthorized']);
    exit();
}

verify_csrf_token();

$email       = $_SESSION['email'];
$maxFileSize = 100 * 1024 * 1024;

// ── YouTube ID extractor ──────────────────────────────────────────────────────
function extractYouTubeId(string $url): ?string {
    $patterns = [
        '/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([A-Za-z0-9_-]{11})/',
    ];
    foreach ($patterns as $p) {
        if (preg_match($p, $url, $m)) return $m[1];
    }
    return null;
}

// ── Notify learners (shared by file & video branches) ────────────────────────
function notifyLearners($conn, $classId, $yearId, $title, $teacherEmail, $teacherDisplay, $schoolName, $forceEmail) {
    $cleanBaseUrl = rtrim(BASE_URL, '/');
    $resourceLink = $cleanBaseUrl . "/learner_dashboard.php?page=resource_list.php";

    $learnerStmt = $conn->prepare("
        SELECT u.email, u.name
        FROM users u
        JOIN class_students cs ON u.email = cs.student_email
        WHERE cs.class_id = ? AND cs.academic_year_id = ? AND u.role = 'learner'
    ");
    $learnerStmt->bind_param("ii", $classId, $yearId);
    $learnerStmt->execute();
    $learners = $learnerStmt->get_result();

    while ($learner = $learners->fetch_assoc()) {
        $lEmail     = $learner['email'];
        $lName      = $learner['name'];
        $isPushSent = false;

        $checkSub = $conn->prepare("SELECT id FROM user_subscriptions WHERE user_email = ? LIMIT 1");
        $checkSub->bind_param("s", $lEmail);
        $checkSub->execute();
        if ($checkSub->get_result()->num_rows > 0) {
            $isPushSent = sendPushToUser($conn, $lEmail, "📂 New Resource: " . $title, "A study material has been uploaded.", $resourceLink, $schoolName, 'https://iskool.xyz/assets/icons/resource.png');
        }
        $checkSub->close();

        // Email is an explicit teacher choice, never a push-delivery fallback.
        if ($forceEmail) {
            try {
                $mail             = new PHPMailer(true);
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
                $mail->Subject = "New Resource: $title";
                $mail->Body    = '
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
  <p style="margin:0 0 20px;font-size:28px;font-weight:700;color:#0d0d0d;line-height:1.25;letter-spacing:-0.5px;font-family:\'DM Sans\',Helvetica,Arial,sans-serif;">New resource: ' . htmlspecialchars($title) . '</p>

  <!-- Divider -->
  <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;"><tr><td style="border-top:1px solid #e5e5e5;"></td></tr></table>

  <!-- Message -->
  <p style="margin:0 0 36px;font-size:16px;color:#2d2d2d;line-height:1.8;font-family:\'DM Sans\',Helvetica,Arial,sans-serif;">Hi <strong>' . htmlspecialchars($lName) . '</strong>, a new study resource has been uploaded for your class.</p>

  <!-- Uploaded by -->
  <p style="margin:0 0 40px;font-size:14px;color:#888888;font-family:\'DM Sans\',Helvetica,Arial,sans-serif;">Uploaded by <span style="color:#0d0d0d;font-weight:600;">' . htmlspecialchars($teacherDisplay) . '</span></p>

  <!-- Footer divider -->
  <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;"><tr><td style="border-top:1px solid #e5e5e5;"></td></tr></table>

  <!-- Footer -->
  <p style="margin:0;font-size:12px;color:#aaaaaa;line-height:1.6;font-family:\'DM Sans\',Helvetica,Arial,sans-serif;">
    ' . htmlspecialchars($schoolName) . ' &nbsp;&middot;&nbsp; Powered by <a href="https://iskool.xyz" style="color:#aaaaaa;text-decoration:underline;">iSkool</a>
  </p>

</td></tr>
</table>
</body>
</html>';
                $mail->send();
            } catch (Exception $e) {
                error_log("Email failed to $lEmail: " . $mail->ErrorInfo);
            }
        }
    }
    $learnerStmt->close();
}

$yearStmt = $conn->prepare("SELECT id FROM academic_years WHERE is_current = 1 LIMIT 1");
$yearStmt->execute();
$yearResult = $yearStmt->get_result();
if ($yearResult->num_rows === 0) {
    echo json_encode(['success' => false, 'error' => 'No active academic year']);
    exit();
}
$current_year_id = (int)$yearResult->fetch_assoc()['id'];
$yearStmt->close();

$termStmt = $conn->prepare("SELECT current_global_term FROM platform_settings LIMIT 1");
$termStmt->execute();
$termResult = $termStmt->get_result();
$current_term = $termResult ? (int)$termResult->fetch_assoc()['current_global_term'] : 1;
$termStmt->close();

$title      = trim($_POST['title'] ?? '');
$classId    = (int)($_POST['class_id'] ?? 0);
$forceEmail = isset($_POST['force_email']);
$resourceType = ($_POST['resource_type'] ?? 'file') === 'video' ? 'video' : 'file';

// ── Teacher display name (needed by both branches) ────────────────────────────
$stmtUser = $conn->prepare("SELECT title, name, surname FROM users WHERE email = ? LIMIT 1");
$stmtUser->bind_param("s", $email);
$stmtUser->execute();
$userData = $stmtUser->get_result()->fetch_assoc();
$stmtUser->close();

$teacherDisplayName = "Teacher";
if ($userData) {
    $tTitle       = $userData['title'] ?? '';
    $tName        = $userData['name'] ?? '';
    $tSurname     = $userData['surname'] ?? '';
    $firstInitial = !empty($tName) ? strtoupper(substr(trim($tName), 0, 1)) . "." : "";
    $teacherDisplayName = trim("$tTitle $firstInitial $tSurname");
}

// ── School name (needed by both branches) ─────────────────────────────────────
$schoolNameStmt = $conn->prepare("SELECT setting_value FROM school_name WHERE setting_key = 'school_name' LIMIT 1");
$schoolNameStmt->execute();
$schoolNameResult = $schoolNameStmt->get_result();
$schoolName = ($schoolNameResult && $row = $schoolNameResult->fetch_assoc())
    ? $row['setting_value']
    : $_SERVER['HTTP_HOST'];
$schoolNameStmt->close();

if (empty($title)) {
    echo json_encode(['success' => false, 'error' => 'Please enter a title.']);
    exit();
}
if ($classId <= 0) {
    echo json_encode(['success' => false, 'error' => 'Please select a class.']);
    exit();
}

// ── VIDEO BRANCH ─────────────────────────────────────────────────────────────
if ($resourceType === 'video') {
    $rawUrl   = trim($_POST['video_url'] ?? '');
    $videoId  = extractYouTubeId($rawUrl);

    if (!$videoId) {
        echo json_encode(['success' => false, 'error' => 'Invalid YouTube URL. Please paste a valid YouTube link.']);
        exit();
    }

    $videoUrl = 'https://www.youtube.com/embed/' . $videoId . '?rel=0&modestbranding=1';
    $emptyStr = '';

    $stmt = $conn->prepare("
        INSERT INTO resources (title, filename, class_id, uploaded_by, academic_year_id, term_number, resource_type, video_url, uploaded_at)
        VALUES (?, ?, ?, ?, ?, ?, 'video', ?, NOW())
    ");
    $stmt->bind_param("ssisiss", $title, $emptyStr, $classId, $email, $current_year_id, $current_term, $videoUrl);
    $stmt->execute();
    $stmt->close();

    // Notify learners (same as file, reuses the block below)
    notifyLearners($conn, $classId, $current_year_id, $title, $email, $teacherDisplayName, $schoolName, $forceEmail);

    echo json_encode(['success' => true]);
    exit();
}

// ── FILE BRANCH ──────────────────────────────────────────────────────────────
if (!isset($_FILES['resource']) || $_FILES['resource']['error'] !== UPLOAD_ERR_OK) {
    echo json_encode(['success' => false, 'error' => 'File upload failed.']);
    exit();
}

$file = $_FILES['resource'];
if ($file['size'] > $maxFileSize) {
    echo json_encode(['success' => false, 'error' => 'File too large. Maximum size is 100MB.']);
    exit();
}

$safe_name = preg_replace('/[^a-zA-Z0-9._-]/', '_', basename($file['name']));
$ext = strtolower(pathinfo($safe_name, PATHINFO_EXTENSION));
$allowed = ['pdf', 'doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx', 'jpg', 'jpeg', 'png', 'gif', 'webp', 'mp4', 'mov', 'avi', 'mp3', 'wav', 'zip', 'rar', 'txt', 'csv'];
$blocked = ['php', 'phtml', 'phar', 'php3', 'php4', 'php5', 'php7', 'cgi', 'pl', 'asp', 'aspx', 'js', 'html', 'htm', 'svg'];
$allowedMimeTypes = [
    'pdf' => ['application/pdf'],
    'doc' => ['application/msword', 'application/vnd.ms-office', 'application/x-cfb'],
    'docx' => ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/zip'],
    'ppt' => ['application/vnd.ms-powerpoint', 'application/vnd.ms-office', 'application/x-cfb'],
    'pptx' => ['application/vnd.openxmlformats-officedocument.presentationml.presentation', 'application/zip'],
    'xls' => ['application/vnd.ms-excel', 'application/vnd.ms-office', 'application/x-cfb'],
    'xlsx' => ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/zip'],
    'jpg' => ['image/jpeg'],
    'jpeg' => ['image/jpeg'],
    'png' => ['image/png'],
    'gif' => ['image/gif'],
    'webp' => ['image/webp'],
    'mp4' => ['video/mp4'],
    'mov' => ['video/quicktime'],
    'avi' => ['video/x-msvideo'],
    'mp3' => ['audio/mpeg'],
    'wav' => ['audio/wav', 'audio/x-wav'],
    'zip' => ['application/zip', 'application/x-zip-compressed', 'multipart/x-zip'],
    'rar' => ['application/vnd.rar', 'application/x-rar-compressed'],
    'txt' => ['text/plain'],
    'csv' => ['text/csv', 'text/plain', 'application/vnd.ms-excel']
];

if ($safe_name === '' || in_array($ext, $blocked, true) || !in_array($ext, $allowed, true)) {
    echo json_encode(['success' => false, 'error' => 'File type not allowed.']);
    exit();
}

$finfo = new finfo(FILEINFO_MIME_TYPE);
$mime = $finfo->file($file['tmp_name']);
if (!isset($allowedMimeTypes[$ext]) || !in_array($mime, $allowedMimeTypes[$ext], true)) {
    echo json_encode(['success' => false, 'error' => 'File type not allowed.']);
    exit();
}

// ── CHANGED: school-scoped upload directory ──────────────────────────────────
$baseDir    = dirname(__DIR__, 2) . '/resources';
$uploadDir  = getSchoolUploadDir($conn, $baseDir);
$schoolSlug = getSchoolSlug($conn);
// ─────────────────────────────────────────────────────────────────────────────

$filename   = time() . '_' . $safe_name;
$targetPath = $uploadDir . $filename;

if (!move_uploaded_file($file['tmp_name'], $targetPath)) {
    echo json_encode(['success' => false, 'error' => 'Failed to save file.']);
    exit();
}

// filename stored in DB includes the school slug subfolder so serving works correctly
$storedFilename = $schoolSlug . '/' . $filename;

$stmt = $conn->prepare("
    INSERT INTO resources (title, filename, class_id, uploaded_by, academic_year_id, term_number, resource_type, uploaded_at)
    VALUES (?, ?, ?, ?, ?, ?, 'file', NOW())
");
$stmt->bind_param("ssisii", $title, $storedFilename, $classId, $email, $current_year_id, $current_term);
$stmt->execute();
$stmt->close();

notifyLearners($conn, $classId, $current_year_id, $title, $email, $teacherDisplayName, $schoolName, $forceEmail);

echo json_encode(['success' => true]);
