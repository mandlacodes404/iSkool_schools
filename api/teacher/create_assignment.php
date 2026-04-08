<?php
session_start();
require_once dirname(__DIR__, 2) . '/config.php';
require_once dirname(__DIR__, 2) . '/school_upload_helper.php';  // ← NEW

header('Content-Type: application/json');

if (!isset($_SESSION['email']) || $_SESSION['role'] !== 'teacher') {
    echo json_encode(['error' => 'Unauthorized']);
    exit();
}

require_once dirname(__DIR__, 2) . '/push_functions.php';
require_once dirname(__DIR__, 2) . '/vendor/autoload.php';

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

$email = $_SESSION['email'];

// Get teacher display name
$stmtUser = $conn->prepare("SELECT title, name, surname FROM users WHERE email = ? LIMIT 1");
$stmtUser->bind_param("s", $email);
$stmtUser->execute();
$userData = $stmtUser->get_result()->fetch_assoc();
$stmtUser->close();

$teacherDisplayName = 'Teacher';
if ($userData) {
    $firstInitial       = !empty($userData['name']) ? strtoupper(substr(trim($userData['name']), 0, 1)) . '.' : '';
    $teacherDisplayName = trim($userData['title'] . ' ' . $firstInitial . ' ' . $userData['surname']);
}

// Get current academic year
$yearResult      = $conn->query("SELECT id FROM academic_years WHERE is_current = 1 LIMIT 1");
$current_year_id = (int)$yearResult->fetch_assoc()['id'];

if (!$current_year_id) {
    echo json_encode(['error' => 'No active academic year found.']);
    exit();
}

// Get current term
$termResult   = $conn->query("SELECT current_global_term FROM platform_settings LIMIT 1");
$current_term = (int)$termResult->fetch_assoc()['current_global_term'];

// Validate inputs
$title       = trim($_POST['title'] ?? '');
$description = trim($_POST['description'] ?? '');
$due_date    = $_POST['due_date'] ?? '';
$class_id    = (int)($_POST['class_id'] ?? 0);
$force_email = isset($_POST['force_email']);

if (!$title || !$description || !$due_date || $class_id < 1) {
    echo json_encode(['error' => 'All required fields must be filled.']);
    exit();
}

// Handle file upload
$filePath       = null;
$hasAttachment  = false;
$attachmentName = '';

if (isset($_FILES['attachment']) && $_FILES['attachment']['error'] === UPLOAD_ERR_OK) {
    // ── CHANGED: school-scoped upload directory ──────────────────────────────
    $baseDir   = dirname(__DIR__, 2) . '/assignment_Uploads';
    $uploadDir = getSchoolUploadDir($conn, $baseDir);
    $schoolSlug = getSchoolSlug($conn);
    // ────────────────────────────────────────────────────────────────────────

    $filename = time() . '_' . basename($_FILES['attachment']['name']);

    // file_url stored in DB as relative path (used by learner to download)
    $filePath = 'assignment_Uploads/' . $schoolSlug . '/' . $filename;

    if (move_uploaded_file($_FILES['attachment']['tmp_name'], $uploadDir . $filename)) {
        $hasAttachment  = true;
        $attachmentName = basename($_FILES['attachment']['name']);
    }
}

