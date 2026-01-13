<?php
/**
 * iSkool - Create Announcement
 *
 * Allows teachers to create and send announcements to learners or parents in a selected class.
 * Features:
 * - Automatic assignment to current academic year and global term
 * - Dynamic school name detection from database name
 * - Email notifications via PHPMailer with branded HTML template
 * - Web push notifications using WebPush library
 * - Recipient selection (learners or parents)
 * - Full-screen processing loader
 * - Responsive form with current term indicator
 *
 * @package     iSkool
 * @subpackage  Teacher
 * @author      mandlasimphiwe99@gmail.com
 * @copyright   2025 iSkool EdTech. All rights reserved.
 * @license     Proprietary - Unauthorized use prohibited
 * @version     1.0.0
 * @since       2025-12-12
 * @link        https://iskool.online
 */
session_start();
require_once 'config.php';
require 'vendor/autoload.php';
require_once 'push_functions.php';

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;
use Minishlink\WebPush\WebPush;


if (!isset($_SESSION['email']) || $_SESSION['role'] !== 'teacher') {
    header("Location: index.php");
    exit();
}

$email = $_SESSION['email'];
$name  = $_SESSION['name'] ?? $email;
$message = "";

// ────────────────────────────────────────────────────────────────────────
// GET SCHOOL NAME FROM CURRENT DATABASE (exactly like learner dashboard)
// ────────────────────────────────────────────────────────────────────────
$dbName     = $conn->query("SELECT DATABASE()")->fetch_row()[0];
$schoolName = ucwords(str_replace(['iskool_', '_'], [' ', ' '], $dbName)); // e.g. iskool_sandtonhigh → Sandton High

// ────────────────────────────────────────────────────────────────────────
//      GET CURRENT ACADEMIC YEAR AUTOMATICALLY (NO SCHOOL_ID)
// ────────────────────────────────────────────────────────────────────────
$current_academic_year_id = null;
$result = $conn->query("SELECT id FROM academic_years WHERE is_current = 1 LIMIT 1");
if ($row = $result->fetch_assoc()) {
    $current_academic_year_id = $row['id'];
}

if (!$current_academic_year_id) {
    die("No active academic year found. Please contact your admin.");
}

// ────────────────────────────────────────────────────────────────────────
// GET CURRENT GLOBAL TERM (Your throne — same as quizzes & assignments)
// ────────────────────────────────────────────────────────────────────────
$current_global_term = 4;
$result = $conn->query("SELECT current_global_term FROM platform_settings LIMIT 1");
if ($result && $row = $result->fetch_assoc()) {
    $current_global_term = (int)$row['current_global_term'];
}

