<?php
session_start();
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

$email       = $_SESSION['email'];
$maxFileSize = 10 * 1024 * 1024;

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
            $isPushSent = sendPushToUser($conn, $lEmail, $title, "A study material has been uploaded.", $resourceLink, $schoolName);
        }
        $checkSub->close();

        if (!$isPushSent || $forceEmail) {
            try {
                $mail             = new PHPMailer(true);
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
                $mail->Subject = "New Resource: $title";
                $mail->Body    = '<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body style="margin:0;padding:0;background:#eeece8;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Helvetica,Arial,sans-serif;"><table width="100%" cellpadding="0" cellspacing="0" style="background:#eeece8;padding:40px 20px;"><tr><td align="center"><table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:20px;border:1px solid #e2e0dc;"><tr><td style="padding:40px 44px 36px;"><p style="margin:0 0 8px;font-size:17px;font-weight:700;color:#0d0d0d;letter-spacing:-0.3px;">' . htmlspecialchars($schoolName) . '</p><p style="margin:0 0 20px;font-size:24px;font-weight:600;color:#0d0d0d;line-height:1.3;">New resource: ' . htmlspecialchars($title) . '</p><p style="margin:0 0 32px;font-size:16px;color:#4a4a4a;line-height:1.7;">Hi ' . htmlspecialchars($lName) . ', a new study resource has been uploaded for your class.</p><table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;"><tr><td style="border-top:1px solid #e8e6e2;"></td></tr></table><p style="margin:0 0 36px;font-size:14px;color:#6a6a6a;line-height:1.6;">Uploaded by ' . htmlspecialchars($teacherDisplay) . '</p><table width="100%" cellpadding="0" cellspacing="0"><tr><td style="border-top:1px solid #e8e6e2;padding-top:24px;"><p style="margin:0;font-size:12px;color:#9a9a9a;line-height:1.6;">' . htmlspecialchars($schoolName) . ' &nbsp;&middot;&nbsp; Powered by <a href="https://iskool.online" style="color:#9a9a9a;text-decoration:none;">iSkool</a></p></td></tr></table></td></tr></table></td></tr></table></body></html>';
                $mail->send();
            } catch (Exception $e) {
                error_log("Email failed to $lEmail: " . $mail->ErrorInfo);
            }
        }
    }
    $learnerStmt->close();
}

$yearResult = $conn->query("SELECT id FROM academic_years WHERE is_current = 1 LIMIT 1");
if ($yearResult->num_rows === 0) {
    echo json_encode(['success' => false, 'error' => 'No active academic year']);
    exit();
}
$current_year_id = (int)$yearResult->fetch_assoc()['id'];

$termResult   = $conn->query("SELECT current_global_term FROM platform_settings LIMIT 1");
$current_term = $termResult ? (int)$termResult->fetch_assoc()['current_global_term'] : 1;

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
$schoolNameResult = $conn->query("SELECT setting_value FROM school_name WHERE setting_key = 'school_name' LIMIT 1");
$schoolName = ($schoolNameResult && $row = $schoolNameResult->fetch_assoc())
    ? $row['setting_value']
    : $_SERVER['HTTP_HOST'];

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
    echo json_encode(['success' => false, 'error' => 'File too large. Max 10MB.']);
    exit();
}

$allowedTypes = ['pdf', 'doc', 'docx', 'ppt', 'pptx', 'jpg', 'jpeg', 'png', 'zip'];
$ext          = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
if (!in_array($ext, $allowedTypes)) {
    echo json_encode(['success' => false, 'error' => 'Invalid file type.']);
    exit();
}

// ── CHANGED: school-scoped upload directory ──────────────────────────────────
$baseDir    = dirname(__DIR__, 2) . '/resources';
$uploadDir  = getSchoolUploadDir($conn, $baseDir);
$schoolSlug = getSchoolSlug($conn);
// ─────────────────────────────────────────────────────────────────────────────

$filename   = time() . '_' . preg_replace("/[^A-Za-z0-9._-]/", "", basename($file['name']));
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