// Insert assignment
$stmt = $conn->prepare("
    INSERT INTO assignments
    (title, description, due_date, class_id, created_by, file_url, academic_year_id, term_number)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
");
$stmt->bind_param("sssissii",
    $title,
    $description,
    $due_date,
    $class_id,
    $email,
    $filePath,
    $current_year_id,
    $current_term
);

if (!$stmt->execute()) {
    echo json_encode(['error' => 'Failed to save assignment.']);
    exit();
}
$assignment_id = $stmt->insert_id;
$stmt->close();

// School name
$schoolNameResult = $conn->query("SELECT setting_value FROM school_name WHERE setting_key = 'school_name' LIMIT 1");
$schoolName = ($schoolNameResult && $row = $schoolNameResult->fetch_assoc())
    ? $row['setting_value']
    : $_SERVER['HTTP_HOST'];

// Formatted due date
$formatted_due_date = date("l, F j, Y", strtotime($due_date));

// Assignment link
$cleanBaseUrl   = rtrim(BASE_URL, '/');
$assignmentLink = $cleanBaseUrl . "/learner_dashboard.php?page=assignment_list.php";
// Email body
$emailBody = '
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
      <p style="margin:0;font-size:12px;color:#8b949e;letter-spacing:2px;">
        iSkool
      </p>
    </td>
  </tr>

  <!-- SCHOOL + TEACHER ROW -->
  <tr>
    <td style="background:#161b22;padding:14px 40px;text-align:center;border-bottom:1px solid #21262d;">
      <p style="margin:0;font-size:13px;color:#8b949e;">
        <span style="color:#39d5c1;">' . htmlspecialchars($schoolName) . '</span>
      </p>
    </td>
  </tr>

  <!-- BODY -->
  <tr>
    <td style="background:#ffffff;padding:40px;">

      <p style="margin:0 0 24px;font-size:15px;color:#333;line-height:1.6;">
        Hi <strong>{{name}}</strong>, a new assignment has been posted in your class.
      </p>

      <!-- ASSIGNMENT TITLE BOX -->
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8f9fa;border:1px solid #e9ecef;border-left:4px solid #39d5c1;border-radius:4px;margin-bottom:20px;">
        <tr>
          <td style="padding:16px 20px;">
            <p style="margin:0;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#39d5c1;margin-bottom:6px;">
              Assignment
            </p>
            <p style="margin:0;font-size:18px;font-weight:700;color:#0d1117;">
              ' . htmlspecialchars($title) . '
            </p>
          </td>
        </tr>
      </table>

      <!-- DESCRIPTION -->
      <p style="margin:0 0 24px;font-size:15px;color:#444;line-height:1.8;">
        ' . nl2br(htmlspecialchars($description)) . '
      </p>

      <!-- DUE DATE + ATTACHMENT ROW -->
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
        <tr>
          <!-- DUE DATE -->
          <td width="50%" style="padding-right:8px;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#fff8e1;border:1px solid #ffe082;border-radius:8px;">
              <tr>
                <td style="padding:14px 16px;">
                  <p style="margin:0;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#f57f17;margin-bottom:4px;">
                    Due Date
                  </p>
                  <p style="margin:0;font-size:15px;font-weight:700;color:#e65100;">
                    ' . $formatted_due_date . '
                  </p>
                </td>
              </tr>
            </table>
          </td>
          <!-- ATTACHMENT -->
          <td width="50%" style="padding-left:8px;">
            ' . ($hasAttachment ? '
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#e8f4fd;border:1px solid #b3d9f7;border-radius:8px;">
              <tr>
                <td style="padding:14px 16px;">
                  <p style="margin:0;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#1565c0;margin-bottom:4px;">
                    Attachment
                  </p>
                  <p style="margin:0;font-size:14px;font-weight:600;color:#0d47a1;">
                    📎 ' . htmlspecialchars($attachmentName) . '
                  </p>
                </td>
              </tr>
            </table>' : '
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8f9fa;border:1px solid #e9ecef;border-radius:8px;">
              <tr>
                <td style="padding:14px 16px;">
                  <p style="margin:0;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#aaa;margin-bottom:4px;">
                    Attachment
                  </p>
                  <p style="margin:0;font-size:14px;color:#aaa;">
                    No attachment
                  </p>
                </td>
              </tr>
            </table>') . '
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
        Assigned by
        <strong style="color:#333;">' . htmlspecialchars($teacherDisplayName) . '</strong>
        
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

// Get learners in class
$learnersQuery = $conn->prepare("
    SELECT DISTINCT u.email, COALESCE(u.name, u.email) AS name
    FROM users u
    JOIN class_students cs ON u.email = cs.student_email
    WHERE cs.class_id = ?
      AND cs.academic_year_id = ?
      AND u.role = 'learner'
");
$learnersQuery->bind_param("ii", $class_id, $current_year_id);
$learnersQuery->execute();
$learnersResult = $learnersQuery->get_result();

while ($learner = $learnersResult->fetch_assoc()) {
    $currentEmail = $learner['email'];
    $isPushSent   = false;

    // Try push first
    $checkSub = $conn->prepare("SELECT id FROM user_subscriptions WHERE user_email = ? LIMIT 1");
    $checkSub->bind_param("s", $currentEmail);
    $checkSub->execute();
    $subResult = $checkSub->get_result();
    $checkSub->close();

    if ($subResult->num_rows > 0) {
        $pushTitle  = $teacherDisplayName . ': ' . $title;
        $isPushSent = sendPushToUser(
            $conn,
            $currentEmail,
            $pushTitle,
            'Due: ' . $formatted_due_date,
            $assignmentLink
        );
    }

    // Email if push failed or force_email checked
    if (!$isPushSent || $force_email) {
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
            $mail->addAddress($currentEmail);
            $mail->isHTML(true);
            $mail->Subject = 'New Assignment: ' . $title;
            $mail->Body    = str_replace('{{name}}', htmlspecialchars($learner['name']), $emailBody);
            $mail->send();
        } catch (Exception $e) {
            error_log("Assignment email failed ({$currentEmail}): " . $mail->ErrorInfo);
        }
    }
}
$learnersQuery->close();

echo json_encode(['success' => true, 'assignment_id' => $assignment_id]);