// ────────────────────────────────────────────────────────────────────────
// Get all classes in current school (current DB = current school → no filter)
// ────────────────────────────────────────────────────────────────────────
$classStmt = $conn->prepare("SELECT id, name FROM classes ORDER BY name ASC");
$classStmt->execute();
$classResult = $classStmt->get_result();
$classStmt->close();

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $title     = trim($_POST['title']);
    $msg       = trim($_POST['message']);
    $class_id  = intval($_POST['class_id']);
    $send_to   = $_POST['send_to'] ?? 'learners';

    if (!empty($title) && !empty($msg) && $class_id > 0) {
        // Insert announcement 
        $stmt = $conn->prepare("
            INSERT INTO announcements 
            (class_id, title, message, created_by, academic_year_id, term_number, send_to) 
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ");
        $stmt->bind_param("issssis", 
            $class_id, 
            $title, 
            $msg, 
            $email, 
            $current_academic_year_id, 
            $current_global_term,
            $send_to
        );
        $stmt->execute();
        $stmt->close();
        $message = "Announcement sent successfully!";

       

        // --- Email Notification (unchanged below) ---
        if ($send_to === 'parents') {
           $emailQuery = $conn->prepare("
    SELECT DISTINCT u.email, u.name 
    FROM users u 
    JOIN parent_classes pc ON u.email = pc.parent_email
    WHERE pc.class_id = ? 
    AND pc.academic_year_id = ? /* <--- Add this */
    AND u.role = 'parent'
");
        } else {
          $emailQuery = $conn->prepare("
    SELECT DISTINCT u.email, u.name 
    FROM users u 
    JOIN class_students cs ON u.email = cs.student_email
    WHERE cs.class_id = ? 
    AND cs.academic_year_id = ?  /* <--- Add this */
    AND u.role = 'learner'
");
        }

        $emailQuery->bind_param("i", $class_id);
        $emailQuery->execute();
        $recipients = $emailQuery->get_result();

// 1. Capture the "Urgent" checkbox value from the form
$force_email = isset($_POST['force_email']) ? true : false;



while ($recipient = $recipients->fetch_assoc()) {
    $currentEmail = $recipient['email'];
    $isPushSent = false;

    // 3. Check for Push Subscription
    $checkSub = $conn->prepare("SELECT id FROM user_subscriptions WHERE user_email = ? LIMIT 1");
    $checkSub->bind_param("s", $currentEmail);
    $checkSub->execute();
    $subResult = $checkSub->get_result();
    
    // 1. Generate the Deep Link for Announcements
// We use rtrim to avoid the double-slash // issue
$cleanBaseUrl = rtrim(BASE_URL, '/');
$announcementLink = $cleanBaseUrl . "/learner_dashboard.php?page=view_announcements_user.php"; 

// 2. Update the Push Function call
if ($subResult->num_rows > 0) {
    $isPushSent = sendPushToUser(
        $conn, 
        $currentEmail, 
        "📢 New Announcement: " . $title, 
        $msg,
        $announcementLink // <--- This tells the phone where to go
    );
}

    // 4. SMART ROUTING: Send email IF (Push failed/not exists) OR (Urgent is checked)
    if (!$isPushSent || $force_email) {
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
            $mail->addAddress($currentEmail);
            $mail->isHTML(true);
            $mail->Subject = htmlspecialchars($title);

            $mail->Body = '
            <!DOCTYPE html>
            <html lang="en">
            <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
              body { margin:0; padding:0; font-family:Verdana, sans-serif; font-size:16px; line-height:1.6; }
              .wrapper { max-width:600px; margin:30px auto; border-radius:16px; overflow:hidden; box-shadow:0 8px 25px rgba(0,0,0,0.2); border: 1px solid #eee; }
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
                  <p>From: ' . htmlspecialchars($name) . '</p>
                  <p>Best regards, ' . htmlspecialchars($schoolName) . '</p>
                  <p>Powered by iSkool © ' . date("Y") . '</p>
                </div>
              </div>
            </body>
            </html>';

            $mail->send();
        } catch (Exception $e) {
            error_log("Email sending failed for $currentEmail: " . $mail->ErrorInfo);
        }
    }
}
        echo '<script>
    document.addEventListener("DOMContentLoaded", function() {
        const modal = document.getElementById("successModal");
        if (modal) modal.style.display = "flex";
        setTimeout(function() {
            window.location.href = "teacher_announcements.php"; // Change to your announcements list page if different
        }, 2000);
    });
</script>';
    } else {
        $message = "Please fill in all fields.";
    }
}
?>


<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Create Announcement</title>
    <style>
        :root {
            --bg-color: #0d1117;
            --card-bg: #161b22;
            --text-color: #ffffff;
            --button-bg: #ffffff;
            --button-text: #0d1117;
            --hover-bg: #dddddd;
            --radius: 10px;
        }

        body {
            font-family: Arial, sans-serif;
            background-color: var(--bg-color);
            color: var(--text-color);
            padding: 30px;
        }

        h1 {
            color: var(--text-color);
        }

        form {
            background-color: var(--card-bg);
            padding: 20px;
            border-radius: var(--radius);
            max-width: 600px;
            box-shadow: 0 0 10px rgba(255, 255, 255, 0.1);
        }

        label {
            display: block;
            margin-top: 15px;
            font-weight: bold;
        }

        input, textarea, select {
            width: 100%;
            padding: 10px;
            margin-top: 5px;
            border-radius: 6px;
            border: 1px solid #444;
            background-color: #0d1117;
            color: var(--text-color);
        }

        button {
            margin-top: 20px;
            width: 100%;
            background-color: var(--button-bg);
            color: var(--button-text);
            border: none;
            border-radius: 6px;
            padding: 12px;
            font-weight: bold;
            cursor: pointer;
        }

        button:hover {
            background-color: var(--hover-bg);
        }

        .message {
            margin-top: 20px;
            color: #00ff99;
            font-weight: bold;
        }

        .view-button {
            display: inline-block;
            padding: 10px 15px;
            margin-bottom: 20px;
            background-color: var(--button-bg);
            color: var(--button-text);
            text-decoration: none;
            border-radius: 6px;
            font-weight: bold;
        }

        .view-button:hover {
            background-color: var(--hover-bg);
        }

        footer {
            margin-top: 60px;
            text-align: center;
            color: var(--text-color);
            opacity: 0.5;
            font-size: 14px;
        }

        footer a {
            color: var(--text-color);
            text-decoration: none;
        }

#loaderOverlay {
    position: fixed;
    top:0; left:0;
    width:100%;
    height:100%;
    background: rgba(13,17,23,0.85);
    backdrop-filter: blur(6px);
    display: none;
    justify-content: center;
    align-items: center;
    z-index: 9999;
    flex-direction: column;
    opacity: 0;
    transition: opacity 0.4s ease;
}

#loaderOverlay.show {
    display: flex;
    opacity: 1;
}

.loader-container {
    text-align: center;
}

.loader-book i {
    font-size: 5rem; /* size of the book */
    color: #00ff99; /* neon green */
    text-shadow: 0 0 10px #00ff99;
    animation: rotateBook 4s linear infinite; /* slow rotation */
}

.loader-text {
    font-size: 18px;
    color: #00ff99;
    font-weight: 600;
    text-shadow: 0 0 8px #00ff99;
    font-family: 'Nunito', sans-serif;
    margin-top: 15px;
}

/* Slow smooth rotation */
@keyframes rotateBook {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
}

/* Success Modal Styles */
#successModal {
    display: none;
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(13, 17, 23, 0.85);
    justify-content: center;
    align-items: center;
    z-index: 10000;
    animation: fadeIn 0.3s ease-in-out;
}

#successModalContent {
    background: #161b22;
    padding: 20px;
    border-radius: 10px;
    text-align: center;
    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
    max-width: 400px;
    width: 90%;
    border: 1.5px solid #30363d;
}

#successModalContent p {
    font-size: 18px;
    color: #c9d1d9;
    margin: 0 0 10px;
    font-weight: 600;
}

#successModalContent i {
    color: #238636;
    font-size: 40px;
    margin-bottom: 10px;
}

@keyframes fadeIn {
    from { opacity: 0; transform: scale(0.95); }
    to { opacity: 1; transform: scale(1); }
}
    </style>
</head>
<body>

<h1>📢 Create Announcement</h1>




<form method="POST">
    <label for="title">Title:</label>
    <input type="text" name="title" required>

    <label for="message">Message:</label>
    <textarea name="message" rows="5" required></textarea>

    <label for="class_id">Send To Class:</label>
<select name="class_id" required>
    <option value="">-- Select Class --</option>
    <?php 
    $classResult->data_seek(0); 
    while ($row = $classResult->fetch_assoc()): 
    ?>
        <option value="<?= $row['id'] ?>">
            <?= htmlspecialchars($row['name']) ?>
        </option>
    <?php endwhile; ?>
</select>

    <div style="background:#1a202c; padding:18px; border-radius:10px; border-left:5px solid #4fd1c5; margin:25px 0; text-align:center; font-size:1.1rem;">
        <strong style="color:#4fd1c5; font-size:1.3rem;">Posting to: TERM <?= $current_global_term ?></strong><br>
        <small style="color:#8b949e;">This announcement automatically belongs to the current term.<br></small>
    </div>

    <label for="send_to">Send Email Alert To:</label>
    <select name="send_to" required>
        <option value="parents">Parents Only</option>
        <option value="learners" selected>Learners Only</option>
    </select>
    <div style="background:#1a202c; padding:15px; border-radius:10px; border:1px solid #2d3748; margin-bottom:20px;">
    <label style="display: flex; align-items: center; cursor: pointer; color: #4fd1c5; font-weight: bold;">
        <input type="checkbox" name="force_email" value="1" style="width: 22px; height: 22px; margin-right: 12px; cursor: pointer;">
       we recommend sending mobile notifications but if you feel the message is important or urgent you can tick this box
    </label>
</div>

    <button type="submit">Send Announcement</button>
</form>

<!-- Full Screen Loader -->
<div id="loaderOverlay">
  <div class="loader-container">
    <div class="loader-book">
      <i class="fas fa-book-open"></i>
    </div>
    <div class="loader-text">Processing...</div>
  </div>
</div>

<!-- Success Modal -->
<div id="successModal">
    <div id="successModalContent">
        <i class="fas fa-check-circle"></i>
        <p>Announcement sent successfully!</p>
    </div>
</div>

<script>
const form = document.querySelector("form");
const loader = document.getElementById("loaderOverlay");

form.addEventListener("submit", () => {
    loader.classList.add("show");
});
</script>


</body>
</html>
